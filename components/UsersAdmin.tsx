"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/admin";
import { AppHeader } from "@/components/AppHeader";
import { getSupabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import { isAdmin } from "@/lib/user";

type ListedUser = Profile & { created_at?: string; protected?: boolean };

export function UsersAdmin({
  user,
  profile,
}: {
  user: User;
  profile: Profile | null;
}) {
  const [users, setUsers] = useState<ListedUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;
    const res = await fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { users?: ListedUser[]; error?: string };
    if (!res.ok) {
      setError(body.error ?? "Could not load users.");
      return;
    }
    setUsers(body.users ?? []);
    setError(null);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void load();
    });
    return () => cancelAnimationFrame(frame);
  }, [load]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
      }),
    });
    const body = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not create user.");
      return;
    }
    setFullName("");
    setEmail("");
    setPassword("");
    setMessage("User created. They can sign in now.");
    await load();
  }

  async function onDelete(person: ListedUser) {
    if (isAdminEmail(person.email) || person.protected) return;
    if (!window.confirm(`Delete ${person.email}? They will not be able to sign in.`)) {
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("Sign in again, then try deleting the user.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/admin/users?id=${encodeURIComponent(person.id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not delete user.");
      return;
    }
    setMessage("User deleted.");
    await load();
  }

  if (!isAdmin(profile, user)) {
    return (
      <div className="page">
        <AppHeader user={user} profile={profile} title="Users" />
        <p className="banner error">Only an admin can manage users.</p>
        <Link href="/">Back to companies</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <AppHeader user={user} profile={profile} title="Users" />
      <p>
        <Link href="/">← All companies</Link>
      </p>
      {error && <p className="banner error">{error}</p>}
      {message && <p className="banner ok">{message}</p>}

      <section className="panel">
        <h2>Add user</h2>
        <form className="expense-form" onSubmit={onSubmit}>
          <label>
            Name
            <input
              type="text"
              required
              minLength={2}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="wide">
            Temporary password
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? "Creating…" : "Create user"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>People</h2>
        <p className="empty">
          nirav@thefitway.io is the primary admin. That account cannot be deleted
          or demoted.
        </p>
        <div className="table-wrap">
          <table className="expense-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th> </th>
              </tr>
            </thead>
            <tbody>
              {users.map((person) => {
                const locked = Boolean(person.protected || isAdminEmail(person.email));
                return (
                  <tr key={person.id}>
                    <td>{person.full_name || "—"}</td>
                    <td>{person.email}</td>
                    <td>{locked ? "admin (protected)" : person.role}</td>
                    <td>
                      <div className="table-actions">
                        {locked ? (
                          <span className="empty">Cannot delete</span>
                        ) : (
                          <button
                            type="button"
                            className="danger-link"
                            disabled={busy}
                            onClick={() => onDelete(person)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
