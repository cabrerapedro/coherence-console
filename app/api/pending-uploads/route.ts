import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUnclassifiedActionsForPrefix, uploadPrefixForSession } from "@/lib/db";
import { UPLOAD_SESSION_COOKIE } from "@/middleware";

export const runtime = "nodejs";

// Returns the action_ids of every uploaded action in the caller's session that
// does not yet have an is_final classification. Used by the upload form (to
// drive the classify-one loop after insert) and by /review's "Classify pending"
// CTA when the user navigates back to a partially-classified set.
export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(UPLOAD_SESSION_COOKIE)?.value;
  if (!sessionId) {
    return NextResponse.json({ action_ids: [] });
  }
  const pending = await getUnclassifiedActionsForPrefix(uploadPrefixForSession(sessionId));
  return NextResponse.json({
    action_ids: pending.map((a) => a.id),
  });
}
