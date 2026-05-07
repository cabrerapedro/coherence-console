import { Sparkles, Terminal } from "lucide-react";
import { Nav } from "@/components/Nav";
import { HelpTip } from "@/components/HelpTip";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getEvalRuns, type EvalRun } from "@/lib/db";
import { PAGES, TOOLTIPS } from "@/lib/ui-copy";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SYNTHETIC_NOTE_PREFIX = "v1 baseline — synthetic";
const HAIKU_MODEL = "anthropic/claude-haiku-4-5";
const SONNET_MODEL = "anthropic/claude-sonnet-4-6";

export default async function EvalsPage() {
  const runs = await getEvalRuns();
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{PAGES.evals.title}</h1>
          <p className="text-sm text-muted-foreground">{PAGES.evals.subtitle}</p>
        </header>

        <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground">
          <Terminal className="size-3.5" />
          <span>
            Run <code className="font-mono text-foreground">npm run eval</code> from the CLI to record a new run.
          </span>
        </div>

        {runs.length === 0 ? (
          <Card className="mt-8">
            <CardContent className="px-6 py-10 text-center text-sm text-muted-foreground">
              No eval runs recorded yet.
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-6 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[170px]">Timestamp</TableHead>
                  <TableHead className="w-[70px]">Version</TableHead>
                  <TableHead>Models</TableHead>
                  <TableHead className="text-right">
                    <ColHeader label="Accuracy" tip={TOOLTIPS.evalAccuracy} />
                  </TableHead>
                  <TableHead className="text-right">
                    <ColHeader label="Precision" tip={TOOLTIPS.evalPrecision} />
                  </TableHead>
                  <TableHead className="text-right">
                    <ColHeader label="Recall" tip={TOOLTIPS.evalRecall} />
                  </TableHead>
                  <TableHead className="text-right">Total cost</TableHead>
                  <TableHead className="text-right">
                    <ColHeader label="Esc rate" tip={TOOLTIPS.evalEscalationRate} />
                  </TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r, i) => {
                  const synthetic = (r.notes ?? "").startsWith(SYNTHETIC_NOTE_PREFIX);
                  const newer = i > 0 ? runs[i - 1] : null;
                  const delta = i > 0 && newer ? Number(r.accuracy) - Number(newer.accuracy) : null;
                  const isLatest = i === 0;
                  return (
                    <TableRow key={r.id} className={cn(isLatest && "bg-secondary/40")}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatTimestamp(r.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {r.classifier_version}
                        </Badge>
                        {isLatest && (
                          <Badge className="ml-1 bg-emerald-500/15 font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                            latest
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <ModelPair primary={r.model_primary} escalation={r.model_escalation} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {synthetic ? (
                          <SyntheticDash />
                        ) : (
                          <>
                            {Number(r.accuracy).toFixed(3)}
                            {delta !== null && <DeltaSpan value={delta} />}
                          </>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {synthetic ? <SyntheticDash /> : Number(r.precision_score).toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {synthetic ? <SyntheticDash /> : Number(r.recall_score).toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        ${Number(r.total_cost_usd).toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(Number(r.escalation_rate) * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell className="max-w-md text-xs text-muted-foreground">
                        {synthetic && (
                          <Badge className="mr-1 mb-1 inline-flex items-center gap-1 bg-amber-500/15 font-mono text-[10px] text-amber-700 dark:text-amber-400">
                            <Sparkles className="size-3" />
                            synthetic baseline
                          </Badge>
                        )}
                        {r.notes ?? ""}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </main>
    </>
  );
}

function ColHeader({ label, tip }: { label: string; tip: string }) {
  return (
    <span className="inline-flex items-center justify-end gap-1">
      {label}
      <HelpTip side="top">{tip}</HelpTip>
    </span>
  );
}

function ModelPair({ primary, escalation }: { primary: string; escalation: string | null }) {
  return (
    <span className="flex flex-col gap-0.5 font-mono">
      <span className="text-foreground">{prettyModel(primary)}</span>
      {escalation && (
        <span className="text-muted-foreground">→ {prettyModel(escalation)}</span>
      )}
    </span>
  );
}

function DeltaSpan({ value }: { value: number }) {
  if (Math.abs(value) < 0.0005) {
    return <span className="ml-1 text-xs text-muted-foreground">±0</span>;
  }
  const positive = value > 0;
  const sign = positive ? "+" : "−";
  const color = positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  return (
    <span className={`ml-1 text-xs ${color}`}>
      ({sign}
      {Math.abs(value).toFixed(3)})
    </span>
  );
}

function SyntheticDash() {
  return (
    <span className="inline-flex items-center justify-end gap-1 text-muted-foreground">
      —
      <HelpTip side="left">{TOOLTIPS.evalSyntheticBadge}</HelpTip>
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
