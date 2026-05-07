import { revalidatePath } from "next/cache";
import {
  getFirstAction,
  getFinalClassification,
  recordClassificationCascade,
  type AgentAction,
  type ClassificationRow,
} from "@/lib/db";
import { classify, CLASSIFIER_VERSION } from "@/lib/classifier";

async function classifyAction(formData: FormData) {
  "use server";
  const action_id = String(formData.get("action_id") ?? "");
  if (!action_id) throw new Error("missing action_id");

  const action = await getFirstAction();
  if (!action || action.id !== action_id) throw new Error("action not found");

  const result = await classify(action);
  await recordClassificationCascade({
    action_id,
    classifier_version: CLASSIFIER_VERSION,
    haiku: {
      ...result.haiku.classification,
      model_used: result.haiku.model,
      cost_usd: result.haiku.cost_usd,
    },
    sonnet: result.sonnet
      ? {
          ...result.sonnet.classification,
          model_used: result.sonnet.model,
          cost_usd: result.sonnet.cost_usd,
        }
      : undefined,
  });
  revalidatePath("/");
}

export default async function Page() {
  const action = await getFirstAction();
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Coherence Console</h1>
      <p className="mt-1 text-sm opacity-70">
        Review AI agent actions, classify them, and detect regressions over time.
      </p>

      {!action ? (
        <EmptyState />
      ) : (
        <ActionView action={action} classification={await getFinalClassification(action.id)} />
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <section className="mt-10 rounded border border-dashed border-current/20 p-6 text-sm opacity-80">
      No actions in the database yet. Run <code className="font-mono">npm run seed:one</code>.
    </section>
  );
}

function ActionView({
  action,
  classification,
}: {
  action: AgentAction;
  classification: ClassificationRow | null;
}) {
  return (
    <section className="mt-8 space-y-6">
      <ActionCard action={action} />
      {classification ? (
        <ClassificationCard c={classification} />
      ) : (
        <p className="text-sm opacity-70">Not classified yet.</p>
      )}
      <form action={classifyAction}>
        <input type="hidden" name="action_id" value={action.id} />
        <button
          type="submit"
          className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          {classification ? "Re-classify" : "Classify with current model"}
        </button>
      </form>
    </section>
  );
}

function ActionCard({ action }: { action: AgentAction }) {
  return (
    <article className="rounded border border-current/15 p-5 text-sm">
      <header className="mb-3 flex items-center justify-between text-xs opacity-70">
        <span className="font-mono">{action.agent_id}</span>
        <span className="font-mono">autonomy L{action.autonomy_level}</span>
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
        <Badge>{c.classification}</Badge>
        <span className="opacity-70">confidence {Number(c.confidence).toFixed(2)}</span>
        <span className="opacity-70 font-mono">{c.model_used}</span>
        <span className="opacity-70">${Number(c.cost_usd).toFixed(6)}</span>
      </header>
      <Field
        label="Reasoning"
        value={
          <ol className="list-decimal pl-5 space-y-1">
            {c.reasoning_steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        }
      />
      <Field
        label="Policy violations"
        value={c.policy_violations.length > 0 ? c.policy_violations.join(", ") : "none"}
      />
      <Field label="Autonomy appropriate" value={c.autonomy_appropriate ? "yes" : "no"} />
      <Field label="Escalation recommended" value={c.escalation_recommended ? "yes" : "no"} />
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
