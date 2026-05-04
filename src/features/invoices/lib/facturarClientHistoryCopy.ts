/**
 * Textos del bloque «Histórico» / documentos del cliente en Facturar.
 * Compartidos entre `useFacturarForm` (checklist) y `FacturarPage` (tabla y pie).
 */

export const FACTURAR_CLIENT_HISTORY_NEED_NAME =
  "Indica el cliente para ver aquí sus facturas y presupuestos anteriores.";

export const FACTURAR_CLIENT_HISTORY_NEED_CONFIRM =
  "Confirma el cliente (Seleccionar junto a País) para usar el historial.";

export const FACTURAR_CLIENT_HISTORY_EMPTY_LIST =
  "No hay facturas ni presupuestos guardados con este nombre de cliente.";

/** Pie de tabla: solo el recuento (sin la frase de acción del checklist). */
export function facturarClientHistoryRowsSummary(count: number): string {
  return `${count} documento(s) de este cliente`;
}

/** Tip del módulo en el checklist cuando ya hay filas cargadas. */
export function facturarClientHistoryCountTip(count: number): string {
  return `${facturarClientHistoryRowsSummary(count)}; elige uno para cargarlo.`;
}
