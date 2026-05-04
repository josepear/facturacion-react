/** Estados contables compartidos entre Facturar e Historial (mismos valores API / formulario). */
export const ACCOUNTING_STATUS_OPTIONS = [
  { value: "ENVIADA", label: "Enviada" },
  { value: "COBRADA", label: "Cobrada" },
  { value: "CANCELADA", label: "Cancelada" },
] as const;

export type AccountingStatusValue = (typeof ACCOUNTING_STATUS_OPTIONS)[number]["value"];

const LABEL_BY_UPPERCASE: Record<string, string> = Object.fromEntries(
  ACCOUNTING_STATUS_OPTIONS.map((o) => [o.value, o.label]),
);

/** Etiqueta en español; si el código no está en el catálogo, devuelve el código en mayúsculas o «-». */
export function formatAccountingStatusLabel(status: string): string {
  const key = String(status || "").trim().toUpperCase();
  const label = LABEL_BY_UPPERCASE[key];
  if (label !== undefined) {
    return label;
  }
  return key ? key : "-";
}
