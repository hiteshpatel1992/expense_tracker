"use client";

import { useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

export function NameSetup({ user }: { user: User }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    const fullName = name.trim();
    if (fullName.length < 2) {
      setError("Enter your name.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({
      data: { full_name: fullName },
    });
    setBusy(false);
    if (updateError) setError(updateError.message);
  }

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <p className="eyebrow">Almost there</p>
        <h1>What’s your name?</h1>
        <p className="lede">
          This name is stored on your account and used on every expense you add.
          Signed in as {user.email}.
        </p>
        <form onSubmit={onSubmit} className="stack">
          <label>
            Your name
            <input
              type="text"
              autoComplete="name"
              required
              minLength={2}
              placeholder="e.g. Hitesh"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {error && <p className="banner error">{error}</p>}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Saving…" : "Continue"}
          </button>
        </form>
      </section>
    </main>
  );
}
