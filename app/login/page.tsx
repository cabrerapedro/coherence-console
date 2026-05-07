"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setSubmitting(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
      return;
    }
    setError("Wrong password.");
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-24">
      <h1 className="text-lg font-semibold tracking-tight">Coherence Console — demo access</h1>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          className="rounded border border-current/30 bg-transparent px-3 py-2 text-sm"
          aria-label="password"
        />
        <button
          type="submit"
          disabled={submitting || password.length === 0}
          className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "…" : "Enter"}
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </form>
    </main>
  );
}
