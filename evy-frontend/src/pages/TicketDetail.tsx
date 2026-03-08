import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import type { FullPipelineResult } from "@/lib/types";
import { GlassCard } from "@/components/GlassCard";
import { SkeletonGlow } from "@/components/SkeletonGlow";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Zap, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";

const tabs = ["Analysis", "AI Drafts", "RAG Knowledge", "QA Score", "Handoff Note"] as const;
type Tab = (typeof tabs)[number];

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>("Analysis");
  const [pipelineResult, setPipelineResult] = useState<FullPipelineResult | null>(null);
  const [activeDraftIdx, setActiveDraftIdx] = useState(0);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => api.getTicket(id!),
    enabled: !!id,
  });

  const runPipeline = useMutation({
    mutationFn: () => api.runPipeline(id!),
    onSuccess: (data) => setPipelineResult(data),
  });

  const rewrite = useMutation({
    mutationFn: (tone: string) => api.rewriteDraft(id!, tone),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto">
        <SkeletonGlow className="h-8 w-48" />
        <SkeletonGlow className="h-64 w-full" />
      </div>
    );
  }

  if (!ticket) return <p className="text-muted-foreground">Ticket not found.</p>;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/tickets">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold text-foreground truncate">{ticket.subject}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Source */}
        <GlassCard glow="cyan">
          <h3 className="text-xs text-accent uppercase tracking-wider mb-3 font-semibold">Source Message</h3>
          <p className="text-xs text-muted-foreground mb-2">From: {ticket.from}</p>
          <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{ticket.body}</div>
          <div className="flex gap-2 mt-4 flex-wrap">
            <Badge variant="outline" className="text-[10px]">{ticket.priority}</Badge>
            <Badge variant="outline" className="text-[10px]">{ticket.status}</Badge>
            {ticket.tags?.map((t) => (
              <Badge key={t} variant="outline" className="text-[10px] border-primary/30 text-primary">{t}</Badge>
            ))}
          </div>
        </GlassCard>

        {/* Right: AI Panel */}
        <div className="space-y-4">
          {!pipelineResult && (
            <GlassCard className="flex items-center justify-center py-12">
              <Button
                onClick={() => runPipeline.mutate()}
                disabled={runPipeline.isPending}
                className="bg-gradient-to-r from-primary to-accent text-primary-foreground px-8 py-3 rounded-xl font-semibold glow-purple hover:scale-105 transition-transform"
              >
                {runPipeline.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin-slow" />
                    Running AI Pipeline...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Run AI Pipeline
                  </span>
                )}
              </Button>
            </GlassCard>
          )}

          {pipelineResult && (
            <>
              {/* Tabs */}
              <div className="flex gap-1 flex-wrap">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
                      activeTab === tab
                        ? "bg-primary/20 border-primary/40 text-primary"
                        : "border-glass-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                  {activeTab === "Analysis" && (
                    <GlassCard glow="purple">
                      <div className="space-y-4">
                        <div>
                          <span className="text-xs text-muted-foreground uppercase">Intent</span>
                          <p className="text-sm text-foreground font-medium">{pipelineResult.analysis.intent}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground uppercase">Escalation Risk</span>
                          <p className="text-sm text-foreground font-medium">{pipelineResult.analysis.escalation_risk}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground uppercase">Executive Summary</span>
                          <p className="text-sm text-foreground leading-relaxed">{pipelineResult.analysis.executive_summary}</p>
                        </div>
                      </div>
                    </GlassCard>
                  )}

                  {activeTab === "AI Drafts" && (
                    <GlassCard>
                      <div className="flex gap-1 mb-4 flex-wrap">
                        {pipelineResult.drafts.map((d, i) => (
                          <button
                            key={i}
                            onClick={() => setActiveDraftIdx(i)}
                            className={cn(
                              "px-2.5 py-1 text-xs rounded-md border transition-all",
                              activeDraftIdx === i
                                ? "bg-accent/20 border-accent/40 text-accent"
                                : "border-glass-border text-muted-foreground"
                            )}
                          >
                            {d.tone}
                          </button>
                        ))}
                      </div>
                      <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed mb-4">
                        {pipelineResult.drafts[activeDraftIdx]?.content}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-primary/30 text-primary hover:bg-primary/10"
                        onClick={() => rewrite.mutate(pipelineResult.drafts[activeDraftIdx]?.tone)}
                        disabled={rewrite.isPending}
                      >
                        {rewrite.isPending ? "Rewriting..." : "Rewrite"}
                      </Button>
                    </GlassCard>
                  )}

                  {activeTab === "RAG Knowledge" && (
                    <GlassCard glow="green">
                      <h4 className="text-xs text-muted-foreground uppercase mb-2">KB Answer</h4>
                      <p className="text-sm text-foreground mb-4 leading-relaxed">{pipelineResult.rag.answer}</p>
                      <h4 className="text-xs text-muted-foreground uppercase mb-2">Sources</h4>
                      <div className="space-y-2">
                        {pipelineResult.rag.sources.map((s, i) => (
                          <div key={i} className="glass p-3">
                            <p className="text-xs font-semibold text-foreground">{s.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">{s.snippet}</p>
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                  )}

                  {activeTab === "QA Score" && (
                    <GlassCard>
                      <div className="flex items-center gap-6">
                        {/* Radial progress */}
                        <div className="relative h-28 w-28 shrink-0">
                          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                            <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" stroke="hsl(240,10%,16%)" />
                            <circle
                              cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                              stroke="hsl(270,80%,60%)"
                              strokeDasharray={`${(pipelineResult.qa_score.score / 10) * 264} 264`}
                              strokeLinecap="round"
                              className="drop-shadow-[0_0_8px_hsl(270,80%,60%)]"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-2xl font-bold text-primary neon-text-purple">{pipelineResult.qa_score.score}</span>
                          </div>
                        </div>
                        <div className="space-y-3 flex-1">
                          <p className="text-sm text-foreground">{pipelineResult.qa_score.feedback}</p>
                          <div>
                            <h4 className="text-xs text-muted-foreground uppercase mb-1">Improvements</h4>
                            <ul className="space-y-1">
                              {pipelineResult.qa_score.improvement_points?.map((p, i) => (
                                <li key={i} className="text-xs text-muted-foreground">• {p}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  )}

                  {activeTab === "Handoff Note" && (
                    <GlassCard glow="red">
                      <div className="space-y-3">
                        <div>
                          <span className="text-xs text-muted-foreground uppercase">Summary</span>
                          <p className="text-sm text-foreground">{pipelineResult.handoff.summary}</p>
                        </div>
                        <div className="flex gap-4">
                          <div>
                            <span className="text-xs text-muted-foreground uppercase">Priority</span>
                            <p className="text-sm text-foreground font-medium">{pipelineResult.handoff.priority}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground uppercase">Suggested Team</span>
                            <p className="text-sm text-foreground font-medium">{pipelineResult.handoff.suggested_team}</p>
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  )}
                </motion.div>
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
