export type TransactionType = 'CREDIT' | 'PAYMENT' | 'ADJUSTMENT' | 'REVERSAL';
export type TransactionStatus = 'POSTED' | 'REVERSED';
export type TransactionSource = 'MANUAL' | 'IMPORTED' | 'AI_ASSISTED';

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  creditLimitPaise?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Computed fields
  balancePaise?: number;
  totalCreditPaise?: number;
  totalPaymentPaise?: number;
  transactionCount?: number;
  lastTransactionDate?: string | null;
  isOverdue?: boolean;
  overdueAmountPaise?: number;
  riskScore?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface LedgerTransaction {
  id: string;
  customerId: string;
  type: TransactionType;
  amountPaise: number;
  date: string;
  description: string;
  referenceNumber?: string | null;
  dueDate?: string | null;
  status: TransactionStatus;
  source: TransactionSource;
  adjustmentReason?: string | null;
  originalTransactionId?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: Customer;
}

export interface DashboardStats {
  totalOutstandingPaise: number;
  totalOverduePaise: number;
  collectedThisMonthPaise: number;
  creditExtendedThisMonthPaise: number;
  customersWithBalance: number;
  overdueAccounts: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentTransactions: LedgerTransaction[];
  followUpCustomers: Customer[];
  trend: { date: string; outstandingPaise: number }[];
  insights: string[];
}

export interface ImportCandidate {
  id: string;
  batchId: string;
  rawText: string;
  suggestedCustomerName: string;
  matchedCustomerId?: string | null;
  matchedCustomer?: Customer | null;
  type: 'CREDIT' | 'PAYMENT';
  amountPaise: number;
  date: string;
  description: string;
  confidence: number;
  needsReview: boolean;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

export interface ImportBatch {
  id: string;
  sourceType: string;
  rawInput?: string;
  totalCandidates: number;
  acceptedCount: number;
  rejectedCount: number;
  createdAt: string;
  candidates?: ImportCandidate[];
}

export interface BusinessProfile {
  name: string;
  phone?: string | null;
  address?: string | null;
  currency: string;
  currencySymbol: string;
  defaultDueDays: number;
  defaultCreditLimitPaise?: number | null;
  upiId?: string | null;
}

export interface AIStatus {
  available: boolean;
  provider: string;
  model: string;
  baseUrl: string;
  latencyMs?: number;
}
