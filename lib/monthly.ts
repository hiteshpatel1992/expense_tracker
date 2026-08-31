import { monthKeyFromDate, monthLabel } from "./dates";
import { liveEntries } from "./balances";
import type { Entry, MonthSplit } from "./types";

export function groupByMonth(entries: Entry[]): MonthSplit[] {
  const map = new Map<string, MonthSplit>();

  for (const entry of liveEntries(entries)) {
    const key = monthKeyFromDate(entry.date);
    let row = map.get(key);
    if (!row) {
      row = {
        key,
        label: monthLabel(key),
        count: 0,
        income: 0,
        expense: 0,
        net: 0,
        byCategory: {},
      };
      map.set(key, row);
    }
    row.count += 1;
    if (entry.type === "income") row.income += entry.amount;
    else row.expense += entry.amount;
    row.net = row.income - row.expense;
    const signed = entry.type === "income" ? entry.amount : -entry.amount;
    row.byCategory[entry.category] = (row.byCategory[entry.category] ?? 0) + signed;
  }

  return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

export function totalsByKey(
  entries: Entry[],
  key: keyof Pick<Entry, "category" | "type">,
): { label: string; total: number; count: number }[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const entry of liveEntries(entries)) {
    const label = entry[key];
    const current = map.get(label) ?? { total: 0, count: 0 };
    current.total += entry.type === "income" ? entry.amount : -entry.amount;
    current.count += 1;
    map.set(label, current);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, ...value }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
}
