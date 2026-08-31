"use client";

import { useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";

type Mode = "signin" | "signup" | "forgot";

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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

      if (mode === "signup") {
        const fullName = name.trim();
        if (fullName.length < 2) {
          throw new Error("Enter your name.");
        }
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }
        if (password !== confirm) {
          throw new Error("Passwords do not match.");
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName } },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setMessage(
            "Account created. If email confirmation is on, check your inbox before signing in.",
          );
        }
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
        <p className="eyebrow">Shared household ledger</p>
        <h1>Expenses</h1>
        <p className="lede">
          Create an account with your name, email, and password. Everyone who
          signs in sees the same expenses.
        </p>

        <div className="tabs" role="tablist">
          <button
            type="button"
            className={mode === "signin" ? "tab active" : "tab"}
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === "signup" ? "tab active" : "tab"}
            onClick={() => setMode("signup")}
          >
            Create account
          </button>
        </div>

        <form onSubmit={onSubmit} className="stack">
          {mode === "signup" && (
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
          )}
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
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}

          {mode === "signup" && (
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
          )}

          {error && <p className="banner error">{error}</p>}
          {message && <p className="banner ok">{message}</p>}

          <button type="submit" className="btn primary" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "signup"
                ? "Create account"
                : mode === "forgot"
                  ? "Send reset link"
                  : "Sign in"}
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
