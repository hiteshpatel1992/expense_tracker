"use client";

import { useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { todayISO } from "@/lib/dates";
import { getSupabase } from "@/lib/supabase";
import { CATEGORIES, type Expense, type ExpenseDraft } from "@/lib/types";
import { userName } from "@/lib/user";

function emptyDraft(): ExpenseDraft {
  return {
    date: todayISO(),
    amount: "",
    reason: "",
    paid_by: "",
    category: "Food",
    notes: "",
  };
}

function parseAmount(value: string): number | null {
  const n = Number(value.replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

type Props = {
  user: User;
  expense: Expense | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export function ExpenseScreen({ user, expense, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<ExpenseDraft>(() =>
    expense
      ? {
          date: expense.date,
          amount: String(expense.amount),
          reason: expense.reason,
          paid_by: expense.paid_by,
          category: expense.category,
          notes: expense.notes ?? "",
        }
      : emptyDraft(),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = userName(user);

  async function onDone(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;

    const amount = parseAmount(draft.amount);
    const reason = draft.reason.trim();
    if (!amount) {
      setError("Enter an amount greater than 0.");
      return;
    }
    if (!reason || !draft.date) {
      setError("Date and reason are required.");
      return;
    }
    if (!expense && !name) {
      setError("Your account is missing a name. Sign out and create the account again.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      date: draft.date,
      amount,
      reason,
      category: draft.category,
      notes: draft.notes.trim() || null,
      paid_by: expense ? expense.paid_by : name,
    };

    const query = expense
      ? supabase.from("expenses").update(payload).eq("id", expense.id)
      : supabase.from("expenses").insert({ ...payload, created_by: user.id });

    const { error: saveError } = await query;
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
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
          <h2 id="sheet-title">{expense ? "Edit expense" : "Add expense"}</h2>
          <button type="submit" className="btn primary compact" disabled={saving}>
            {saving ? "Saving…" : "Done"}
          </button>
        </header>

        <div className="sheet-body">
          <p className="sheet-who">
            Logged as <strong>{name || "unknown"}</strong> — this name is saved on the expense.
          </p>
          {error && <p className="banner error">{error}</p>}

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
              placeholder="Groceries at DMart"
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
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
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
