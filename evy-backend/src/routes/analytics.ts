import { Router, Request, Response } from 'express';
import { getDb } from '../db/client';
import { getInsights, getStats } from '../services/analytics';
import type { OxloUsageLog } from '../types';

export const analyticsRouter = Router();

// ─── GET /api/analytics/insights ─────────────────────────────────────────────

analyticsRouter.get('/insights', async (req: Request, res: Response) => {
  const limit = Math.min(200, Math.max(1, parseInt(req.query['limit'] as string ?? '50', 10)));
  const insights = await getInsights(limit);
  res.json({ insights, generated_at: Date.now() });
});

// ─── GET /api/analytics/stats ─────────────────────────────────────────────────

analyticsRouter.get('/stats', (_req: Request, res: Response) => {
  const stats = getStats();
  res.json({ stats });
});

// ─── GET /api/usage ───────────────────────────────────────────────────────────
// (Mounted separately at /api/usage in index.ts)

export const usageRouter = Router();

usageRouter.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const page = Math.max(1, parseInt(req.query['page'] as string ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string ?? '50', 10)));
  const offset = (page - 1) * limit;

  const total = (
    db.prepare('SELECT COUNT(*) as cnt FROM oxlo_usage_log').get() as { cnt: number }
  ).cnt;

  const rows = db
    .prepare('SELECT * FROM oxlo_usage_log ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(limit, offset) as OxloUsageLog[];

  res.json({
    usage: rows,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
});
