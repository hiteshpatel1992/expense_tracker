"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { AuthScreen } from "@/components/AuthScreen";
import { NameSetup } from "@/components/NameSetup";
import { PwaRegister } from "@/components/Pwa";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import { isAdmin, userName } from "@/lib/user";

export function SignedIn({
  children,
}: {
  children: (ctx: { user: User; profile: Profile }) => ReactNode;
}) {
  const configured = hasSupabaseConfig();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(!configured);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    async function sync() {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      const nextUser = data.session?.user ?? null;
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setReady(true);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (token) {
        await fetch("/api/admin/ensure", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      const { data: row } = await supabase
        .from("profiles")
        .select("id, email, full_name, role")
        .eq("id", nextUser.id)
        .maybeSingle();
      setProfile((row as Profile | null) ?? null);
      setReady(true);
    }

    void sync();
    const { data } = supabase.auth.onAuthStateChange(() => {
      void sync();
    });
    const onProfile = () => {
      void sync();
    };
    window.addEventListener("profile-updated", onProfile);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("profile-updated", onProfile);
    };
  }, []);

  if (!hasSupabaseConfig()) {
    return (
      <main className="auth-wrap">
        <section className="auth-card">
          <h1>Almost ready</h1>
          <p className="lede">
            Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code>.
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
      {!user ? (
        <AuthScreen />
      ) : !userName(user, profile) ? (
        <NameSetup user={user} />
      ) : (
        children({
          user,
          profile: profile ?? {
            id: user.id,
            email: user.email ?? null,
            full_name: userName(user),
            role: isAdmin(null, user) ? "admin" : "member",
          },
        })
      )}
    </>
  );
}
