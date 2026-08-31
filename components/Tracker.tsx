"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ExpenseScreen } from "@/components/ExpenseScreen";
import { InstallPrompt } from "@/components/Pwa";
import { currentMonthKey, formatDisplayDate, monthLabel } from "@/lib/dates";
import { downloadExpensesXlsx } from "@/lib/export-xlsx";
import { formatINR } from "@/lib/money";
import { groupByMonth, sumAmount, totalsByKey } from "@/lib/monthly";
import { getSupabase } from "@/lib/supabase";
import { CATEGORIES, type Expense } from "@/lib/types";
import { userName } from "@/lib/user";

type Filters = {
  q: string;
  category: string;
  paidBy: string;
  month: string | "all";
};

export function Tracker({ user }: { user: User }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [sheet, setSheet] = useState<Expense | "new" | null>(null);
  const [filters, setFilters] = useState<Filters>({
    q: "",
    category: "",
    paidBy: "",
    month: currentMonthKey(),
  });
  const name = userName(user);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data, error: queryError } = await supabase
      .from("expenses")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      return;
    }

    const rows = (data ?? []).map((row) => ({
      ...row,
      amount: Number(row.amount),
    })) as Expense[];
    setExpenses(rows);
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

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    const channel = supabase
      .channel("expenses-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses" },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
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
    document.body.classList.toggle("sheet-open", sheet !== null);
    return () => document.body.classList.remove("sheet-open");
  }, [sheet]);

  const monthOptions = useMemo(() => {
    const keys = new Set(expenses.map((e) => e.date.slice(0, 7)));
    keys.add(currentMonthKey());
    return [...keys].sort().reverse();
  }, [expenses]);

  const people = useMemo(() => {
    return [...new Set(expenses.map((e) => e.paid_by))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [expenses]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return expenses.filter((expense) => {
      if (filters.month !== "all" && expense.date.slice(0, 7) !== filters.month) {
        return false;
      }
      if (filters.category && expense.category !== filters.category) return false;
      if (filters.paidBy && expense.paid_by !== filters.paidBy) return false;
      if (q) {
        const hay = `${expense.reason} ${expense.paid_by} ${expense.category} ${expense.notes ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [expenses, filters]);

  const thisMonthKey = currentMonthKey();
  const thisMonthTotal = useMemo(
    () =>
      sumAmount(expenses.filter((e) => e.date.slice(0, 7) === thisMonthKey)),
    [expenses, thisMonthKey],
  );
  const filteredTotal = sumAmount(filtered);
  const months = groupByMonth(expenses);
  const categoryTotals = totalsByKey(filtered, "category");
  const personTotals = totalsByKey(filtered, "paid_by");
  const selectedMonthSplit = months.find((m) => m.key === filters.month);

  async function signOut() {
    await getSupabase()?.auth.signOut();
  }

  async function onDelete(id: string) {
    if (!window.confirm("Delete this expense?")) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { error: deleteError } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    await load();
  }

  async function onExport() {
    await downloadExpensesXlsx(
      filtered,
      filters.month === "all" ? "all" : filters.month,
    );
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Shared household ledger</p>
          <h1>Expenses</h1>
        </div>
        <div className="topbar-actions">
          <InstallPrompt />
          <span className="who">
            <strong>{name}</strong>
            <em>{user.email}</em>
          </span>
          <button type="button" className="btn ghost compact" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <p className="banner shared">
        Shared board — everyone with an account sees the same expenses. New rows
        are saved under your name.
      </p>
      {offline && (
        <p className="banner error">
          You are offline — you can browse this screen, but saving needs internet.
        </p>
      )}
      {error && <p className="banner error">{error}</p>}

      <section className="summary">
        <article>
          <span>All time</span>
          <strong>{formatINR(sumAmount(expenses))}</strong>
        </article>
        <article>
          <span>This month</span>
          <strong>{formatINR(thisMonthTotal)}</strong>
        </article>
        <article>
          <span>On screen</span>
          <strong>{formatINR(filteredTotal)}</strong>
          <em>
            {filtered.length} expense{filtered.length === 1 ? "" : "s"}
          </em>
        </article>
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
              className="btn primary compact"
              onClick={() => setSheet("new")}
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
          <p className="empty">No months yet — add the first expense.</p>
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
                  <strong>{formatINR(month.total)}</strong>
                  <em>
                    {month.count} item{month.count === 1 ? "" : "s"}
                  </em>
                </button>
              </li>
            ))}
          </ul>
        )}
        {selectedMonthSplit && (
          <div className="mini-cats">
            {Object.entries(selectedMonthSplit.byCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([category, total]) => (
                <span key={category}>
                  {category} {formatINR(total)}
                </span>
              ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Filters</h2>
        <div className="filters">
          <label>
            Search
            <input
              type="search"
              placeholder="Reason, name, notes"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
          </label>
          <label>
            Category
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            >
              <option value="">All</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label>
            Paid by
            <select
              value={filters.paidBy}
              onChange={(e) => setFilters({ ...filters, paidBy: e.target.value })}
            >
              <option value="">Anyone</option>
              {people.map((person) => (
                <option key={person} value={person}>
                  {person}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="split-grid">
        <article className="panel">
          <h2>By category</h2>
          {categoryTotals.length === 0 ? (
            <p className="empty">Nothing in this view.</p>
          ) : (
            <ul className="bars">
              {categoryTotals.map((row) => (
                <li key={row.label}>
                  <span>{row.label}</span>
                  <strong>{formatINR(row.total)}</strong>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="panel">
          <h2>By person</h2>
          {personTotals.length === 0 ? (
            <p className="empty">Nothing in this view.</p>
          ) : (
            <ul className="bars">
              {personTotals.map((row) => (
                <li key={row.label}>
                  <span>{row.label}</span>
                  <strong>{formatINR(row.total)}</strong>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Expenses</h2>
        </div>
        {loading ? (
          <p className="empty">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="empty">
            No expenses in this view. Tap Add expense, or pick another month.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="expense-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reason</th>
                  <th>Category</th>
                  <th>Paid by</th>
                  <th className="num">Amount</th>
                  <th>Notes</th>
                  <th> </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((expense) => (
                  <tr key={expense.id}>
                    <td>
                      <time dateTime={expense.date}>
                        {formatDisplayDate(expense.date)}
                      </time>
                    </td>
                    <td>{expense.reason}</td>
                    <td>{expense.category}</td>
                    <td>{expense.paid_by}</td>
                    <td className="num">{formatINR(expense.amount)}</td>
                    <td>{expense.notes ?? ""}</td>
                    <td className="table-actions">
                      <button type="button" onClick={() => setSheet(expense)}>
                        Edit
                      </button>
                      <button type="button" onClick={() => onDelete(expense.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {sheet === null && (
        <button
          type="button"
          className="fab"
          onClick={() => setSheet("new")}
        >
          Add expense
        </button>
      )}

      {sheet !== null && (
        <ExpenseScreen
          user={user}
          expense={sheet === "new" ? null : sheet}
          onClose={() => setSheet(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
