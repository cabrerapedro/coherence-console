import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  batchInsertAgentActions,
  getDatasetActionCount,
  uploadPrefixForSession,
  UPLOAD_GLOBAL_PREFIX,
  type AgentActionInput,
} from "@/lib/db";
import { UPLOAD } from "@/lib/ui-copy";
import { UPLOAD_SESSION_COOKIE } from "@/middleware";

export const runtime = "nodejs";

const GLOBAL_UPLOAD_CAP = 100;

const actionSchema = z
  .object({
    agent_id: z.string().min(1).max(120),
    timestamp: z.iso.datetime({ offset: true }),
    input: z.string().min(1).max(8000),
    context: z.string().nullable(),
    output: z.string().min(1).max(8000),
    tool_calls: z.array(z.string().max(120)).max(20),
    autonomy_level: z.number().int().min(1).max(4),
  })
  .strict();

const wrapperSchema = z.object({
  metadata: z.unknown().optional(),
  actions: z.array(actionSchema).min(1).max(UPLOAD.cap),
});

const arraySchema = z.array(actionSchema).min(1).max(UPLOAD.cap);

function stripDesignFields(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !k.startsWith("_")));
}

function normalizeToActions(raw: unknown): AgentActionInput[] {
  let candidates: unknown[];
  if (Array.isArray(raw)) {
    candidates = raw;
  } else if (raw && typeof raw === "object" && Array.isArray((raw as { actions?: unknown }).actions)) {
    candidates = (raw as { actions: unknown[] }).actions;
  } else if (raw && typeof raw === "object") {
    candidates = [raw];
  } else {
    throw new Error("Body must be a JSON object, array, or wrapper with `actions`.");
  }

  const stripped = candidates.map((c) =>
    c && typeof c === "object" ? stripDesignFields(c as Record<string, unknown>) : c,
  );

  const arrParse = arraySchema.safeParse(stripped);
  if (!arrParse.success) {
    const issues = arrParse.error.issues
      .slice(0, 3)
      .map((i) => `actions[${i.path.join(".")}] ${i.message}`)
      .join("; ");
    throw new Error(`Validation failed: ${issues}`);
  }
  return arrParse.data;
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 });
  }

  const wrapped = wrapperSchema.safeParse(raw);
  const payload = wrapped.success ? wrapped.data.actions : raw;

  let actions: AgentActionInput[];
  try {
    actions = normalizeToActions(payload);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid payload." },
      { status: 400 },
    );
  }

  if (actions.length > UPLOAD.cap) {
    return NextResponse.json(
      { error: `Too many actions: ${actions.length}. Max ${UPLOAD.cap} per upload.` },
      { status: 400 },
    );
  }

  // Global cap across all sessions. This is a case study, not a product —
  // when the cap is reached, it's reached. The 80-action included dataset
  // remains fully reviewable regardless.
  const currentGlobal = await getDatasetActionCount(UPLOAD_GLOBAL_PREFIX);
  if (currentGlobal + actions.length > GLOBAL_UPLOAD_CAP) {
    return NextResponse.json(
      {
        error: "demo capacity reached",
        limit: GLOBAL_UPLOAD_CAP,
        current: currentGlobal,
        message: `This demo has a hard cap of ${GLOBAL_UPLOAD_CAP} user-uploaded actions across all sessions. ${currentGlobal} of ${GLOBAL_UPLOAD_CAP} have been used. The 80-action included dataset remains fully reviewable.`,
      },
      { status: 429 },
    );
  }

  // Resolve the session id from the cookie middleware sets on every request.
  // If somehow absent (caller bypasses middleware), mint one inline so the
  // request still completes — the response will set it for future calls.
  const cookieStore = await cookies();
  let sessionId = cookieStore.get(UPLOAD_SESSION_COOKIE)?.value;
  let mintedHere = false;
  if (!sessionId) {
    const arr = new Uint8Array(4);
    crypto.getRandomValues(arr);
    sessionId = Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
    mintedHere = true;
  }

  const sessionPrefix = uploadPrefixForSession(sessionId);
  // Strip any pre-existing aloha-/upload- prefix from the user's agent_id and
  // re-prefix with this session's namespace. This guarantees uploads never
  // masquerade as demo cases and stay scoped to the originating cookie.
  const prefixed: AgentActionInput[] = actions.map((a) => ({
    ...a,
    agent_id: `${sessionPrefix}${a.agent_id.replace(/^(upload-[a-f0-9]+-|aloha-)/, "")}`,
  }));

  const { insertedCount, skippedCount } = await batchInsertAgentActions(prefixed);

  const res = NextResponse.json({
    ok: true,
    inserted: insertedCount,
    skipped: skippedCount,
    submitted: actions.length,
    session_id: sessionId,
  });

  if (mintedHere) {
    res.cookies.set(UPLOAD_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
  }

  return res;
}
