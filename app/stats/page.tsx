import Link from "next/link";
import { getDatasetStats, type DatasetStats } from "@/lib/db";

export const dynamic = "force-dynamic";

const SONNET_MODEL = "anthropic/claude-sonnet-4-6";
const HAIKU_MODEL = "anthropic/claude-haiku-4-5";
// Fallback when no Sonnet calls have happened yet — keeps the "saved vs Sonnet-only"
// number meaningful before the cascade has fired even once. Conservative estimate
// based on Sonnet 4.6 list pricing × an average classifier-prompt token mix.
const SONNET_AVG_FALLBACK_USD = 0.012;

export default async function StatsPage() {
  const stats = await getDatasetStats();
  const escalationRate = stats.finalClassifications > 0
    ? stats.escalationCount / stats.finalClassifications
    : 0;
  const sonnetRow = stats.byModel.find((m) => m.model === SONNET_MODEL);
  const sonnetAvg = sonnetRow && sonnetRow.calls > 0 ? sonnetRow.avgCost : SONNET_AVG_FALLBACK_USD;
  const sonnetOnlyBaseline = sonnetAvg * stats.totalActions;
  const saved = sonnetOnlyBaseline - stats.totalCostUsd;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Coherence Console — Stats</h1>
        <Link href="/" className="text-xs opacity-60 hover:opacity-100">← home</Link>
      </header>
      <p className="mt-1 text-sm opacity-70">
        Aggregates over the hand-designed dataset (<code className="font-mono">agent_id LIKE &apos;aloha-%&apos;</code>).
      </p>

      <section className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Stat value={stats.totalActions.toString()} caption="actions in dataset" />
        <Stat value={`$${stats.totalCostUsd.toFixed(4)}`} caption="spent classifying the dataset" />
        <Stat value={`${(escalationRate * 100).toFixed(1)}%`} caption="of cases escalated from Haiku to Sonnet" />
        <Stat value={`$${saved.toFixed(2)}`} caption="saved by routing through Haiku first" />
      </section>

      <section className="mt-12">
        <h2 className="text-xs uppercase tracking-wide opacity-50">Per-model breakdown</h2>
        <ModelTable byModel={stats.byModel} />
      </section>

      <p className="mt-10 text-xs opacity-50">
        &quot;Cost saved&quot; uses the average Sonnet cost from observed escalations
        ({sonnetRow && sonnetRow.calls > 0
          ? `${sonnetRow.calls} calls, $${sonnetAvg.toFixed(6)}/call`
          : `0 observed; falling back to $${SONNET_AVG_FALLBACK_USD.toFixed(4)}/call`})
        as the per-call rate for the &quot;Sonnet-only&quot; counterfactual.
      </p>
    </main>
  );
}

function Stat({ value, caption }: { value: string; caption: string }) {
  return (
    <div className="rounded border border-current/15 p-5">
      <div className="text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-1 text-xs opacity-60">{caption}</div>
    </div>
  );
}

function ModelTable({ byModel }: { byModel: DatasetStats["byModel"] }) {
  if (byModel.length === 0) {
    return <p className="mt-3 text-sm opacity-60">No classifications yet.</p>;
  }
  return (
    <table className="mt-3 w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-current/15 text-left text-xs uppercase tracking-wide opacity-60">
          <th className="py-2 pr-4 font-medium">Model</th>
          <th className="py-2 pr-4 text-right font-medium">Calls</th>
          <th className="py-2 pr-4 text-right font-medium">Total cost</th>
          <th className="py-2 text-right font-medium">Avg cost / call</th>
        </tr>
      </thead>
      <tbody>
        {byModel.map((m) => (
          <tr key={m.model} className="border-b border-current/5">
            <td className="py-2 pr-4 font-mono">{prettyModel(m.model)}</td>
            <td className="py-2 pr-4 text-right tabular-nums">{m.calls}</td>
            <td className="py-2 pr-4 text-right tabular-nums">${m.totalCost.toFixed(4)}</td>
            <td className="py-2 text-right tabular-nums">${m.avgCost.toFixed(6)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function prettyModel(m: string): string {
  if (m === HAIKU_MODEL) return "Haiku 4.5";
  if (m === SONNET_MODEL) return "Sonnet 4.6";
  return m;
}
