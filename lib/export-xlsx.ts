import { accountSummaries, computeBalances, openingFromAccounts } from "./balances";
import { monthLabel } from "./dates";
import { groupByMonth } from "./monthly";
import type { BankAccount, Company, Entry } from "./types";

export async function downloadLedgerXlsx(
  company: Company,
  accounts: BankAccount[],
  entries: Entry[],
  monthKey: string | "all",
): Promise<void> {
  const XLSX = await import("xlsx");
  const live = entries.filter((entry) => !entry.deleted_at);
  const names = new Map(accounts.map((account) => [account.id, account.name]));
  const opening = openingFromAccounts(accounts);
  const balances = computeBalances(opening, live);
  const perAccount = accountSummaries(accounts, live);

  const entryRows = live.map((entry) => ({
    Date: entry.date,
    Account: names.get(entry.bank_account_id) ?? "",
    Type: entry.type,
    Amount: entry.amount,
    Reason: entry.reason,
    Category: entry.category,
    Notes: entry.notes ?? "",
  }));

  const monthly = groupByMonth(live);
  const monthRows = monthly.map((row) => ({
    Month: row.label,
    Count: row.count,
    Income: row.income,
    Expense: row.expense,
    Net: row.net,
  }));

  const accountRows = perAccount.map(({ account, balances: row }) => ({
    Account: account.name,
    Opening: row.opening,
    Income: row.income,
    Expense: row.expense,
    Closing: row.closing,
  }));

  const balanceRows = [
    { Item: "All accounts · Opening", Amount: balances.opening },
    { Item: "All accounts · Income", Amount: balances.income },
    { Item: "All accounts · Expense", Amount: balances.expense },
    { Item: "All accounts · Closing", Amount: balances.closing },
    ...perAccount.map(({ account, balances: row }) => ({
      Item: `${account.name} · Closing`,
      Amount: row.closing,
    })),
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(entryRows), "Entries");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(monthRows), "Monthly split");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(accountRows), "Bank accounts");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(balanceRows), "Balances");

  const slug = company.name.replace(/\s+/g, "-").toLowerCase();
  const filename =
    monthKey === "all"
      ? `${slug}-all.xlsx`
      : `${slug}-${monthKey}-${monthLabel(monthKey).replace(/\s+/g, "-").toLowerCase()}.xlsx`;

  XLSX.writeFile(workbook, filename);
}
