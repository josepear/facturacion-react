import { describe, expect, it } from "vitest";

import {
  accountingQuarterSelectFromIssueDate,
  formatQuarterShortLabel,
  normalizeQuarterValue,
} from "@/domain/accounting/quarter";

describe("domain/accounting/quarter", () => {
  it("normalizes quarter from ISO date", () => {
    expect(normalizeQuarterValue("", "2024-02-15")).toBe("T1");
    expect(normalizeQuarterValue("", "2024-08-01")).toBe("T3");
  });

  it("maps issue date to 1T…4T for form selects", () => {
    expect(accountingQuarterSelectFromIssueDate("2024-02-15")).toBe("1T");
    expect(accountingQuarterSelectFromIssueDate("2024-05-01")).toBe("2T");
    expect(accountingQuarterSelectFromIssueDate("2024-08-01")).toBe("3T");
    expect(accountingQuarterSelectFromIssueDate("2024-11-30")).toBe("4T");
    expect(accountingQuarterSelectFromIssueDate("")).toBe("");
  });

  it("formatQuarterShortLabel: T1–T4 a 1T–4T; vacío para sin trimestre", () => {
    expect(formatQuarterShortLabel("T1")).toBe("1T");
    expect(formatQuarterShortLabel("t3")).toBe("3T");
    expect(formatQuarterShortLabel("")).toBe("");
    expect(formatQuarterShortLabel("SIN_TRIMESTRE")).toBe("");
  });
});
