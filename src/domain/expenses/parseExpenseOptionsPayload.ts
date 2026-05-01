import type { ExpenseOptions } from "@/domain/expenses/types";

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function coerceDistinctStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const s = String(item ?? "").trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

/**
 * Normaliza respuestas de `GET /api/expense-options` documentadas en runbook / E2E:
 * - `{ vendors, categories }` en raíz
 * - `{ expenseOptions: { vendors, categories } }`
 * - `{ expenseOptions: { data: { vendors, categories } } }` o `{ data: { ... } }` dentro del nodo útil
 */
export function parseExpenseOptionsPayload(raw: unknown): ExpenseOptions {
  const root = asRecord(raw);
  let inner = root;
  if (root.expenseOptions !== undefined && typeof root.expenseOptions === "object" && root.expenseOptions !== null) {
    inner = asRecord(root.expenseOptions);
  }
  const data = inner.data !== undefined && typeof inner.data === "object" && inner.data !== null ? asRecord(inner.data) : null;
  const vendorsRaw = inner.vendors ?? data?.vendors;
  const categoriesRaw = inner.categories ?? data?.categories;
  return {
    vendors: coerceDistinctStringList(vendorsRaw),
    categories: coerceDistinctStringList(categoriesRaw),
  };
}
