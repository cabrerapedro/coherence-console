// Writes a frozen JSON snapshot of the current is_final classifications for the
// hand-designed dataset (agent_id LIKE 'aloha-%'). The snapshot is committable
// alongside the dataset so the repo carries reproducible record of what the
// classifier said at a point in time — useful for README quoting and for
// diff-able commit history of classifier behavior across prompt iterations.
//
//   npm run dump:classifications              # writes data/classifications_v1_block_full.json
//   npm run dump:classifications -- v2_post   # writes data/classifications_v2_post.json

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "../lib/db.ts";
import { CLASSIFIER_VERSION } from "../lib/classifier.ts";
import { HAIKU_4_5, SONNET_4_6 } from "../lib/pricing.ts";

const CASCADE_RULE =
  "fires when ANY of: (a) confidence < 0.7; (b) classification === 'needs_review'; (c) classification === 'correct' AND policy_violations non-empty";

type SnapshotRow = {
  action_id: string;
  agent_id: string;
  timestamp: string;
  classification: string;
  confidence: number;
  reasoning_steps: string[];
  policy_violations: string[];
  autonomy_appropriate: boolean;
  escalation_recommended: boolean;
  model_used: string;
  cost_usd: number;
  is_final: boolean;
};

async function main() {
  const label = process.argv[2] ?? "v1_block_full";
  const outPath = resolve(process.cwd(), `data/classifications_${label}.json`);

  const finalRows = (await sql`
    select c.action_id, a.agent_id, a.timestamp::text as timestamp,
           c.classification, c.confidence::text as confidence,
           c.reasoning_steps, c.policy_violations,
           c.autonomy_appropriate, c.escalation_recommended,
           c.model_used, c.cost_usd::text as cost_usd, c.is_final
    from classifications c
    join agent_actions a on a.id = c.action_id
    where c.is_final = true and a.agent_id like 'aloha-%'
    order by a.timestamp asc
  `) as Array<Omit<SnapshotRow, "confidence" | "cost_usd"> & { confidence: string; cost_usd: string }>;

  const classifications: SnapshotRow[] = finalRows.map((r) => ({
    ...r,
    confidence: Number(r.confidence),
    cost_usd: Number(r.cost_usd),
  }));

  // Total cost = sum of the most recent cascade per action. recordClassification-
  // Cascade writes Haiku + (optionally) Sonnet rows within milliseconds of each
  // other, so a 60-second window from each action's latest row captures both
  // legs of an escalated cascade and just the Haiku leg of a non-escalated one.
  // This is robust across multiple historical runs of classify_all on the same
  // dataset (each action's "latest" stays anchored to its own most-recent run).
  const costRows = (await sql`
    with latest as (
      select c.action_id, max(c.created_at) as max_ca
      from classifications c
      join agent_actions a on a.id = c.action_id
      where a.agent_id like 'aloha-%'
      group by c.action_id
    )
    select c.cost_usd::text as cost_usd
    from classifications c
    join latest l on l.action_id = c.action_id
    where c.created_at >= l.max_ca - interval '60 seconds'
  `) as { cost_usd: string }[];
  const totalCost = costRows.reduce((s, r) => s + Number(r.cost_usd), 0);

  const escalatedRows = classifications.filter((r) => r.model_used === SONNET_4_6);
  const byClassification = classifications.reduce<Record<string, number>>((acc, r) => {
    acc[r.classification] = (acc[r.classification] ?? 0) + 1;
    return acc;
  }, {});

  const snapshot = {
    metadata: {
      label,
      classifier_version: CLASSIFIER_VERSION,
      model_primary: HAIKU_4_5,
      model_escalation: SONNET_4_6,
      cascade_rule: CASCADE_RULE,
      total_actions: classifications.length,
      escalation_count: escalatedRows.length,
      escalation_rate: classifications.length > 0
        ? Number((escalatedRows.length / classifications.length).toFixed(4))
        : 0,
      total_cost_usd: Number(totalCost.toFixed(6)),
      summary: {
        by_classification: byClassification,
        policy_violations_flagged: classifications.filter((r) => r.policy_violations.length > 0).length,
        autonomy_appropriate_false: classifications.filter((r) => !r.autonomy_appropriate).length,
        escalation_recommended_true: classifications.filter((r) => r.escalation_recommended).length,
      },
      generated_at: new Date().toISOString(),
    },
    classifications,
  };

  writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`dump_classifications: wrote ${classifications.length} rows to ${outPath}`);
  console.log(
    `  total_cost: $${totalCost.toFixed(6)}, escalations: ${escalatedRows.length}, by class: ${JSON.stringify(byClassification)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
