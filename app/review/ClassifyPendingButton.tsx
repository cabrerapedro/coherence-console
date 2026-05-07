"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ClassifyPendingButton() {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPhase("running");
    setError(null);
    try {
      const res = await fetch("/api/pending-uploads", { cache: "no-store" });
      const { action_ids } = (await res.json()) as { action_ids: string[] };
      if (!action_ids || action_ids.length === 0) {
        setPhase("done");
        router.refresh();
        return;
      }
      setProgress({ done: 0, total: action_ids.length, errors: 0 });
      let done = 0;
      let errors = 0;
      for (const id of action_ids) {
        try {
          const r = await fetch("/api/classify-one", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action_id: id }),
          });
          if (!r.ok) errors++;
        } catch {
          errors++;
        }
        done++;
        setProgress({ done, total: action_ids.length, errors });
      }
      setPhase("done");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to classify pending uploads.");
      setPhase("error");
    }
  }

  if (phase === "running") {
    return (
      <Button disabled size="sm">
        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
        Classifying {progress.done}/{progress.total}…
      </Button>
    );
  }
  if (phase === "done") {
    return (
      <Button variant="outline" size="sm" onClick={run}>
        <Sparkles className="mr-1.5 size-3.5" />
        Run again
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={run}>
        <Sparkles className="mr-1.5 size-3.5" />
        Classify pending
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
