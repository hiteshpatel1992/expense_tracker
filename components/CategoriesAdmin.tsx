"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { AppHeader } from "@/components/AppHeader";
import { getSupabase } from "@/lib/supabase";
import type { Category, EntryType, Profile } from "@/lib/types";

type Props = {
  user: User;
  profile: Profile | null;
};

export function CategoriesAdmin({ user, profile }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [incomeName, setIncomeName] = useState("");
  const [expenseName, setExpenseName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;
    const res = await fetch("/api/categories", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { categories?: Category[]; error?: string };
    if (!res.ok) {
      setError(body.error ?? "Could not load categories.");
      return;
    }
    setCategories(body.categories ?? []);
    setError(null);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void load();
    });
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const income = useMemo(
    () => categories.filter((row) => row.type === "income"),
    [categories],
  );
  const expense = useMemo(
    () => categories.filter((row) => row.type === "expense"),
    [categories],
  );

  async function authToken() {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function addCategory(type: EntryType, name: string) {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Enter a category name.");
      return;
    }
    const token = await authToken();
    if (!token) {
      setError("Sign in again, then try adding the category.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: trimmed, type }),
    });
    const body = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not add the category.");
      return;
    }
    if (type === "income") setIncomeName("");
    else setExpenseName("");
    setMessage("Category added.");
    await load();
  }

  async function saveRename(category: Category) {
    const trimmed = editingName.trim();
    if (trimmed.length < 2) {
      setError("Enter a category name.");
      return;
    }
    const token = await authToken();
    if (!token) {
      setError("Sign in again, then try renaming the category.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/categories", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: category.id, name: trimmed }),
    });
    const body = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not rename the category.");
      return;
    }
    setEditingId(null);
    setMessage(
      trimmed === category.name
        ? "Category saved."
        : "Category renamed. Existing records were updated.",
    );
    await load();
  }

  async function onDelete(category: Category) {
    if (!window.confirm(`Delete category “${category.name}”?`)) return;
    const token = await authToken();
    if (!token) {
      setError("Sign in again, then try deleting the category.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/categories?id=${encodeURIComponent(category.id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not delete the category.");
      return;
    }
    setMessage("Category deleted.");
    await load();
  }

  function list(type: EntryType, rows: Category[], name: string, setName: (value: string) => void) {
    async function onAdd(event: FormEvent) {
      event.preventDefault();
      await addCategory(type, name);
    }

    return (
      <section className="panel">
        <h2>{type === "income" ? "Income" : "Expense"}</h2>
        <form className="category-add" onSubmit={onAdd}>
          <label>
            New category
            <input
              type="text"
              minLength={2}
              placeholder={type === "income" ? "Sales" : "Office rent"}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button type="submit" className="btn primary compact" disabled={busy}>
            Add
          </button>
        </form>
        {rows.length === 0 ? (
          <p className="empty">No categories yet.</p>
        ) : (
          <ul className="category-list">
            {rows.map((row) => (
              <li
                key={row.id}
                className={
                  editingId === row.id ? "category-row editing" : "category-row"
                }
              >
                <div className="category-name">
                  {editingId === row.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void saveRename(row);
                        }
                      }}
                    />
                  ) : (
                    row.name
                  )}
                </div>
                <div className="table-actions">
                  {editingId === row.id ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveRename(row)}
                      >
                        Save
                      </button>
                      <button type="button" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(row.id);
                          setEditingName(row.name);
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="danger-link"
                        disabled={busy}
                        onClick={() => void onDelete(row)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <div className="page">
      <AppHeader user={user} profile={profile} title="Categories" />
      <p>
        <Link href="/">← All companies</Link>
      </p>
      <p className="banner shared">
        These categories appear when you add income or expense. Renaming updates
        existing records. You cannot delete a category that is still in use.
      </p>
      {error && <p className="banner error">{error}</p>}
      {message && <p className="banner ok">{message}</p>}
      <div className="split-grid">
        {list("income", income, incomeName, setIncomeName)}
        {list("expense", expense, expenseName, setExpenseName)}
      </div>
    </div>
  );
}
