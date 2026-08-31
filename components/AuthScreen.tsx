"use client";

import { useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";

type Mode = "signin" | "forgot";

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "forgot") {
        const origin = window.location.origin;
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: `${origin}/reset` },
        );
        if (resetError) throw resetError;
        setMessage("If that email exists, a reset link is on its way.");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <p className="eyebrow">Organization ledger</p>
        <h1>P&amp;L tracker</h1>
        <p className="lede">
          Sign in with the account your admin created. New accounts cannot be
          created from this screen.
        </p>

        <form onSubmit={onSubmit} className="stack">
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          {mode !== "forgot" && (
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}

          {error && <p className="banner error">{error}</p>}
          {message && <p className="banner ok">{message}</p>}

          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Please wait…" : mode === "forgot" ? "Send reset link" : "Sign in"}
          </button>
        </form>

        {mode === "signin" && (
          <button type="button" className="linkish" onClick={() => setMode("forgot")}>
            Forgot password?
          </button>
        )}
        {mode === "forgot" && (
          <button type="button" className="linkish" onClick={() => setMode("signin")}>
            Back to sign in
          </button>
        )}
      </section>
    </main>
  );
}
