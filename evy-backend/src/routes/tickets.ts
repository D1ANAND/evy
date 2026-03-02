import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../db/client';
import type { Ticket, TicketAnalysis, TicketReply, ReplyScore, TicketKBAnswer, HandoffNote } from '../types';

export const ticketsRouter = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CreateTicketSchema = z.object({
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  customer_email: z.string().email().optional(),
  source: z.enum(['manual', 'email', 'chat']).optional().default('manual'),
});

const UpdateTicketSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved']).optional(),
});

// ─── POST /api/tickets ────────────────────────────────────────────────────────

ticketsRouter.post('/', async (req: Request, res: Response) => {
  const body = CreateTicketSchema.parse(req.body);
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();

  db.prepare(
    `INSERT INTO tickets (id, subject, body, customer_email, source, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`
  ).run(id, body.subject, body.body, body.customer_email ?? null, body.source, now, now);

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as Ticket;
  res.status(201).json({ ticket });
});

// ─── GET /api/tickets ─────────────────────────────────────────────────────────

ticketsRouter.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const status = req.query['status'] as string | undefined;
  const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10)));
  const offset = (page - 1) * limit;

  const countRow = status
    ? (db.prepare('SELECT COUNT(*) as cnt FROM tickets t WHERE t.status = ?').get(status) as { cnt: number })
    : (db.prepare('SELECT COUNT(*) as cnt FROM tickets t').get() as { cnt: number });

  const rows = status
    ? db.prepare(
        `SELECT t.*, ta.intent, ta.priority, ta.sentiment, ta.escalation_risk,
                ta.summary as analysis_summary, ta.suggested_category
         FROM tickets t
         LEFT JOIN ticket_analysis ta ON ta.ticket_id = t.id
         WHERE t.status = ?
         ORDER BY t.created_at DESC LIMIT ? OFFSET ?`
      ).all(status, limit, offset)
    : db.prepare(
        `SELECT t.*, ta.intent, ta.priority, ta.sentiment, ta.escalation_risk,
                ta.summary as analysis_summary, ta.suggested_category
         FROM tickets t
         LEFT JOIN ticket_analysis ta ON ta.ticket_id = t.id
         ORDER BY t.created_at DESC LIMIT ? OFFSET ?`
      ).all(limit, offset);

  res.json({
    tickets: rows,
    pagination: {
      total: countRow.cnt,
      page,
      limit,
      pages: Math.ceil(countRow.cnt / limit),
    },
  });
});

// ─── GET /api/tickets/:id ────────────────────────────────────────────────────

ticketsRouter.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = req.params['id'] as string;

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as Ticket | undefined;
  if (!ticket) throw Object.assign(new Error('NOT_FOUND'), {});

  const analysis = db
    .prepare('SELECT * FROM ticket_analysis WHERE ticket_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(id) as TicketAnalysis | undefined;

  const repliesRaw = db
    .prepare('SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC')
    .all(id) as TicketReply[];

  // Attach scores to replies
  const repliesWithScores = repliesRaw.map((reply) => {
    const score = db
      .prepare('SELECT * FROM reply_scores WHERE reply_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(reply.id) as ReplyScore | undefined;
    let scoreWithParsed = score;
    if (score) {
      scoreWithParsed = {
        ...score,
        improvements:
          typeof score.improvements === 'string'
            ? (JSON.parse(score.improvements) as string[])
            : score.improvements,
      };
    }
    return { ...reply, score: scoreWithParsed ?? null };
  });

  const kbAnswerRaw = db
    .prepare('SELECT * FROM ticket_kb_answers WHERE ticket_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(id) as (Omit<TicketKBAnswer, 'sources'> & { sources: string }) | undefined;

  const kbAnswer = kbAnswerRaw
    ? {
        ...kbAnswerRaw,
        sources: JSON.parse(kbAnswerRaw.sources) as string[],
      }
    : null;

  const handoffNote = db
    .prepare('SELECT * FROM handoff_notes WHERE ticket_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(id) as HandoffNote | undefined;

  res.json({
    ticket,
    analysis: analysis ?? null,
    replies: repliesWithScores,
    kb_answer: kbAnswer,
    handoff_note: handoffNote ?? null,
  });
});

// ─── PATCH /api/tickets/:id ───────────────────────────────────────────────────

ticketsRouter.patch('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = req.params['id'] as string;

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as Ticket | undefined;
  if (!ticket) throw Object.assign(new Error('NOT_FOUND'), {});

  const body = UpdateTicketSchema.parse(req.body);

  if (body.status) {
    db.prepare('UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?').run(
      body.status,
      Date.now(),
      id
    );
  }

  const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as Ticket;
  res.json({ ticket: updated });
});
