import { NextResponse } from "next/server";
import { getActionById, upsertGoldenLabel } from "@/lib/db";

const VALID_LABELS = new Set(["correct", "incorrect", "needs_review"] as const);

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    action_id?: unknown;
    human_label?: unknown;
    human_note?: unknown;
  };

  const action_id = typeof body.action_id === "string" ? body.action_id : "";
  const human_label = typeof body.human_label === "string" ? body.human_label : "";
  const human_note = typeof body.human_note === "string" ? body.human_note : null;

  if (!action_id) {
    return NextResponse.json({ error: "missing action_id" }, { status: 400 });
  }
  if (!VALID_LABELS.has(human_label as "correct" | "incorrect" | "needs_review")) {
    return NextResponse.json({ error: "invalid human_label" }, { status: 400 });
  }

  const action = await getActionById(action_id);
  if (!action) {
    return NextResponse.json({ error: "action not found" }, { status: 404 });
  }

  await upsertGoldenLabel(
    action_id,
    human_label as "correct" | "incorrect" | "needs_review",
    human_note,
  );

  return NextResponse.json({ ok: true });
}
