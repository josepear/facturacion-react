import type { ExpenseOptions, ExpenseRecord } from "@/domain/expenses/types";
import { parseExpenseOptionsPayload } from "@/domain/expenses/parseExpenseOptionsPayload";
import { request } from "@/infrastructure/api/httpClient";

type ExpensesResponse = {
  items?: ExpenseRecord[];
  years?: string[];
};

type SaveExpenseResponse = {
  mode: "created" | "updated";
  id: string;
  recordId: string;
  expense: ExpenseRecord;
};

type SaveExpenseInput = {
  expense: ExpenseRecord;
  recordId?: string;
};

export async function fetchExpenses() {
  return request<ExpensesResponse>("/api/expenses");
}

export async function saveExpense(input: SaveExpenseInput) {
  return request<SaveExpenseResponse>("/api/expenses", {
    method: "POST",
    body: {
      recordId: input.recordId,
      expense: input.expense,
    },
  });
}

export async function fetchExpenseOptions(): Promise<ExpenseOptions> {
  const payload = await request<unknown>("/api/expense-options");
  return parseExpenseOptionsPayload(payload);
}

export async function saveExpenseOptions(options: ExpenseOptions): Promise<ExpenseOptions> {
  const payload = await request<unknown>("/api/expense-options", {
    method: "POST",
    body: { vendors: options.vendors, categories: options.categories },
  });
  return parseExpenseOptionsPayload(payload);
}

type ArchiveExpenseYearInput = {
  year: string;
  templateProfileId: string;
};

export async function archiveExpense(recordId: string) {
  return request<{ ok: boolean }>("/api/expenses/archive", {
    method: "POST",
    body: { recordId },
  });
}

export async function archiveExpenseYear(input: ArchiveExpenseYearInput) {
  return request<{ ok?: boolean; archivedCount?: number }>("/api/expenses/archive-year", {
    method: "POST",
    body: input,
  });
}

