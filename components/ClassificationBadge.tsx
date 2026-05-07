import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "correct" | "incorrect" | "needs_review";

const STYLES: Record<Variant, { wrapper: string; icon: React.ComponentType<{ className?: string }> }> = {
  correct: {
    wrapper:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    icon: CheckCircle2,
  },
  incorrect: {
    wrapper:
      "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
    icon: XCircle,
  },
  needs_review: {
    wrapper:
      "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    icon: HelpCircle,
  },
};

export function ClassificationBadge({
  value,
  size = "default",
}: {
  value: Variant;
  size?: "sm" | "default";
}) {
  const { wrapper, icon: Icon } = STYLES[value];
  const sizing = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-mono font-medium uppercase tracking-wide",
        wrapper,
        sizing,
      )}
    >
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} />
      {value.replace("_", " ")}
    </span>
  );
}
