import { NextRequest, NextResponse } from "next/server";
import { COHERENCE_AUTH_COOKIE, constantTimeEqual, hashPassword } from "@/lib/auth";

const PUBLIC_PREFIXES = ["/login", "/api/auth"];

export const UPLOAD_SESSION_COOKIE = "coherence_upload_session";
const SESSION_BYTES = 4; // 8 hex chars

function generateSessionId(): string {
  const arr = new Uint8Array(SESSION_BYTES);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function attachSessionIfMissing(req: NextRequest, res: NextResponse): NextResponse {
  if (req.cookies.get(UPLOAD_SESSION_COOKIE)) return res;
  res.cookies.set(UPLOAD_SESSION_COOKIE, generateSessionId(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return attachSessionIfMissing(req, NextResponse.next());
  }

  const password = process.env.ACCESS_PASSWORD;
  // No password configured → gate disabled (local dev convenience).
  if (!password) return attachSessionIfMissing(req, NextResponse.next());

  const cookie = req.cookies.get(COHERENCE_AUTH_COOKIE)?.value;
  const expected = await hashPassword(password);
  const authed = !!cookie && constantTimeEqual(cookie, expected);

  if (authed) return attachSessionIfMissing(req, NextResponse.next());

  // API routes get a 401; pages get a redirect to /login.
  if (pathname.startsWith("/api/")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals + static assets; the rest goes through middleware.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
