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
