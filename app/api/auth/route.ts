import { NextResponse } from "next/server";
import { COHERENCE_AUTH_COOKIE, constantTimeEqual, hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const password = process.env.ACCESS_PASSWORD;
  if (!password) {
    // Gate disabled — accept any login attempt without setting a cookie.
    return NextResponse.json({ ok: true, gated: false });
  }

  const body = (await req.json().catch(() => ({}))) as { password?: unknown };
  const submitted = typeof body.password === "string" ? body.password : "";

  if (!constantTimeEqual(submitted, password)) {
    return NextResponse.json({ error: "invalid password" }, { status: 401 });
  }

  const hashed = await hashPassword(password);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COHERENCE_AUTH_COOKIE, hashed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });
  return res;
}
