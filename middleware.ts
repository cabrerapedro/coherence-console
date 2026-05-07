import { NextRequest, NextResponse } from "next/server";
import { COHERENCE_AUTH_COOKIE, constantTimeEqual, hashPassword } from "@/lib/auth";

const PUBLIC_PREFIXES = ["/login", "/api/auth"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const password = process.env.ACCESS_PASSWORD;
  // No password configured → gate disabled (local dev convenience).
  if (!password) return NextResponse.next();

  const cookie = req.cookies.get(COHERENCE_AUTH_COOKIE)?.value;
  const expected = await hashPassword(password);
  const authed = !!cookie && constantTimeEqual(cookie, expected);

  if (authed) return NextResponse.next();

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
