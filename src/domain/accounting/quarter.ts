/** Alineado con `normalizeQuarterValue` de `public/modules/control-filter-helpers.mjs`. */
export function normalizeQuarterValue(value = "", fallbackDate = ""): string {
  const rawTrim = String(value || "").trim();
  const degreeMatch = rawTrim.match(/^([1-4])\s*º$/u);
  if (degreeMatch) {
    return `T${degreeMatch[1]}`;
  }

  const normalizedValue = rawTrim.toUpperCase();

  if (["T1", "1T", "1ER TRIMESTRE", "1º TRIMESTRE", "1O TRIMESTRE", "Q1"].includes(normalizedValue)) {
    return "T1";
  }
  if (["T2", "2T", "2º TRIMESTRE", "2O TRIMESTRE", "2DO TRIMESTRE", "Q2"].includes(normalizedValue)) {
    return "T2";
  }
  if (["T3", "3T", "3ER TRIMESTRE", "Q3"].includes(normalizedValue)) {
    return "T3";
  }
  if (["T4", "4T", "4º TRIMESTRE", "4O TRIMESTRE", "Q4"].includes(normalizedValue)) {
    return "T4";
  }

  const month = Number(String(fallbackDate || "").slice(5, 7));
  if (month >= 1 && month <= 3) {
    return "T1";
  }
  if (month >= 4 && month <= 6) {
    return "T2";
  }
  if (month >= 7 && month <= 9) {
    return "T3";
  }
  if (month >= 10 && month <= 12) {
    return "T4";
  }
  return "";
}

/**
 * Código de trimestre para desplegables (1T…4T), alineado con `mapExpenseExcelQuarter` / legacy.
 * Vacío si la fecha no es ISO YYYY-MM-DD.
 */
export function accountingQuarterSelectFromIssueDate(issueDateIso: string): string {
  const t = normalizeQuarterValue("", String(issueDateIso || "").trim());
  if (t === "T1") {
    return "1T";
  }
  if (t === "T2") {
    return "2T";
  }
  if (t === "T3") {
    return "3T";
  }
  if (t === "T4") {
    return "4T";
  }
  return "";
}

const QUARTER_SHORT: Record<string, string> = {
  T1: "1T",
  T2: "2T",
  T3: "3T",
  T4: "4T",
};

export function formatQuarterShortLabel(normalizedQuarter: string): string {
  const q = String(normalizedQuarter || "").trim();
  if (!q || q === "SIN_TRIMESTRE") {
    return "";
  }
  return QUARTER_SHORT[q.toUpperCase()] || q;
}
