/**
 * Utilidades para campos de destino de correo que admiten varios destinatarios.
 *
 * El backend (`/api/gmail/send-invoice`) acepta `to` como lista separada por
 * comas o puntos y coma (máximo {@link MAX_EMAIL_RECIPIENTS}). Estas funciones
 * replican la misma validación en el cliente para dar feedback inmediato y
 * evitar llamar a la API con direcciones inválidas.
 */

export const MAX_EMAIL_RECIPIENTS = 10;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export type RecipientListResult = {
  /** Direcciones válidas, sin duplicados (conserva el orden de entrada). */
  valid: string[];
  /** Fragmentos que no son direcciones de correo válidas. */
  invalid: string[];
  /** `true` si hay más direcciones válidas que el máximo permitido. */
  tooMany: boolean;
  /** Direcciones válidas unidas por `", "`, lista para enviar a la API. */
  normalized: string;
  /** Mensaje de error listo para mostrar, o `undefined` si la lista es válida. */
  error?: string;
};

/**
 * Analiza el texto de un campo de destinatarios.
 *
 * - Acepta comas y puntos y coma como separadores.
 * - Ignora espacios y fragmentos vacíos.
 * - Deduplica direcciones sin distinguir mayúsculas.
 */
export function parseRecipientList(value: string): RecipientListResult {
  const parts = String(value ?? "")
    .split(/[,;]+/u)
    .map((part) => part.trim())
    .filter(Boolean);

  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    if (!EMAIL_PATTERN.test(part)) {
      invalid.push(part);
      continue;
    }
    const key = part.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    valid.push(part);
  }

  const tooMany = valid.length > MAX_EMAIL_RECIPIENTS;

  let error: string | undefined;
  if (invalid.length > 0) {
    error = `Correo no válido: ${invalid.join(", ")}.`;
  } else if (tooMany) {
    error = `Como máximo ${MAX_EMAIL_RECIPIENTS} destinatarios por envío.`;
  } else if (valid.length === 0) {
    error = "Indica al menos un correo de destino.";
  }

  return {
    valid,
    invalid,
    tooMany,
    normalized: valid.join(", "),
    error,
  };
}

/** `true` si la lista contiene al menos un correo válido y ningún problema. */
export function hasSendableRecipients(result: RecipientListResult): boolean {
  return result.valid.length > 0 && result.invalid.length === 0 && !result.tooMany;
}
