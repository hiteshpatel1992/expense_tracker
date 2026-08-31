"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { AppHeader } from "@/components/AppHeader";
import { BankAccountForm } from "@/components/BankAccountForm";
import { EntryScreen } from "@/components/EntryScreen";
import {
  accountSummaries,
  computeBalances,
  openingFromAccounts,
} from "@/lib/balances";
import {
  currentMonthKey,
  formatDisplayDate,
  formatDisplayDateTime,
  monthLabel,
} from "@/lib/dates";
import { downloadLedgerXlsx } from "@/lib/export-xlsx";
import { formatINR } from "@/lib/money";
import { groupByMonth } from "@/lib/monthly";
import { getSupabase } from "@/lib/supabase";
import type {
  BankAccount,
  Company,
  Entry,
  EntryEdit,
  EntryType,
  Profile,
} from "@/lib/types";
import { displayName, isAdmin } from "@/lib/user";

type Filters = {
  q: string;
  type: "" | EntryType;
  category: string;
  month: string | "all";
  account: string | "all";
};

type SheetState = { mode: "new"; type: EntryType } | { mode: "edit"; entry: Entry };

export function Tracker({
  user,
  profile,
  companyId,
  initialAccount = "all",
}: {
  user: User;
  profile: Profile | null;
  companyId: string;
  initialAccount?: string;
}) {
  const admin = isAdmin(profile, user);
  const [company, setCompany] = useState<Company | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [edits, setEdits] = useState<EntryEdit[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [accountSheet, setAccountSheet] = useState<BankAccount | "new" | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    q: "",
    type: "",
    category: "",
    month: currentMonthKey(),
    account: initialAccount === "all" ? "all" : initialAccount,
  });

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const [companyRes, accountRes, entryRes, profileRes] = await Promise.all([
      supabase.from("companies").select("*").eq("id", companyId).single(),
      supabase
        .from("bank_accounts")
        .select("*")
        .eq("company_id", companyId)
        .order("name"),
      supabase
        .from("entries")
        .select("*")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, email, full_name, role"),
    ]);
    if (companyRes.error) {
      setError(companyRes.error.message);
      return;
    }
    if (accountRes.error) {
      setError(accountRes.error.message);
      return;
    }
    if (entryRes.error) {
      setError(entryRes.error.message);
      return;
    }
    const mapped = (entryRes.data ?? []).map((row) => ({
      ...row,
      amount: Number(row.amount),
    })) as Entry[];
    setCompany({
      ...companyRes.data,
      opening_balance: Number(companyRes.data.opening_balance),
    } as Company);
    setAccounts(
      (accountRes.data ?? []).map((row) => ({
        ...row,
        opening_balance: Number(row.opening_balance),
      })) as BankAccount[],
    );
    setEntries(mapped);
    setProfiles(
      new Map((profileRes.data ?? []).map((row) => [row.id, row as Profile])),
    );

    if (mapped.length > 0) {
      const { data: editRows } = await supabase
        .from("entry_edits")
        .select("*")
        .in(
          "entry_id",
          mapped.map((row) => row.id),
        )
        .order("edited_at", { ascending: false });
      setEdits(
        (editRows ?? []).map((row) => ({
          ...row,
          prev_amount: row.prev_amount == null ? null : Number(row.prev_amount),
        })) as EntryEdit[],
      );
    } else {
      setEdits([]);
    }
    setError(null);
  }, [companyId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    function sync() {
      setOffline(!navigator.onLine);
    }
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle(
      "sheet-open",
      sheet !== null || accountSheet !== null,
    );
    return () => document.body.classList.remove("sheet-open");
  }, [sheet, accountSheet]);

  const scopedEntries = useMemo(() => {
    if (filters.account === "all") return entries;
    return entries.filter((entry) => entry.bank_account_id === filters.account);
  }, [entries, filters.account]);

  const monthOptions = useMemo(() => {
    const keys = new Set(scopedEntries.map((e) => e.date.slice(0, 7)));
    keys.add(currentMonthKey());
    return [...keys].sort().reverse();
  }, [scopedEntries]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return entries.filter((entry) => {
      if (filters.month !== "all" && entry.date.slice(0, 7) !== filters.month) {
        return false;
      }
      if (filters.account !== "all" && entry.bank_account_id !== filters.account) {
        return false;
      }
      if (filters.type && entry.type !== filters.type) return false;
      if (filters.category && entry.category !== filters.category) return false;
      if (q) {
        const hay = `${entry.reason} ${entry.category} ${entry.notes ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, filters]);

  const opening = openingFromAccounts(accounts);
  const allBalances = useMemo(
    () => computeBalances(opening, entries),
    [opening, entries],
  );
  const selectedAccount = accounts.find((account) => account.id === filters.account);
  const viewOpening = selectedAccount?.opening_balance ?? opening;
  const viewBalances = useMemo(
    () => computeBalances(viewOpening, filtered),
    [viewOpening, filtered],
  );
  const perAccount = useMemo(
    () => accountSummaries(accounts, entries),
    [accounts, entries],
  );
  const months = groupByMonth(scopedEntries);
  const selectedMonthSplit = months.find((m) => m.key === filters.month);
  const categories = useMemo(
    () => [...new Set(entries.map((e) => e.category))].sort(),
    [entries],
  );
  const accountNames = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts],
  );

  function startAdd(type: EntryType) {
    if (accounts.length === 0) {
      setAccountSheet("new");
      return;
    }
    setSheet({ mode: "new", type });
  }

  async function onDeleteAccount(account: BankAccount) {
    if (!admin) return;
    if (!window.confirm(`Delete bank account ${account.name}?`)) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("Sign in again, then try deleting the bank account.");
      return;
    }
    const res = await fetch(`/api/bank-accounts?id=${encodeURIComponent(account.id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(body.error ?? "Could not delete the bank account.");
      return;
    }
    if (filters.account === account.id) {
      setFilters({ ...filters, account: "all" });
    }
    await load();
  }

  async function onDelete(entry: Entry) {
    if (!admin) return;
    if (!window.confirm("Remove this record from the ledger?")) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { error: histError } = await supabase.from("entry_edits").insert({
      entry_id: entry.id,
      action: "delete",
      edited_by: user.id,
      prev_date: entry.date,
      prev_type: entry.type,
      prev_amount: entry.amount,
      prev_reason: entry.reason,
      prev_category: entry.category,
      prev_notes: entry.notes,
    });
    if (histError) {
      setError(histError.message);
      return;
    }
    const { error: deleteError } = await supabase
      .from("entries")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entry.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    await load();
  }

  async function onExport() {
    if (!company) return;
    await downloadLedgerXlsx(
      company,
      accounts,
      filtered,
      filters.month === "all" ? "all" : filters.month,
    );
  }

  function entryActions(entry: Entry) {
    return (
      <div className="table-actions">
        <button type="button" onClick={() => setSheet({ mode: "edit", entry })}>
          Edit
        </button>
        {admin && (
          <button type="button" onClick={() => onDelete(entry)}>
            Delete
          </button>
        )}
        <button
          type="button"
          onClick={() => setHistoryId(historyId === entry.id ? null : entry.id)}
        >
          History
        </button>
      </div>
    );
  }

  function historyBlock(entryId: string) {
    const rows = edits.filter((row) => row.entry_id === entryId);
    return (
      <div className="history">
        <h3>Edit history</h3>
        {rows.length === 0 ? (
          <p className="empty">No earlier versions.</p>
        ) : (
          <ul>
            {rows.map((row) => (
              <li key={row.id}>
                {row.action} by {displayName(row.edited_by, profiles)} at{" "}
                {formatDisplayDateTime(row.edited_at)} — was {row.prev_type}{" "}
                {row.prev_reason}{" "}
                {row.prev_amount != null ? formatINR(row.prev_amount) : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (!loading && !company) {
    return (
      <div className="page">
        <AppHeader user={user} profile={profile} />
        <p className="banner error">{error ?? "Company not found."}</p>
        <Link href="/">Back to companies</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <AppHeader user={user} profile={profile} title={company?.name ?? "Company"} />
      <p>
        <Link href="/">← All companies</Link>
      </p>
      {offline && (
        <p className="banner error">
          You are offline — browsing works, saving needs internet.
        </p>
      )}
      {error && <p className="banner error">{error}</p>}

      <section className="summary">
        <article>
          <span>All accounts · Opening</span>
          <strong>{formatINR(allBalances.opening)}</strong>
        </article>
        <article>
          <span>All accounts · Income</span>
          <strong>{formatINR(allBalances.income)}</strong>
        </article>
        <article>
          <span>All accounts · Expense</span>
          <strong>{formatINR(allBalances.expense)}</strong>
        </article>
        <article>
          <span>All accounts · Closing</span>
          <strong>{formatINR(allBalances.closing)}</strong>
          <em>Sum of every bank account</em>
        </article>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Bank accounts</h2>
          <button
            type="button"
            className="btn primary compact"
            onClick={() => setAccountSheet("new")}
          >
            Add bank account
          </button>
        </div>
        {accounts.length === 0 ? (
          <div className="empty-block">
            <p className="empty">
              Add a bank account and its opening balance before income or expense.
            </p>
            <button type="button" className="btn primary" onClick={() => setAccountSheet("new")}>
              Add bank account
            </button>
          </div>
        ) : (
          <div className="account-grid">
            <button
              type="button"
              className={
                filters.account === "all" ? "account-card active" : "account-card"
              }
              onClick={() => setFilters({ ...filters, account: "all" })}
            >
              <h3>All accounts</h3>
              <p className="account-meta">Consolidated</p>
              <dl className="account-stats">
                <div>
                  <dt>Opening</dt>
                  <dd>{formatINR(allBalances.opening)}</dd>
                </div>
                <div>
                  <dt>Income</dt>
                  <dd>{formatINR(allBalances.income)}</dd>
                </div>
                <div>
                  <dt>Expense</dt>
                  <dd>{formatINR(allBalances.expense)}</dd>
                </div>
                <div>
                  <dt>Closing</dt>
                  <dd>{formatINR(allBalances.closing)}</dd>
                </div>
              </dl>
            </button>
            {perAccount.map(({ account, balances }) => (
              <article
                key={account.id}
                className={
                  filters.account === account.id ? "account-card active" : "account-card"
                }
              >
                <button
                  type="button"
                  className="account-card-main"
                  onClick={() => setFilters({ ...filters, account: account.id })}
                >
                  <h3>{account.name}</h3>
                  {account.notes && <p className="account-meta">{account.notes}</p>}
                  <dl className="account-stats">
                    <div>
                      <dt>Opening</dt>
                      <dd>{formatINR(balances.opening)}</dd>
                    </div>
                    <div>
                      <dt>Income</dt>
                      <dd>{formatINR(balances.income)}</dd>
                    </div>
                    <div>
                      <dt>Expense</dt>
                      <dd>{formatINR(balances.expense)}</dd>
                    </div>
                    <div>
                      <dt>Closing</dt>
                      <dd>{formatINR(balances.closing)}</dd>
                    </div>
                  </dl>
                </button>
                <div className="table-actions">
                  <button type="button" onClick={() => setAccountSheet(account)}>
                    Edit
                  </button>
                  {admin && (
                    <button type="button" onClick={() => onDeleteAccount(account)}>
                      Delete
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Monthly split</h2>
          <div className="panel-actions">
            <button
              type="button"
              className="btn ghost compact"
              onClick={onExport}
              disabled={filtered.length === 0}
            >
              Export Excel
            </button>
            <button
              type="button"
              className="btn ghost compact hide-on-mobile"
              onClick={() => startAdd("income")}
            >
              Add income
            </button>
            <button
              type="button"
              className="btn primary compact hide-on-mobile"
              onClick={() => startAdd("expense")}
            >
              Add expense
            </button>
          </div>
        </div>
        <div className="month-picker">
          <label>
            Show
            <select
              value={filters.month}
              onChange={(e) =>
                setFilters({ ...filters, month: e.target.value as Filters["month"] })
              }
            >
              <option value="all">All months</option>
              {monthOptions.map((key) => (
                <option key={key} value={key}>
                  {monthLabel(key)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {months.length === 0 ? (
          <p className="empty">No months yet — add income or expense.</p>
        ) : (
          <ul className="month-list">
            {months.map((month) => (
              <li key={month.key}>
                <button
                  type="button"
                  className={
                    filters.month === month.key ? "month-chip active" : "month-chip"
                  }
                  onClick={() => setFilters({ ...filters, month: month.key })}
                >
                  <span>{month.label}</span>
                  <strong>{formatINR(month.net)}</strong>
                  <em>
                    In {formatINR(month.income)} · Out {formatINR(month.expense)}
                  </em>
                </button>
              </li>
            ))}
          </ul>
        )}
        {selectedMonthSplit && (
          <div className="mini-cats">
            {Object.entries(selectedMonthSplit.byCategory)
              .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
              .map(([category, total]) => (
                <span key={category}>
                  {category} {formatINR(total)}
                </span>
              ))}
          </div>
        )}
        <p className="sheet-who">
          This view: {formatINR(viewBalances.income)} in,{" "}
          {formatINR(viewBalances.expense)} out. Closing uses
          {selectedAccount
            ? ` ${selectedAccount.name} opening (${formatINR(viewOpening)})`
            : ` all account openings (${formatINR(allBalances.opening)})`}
          .
        </p>
      </section>

      <section className="panel">
        <h2>Filters</h2>
        <div className="filters">
          <label>
            Search
            <input
              type="search"
              placeholder="Reason, notes"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
          </label>
          <label>
            Bank account
            <select
              value={filters.account}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  account: e.target.value as Filters["account"],
                })
              }
            >
              <option value="all">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Type
            <select
              value={filters.type}
              onChange={(e) =>
                setFilters({ ...filters, type: e.target.value as Filters["type"] })
              }
            >
              <option value="">All</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </label>
          <label>
            Category
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            >
              <option value="">All</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel">
        <h2>Ledger</h2>
        {loading ? (
          <p className="empty">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="empty">No records in this view.</p>
        ) : (
          <>
            <ul className="ledger-cards">
              {filtered.map((entry) => {
                const edited = entry.updated_at !== entry.created_at;
                return (
                  <li key={entry.id} className="ledger-card">
                    <div className="ledger-card-head">
                      <time dateTime={entry.date}>{formatDisplayDate(entry.date)}</time>
                      <strong className="num">{formatINR(entry.amount)}</strong>
                    </div>
                    <p className="ledger-card-reason">{entry.reason}</p>
                    <p className="ledger-card-meta">
                      <span className={entry.type}>{entry.type}</span>
                      {" · "}
                      {accountNames.get(entry.bank_account_id) ?? "—"}
                      {" · "}
                      {entry.category}
                    </p>
                    <p className="ledger-card-audit">
                      Added by {displayName(entry.created_by, profiles)} ·{" "}
                      {formatDisplayDateTime(entry.created_at)}
                      {edited
                        ? ` · Edited by ${displayName(entry.updated_by, profiles)} · ${formatDisplayDateTime(entry.updated_at)}`
                        : null}
                    </p>
                    {entryActions(entry)}
                    {historyId === entry.id ? historyBlock(entry.id) : null}
                  </li>
                );
              })}
            </ul>
            <div className="table-wrap ledger-table">
              <table className="expense-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Account</th>
                    <th>Type</th>
                    <th>Reason</th>
                    <th>Category</th>
                    <th className="num">Amount</th>
                    <th>Added by</th>
                    <th>Added at</th>
                    <th>Edited by</th>
                    <th>Edited at</th>
                    <th> </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => {
                    const edited = entry.updated_at !== entry.created_at;
                    return (
                      <tr key={entry.id}>
                        <td>
                          <time dateTime={entry.date}>{formatDisplayDate(entry.date)}</time>
                        </td>
                        <td>{accountNames.get(entry.bank_account_id) ?? "—"}</td>
                        <td className={entry.type}>{entry.type}</td>
                        <td>{entry.reason}</td>
                        <td>{entry.category}</td>
                        <td className="num">{formatINR(entry.amount)}</td>
                        <td>{displayName(entry.created_by, profiles)}</td>
                        <td>{formatDisplayDateTime(entry.created_at)}</td>
                        <td>{edited ? displayName(entry.updated_by, profiles) : "—"}</td>
                        <td>{edited ? formatDisplayDateTime(entry.updated_at) : "—"}</td>
                        <td>{entryActions(entry)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {historyId && (
              <div className="hide-on-mobile">{historyBlock(historyId)}</div>
            )}
          </>
        )}
      </section>

      {sheet === null && accountSheet === null && (
        <div className="fab-row">
          <button type="button" className="fab secondary" onClick={() => startAdd("income")}>
            Add income
          </button>
          <button type="button" className="fab" onClick={() => startAdd("expense")}>
            Add expense
          </button>
        </div>
      )}

      {sheet !== null && (
        <EntryScreen
          user={user}
          profile={profile}
          companyId={companyId}
          accounts={accounts}
          entry={sheet.mode === "edit" ? sheet.entry : null}
          defaultType={sheet.mode === "new" ? sheet.type : sheet.entry.type}
          onClose={() => setSheet(null)}
          onSaved={load}
        />
      )}
      {accountSheet !== null && (
        <BankAccountForm
          companyId={companyId}
          account={accountSheet === "new" ? null : accountSheet}
          onClose={() => setAccountSheet(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
