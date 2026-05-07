import Link from "next/link";
import { cookies } from "next/headers";
import { ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import { Nav } from "@/components/Nav";
import { HelpTip } from "@/components/HelpTip";
import { ClassificationBadge } from "@/components/ClassificationBadge";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  getDatasetActionAtIndex,
  getDatasetActionCount,
  getReviewedCount,
  getFinalClassification,
  getGoldenLabel,
  getUnclassifiedCountForPrefix,
  uploadPrefixForSession,
  DEMO_PREFIX,
  type AgentAction,
  type ActionSource,
  type ClassificationRow,
  type GoldenLabel,
} from "@/lib/db";
import { PAGES, TOOLTIPS } from "@/lib/ui-copy";
import { UPLOAD_SESSION_COOKIE } from "@/middleware";
import ReviewActions from "./ReviewActions";
import { ClassifyPendingButton } from "./ClassifyPendingButton";

const HAIKU_MODEL = "anthropic/claude-haiku-4-5";
const SONNET_MODEL = "anthropic/claude-sonnet-4-6";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ index?: string; source?: string }>;
}) {
  const params = await searchParams;
  const source: ActionSource = params.source === "upload" ? "upload" : "demo";
  const index = Math.max(0, parseInt(params.index ?? "0", 10) || 0);

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(UPLOAD_SESSION_COOKIE)?.value ?? "";
  const sessionPrefix = sessionId ? uploadPrefixForSession(sessionId) : "upload-__none__-";
  const activePrefix = source === "demo" ? DEMO_PREFIX : sessionPrefix;

  const [action, demoCount, uploadCount, reviewedCount, pendingUploadCount] = await Promise.all([
    getDatasetActionAtIndex(index, activePrefix),
    getDatasetActionCount(DEMO_PREFIX),
    getDatasetActionCount(sessionPrefix),
    getReviewedCount(activePrefix),
    source === "upload" ? getUnclassifiedCountForPrefix(sessionPrefix) : Promise.resolve(0),
  ]);
  const totalCount = source === "demo" ? demoCount : uploadCount;
  const reviewedPct = totalCount > 0 ? Math.round((reviewedCount / totalCount) * 100) : 0;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{PAGES.review.title}</h1>
          <p className="text-sm text-muted-foreground">{PAGES.review.subtitle}</p>
        </header>

        <section className="mt-6 inline-flex rounded-lg border border-border bg-card p-1 text-xs">
          <SourceTab href="/review" active={source === "demo"} label="Demo cases" count={demoCount} />
          <SourceTab
            href="/review?source=upload"
            active={source === "upload"}
            label="Your cases"
            count={uploadCount}
          />
        </section>

        {source === "upload" && pendingUploadCount > 0 && (
          <section className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="text-amber-900/90 dark:text-amber-200">
                {pendingUploadCount} of your uploaded action{pendingUploadCount === 1 ? "" : "s"}{" "}
                {pendingUploadCount === 1 ? "is" : "are"} not classified yet.
              </div>
              <ClassifyPendingButton />
            </div>
          </section>
        )}

        <section className="mt-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-baseline justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold tabular-nums">{reviewedCount}</span>
              <span className="text-muted-foreground">of {totalCount} reviewed</span>
              <HelpTip>{TOOLTIPS.reviewProgress}</HelpTip>
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">{reviewedPct}%</div>
          </div>
          <Progress value={reviewedPct} className="mt-2" />
          <div className="mt-3 flex items-center justify-between gap-4 text-xs">
            <PrevNext direction="prev" source={source} index={index} totalCount={totalCount} />
            <span className="font-mono text-muted-foreground">
              {totalCount === 0 ? "—" : `action ${index + 1} / ${totalCount}`}
            </span>
            <PrevNext direction="next" source={source} index={index} totalCount={totalCount} />
          </div>
        </section>

        {!action ? (
          <EmptyState index={index} totalCount={totalCount} source={source} />
        ) : (
          <ActionView
            action={action}
            index={index}
            totalCount={totalCount}
            source={source}
            classification={await getFinalClassification(action.id)}
            goldenLabel={await getGoldenLabel(action.id)}
          />
        )}
      </main>
    </>
  );
}

function SourceTab({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
      }`}
    >
      <span>{label}</span>
      <span className="rounded bg-background/60 px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
        {count}
      </span>
    </Link>
  );
}

function PrevNext({
  direction,
  index,
  totalCount,
  source,
}: {
  direction: "prev" | "next";
  index: number;
  totalCount: number;
  source: ActionSource;
}) {
  const target = direction === "prev" ? index - 1 : index + 1;
  const enabled = direction === "prev" ? index > 0 : index + 1 < totalCount;
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const label = direction === "prev" ? "prev" : "next";
  const sourceQuery = source === "upload" ? "&source=upload" : "";
  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground/40">
        <Icon className="size-3.5" />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <Link
      href={`/review?index=${target}${sourceQuery}`}
      className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
    >
      {direction === "prev" && <Icon className="size-3.5" />}
      <span>{label}</span>
      {direction === "next" && <Icon className="size-3.5" />}
    </Link>
  );
}

function EmptyState({
  index,
  totalCount,
  source,
}: {
  index: number;
  totalCount: number;
  source: ActionSource;
}) {
  const isUpload = source === "upload";
  return (
    <Card className="mt-6">
      <CardContent className="px-6 py-8 text-sm text-muted-foreground">
        {totalCount === 0 ? (
          isUpload ? (
            <>
              No uploaded actions yet.{" "}
              <Link href="/upload" className="text-foreground underline underline-offset-2">
                Upload a JSON sample
              </Link>{" "}
              to populate this view.
            </>
          ) : (
            <>
              No demo actions yet. Run <code className="font-mono">npm run seed:eighty</code>.
            </>
          )
        ) : (
          <>
            No action at index {index}. The {isUpload ? "uploaded" : "demo"} set has{" "}
            {totalCount} action(s); valid indices are 0&ndash;{totalCount - 1}.
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ActionView({
  action,
  index,
  totalCount,
  source,
  classification,
  goldenLabel,
}: {
  action: AgentAction;
  index: number;
  totalCount: number;
  source: ActionSource;
  classification: ClassificationRow | null;
  goldenLabel: GoldenLabel | null;
}) {
  void source;
  return (
    <div className="mt-6 space-y-6">
      <ActionCard action={action} />
      {classification ? (
        <>
          <ClassificationCard c={classification} />
          <Card>
            <CardHeader className="pb-3">
              <h3 className="text-sm font-semibold">Your verdict</h3>
            </CardHeader>
            <CardContent className="pt-0">
              <ReviewActions
                action_id={action.id}
                current_index={index}
                total_count={totalCount}
                source={source}
                classifier_verdict={classification.classification}
                existing_label={goldenLabel?.human_label ?? null}
              />
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="px-6 py-8 text-sm text-muted-foreground">
            Not yet classified. Run <code className="font-mono">npm run classify:all</code>.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ActionCard({ action }: { action: AgentAction }) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-mono text-[10px]">
            {action.agent_id}
          </Badge>
          <Badge variant="outline" className="font-mono text-[10px]">
            autonomy L{action.autonomy_level}
          </Badge>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">
          {formatTimestamp(action.timestamp)}
        </span>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-4 pt-4 text-sm">
        <Field label="User input" value={action.input} mono />
        <Field label="Context the agent had" value={action.context ?? "—"} mono />
        <Field label="Agent output" value={action.output} mono />
        <Field
          label="Tool calls"
          value={
            action.tool_calls.length > 0 ? (
              <span className="flex flex-wrap gap-1">
                {action.tool_calls.map((t) => (
                  <Badge key={t} variant="outline" className="font-mono text-[10px]">
                    {t}
                  </Badge>
                ))}
              </span>
            ) : (
              "none"
            )
          }
        />
      </CardContent>
    </Card>
  );
}

function ClassificationCard({ c }: { c: ClassificationRow }) {
  const isSonnet = c.model_used === SONNET_MODEL;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Classifier verdict
          </span>
          <ClassificationBadge value={c.classification} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="gap-1 font-mono text-[10px]">
            {prettyModel(c.model_used)}
            {isSonnet && (
              <span className="ml-1 inline-flex items-center gap-0.5 text-[9px] uppercase">
                <ArrowUpRight className="size-2.5" />
                escalated
              </span>
            )}
          </Badge>
          <span className="tabular-nums">
            confidence <span className="font-medium text-foreground">{Number(c.confidence).toFixed(2)}</span>
          </span>
          <span className="tabular-nums">${Number(c.cost_usd).toFixed(6)}</span>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-4 pt-4 text-sm">
        <details className="group rounded-md">
          <summary className="flex cursor-pointer items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground">
            <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
            <span>
              Reasoning ({c.reasoning_steps.length} step
              {c.reasoning_steps.length === 1 ? "" : "s"})
            </span>
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-7">
            {c.reasoning_steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </details>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FlagCell label="Policy violations" tooltip={TOOLTIPS.policyViolations}>
            {c.policy_violations.length > 0 ? (
              <span className="flex flex-wrap gap-1">
                {c.policy_violations.map((p) => (
                  <Badge
                    key={p}
                    className="border-amber-500/40 bg-amber-500/10 font-mono text-[10px] text-amber-700 dark:text-amber-400"
                  >
                    {p}
                  </Badge>
                ))}
              </span>
            ) : (
              <span className="text-muted-foreground">none</span>
            )}
          </FlagCell>
          <FlagCell label="Autonomy appropriate" tooltip={TOOLTIPS.autonomyAppropriate}>
            <BoolGlyph value={c.autonomy_appropriate} />
          </FlagCell>
          <FlagCell label="Escalation recommended" tooltip={TOOLTIPS.escalationRecommended}>
            <BoolGlyph value={c.escalation_recommended} />
          </FlagCell>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-sm ${mono ? "font-mono leading-relaxed" : ""}`}>{value}</div>
    </div>
  );
}

function FlagCell({
  label,
  tooltip,
  children,
}: {
  label: string;
  tooltip: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3">
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        <HelpTip>{tooltip}</HelpTip>
      </div>
      <div className="mt-1.5 text-sm">{children}</div>
    </div>
  );
}

function BoolGlyph({ value }: { value: boolean }) {
  return (
    <span className={value ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
      {value ? "yes" : "no"}
    </span>
  );
}

function prettyModel(m: string): string {
  if (m === HAIKU_MODEL) return "Haiku 4.5";
  if (m === SONNET_MODEL) return "Sonnet 4.6";
  return m;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toISOString().replace("T", " ").slice(0, 16);
}
