export interface Ticket {
  id: string;
  subject: string;
  body: string;
  from: string;
  status: string;
  priority: string;
  intent: string;
  sentiment: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface AnalyticsStats {
  total_tickets: number;
  open: number;
  resolved: number;
  total_tokens_used: number;
  total_oxlo_calls: number;
  avg_reply_score: number;
  by_priority: Record<string, number>;
  by_intent: Record<string, number>;
}

export interface AnalyticsInsights {
  top_issues: string[];
  sentiment_trend: string;
  recommended_actions: string[];
  peak_complaint_category: string;
  summary: string;
  priority_breakdown: Record<string, number>;
}

export interface PipelineAnalysis {
  intent: string;
  escalation_risk: string;
  executive_summary: string;
}

export interface DraftReply {
  tone: string;
  content: string;
}

export interface RAGResult {
  answer: string;
  sources: { title: string; snippet: string }[];
}

export interface QAScore {
  score: number;
  feedback: string;
  improvement_points: string[];
}

export interface HandoffNote {
  summary: string;
  priority: string;
  suggested_team: string;
}

export interface FullPipelineResult {
  analysis: PipelineAnalysis;
  drafts: DraftReply[];
  rag: RAGResult;
  qa_score: QAScore;
  handoff: HandoffNote;
}

export interface UsageRecord {
  id: string;
  action: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  duration_ms: number;
  created_at: string;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
}
