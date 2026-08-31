"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthScreen } from "@/components/AuthScreen";
import { NameSetup } from "@/components/NameSetup";
import { PwaRegister } from "@/components/Pwa";
import { Tracker } from "@/components/Tracker";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { userName } from "@/lib/user";

export default function HomePage() {
  const configured = hasSupabaseConfig();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!configured);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  if (!hasSupabaseConfig()) {
    return (
      <main className="auth-wrap">
        <section className="auth-card">
          <h1>Almost ready</h1>
          <p className="lede">
            Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code>,
            then restart the dev server. See the README for Supabase setup.
          </p>
        </section>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="auth-wrap">
        <p className="empty">Loading…</p>
      </main>
    );
  }

  return (
    <>
      <PwaRegister />
      {session?.user ? (
        userName(session.user) ? (
          <Tracker user={session.user} />
        ) : (
          <NameSetup user={session.user} />
        )
      ) : (
        <AuthScreen />
      )}
    </>
  );
}
