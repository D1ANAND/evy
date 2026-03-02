import { oxloClient, OXLO_MODEL } from '../config';
import { getDb } from '../db/client';
import type OpenAI from 'openai';
import type {
  ClassifyResult,
  DraftReplyResult,
  RewriteReplyResult,
  KBAnswerResult,
  ScoreReplyResult,
  HandoffNoteResult,
  InsightsResult,
  KnowledgeBaseEntry,
  OxloAction,
} from '../types';

type ChatCompletion = OpenAI.Chat.ChatCompletion;
type ChatCompletionCreateParams = OpenAI.Chat.ChatCompletionCreateParamsNonStreaming;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function logUsage(
  action: OxloAction,
  model: string,
  promptTokens: number | null,
  completionTokens: number | null,
  durationMs: number,
  ticketId?: string
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO oxlo_usage_log (id, ticket_id, action, model, prompt_tokens, completion_tokens, duration_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    ticketId ?? null,
    action,
    model,
    promptTokens,
    completionTokens,
    durationMs,
    Date.now()
  );
}

/** Call Oxlo with up to 2 retries on empty/null model output */
async function callWithRetry(
  params: ChatCompletionCreateParams,
  maxRetries = 2
): Promise<ChatCompletion> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.warn(`[oxlo] Retrying attempt ${attempt}...`);
        await sleep(800 * attempt);
      }
      const result = await oxloClient.chat.completions.create({ ...params, stream: false });
      const completion = result as ChatCompletion;
      const content = completion.choices?.[0]?.message?.content;
      if (!content || content.trim() === '') {
        console.warn('[oxlo] Empty response, will retry...');
        lastErr = new Error('Empty model response');
        continue;
      }
      return completion;
    } catch (err) {
      lastErr = err;
      // Only retry on 5xx / network errors
      const status = (err as { status?: number }).status;
      if (status && status < 500) throw err;
    }
  }
  throw lastErr;
}

/**
 * Strip markdown code fences, then extract the first { } or [ ] block.
 * Also sanitises unescaped literal newlines inside JSON strings.
 */
function cleanAndParseJson<T>(raw: string, fallback: T): T {
  let s = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Find bounds of the JSON object/array
  const firstBrace = s.indexOf('{');
  const firstBracket = s.indexOf('[');
  let start = -1;
  let closeChar = '}';

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace; closeChar = '}';
  } else if (firstBracket !== -1) {
    start = firstBracket; closeChar = ']';
  }

  if (start !== -1) {
    const end = s.lastIndexOf(closeChar);
    if (end > start) s = s.slice(start, end + 1);
  }

  // Sanitise literal newlines inside JSON string values
  // Replace actual CR/LF inside string values with their escaped counterparts
  s = s.replace(/("(?:[^"\\]|\\.)*")/gs, (match) =>
    match.replace(/\r?\n/g, '\\n').replace(/\t/g, '\\t')
  );

  try {
    return JSON.parse(s) as T;
  } catch {
    console.error('[oxlo] JSON parse failed for:', s.slice(0, 200));
    return fallback;
  }
}

/** Naive regex extractor for a single scalar field when full JSON parse fails */
function extractField(raw: string, field: string): string {
  const m = raw.match(new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  return m ? m[1].replace(/\\n/g, '\n') : '';
}

function extractNumber(raw: string, field: string): number | null {
  const m = raw.match(new RegExp(`"${field}"\\s*:\\s*(\\d+(?:\\.\\d+)?)`));
  return m ? parseFloat(m[1]) : null;
}

// ─── 1. classifyTicket ────────────────────────────────────────────────────────

export async function classifyTicket(
  ticket: { subject: string; body: string },
  ticketId?: string
): Promise<ClassifyResult> {
  const model = OXLO_MODEL;
  const start = Date.now();

  const completion = await callWithRetry({
    model,
    messages: [
      {
        role: 'system',
        content: 'You are an expert customer support analyst. Output ONLY a JSON object — no prose, no markdown fences.',
      },
      {
        role: 'user',
        content: `Analyze this support ticket and return a JSON object with exactly these fields:
{"intent":"billing_issue","priority":"critical","sentiment":"frustrated","escalation_risk":"high","suggested_category":"Billing","summary":"One sentence. Second sentence."}

Allowed intent values: billing_issue, technical_support, refund_request, account_access, feature_request, complaint, general_inquiry, shipping_issue, bug_report, other
Allowed priority values: critical, high, medium, low
Allowed sentiment values: positive, neutral, negative, frustrated, confused
Allowed escalation_risk values: high, medium, low

Ticket Subject: ${ticket.subject}
Ticket Body: ${ticket.body.slice(0, 500)}`,
      },
    ],
  });

  const durationMs = Date.now() - start;
  const usage = completion.usage;
  logUsage('classify', model, usage?.prompt_tokens ?? null, usage?.completion_tokens ?? null, durationMs, ticketId);

  const raw = completion.choices[0]?.message?.content ?? '{}';
  return cleanAndParseJson<ClassifyResult>(raw, {
    intent: 'other',
    priority: 'medium',
    sentiment: 'neutral',
    escalation_risk: 'low',
    suggested_category: 'General',
    summary: ticket.subject,
  });
}

// ─── 2. draftReply — plain text output ───────────────────────────────────────

export async function draftReply(
  ticket: { subject: string; body: string },
  tone: string,
  context?: string,
  ticketId?: string
): Promise<DraftReplyResult> {
  const model = OXLO_MODEL;
  const start = Date.now();

  const contextSection = context
    ? `\n\nRelevant knowledge base information:\n${context.slice(0, 350)}`
    : '';

  const completion = await callWithRetry({
    model,
    messages: [
      {
        role: 'system',
        content: `You are a skilled customer support agent. Write a complete, ready-to-send reply email in a ${tone} tone. Include: greeting, body addressing every concern, sign-off from "The Support Team". Output ONLY the email text — no JSON, no markdown, no commentary.`,
      },
      {
        role: 'user',
        content: `Write a ${tone} reply to this ticket.\n\nSubject: ${ticket.subject}\nBody: ${ticket.body.slice(0, 400)}${contextSection}`,
      },
    ],
  });

  const durationMs = Date.now() - start;
  const usage = completion.usage;
  logUsage('draft', model, usage?.prompt_tokens ?? null, usage?.completion_tokens ?? null, durationMs, ticketId);

  const reply = (completion.choices[0]?.message?.content ?? '').trim();
  return { reply };
}

// ─── 3. rewriteReply — plain text output ─────────────────────────────────────

export async function rewriteReply(
  reply: string,
  targetTone: string,
  ticketId?: string
): Promise<RewriteReplyResult> {
  const model = OXLO_MODEL;
  const start = Date.now();

  const completion = await callWithRetry({
    model,
    messages: [
      {
        role: 'system',
        content: `You are a communication expert. Rewrite the following customer support reply in a ${targetTone} tone, preserving all factual information. Output ONLY the rewritten email text — no JSON, no markdown, no commentary.`,
      },
      {
        role: 'user',
        content: `Rewrite this reply in a ${targetTone} tone:\n\n${reply.slice(0, 600)}`,
      },
    ],
  });

  const durationMs = Date.now() - start;
  const usage = completion.usage;
  logUsage('rewrite', model, usage?.prompt_tokens ?? null, usage?.completion_tokens ?? null, durationMs, ticketId);

  const rewritten = (completion.choices[0]?.message?.content ?? '').trim();
  return { rewritten: rewritten || reply };
}

// ─── 4. answerFromKnowledgeBase ───────────────────────────────────────────────

export async function answerFromKnowledgeBase(
  ticket: { subject: string; body: string },
  kbEntries: Array<Pick<KnowledgeBaseEntry, 'id' | 'title' | 'content'>>,
  ticketId?: string
): Promise<KBAnswerResult> {
  const model = OXLO_MODEL;
  const start = Date.now();

  const kbContext = kbEntries
    .map((e, i) => {
      const snippet = e.content.length > 250 ? e.content.slice(0, 250) + '...' : e.content;
      return `[${i + 1}] ID:${e.id} | ${e.title}: ${snippet}`;
    })
    .join('\n');

  const completion = await callWithRetry({
    model,
    messages: [
      {
        role: 'system',
        content: `You are a support knowledge assistant. Using ONLY the provided KB articles, write a helpful answer to the customer's question. At the very end on its own line, write "SOURCES: <id1>, <id2>" listing only the IDs of articles you referenced. Output plain text only — no JSON, no markdown.`,
      },
      {
        role: 'user',
        content: `Ticket: ${ticket.subject} — ${ticket.body.slice(0, 200)}\n\nKB Articles:\n${kbContext}`,
      },
    ],
  });

  const durationMs = Date.now() - start;
  const usage = completion.usage;
  logUsage('kb_answer', model, usage?.prompt_tokens ?? null, usage?.completion_tokens ?? null, durationMs, ticketId);

  const raw = (completion.choices[0]?.message?.content ?? '').trim();

  // Split answer from SOURCES line
  const sourcesLineMatch = raw.match(/SOURCES:\s*([^\n]+)/i);
  const answerText = raw.replace(/SOURCES:[^\n]*/i, '').trim();

  let usedSources: string[] = [];
  if (sourcesLineMatch?.[1]) {
    // Extract UUIDs from the sources line
    usedSources = [...sourcesLineMatch[1].matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)].map((m) => m[0]);
  }

  return { answer: answerText || raw, used_sources: usedSources };
}


// ─── 5. scoreReply ───────────────────────────────────────────────────────────

export async function scoreReply(
  ticket: { subject: string; body: string },
  reply: string,
  ticketId?: string
): Promise<ScoreReplyResult> {
  const model = OXLO_MODEL;
  const start = Date.now();

  const completion = await callWithRetry({
    model,
    messages: [
      {
        role: 'system',
        content: `You are a customer support quality analyst. Score the reply on a 1-10 scale (9-10 excellent, 7-8 good, 5-6 weak, <5 rewrite needed).
Output ONLY a JSON object — no prose, no markdown fences:
{"score":8,"feedback":"One or two sentences of feedback.","improvements":["improvement 1","improvement 2"]}`,
      },
      {
        role: 'user',
        content: `Ticket: ${ticket.subject}\n${ticket.body.slice(0, 250)}\n\nReply:\n${reply.slice(0, 450)}`,
      },
    ],
  });

  const durationMs = Date.now() - start;
  const usage = completion.usage;
  logUsage('qa_score', model, usage?.prompt_tokens ?? null, usage?.completion_tokens ?? null, durationMs, ticketId);

  const raw = completion.choices[0]?.message?.content ?? '{}';
  const parsed = cleanAndParseJson<ScoreReplyResult>(raw, { score: 0, feedback: '', improvements: [] });

  // Regex fallbacks
  if (!parsed.score) parsed.score = extractNumber(raw, 'score') ?? 5;
  if (!parsed.feedback) parsed.feedback = extractField(raw, 'feedback');
  if (!parsed.improvements?.length) {
    const arrMatch = raw.match(/"improvements"\s*:\s*\[([\s\S]*?)\]/);
    if (arrMatch) {
      parsed.improvements = [...arrMatch[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
    }
  }

  return parsed;
}

// ─── 6. generateHandoffNote — plain text output ───────────────────────────────

export async function generateHandoffNote(
  ticket: { subject: string; body: string },
  analysis: object,
  replyDraft?: string,
  ticketId?: string
): Promise<HandoffNoteResult> {
  const model = OXLO_MODEL;
  const start = Date.now();

  const a = analysis as Record<string, unknown>;
  const analysisSummary = `Priority: ${String(a['priority'] ?? 'unknown')}, Sentiment: ${String(a['sentiment'] ?? 'unknown')}, Risk: ${String(a['escalation_risk'] ?? 'unknown')}`;
  const draftSection = replyDraft ? `\n\nDraft reply sent:\n${replyDraft.slice(0, 250)}` : '';

  const completion = await callWithRetry({
    model,
    messages: [
      {
        role: 'system',
        content: `You are writing an escalation handoff note for the next support agent. Include: what the customer wants, urgency level, recommended next action. Be concise (3-5 sentences). Output ONLY the note text — no JSON, no markdown, no headers.`,
      },
      {
        role: 'user',
        content: `Ticket: ${ticket.subject}\n${ticket.body.slice(0, 300)}\n\nAnalysis: ${analysisSummary}${draftSection}`,
      },
    ],
  });

  const durationMs = Date.now() - start;
  const usage = completion.usage;
  logUsage('handoff', model, usage?.prompt_tokens ?? null, usage?.completion_tokens ?? null, durationMs, ticketId);

  const note = (completion.choices[0]?.message?.content ?? '').trim();
  return { note };
}

// ─── 7. generateInsights ─────────────────────────────────────────────────────

export async function generateInsights(
  tickets: Array<{
    subject: string;
    body: string;
    intent: string;
    priority: string;
    sentiment: string;
    created_at: number;
  }>
): Promise<InsightsResult> {
  const model = OXLO_MODEL;
  const start = Date.now();

  const ticketSummaries = tickets
    .map((t) => `- [${t.priority}|${t.intent}|${t.sentiment}] ${t.subject}`)
    .join('\n');

  const completion = await callWithRetry({
    model,
    messages: [
      {
        role: 'system',
        content: `You are a customer support operations analyst. Output ONLY a JSON object — no prose, no markdown fences. Use this exact structure:
{"top_issues":["issue1","issue2","issue3"],"sentiment_trend":"stable","priority_breakdown":{"critical":0,"high":0,"medium":0,"low":0},"recommended_actions":["action1","action2"],"peak_complaint_category":"string","summary":"Three sentence executive summary."}
sentiment_trend must be one of: improving, stable, declining`,
      },
      {
        role: 'user',
        content: `Analyze these ${tickets.length} tickets:\n${ticketSummaries}`,
      },
    ],
  });

  const durationMs = Date.now() - start;
  const usage = completion.usage;
  logUsage('insights', model, usage?.prompt_tokens ?? null, usage?.completion_tokens ?? null, durationMs);

  const raw = completion.choices[0]?.message?.content ?? '{}';
  const result = cleanAndParseJson<InsightsResult>(raw, {
    top_issues: [],
    sentiment_trend: 'stable',
    priority_breakdown: { critical: 0, high: 0, medium: 0, low: 0 },
    recommended_actions: [],
    peak_complaint_category: 'Unknown',
    summary: 'Insufficient data for analysis.',
  });

  // Flatten summary if model returned a nested object like {"Executive Summary":"..."}
  if (typeof result.summary === 'object' && result.summary !== null) {
    const nested = result.summary as Record<string, unknown>;
    result.summary = String(Object.values(nested)[0] ?? 'No summary available.');
  }

  // Normalize sentiment_trend to allowed values
  const validTrends = ['improving', 'stable', 'declining'] as const;
  if (!validTrends.includes(result.sentiment_trend)) {
    result.sentiment_trend = 'stable';
  }

  return result;
}


