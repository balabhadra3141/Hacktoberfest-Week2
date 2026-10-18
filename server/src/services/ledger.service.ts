import prisma from '../db';
import { TransactionType, TransactionStatus, DashboardStats } from '../schemas';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Kolkata';

/**
 * Calculate a customer's outstanding balance from ledger transactions.
 * Balance = SUM(CREDIT) - SUM(PAYMENT) + SUM(ADJUSTMENT where type logic applies)
 * Only POSTED transactions count.
 */
export async function calculateCustomerBalance(customerId: string): Promise<number> {
  const transactions = await prisma.ledgerTransaction.findMany({
    where: {
      customerId,
      status: TransactionStatus.POSTED,
    },
    select: {
      type: true,
      amountPaise: true,
    },
  });

  return computeBalanceFromTransactions(transactions);
}

export function computeBalanceFromTransactions(
  transactions: { type: string; amountPaise: number }[]
): number {
  let balance = 0;
  for (const tx of transactions) {
    switch (tx.type) {
      case TransactionType.CREDIT:
        balance += tx.amountPaise;
        break;
      case TransactionType.PAYMENT:
        balance -= tx.amountPaise;
        break;
      case TransactionType.ADJUSTMENT:
        // Adjustments can be positive (increase debt) or negative (decrease debt)
        // But amountPaise is always positive, direction is set by the fact that
        // ADJUSTMENT adds to balance (like a correction upward).
        // For downward adjustment, use PAYMENT type or negative adjustment
        // We treat ADJUSTMENT as increasing balance (adding to what's owed)
        balance += tx.amountPaise;
        break;
      case TransactionType.REVERSAL:
        // Reversals reduce what was originally added
        balance -= tx.amountPaise;
        break;
    }
  }
  return balance;
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const now = dayjs().tz(TZ);
  const monthStart = now.startOf('month').toDate();
  const monthEnd = now.endOf('month').toDate();
  const today = now.startOf('day').toDate();

  // Get all posted transactions
  const allTransactions = await prisma.ledgerTransaction.findMany({
    where: { status: TransactionStatus.POSTED },
    select: {
      customerId: true,
      type: true,
      amountPaise: true,
      date: true,
      dueDate: true,
    },
  });

  // Calculate per-customer balances
  const customerBalances = new Map<string, number>();
  const customerOverdue = new Map<string, number>();

  for (const tx of allTransactions) {
    const current = customerBalances.get(tx.customerId) || 0;
    let delta = 0;
    switch (tx.type) {
      case TransactionType.CREDIT:
        delta = tx.amountPaise;
        break;
      case TransactionType.PAYMENT:
        delta = -tx.amountPaise;
        break;
      case TransactionType.ADJUSTMENT:
        delta = tx.amountPaise;
        break;
      case TransactionType.REVERSAL:
        delta = -tx.amountPaise;
        break;
    }
    customerBalances.set(tx.customerId, current + delta);

    // Track overdue credits
    if (tx.type === TransactionType.CREDIT && tx.dueDate && new Date(tx.dueDate) < today) {
      const currentOverdue = customerOverdue.get(tx.customerId) || 0;
      customerOverdue.set(tx.customerId, currentOverdue + tx.amountPaise);
    }
  }

  // Total outstanding
  let totalOutstandingPaise = 0;
  let customersWithBalance = 0;
  for (const [, balance] of customerBalances) {
    if (balance > 0) {
      totalOutstandingPaise += balance;
      customersWithBalance++;
    }
  }

  // Calculate overdue properly - for each customer, overdue is min(their credit overdue sum, their outstanding)
  let totalOverduePaise = 0;
  let overdueAccounts = 0;
  
  // Get overdue credit transactions 
  const overdueCredits = allTransactions.filter(
    tx => tx.type === TransactionType.CREDIT && 
          tx.dueDate && 
          new Date(tx.dueDate) < today
  );
  
  // Group overdue by customer
  const overdueByCustomer = new Map<string, number>();
  for (const tx of overdueCredits) {
    const current = overdueByCustomer.get(tx.customerId) || 0;
    overdueByCustomer.set(tx.customerId, current + tx.amountPaise);
  }
  
  for (const [custId, overdueAmount] of overdueByCustomer) {
    const custBalance = customerBalances.get(custId) || 0;
    if (custBalance > 0) {
      // Overdue is the lesser of overdue credits and actual outstanding
      totalOverduePaise += Math.min(overdueAmount, custBalance);
      overdueAccounts++;
    }
  }

  // This month's collections (payments)
  const thisMonthPayments = allTransactions.filter(
    tx => tx.type === TransactionType.PAYMENT && 
          new Date(tx.date) >= monthStart && 
          new Date(tx.date) <= monthEnd
  );
  const collectedThisMonthPaise = thisMonthPayments.reduce((sum, tx) => sum + tx.amountPaise, 0);

  // This month's credit extended
  const thisMonthCredits = allTransactions.filter(
    tx => tx.type === TransactionType.CREDIT && 
          new Date(tx.date) >= monthStart && 
          new Date(tx.date) <= monthEnd
  );
  const creditExtendedThisMonthPaise = thisMonthCredits.reduce((sum, tx) => sum + tx.amountPaise, 0);

  return {
    totalOutstandingPaise,
    totalOverduePaise,
    collectedThisMonthPaise,
    creditExtendedThisMonthPaise,
    customersWithBalance,
    overdueAccounts,
  };
}

/**
 * Get recent transactions
 */
export async function getRecentTransactions(limit = 10) {
  return prisma.ledgerTransaction.findMany({
    where: { status: TransactionStatus.POSTED },
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { date: 'desc' },
    take: limit,
  });
}

/**
 * Get customers requiring follow-up (overdue balances)
 */
export async function getCustomersNeedingFollowUp() {
  const today = dayjs().tz(TZ).startOf('day').toDate();

  // Get customers with overdue credit transactions
  const overdueTransactions = await prisma.ledgerTransaction.findMany({
    where: {
      type: TransactionType.CREDIT,
      status: TransactionStatus.POSTED,
      dueDate: { lt: today },
    },
    include: { customer: { select: { id: true, name: true, phone: true } } },
  });

  // Group by customer and calculate
  const customerMap = new Map<string, { 
    id: string; name: string; phone: string | null; 
    balancePaise: number; overdueAmountPaise: number; oldestDueDate: Date;
  }>();

  for (const tx of overdueTransactions) {
    const existing = customerMap.get(tx.customerId);
    if (existing) {
      existing.overdueAmountPaise += tx.amountPaise;
      existing.balancePaise += tx.amountPaise;
      if (tx.dueDate && tx.dueDate < existing.oldestDueDate) {
        existing.oldestDueDate = tx.dueDate;
      }
    } else {
      customerMap.set(tx.customerId, {
        id: tx.customer.id,
        name: tx.customer.name,
        phone: tx.customer.phone,
        balancePaise: tx.amountPaise,
        overdueAmountPaise: tx.amountPaise,
        oldestDueDate: tx.dueDate || today,
      });
    }
  }

  return Array.from(customerMap.values()).sort(
    (a, b) => b.overdueAmountPaise - a.overdueAmountPaise
  );
}

/**
 * Get outstanding trend data for charts
 */
export async function getOutstandingTrend(days = 30) {
  const now = dayjs().tz(TZ);
  const startDate = now.subtract(days, 'day').startOf('day');
  
  const transactions = await prisma.ledgerTransaction.findMany({
    where: {
      status: TransactionStatus.POSTED,
      date: { lte: now.toDate() },
    },
    select: { type: true, amountPaise: true, date: true },
    orderBy: { date: 'asc' },
  });

  // Build daily snapshots
  const trend: { date: string; outstandingPaise: number; collectionsPaise: number }[] = [];
  
  for (let i = 0; i <= days; i++) {
    const day = startDate.add(i, 'day');
    const dayEnd = day.endOf('day').toDate();
    
    // Calculate balance up to this day
    const txUpToDay = transactions.filter(tx => new Date(tx.date) <= dayEnd);
    const balance = computeBalanceFromTransactions(txUpToDay);
    
    // Collections on this day
    const dayStart = day.startOf('day').toDate();
    const dayCollections = transactions
      .filter(tx => tx.type === TransactionType.PAYMENT && 
                    new Date(tx.date) >= dayStart && 
                    new Date(tx.date) <= dayEnd)
      .reduce((sum, tx) => sum + tx.amountPaise, 0);

    trend.push({
      date: day.format('YYYY-MM-DD'),
      outstandingPaise: Math.max(0, balance),
      collectionsPaise: dayCollections,
    });
  }

  return trend;
}
