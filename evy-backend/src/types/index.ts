// ─── Ticket ───────────────────────────────────────────────────────────────────

export interface Ticket {
  id: string;
  subject: string;
  body: string;
  customer_email: string | null;
  source: 'manual' | 'email' | 'chat';
  status: 'open' | 'in_progress' | 'resolved';
  created_at: number;
  updated_at: number;
}

// ─── Ticket Analysis ──────────────────────────────────────────────────────────

export type TicketIntent =
  | 'billing_issue'
  | 'technical_support'
  | 'refund_request'
  | 'account_access'
  | 'feature_request'
  | 'complaint'
  | 'general_inquiry'
  | 'shipping_issue'
  | 'bug_report'
  | 'other';

export type TicketPriority = 'critical' | 'high' | 'medium' | 'low';
export type TicketSentiment = 'positive' | 'neutral' | 'negative' | 'frustrated' | 'confused';
export type EscalationRisk = 'high' | 'medium' | 'low';
export type ReplyTone = 'professional' | 'empathetic' | 'concise' | 'technical';

export interface TicketAnalysis {
  id: string;
  ticket_id: string;
  intent: TicketIntent;
  priority: TicketPriority;
  sentiment: TicketSentiment;
  escalation_risk: EscalationRisk;
  summary: string;
  suggested_category: string;
  analysis_model: string;
  created_at: number;
}

// ─── Ticket Reply ─────────────────────────────────────────────────────────────

export interface TicketReply {
  id: string;
  ticket_id: string;
  tone: ReplyTone;
  content: string;
  model_used: string;
  created_at: number;
}

// ─── Knowledge Base ───────────────────────────────────────────────────────────

export interface KnowledgeBaseEntry {
  id: string;
  title: string;
  content: string;
  category: string | null;
  created_at: number;
}

// ─── KB Answer ────────────────────────────────────────────────────────────────

export interface TicketKBAnswer {
  id: string;
  ticket_id: string;
  answer: string;
  sources: string[];   // parsed from JSON
  model_used: string;
  created_at: number;
}

// ─── Reply Score ──────────────────────────────────────────────────────────────

export interface ReplyScore {
  id: string;
  reply_id: string;
  score: number;
  feedback: string;
  improvements: string[];  // parsed from JSON
  model_used: string;
  created_at: number;
}

// ─── Handoff Note ─────────────────────────────────────────────────────────────

export interface HandoffNote {
  id: string;
  ticket_id: string;
  note: string;
  model_used: string;
  created_at: number;
}

// ─── Usage Log ────────────────────────────────────────────────────────────────

export type OxloAction =
  | 'classify'
  | 'draft'
  | 'rewrite'
  | 'kb_answer'
  | 'qa_score'
  | 'handoff'
  | 'insights';

export interface OxloUsageLog {
  id: string;
  ticket_id: string | null;
  action: OxloAction;
  model: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  duration_ms: number | null;
  created_at: number;
}

// ─── Oxlo AI Return Types ─────────────────────────────────────────────────────

export interface ClassifyResult {
  intent: TicketIntent;
  priority: TicketPriority;
  sentiment: TicketSentiment;
  escalation_risk: EscalationRisk;
  suggested_category: string;
  summary: string;
}

export interface DraftReplyResult {
  reply: string;
}

export interface RewriteReplyResult {
  rewritten: string;
}

export interface KBAnswerResult {
  answer: string;
  used_sources: string[];
}

export interface ScoreReplyResult {
  score: number;
  feedback: string;
  improvements: string[];
}

export interface HandoffNoteResult {
  note: string;
}

export interface InsightsResult {
  top_issues: string[];
  sentiment_trend: 'improving' | 'stable' | 'declining';
  priority_breakdown: Record<TicketPriority, number>;
  recommended_actions: string[];
  peak_complaint_category: string;
  summary: string;
}

// ─── Full Pipeline Result ─────────────────────────────────────────────────────

export interface FullPipelineResult {
  ticket: Ticket;
  analysis: TicketAnalysis;
  replies: TicketReply[];
  kb_answer: TicketKBAnswer;
  score: ReplyScore;
  handoff_note: HandoffNote;
}

// ─── Analytics Stats ──────────────────────────────────────────────────────────

export interface AnalyticsStats {
  total_tickets: number;
  open: number;
  resolved: number;
  by_priority: Record<TicketPriority, number>;
  by_intent: Record<string, number>;
  avg_reply_score: number;
  total_oxlo_calls: number;
  total_tokens_used: number;
}
