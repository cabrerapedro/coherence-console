"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileJson, Loader2, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UPLOAD } from "@/lib/ui-copy";

type Parsed =
  | { kind: "empty" }
  | { kind: "invalid"; error: string }
  | { kind: "valid"; count: number };

function parsePayload(text: string, cap: number): Parsed {
  const trimmed = text.trim();
  if (!trimmed) return { kind: "empty" };
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch (err) {
    return {
      kind: "invalid",
      error: err instanceof Error ? `Not valid JSON: ${err.message}` : "Not valid JSON.",
    };
  }
  let count = 0;
  if (Array.isArray(json)) {
    count = json.length;
  } else if (json && typeof json === "object" && Array.isArray((json as { actions?: unknown }).actions)) {
    count = (json as { actions: unknown[] }).actions.length;
  } else if (json && typeof json === "object") {
    count = 1;
  } else {
    return { kind: "invalid", error: "Body must be an action object, an array of actions, or `{ actions: [...] }`." };
  }
  if (count === 0) return { kind: "invalid", error: "No actions found in payload." };
  if (count > cap) {
    return { kind: "invalid", error: `Found ${count} actions; max is ${cap} per upload.` };
  }
  return { kind: "valid", count };
}

type UploadResult = {
  ok: boolean;
  inserted: number;
  skipped: number;
  submitted: number;
  session_id: string;
};

type Phase = "idle" | "uploading" | "classifying" | "done" | "error";

export function UploadForm({ remainingCapacity }: { remainingCapacity: number }) {
  const router = useRouter();
  const cap = Math.min(UPLOAD.cap, remainingCapacity);

  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [classifyProgress, setClassifyProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parsePayload(text, cap), [text, cap]);
  const counterText =
    parsed.kind === "valid"
      ? `${parsed.count} of ${cap}`
      : parsed.kind === "empty"
        ? `0 of ${cap}`
        : `— of ${cap}`;
  const counterColor =
    parsed.kind === "invalid"
      ? "text-destructive"
      : parsed.kind === "valid"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-muted-foreground";

  const handleFileText = useCallback(async (file: File) => {
    if (!file) return;
    if (file.size > 200_000) {
      setError("File too large. Max ~200 KB (which fits well over 20 actions).");
      return;
    }
    setError(null);
    setResult(null);
    const t = await file.text();
    setText(t);
  }, []);

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void handleFileText(f);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFileText(f);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(true);
  }

  function onDragLeave() {
    setDragActive(false);
  }

  async function classifySequentially(actionIds: string[]) {
    setClassifyProgress({ done: 0, total: actionIds.length, errors: 0 });
    let done = 0;
    let errors = 0;
    for (const id of actionIds) {
      try {
        const res = await fetch("/api/classify-one", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action_id: id }),
        });
        if (!res.ok) errors++;
      } catch {
        errors++;
      }
      done++;
      setClassifyProgress({ done, total: actionIds.length, errors });
    }
  }

  async function onSubmit() {
    if (parsed.kind !== "valid") return;
    setPhase("uploading");
    setError(null);
    setResult(null);
    try {
      const body = JSON.parse(text);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as UploadResult & { error?: string; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? data.error ?? `Server returned ${res.status}.`);
        setPhase("error");
        return;
      }
      setResult(data);

      // Fetch the IDs we just inserted (the API returns counts but not IDs — we
      // re-derive them from /api/upload-list for the current session's most-recent rows).
      // Simpler: ask the server for the unclassified IDs scoped to our session.
      const pendingRes = await fetch(`/api/pending-uploads`, { cache: "no-store" });
      const pendingData = (await pendingRes.json()) as { action_ids: string[] };
      const ids = pendingData.action_ids ?? [];
      if (ids.length === 0) {
        setPhase("done");
        return;
      }
      setPhase("classifying");
      await classifySequentially(ids);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setPhase("error");
    }
  }

  if (phase === "done" && result) {
    return (
      <div className="space-y-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4" />
          {UPLOAD.successPrefix} {result.inserted} of {result.submitted} action
          {result.submitted === 1 ? "" : "s"} · classified {classifyProgress.done -
            classifyProgress.errors}{" "}
          / {classifyProgress.total}
          {classifyProgress.errors > 0 && (
            <span className="text-amber-700 dark:text-amber-400">
              {" "}
              · {classifyProgress.errors} error{classifyProgress.errors === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {result.skipped > 0 && (
          <p className="text-sm text-muted-foreground">
            {result.skipped} duplicate{result.skipped === 1 ? "" : "s"} (same agent_id +
            timestamp) skipped.
          </p>
        )}
        <div className="flex gap-3 pt-2">
          <Button onClick={() => router.push("/review?source=upload")}>Open in review</Button>
          <Button
            variant="outline"
            onClick={() => {
              setResult(null);
              setText("");
              setPhase("idle");
              setClassifyProgress({ done: 0, total: 0, errors: 0 });
            }}
          >
            Upload another batch
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          "rounded-lg border-2 border-dashed border-border bg-secondary/30 p-6 text-center transition-colors",
          dragActive && "border-foreground/40 bg-secondary/60",
        )}
      >
        <FileJson className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Drag a <code className="font-mono text-foreground">.json</code> file here, or
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="mt-2"
        >
          <Upload className="mr-1.5 size-3.5" />
          Choose file
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={onFileChange}
          className="hidden"
        />
        <p className="mt-3 text-xs text-muted-foreground">
          or paste JSON directly below.{" "}
          <a
            href="/sample_upload.json"
            download="sample_upload.json"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Download sample
          </a>
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        placeholder='[\n  { "agent_id": "your-agent", "timestamp": "...", "input": "...", "context": "...", "output": "...", "tool_calls": [], "autonomy_level": 1 }\n]'
        className="h-64 w-full resize-y rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
        spellCheck={false}
        disabled={phase === "uploading" || phase === "classifying"}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span className={cn("font-mono tabular-nums", counterColor)}>{counterText}</span>
          <span className="text-xs text-muted-foreground">actions</span>
          {parsed.kind === "valid" && (
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          )}
          {parsed.kind === "invalid" && (
            <XCircle className="size-4 text-destructive" />
          )}
        </div>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={parsed.kind !== "valid" || phase === "uploading" || phase === "classifying"}
        >
          {phase === "uploading" && (
            <>
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              Uploading…
            </>
          )}
          {phase === "classifying" && (
            <>
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              Classifying {classifyProgress.done}/{classifyProgress.total}…
            </>
          )}
          {phase !== "uploading" && phase !== "classifying" && (
            <>
              <Upload className="mr-1.5 size-3.5" />
              Upload {parsed.kind === "valid" ? `${parsed.count} action${parsed.count === 1 ? "" : "s"}` : ""}
            </>
          )}
        </Button>
      </div>

      {parsed.kind === "invalid" && (
        <p className="text-sm text-destructive" role="alert">
          {parsed.error}
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
