// Eval runner. Two paths:
//   - golden_set is empty → record a synthetic baseline row in eval_runs so the
//     /evals page has something to render. No classifier calls (re-running
//     against self is meaningless). The notes column carries the prefix
//     "v1 baseline — synthetic" so the page renders accuracy/precision/recall
//     as "—" instead of the placeholder 1.000 stored to satisfy the NOT NULL
//     schema.
//   - golden_set non-empty → re-run classify() on each labeled action, compare
//     to human_label, compute macro-averaged precision/recall + accuracy +
//     escalation rate, insert a real eval row.
//
//   npm run eval

import {
  sql,
  getDatasetStats,
  insertEvalRun,
  type AgentAction,
} from "../lib/db.ts";
import { classify, CLASSIFIER_VERSION } from "../lib/classifier.ts";
import { HAIKU_4_5, SONNET_4_6 } from "../lib/pricing.ts";

const SYNTHETIC_NOTE_PREFIX = "v1 baseline — synthetic";

type GoldenJoin = AgentAction & { human_label: "correct" | "incorrect" | "needs_review" };

async function main() {
  const goldens = (await sql`
    select a.id, a.agent_id, a.timestamp, a.input, a.context, a.output,
           a.tool_calls, a.autonomy_level, a.created_at,
           g.human_label
    from golden_set g
    join agent_actions a on a.id = g.action_id
    order by g.labeled_at asc
  `) as unknown as GoldenJoin[];

  if (goldens.length === 0) {
    const stats = await getDatasetStats();
    const escalationRate = stats.finalClassifications > 0
      ? stats.escalationCount / stats.finalClassifications
      : 0;
    const { id } = await insertEvalRun({
      classifier_version: CLASSIFIER_VERSION,
      model_primary: HAIKU_4_5,
      model_escalation: SONNET_4_6,
      total_actions: stats.totalActions,
      accuracy: 1.0,
      precision_score: 1.0,
      recall_score: 1.0,
      total_cost_usd: stats.totalCostUsd,
      escalation_rate: escalationRate,
      notes: `${SYNTHETIC_NOTE_PREFIX} — golden set is empty (no human labels yet); current is_final classifications used as ground-truth proxy. Awaiting real labels from /review.`,
    });
    console.log(`eval: synthetic baseline row inserted (id=${id})`);
    console.log(`  total_actions=${stats.totalActions}, total_cost=$${stats.totalCostUsd.toFixed(4)}, escalation_rate=${(escalationRate * 100).toFixed(1)}%`);
    return;
  }

  console.log(`eval: re-classifying ${goldens.length} golden-set entries`);
  let attempted = 0;
  let totalCost = 0;
  let escalations = 0;
  const tp: Record<string, number> = { correct: 0, incorrect: 0, needs_review: 0 };
  const fp: Record<string, number> = { correct: 0, incorrect: 0, needs_review: 0 };
  const fn: Record<string, number> = { correct: 0, incorrect: 0, needs_review: 0 };
  let correctCount = 0;

  for (const g of goldens) {
    attempted++;
    try {
      const result = await classify(g);
      totalCost += result.total_cost_usd;
      if (result.sonnet) escalations++;
      const pred = result.final.classification.classification;
      const truth = g.human_label;
      if (pred === truth) {
        correctCount++;
        tp[truth] = (tp[truth] ?? 0) + 1;
      } else {
        fp[pred] = (fp[pred] ?? 0) + 1;
        fn[truth] = (fn[truth] ?? 0) + 1;
      }
    } catch (err) {
      console.error(`eval: error on action ${g.id}:`, err);
    }
    if (attempted % 10 === 0) {
      console.log(`  ${attempted}/${goldens.length} re-classified, $${totalCost.toFixed(3)} spent`);
    }
  }

  const accuracy = correctCount / goldens.length;
  const classes = ["correct", "incorrect", "needs_review"];
  const validPrecs = classes
    .map((c) => {
      const t = tp[c] ?? 0;
      const f = fp[c] ?? 0;
      return t + f === 0 ? null : t / (t + f);
    })
    .filter((x): x is number => x !== null);
  const validRecs = classes
    .map((c) => {
      const t = tp[c] ?? 0;
      const f = fn[c] ?? 0;
      return t + f === 0 ? null : t / (t + f);
    })
    .filter((x): x is number => x !== null);
  const precision = validPrecs.length > 0
    ? validPrecs.reduce((a, b) => a + b, 0) / validPrecs.length
    : 0;
  const recall = validRecs.length > 0
    ? validRecs.reduce((a, b) => a + b, 0) / validRecs.length
    : 0;
  const escalationRate = escalations / goldens.length;

  const { id } = await insertEvalRun({
    classifier_version: CLASSIFIER_VERSION,
    model_primary: HAIKU_4_5,
    model_escalation: SONNET_4_6,
    total_actions: goldens.length,
    accuracy,
    precision_score: precision,
    recall_score: recall,
    total_cost_usd: totalCost,
    escalation_rate: escalationRate,
    notes: `Re-classified ${goldens.length} golden-set entries against the current prompt.`,
  });
  console.log(`\neval: real run inserted (id=${id})`);
  console.log(`  accuracy=${accuracy.toFixed(3)}, precision=${precision.toFixed(3)}, recall=${recall.toFixed(3)}`);
  console.log(`  total_cost=$${totalCost.toFixed(4)}, escalation_rate=${(escalationRate * 100).toFixed(1)}%`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
