"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, HelpCircle, ThumbsUp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TOOLTIPS } from "@/lib/ui-copy";
import { cn } from "@/lib/utils";

type Label = "correct" | "incorrect" | "needs_review";

type Props = {
  action_id: string;
  current_index: number;
  total_count: number;
  classifier_verdict: Label;
  existing_label: Label | null;
  source: "demo" | "upload";
};

const BUTTONS: {
  key: string;
  label: string;
  value: Label | "confirm";
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
}[] = [
  { key: "1", label: "Confirm classifier", value: "confirm", icon: ThumbsUp, tooltip: TOOLTIPS.btnConfirm },
  { key: "2", label: "Override → correct", value: "correct", icon: Check, tooltip: TOOLTIPS.btnOverrideCorrect },
  { key: "3", label: "Override → incorrect", value: "incorrect", icon: X, tooltip: TOOLTIPS.btnOverrideIncorrect },
  { key: "4", label: "Mark needs_review", value: "needs_review", icon: HelpCircle, tooltip: TOOLTIPS.btnNeedsReview },
];

export default function ReviewActions(props: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sourceQuery = props.source === "upload" ? "&source=upload" : "";

  // Reset transient UI state whenever the user moves to a different action
  // (button click, keyboard nav, direct URL change). Without this, the
  // `submitting` flag from the previous click stays "stuck" because Next.js
  // soft-navigates and reuses this client component instance — every key
  // press after the first would early-return on the `submitting` guard.
  useEffect(() => {
    setSubmitting(null);
    setError(null);
  }, [props.action_id]);

  // Warm up adjacent pages so arrow nav and post-submit transitions feel
  // closer to instant. The /review route reads cookies so the dynamic data
  // can't be statically cached, but the prefetch payload still saves a
  // round trip on the next click.
  useEffect(() => {
    if (props.current_index > 0) {
      router.prefetch(`/review?index=${props.current_index - 1}${sourceQuery}`);
    }
    if (props.current_index + 1 < props.total_count) {
      router.prefetch(`/review?index=${props.current_index + 1}${sourceQuery}`);
    }
  }, [props.current_index, props.total_count, sourceQuery, router]);

  async function submit(value: Label | "confirm") {
    if (submitting) return;
    setError(null);
    const human_label: Label = value === "confirm" ? props.classifier_verdict : value;
    setSubmitting(value);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action_id: props.action_id, human_label }),
      });
      if (!res.ok) {
        setError(`Server returned ${res.status}`);
        setSubmitting(null);
        return;
      }
      const next = Math.min(props.current_index + 1, props.total_count - 1);
      router.push(`/review?index=${next}${sourceQuery}`);
      // No router.refresh() — router.push already triggers an RSC fetch for
      // the new route, and the action_id change effect above clears state.
    } catch (err) {
      setError(err instanceof Error ? err.message : "request failed");
      setSubmitting(null);
    }
  }

  function navigate(delta: -1 | 1) {
    const next = props.current_index + delta;
    if (next < 0 || next >= props.total_count) return;
    router.push(`/review?index=${next}${sourceQuery}`);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigate(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        navigate(1);
      } else {
        const btn = BUTTONS.find((b) => b.key === e.key);
        if (btn) {
          e.preventDefault();
          void submit(btn.value);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.current_index, props.action_id, props.source, submitting]);

  return (
    <div className="space-y-3">
      {props.existing_label && (
        <p className="text-xs text-muted-foreground">
          Already labeled as{" "}
          <span className="font-mono font-semibold text-foreground">{props.existing_label}</span>
          . Re-clicking will overwrite.
        </p>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {BUTTONS.map((b) => (
          <Tooltip key={b.key}>
            <TooltipTrigger
              type="button"
              onClick={() => submit(b.value)}
              disabled={submitting !== null}
              className={cn(
                "group/btn inline-flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-left text-sm transition-colors",
                "hover:border-foreground/30 hover:bg-accent disabled:pointer-events-none disabled:opacity-50",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                props.existing_label && "opacity-90",
              )}
            >
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex size-5 items-center justify-center rounded border border-border bg-secondary font-mono text-[10px] text-muted-foreground group-hover/btn:bg-background">
                  {b.key}
                </span>
                <b.icon className="size-3.5 text-muted-foreground" />
                <span>{b.label}</span>
              </span>
              {submitting === b.value && (
                <span className="text-xs text-muted-foreground">…</span>
              )}
            </TooltipTrigger>
            <TooltipContent side="top">{b.tooltip}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        <span className="font-mono">1</span>/<span className="font-mono">2</span>/
        <span className="font-mono">3</span>/<span className="font-mono">4</span> to label,{" "}
        <span className="font-mono">←</span>/<span className="font-mono">→</span> to navigate without labeling.
      </p>
    </div>
  );
}
