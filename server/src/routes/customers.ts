import { Router, Request, Response } from 'express';
import prisma from '../db';
import { createCustomerSchema, updateCustomerSchema, paginationSchema, searchSchema } from '../schemas';
import { calculateCustomerBalance } from '../services/ledger.service';

const router = Router();

// GET /api/customers - List all customers with pagination and search
router.get('/', async (req: Request, res: Response) => {
  try {
    const pagination = paginationSchema.parse(req.query);
    const search = searchSchema.parse(req.query);
    const showArchived = req.query.showArchived === 'true';

    const where: any = {};
    if (!showArchived) {
      where.isActive = true;
    }
    if (search.query) {
      where.OR = [
        { name: { contains: search.query } },
        { phone: { contains: search.query } },
      ];
    }

    const orderBy: any = {};
    if (search.sortBy) {
      orderBy[search.sortBy] = search.sortOrder || 'desc';
    } else {
      orderBy.name = 'asc';
    }

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy,
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        include: {
          transactions: {
            where: { status: 'POSTED' },
            select: { type: true, amountPaise: true, date: true, dueDate: true },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    // Calculate balances
    const customersWithBalances = items.map((customer) => {
      let balance = 0;
      let totalCredit = 0;
      let totalPayments = 0;
      let lastTransactionDate: Date | null = null;
      const today = new Date();
      let overdue = 0;

      for (const tx of customer.transactions) {
        if (tx.type === 'CREDIT' || tx.type === 'ADJUSTMENT') {
          balance += tx.amountPaise;
          if (tx.type === 'CREDIT') {
            totalCredit += tx.amountPaise;
            // Check if credit is overdue
            if ((tx as any).dueDate && new Date((tx as any).dueDate) < today) {
              overdue += tx.amountPaise;
            }
          }
        } else {
          balance -= tx.amountPaise;
          if (tx.type === 'PAYMENT') totalPayments += tx.amountPaise;
        }
        if (!lastTransactionDate || tx.date > lastTransactionDate) {
          lastTransactionDate = tx.date;
        }
      }

      const { transactions, ...rest } = customer;
      const effectiveOverdue = Math.min(overdue, Math.max(0, balance));
      return {
        ...rest,
        balancePaise: balance,
        outstandingBalancePaise: balance,
        totalCreditPaise: totalCredit,
        totalPaymentsPaise: totalPayments,
        overdueAmountPaise: effectiveOverdue,
        isOverdue: effectiveOverdue > 0,
        lastTransactionDate,
        transactionCount: transactions.length,
      };
    });

    res.json({
      success: true,
      data: {
        items: customersWithBalances,
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

// GET /api/customers/:id - Get customer details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
    });

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const balance = await calculateCustomerBalance(customer.id);

    // Get transaction summary
    const transactions = await prisma.ledgerTransaction.findMany({
      where: { customerId: customer.id, status: 'POSTED' },
      select: { type: true, amountPaise: true, date: true },
    });

    let totalCredit = 0;
    let totalPayments = 0;
    let lastTransactionDate: Date | null = null;

    for (const tx of transactions) {
      if (tx.type === 'CREDIT') totalCredit += tx.amountPaise;
      if (tx.type === 'PAYMENT') totalPayments += tx.amountPaise;
      if (!lastTransactionDate || tx.date > lastTransactionDate) {
        lastTransactionDate = tx.date;
      }
    }

    res.json({
      success: true,
      data: {
        ...customer,
        outstandingBalancePaise: balance,
        totalCreditPaise: totalCredit,
        totalPaymentsPaise: totalPayments,
        lastTransactionDate,
        transactionCount: transactions.length,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/customers - Create customer
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createCustomerSchema.parse(req.body);

    // Check for potential duplicates
    const existingByName = await prisma.customer.findMany({
      where: { name: { contains: data.name } },
      take: 5,
    });

    const customer = await prisma.customer.create({ data });

    // Log audit event
    await prisma.auditEvent.create({
      data: {
        entityType: 'CUSTOMER',
        entityId: customer.id,
        action: 'CREATE',
        details: JSON.stringify({ name: customer.name }),
      },
    });

    res.status(201).json({
      success: true,
      data: {
        ...customer,
        outstandingBalancePaise: 0,
        totalCreditPaise: 0,
        totalPaymentsPaise: 0,
        lastTransactionDate: null,
        transactionCount: 0,
      },
      warnings: existingByName.length > 0
        ? [`Found ${existingByName.length} existing customer(s) with similar name: ${existingByName.map(c => c.name).join(', ')}`]
        : undefined,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// PUT /api/customers/:id - Update customer
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const data = updateCustomerSchema.parse(req.body);

    const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data,
    });

    await prisma.auditEvent.create({
      data: {
        entityType: 'CUSTOMER',
        entityId: customer.id,
        action: 'UPDATE',
        details: JSON.stringify(data),
      },
    });

    const balance = await calculateCustomerBalance(customer.id);

    res.json({
      success: true,
      data: { ...customer, outstandingBalancePaise: balance },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// PATCH /api/customers/:id/archive - Archive/restore customer
router.patch('/:id/archive', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: { isActive: !existing.isActive },
    });

    await prisma.auditEvent.create({
      data: {
        entityType: 'CUSTOMER',
        entityId: customer.id,
        action: 'UPDATE',
        details: JSON.stringify({ isActive: customer.isActive }),
      },
    });

    res.json({
      success: true,
      data: customer,
      message: customer.isActive ? 'Customer restored' : 'Customer archived',
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
