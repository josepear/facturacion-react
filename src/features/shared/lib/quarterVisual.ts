import { formatQuarterShortLabel, normalizeQuarterValue } from "@/features/data/lib/advisorShareFilters";

/** Borde izquierdo por trimestre (filas tipo libro de control). */
export function workbookQuarterRowToneClass(quarter: string): string {
  const k = String(quarter || "").trim().toUpperCase();
  const by: Record<string, string> = {
    T1: "border-l-4 border-l-emerald-500/70",
    T2: "border-l-4 border-l-sky-500/70",
    T3: "border-l-4 border-l-violet-500/70",
    T4: "border-l-4 border-l-amber-500/70",
  };
  return by[k] || "border-l-4 border-l-muted";
}

/** Trimestre natural (T1–T4) a partir de `quarter` guardado o fecha de emisión. */
export function resolveCalendarQuarter(quarterRaw: string | undefined, issueDateIso: string | undefined): string {
  return normalizeQuarterValue(String(quarterRaw ?? ""), String(issueDateIso ?? ""));
}

/** Etiqueta corta (p. ej. Q1) para badges; «—» si no aplica. */
export function quarterShortLabelForUi(normalizedQuarter: string): string {
  const short = formatQuarterShortLabel(normalizedQuarter);
  return short || "—";
}

/**
 * Estilos del badge de trimestre (alineados con `workbookQuarterRowToneClass`).
 * Un solo sitio para ajustar colores / modo oscuro.
 */
export function quarterBadgeSurfaceClass(normalizedQuarter: string): string {
  const k = String(normalizedQuarter || "").trim().toUpperCase();
  const by: Record<string, string> = {
    T1:
      "border border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-50",
    T2: "border border-sky-500/35 bg-sky-500/10 text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-50",
    T3:
      "border border-violet-500/35 bg-violet-500/10 text-violet-950 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-50",
    T4:
      "border border-amber-500/40 bg-amber-500/12 text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/18 dark:text-amber-50",
  };
  return by[k] || "border border-border bg-muted/50 text-muted-foreground";
}
