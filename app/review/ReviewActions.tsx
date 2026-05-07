"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Label = "correct" | "incorrect" | "needs_review";

type Props = {
  action_id: string;
  current_index: number;
  total_count: number;
  classifier_verdict: Label;
  existing_label: Label | null;
};

const BUTTONS: { key: string; label: string; value: Label | "confirm" }[] = [
  { key: "1", label: "Confirm classifier", value: "confirm" },
  { key: "2", label: "Override → correct", value: "correct" },
  { key: "3", label: "Override → incorrect", value: "incorrect" },
  { key: "4", label: "Mark needs_review", value: "needs_review" },
];

export default function ReviewActions(props: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      router.push(`/review?index=${next}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "request failed");
      setSubmitting(null);
    }
  }

  function navigate(delta: -1 | 1) {
    const next = props.current_index + delta;
    if (next < 0 || next >= props.total_count) return;
    router.push(`/review?index=${next}`);
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
  }, [props.current_index, props.action_id, submitting]);

  const dim = props.existing_label !== null;

  return (
    <section className="mt-6">
      {props.existing_label && (
        <p className="mb-3 text-xs opacity-70">
          Already labeled as <strong className="font-mono">{props.existing_label}</strong>. Re-clicking
          will overwrite.
        </p>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {BUTTONS.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => submit(b.value)}
            disabled={submitting !== null}
            className={`rounded border border-current/30 px-4 py-2 text-left text-sm transition hover:bg-current/[0.05] disabled:opacity-40 ${dim ? "opacity-70" : ""}`}
          >
            <span className="mr-2 inline-block w-5 rounded bg-current/10 text-center font-mono text-xs">
              {b.key}
            </span>
            {b.label}
            {submitting === b.value && <span className="ml-2 opacity-60">…</span>}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      <p className="mt-3 text-xs opacity-50">
        Keyboard: <kbd>1</kbd>/<kbd>2</kbd>/<kbd>3</kbd>/<kbd>4</kbd> to label, <kbd>←</kbd>/<kbd>→</kbd> to navigate.
      </p>
    </section>
  );
}
