import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

/**
 * Deterministic (zero-latency, fully offline) khatabook parser.
 *
 * This is the fallback engine used when Ollama is not reachable, so that
 * "AI Smart Khatabook" import still produces reviewable ledger candidates
 * without any LLM. It is intentionally conservative: anything the rules are
 * unsure about is emitted with `needs_review: true` instead of being dropped.
 *
 * Supported input: Hindi / Hinglish / English shorthand such as
 *   "Ramesh ji 450 udhaar diya 2 packet aata"
 *   "Sunil paid 1200 via gpay jama"
 *   "Vikram ne 250 diye via phonepe"
 *   "Mahesh chai biscuit 85 udhaar kal dega bola"
 *   "Suresh Kumar ₹1,250.50 udhaar 12/09/2026"
 */

export interface RuleTransaction {
  customer_name: string;
  type: 'CREDIT' | 'PAYMENT';
  amount_paise: number;
  date: string;
  description: string;
  confidence: number;
  needs_review: boolean;
  evidence: string;
}

export interface RuleExtractionResult {
  success: boolean;
  data: { transactions: RuleTransaction[]; warnings: string[] };
  engine: 'RULES';
  modelUsed: string;
}

export const RULE_ENGINE_NAME = 'rule-engine';
export const UNKNOWN_CUSTOMER = 'Unknown';

// Amounts above this are almost certainly a mis-read (₹5,00,000).
const MAX_AMOUNT_PAISE = 50_000_000;
// "2 packet", "10kg", "500ml" — quantities, not money.
const UNIT_WORDS =
  'kg|kgs|kilo|kilos|gram|grams|gm|gms|g|ltr|ltrs|litre|litres|liter|liters|ml|pcs|pc|piece|pieces|packet|packets|pkt|pkts|pack|packs|dozen|box|boxes|bottle|bottles|sachet|sachets|unit|units|nos|qty|no';

const STRONG_CREDIT_RE = /\b(udhaar|udhar|udhari|udhaari|udhaare|khata|khatta|baaki|baki|bakaya|bakaaya|outstanding|owes|owed|due|credit)\b/i;
const STRONG_PAYMENT_RE = /\b(paid|pay|payment|jama|jamaa|jam|deposit|deposited|received|refund|refunded|gpay|googlepay|phonepe|phone\s*pe|paytm|upi|bheja|bhej|transfer|transferred|settle|settled|settlement|cleared)\b/i;
// Weak markers: "diya" alone is payment, but "udhaar diya" is credit.
const WEAK_PAYMENT_RE = /\b(diya|diye|di|de|dia|cash|mila|mile|aaya|aaye)\b/i;
// Words that can never be part of a customer name.
const NAME_STOP_RE = new RegExp(
  `${STRONG_CREDIT_RE.source}|${STRONG_PAYMENT_RE.source}|${WEAK_PAYMENT_RE.source}`,
  'i'
);

const PARTICLES = new Set([
  'ji', 'jee', 'je', 'ne', 'ko', 'se', 'ki', 'ka', 'ke', 'bhai', 'bhaiya', 'bhaiyya',
  'didi', 'sir', 'madam', 'sahab', 'sahib', 'saab', 'bhau', 'mr', 'mrs', 'ms', 'shri',
  'sri', 'shrimati', 'smt',
]);
const CONNECTIVES = new Set(['aur', 'and', 'the', 'a', 'an', 'to', 'of']);

const DATE_WORD_RE = /\b(aaj|aj|today|abhi|kal|yesterday|parso|parson|pichle\s+hafte|last\s+week|is\s+hafte|this\s+week)\b/i;
const DATE_NUMERIC_RE = /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/g;
const TIME_RE = /\b\d{1,2}:\d{2}\b/g;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAME_RE = new RegExp(`\\b(\\d{1,2})\\s*(${MONTHS.join('|')})[a-z]*\\.?\\s*(\\d{4})?`, 'i');

interface AmountHit {
  rupees: number;
  start: number;
  end: number;
  explicit: boolean;
}

function refDay(referenceDate?: string) {
  const base = referenceDate ? dayjs(referenceDate) : dayjs();
  return base.isValid() ? base : dayjs();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "12/09/2026" or "09/2026" — a number next to a date separator is not money. */
function isDateFragment(line: string, start: number, end: number): boolean {
  const before = line.slice(Math.max(0, start - 1), start);
  const after = line.slice(end, end + 1);
  return /[\/\-.]/.test(before) || /[\/\-.]/.test(after);
}

/** "10kg", "2 packet" — a quantity, not money. */
function isUnitAttached(line: string, end: number): boolean {
  return new RegExp(`^\\s*(?:${UNIT_WORDS})\\b`, 'i').test(line.slice(end));
}

function collectNumbers(line: string, skipUnits: boolean): AmountHit[] {
  const hits: AmountHit[] = [];
  const bare = /\d[\d,]*(?:\.\d+)?/g;
  let m: RegExpExecArray | null;

  while ((m = bare.exec(line)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (isDateFragment(line, start, end)) continue;
    if (skipUnits && isUnitAttached(line, end)) continue;
    const rupees = parseFloat(m[0].replace(/,/g, ''));
    if (Number.isFinite(rupees) && rupees > 0) hits.push({ rupees, start, end, explicit: false });
  }

  return hits;
}

/** Longest plausible amount in the line, preferring explicitly marked currency. */
function findAmount(line: string): AmountHit | null {
  const explicit = [
    /(?:₹|rs\.?|inr|rupees?)\s*([\d,]+(?:\.\d+)?)/i,
    /([\d,]+(?:\.\d+)?)\s*(?:\/-|rupees?|rs\b|inr\b)/i,
    /([\d]+(?:\.\d+)?)\s*k\b/i, // "5k"
  ];

  for (const re of explicit) {
    const m = re.exec(line);
    if (m) {
      let rupees = parseFloat(m[1].replace(/,/g, ''));
      if (/\bk\b/i.test(m[0])) rupees *= 1000;
      if (rupees > 0) {
        return { rupees, start: m.index, end: m.index + m[0].length, explicit: true };
      }
    }
  }

  const candidates = collectNumbers(line, true);
  const pool = candidates.length > 0 ? candidates : collectNumbers(line, false);
  if (pool.length === 0) return null;

  return pool.reduce((a, b) => (b.rupees > a.rupees ? b : a));
}

function detectType(line: string): { type: 'CREDIT' | 'PAYMENT'; confident: boolean; mixed: boolean } {
  const credit = STRONG_CREDIT_RE.exec(line);
  const payment = STRONG_PAYMENT_RE.exec(line);

  if (credit && payment) {
    // Both present ("udhaar khata ... paid 500"): whichever appears first usually
    // describes the verb, but this is genuinely ambiguous — flag for review.
    return { type: payment.index < credit.index ? 'PAYMENT' : 'CREDIT', confident: false, mixed: true };
  }
  if (credit) return { type: 'CREDIT', confident: true, mixed: false };
  if (payment) return { type: 'PAYMENT', confident: true, mixed: false };
  if (WEAK_PAYMENT_RE.test(line)) return { type: 'PAYMENT', confident: false, mixed: false };
  return { type: 'CREDIT', confident: false, mixed: false };
}

function isCapitalized(token: string): boolean {
  return /^[A-Z][a-z]*$/.test(token);
}

/**
 * Customer name = the leading tokens before the amount / keyword, skipping
 * honorifics. Extra words are only absorbed while they look like proper nouns
 * ("Pooja Gupta") so items never get swallowed ("Mahesh chai biscuit").
 */
function detectCustomer(
  line: string,
  cutAt: number
): { name: string; confident: boolean; usedTokens: string[] } {
  const head = line.slice(0, cutAt > 0 ? cutAt : line.length);
  const candidates = head
    .replace(/^[\s\-*•\d.)]+/, ' ')
    .split(/[\s,;]+/)
    .filter(Boolean)
    .filter((t) => !/\d/.test(t))
    .filter((t) => !PARTICLES.has(t.toLowerCase()))
    .filter((t) => !CONNECTIVES.has(t.toLowerCase()))
    .filter((t) => !NAME_STOP_RE.test(t))
    .filter((t) => !DATE_WORD_RE.test(t));

  if (candidates.length === 0) {
    return { name: UNKNOWN_CUSTOMER, confident: false, usedTokens: [] };
  }

  const picked = [candidates[0]];
  for (let i = 1; i < candidates.length && picked.length < 3; i++) {
    if (!isCapitalized(candidates[i])) break;
    picked.push(candidates[i]);
  }

  return { name: picked.join(' '), confident: true, usedTokens: picked };
}

function detectDate(line: string, base: dayjs.Dayjs): { date: string; confident: boolean } {
  const numeric = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(line);
  if (numeric) {
    const [, d, mo, y] = numeric;
    const year = y.length === 2 ? `20${y}` : y;
    const parsed = dayjs(`${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`, 'YYYY-MM-DD', true);
    if (parsed.isValid()) return { date: parsed.format('YYYY-MM-DD'), confident: true };
    // Probably MM/DD; try the other interpretation before giving up.
    const swapped = dayjs(`${year}-${d.padStart(2, '0')}-${mo.padStart(2, '0')}`, 'YYYY-MM-DD', true);
    if (swapped.isValid()) return { date: swapped.format('YYYY-MM-DD'), confident: false };
    return { date: base.format('YYYY-MM-DD'), confident: false };
  }

  const monthName = MONTH_NAME_RE.exec(line);
  if (monthName) {
    const month = MONTHS.indexOf(monthName[2].toLowerCase()) + 1;
    const year = monthName[3] || base.format('YYYY');
    const parsed = dayjs(
      `${year}-${String(month).padStart(2, '0')}-${monthName[1].padStart(2, '0')}`,
      'YYYY-MM-DD',
      true
    );
    if (parsed.isValid()) return { date: parsed.format('YYYY-MM-DD'), confident: true };
  }

  const rel = DATE_WORD_RE.exec(line);
  if (rel) {
    const word = rel[1].toLowerCase().replace(/\s+/g, ' ');
    if (/^(aaj|aj|today|abhi)$/.test(word)) return { date: base.format('YYYY-MM-DD'), confident: true };
    // "kal" is ambiguous in Hindi (yesterday/tomorrow); treat as past for a ledger.
    if (/^(kal|yesterday)$/.test(word)) return { date: base.subtract(1, 'day').format('YYYY-MM-DD'), confident: false };
    if (/^(parso|parson)$/.test(word)) return { date: base.subtract(2, 'day').format('YYYY-MM-DD'), confident: false };
    return { date: base.subtract(7, 'day').format('YYYY-MM-DD'), confident: false };
  }

  return { date: base.format('YYYY-MM-DD'), confident: false };
}

/** Whatever is left once the name, amount, keywords and dates are stripped off. */
function buildDescription(line: string, amount: AmountHit | null, usedTokens: string[]): string {
  let rest = line;
  if (amount) {
    rest = rest.slice(0, amount.start) + ' ' + rest.slice(amount.end);
  }

  for (const token of usedTokens) {
    rest = rest.replace(new RegExp(`(^|[\\s,;])${escapeRegExp(token)}(?=[\\s,;]|$)`, 'i'), ' ');
  }

  rest = rest
    .replace(new RegExp(STRONG_CREDIT_RE.source, 'gi'), ' ')
    .replace(new RegExp(STRONG_PAYMENT_RE.source, 'gi'), ' ')
    .replace(new RegExp(WEAK_PAYMENT_RE.source, 'gi'), ' ')
    .replace(DATE_WORD_RE, ' ')
    .replace(DATE_NUMERIC_RE, ' ')
    .replace(TIME_RE, ' ')
    .replace(MONTH_NAME_RE, ' ')
    .replace(/\bvia\b/gi, ' ');

  const tokens = rest.split(/[\s,;]+/).filter(Boolean).filter((t) => /[A-Za-z0-9\u0900-\u0B7F]/.test(t));
  while (tokens.length > 0 && PARTICLES.has(tokens[0].toLowerCase())) tokens.shift();

  return tokens.join(' ').trim();
}

/** Split one physical line into probable transaction segments. */
function splitSegments(line: string): string[] {
  const cleaned = line.replace(/^\s*[-*•]\s*/, '').replace(/^\s*\d+[.)]\s*/, '');
  if (!cleaned.trim()) return [];

  // Split on separators, but never inside a number ("1,250.50").
  const parts = cleaned
    .split(/\s*(?:;|\s+aur\s+|\s+and\s+|\s+\+\s+|(?<!\d)\s*,(?!\s*\d))\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);

  const withNumbers = parts.filter((p) => /\d/.test(p));
  return withNumbers.length > 1 ? withNumbers : [cleaned];
}

export function parseTransactionsWithRules(
  rawText: string,
  referenceDate?: string
): RuleExtractionResult {
  const base = refDay(referenceDate);
  const warnings: string[] = [
    'Rule-based parser used (Ollama unavailable). Please review amounts, names and dates before posting.',
  ];
  const transactions: RuleTransaction[] = [];

  const lines = String(rawText || '').split(/\r?\n/);

  lines.forEach((rawLine, lineIndex) => {
    const lineNo = lineIndex + 1;
    const line = rawLine.trim();
    if (!line) return;

    for (const segment of splitSegments(line)) {
      const amount = findAmount(segment);

      if (!amount) {
        warnings.push(`Line ${lineNo}: no amount detected, skipped — "${segment.slice(0, 80)}"`);
        continue;
      }

      const amountPaise = Math.round(amount.rupees * 100);
      if (amountPaise > MAX_AMOUNT_PAISE) {
        warnings.push(`Line ${lineNo}: amount ₹${amount.rupees} looks implausible, skipped.`);
        continue;
      }

      const typeInfo = detectType(segment);
      const customer = detectCustomer(segment, amount.start > 0 ? amount.start : segment.length);
      const dateInfo = detectDate(segment, base);

      let description = buildDescription(segment, amount, customer.usedTokens);
      if (!description) {
        description = typeInfo.type === 'CREDIT' ? 'Udhaar (auto-parsed)' : 'Payment received (auto-parsed)';
      }

      let confidence = 0.35;
      if (typeInfo.confident) confidence += 0.15;
      if (amount.explicit) confidence += 0.15;
      if (customer.confident && customer.name !== UNKNOWN_CUSTOMER) confidence += 0.1;
      if (dateInfo.confident) confidence += 0.1;
      if (typeInfo.mixed) confidence -= 0.15;
      confidence = Math.max(0.3, Math.min(0.8, Number(confidence.toFixed(2))));

      const needsReview =
        confidence < 0.8 ||
        !typeInfo.confident ||
        customer.name === UNKNOWN_CUSTOMER ||
        !dateInfo.confident;

      if (customer.name === UNKNOWN_CUSTOMER) {
        warnings.push(`Line ${lineNo}: could not detect a customer name — assign it in review.`);
      }
      if (typeInfo.mixed) {
        warnings.push(`Line ${lineNo}: found both udhaar and payment wording — direction guessed as ${typeInfo.type}.`);
      }

      transactions.push({
        customer_name: customer.name,
        type: typeInfo.type,
        amount_paise: amountPaise,
        date: dateInfo.date,
        description,
        confidence,
        needs_review: needsReview,
        evidence: segment.slice(0, 500),
      });
    }
  });

  if (transactions.length === 0) {
    warnings.push('No ledger entries could be parsed from this text. Add a name and an amount, e.g. "Ramesh 450 udhaar".');
  }

  return {
    success: true,
    data: { transactions, warnings },
    engine: 'RULES',
    modelUsed: RULE_ENGINE_NAME,
  };
}
