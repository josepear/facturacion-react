/** Alineado con legacy `public/app.js` (itemFieldMarkup / readItemsFromForm). */
const PER_PERSON_UNIT_LABELS = new Set(["persona", "personas", "comensal", "comensales", "pax"]);

export function isPerPersonUnitLabel(unitLabel: string | undefined | null): boolean {
  return PER_PERSON_UNIT_LABELS.has(String(unitLabel ?? "").trim().toLowerCase());
}

export function normalizePerPersonQuantity(value: unknown): number {
  return Math.max(0, Math.round(Number(value) || 0));
}

/** Al desactivar «Precio por persona», la legacy vacía etiquetas que eran modo por persona. */
export function unitLabelAfterDisablingPerPerson(current: string | undefined | null): string {
  const raw = String(current ?? "").trim();
  const normalized = raw.toLowerCase();
  return PER_PERSON_UNIT_LABELS.has(normalized) ? "" : raw;
}
