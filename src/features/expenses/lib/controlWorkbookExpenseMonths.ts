import type { ExpenseRecord } from "@/domain/expenses/types";
import { ADVISOR_PROFILE_ALL, ADVISOR_PROFILE_UNASSIGNED } from "@/features/data/lib/advisorShareFilters";

export { workbookQuarterRowToneClass } from "@/features/shared/lib/quarterVisual";

/** Mapea filtros de perfil de la SPA al token de la hoja de control legacy (`__all__` / `__unassigned__`). */
export function mapReactExpenseProfileFilterToControl(profileFilter: string): string {
  if (profileFilter === "all") {
    return ADVISOR_PROFILE_ALL;
  }
  if (profileFilter === "__default__" || profileFilter === "__unassigned__") {
    return ADVISOR_PROFILE_UNASSIGNED;
  }
  return profileFilter;
}

export function getControlExpenseMonthKey(item: ExpenseRecord): string {
  const issueDate = String(item.issueDate || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/u.test(issueDate)) {
    return issueDate.slice(0, 7);
  }
  return "_sin_mes";
}

export function formatControlExpenseMonthBanner(monthKey: string): string {
  if (monthKey === "_sin_mes") {
    return "Sin mes en fecha";
  }
  const [yearRaw, monthRaw] = String(monthKey || "").split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return String(monthKey || "").trim() || "Mes desconocido";
  }
  const monthDate = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(monthDate);
}

export type ExpenseMonthGroup = {
  monthKey: string;
  title: string;
  items: ExpenseRecord[];
  monthTotal: number;
};

/** Agrupa filas ya ordenadas como en `buildControlExpenseTableMarkup` (legacy). */
export function groupExpensesByMonth(sortedItems: ExpenseRecord[]): ExpenseMonthGroup[] {
  const monthGroups = new Map<string, ExpenseRecord[]>();
  for (const item of sortedItems) {
    const monthKey = getControlExpenseMonthKey(item);
    if (!monthGroups.has(monthKey)) {
      monthGroups.set(monthKey, []);
    }
    monthGroups.get(monthKey)!.push(item);
  }

  const sortedMonthKeys = [...monthGroups.keys()].sort((left, right) => {
    if (left === "_sin_mes") {
      return 1;
    }
    if (right === "_sin_mes") {
      return -1;
    }
    return String(right).localeCompare(String(left));
  });

  return sortedMonthKeys.map((monthKey) => {
    const items = monthGroups.get(monthKey) ?? [];
    const monthTotal = items.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
    return {
      monthKey,
      title: formatControlExpenseMonthBanner(monthKey),
      items,
      monthTotal,
    };
  });
}
