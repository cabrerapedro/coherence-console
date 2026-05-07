import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { batchInsertAgentActions, type AgentActionInput } from "../lib/db.ts";

const metadataSchema = z.object({
  version: z.string(),
  created: z.string(),
  purpose: z.string(),
  distribution: z.object({
    correct: z.number().int().nonnegative(),
    incorrect: z.number().int().nonnegative(),
    ambiguous: z.number().int().nonnegative(),
    policy_violation: z.number().int().nonnegative(),
    autonomy_violation: z.number().int().nonnegative(),
  }),
  notes: z.string().optional(),
});

const actionSchema = z
  .object({
    agent_id: z.string().min(1),
    timestamp: z.iso.datetime({ offset: true }),
    input: z.string().min(1),
    context: z.string().nullable(),
    output: z.string().min(1),
    tool_calls: z.array(z.string()),
    autonomy_level: z.number().int().min(1).max(4),
  })
  .strict();

function stripDesignFields(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !k.startsWith("_")));
}

async function main() {
  const path = resolve(process.cwd(), "data/synthetic_actions.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as { metadata: unknown; actions: unknown };

  const metadata = metadataSchema.parse(raw.metadata);
  const expected = Object.values(metadata.distribution).reduce((a, b) => a + b, 0);
  console.log(`seed_eighty: dataset v${metadata.version} created ${metadata.created}`);
  console.log("seed_eighty: distribution", metadata.distribution, `(total ${expected})`);

  if (!Array.isArray(raw.actions)) throw new Error("dataset.actions must be an array");
  if (raw.actions.length !== expected) {
    console.warn(
      `seed_eighty: WARNING actions.length=${raw.actions.length} but distribution sums to ${expected}`,
    );
  }

  const valid: AgentActionInput[] = [];
  const failed: { index: number; error: string }[] = [];
  for (let i = 0; i < raw.actions.length; i++) {
    const stripped = stripDesignFields(raw.actions[i] as Record<string, unknown>);
    const parsed = actionSchema.safeParse(stripped);
    if (parsed.success) {
      valid.push(parsed.data);
    } else {
      const msg = parsed.error.issues
        .map((x) => `${x.path.join(".") || "(root)"}: ${x.message}`)
        .join("; ");
      failed.push({ index: i, error: msg });
    }
  }

  console.log(`seed_eighty: ${valid.length} valid, ${failed.length} failed validation`);
  for (const f of failed) console.error(`  action[${f.index}]: ${f.error}`);

  if (valid.length === 0) {
    console.log("seed_eighty: nothing to insert");
    if (failed.length > 0) process.exit(1);
    return;
  }

  const { insertedCount, skippedCount } = await batchInsertAgentActions(valid);
  console.log(`seed_eighty: inserted ${insertedCount}, skipped ${skippedCount} (already present)`);
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
