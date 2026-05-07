import { sql } from "../lib/db.ts";
import { classify } from "../lib/classifier.ts";
import type { AgentAction } from "../lib/db.ts";

async function main() {
  const rows = (await sql`
    select id, agent_id, timestamp, input, context, output, tool_calls, autonomy_level, created_at
    from agent_actions
    order by created_at asc
    limit 1
  `) as AgentAction[];
  const action = rows[0];
  if (!action) {
    console.error("classify_one: no actions in DB. Run `npm run seed:one` first.");
    process.exit(1);
  }
  console.log(`classify_one: classifying action ${action.id}`);

  const result = await classify(action);

  console.log("\n--- HAIKU ---");
  console.log(JSON.stringify(result.haiku, null, 2));
  if (result.sonnet) {
    console.log("\n--- SONNET (escalated) ---");
    console.log(JSON.stringify(result.sonnet, null, 2));
  } else {
    console.log("\n(no escalation: haiku confidence >= 0.7)");
  }
  console.log(`\ntotal_cost_usd: $${result.total_cost_usd.toFixed(6)}`);
  console.log(`final model: ${result.final.model}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
