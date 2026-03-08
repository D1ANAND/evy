import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { SkeletonGlow } from "@/components/SkeletonGlow";
import { Ticket, AlertCircle, CheckCircle2, Cpu } from "lucide-react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["hsl(0,72%,55%)", "hsl(45,90%,55%)", "hsl(270,80%,60%)", "hsl(185,80%,50%)"];

export default function Dashboard() {
  const { data: statsRes, isLoading: loadingStats } = useQuery({
    queryKey: ["stats"],
    queryFn: api.getStats,
  });
  const { data: insightsRes, isLoading: loadingInsights } = useQuery({
    queryKey: ["insights"],
    queryFn: api.getInsights,
  });

  const stats = statsRes?.stats;
  const insights = insightsRes?.insights;

  const kpis = stats
    ? [
        { label: "Total Tickets", value: stats.total_tickets, icon: Ticket, glow: "purple" as const },
        { label: "Open", value: stats.open, icon: AlertCircle, glow: "cyan" as const },
        { label: "Resolved", value: stats.resolved, icon: CheckCircle2, glow: "green" as const },
        { label: "Token Usage", value: (stats.total_tokens_used ?? 0).toLocaleString(), icon: Cpu, glow: "purple" as const },
      ]
    : [];

  const priorityData = stats?.by_priority
    ? Object.entries(stats.by_priority).map(([name, value]) => ({ name, value }))
    : [];
  const intentData = stats?.by_intent
    ? Object.entries(stats.by_intent).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-2xl font-bold neon-text-purple text-primary"
      >
        Command Center
      </motion.h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingStats
          ? Array.from({ length: 4 }).map((_, i) => (
              <GlassCard key={i}>
                <SkeletonGlow className="h-4 w-24 mb-3" />
                <SkeletonGlow className="h-8 w-16" />
              </GlassCard>
            ))
          : kpis.map((kpi, i) => (
              <GlassCard key={i} glow={kpi.glow} hover>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
                  <kpi.icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-3xl font-bold text-foreground">{kpi.value}</p>
              </GlassCard>
            ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard className="h-80">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Priority Breakdown</h3>
          {loadingStats ? (
            <SkeletonGlow className="h-56 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={priorityData}>
                <XAxis dataKey="name" tick={{ fill: "hsl(220,10%,55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(220,10%,55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(240,15%,8%)",
                    border: "1px solid hsl(0 0% 100% / 0.1)",
                    borderRadius: 8,
                    color: "hsl(220,20%,92%)",
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {priorityData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </GlassCard>

        <GlassCard className="h-80">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Intent Distribution</h3>
          {loadingStats ? (
            <SkeletonGlow className="h-56 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="85%">
              <PieChart>
                <Pie data={intentData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" stroke="none">
                  {intentData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(240,15%,8%)",
                    border: "1px solid hsl(0 0% 100% / 0.1)",
                    borderRadius: 8,
                    color: "hsl(220,20%,92%)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </GlassCard>
      </div>

      {/* Insights */}
      <GlassCard glow="cyan">
        <h3 className="text-sm font-semibold text-accent mb-4 uppercase tracking-wider neon-text-cyan">AI Insights</h3>
        {loadingInsights ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonGlow key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : insights ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="text-xs text-muted-foreground uppercase mb-2">Top Issues</h4>
              <ul className="space-y-1">
                {insights.top_issues?.map((issue, i) => (
                  <li key={i} className="text-sm text-foreground">• {issue}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs text-muted-foreground uppercase mb-2">Sentiment Trend</h4>
              <p className="text-sm text-foreground">{insights.sentiment_trend}</p>
            </div>
            <div>
              <h4 className="text-xs text-muted-foreground uppercase mb-2">Recommended Actions</h4>
              <ul className="space-y-1">
                {insights.recommended_actions?.map((action, i) => (
                  <li key={i} className="text-sm text-foreground">• {action}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </GlassCard>
    </div>
  );
}
