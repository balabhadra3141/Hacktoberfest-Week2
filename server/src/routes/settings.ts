import { Router, Request, Response } from 'express';
import prisma from '../db';
import { updateBusinessProfileSchema, setAIModelSchema } from '../schemas';
import { checkAIStatus, listOllamaModels, setActiveModel } from '../services/ai.service';
import fs from 'fs';
import path from 'path';

const router = Router();

// GET /api/settings/business - Get business profile
router.get('/business', async (_req: Request, res: Response) => {
  try {
    let profile = await prisma.businessProfile.findFirst();
    if (!profile) {
      profile = await prisma.businessProfile.create({
        data: { name: 'My Business' },
      });
    }
    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/settings/business - Update business profile
router.put('/business', async (req: Request, res: Response) => {
  try {
    const data = updateBusinessProfileSchema.parse(req.body);
    
    let profile = await prisma.businessProfile.findFirst();
    if (!profile) {
      profile = await prisma.businessProfile.create({ data: { ...data, name: data.name || 'My Business' } });
    } else {
      profile = await prisma.businessProfile.update({
        where: { id: profile.id },
        data,
      });
    }

    await prisma.auditEvent.create({
      data: {
        entityType: 'SETTINGS',
        entityId: profile.id,
        action: 'UPDATE',
        details: JSON.stringify(data),
      },
    });

    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/settings/ai-status - Check AI runtime status
router.get('/ai-status', async (_req: Request, res: Response) => {
  try {
    const status = await checkAIStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/settings/ai-models - List models installed in the local Ollama instance
router.get('/ai-models', async (_req: Request, res: Response) => {
  try {
    const listing = await listOllamaModels();
    const active = (await checkAIStatus()).model;
    res.json({
      success: true,
      data: {
        ...listing,
        activeModel: active,
        models: listing.models.map((m) => ({ ...m, active: m.name === active })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/settings/ai-model - Switch the model used for local inference
router.put('/ai-model', async (req: Request, res: Response) => {
  try {
    const { model } = setAIModelSchema.parse(req.body);

    const listing = await listOllamaModels();
    const installed = listing.models.map((m) => m.name);
    const isInstalled = installed.some(
      (name) => name === model || name === `${model}:latest` || model === `${name}:latest`
    );

    await setActiveModel(model);

    if (!listing.reachable) {
      return res.json({
        success: true,
        data: {
          model,
          installed: false,
          warning: `Saved, but Ollama is not reachable at ${listing.baseUrl}. Start it with: ollama serve`,
        },
      });
    }

    if (!isInstalled) {
      return res.json({
        success: true,
        data: {
          model,
          installed: false,
          warning: `Saved, but model "${model}" is not installed yet. Run: ollama pull ${model}`,
        },
      });
    }

    res.json({ success: true, data: { model, installed: true } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/settings/backup - Create database backup
router.post('/backup', async (_req: Request, res: Response) => {
  try {
    const customers = await prisma.customer.findMany();
    const transactions = await prisma.ledgerTransaction.findMany();
    const reminders = await prisma.reminderHistory.findMany();
    const profile = await prisma.businessProfile.findFirst();
    const settings = await prisma.appSettings.findMany();

    const backup = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      data: {
        businessProfile: profile,
        customers,
        transactions,
        reminders,
        settings,
      },
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=udhaaros-backup-${new Date().toISOString().split('T')[0]}.json`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/settings/restore - Restore from backup
router.post('/restore', async (req: Request, res: Response) => {
  try {
    const backup = req.body;

    // Validate backup format
    if (!backup || !backup.version || !backup.data) {
      return res.status(400).json({ success: false, error: 'Invalid backup file format' });
    }

    if (!backup.data.customers || !backup.data.transactions) {
      return res.status(400).json({ success: false, error: 'Backup file missing required data' });
    }

    // Validate data structure
    if (!Array.isArray(backup.data.customers) || !Array.isArray(backup.data.transactions)) {
      return res.status(400).json({ success: false, error: 'Invalid data structure in backup' });
    }

    // Perform restore in a transaction
    await prisma.$transaction(async (tx) => {
      // Clear existing data in reverse dependency order
      await tx.reminderHistory.deleteMany();
      await tx.importCandidate.deleteMany();
      await tx.ledgerTransaction.deleteMany();
      await tx.importBatch.deleteMany();
      await tx.customer.deleteMany();
      await tx.auditEvent.deleteMany();
      await tx.appSettings.deleteMany();
      await tx.businessProfile.deleteMany();

      // Restore business profile
      if (backup.data.businessProfile) {
        await tx.businessProfile.create({ data: backup.data.businessProfile });
      }

      // Restore customers
      for (const customer of backup.data.customers) {
        await tx.customer.create({ data: customer });
      }

      // Restore transactions
      for (const transaction of backup.data.transactions) {
        await tx.ledgerTransaction.create({ data: transaction });
      }

      // Restore reminders
      if (backup.data.reminders) {
        for (const reminder of backup.data.reminders) {
          await tx.reminderHistory.create({ data: reminder });
        }
      }

      // Restore settings
      if (backup.data.settings) {
        for (const setting of backup.data.settings) {
          await tx.appSettings.create({ data: setting });
        }
      }

      // Audit
      await tx.auditEvent.create({
        data: {
          entityType: 'SETTINGS',
          entityId: 'system',
          action: 'RESTORE',
          details: JSON.stringify({ 
            backupDate: backup.createdAt,
            customers: backup.data.customers.length,
            transactions: backup.data.transactions.length,
          }),
        },
      });
    });

    res.json({
      success: true,
      message: `Restored ${backup.data.customers.length} customers and ${backup.data.transactions.length} transactions`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: `Restore failed: ${error.message}` });
  }
});

// POST /api/settings/seed - Load demo data
router.post('/seed', async (_req: Request, res: Response) => {
  try {
    // Import seed function dynamically
    const seedModule = await import('../../prisma/seed');
    await seedModule.seed();
    res.json({ success: true, message: 'Demo data loaded successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/health - Health check
router.get('/health', async (_req: Request, res: Response) => {
  try {
    // Test database
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
      },
    });
  } catch (error: any) {
    res.status(503).json({
      success: false,
      data: { status: 'unhealthy', database: 'disconnected' },
    });
  }
});

export default router;
