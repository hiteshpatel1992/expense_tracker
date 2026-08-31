"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { PwaRegister } from "@/components/Pwa";
import { ResetPassword } from "@/components/ResetPassword";
import { getSupabase } from "@/lib/supabase";

export default function ResetPage() {
  const configured = Boolean(getSupabase());
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!configured);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setUser(session?.user ?? null);
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

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
      <ResetPassword user={user} />
    </>
  );
}
