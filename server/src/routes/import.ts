import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../db';
import { importCandidateUpdateSchema, confirmImportSchema, TransactionStatus } from '../schemas';
import { extractTransactionsFromText } from '../services/ai.service';
import { parseTransactionsWithRules, RULE_ENGINE_NAME } from '../services/rule-parser.service';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_UPLOAD_SIZE = (parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10') * 1024 * 1024);

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'text/csv', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

const router = Router();

type ExtractionEngine = 'LLM' | 'RULES';

interface ExtractedTransaction {
  customer_name: string;
  type: 'CREDIT' | 'PAYMENT';
  amount_paise: number;
  date: string;
  description: string;
  confidence?: number;
  needs_review?: boolean;
  evidence?: string;
}

interface ExtractionOutcome {
  engine: ExtractionEngine;
  transactions: ExtractedTransaction[];
  warnings: string[];
  modelUsed?: string;
  aiError?: string;
}

/**
 * Dual-path extraction: local Ollama LLM first, and if it is unreachable
 * (or returns something unusable) fall back to the deterministic offline
 * rule parser so the merchant still gets reviewable entries.
 */
async function runExtraction(rawText: string, referenceDate?: string): Promise<ExtractionOutcome> {
  const aiResult = await extractTransactionsFromText(rawText, referenceDate);

  if (aiResult.success && aiResult.data) {
    return {
      engine: 'LLM',
      transactions: aiResult.data.transactions as ExtractedTransaction[],
      warnings: aiResult.data.warnings || [],
      modelUsed: aiResult.modelUsed,
    };
  }

  const ruleResult = parseTransactionsWithRules(rawText, referenceDate);
  return {
    engine: 'RULES',
    transactions: ruleResult.data.transactions,
    warnings: [
      ...(aiResult.error ? [`Local AI unavailable — ${aiResult.error}`] : []),
      ...ruleResult.data.warnings,
    ],
    modelUsed: RULE_ENGINE_NAME,
    aiError: aiResult.error,
  };
}

/**
 * Turn extracted transactions into reviewable ImportCandidate rows, matching
 * names against the existing khata and flagging duplicates.
 */
async function createCandidates(batchId: string, transactions: ExtractedTransaction[]) {
  const existingCustomers = await prisma.customer.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  const candidates = [];

  for (const tx of transactions) {
    const name = (tx.customer_name || '').trim();
    const matchedCustomer = existingCustomers.find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );

    const fuzzyMatch = !matchedCustomer && name
      ? existingCustomers.find(
          (c) =>
            c.name.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(c.name.toLowerCase())
        )
      : null;

    // Check for potential duplicates
    let duplicateOf: string | null = null;
    if (matchedCustomer && tx.amount_paise > 0) {
      const txDate = new Date(tx.date);
      if (!isNaN(txDate.getTime())) {
        const existingTx = await prisma.ledgerTransaction.findFirst({
          where: {
            customerId: matchedCustomer.id,
            amountPaise: tx.amount_paise,
            type: tx.type,
            date: txDate,
            status: TransactionStatus.POSTED,
          },
        });
        if (existingTx) duplicateOf = existingTx.id;
      }
    }

    const dateValid = !isNaN(new Date(tx.date).getTime());

    const candidate = await prisma.importCandidate.create({
      data: {
        importBatchId: batchId,
        customerName: name,
        customerId: matchedCustomer?.id || null,
        type: tx.type,
        amountPaise: tx.amount_paise,
        date: dateValid ? new Date(tx.date) : new Date(),
        description: tx.description || 'Imported entry',
        confidence: tx.confidence ?? 0.5,
        needsReview: tx.needs_review || !matchedCustomer,
        evidence: tx.evidence || null,
        status: 'PENDING',
        duplicateOf,
        validationErrors: !matchedCustomer && fuzzyMatch
          ? JSON.stringify([`Customer "${name}" not found. Did you mean "${fuzzyMatch.name}"?`])
          : !matchedCustomer
          ? JSON.stringify([`Customer "${name}" not found in the system.`])
          : duplicateOf
          ? JSON.stringify([`Possible duplicate of existing transaction.`])
          : null,
      },
    });

    candidates.push({
      ...candidate,
      matchedCustomerName: matchedCustomer?.name || fuzzyMatch?.name || null,
      fuzzyMatchId: fuzzyMatch?.id || null,
      matchedCustomer: matchedCustomer ? { id: matchedCustomer.id, name: matchedCustomer.name } : null,
      suggestedCustomerName: matchedCustomer?.name || fuzzyMatch?.name || name,
    });
  }

  return candidates;
}

// POST /api/import/text - Import from pasted text
router.post('/text', async (req: Request, res: Response) => {
  try {
    const { text, referenceDate } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }

    if (text.length > 5000) {
      return res.status(400).json({ success: false, error: 'Text too long (max 5000 characters)' });
    }

    // Create import batch
    const batch = await prisma.importBatch.create({
      data: {
        source: 'TEXT',
        rawInput: text.slice(0, 5000),
        status: 'PENDING',
      },
    });

    const extraction = await runExtraction(text, referenceDate);

    if (extraction.transactions.length === 0) {
      await prisma.importBatch.update({
        where: { id: batch.id },
        data: { status: 'FAILED', modelUsed: extraction.modelUsed },
      });

      return res.json({
        success: true,
        data: {
          batchId: batch.id,
          aiAvailable: false,
          engine: extraction.engine,
          aiError: extraction.aiError,
          candidates: [],
          warnings: [
            ...extraction.warnings,
            'You can manually enter transactions instead.',
          ],
        },
      });
    }

    const candidates = await createCandidates(batch.id, extraction.transactions);

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: 'REVIEWING',
        modelUsed: extraction.modelUsed,
        totalCandidates: candidates.length,
      },
    });

    res.json({
      success: true,
      data: {
        batchId: batch.id,
        aiAvailable: extraction.engine === 'LLM',
        engine: extraction.engine,
        modelUsed: extraction.modelUsed,
        candidates,
        warnings: extraction.warnings,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/import/image - Import from image (OCR + AI)
router.post('/image', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image uploaded' });
    }

    // OCR with Tesseract.js
    let ocrText = '';
    try {
      const Tesseract = await import('tesseract.js');
      const worker = await Tesseract.createWorker('eng+hin');
      const { data } = await worker.recognize(req.file.path);
      ocrText = data.text;
      await worker.terminate();
    } catch (ocrError: any) {
      // Clean up file
      fs.unlink(req.file.path, () => {});
      return res.json({
        success: true,
        data: {
          aiAvailable: false,
          engine: null,
          ocrText: '',
          aiError: `OCR failed: ${ocrError.message}`,
          candidates: [],
          warnings: ['OCR processing failed. Try pasting the text manually.'],
        },
      });
    }

    // Clean up uploaded file
    fs.unlink(req.file.path, () => {});

    if (!ocrText.trim()) {
      return res.json({
        success: true,
        data: {
          aiAvailable: false,
          engine: null,
          ocrText: '',
          candidates: [],
          warnings: ['No text could be extracted from the image. Try a clearer image or paste text manually.'],
        },
      });
    }

    // Create batch
    const batch = await prisma.importBatch.create({
      data: {
        source: 'IMAGE',
        ocrText,
        status: 'PENDING',
      },
    });

    const extraction = await runExtraction(ocrText, req.body.referenceDate);

    if (extraction.transactions.length === 0) {
      await prisma.importBatch.update({
        where: { id: batch.id },
        data: { status: 'REVIEWING', modelUsed: extraction.modelUsed },
      });

      return res.json({
        success: true,
        data: {
          batchId: batch.id,
          aiAvailable: false,
          engine: extraction.engine,
          ocrText,
          aiError: extraction.aiError,
          candidates: [],
          warnings: [...extraction.warnings, 'OCR text is available for manual review.'],
        },
      });
    }

    const candidates = await createCandidates(batch.id, extraction.transactions);

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { status: 'REVIEWING', modelUsed: extraction.modelUsed, totalCandidates: candidates.length },
    });

    res.json({
      success: true,
      data: {
        batchId: batch.id,
        aiAvailable: extraction.engine === 'LLM',
        engine: extraction.engine,
        ocrText,
        modelUsed: extraction.modelUsed,
        candidates,
        warnings: extraction.warnings,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/import/candidates/:id - Update a candidate 
router.put('/candidates/:id', async (req: Request, res: Response) => {
  try {
    const data = importCandidateUpdateSchema.parse(req.body);
    
    const candidate = await prisma.importCandidate.findUnique({
      where: { id: req.params.id },
    });

    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }

    const updated = await prisma.importCandidate.update({
      where: { id: req.params.id },
      data: {
        customerId: data.customerId,
        type: data.type,
        amountPaise: data.amountPaise,
        date: new Date(data.date),
        description: data.description,
        status: data.status,
        needsReview: data.status === 'PENDING',
      },
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/import/confirm - Confirm and import accepted candidates
router.post('/confirm', async (req: Request, res: Response) => {
  try {
    const { candidateIds } = confirmImportSchema.parse(req.body);

    const candidates = await prisma.importCandidate.findMany({
      where: { 
        id: { in: candidateIds },
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
    });

    if (candidates.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No pending or accepted candidates found to confirm.' 
      });
    }

    // Import in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const transactions = [];
      const batchIds = new Set<string>();

      for (const candidate of candidates) {
        let finalCustomerId = candidate.customerId;

        // If candidate doesn't have a customerId, find or create one
        if (!finalCustomerId) {
          const rawName = (candidate.customerName || 'Customer').trim();
          let existingCust = await tx.customer.findFirst({
            where: {
              name: { equals: rawName },
            },
          });

          if (!existingCust) {
            existingCust = await tx.customer.create({
              data: {
                name: rawName,
                isActive: true,
              },
            });
          }
          finalCustomerId = existingCust.id;
        }

        const transaction = await tx.ledgerTransaction.create({
          data: {
            customerId: finalCustomerId,
            type: candidate.type,
            amountPaise: candidate.amountPaise,
            date: candidate.date,
            description: candidate.description,
            source: 'AI_ASSISTED',
            importBatchId: candidate.importBatchId,
          },
        });

        await tx.importCandidate.update({
          where: { id: candidate.id },
          data: { 
            status: 'IMPORTED',
            customerId: finalCustomerId,
          },
        });

        await tx.auditEvent.create({
          data: {
            entityType: 'TRANSACTION',
            entityId: transaction.id,
            action: 'IMPORT',
            details: JSON.stringify({
              candidateId: candidate.id,
              batchId: candidate.importBatchId,
            }),
          },
        });

        transactions.push(transaction);
        batchIds.add(candidate.importBatchId);
      }

      // Update batch counts
      for (const batchId of batchIds) {
        const importedCount = await tx.importCandidate.count({
          where: { importBatchId: batchId, status: 'IMPORTED' },
        });
        const rejectedCount = await tx.importCandidate.count({
          where: { importBatchId: batchId, status: 'REJECTED' },
        });
        const pendingCount = await tx.importCandidate.count({
          where: { importBatchId: batchId, status: { in: ['PENDING', 'ACCEPTED'] } },
        });

        await tx.importBatch.update({
          where: { id: batchId },
          data: {
            importedCount,
            rejectedCount,
            status: pendingCount === 0 ? 'COMPLETED' : 'REVIEWING',
          },
        });
      }

      return transactions;
    });

    res.json({
      success: true,
      data: {
        importedCount: result.length,
        confirmedCount: result.length,
        transactions: result,
      },
      message: `Successfully imported ${result.length} transaction(s)`,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/import/batches - List import batches
router.get('/batches', async (_req: Request, res: Response) => {
  try {
    const batches = await prisma.importBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { _count: { select: { candidates: true, transactions: true } } },
    });

    res.json({ success: true, data: batches });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/import/batches/:id - Get batch with candidates
router.get('/batches/:id', async (req: Request, res: Response) => {
  try {
    const batch = await prisma.importBatch.findUnique({
      where: { id: req.params.id },
      include: {
        candidates: {
          include: { customer: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }

    res.json({ success: true, data: batch });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
