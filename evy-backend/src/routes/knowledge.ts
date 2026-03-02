import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../db/client';
import type { KnowledgeBaseEntry } from '../types';

export const knowledgeRouter = Router();

// ─── GET /api/knowledge ───────────────────────────────────────────────────────

knowledgeRouter.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const entries = db
    .prepare('SELECT * FROM knowledge_base ORDER BY created_at DESC')
    .all() as KnowledgeBaseEntry[];
  res.json({ entries });
});

// ─── POST /api/knowledge ──────────────────────────────────────────────────────

const CreateKBSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(1),
  category: z.string().optional(),
});

knowledgeRouter.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const body = CreateKBSchema.parse(req.body);
  const id = crypto.randomUUID();
  const now = Date.now();

  db.prepare(
    'INSERT INTO knowledge_base (id, title, content, category, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, body.title, body.content, body.category ?? null, now);

  const entry = db.prepare('SELECT * FROM knowledge_base WHERE id = ?').get(id) as KnowledgeBaseEntry;
  res.status(201).json({ entry });
});

// ─── DELETE /api/knowledge/:id ────────────────────────────────────────────────

knowledgeRouter.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = req.params['id'] as string;

  const entry = db
    .prepare('SELECT * FROM knowledge_base WHERE id = ?')
    .get(id) as KnowledgeBaseEntry | undefined;

  if (!entry) throw Object.assign(new Error('NOT_FOUND'), {});

  db.prepare('DELETE FROM knowledge_base WHERE id = ?').run(id);
  res.json({ deleted: true, id });
});
