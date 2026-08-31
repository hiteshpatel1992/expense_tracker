export const DEFAULT_EXPENSE_CATEGORIES = [
  "Food",
  "Transport",
  "Bills",
  "Shopping",
  "Health",
  "Entertainment",
  "Travel",
  "Rent",
  "Salaries",
  "Utilities",
  "Marketing",
  "Other",
] as const;

export const DEFAULT_INCOME_CATEGORIES = [
  "Sales",
  "Refund",
  "Other income",
  "Transfer in",
] as const;

export const EXPENSE_CATEGORIES = DEFAULT_EXPENSE_CATEGORIES;
export const INCOME_CATEGORIES = DEFAULT_INCOME_CATEGORIES;

export type EntryType = "income" | "expense";

export type Category = {
  id: string;
  name: string;
  type: EntryType;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
};

export type Profile = {
  id: string;
  email: string | null;
  full_name: string;
  role: "admin" | "member";
};

export type Company = {
  id: string;
  name: string;
  opening_balance: number;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
};

export type BankAccount = {
  id: string;
  company_id: string;
  name: string;
  opening_balance: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
};

export type Entry = {
  id: string;
  company_id: string;
  bank_account_id: string;
  type: EntryType;
  date: string;
  amount: number;
  reason: string;
  category: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
};

export type EntryEdit = {
  id: string;
  entry_id: string;
  action: "update" | "delete";
  edited_by: string | null;
  edited_at: string;
  prev_date: string | null;
  prev_type: string | null;
  prev_amount: number | null;
  prev_reason: string | null;
  prev_category: string | null;
  prev_notes: string | null;
};

export type EntryDraft = {
  date: string;
  amount: string;
  reason: string;
  category: string;
  notes: string;
  bankAccountId: string;
};

export type MonthSplit = {
  key: string;
  label: string;
  count: number;
  income: number;
  expense: number;
  net: number;
  byCategory: Record<string, number>;
};

export type Balances = {
  opening: number;
  income: number;
  expense: number;
  closing: number;
  net: number;
};
