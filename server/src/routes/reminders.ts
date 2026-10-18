import { Router, Request, Response } from 'express';
import prisma from '../db';
import { generateReminder } from '../services/ai.service';
import { calculateCustomerBalance } from '../services/ledger.service';
import { generateReminderSchema } from '../schemas';

const router = Router();

// POST /api/reminders/generate - Generate a payment reminder
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const data = generateReminderSchema.parse(req.body);

    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
    });

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const balance = await calculateCustomerBalance(customer.id);
    if (balance <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Customer has no outstanding balance',
      });
    }

    // Get oldest overdue date
    const overdueTransaction = await prisma.ledgerTransaction.findFirst({
      where: {
        customerId: customer.id,
        type: 'CREDIT',
        status: 'POSTED',
        dueDate: { lt: new Date() },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Get business name
    const business = await prisma.businessProfile.findFirst();
    const businessName = business?.name || 'Our Business';

    const result = await generateReminder(
      customer.name,
      balance,
      overdueTransaction?.dueDate?.toISOString() || null,
      data.type,
      data.language,
      businessName
    );

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.json({
      success: true,
      data: {
        message: result.message,
        customerName: customer.name,
        amountPaise: balance,
        type: data.type,
        language: data.language,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/reminders/save - Save reminder to history (when user copies)
router.post('/save', async (req: Request, res: Response) => {
  try {
    const { customerId, type, language, messageText, amountPaise } = req.body;

    const reminder = await prisma.reminderHistory.create({
      data: {
        customerId,
        type: type || 'WHATSAPP',
        language: language || 'en',
        messageText,
        amountPaise,
      },
    });

    res.status(201).json({ success: true, data: reminder });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/reminders/history/:customerId - Get reminder history for a customer
router.get('/history/:customerId', async (req: Request, res: Response) => {
  try {
    const reminders = await prisma.reminderHistory.findMany({
      where: { customerId: req.params.customerId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({ success: true, data: reminders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
