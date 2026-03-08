import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { SkeletonGlow } from "@/components/SkeletonGlow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function KnowledgeBase() {
  const queryClient = useQueryClient();
  const { data: articles, isLoading } = useQuery({
    queryKey: ["knowledge"],
    queryFn: api.getKnowledge,
  });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "" });

  const create = useMutation({
    mutationFn: () => api.createKnowledge(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      setShowModal(false);
      setForm({ title: "", content: "", category: "" });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteKnowledge(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["knowledge"] }),
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-bold neon-text-purple text-primary">
          Knowledge Base
        </motion.h1>
        <Button
          onClick={() => setShowModal(true)}
          className="bg-gradient-to-r from-primary to-accent text-primary-foreground glow-purple hover:scale-105 transition-transform"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Article
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <GlassCard key={i}><SkeletonGlow className="h-32 w-full" /></GlassCard>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles?.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <GlassCard hover className="flex flex-col justify-between h-full">
                <div>
                  <span className="text-[10px] uppercase text-accent tracking-widest">{a.category}</span>
                  <h3 className="text-sm font-semibold text-foreground mt-1">{a.title}</h3>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-4">{a.content}</p>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                    onClick={() => remove.mutate(a.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong p-6 w-full max-w-md mx-4 space-y-4 glow-purple"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">New Article</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowModal(false)} className="text-muted-foreground">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Input
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="bg-secondary/50 border-glass-border"
              />
              <Input
                placeholder="Category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="bg-secondary/50 border-glass-border"
              />
              <Textarea
                placeholder="Content"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={5}
                className="bg-secondary/50 border-glass-border"
              />
              <Button
                onClick={() => create.mutate()}
                disabled={create.isPending || !form.title}
                className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground"
              >
                {create.isPending ? "Creating..." : "Create Article"}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
