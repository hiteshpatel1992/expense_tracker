"use client";

import { useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";
import type { BankAccount } from "@/lib/types";

type Props = {
  companyId: string;
  account: BankAccount | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export function BankAccountForm({ companyId, account, onClose, onSaved }: Props) {
  const [name, setName] = useState(account?.name ?? "");
  const [opening, setOpening] = useState(
    account ? String(account.opening_balance) : "0",
  );
  const [notes, setNotes] = useState(account?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDone(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    const trimmed = name.trim();
    const openingBalance = Number(opening.replace(/,/g, ""));
    if (trimmed.length < 2) {
      setError("Enter a bank account name.");
      return;
    }
    if (!Number.isFinite(openingBalance)) {
      setError("Enter a valid opening balance.");
      return;
    }

    setSaving(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setSaving(false);
      setError("Sign in again, then try saving the bank account.");
      return;
    }

    const res = await fetch("/api/bank-accounts", {
      method: account ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: account?.id,
        company_id: companyId,
        name: trimmed,
        opening_balance: Math.round(openingBalance * 100) / 100,
        notes: notes.trim(),
      }),
    });
    const body = (await res.json()) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Could not save the bank account.");
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
          <h2 id="sheet-title">{account ? "Edit bank account" : "Add bank account"}</h2>
          <button type="submit" className="btn primary compact" disabled={saving}>
            {saving ? "Saving…" : "Done"}
          </button>
        </header>
        <div className="sheet-body">
          {error && <p className="banner error">{error}</p>}
          <label>
            Account name
            <input
              type="text"
              required
              minLength={2}
              placeholder="HDFC current, ICICI, Cash"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Opening balance (₹)
            <input
              type="number"
              step="0.01"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
            />
          </label>
          <label>
            Notes
            <input
              type="text"
              placeholder="Optional — last 4 digits, branch"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <p className="sheet-who">
            Closing for this account = opening + income − expenses. Match the
            bank statement for this account.
          </p>
        </div>
      </form>
    </div>
  );
}
