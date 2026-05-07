// Tiny helpers for the demo password gate. Web Crypto only — runs in both the
// Edge middleware and the Node route handler without any extra deps.

export const COHERENCE_AUTH_COOKIE = "coherence_auth";

export async function hashPassword(p: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(p));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
