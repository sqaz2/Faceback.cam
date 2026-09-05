import { cn } from "@/lib/utils";

export function Wordmark({ className, light }: { className?: string; light?: boolean }) {
  return (
    <div className={cn("flex items-baseline leading-none", className)}>
      <span className={cn("font-semibold tracking-[-0.045em]", light ? "text-foam" : "text-ink")}>
        FACEBACK
      </span>
      <span className="font-semibold tracking-[-0.045em] text-coke">
        .CAM
      </span>
    </div>
  );
}
