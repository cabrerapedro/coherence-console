import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getActionById, upsertGoldenLabel, uploadPrefixForSession } from "@/lib/db";
import { UPLOAD_SESSION_COOKIE } from "@/middleware";

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

  // Demo (aloha-*) actions: shared-label per the v1 design — any authenticated
  // reviewer can label or re-label, and the latest write wins. This is the
  // documented overwrite behavior in the README.
  // Upload (upload-*) actions: private to the session that owns them.
  // Cross-session label writes are rejected to protect each reviewer's
  // private dataset from poisoning by other authenticated viewers.
  if (action.agent_id.startsWith("upload-")) {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(UPLOAD_SESSION_COOKIE)?.value;
    if (!sessionId) {
      return NextResponse.json({ error: "no upload session" }, { status: 403 });
    }
    if (!action.agent_id.startsWith(uploadPrefixForSession(sessionId))) {
      return NextResponse.json(
        { error: "this upload belongs to another session" },
        { status: 403 },
      );
    }
  }

  await upsertGoldenLabel(
    action_id,
    human_label as "correct" | "incorrect" | "needs_review",
    human_note,
  );

  return NextResponse.json({ ok: true });
}
