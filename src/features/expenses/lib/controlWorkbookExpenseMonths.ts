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

/** Clave de trimestre (`2026-T4`) a partir de un `monthKey` (`2026-10`). */
export function getExpenseQuarterKeyFromMonthKey(monthKey: string): string {
  const [yearRaw, monthRaw] = String(monthKey || "").split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return "";
  }
  return `${year}-T${Math.floor((month - 1) / 3) + 1}`;
}

export type ExpenseQuarterTotal = {
  quarterKey: string;
  label: string;
  total: number;
  count: number;
};

/** Totales por trimestre a partir de los grupos por mes (`getExpenseQuarterKeyFromMonthKey`). */
export function buildExpenseQuarterTotalsByKey(
  monthGroups: ExpenseMonthGroup[],
): Map<string, ExpenseQuarterTotal> {
  const byKey = new Map<string, ExpenseQuarterTotal>();
  for (const group of monthGroups) {
    const quarterKey = getExpenseQuarterKeyFromMonthKey(group.monthKey);
    if (!quarterKey) {
      continue;
    }
    const existing = byKey.get(quarterKey);
    if (existing) {
      existing.total += group.monthTotal;
      existing.count += group.items.length;
      continue;
    }
    const [year, quarterCode] = quarterKey.split("-T");
    byKey.set(quarterKey, {
      quarterKey,
      label: `T${quarterCode} ${year}`,
      total: group.monthTotal,
      count: group.items.length,
    });
  }
  return byKey;
}
