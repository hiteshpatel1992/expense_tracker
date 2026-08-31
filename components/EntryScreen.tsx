"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { todayISO } from "@/lib/dates";
import { getSupabase } from "@/lib/supabase";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  type BankAccount,
  type Category,
  type Entry,
  type EntryDraft,
  type EntryType,
  type Profile,
} from "@/lib/types";
import { userName } from "@/lib/user";
import Link from "next/link";

function fallbackNames(type: EntryType): string[] {
  return type === "income"
    ? [...DEFAULT_INCOME_CATEGORIES]
    : [...DEFAULT_EXPENSE_CATEGORIES];
}

function emptyDraft(type: EntryType, bankAccountId: string, category: string): EntryDraft {
  return {
    date: todayISO(),
    amount: "",
    reason: "",
    category,
    notes: "",
    bankAccountId,
  };
}

function parseAmount(value: string): number | null {
  const n = Number(value.replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

type Props = {
  user: User;
  profile: Profile | null;
  companyId: string;
  accounts: BankAccount[];
  entry: Entry | null;
  defaultType: EntryType;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export function EntryScreen({
  user,
  profile,
  companyId,
  accounts,
  entry,
  defaultType,
  onClose,
  onSaved,
}: Props) {
  const type = entry?.type ?? defaultType;
  const [categories, setCategories] = useState<string[]>(() => fallbackNames(type));
  const [draft, setDraft] = useState<EntryDraft>(() =>
    entry
      ? {
          date: entry.date,
          amount: String(entry.amount),
          reason: entry.reason,
          category: entry.category,
          notes: entry.notes ?? "",
          bankAccountId: entry.bank_account_id,
        }
      : emptyDraft(type, accounts[0]?.id ?? "", fallbackNames(type)[0] ?? ""),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = userName(user, profile);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("categories")
        .select("name, type")
        .eq("type", type)
        .order("name");
      if (cancelled) return;
      const names = ((data ?? []) as Pick<Category, "name" | "type">[]).map((row) => row.name);
      const next = names.length > 0 ? names : fallbackNames(type);
      if (entry?.category && !next.includes(entry.category)) {
        next.unshift(entry.category);
      }
      setCategories(next);
      setDraft((prev) =>
        prev.category && next.includes(prev.category)
          ? prev
          : { ...prev, category: next[0] ?? "" },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [type, entry?.category]);

  async function onDone(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;

    const amount = parseAmount(draft.amount);
    const reason = draft.reason.trim();
    if (!draft.bankAccountId) {
      setError("Choose a bank account.");
      return;
    }
    if (!draft.category) {
      setError("Choose a category, or add one under Categories.");
      return;
    }
    if (!amount) {
      setError("Enter an amount greater than 0.");
      return;
    }
    if (!reason || !draft.date) {
      setError("Date and reason are required.");
      return;
    }

    setSaving(true);
    setError(null);

    if (entry) {
      const { error: histError } = await supabase.from("entry_edits").insert({
        entry_id: entry.id,
        action: "update",
        edited_by: user.id,
        prev_date: entry.date,
        prev_type: entry.type,
        prev_amount: entry.amount,
        prev_reason: entry.reason,
        prev_category: entry.category,
        prev_notes: entry.notes,
      });
      if (histError) {
        setSaving(false);
        setError(histError.message);
        return;
      }

      const { error: saveError } = await supabase
        .from("entries")
        .update({
          bank_account_id: draft.bankAccountId,
          date: draft.date,
          amount,
          reason,
          category: draft.category,
          notes: draft.notes.trim() || null,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", entry.id);
      setSaving(false);
      if (saveError) {
        setError(saveError.message);
        return;
      }
    } else {
      const { error: saveError } = await supabase.from("entries").insert({
        company_id: companyId,
        bank_account_id: draft.bankAccountId,
        type,
        date: draft.date,
        amount,
        reason,
        category: draft.category,
        notes: draft.notes.trim() || null,
        created_by: user.id,
        updated_by: user.id,
      });
      setSaving(false);
      if (saveError) {
        setError(saveError.message);
        return;
      }
    }

    await onSaved();
    onClose();
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <form className="sheet-card" onSubmit={onDone}>
        <header className="sheet-bar">
          <button type="button" className="btn ghost compact" onClick={onClose}>
            Dismiss
          </button>
          <h2 id="sheet-title">
            {entry ? "Edit record" : type === "income" ? "Add income" : "Add expense"}
          </h2>
          <button type="submit" className="btn primary compact" disabled={saving}>
            {saving ? "Saving…" : "Done"}
          </button>
        </header>

        <div className="sheet-body">
          <p className="sheet-who">
            Logged as <strong>{name || "unknown"}</strong>
            {entry
              ? " — this edit is recorded with your name and time."
              : " — this record is saved under your name."}
          </p>
          {error && <p className="banner error">{error}</p>}

          <label>
            Bank account
            <select
              required
              value={draft.bankAccountId}
              onChange={(e) => setDraft({ ...draft, bankAccountId: e.target.value })}
            >
              {accounts.length === 0 && <option value="">Add a bank account first</option>}
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input
              type="date"
              required
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </label>
          <label>
            Amount (₹)
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
              placeholder="0.00"
              value={draft.amount}
              onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            />
          </label>
          <label>
            Reason
            <input
              type="text"
              required
              placeholder={type === "income" ? "Invoice payment" : "Office rent"}
              value={draft.reason}
              onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
            />
          </label>
          <label>
            Category
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            >
              {categories.length === 0 && <option value="">Add a category first</option>}
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <p className="sheet-who">
            <Link href="/categories">Manage categories</Link>
          </p>
          <label>
            Notes
            <input
              type="text"
              placeholder="Optional"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </label>
        </div>
      </form>
    </div>
  );
}
