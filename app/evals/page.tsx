import Link from "next/link";
import { getEvalRuns, type EvalRun } from "@/lib/db";

export const dynamic = "force-dynamic";

const SYNTHETIC_NOTE_PREFIX = "v1 baseline — synthetic";
const HAIKU_MODEL = "anthropic/claude-haiku-4-5";
const SONNET_MODEL = "anthropic/claude-sonnet-4-6";

export default async function EvalsPage() {
  const runs = await getEvalRuns();
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Eval Runs — Coherence Console</h1>
        <Link href="/" className="text-xs opacity-60 hover:opacity-100">← home</Link>
      </header>
      <p className="mt-1 text-sm opacity-70">
        Run <code className="font-mono">npm run eval</code> from the CLI to record a new run.
      </p>

      {runs.length === 0 ? (
        <p className="mt-10 text-sm opacity-60">No eval runs recorded yet.</p>
      ) : (
        <RunsTable runs={runs} />
      )}
    </main>
  );
}

function RunsTable({ runs }: { runs: EvalRun[] }) {
  return (
    <table className="mt-8 w-full border-collapse text-xs">
      <thead>
        <tr className="border-b border-current/15 text-left uppercase tracking-wide opacity-60">
          <th className="py-2 pr-3 font-medium">Timestamp</th>
          <th className="py-2 pr-3 font-medium">Version</th>
          <th className="py-2 pr-3 font-medium">Primary</th>
          <th className="py-2 pr-3 font-medium">Escalation</th>
          <th className="py-2 pr-3 text-right font-medium">Accuracy</th>
          <th className="py-2 pr-3 text-right font-medium">Precision</th>
          <th className="py-2 pr-3 text-right font-medium">Recall</th>
          <th className="py-2 pr-3 text-right font-medium">Total cost</th>
          <th className="py-2 pr-3 text-right font-medium">Esc rate</th>
          <th className="py-2 font-medium">Notes</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((r, i) => {
          const synthetic = (r.notes ?? "").startsWith(SYNTHETIC_NOTE_PREFIX);
          const newer = i > 0 ? runs[i - 1] : null;
          const delta = i > 0 && newer ? Number(r.accuracy) - Number(newer.accuracy) : null;
          const isLatest = i === 0;
          return (
            <tr
              key={r.id}
              className={`border-b border-current/5 ${isLatest ? "bg-current/[0.04]" : ""}`}
            >
              <td className="py-2 pr-3 font-mono opacity-80">{formatTimestamp(r.created_at)}</td>
              <td className="py-2 pr-3 font-mono">{r.classifier_version}</td>
              <td className="py-2 pr-3 font-mono">{prettyModel(r.model_primary)}</td>
              <td className="py-2 pr-3 font-mono">{prettyModel(r.model_escalation)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {synthetic ? "—" : Number(r.accuracy).toFixed(3)}
                {!synthetic && delta !== null && <DeltaSpan value={delta} />}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {synthetic ? "—" : Number(r.precision_score).toFixed(3)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {synthetic ? "—" : Number(r.recall_score).toFixed(3)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                ${Number(r.total_cost_usd).toFixed(4)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {(Number(r.escalation_rate) * 100).toFixed(1)}%
              </td>
              <td className="py-2 max-w-xs opacity-70">{r.notes ?? ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function DeltaSpan({ value }: { value: number }) {
  if (Math.abs(value) < 0.0005) return <span className="ml-1 opacity-50">(±0)</span>;
  const sign = value > 0 ? "+" : "−";
  const color = value > 0 ? "text-green-600" : "text-red-600";
  return (
    <span className={`ml-1 ${color}`}>
      ({sign}
      {Math.abs(value).toFixed(3)})
    </span>
  );
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
}

function prettyModel(m: string | null): string {
  if (!m) return "—";
  if (m === HAIKU_MODEL) return "Haiku 4.5";
  if (m === SONNET_MODEL) return "Sonnet 4.6";
  return m;
}
