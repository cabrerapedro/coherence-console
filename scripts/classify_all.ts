import {
  getUnclassifiedActions,
  getAllAgentActions,
  recordClassificationCascade,
} from "../lib/db.ts";
import { classify, CLASSIFIER_VERSION, ClassifierError } from "../lib/classifier.ts";

async function main() {
  const force = process.argv.includes("--force");
  const actions = force ? await getAllAgentActions() : await getUnclassifiedActions();
  if (actions.length === 0) {
    console.log(
      force
        ? "classify_all: no actions in agent_actions"
        : "classify_all: no unclassified actions; nothing to do",
    );
    return;
  }
  console.log(
    `classify_all: ${actions.length} action(s) to ${force ? "re-classify (--force; prior is_final rows will be demoted)" : "classify"}`,
  );

  let attempted = 0;
  let classified = 0;
  let escalations = 0;
  let totalCost = 0;
  const errors: { action_id: string; kind: string }[] = [];

  for (const action of actions) {
    attempted++;
    try {
      const result = await classify(action);
      await recordClassificationCascade({
        action_id: action.id,
        classifier_version: CLASSIFIER_VERSION,
        haiku: result.haiku
          ? {
              ...result.haiku.classification,
              model_used: result.haiku.model,
              cost_usd: result.haiku.cost_usd,
            }
          : undefined,
        sonnet: result.sonnet
          ? {
              ...result.sonnet.classification,
              model_used: result.sonnet.model,
              cost_usd: result.sonnet.cost_usd,
            }
          : undefined,
      });
      classified++;
      if (result.sonnet) escalations++;
      totalCost += result.total_cost_usd;
    } catch (err) {
      // classifyOnce already wrote a grep-friendly stderr line (ClassifierError kind=...).
      // Capture the kind for the final summary; do NOT abort the batch.
      const kind = err instanceof ClassifierError ? err.kind : "unknown";
      errors.push({ action_id: action.id, kind });
    }

    if (attempted % 10 === 0) {
      console.log(
        `classify_all: classified ${classified}/${actions.length} — ${escalations} escalations so far, $${totalCost.toFixed(3)} spent`,
      );
    }
  }

  const escalationPct = classified > 0 ? (escalations / classified) * 100 : 0;
  console.log(
    `\nclassify_all: ${classified}/${actions.length} classified, ${escalations} escalations (${escalationPct.toFixed(1)}%), total cost $${totalCost.toFixed(4)}`,
  );
  if (errors.length > 0) {
    console.log(`classify_all: ${errors.length} error(s):`);
    for (const e of errors) console.log(`  ${e.action_id} — ${e.kind}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
