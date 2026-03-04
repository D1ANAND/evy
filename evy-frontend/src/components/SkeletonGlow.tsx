import { cn } from "@/lib/utils";

export function SkeletonGlow({ className }: { className?: string }) {
  return <div className={cn("skeleton-glow", className)} />;
}
