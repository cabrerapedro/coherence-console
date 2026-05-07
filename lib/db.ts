import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

export const sql = neon(connectionString);

export type AgentAction = {
  id: string;
  agent_id: string;
  timestamp: string;
  input: string;
  context: string | null;
  output: string;
  tool_calls: string[];
  autonomy_level: number;
  created_at: string;
};

export async function ping(): Promise<string> {
  const rows = (await sql`select now() as now`) as { now: string }[];
  return rows[0].now;
}

export async function getActionById(id: string): Promise<AgentAction | null> {
  const rows = (await sql`
    select id, agent_id, timestamp, input, context, output, tool_calls, autonomy_level, created_at
    from agent_actions
    where id = ${id}
    limit 1
  `) as AgentAction[];
  return rows[0] ?? null;
}

export type AgentActionInput = {
  agent_id: string;
  timestamp: string;
  input: string;
  context: string | null;
  output: string;
  tool_calls: string[];
  autonomy_level: number;
};

export async function insertAgentAction(
  action: AgentActionInput,
): Promise<{ id: string; inserted: boolean }> {
  const inserted = (await sql`
    insert into agent_actions
      (agent_id, timestamp, input, context, output, tool_calls, autonomy_level)
    values
      (${action.agent_id}, ${action.timestamp}, ${action.input}, ${action.context},
       ${action.output}, ${JSON.stringify(action.tool_calls)}::jsonb, ${action.autonomy_level})
    on conflict (agent_id, timestamp) do nothing
    returning id
  `) as { id: string }[];
  if (inserted[0]) return { id: inserted[0].id, inserted: true };
  const existing = (await sql`
    select id from agent_actions
    where agent_id = ${action.agent_id} and timestamp = ${action.timestamp}
    limit 1
  `) as { id: string }[];
  return { id: existing[0].id, inserted: false };
}

export async function getFirstAction(): Promise<AgentAction | null> {
  const rows = (await sql`
    select id, agent_id, timestamp, input, context, output, tool_calls, autonomy_level, created_at
    from agent_actions
    order by created_at asc
    limit 1
  `) as AgentAction[];
  return rows[0] ?? null;
}

export async function getAllAgentActions(): Promise<AgentAction[]> {
  return (await sql`
    select id, agent_id, timestamp, input, context, output, tool_calls, autonomy_level, created_at
    from agent_actions
    order by created_at asc
  `) as AgentAction[];
}

export async function getUnclassifiedActions(): Promise<AgentAction[]> {
  return (await sql`
    select a.id, a.agent_id, a.timestamp, a.input, a.context, a.output,
           a.tool_calls, a.autonomy_level, a.created_at
    from agent_actions a
    where not exists (
      select 1 from classifications c
      where c.action_id = a.id and c.is_final = true
    )
    order by a.created_at asc
  `) as AgentAction[];
}

export async function batchInsertAgentActions(
  actions: AgentActionInput[],
): Promise<{ insertedCount: number; skippedCount: number }> {
  if (actions.length === 0) return { insertedCount: 0, skippedCount: 0 };
  const queries = actions.map(
    (a) => sql`
      insert into agent_actions
        (agent_id, timestamp, input, context, output, tool_calls, autonomy_level)
      values
        (${a.agent_id}, ${a.timestamp}, ${a.input}, ${a.context},
         ${a.output}, ${JSON.stringify(a.tool_calls)}::jsonb, ${a.autonomy_level})
      on conflict (agent_id, timestamp) do nothing
      returning id
    `,
  );
  const results = (await sql.transaction(queries)) as { id: string }[][];
  const insertedCount = results.filter((rows) => rows.length > 0).length;
  return { insertedCount, skippedCount: actions.length - insertedCount };
}

export type ClassificationRow = {
  id: string;
  action_id: string;
  classification: "correct" | "incorrect" | "needs_review";
  confidence: string;
  reasoning_steps: string[];
  policy_violations: string[];
  autonomy_appropriate: boolean;
  escalation_recommended: boolean;
  model_used: string;
  cost_usd: string;
  classifier_version: string;
  is_final: boolean;
  created_at: string;
};

export async function getFinalClassification(action_id: string): Promise<ClassificationRow | null> {
  const rows = (await sql`
    select id, action_id, classification, confidence, reasoning_steps, policy_violations,
           autonomy_appropriate, escalation_recommended, model_used, cost_usd,
           classifier_version, is_final, created_at
    from classifications
    where action_id = ${action_id} and is_final = true
    order by created_at desc
    limit 1
  `) as ClassificationRow[];
  return rows[0] ?? null;
}

type ClassificationInsert = {
  action_id: string;
  classification: "correct" | "incorrect" | "needs_review";
  confidence: number;
  reasoning_steps: string[];
  policy_violations: string[];
  autonomy_appropriate: boolean;
  escalation_recommended: boolean;
  model_used: string;
  cost_usd: number;
  classifier_version: string;
  is_final: boolean;
};

async function insertClassification(c: ClassificationInsert): Promise<void> {
  await sql`
    insert into classifications
      (action_id, classification, confidence, reasoning_steps, policy_violations,
       autonomy_appropriate, escalation_recommended, model_used, cost_usd,
       classifier_version, is_final)
    values
      (${c.action_id}, ${c.classification}, ${c.confidence},
       ${JSON.stringify(c.reasoning_steps)}::jsonb,
       ${JSON.stringify(c.policy_violations)}::jsonb,
       ${c.autonomy_appropriate}, ${c.escalation_recommended},
       ${c.model_used}, ${c.cost_usd}, ${c.classifier_version}, ${c.is_final})
  `;
}

type ClassificationRunInsert = Omit<ClassificationInsert, "action_id" | "classifier_version" | "is_final">;

export type CascadeRecord = {
  action_id: string;
  classifier_version: string;
  haiku?: ClassificationRunInsert;
  sonnet?: ClassificationRunInsert;
};

export type DatasetStats = {
  totalActions: number;
  totalCostUsd: number;
  finalClassifications: number;
  escalationCount: number;
  byModel: { model: string; calls: number; totalCost: number; avgCost: number }[];
};

// Source filtering by agent_id prefix:
//   "aloha-"                       → the 80-action hand-designed demo dataset
//   "upload-"                      → ALL uploaded actions across every session
//   "upload-<sessionId>-"          → only the current session's uploads
// Pages compute the right prefix and pass it to the helpers below. Keeping the
// helpers prefix-agnostic means session isolation lives in the page/route layer.
export type ActionSource = "demo" | "upload";
export const DEMO_PREFIX = "aloha-";
export const UPLOAD_GLOBAL_PREFIX = "upload-";

export function uploadPrefixForSession(sessionId: string): string {
  return `${UPLOAD_GLOBAL_PREFIX}${sessionId}-`;
}

export async function getDatasetActionAtIndex(
  index: number,
  prefix: string,
): Promise<AgentAction | null> {
  const rows = (await sql`
    select id, agent_id, timestamp, input, context, output, tool_calls, autonomy_level, created_at
    from agent_actions
    where agent_id like ${prefix + "%"}
    order by timestamp asc
    offset ${index} limit 1
  `) as unknown as AgentAction[];
  return rows[0] ?? null;
}

export async function getDatasetActionCount(prefix: string): Promise<number> {
  const rows = (await sql`
    select count(*)::int as n from agent_actions where agent_id like ${prefix + "%"}
  `) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}

export async function getReviewedCount(prefix: string): Promise<number> {
  const rows = (await sql`
    select count(*)::int as n
    from golden_set g
    join agent_actions a on a.id = g.action_id
    where a.agent_id like ${prefix + "%"}
  `) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}

export async function getUnclassifiedActionsForPrefix(prefix: string): Promise<AgentAction[]> {
  return (await sql`
    select a.id, a.agent_id, a.timestamp, a.input, a.context, a.output,
           a.tool_calls, a.autonomy_level, a.created_at
    from agent_actions a
    where a.agent_id like ${prefix + "%"}
      and not exists (
        select 1 from classifications c
        where c.action_id = a.id and c.is_final = true
      )
    order by a.created_at asc
  `) as unknown as AgentAction[];
}

export async function getUnclassifiedCountForPrefix(prefix: string): Promise<number> {
  const rows = (await sql`
    select count(*)::int as n
    from agent_actions a
    where a.agent_id like ${prefix + "%"}
      and not exists (
        select 1 from classifications c
        where c.action_id = a.id and c.is_final = true
      )
  `) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}

export type GoldenLabel = {
  human_label: "correct" | "incorrect" | "needs_review";
  human_note: string | null;
  labeled_at: string;
};

export async function getGoldenLabel(action_id: string): Promise<GoldenLabel | null> {
  const rows = (await sql`
    select human_label, human_note, labeled_at::text
    from golden_set
    where action_id = ${action_id}
    limit 1
  `) as unknown as GoldenLabel[];
  return rows[0] ?? null;
}

// v1: re-labeling overwrites the prior label per the design call documented
// in CLAUDE.md item 3 — versioned history is deferred to v2 for multi-reviewer
// scenarios. ON CONFLICT DO UPDATE is the explicit overwrite contract.
export async function upsertGoldenLabel(
  action_id: string,
  human_label: "correct" | "incorrect" | "needs_review",
  human_note: string | null,
): Promise<void> {
  await sql`
    insert into golden_set (action_id, human_label, human_note)
    values (${action_id}, ${human_label}, ${human_note})
    on conflict (action_id) do update
      set human_label = excluded.human_label,
          human_note = excluded.human_note,
          labeled_at = now()
  `;
}

export async function getDatasetStats(): Promise<DatasetStats> {
  const [actionCountRows, finalRows, byModelRows] = await Promise.all([
    sql`select count(*)::int as n from agent_actions where agent_id like 'aloha-%'`,
    sql`
      select count(*)::int as final_count,
             coalesce(sum(c.cost_usd), 0)::text as total_cost,
             count(*) filter (where c.model_used = 'anthropic/claude-sonnet-4-6')::int as escalations
      from classifications c
      join agent_actions a on a.id = c.action_id
      where c.is_final = true and a.agent_id like 'aloha-%'
    `,
    sql`
      select c.model_used as model,
             count(*)::int as calls,
             coalesce(sum(c.cost_usd), 0)::text as total_cost
      from classifications c
      join agent_actions a on a.id = c.action_id
      where c.is_final = true and a.agent_id like 'aloha-%'
      group by c.model_used
      order by c.model_used
    `,
  ]);
  const action = (actionCountRows as unknown as { n: number }[])[0];
  const fin = (finalRows as unknown as { final_count: number; total_cost: string; escalations: number }[])[0];
  const models = byModelRows as unknown as { model: string; calls: number; total_cost: string }[];
  return {
    totalActions: action?.n ?? 0,
    totalCostUsd: Number(fin?.total_cost ?? 0),
    finalClassifications: fin?.final_count ?? 0,
    escalationCount: fin?.escalations ?? 0,
    byModel: models.map((r) => ({
      model: r.model,
      calls: r.calls,
      totalCost: Number(r.total_cost),
      avgCost: r.calls > 0 ? Number(r.total_cost) / r.calls : 0,
    })),
  };
}

export type EvalRun = {
  id: string;
  classifier_version: string;
  model_primary: string;
  model_escalation: string | null;
  total_actions: number;
  accuracy: string;
  precision_score: string;
  recall_score: string;
  total_cost_usd: string;
  escalation_rate: string;
  notes: string | null;
  created_at: string;
};

export async function getEvalRuns(): Promise<EvalRun[]> {
  return (await sql`
    select id, classifier_version, model_primary, model_escalation, total_actions,
           accuracy::text, precision_score::text, recall_score::text,
           total_cost_usd::text, escalation_rate::text, notes, created_at
    from eval_runs
    order by created_at desc
  `) as unknown as EvalRun[];
}

export type EvalRunInsert = {
  classifier_version: string;
  model_primary: string;
  model_escalation: string | null;
  total_actions: number;
  accuracy: number;
  precision_score: number;
  recall_score: number;
  total_cost_usd: number;
  escalation_rate: number;
  notes: string | null;
};

export async function insertEvalRun(r: EvalRunInsert): Promise<{ id: string }> {
  const rows = (await sql`
    insert into eval_runs
      (classifier_version, model_primary, model_escalation, total_actions,
       accuracy, precision_score, recall_score, total_cost_usd,
       escalation_rate, notes)
    values
      (${r.classifier_version}, ${r.model_primary}, ${r.model_escalation},
       ${r.total_actions}, ${r.accuracy}, ${r.precision_score}, ${r.recall_score},
       ${r.total_cost_usd}, ${r.escalation_rate}, ${r.notes})
    returning id
  `) as unknown as { id: string }[];
  return rows[0];
}

export async function recordClassificationCascade(r: CascadeRecord): Promise<void> {
  await sql`update classifications set is_final = false where action_id = ${r.action_id} and is_final = true`;
  if (r.haiku) {
    await insertClassification({
      ...r.haiku,
      action_id: r.action_id,
      classifier_version: r.classifier_version,
      is_final: !r.sonnet,
    });
  }
  if (r.sonnet) {
    await insertClassification({
      ...r.sonnet,
      action_id: r.action_id,
      classifier_version: r.classifier_version,
      is_final: true,
    });
  }
}
