import { getDb } from '../db/client';
import {
  classifyTicket,
  draftReply,
  answerFromKnowledgeBase,
  scoreReply,
  generateHandoffNote,
} from './oxlo';
import type {
  Ticket,
  TicketAnalysis,
  TicketReply,
  TicketKBAnswer,
  ReplyScore,
  HandoffNote,
  FullPipelineResult,
  ReplyTone,
} from '../types';

const ALL_TONES: ReplyTone[] = ['professional', 'empathetic', 'concise', 'technical'];

// ─── runFullPipeline ──────────────────────────────────────────────────────────

export async function runFullPipeline(ticketId: string): Promise<FullPipelineResult> {
  const db = getDb();

  // Fetch ticket
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as Ticket | undefined;
  if (!ticket) throw Object.assign(new Error('NOT_FOUND'), { statusCode: 404 });

  // ── Phase 1: classify + professional draft + KB answer (in parallel) ───────
  const kbRows = db.prepare('SELECT id, title, content FROM knowledge_base').all() as Array<{
    id: string;
    title: string;
    content: string;
  }>;

  const [classifyResult, professionalDraftResult, kbAnswerResult] = await Promise.all([
    classifyTicket(ticket, ticketId),
    draftReply(ticket, 'professional', undefined, ticketId),
    answerFromKnowledgeBase(ticket, kbRows, ticketId),
  ]);

  // ── Persist analysis ───────────────────────────────────────────────────────
  const analysisId = crypto.randomUUID();
  const now = Date.now();

  db.prepare(
    `INSERT INTO ticket_analysis (id, ticket_id, intent, priority, sentiment, escalation_risk, summary, suggested_category, analysis_model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    analysisId,
    ticketId,
    classifyResult.intent,
    classifyResult.priority,
    classifyResult.sentiment,
    classifyResult.escalation_risk,
    classifyResult.summary,
    classifyResult.suggested_category,
    process.env.OXLO_MODEL ?? 'mistral-small-latest',
    now
  );

  const analysis: TicketAnalysis = {
    id: analysisId,
    ticket_id: ticketId,
    ...classifyResult,
    analysis_model: process.env.OXLO_MODEL ?? 'mistral-small-latest',
    created_at: now,
  };

  // ── Persist KB answer ──────────────────────────────────────────────────────
  const kbAnswerId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO ticket_kb_answers (id, ticket_id, answer, sources, model_used, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    kbAnswerId,
    ticketId,
    kbAnswerResult.answer,
    JSON.stringify(kbAnswerResult.used_sources),
    process.env.OXLO_MODEL ?? 'mistral-small-latest',
    now
  );

  const kbAnswer: TicketKBAnswer = {
    id: kbAnswerId,
    ticket_id: ticketId,
    answer: kbAnswerResult.answer,
    sources: kbAnswerResult.used_sources,
    model_used: process.env.OXLO_MODEL ?? 'mistral-small-latest',
    created_at: now,
  };

  // ── Phase 2: QA score + handoff note (in parallel) ────────────────────────
  const [scoreResult, handoffResult] = await Promise.all([
    scoreReply(ticket, professionalDraftResult.reply, ticketId),
    generateHandoffNote(ticket, classifyResult, professionalDraftResult.reply, ticketId),
  ]);

  // ── Persist professional draft reply first (needed for score FK) ───────────
  const professionalReplyId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO ticket_replies (id, ticket_id, tone, content, model_used, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    professionalReplyId,
    ticketId,
    'professional',
    professionalDraftResult.reply,
    process.env.OXLO_MODEL ?? 'mistral-small-latest',
    now
  );

  // ── Persist score ──────────────────────────────────────────────────────────
  const scoreId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO reply_scores (id, reply_id, score, feedback, improvements, model_used, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    scoreId,
    professionalReplyId,
    scoreResult.score,
    scoreResult.feedback,
    JSON.stringify(scoreResult.improvements),
    process.env.OXLO_MODEL ?? 'mistral-small-latest',
    now
  );

  const score: ReplyScore = {
    id: scoreId,
    reply_id: professionalReplyId,
    score: scoreResult.score,
    feedback: scoreResult.feedback,
    improvements: scoreResult.improvements,
    model_used: process.env.OXLO_MODEL ?? 'mistral-small-latest',
    created_at: now,
  };

  // ── Persist handoff note ───────────────────────────────────────────────────
  const handoffId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO handoff_notes (id, ticket_id, note, model_used, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    handoffId,
    ticketId,
    handoffResult.note,
    process.env.OXLO_MODEL ?? 'mistral-small-latest',
    now
  );

  const handoffNote: HandoffNote = {
    id: handoffId,
    ticket_id: ticketId,
    note: handoffResult.note,
    model_used: process.env.OXLO_MODEL ?? 'mistral-small-latest',
    created_at: now,
  };

  // ── Phase 3: Draft all 4 tones in parallel ────────────────────────────────
  const remainingTones = ALL_TONES.filter((t) => t !== 'professional');
  const toneDrafts = await Promise.all(
    remainingTones.map((tone) => draftReply(ticket, tone, kbAnswerResult.answer, ticketId))
  );

  // ── Persist remaining tone replies ────────────────────────────────────────
  const insertReply = db.prepare(
    `INSERT INTO ticket_replies (id, ticket_id, tone, content, model_used, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const allReplies: TicketReply[] = [
    {
      id: professionalReplyId,
      ticket_id: ticketId,
      tone: 'professional',
      content: professionalDraftResult.reply,
      model_used: process.env.OXLO_MODEL ?? 'mistral-small-latest',
      created_at: now,
    },
  ];

  const insertMany = db.transaction(() => {
    remainingTones.forEach((tone, i) => {
      const replyId = crypto.randomUUID();
      insertReply.run(
        replyId,
        ticketId,
        tone,
        toneDrafts[i]?.reply ?? '',
        process.env.OXLO_MODEL ?? 'mistral-small-latest',
        now
      );
      allReplies.push({
        id: replyId,
        ticket_id: ticketId,
        tone,
        content: toneDrafts[i]?.reply ?? '',
        model_used: process.env.OXLO_MODEL ?? 'mistral-small-latest',
        created_at: now,
      });
    });
  });
  insertMany();

  // ── Mark ticket as in_progress ────────────────────────────────────────────
  db.prepare('UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?').run(
    'in_progress',
    Date.now(),
    ticketId
  );

  return {
    ticket: { ...ticket, status: 'in_progress' },
    analysis,
    replies: allReplies,
    kb_answer: kbAnswer,
    score,
    handoff_note: handoffNote,
  };
}
