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

export type CascadeRecord = {
  action_id: string;
  classifier_version: string;
  haiku: Omit<ClassificationInsert, "action_id" | "classifier_version" | "is_final">;
  sonnet?: Omit<ClassificationInsert, "action_id" | "classifier_version" | "is_final">;
};

export async function recordClassificationCascade(r: CascadeRecord): Promise<void> {
  await sql`update classifications set is_final = false where action_id = ${r.action_id} and is_final = true`;
  const haikuFinal = !r.sonnet;
  await insertClassification({
    ...r.haiku,
    action_id: r.action_id,
    classifier_version: r.classifier_version,
    is_final: haikuFinal,
  });
  if (r.sonnet) {
    await insertClassification({
      ...r.sonnet,
      action_id: r.action_id,
      classifier_version: r.classifier_version,
      is_final: true,
    });
  }
}
