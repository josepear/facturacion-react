import { describe, expect, it } from "vitest";

import {
  buildExpenseQuarterTotalsByKey,
  getExpenseQuarterKeyFromMonthKey,
  type ExpenseMonthGroup,
} from "@/features/expenses/lib/controlWorkbookExpenseMonths";

function monthGroup(monthKey: string, monthTotal: number, count: number): ExpenseMonthGroup {
  return {
    monthKey,
    title: monthKey,
    items: new Array(count).fill({}) as ExpenseMonthGroup["items"],
    monthTotal,
  };
}

describe("controlWorkbookExpenseMonths · trimestres", () => {
  it("getExpenseQuarterKeyFromMonthKey mapea mes -> trimestre", () => {
    expect(getExpenseQuarterKeyFromMonthKey("2026-01")).toBe("2026-T1");
    expect(getExpenseQuarterKeyFromMonthKey("2026-03")).toBe("2026-T1");
    expect(getExpenseQuarterKeyFromMonthKey("2026-04")).toBe("2026-T2");
    expect(getExpenseQuarterKeyFromMonthKey("2026-10")).toBe("2026-T4");
    expect(getExpenseQuarterKeyFromMonthKey("2026-12")).toBe("2026-T4");
    expect(getExpenseQuarterKeyFromMonthKey("_sin_mes")).toBe("");
  });

  it("buildExpenseQuarterTotalsByKey suma los meses de cada trimestre", () => {
    const totals = buildExpenseQuarterTotalsByKey([
      monthGroup("2026-10", 100, 2),
      monthGroup("2026-09", 50, 1),
      monthGroup("2026-08", 25, 1),
    ]);

    expect(totals.get("2026-T4")).toMatchObject({ label: "T4 2026", total: 100, count: 2 });
    expect(totals.get("2026-T3")).toMatchObject({ label: "T3 2026", total: 75, count: 2 });
  });
});
