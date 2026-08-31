export const CATEGORIES = [
  "Food",
  "Transport",
  "Bills",
  "Shopping",
  "Health",
  "Entertainment",
  "Travel",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Expense = {
  id: string;
  date: string;
  amount: number;
  reason: string;
  paid_by: string;
  category: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type ExpenseDraft = {
  date: string;
  amount: string;
  reason: string;
  paid_by: string;
  category: string;
  notes: string;
};

export type MonthSplit = {
  key: string;
  label: string;
  count: number;
  total: number;
  byCategory: Record<string, number>;
};
