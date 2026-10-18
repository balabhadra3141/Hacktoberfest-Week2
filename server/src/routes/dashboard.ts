import { Router, Request, Response } from 'express';
import { getDashboardStats, getRecentTransactions, getCustomersNeedingFollowUp, getOutstandingTrend } from '../services/ledger.service';
import { generateDashboardInsights } from '../services/ai.service';

const router = Router();

// GET /api/dashboard - Dashboard overview
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [stats, recentTransactions, followUpCustomers, trend] = await Promise.all([
      getDashboardStats(),
      getRecentTransactions(10),
      getCustomersNeedingFollowUp(),
      getOutstandingTrend(30),
    ]);

    // Generate evidence-based insights (deterministic, not AI)
    const insights = await generateDashboardInsights(stats);

    res.json({
      success: true,
      data: {
        stats,
        recentTransactions,
        followUpCustomers,
        trend,
        insights,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
