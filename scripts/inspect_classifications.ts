// Reads the current is_final classification for every action in the DB and prints
// it side-by-side with the action input. Used to eyeball classifier behavior when
// iterating on the prompt or after a re-classify run.
//
//   npm run inspect
//   npm run inspect -- --agent-prefix=aloha-   # filter by agent_id LIKE 'aloha-%'

import { sql } from "../lib/db.ts";

type Row = {
  agent_id: string;
  timestamp: string;
  input_snippet: string;
  classification: string;
  confidence: string;
  model_used: string;
  cost_usd: string;
  policy_violations: string[];
  autonomy_appropriate: boolean;
  escalation_recommended: boolean;
  reasoning_steps: string[];
};

async function main() {
  const prefixArg = process.argv.find((a) => a.startsWith("--agent-prefix="));
  const prefix = prefixArg ? prefixArg.split("=")[1] : null;

  const rows = (prefix
    ? await sql`
        select a.agent_id, a.timestamp::text as timestamp,
               substring(a.input from 1 for 90) as input_snippet,
               c.classification, c.confidence::text as confidence,
               c.model_used, c.cost_usd::text as cost_usd,
               c.policy_violations, c.autonomy_appropriate,
               c.escalation_recommended, c.reasoning_steps
        from agent_actions a
        join classifications c on c.action_id = a.id and c.is_final = true
        where a.agent_id like ${prefix + "%"}
        order by a.timestamp asc
      `
    : await sql`
        select a.agent_id, a.timestamp::text as timestamp,
               substring(a.input from 1 for 90) as input_snippet,
               c.classification, c.confidence::text as confidence,
               c.model_used, c.cost_usd::text as cost_usd,
               c.policy_violations, c.autonomy_appropriate,
               c.escalation_recommended, c.reasoning_steps
        from agent_actions a
        join classifications c on c.action_id = a.id and c.is_final = true
        order by a.timestamp asc
      `) as Row[];

  if (rows.length === 0) {
    console.log("inspect: no classified actions found");
    return;
  }

  for (const r of rows) {
    console.log(`\n--- ${r.timestamp}  [${r.agent_id}] ---`);
    console.log(`input: ${r.input_snippet}…`);
    console.log(
      `classification: ${r.classification}  confidence: ${Number(r.confidence).toFixed(2)}  model: ${r.model_used}  cost: $${Number(r.cost_usd).toFixed(6)}`,
    );
    console.log(`policy_violations: ${JSON.stringify(r.policy_violations)}`);
    console.log(
      `autonomy_appropriate: ${r.autonomy_appropriate}  escalation_recommended: ${r.escalation_recommended}`,
    );
    console.log("reasoning:");
    for (const s of r.reasoning_steps) console.log(`  - ${s}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
