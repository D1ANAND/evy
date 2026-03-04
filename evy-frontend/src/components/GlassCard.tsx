import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: "purple" | "cyan" | "green" | "red" | "none";
  hover?: boolean;
}

const glowMap = {
  purple: "glow-purple",
  cyan: "glow-cyan",
  green: "glow-green",
  red: "glow-red",
  none: "",
};

export function GlassCard({ children, className, glow = "none", hover = false }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={hover ? { scale: 1.02, transition: { duration: 0.2 } } : undefined}
      className={cn("glass p-5", glowMap[glow], className)}
    >
      {children}
    </motion.div>
  );
}
