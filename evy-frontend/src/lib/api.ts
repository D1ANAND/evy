import type {
  AnalyticsStats,
  AnalyticsInsights,
  Ticket,
  FullPipelineResult,
  UsageRecord,
  KnowledgeArticle,
} from "./types";

const BASE = "https://evy-4yly.onrender.com/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export const api = {
  // These return wrapped responses - { stats: ... } and { insights: ... }
  getStats: () => get<{ stats: AnalyticsStats }>("/analytics/stats"),
  getInsights: () => get<{ insights: AnalyticsInsights; generated_at: number }>("/analytics/insights"),
  getTickets: () => get<{ tickets: Ticket[] }>("/tickets").then(res => res.tickets),
  getTicket: (id: string) => get<{ ticket: Ticket }>(`/tickets/${id}`).then(res => res.ticket),
  runPipeline: (id: string) => post<any>(`/pipeline/${id}/run`).then(res => ({
    analysis: {
      intent: res.analysis?.intent || "",
      escalation_risk: res.analysis?.escalation_risk || "",
      executive_summary: res.analysis?.summary || "",
    },
    drafts: res.replies?.map((r: any) => ({ tone: r.tone, content: r.content })) || [],
    rag: {
      answer: res.kb_answer?.answer || "",
      sources: res.kb_answer?.sources?.map((s: string) => ({ title: "KB Article", snippet: `Source ID: ${s}` })) || [],
    },
    qa_score: {
      score: res.score?.score || 0,
      feedback: res.score?.feedback || "",
      improvement_points: (typeof res.score?.improvements === 'string' ? JSON.parse(res.score.improvements) : res.score?.improvements) || [],
    },
    handoff: {
      summary: res.handoff_note?.note || "",
      priority: res.analysis?.priority || "medium",
      suggested_team: res.analysis?.suggested_category || "General Support",
    }
  }) as FullPipelineResult),
  rewriteDraft: (id: string, tone?: string) => post<{ content: string }>(`/pipeline/${id}/rewrite`, tone ? { tone } : undefined),
  getUsage: () => get<{ usage: UsageRecord[] }>("/usage").then(res => res.usage),
  getKnowledge: () => get<{ entries: KnowledgeArticle[] }>("/knowledge").then(res => res.entries),
  createKnowledge: (data: { title: string; content: string; category: string }) => post<{ entry: KnowledgeArticle }>("/knowledge", data).then(res => res.entry),
  deleteKnowledge: (id: string) => del(`/knowledge/${id}`),
};
