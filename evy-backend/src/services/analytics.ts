import { getDb } from '../db/client';
import { generateInsights } from './oxlo';
import type { InsightsResult, AnalyticsStats, TicketPriority } from '../types';

// ─── Simple in-memory cache (keyed by limit) ──────────────────────────────────
const insightsCache = new Map<number, { result: InsightsResult; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── getInsights ──────────────────────────────────────────────────────────────

export async function getInsights(limit: number): Promise<InsightsResult> {
  const cached = insightsCache.get(limit);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[analytics] Returning cached insights (limit=${limit})`);
    return cached.result;
  }

  const db = getDb();

  // Join tickets with their latest analysis
  const rows = db
    .prepare(
      `SELECT t.subject, t.body, t.created_at,
              ta.intent, ta.priority, ta.sentiment
       FROM tickets t
       LEFT JOIN ticket_analysis ta ON ta.ticket_id = t.id
       ORDER BY t.created_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
    subject: string;
    body: string;
    created_at: number;
    intent: string | null;
    priority: string | null;
    sentiment: string | null;
  }>;

  const ticketsForInsights = rows.map((r) => ({
    subject: r.subject,
    body: r.body,
    intent: r.intent ?? 'unknown',
    priority: r.priority ?? 'medium',
    sentiment: r.sentiment ?? 'neutral',
    created_at: r.created_at,
  }));

  const result = await generateInsights(ticketsForInsights);
  insightsCache.set(limit, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

// ─── getStats ─────────────────────────────────────────────────────────────────

export function getStats(): AnalyticsStats {
  const db = getDb();

  const total = (db.prepare('SELECT COUNT(*) as cnt FROM tickets').get() as { cnt: number }).cnt;
  const open = (
    db.prepare("SELECT COUNT(*) as cnt FROM tickets WHERE status = 'open'").get() as { cnt: number }
  ).cnt;
  const resolved = (
    db.prepare("SELECT COUNT(*) as cnt FROM tickets WHERE status = 'resolved'").get() as {
      cnt: number;
    }
  ).cnt;

  // Priority breakdown
  const priorityRows = db
    .prepare(
      `SELECT priority, COUNT(*) as cnt FROM ticket_analysis WHERE priority IS NOT NULL GROUP BY priority`
    )
    .all() as Array<{ priority: string; cnt: number }>;

  const by_priority: Record<TicketPriority, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const row of priorityRows) {
    if (row.priority in by_priority) {
      by_priority[row.priority as TicketPriority] = row.cnt;
    }
  }

  // Intent breakdown
  const intentRows = db
    .prepare(
      `SELECT intent, COUNT(*) as cnt FROM ticket_analysis WHERE intent IS NOT NULL GROUP BY intent`
    )
    .all() as Array<{ intent: string; cnt: number }>;

  const by_intent: Record<string, number> = {};
  for (const row of intentRows) {
    by_intent[row.intent] = row.cnt;
  }

  // Avg reply score
  const avgScore = (
    db.prepare('SELECT AVG(score) as avg FROM reply_scores').get() as { avg: number | null }
  ).avg;

  // Usage log stats
  const usageStats = db
    .prepare(
      'SELECT COUNT(*) as total_calls, SUM(COALESCE(prompt_tokens,0) + COALESCE(completion_tokens,0)) as total_tokens FROM oxlo_usage_log'
    )
    .get() as { total_calls: number; total_tokens: number | null };

  return {
    total_tickets: total,
    open,
    resolved,
    by_priority,
    by_intent,
    avg_reply_score: avgScore ? Math.round(avgScore * 10) / 10 : 0,
    total_oxlo_calls: usageStats.total_calls,
    total_tokens_used: usageStats.total_tokens ?? 0,
  };
}
