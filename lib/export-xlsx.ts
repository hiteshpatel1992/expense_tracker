import { CATEGORIES, type Expense } from "./types";
import { groupByMonth } from "./monthly";
import { monthLabel } from "./dates";

export async function downloadExpensesXlsx(
  expenses: Expense[],
  monthKey: string | "all",
): Promise<void> {
  const XLSX = await import("xlsx");

  const expenseRows = expenses.map((expense) => ({
    Date: expense.date,
    Amount: expense.amount,
    Reason: expense.reason,
    "Paid by": expense.paid_by,
    Category: expense.category,
    Notes: expense.notes ?? "",
  }));

  const monthly = groupByMonth(expenses);
  const monthRows = monthly.map((row) => {
    const record: Record<string, string | number> = {
      Month: row.label,
      "Expense count": row.count,
      Total: row.total,
    };
    for (const category of CATEGORIES) {
      record[category] = row.byCategory[category] ?? 0;
    }
    return record;
  });

  const workbook = XLSX.utils.book_new();
  const expensesSheet = XLSX.utils.json_to_sheet(expenseRows);
  const monthlySheet = XLSX.utils.json_to_sheet(monthRows);
  XLSX.utils.book_append_sheet(workbook, expensesSheet, "Expenses");
  XLSX.utils.book_append_sheet(workbook, monthlySheet, "Monthly split");

  const filename =
    monthKey === "all"
      ? "expenses-all.xlsx"
      : `expenses-${monthKey}-${monthLabel(monthKey).replace(/\s+/g, "-").toLowerCase()}.xlsx`;

  XLSX.writeFile(workbook, filename);
}
