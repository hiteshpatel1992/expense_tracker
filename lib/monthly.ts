import { monthKeyFromDate, monthLabel } from "./dates";
import type { Expense, MonthSplit } from "./types";

export function groupByMonth(expenses: Expense[]): MonthSplit[] {
  const map = new Map<string, MonthSplit>();

  for (const expense of expenses) {
    const key = monthKeyFromDate(expense.date);
    let row = map.get(key);
    if (!row) {
      row = {
        key,
        label: monthLabel(key),
        count: 0,
        total: 0,
        byCategory: {},
      };
      map.set(key, row);
    }
    row.count += 1;
    row.total += expense.amount;
    row.byCategory[expense.category] =
      (row.byCategory[expense.category] ?? 0) + expense.amount;
  }

  return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

export function sumAmount(expenses: Expense[]): number {
  return expenses.reduce((sum, expense) => sum + expense.amount, 0);
}

export function totalsByKey(
  expenses: Expense[],
  key: keyof Pick<Expense, "category" | "paid_by">,
): { label: string; total: number; count: number }[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const expense of expenses) {
    const label = expense[key];
    const current = map.get(label) ?? { total: 0, count: 0 };
    current.total += expense.amount;
    current.count += 1;
    map.set(label, current);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, ...value }))
    .sort((a, b) => b.total - a.total);
}
