"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export function ResetPassword({ user }: { user: User | null }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const ready = useMemo(() => Boolean(user), [user]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
  }

  if (!ready) {
    return (
      <main className="auth-wrap">
        <section className="auth-card">
          <h1>Reset password</h1>
          <p className="lede">
            Open the reset link from your email in this browser. If you already
            have an account, sign in from the home page.
          </p>
          <Link className="btn primary" href="/">
            Back to sign in
          </Link>
        </section>
      </main>
    );
  }

  if (done) {
    return (
      <main className="auth-wrap">
        <section className="auth-card">
          <h1>Password updated</h1>
          <p className="lede">You can use the new password next time you sign in.</p>
          <Link className="btn primary" href="/">
            Go to expenses
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <h1>Choose a new password</h1>
        <form onSubmit={onSubmit} className="stack">
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {error && <p className="banner error">{error}</p>}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Saving…" : "Update password"}
          </button>
        </form>
      </section>
    </main>
  );
}
