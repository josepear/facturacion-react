export function normalizeTextKey(value: string) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("es-ES")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeTaxIdKey(value: string) {
  return String(value || "")
    .trim()
    .toLocaleUpperCase("es-ES")
    .replace(/[\s.-]+/g, "");
}

export function sameClientName(left: string, right: string) {
  const leftKey = normalizeTextKey(left);
  const rightKey = normalizeTextKey(right);
  return Boolean(leftKey) && leftKey === rightKey;
}
