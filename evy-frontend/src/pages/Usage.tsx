import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { SkeletonGlow } from "@/components/SkeletonGlow";
import { motion } from "framer-motion";

export default function Usage() {
  const { data: records, isLoading } = useQuery({
    queryKey: ["usage"],
    queryFn: api.getUsage,
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-bold neon-text-cyan text-accent">
        Token Terminal
      </motion.h1>

      <GlassCard className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-glass-border">
              {["Action", "Model", "Prompt Tokens", "Completion Tokens", "Duration (ms)", "Timestamp"].map((h) => (
                <th key={h} className="px-4 py-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-glass-border">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><SkeletonGlow className="h-4 w-20" /></td>
                    ))}
                  </tr>
                ))
              : records?.map((r, i) => (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-glass-border hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-primary font-mono">{r.action}</td>
                    <td className="px-4 py-3 text-xs text-foreground font-mono">{r.model}</td>
                    <td className="px-4 py-3 text-xs text-accent font-mono">{r.prompt_tokens}</td>
                    <td className="px-4 py-3 text-xs text-accent font-mono">{r.completion_tokens}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{r.duration_ms}ms</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                    </td>
                  </motion.tr>
                ))}
          </tbody>
        </table>
        {!isLoading && records?.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-12">No usage records yet.</p>
        )}
      </GlassCard>
    </div>
  );
}
