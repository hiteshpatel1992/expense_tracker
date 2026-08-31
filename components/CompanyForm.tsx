"use client";

import { useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Company } from "@/lib/types";

type Props = {
  company: Company | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export function CompanyForm({ company, onClose, onSaved }: Props) {
  const [name, setName] = useState(company?.name ?? "");
  const [accountName, setAccountName] = useState("Main account");
  const [opening, setOpening] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDone(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Enter a company name.");
      return;
    }

    let openingBalance = 0;
    const firstAccount = accountName.trim() || "Main account";
    if (!company) {
      openingBalance = Number(opening.replace(/,/g, ""));
      if (!Number.isFinite(openingBalance)) {
        setError("Enter a valid opening balance.");
        return;
      }
      if (firstAccount.length < 2) {
        setError("Enter a bank account name.");
        return;
      }
    }

    setSaving(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setSaving(false);
      setError("Sign in again, then try adding the company.");
      return;
    }

    const res = await fetch("/api/companies", {
      method: company ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        company
          ? { id: company.id, name: trimmed }
          : {
              name: trimmed,
              first_account_name: firstAccount,
              opening_balance: Math.round(openingBalance * 100) / 100,
            },
      ),
    });
    const body = (await res.json()) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Could not save the company.");
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
          <h2 id="sheet-title">{company ? "Edit company" : "Add company"}</h2>
          <button type="submit" className="btn primary compact" disabled={saving}>
            {saving ? "Saving…" : "Done"}
          </button>
        </header>
        <div className="sheet-body">
          {error && <p className="banner error">{error}</p>}
          <label>
            Company name
            <input
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {!company && (
            <>
              <label>
                First bank account
                <input
                  type="text"
                  required
                  minLength={2}
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
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
              <p className="sheet-who">
                You can add more bank accounts after the company is created.
                Closing = opening + income − expenses, per account and for the
                company as a whole.
              </p>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
