import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { SkeletonGlow } from "@/components/SkeletonGlow";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";

const priorityColor: Record<string, string> = {
  critical: "bg-destructive/20 text-destructive border-destructive/40",
  high: "bg-warning/20 text-warning border-warning/40",
  medium: "bg-primary/20 text-primary border-primary/40",
  low: "bg-accent/20 text-accent border-accent/40",
};

const statusFilters = ["All", "open", "in_progress", "resolved"];

export default function Tickets() {
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["tickets"],
    queryFn: api.getTickets,
  });
  const [filter, setFilter] = useState("All");

  const filtered = tickets?.filter((t) => filter === "All" || t.status === filter);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-bold neon-text-purple text-primary">
        Ticket Queue
      </motion.h1>

      <div className="flex gap-2 flex-wrap">
        {statusFilters.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
              filter === s
                ? "bg-primary/20 border-primary/40 text-primary glow-purple"
                : "border-glass-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
            )}
          >
            {s === "All" ? "All" : s.replace("_", " ")}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <GlassCard key={i}><SkeletonGlow className="h-16 w-full" /></GlassCard>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered?.map((ticket, i) => (
            <motion.div key={ticket.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link to={`/tickets/${ticket.id}`}>
                <GlassCard hover className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground truncate">{ticket.subject}</h3>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{ticket.from}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={cn("text-[10px] uppercase", priorityColor[ticket.priority?.toLowerCase()] || "")}>
                      {ticket.priority}
                    </Badge>
                    {ticket.intent && (
                      <Badge variant="outline" className="text-[10px] border-accent/30 text-accent">
                        {ticket.intent}
                      </Badge>
                    )}
                    {ticket.sentiment && (
                      <Badge variant="outline" className="text-[10px] border-glass-border text-muted-foreground">
                        {ticket.sentiment}
                      </Badge>
                    )}
                  </div>
                </GlassCard>
              </Link>
            </motion.div>
          ))}
          {filtered?.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-12">No tickets found.</p>
          )}
        </div>
      )}
    </div>
  );
}
