import Link from "next/link";
import {
  getDatasetActionAtIndex,
  getDatasetActionCount,
  getReviewedCount,
  getFinalClassification,
  getGoldenLabel,
  type AgentAction,
  type ClassificationRow,
  type GoldenLabel,
} from "@/lib/db";
import ReviewActions from "./ReviewActions";

const HAIKU_MODEL = "anthropic/claude-haiku-4-5";
const SONNET_MODEL = "anthropic/claude-sonnet-4-6";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ index?: string }>;
}) {
  const { index: indexParam } = await searchParams;
  const index = Math.max(0, parseInt(indexParam ?? "0", 10) || 0);
  const [action, totalCount, reviewedCount] = await Promise.all([
    getDatasetActionAtIndex(index),
    getDatasetActionCount(),
    getReviewedCount(),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="flex items-center justify-between text-xs">
        <Link href="/" className="opacity-60 hover:opacity-100">← home</Link>
        <span className="opacity-70">
          {reviewedCount} / {totalCount} reviewed
        </span>
        <nav className="flex gap-3">
          <PrevNext label="prev" href={index > 0 ? `/review?index=${index - 1}` : null} />
          <PrevNext
            label="next"
            href={index + 1 < totalCount ? `/review?index=${index + 1}` : null}
          />
        </nav>
      </header>

      {!action ? (
        <EmptyState index={index} totalCount={totalCount} />
      ) : (
        <ActionView
          action={action}
          index={index}
          totalCount={totalCount}
          classification={await getFinalClassification(action.id)}
          goldenLabel={await getGoldenLabel(action.id)}
        />
      )}
    </main>
  );
}

function PrevNext({ label, href }: { label: string; href: string | null }) {
  if (!href) return <span className="opacity-30">{label}</span>;
  return (
    <Link href={href} className="opacity-60 hover:opacity-100">
      {label}
    </Link>
  );
}

function EmptyState({ index, totalCount }: { index: number; totalCount: number }) {
  return (
    <section className="mt-10 rounded border border-dashed border-current/20 p-6 text-sm opacity-80">
      No action at index {index}.{" "}
      {totalCount === 0
        ? <>Run <code className="font-mono">npm run seed:eighty</code>.</>
        : <>The dataset has {totalCount} action(s); valid indices are 0&ndash;{totalCount - 1}.</>}
    </section>
  );
}

function ActionView({
  action,
  index,
  totalCount,
  classification,
  goldenLabel,
}: {
  action: AgentAction;
  index: number;
  totalCount: number;
  classification: ClassificationRow | null;
  goldenLabel: GoldenLabel | null;
}) {
  return (
    <>
      <section className="mt-6">
        <ActionCard action={action} index={index} />
      </section>
      <section className="mt-6">
        {classification ? (
          <ClassificationCard c={classification} />
        ) : (
          <p className="text-sm opacity-60">Not yet classified.</p>
        )}
      </section>
      {classification && (
        <ReviewActions
          action_id={action.id}
          current_index={index}
          total_count={totalCount}
          classifier_verdict={classification.classification}
          existing_label={goldenLabel?.human_label ?? null}
        />
      )}
    </>
  );
}

function ActionCard({ action, index }: { action: AgentAction; index: number }) {
  return (
    <article className="rounded border border-current/15 p-5 text-sm">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs opacity-70">
        <span className="font-mono">
          #{index} · {action.agent_id}
        </span>
        <div className="flex gap-2">
          <Badge>L{action.autonomy_level}</Badge>
          <span className="font-mono opacity-80">{formatTimestamp(action.timestamp)}</span>
        </div>
      </header>
      <Field label="Input" value={action.input} />
      <Field label="Context" value={action.context ?? "—"} />
      <Field label="Output" value={action.output} />
      <Field
        label="Tool calls"
        value={action.tool_calls.length > 0 ? action.tool_calls.join(", ") : "none"}
      />
    </article>
  );
}

function ClassificationCard({ c }: { c: ClassificationRow }) {
  return (
    <article className="rounded border border-current/15 p-5 text-sm">
      <header className="mb-3 flex flex-wrap items-center gap-3 text-xs">
        <ClassBadge value={c.classification} />
        <span className="opacity-70">confidence {Number(c.confidence).toFixed(2)}</span>
        <span className="opacity-70 font-mono">{prettyModel(c.model_used)}</span>
        <span className="opacity-70 tabular-nums">${Number(c.cost_usd).toFixed(6)}</span>
      </header>
      <details className="mt-3 cursor-pointer">
        <summary className="text-xs uppercase tracking-wide opacity-50">
          Show reasoning ({c.reasoning_steps.length} step{c.reasoning_steps.length === 1 ? "" : "s"})
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          {c.reasoning_steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </details>
      <Field
        label="Policy violations"
        value={
          c.policy_violations.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {c.policy_violations.map((p) => (
                <Chip key={p}>{p}</Chip>
              ))}
            </span>
          ) : (
            "—"
          )
        }
      />
      <Field label="Autonomy appropriate" value={c.autonomy_appropriate ? "✓" : "✗"} />
      <Field label="Escalation recommended" value={c.escalation_recommended ? "✓" : "✗"} />
    </article>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="mt-3 first:mt-0">
      <div className="text-xs uppercase tracking-wide opacity-50">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-current/30 px-2 py-0.5 font-mono text-xs">
      {children}
    </span>
  );
}

function ClassBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    correct: "border-green-600/50 text-green-700 dark:text-green-400",
    incorrect: "border-red-600/50 text-red-700 dark:text-red-400",
    needs_review: "border-amber-600/50 text-amber-700 dark:text-amber-400",
  };
  const cls = map[value] ?? "border-current/30";
  return (
    <span className={`rounded border px-2 py-0.5 font-mono text-xs uppercase tracking-wide ${cls}`}>
      {value}
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-current/30 px-2 py-0.5 font-mono text-xs">
      {children}
    </span>
  );
}

function prettyModel(m: string): string {
  if (m === HAIKU_MODEL) return "Haiku 4.5";
  if (m === SONNET_MODEL) return "Sonnet 4.6 (escalated)";
  return m;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toISOString().replace("T", " ").slice(0, 16);
}
