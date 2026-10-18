import { Router, Request, Response } from 'express';
import prisma from '../db';
import { createTransactionSchema, createReversalSchema, paginationSchema, dateRangeSchema, TransactionType, TransactionStatus } from '../schemas';
import { calculateCustomerBalance } from '../services/ledger.service';
import dayjs from 'dayjs';

const router = Router();

// GET /api/transactions - List transactions with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const pagination = paginationSchema.parse(req.query);
    const dateRange = dateRangeSchema.parse(req.query);
    const customerId = req.query.customerId as string | undefined;
    const type = req.query.type as string | undefined;

    const where: any = { status: TransactionStatus.POSTED };
    
    if (customerId) where.customerId = customerId;
    if (type) where.type = type;
    if (dateRange.startDate || dateRange.endDate) {
      where.date = {};
      if (dateRange.startDate) where.date.gte = new Date(dateRange.startDate);
      if (dateRange.endDate) where.date.lte = new Date(dateRange.endDate + 'T23:59:59.999Z');
    }

    const [items, total] = await Promise.all([
      prisma.ledgerTransaction.findMany({
        where,
        include: { customer: { select: { id: true, name: true } } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      prisma.ledgerTransaction.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/transactions/customer/:customerId - Customer transaction history with running balance
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const pagination = paginationSchema.parse(req.query);
    const dateRange = dateRangeSchema.parse(req.query);
    const customerId = req.params.customerId;

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const where: any = { customerId, status: TransactionStatus.POSTED };
    if (dateRange.startDate || dateRange.endDate) {
      where.date = {};
      if (dateRange.startDate) where.date.gte = new Date(dateRange.startDate);
      if (dateRange.endDate) where.date.lte = new Date(dateRange.endDate + 'T23:59:59.999Z');
    }

    // Get ALL posted transactions for running balance calculation
    const allTransactions = await prisma.ledgerTransaction.findMany({
      where: { customerId, status: TransactionStatus.POSTED },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    // Compute running balances
    let runningBalance = 0;
    const withRunningBalance = allTransactions.map((tx) => {
      if (tx.type === TransactionType.CREDIT || tx.type === TransactionType.ADJUSTMENT) {
        runningBalance += tx.amountPaise;
      } else {
        runningBalance -= tx.amountPaise;
      }
      return { ...tx, runningBalancePaise: runningBalance };
    });

    // Reverse for display (newest first) and paginate
    const reversed = withRunningBalance.reverse();
    const total = reversed.length;
    const start = (pagination.page - 1) * pagination.limit;
    const paginatedItems = reversed.slice(start, start + pagination.limit);

    res.json({
      success: true,
      data: {
        items: paginatedItems,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
        currentBalancePaise: runningBalance,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/transactions - Create a transaction
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createTransactionSchema.parse(req.body);

    // Verify customer exists
    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    if (!customer.isActive) {
      return res.status(400).json({ success: false, error: 'Cannot add transactions to archived customers' });
    }

    // Calculate current balance
    const currentBalance = await calculateCustomerBalance(data.customerId);

    // Check credit limit for CREDIT transactions
    if (data.type === TransactionType.CREDIT && customer.creditLimitPaise) {
      const newBalance = currentBalance + data.amountPaise;
      if (newBalance > customer.creditLimitPaise) {
        return res.status(400).json({
          success: false,
          error: `This transaction would exceed the credit limit. Current balance: ₹${(currentBalance / 100).toFixed(2)}, Credit limit: ₹${(customer.creditLimitPaise / 100).toFixed(2)}`,
          data: { currentBalancePaise: currentBalance, creditLimitPaise: customer.creditLimitPaise },
        });
      }
    }

    // Prevent overpayment warnings (but allow it)
    let warnings: string[] = [];
    if (data.type === TransactionType.PAYMENT && data.amountPaise > currentBalance && currentBalance > 0) {
      warnings.push(`Payment of ₹${(data.amountPaise / 100).toFixed(2)} exceeds outstanding balance of ₹${(currentBalance / 100).toFixed(2)}. This will create an advance/credit balance.`);
    }

    // For reversals, verify the original transaction
    if (data.type === TransactionType.REVERSAL && data.originalTransactionId) {
      const original = await prisma.ledgerTransaction.findUnique({
        where: { id: data.originalTransactionId },
      });
      if (!original) {
        return res.status(404).json({ success: false, error: 'Original transaction not found' });
      }
      if (original.status === TransactionStatus.REVERSED) {
        return res.status(400).json({ success: false, error: 'Transaction has already been reversed' });
      }
      if (original.customerId !== data.customerId) {
        return res.status(400).json({ success: false, error: 'Original transaction belongs to a different customer' });
      }
    }

    // Create transaction with audit trail
    const transaction = await prisma.$transaction(async (tx) => {
      const newTx = await tx.ledgerTransaction.create({
        data: {
          customerId: data.customerId,
          type: data.type,
          amountPaise: data.amountPaise,
          date: new Date(data.date),
          description: data.description,
          referenceNumber: data.referenceNumber,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          source: data.source,
          adjustmentReason: data.adjustmentReason,
          originalTransactionId: data.originalTransactionId,
        },
      });

      // If this is a reversal, mark the original as reversed
      if (data.type === TransactionType.REVERSAL && data.originalTransactionId) {
        await tx.ledgerTransaction.update({
          where: { id: data.originalTransactionId },
          data: {
            status: TransactionStatus.REVERSED,
            reversalReason: data.adjustmentReason || 'Reversed',
          },
        });
      }

      // Audit event
      await tx.auditEvent.create({
        data: {
          entityType: 'TRANSACTION',
          entityId: newTx.id,
          action: 'CREATE',
          details: JSON.stringify({
            type: data.type,
            amountPaise: data.amountPaise,
            customerId: data.customerId,
          }),
        },
      });

      return newTx;
    });

    // Calculate new balance
    const newBalance = await calculateCustomerBalance(data.customerId);

    res.status(201).json({
      success: true,
      data: {
        transaction,
        newBalancePaise: newBalance,
        previousBalancePaise: currentBalance,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: error.errors });
    }
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/transactions/:id/reverse - Reverse a transaction
router.post('/:id/reverse', async (req: Request, res: Response) => {
  try {
    const { reason } = createReversalSchema.parse({
      originalTransactionId: req.params.id,
      reason: req.body.reason,
    });

    const original = await prisma.ledgerTransaction.findUnique({
      where: { id: req.params.id },
    });

    if (!original) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }
    if (original.status === TransactionStatus.REVERSED) {
      return res.status(400).json({ success: false, error: 'Transaction already reversed' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Mark original as reversed
      await tx.ledgerTransaction.update({
        where: { id: original.id },
        data: { status: TransactionStatus.REVERSED, reversalReason: reason },
      });

      // Create reversal entry
      const reversal = await tx.ledgerTransaction.create({
        data: {
          customerId: original.customerId,
          type: TransactionType.REVERSAL,
          amountPaise: original.amountPaise,
          date: new Date(),
          description: `Reversal: ${original.description} — Reason: ${reason}`,
          originalTransactionId: original.id,
          source: 'MANUAL',
        },
      });

      // Audit
      await tx.auditEvent.create({
        data: {
          entityType: 'TRANSACTION',
          entityId: original.id,
          action: 'REVERSE',
          details: JSON.stringify({ reason, reversalId: reversal.id }),
        },
      });

      return reversal;
    });

    const newBalance = await calculateCustomerBalance(original.customerId);

    res.json({
      success: true,
      data: { reversal: result, newBalancePaise: newBalance },
      message: 'Transaction reversed successfully',
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
