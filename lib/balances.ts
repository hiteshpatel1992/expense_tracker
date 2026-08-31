import type { Balances, BankAccount, Entry } from "./types";

export function liveEntries(entries: Entry[]): Entry[] {
  return entries.filter((entry) => !entry.deleted_at);
}

export function sumByType(entries: Entry[], type: "income" | "expense"): number {
  return liveEntries(entries)
    .filter((entry) => entry.type === type)
    .reduce((sum, entry) => sum + entry.amount, 0);
}

export function computeBalances(opening: number, entries: Entry[]): Balances {
  const income = sumByType(entries, "income");
  const expense = sumByType(entries, "expense");
  return {
    opening,
    income,
    expense,
    closing: opening + income - expense,
    net: income - expense,
  };
}

export function periodBalances(
  opening: number,
  entries: Entry[],
  from: string,
  to: string,
): Balances {
  const live = liveEntries(entries);
  const before = from ? live.filter((entry) => entry.date < from) : [];
  const inRange = live.filter((entry) => {
    if (from && entry.date < from) return false;
    if (to && entry.date > to) return false;
    return true;
  });
  return computeBalances(computeBalances(opening, before).closing, inRange);
}

export function openingFromAccounts(accounts: BankAccount[]): number {
  return accounts.reduce((sum, account) => sum + account.opening_balance, 0);
}

export function entriesForAccount(entries: Entry[], accountId: string): Entry[] {
  return entries.filter((entry) => entry.bank_account_id === accountId);
}

export function accountSummaries(
  accounts: BankAccount[],
  entries: Entry[],
  from = "",
  to = "",
) {
  return accounts.map((account) => ({
    account,
    balances: periodBalances(
      account.opening_balance,
      entriesForAccount(entries, account.id),
      from,
      to,
    ),
  }));
}
