import { Router, Request, Response } from 'express';
import prisma from '../db';
import { TransactionStatus, TransactionType } from '../schemas';
import { stringify } from 'csv-stringify/sync';
import dayjs from 'dayjs';

const router = Router();

// GET /api/reports/outstanding - Outstanding balances by customer
router.get('/outstanding', async (_req: Request, res: Response) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { isActive: true },
      include: {
        transactions: {
          where: { status: TransactionStatus.POSTED },
          select: { type: true, amountPaise: true, date: true, dueDate: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const today = new Date();
    const report = customers
      .map((customer) => {
        let balance = 0;
        let overdue = 0;
        for (const tx of customer.transactions) {
          if (tx.type === TransactionType.CREDIT || tx.type === TransactionType.ADJUSTMENT) {
            balance += tx.amountPaise;
            if (tx.type === TransactionType.CREDIT && tx.dueDate && tx.dueDate < today) {
              overdue += tx.amountPaise;
            }
          } else {
            balance -= tx.amountPaise;
          }
        }
        return {
          customerId: customer.id,
          customerName: customer.name,
          phone: customer.phone,
          outstandingPaise: balance,
          overduePaise: Math.min(overdue, Math.max(0, balance)),
        };
      })
      .filter((c) => c.outstandingPaise > 0)
      .sort((a, b) => b.outstandingPaise - a.outstandingPaise);

    const totalOutstanding = report.reduce((sum, c) => sum + c.outstandingPaise, 0);
    const totalOverdue = report.reduce((sum, c) => sum + c.overduePaise, 0);

    res.json({
      success: true,
      data: { report, totalOutstandingPaise: totalOutstanding, totalOverduePaise: totalOverdue },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/reports/collections - Collections over a date range
router.get('/collections', async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const where: any = {
      type: TransactionType.PAYMENT,
      status: TransactionStatus.POSTED,
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const payments = await prisma.ledgerTransaction.findMany({
      where,
      include: { customer: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });

    const totalCollected = payments.reduce((sum, p) => sum + p.amountPaise, 0);

    res.json({
      success: true,
      data: {
        payments,
        totalCollectedPaise: totalCollected,
        count: payments.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/reports/credit-extended - Credit extended over a date range
router.get('/credit-extended', async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const where: any = {
      type: TransactionType.CREDIT,
      status: TransactionStatus.POSTED,
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const credits = await prisma.ledgerTransaction.findMany({
      where,
      include: { customer: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });

    const totalCredit = credits.reduce((sum, c) => sum + c.amountPaise, 0);

    res.json({
      success: true,
      data: {
        credits,
        totalCreditPaise: totalCredit,
        count: credits.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/reports/export/transactions - Export transactions as CSV
router.get('/export/transactions', async (req: Request, res: Response) => {
  try {
    const customerId = req.query.customerId as string | undefined;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const where: any = { status: TransactionStatus.POSTED };
    if (customerId) where.customerId = customerId;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const transactions = await prisma.ledgerTransaction.findMany({
      where,
      include: { customer: { select: { name: true } } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    const csvData = transactions.map((tx) => ({
      Date: dayjs(tx.date).format('DD/MM/YYYY'),
      Customer: tx.customer.name,
      Type: tx.type,
      'Amount (₹)': (tx.amountPaise / 100).toFixed(2),
      Description: tx.description,
      Reference: tx.referenceNumber || '',
      'Due Date': tx.dueDate ? dayjs(tx.dueDate).format('DD/MM/YYYY') : '',
      Source: tx.source,
      Status: tx.status,
    }));

    const csv = stringify(csvData, { header: true });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/reports/export/customer-statement/:customerId - Customer statement CSV
router.get('/export/customer-statement/:customerId', async (req: Request, res: Response) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.customerId },
    });

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const transactions = await prisma.ledgerTransaction.findMany({
      where: { customerId: customer.id, status: TransactionStatus.POSTED },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    let runningBalance = 0;
    const csvData = transactions.map((tx) => {
      if (tx.type === TransactionType.CREDIT || tx.type === TransactionType.ADJUSTMENT) {
        runningBalance += tx.amountPaise;
      } else {
        runningBalance -= tx.amountPaise;
      }

      return {
        Date: dayjs(tx.date).format('DD/MM/YYYY'),
        Description: tx.description,
        Type: tx.type,
        'Debit (₹)': (tx.type === TransactionType.CREDIT || tx.type === TransactionType.ADJUSTMENT)
          ? (tx.amountPaise / 100).toFixed(2)
          : '',
        'Credit (₹)': (tx.type === TransactionType.PAYMENT || tx.type === TransactionType.REVERSAL)
          ? (tx.amountPaise / 100).toFixed(2)
          : '',
        'Balance (₹)': (runningBalance / 100).toFixed(2),
        Reference: tx.referenceNumber || '',
      };
    });

    const csv = stringify(csvData, { header: true });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=statement-${customer.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`
    );
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
