import { cn } from "@/lib/utils";

export function Wordmark({ className, light }: { className?: string; light?: boolean }) {
  return (
    <div className={cn("flex items-baseline gap-2 leading-none", className)}>
      <span className={cn("font-semibold tracking-[-0.045em]", light ? "text-foam" : "text-coke")}>
        Coke
      </span>
      <span className={cn("font-medium tracking-[0.04em]", light ? "text-foam/90" : "text-ink")}>
        Music
      </span>
    </div>
  );
}
