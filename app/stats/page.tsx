import { Database, DollarSign, Split, PiggyBank, type LucideIcon } from "lucide-react";
import { Nav } from "@/components/Nav";
import { HelpTip } from "@/components/HelpTip";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDatasetStats, type DatasetStats } from "@/lib/db";
import { PAGES, TOOLTIPS } from "@/lib/ui-copy";

export const dynamic = "force-dynamic";

const SONNET_MODEL = "anthropic/claude-sonnet-4-6";
const HAIKU_MODEL = "anthropic/claude-haiku-4-5";
// Fallback when no Sonnet calls have happened yet — keeps the "saved vs Sonnet-only"
// number meaningful before the cascade has fired even once. Conservative estimate
// based on Sonnet 4.6 list pricing × an average classifier-prompt token mix.
const SONNET_AVG_FALLBACK_USD = 0.012;

export default async function StatsPage() {
  const stats = await getDatasetStats();
  const escalationRate =
    stats.finalClassifications > 0 ? stats.escalationCount / stats.finalClassifications : 0;
  const sonnetRow = stats.byModel.find((m) => m.model === SONNET_MODEL);
  const sonnetAvg = sonnetRow && sonnetRow.calls > 0 ? sonnetRow.avgCost : SONNET_AVG_FALLBACK_USD;
  const sonnetOnlyBaseline = sonnetAvg * stats.totalActions;
  const saved = sonnetOnlyBaseline - stats.totalCostUsd;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{PAGES.stats.title}</h1>
          <p className="text-sm text-muted-foreground">{PAGES.stats.subtitle}</p>
        </header>

        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Database}
            value={stats.totalActions.toString()}
            label="actions in dataset"
            tip={TOOLTIPS.totalActions}
          />
          <StatCard
            icon={DollarSign}
            value={`$${stats.totalCostUsd.toFixed(4)}`}
            label="spent classifying"
            tip={TOOLTIPS.totalCost}
          />
          <StatCard
            icon={Split}
            value={`${(escalationRate * 100).toFixed(1)}%`}
            label="escalated to Sonnet"
            tip={TOOLTIPS.escalationRate}
          />
          <StatCard
            icon={PiggyBank}
            value={`$${saved.toFixed(2)}`}
            label="saved vs Sonnet-only"
            tip={TOOLTIPS.costSaved}
            accent
          />
        </section>

        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Per-model breakdown
            </h2>
            <span className="text-xs text-muted-foreground">
              counted on the authoritative verdict per action
            </span>
          </div>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Total cost</TableHead>
                  <TableHead className="text-right">Avg cost / call</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.byModel.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-muted-foreground">
                      No classifications yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  stats.byModel.map((m) => (
                    <TableRow key={m.model}>
                      <TableCell className="font-mono">{prettyModel(m.model)}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.calls}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        ${m.totalCost.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        ${m.avgCost.toFixed(6)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </section>

        <p className="mt-6 text-xs text-muted-foreground">
          &quot;Saved vs Sonnet-only&quot; uses{" "}
          {sonnetRow && sonnetRow.calls > 0
            ? `the average Sonnet cost from ${sonnetRow.calls} observed escalation${sonnetRow.calls === 1 ? "" : "s"} ($${sonnetAvg.toFixed(6)}/call)`
            : `a fallback of $${SONNET_AVG_FALLBACK_USD.toFixed(4)}/call (no Sonnet calls observed yet)`}{" "}
          as the per-call rate for the &quot;Sonnet-only&quot; counterfactual.
        </p>
      </main>
    </>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  tip,
  accent = false,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  tip: string;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? "border-foreground/20" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <span className="inline-flex size-8 items-center justify-center rounded-md bg-secondary text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <HelpTip>{tip}</HelpTip>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function prettyModel(m: string): string {
  if (m === HAIKU_MODEL) return "Haiku 4.5";
  if (m === SONNET_MODEL) return "Sonnet 4.6";
  return m;
}
