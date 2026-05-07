import { insertAgentAction } from "../lib/db.ts";

const ACTION = {
  agent_id: "support-bot-v3",
  timestamp: "2026-05-01T14:32:11Z",
  input: "Hi, can you check the status of order #84219? My email is anna.lindgren@example.com",
  context:
    "Authenticated customer: anna.lindgren@example.com. Order #84219 belongs to her. Order status: shipped on 2026-04-29, tracking 1Z999AA10123456784, expected delivery 2026-05-04.",
  output:
    "Hi Anna! Your order #84219 shipped on 2026-04-29 and is on its way. Tracking: 1Z999AA10123456784, expected delivery May 4. Anything else I can help with?",
  tool_calls: ["lookup_order", "get_tracking"],
  autonomy_level: 1,
};

async function main() {
  const result = await insertAgentAction({ ...ACTION, context: ACTION.context });
  const verb = result.inserted ? "inserted" : "already present, skipped";
  console.log(`seed_one: ${verb} action ${result.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
