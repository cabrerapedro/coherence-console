import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getActionById,
  recordClassificationCascade,
  uploadPrefixForSession,
} from "@/lib/db";
import { classify, CLASSIFIER_VERSION, ClassifierError } from "@/lib/classifier";
import { UPLOAD_SESSION_COOKIE } from "@/middleware";

export const runtime = "nodejs";

// Classifies one action by id. The client can iterate this endpoint to process
// many uploaded rows without hitting Vercel's per-function timeout (each call
// finishes in seconds). Scoped to the caller's session — you cannot classify
// another reviewer's uploads or someone's demo case from this endpoint.
export async function POST(req: Request) {
  let body: { action_id?: unknown };
  try {
    body = (await req.json()) as { action_id?: unknown };
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 });
  }
  const action_id = typeof body.action_id === "string" ? body.action_id : "";
  if (!action_id) {
    return NextResponse.json({ error: "missing action_id" }, { status: 400 });
  }

  const action = await getActionById(action_id);
  if (!action) {
    return NextResponse.json({ error: "action not found" }, { status: 404 });
  }

  // Only allow classifying actions that belong to the caller's upload session.
  // Demo dataset (aloha-*) is classified by the CLI scripts, not this route.
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(UPLOAD_SESSION_COOKIE)?.value;
  if (!sessionId) {
    return NextResponse.json(
      { error: "no upload session" },
      { status: 403 },
    );
  }
  const sessionPrefix = uploadPrefixForSession(sessionId);
  if (!action.agent_id.startsWith(sessionPrefix)) {
    return NextResponse.json(
      { error: "action does not belong to this upload session" },
      { status: 403 },
    );
  }

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
    return NextResponse.json({
      ok: true,
      action_id,
      cost_usd: Number(result.total_cost_usd.toFixed(6)),
      escalated: !!result.sonnet,
    });
  } catch (err) {
    const kind = err instanceof ClassifierError ? err.kind : "unknown";
    return NextResponse.json({ ok: false, action_id, error: kind }, { status: 500 });
  }
}
