"use client";

import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { InstallPrompt } from "@/components/Pwa";
import { getSupabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import { isAdmin, userName } from "@/lib/user";

export function AppHeader({
  user,
  profile,
  title = "P&L tracker",
}: {
  user: User;
  profile: Profile | null;
  title?: string;
}) {
  const admin = isAdmin(profile, user);
  const name = userName(user, profile);

  async function signOut() {
    await getSupabase()?.auth.signOut();
  }

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Organization ledger</p>
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        <InstallPrompt />
        <Link className="btn ghost compact" href="/categories">
          Categories
        </Link>
        {admin && (
          <Link className="btn ghost compact" href="/admin/users">
            Users
          </Link>
        )}
        <span className="who">
          <strong>{name}</strong>
          <em>{user.email}</em>
        </span>
        <button type="button" className="btn ghost compact" onClick={signOut}>
          Sign out
        </button>
      </div>
    </header>
  );
}
