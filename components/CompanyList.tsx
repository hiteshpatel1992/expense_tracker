"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { AppHeader } from "@/components/AppHeader";
import { CompanyForm } from "@/components/CompanyForm";
import { accountSummaries, periodBalances, openingFromAccounts } from "@/lib/balances";
import { firstDayOfMonthISO, formatDisplayDate, todayISO } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { getSupabase } from "@/lib/supabase";
import type { BankAccount, Company, Entry, Profile } from "@/lib/types";
import { isAdmin } from "@/lib/user";

export function CompanyList({
  user,
  profile,
}: {
  user: User;
  profile: Profile | null;
}) {
  const admin = isAdmin(profile, user);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Company | "new" | null>(null);
  const [accountView, setAccountView] = useState<"all" | "split" | string>("all");
  const [fromDate, setFromDate] = useState(firstDayOfMonthISO);
  const [toDate, setToDate] = useState(todayISO);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const [companyRes, accountRes, entryRes] = await Promise.all([
      supabase.from("companies").select("*").order("name"),
      supabase.from("bank_accounts").select("id, company_id, name, opening_balance"),
      supabase
        .from("entries")
        .select("company_id, bank_account_id, type, amount, date, deleted_at")
        .is("deleted_at", null),
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
    setCompanies(
      (companyRes.data ?? []).map((row) => ({
        ...row,
        opening_balance: Number(row.opening_balance),
      })) as Company[],
    );
    setAccounts(
      (accountRes.data ?? []).map((row) => ({
        id: row.id,
        company_id: row.company_id,
        name: row.name,
        opening_balance: Number(row.opening_balance),
        notes: null,
        created_by: null,
        created_at: "",
        updated_by: null,
        updated_at: "",
      })),
    );
    setEntries(
      (entryRes.data ?? []).map((row) => ({
        ...row,
        amount: Number(row.amount),
      })) as Entry[],
    );
    setError(null);
  }, []);

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

  const range = useMemo(() => {
    if (fromDate && toDate && fromDate > toDate) {
      return { from: toDate, to: fromDate };
    }
    return { from: fromDate, to: toDate };
  }, [fromDate, toDate]);

  const rows = useMemo(() => {
    const { from, to } = range;
    if (accountView === "split") {
      return companies.flatMap((company) => {
        const companyAccounts = accounts.filter((account) => account.company_id === company.id);
        const companyEntries = entries.filter((e) => e.company_id === company.id);
        if (companyAccounts.length === 0) {
          return [
            {
              key: company.id,
              company,
              account: null as BankAccount | null,
              accountLabel: "No accounts",
              balances: periodBalances(0, [], from, to),
            },
          ];
        }
        return accountSummaries(companyAccounts, companyEntries, from, to).map(
          ({ account, balances }) => ({
            key: account.id,
            company,
            account,
            accountLabel: account.name,
            balances,
          }),
        );
      });
    }

    if (accountView !== "all") {
      const account = accounts.find((row) => row.id === accountView);
      if (!account) return [];
      const company = companies.find((row) => row.id === account.company_id);
      if (!company) return [];
      const summary = accountSummaries([account], entries, from, to)[0];
      if (!summary) return [];
      return [
        {
          key: account.id,
          company,
          account,
          accountLabel: account.name,
          balances: summary.balances,
        },
      ];
    }

    return companies.map((company) => {
      const companyAccounts = accounts.filter((account) => account.company_id === company.id);
      const companyEntries = entries.filter((e) => e.company_id === company.id);
      return {
        key: company.id,
        company,
        account: null as BankAccount | null,
        accountLabel:
          companyAccounts.length === 0
            ? "No accounts"
            : companyAccounts.length === 1
              ? companyAccounts[0].name
              : `All (${companyAccounts.length} accounts)`,
        balances: periodBalances(
          openingFromAccounts(companyAccounts),
          companyEntries,
          from,
          to,
        ),
      };
    });
  }, [companies, accounts, entries, accountView, range]);

  async function onDelete(company: Company) {
    if (!window.confirm(`Delete ${company.name} and all of its records?`)) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("Sign in again, then try deleting the company.");
      return;
    }
    const res = await fetch(`/api/companies?id=${encodeURIComponent(company.id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(body.error ?? "Could not delete the company.");
      return;
    }
    await load();
  }

  return (
    <div className="page">
      <AppHeader user={user} profile={profile} />
      <p className="banner shared">
        P&amp;L is income minus expense
        {range.from || range.to
          ? ` from ${range.from ? formatDisplayDate(range.from) : "the start"} to ${
              range.to ? formatDisplayDate(range.to) : "today"
            }`
          : " for all dates"}
        . Opening is the balance at the start of that range.
      </p>
      {error && <p className="banner error">{error}</p>}

      <section className="panel">
        <div className="panel-head">
          <h2>Companies</h2>
          <button type="button" className="btn primary compact" onClick={() => setSheet("new")}>
            Add company
          </button>
        </div>
        <div className="filters home-filters">
          <label>
            From date
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>
          <label>
            To date
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>
          <label>
            Bank account
            <select
              value={accountView}
              onChange={(e) => setAccountView(e.target.value)}
            >
              <option value="all">All accounts</option>
              <option value="split">Split by bank account</option>
              {accounts.map((account) => {
                const company = companies.find((row) => row.id === account.company_id);
                return (
                  <option key={account.id} value={account.id}>
                    {company ? `${company.name} · ${account.name}` : account.name}
                  </option>
                );
              })}
            </select>
          </label>
          <div className="range-presets">
            <button
              type="button"
              className="btn ghost compact"
              onClick={() => {
                setFromDate(firstDayOfMonthISO());
                setToDate(todayISO());
              }}
            >
              This month
            </button>
            <button
              type="button"
              className="btn ghost compact"
              onClick={() => {
                setFromDate("");
                setToDate("");
              }}
            >
              All time
            </button>
          </div>
        </div>
        {loading ? (
          <p className="empty">Loading…</p>
        ) : companies.length === 0 ? (
          <div className="empty-block">
            <p className="empty">
              No companies yet. Add the first company and a bank account with its
              opening balance.
            </p>
            <button type="button" className="btn primary" onClick={() => setSheet("new")}>
              Add company
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="empty">No bank accounts in this view.</p>
        ) : (
          <div className="table-wrap">
            <table className="expense-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Bank account</th>
                  <th className="num">Opening</th>
                  <th className="num">Income</th>
                  <th className="num">Expense</th>
                  <th className="num">P&amp;L</th>
                  <th className="num">Closing</th>
                  <th> </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ key, company, account, accountLabel, balances }) => {
                  const href = account
                    ? `/company/${company.id}?account=${encodeURIComponent(account.id)}`
                    : `/company/${company.id}`;
                  return (
                  <tr key={key}>
                    <td>
                      <Link href={href}>{company.name}</Link>
                    </td>
                    <td>{accountLabel}</td>
                    <td className="num">{formatINR(balances.opening)}</td>
                    <td className="num">{formatINR(balances.income)}</td>
                    <td className="num">{formatINR(balances.expense)}</td>
                    <td className={`num ${balances.net >= 0 ? "pnl-pos" : "pnl-neg"}`}>
                      {formatINR(balances.net)}
                    </td>
                    <td className="num">{formatINR(balances.closing)}</td>
                    <td>
                      <div className="table-actions">
                        <Link href={href}>Open</Link>
                        <button type="button" onClick={() => setSheet(company)}>
                          Edit
                        </button>
                        {admin && (
                          <button type="button" onClick={() => onDelete(company)}>
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
        )}
      </section>

      {sheet !== null && (
        <CompanyForm
          company={sheet === "new" ? null : sheet}
          onClose={() => setSheet(null)}
          onSaved={load}
        />
      )}
      {sheet === null && (
        <div className="fab-row">
          <button type="button" className="fab" onClick={() => setSheet("new")}>
            Add company
          </button>
        </div>
      )}
    </div>
  );
}
