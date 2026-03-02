import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../db/client';
import { runFullPipeline } from '../services/pipeline';
import { rewriteReply, scoreReply } from '../services/oxlo';
import type { Ticket, TicketReply, TicketKBAnswer, ReplyScore, ReplyTone } from '../types';

export const pipelineRouter = Router();

// ─── POST /api/pipeline/:ticketId/run ─────────────────────────────────────────

pipelineRouter.post('/:ticketId/run', async (req: Request, res: Response) => {
  const db = getDb();
  const ticketId = req.params['ticketId'] as string;

  // Check if pipeline has already been run (check for existing analysis)
  const existing = db
    .prepare('SELECT * FROM ticket_analysis WHERE ticket_id = ? LIMIT 1')
    .get(ticketId);

  if (existing) {
    // Return cached result from DB
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as Ticket;
    const analysis = db
      .prepare('SELECT * FROM ticket_analysis WHERE ticket_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(ticketId);
    const replies = db
      .prepare('SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC')
      .all(ticketId) as TicketReply[];

    const kbAnswerRaw = db
      .prepare('SELECT * FROM ticket_kb_answers WHERE ticket_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(ticketId) as (Omit<TicketKBAnswer, 'sources'> & { sources: string }) | undefined;

    const kbAnswer = kbAnswerRaw
      ? { ...kbAnswerRaw, sources: JSON.parse(kbAnswerRaw.sources) as string[] }
      : null;

    const professionalReply = replies.find((r) => r.tone === 'professional');
    const score = professionalReply
      ? db
          .prepare('SELECT * FROM reply_scores WHERE reply_id = ? ORDER BY created_at DESC LIMIT 1')
          .get(professionalReply.id)
      : null;

    const handoffNote = db
      .prepare('SELECT * FROM handoff_notes WHERE ticket_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(ticketId);

    return res.json({
      cached: true,
      ticket,
      analysis,
      replies,
      kb_answer: kbAnswer,
      score,
      handoff_note: handoffNote,
    });
  }

  // Run full pipeline
  const result = await runFullPipeline(ticketId);
  res.json({ cached: false, ...result });
});

// ─── POST /api/pipeline/:ticketId/rewrite ─────────────────────────────────────

const RewriteSchema = z.object({
  replyId: z.string().uuid(),
  targetTone: z.enum(['professional', 'empathetic', 'concise', 'technical'] as const),
});

pipelineRouter.post('/:ticketId/rewrite', async (req: Request, res: Response) => {
  const db = getDb();
  const ticketId = req.params['ticketId'] as string;
  const { replyId, targetTone } = RewriteSchema.parse(req.body);

  // Fetch original reply
  const original = db
    .prepare('SELECT * FROM ticket_replies WHERE id = ? AND ticket_id = ?')
    .get(replyId, ticketId) as TicketReply | undefined;

  if (!original) throw Object.assign(new Error('NOT_FOUND'), {});

  const rewriteResult = await rewriteReply(original.content, targetTone as ReplyTone, ticketId);

  const newReplyId = crypto.randomUUID();
  const now = Date.now();

  db.prepare(
    `INSERT INTO ticket_replies (id, ticket_id, tone, content, model_used, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    newReplyId,
    ticketId,
    targetTone,
    rewriteResult.rewritten,
    process.env.OXLO_MODEL ?? 'mistral-small-latest',
    now
  );

  const newReply: TicketReply = {
    id: newReplyId,
    ticket_id: ticketId,
    tone: targetTone as ReplyTone,
    content: rewriteResult.rewritten,
    model_used: process.env.OXLO_MODEL ?? 'mistral-small-latest',
    created_at: now,
  };

  res.json({ reply: newReply });
});

// ─── POST /api/pipeline/:ticketId/score ───────────────────────────────────────

const ScoreSchema = z.object({
  replyId: z.string().uuid(),
});

pipelineRouter.post('/:ticketId/score', async (req: Request, res: Response) => {
  const db = getDb();
  const ticketId = req.params['ticketId'] as string;
  const { replyId } = ScoreSchema.parse(req.body);

  const reply = db
    .prepare('SELECT * FROM ticket_replies WHERE id = ? AND ticket_id = ?')
    .get(replyId, ticketId) as TicketReply | undefined;

  if (!reply) throw Object.assign(new Error('NOT_FOUND'), {});

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as Ticket | undefined;
  if (!ticket) throw Object.assign(new Error('NOT_FOUND'), {});

  const scoreResult = await scoreReply(ticket, reply.content, ticketId);

  const scoreId = crypto.randomUUID();
  const now = Date.now();

  db.prepare(
    `INSERT INTO reply_scores (id, reply_id, score, feedback, improvements, model_used, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    scoreId,
    replyId,
    scoreResult.score,
    scoreResult.feedback,
    JSON.stringify(scoreResult.improvements),
    process.env.OXLO_MODEL ?? 'mistral-small-latest',
    now
  );

  const score: ReplyScore = {
    id: scoreId,
    reply_id: replyId,
    score: scoreResult.score,
    feedback: scoreResult.feedback,
    improvements: scoreResult.improvements,
    model_used: process.env.OXLO_MODEL ?? 'mistral-small-latest',
    created_at: now,
  };

  res.json({ score });
});
