import { aiExtractionResultSchema } from '../schemas';
import { DEFAULT_OLLAMA_MODEL, OLLAMA_BASE_URL, OLLAMA_TIMEOUT_MS } from '../config';
import { RULE_ENGINE_NAME } from './rule-parser.service';
import prisma from '../db';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

const AI_TIMEOUT = OLLAMA_TIMEOUT_MS;
const MODEL_SETTING_KEY = 'ollama_model';

export type ExtractionEngine = 'LLM' | 'RULES';

export interface OllamaModelInfo {
  name: string;
  sizeBytes: number;
  parameterSize: string | null;
  modifiedAt: string | null;
}

export interface AIStatus {
  available: boolean;
  /** Model that will actually be used for inference. */
  model: string;
  /** Model configured via OLLAMA_MODEL in .env. */
  envModel: string;
  /** Whether the active model came from the DB setting or the .env default. */
  modelSource: 'settings' | 'env';
  baseUrl: string;
  /** Every model tag currently installed in Ollama. */
  availableModels: string[];
  /** The deterministic offline parser is always available, even without Ollama. */
  fallbackEngine: string;
  error?: string;
}

function modelNameMatches(installed: string, wanted: string): boolean {
  return installed === wanted || installed === `${wanted}:latest` || wanted === `${installed}:latest`;
}

/** `fetch().json()` is typed as `unknown` on modern @types/node — parse with an expected shape. */
async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

/**
 * The active Ollama model. Values set from Store Settings are persisted in the
 * DB and take precedence over the OLLAMA_MODEL default from .env.
 */
export async function getActiveModel(): Promise<string> {
  try {
    const row = await prisma.appSettings.findUnique({ where: { key: MODEL_SETTING_KEY } });
    if (row?.value) return row.value;
  } catch {
    // DB not reachable yet — fall back to the env default.
  }
  return DEFAULT_OLLAMA_MODEL;
}

export async function setActiveModel(model: string, source = 'settings'): Promise<void> {
  await prisma.appSettings.upsert({
    where: { key: MODEL_SETTING_KEY },
    create: { key: MODEL_SETTING_KEY, value: model },
    update: { value: model },
  });
  await prisma.auditEvent.create({
    data: {
      entityType: 'SETTINGS',
      entityId: MODEL_SETTING_KEY,
      action: 'UPDATE',
      details: JSON.stringify({ model, source }),
    },
  });
}

/** List every model tag installed in the local Ollama instance. */
export async function listOllamaModels(): Promise<{
  reachable: boolean;
  baseUrl: string;
  models: OllamaModelInfo[];
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return { reachable: false, baseUrl: OLLAMA_BASE_URL, models: [], error: `Ollama returned status ${response.status}` };
    }

    const data = await readJson<{ models?: any[] }>(response);
    const models: OllamaModelInfo[] = (data.models || [])
      .map((m: any) => ({
        name: m.name as string,
        sizeBytes: Number(m.size) || 0,
        parameterSize: m.details?.parameter_size ?? null,
        modifiedAt: m.modified_at ?? null,
      }))
      .sort((a: OllamaModelInfo, b: OllamaModelInfo) => a.name.localeCompare(b.name));

    return { reachable: true, baseUrl: OLLAMA_BASE_URL, models };
  } catch {
    return {
      reachable: false,
      baseUrl: OLLAMA_BASE_URL,
      models: [],
      error: `Cannot connect to Ollama at ${OLLAMA_BASE_URL}. Is Ollama running?`,
    };
  }
}

/**
 * Check if Ollama is running and the active model is available
 */
export async function checkAIStatus(): Promise<AIStatus> {
  const model = await getActiveModel();
  const modelSource: 'settings' | 'env' = model === DEFAULT_OLLAMA_MODEL ? 'env' : 'settings';
  const base = {
    model,
    envModel: DEFAULT_OLLAMA_MODEL,
    modelSource,
    baseUrl: OLLAMA_BASE_URL,
    fallbackEngine: RULE_ENGINE_NAME,
  };

  const listing = await listOllamaModels();

  if (!listing.reachable) {
    return { ...base, available: false, availableModels: [], error: listing.error };
  }

  const models = listing.models.map((m) => m.name);
  const modelFound = models.some((name) => modelNameMatches(name, model));

  return {
    ...base,
    available: modelFound,
    availableModels: models,
    error: modelFound
      ? undefined
      : `Model "${model}" not found. Installed: ${models.join(', ') || 'none'}. Run: ollama pull ${model}`,
  };
}

/**
 * Extract transactions from messy text using local LLM
 */
export async function extractTransactionsFromText(
  rawText: string,
  referenceDate?: string
): Promise<{ success: boolean; data?: any; error?: string; modelUsed?: string; engine?: ExtractionEngine }> {
  const status = await checkAIStatus();
  if (!status.available) {
    return { success: false, error: status.error || 'AI model not available' };
  }
  const model = status.model;

  const refDate = referenceDate || dayjs().format('YYYY-MM-DD');
  const yesterday = dayjs(refDate).subtract(1, 'day').format('YYYY-MM-DD');

  // Sanitize input - strip potential injection patterns
  const sanitizedText = sanitizeInput(rawText);

  const prompt = `You are a ledger data extraction assistant. Extract financial transactions from the following text.

RULES:
- Extract only transaction data that is EXPLICITLY stated in the text
- Do NOT invent or assume amounts, dates, or names not present in the text
- "took goods", "udhaar", "credit", "kharcha" = CREDIT (customer owes money)
- "paid", "gave", "returned", "diya" = PAYMENT (customer paying back)
- Use today's date (${refDate}) for "today", yesterday (${yesterday}) for "yesterday"
- Convert amounts to paise (multiply by 100). E.g., 1200 rupees = 120000 paise
- Set needs_review to true if anything is ambiguous
- Include the original text snippet as evidence

Respond ONLY with valid JSON in this exact format:
{
  "transactions": [
    {
      "customer_name": "string",
      "type": "CREDIT" or "PAYMENT",
      "amount_paise": number,
      "date": "YYYY-MM-DD",
      "description": "string",
      "confidence": number between 0 and 1,
      "needs_review": boolean,
      "evidence": "original text snippet"
    }
  ],
  "warnings": ["string"]
}

TEXT TO EXTRACT FROM:
${sanitizedText}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: 'json',
        options: {
          temperature: 0.1,
          num_predict: 2048,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { success: false, error: `Ollama returned status ${response.status}` };
    }

    const result = await readJson<{ response?: string }>(response);
    const responseText = result.response || '';

    // Try to parse JSON from the response
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // Try to extract JSON from within the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          return { success: false, error: 'Model returned invalid JSON', modelUsed: model };
        }
      } else {
        return { success: false, error: 'Model did not return JSON', modelUsed: model };
      }
    }

    // Validate with Zod schema
    const validated = aiExtractionResultSchema.safeParse(parsed);
    if (!validated.success) {
      return {
        success: false,
        error: `Model output failed validation: ${validated.error.message}`,
        modelUsed: model,
      };
    }

    // Additional safety checks
    for (const tx of validated.data.transactions) {
      if (tx.amount_paise <= 0) {
        tx.needs_review = true;
      }
      if (!tx.date || isNaN(Date.parse(tx.date))) {
        tx.date = refDate;
        tx.needs_review = true;
      }
    }

    return { success: true, data: validated.data, modelUsed: model, engine: 'LLM' };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'AI request timed out' };
    }
    return { success: false, error: `AI error: ${err.message}` };
  }
}

/**
 * Generate a payment reminder using the local LLM
 */
export async function generateReminder(
  customerName: string,
  amountPaise: number,
  dueDate: string | null,
  type: 'WHATSAPP' | 'FORMAL',
  language: 'en' | 'hi' | 'od',
  businessName: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const status = await checkAIStatus();
  
  const amountRupees = (amountPaise / 100).toFixed(2);

  // If AI unavailable, use template-based reminders
  if (!status.available) {
    return {
      success: true,
      message: generateTemplateReminder(customerName, amountRupees, dueDate, type, language, businessName),
    };
  }

  const langMap = { en: 'English', hi: 'Hindi', od: 'Odia' };
  const typeDesc = type === 'WHATSAPP' ? 'short WhatsApp message' : 'formal reminder letter';

  const prompt = `Generate a polite, professional ${typeDesc} in ${langMap[language]} for a payment reminder.

Details:
- Customer name: ${customerName}
- Amount due: ₹${amountRupees}
- Due date: ${dueDate || 'not specified'}
- Business name: ${businessName}

Rules:
- Be polite and professional
- Include the exact amount
- Do not threaten or be aggressive
- Keep it concise for WhatsApp, more detailed for formal
- Do NOT include any other customer's information
- Respond with ONLY the message text, no JSON wrapping`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: status.model,
        prompt,
        stream: false,
        options: { temperature: 0.7, num_predict: 512 },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        success: true,
        message: generateTemplateReminder(customerName, amountRupees, dueDate, type, language, businessName),
      };
    }

    const result = await readJson<{ response?: string }>(response);
    const message = (result.response || '').trim();

    if (!message || message.length < 10) {
      return {
        success: true,
        message: generateTemplateReminder(customerName, amountRupees, dueDate, type, language, businessName),
      };
    }

    return { success: true, message };
  } catch {
    return {
      success: true,
      message: generateTemplateReminder(customerName, amountRupees, dueDate, type, language, businessName),
    };
  }
}

/**
 * Template-based reminder fallback when AI is not available
 */
function generateTemplateReminder(
  customerName: string,
  amountRupees: string,
  dueDate: string | null,
  type: 'WHATSAPP' | 'FORMAL',
  language: 'en' | 'hi' | 'od',
  businessName: string
): string {
  const dueDateStr = dueDate ? ` (due: ${dayjs(dueDate).format('DD MMM YYYY')})` : '';

  if (language === 'hi') {
    if (type === 'WHATSAPP') {
      return `🙏 नमस्ते ${customerName} जी,\n\nयह ${businessName} से एक विनम्र अनुस्मारक है। आपके खाते में ₹${amountRupees} बकाया है${dueDateStr}।\n\nकृपया जल्द से जल्द भुगतान करें। किसी भी प्रश्न के लिए संपर्क करें।\n\nधन्यवाद 🙏`;
    }
    return `प्रिय ${customerName} जी,\n\nसादर प्रणाम।\n\nयह पत्र ${businessName} की ओर से आपके बकाया भुगतान के संबंध में लिखा जा रहा है।\n\nआपके खाते में ₹${amountRupees} की राशि बकाया है${dueDateStr}।\n\nकृपया इस राशि का शीघ्र भुगतान करने का कष्ट करें। यदि आपने पहले ही भुगतान कर दिया है, तो कृपया इस संदेश को अनदेखा करें।\n\nकिसी भी प्रश्न के लिए हमसे संपर्क करें।\n\nधन्यवाद,\n${businessName}`;
  }

  if (language === 'od') {
    if (type === 'WHATSAPP') {
      return `🙏 ନମସ୍କାର ${customerName},\n\nଏହା ${businessName} ତରଫରୁ ଏକ ବିନମ୍ର ସ୍ମାରକ। ଆପଣଙ୍କ ଖାତାରେ ₹${amountRupees} ବକେୟା ଅଛି${dueDateStr}।\n\nଦୟାକରି ଶୀଘ୍ର ପେମେଣ୍ଟ କରନ୍ତୁ।\n\nଧନ୍ୟବାଦ 🙏`;
    }
    return `ପ୍ରିୟ ${customerName},\n\nସାଦର ନମସ୍କାର।\n\n${businessName} ତରଫରୁ ଆପଣଙ୍କ ବକେୟା ପେମେଣ୍ଟ ସମ୍ବନ୍ଧରେ ଏହି ପତ୍ର ଲେଖାଯାଉଛି।\n\nଆପଣଙ୍କ ଖାତାରେ ₹${amountRupees} ବକେୟା ଅଛି${dueDateStr}।\n\nଦୟାକରି ଶୀଘ୍ର ଏହି ରାଶି ପେମେଣ୍ଟ କରନ୍ତୁ।\n\nଧନ୍ୟବାଦ,\n${businessName}`;
  }

  // English (default)
  if (type === 'WHATSAPP') {
    return `🙏 Hi ${customerName},\n\nThis is a friendly reminder from ${businessName}. You have an outstanding balance of ₹${amountRupees}${dueDateStr}.\n\nPlease make the payment at your earliest convenience. Feel free to reach out if you have any questions.\n\nThank you! 🙏`;
  }

  return `Dear ${customerName},\n\nGreetings from ${businessName}.\n\nThis is to remind you about your outstanding payment of ₹${amountRupees}${dueDateStr}.\n\nWe kindly request you to settle this amount at your earliest convenience. If you have already made this payment, please disregard this reminder.\n\nFor any queries or concerns, please do not hesitate to contact us.\n\nThank you for your business.\n\nWarm regards,\n${businessName}`;
}

/**
 * Sanitize user input to prevent prompt injection
 */
function sanitizeInput(text: string): string {
  // Limit length
  const maxLength = 5000;
  let sanitized = text.slice(0, maxLength);

  // Remove common prompt injection patterns
  sanitized = sanitized
    .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, '[removed]')
    .replace(/system\s*prompt/gi, '[removed]')
    .replace(/you\s+are\s+now/gi, '[removed]')
    .replace(/forget\s+(everything|all)/gi, '[removed]')
    .replace(/new\s+instructions?:/gi, '[removed]')
    .replace(/override/gi, '[removed]')
    .replace(/<\/?script>/gi, '[removed]')
    .replace(/```/g, '');

  return sanitized;
}

/**
 * Generate AI insights for the dashboard based on actual data
 */
export async function generateDashboardInsights(stats: {
  totalOutstandingPaise: number;
  totalOverduePaise: number;
  overdueAccounts: number;
  customersWithBalance: number;
  collectedThisMonthPaise: number;
  creditExtendedThisMonthPaise: number;
}): Promise<string[]> {
  const insights: string[] = [];

  if (stats.overdueAccounts > 0) {
    const amount = (stats.totalOverduePaise / 100).toLocaleString('en-IN');
    insights.push(
      `${stats.overdueAccounts} customer${stats.overdueAccounts > 1 ? 's have' : ' has'} overdue balance${stats.overdueAccounts > 1 ? 's' : ''}. Combined overdue amount: ₹${amount}.`
    );
  }

  if (stats.collectedThisMonthPaise > 0) {
    const collected = (stats.collectedThisMonthPaise / 100).toLocaleString('en-IN');
    insights.push(`₹${collected} collected this month.`);
  }

  if (stats.creditExtendedThisMonthPaise > stats.collectedThisMonthPaise) {
    const diff = ((stats.creditExtendedThisMonthPaise - stats.collectedThisMonthPaise) / 100).toLocaleString('en-IN');
    insights.push(
      `Credit extended exceeds collections this month by ₹${diff}. Consider following up on outstanding balances.`
    );
  }

  if (stats.customersWithBalance === 0 && stats.totalOutstandingPaise === 0) {
    insights.push('All accounts are settled. No outstanding balances.');
  }

  return insights;
}
