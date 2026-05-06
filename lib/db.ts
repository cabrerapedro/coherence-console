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

export async function findActionByAgentAndTimestamp(
  agent_id: string,
  timestamp: string,
): Promise<{ id: string } | null> {
  const rows = (await sql`
    select id from agent_actions
    where agent_id = ${agent_id} and timestamp = ${timestamp}
    limit 1
  `) as { id: string }[];
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

export async function insertAgentAction(action: AgentActionInput): Promise<{ id: string }> {
  const rows = (await sql`
    insert into agent_actions
      (agent_id, timestamp, input, context, output, tool_calls, autonomy_level)
    values
      (${action.agent_id}, ${action.timestamp}, ${action.input}, ${action.context},
       ${action.output}, ${JSON.stringify(action.tool_calls)}::jsonb, ${action.autonomy_level})
    returning id
  `) as { id: string }[];
  return rows[0];
}
