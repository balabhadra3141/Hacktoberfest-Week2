import { z } from 'zod';

// ============= Transaction Types =============
export const TransactionType = {
  CREDIT: 'CREDIT',
  PAYMENT: 'PAYMENT',
  ADJUSTMENT: 'ADJUSTMENT',
  REVERSAL: 'REVERSAL',
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const TransactionSource = {
  MANUAL: 'MANUAL',
  IMPORTED: 'IMPORTED',
  AI_ASSISTED: 'AI_ASSISTED',
} as const;

export const TransactionStatus = {
  POSTED: 'POSTED',
  REVERSED: 'REVERSED',
} as const;

// ============= Zod Schemas =============

// Customer schemas
export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  creditLimitPaise: z.number().int().min(0).optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Transaction schemas
export const createTransactionSchema = z.object({
  customerId: z.string().uuid(),
  type: z.enum(['CREDIT', 'PAYMENT', 'ADJUSTMENT', 'REVERSAL']),
  amountPaise: z.number().int().positive('Amount must be positive'),
  date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
  description: z.string().min(1, 'Description is required').max(500),
  referenceNumber: z.string().max(100).optional().nullable(),
  dueDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date').optional().nullable(),
  adjustmentReason: z.string().max(500).optional().nullable(),
  originalTransactionId: z.string().uuid().optional().nullable(),
  source: z.enum(['MANUAL', 'IMPORTED', 'AI_ASSISTED']).default('MANUAL'),
}).refine(
  (data) => {
    if (data.type === 'ADJUSTMENT' && !data.adjustmentReason) {
      return false;
    }
    return true;
  },
  { message: 'Adjustment reason is required for ADJUSTMENT type', path: ['adjustmentReason'] }
).refine(
  (data) => {
    if (data.type === 'REVERSAL' && !data.originalTransactionId) {
      return false;
    }
    return true;
  },
  { message: 'Original transaction ID is required for REVERSAL type', path: ['originalTransactionId'] }
);

// Reversal schema
export const createReversalSchema = z.object({
  originalTransactionId: z.string().uuid(),
  reason: z.string().min(1, 'Reversal reason is required').max(500),
});

// Import schemas
export const aiExtractionResultSchema = z.object({
  transactions: z.array(z.object({
    customer_name: z.string().min(1),
    type: z.enum(['CREDIT', 'PAYMENT']),
    amount_paise: z.number().int().positive(),
    date: z.string(),
    description: z.string(),
    confidence: z.number().min(0).max(1).optional().default(0.5),
    needs_review: z.boolean().optional().default(true),
    evidence: z.string().optional(),
  })),
  warnings: z.array(z.string()).optional().default([]),
});

export const importCandidateUpdateSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  type: z.enum(['CREDIT', 'PAYMENT']),
  amountPaise: z.number().int().positive(),
  date: z.string(),
  description: z.string().min(1).max(500),
  status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED']),
});

export const confirmImportSchema = z.object({
  candidateIds: z.array(z.string().uuid()).min(1),
});

// Reminder schema
export const generateReminderSchema = z.object({
  customerId: z.string().uuid(),
  type: z.enum(['WHATSAPP', 'FORMAL']).default('WHATSAPP'),
  language: z.enum(['en', 'hi', 'od']).default('en'),
});

// Settings schemas
export const updateBusinessProfileSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  currency: z.string().max(10).optional(),
  currencySymbol: z.string().max(5).optional(),
  defaultDueDays: z.number().int().min(1).max(365).optional(),
  defaultCreditLimitPaise: z.number().int().min(0).optional().nullable(),
});

// Local AI model selection (Ollama tag, e.g. "llama3", "qwen2.5:3b")
export const setAIModelSchema = z.object({
  model: z
    .string()
    .min(1, 'Model name is required')
    .max(200)
    .regex(/^[A-Za-z0-9._:\/-]+$/, 'Invalid model name'),
});

// Query schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const searchSchema = z.object({
  query: z.string().optional(),
  status: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Dashboard types
export interface DashboardStats {
  totalOutstandingPaise: number;
  totalOverduePaise: number;
  collectedThisMonthPaise: number;
  creditExtendedThisMonthPaise: number;
  customersWithBalance: number;
  overdueAccounts: number;
}

// Helper to format paise to INR display
export function formatPaiseToINR(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(rupees);
}
