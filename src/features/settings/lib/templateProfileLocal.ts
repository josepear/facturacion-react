import type { TemplateProfileConfig } from "@/domain/document/types";

/** Misma secuencia que legacy `PROFILE_COLOR_SEQUENCE` en `public/app.js`. */
export const PROFILE_COLOR_KEYS = ["teal", "pink", "amber", "violet", "lime", "blue", "coral"] as const;

export type ProfileColorKey = (typeof PROFILE_COLOR_KEYS)[number];

/** Mismas etiquetas que legacy `PROFILE_COLOR_LABELS`. */
export const PROFILE_COLOR_LABELS: Record<ProfileColorKey, string> = {
  teal: "Turquesa",
  pink: "Rosa",
  amber: "Ámbar",
  violet: "Violeta",
  lime: "Lima",
  blue: "Azul",
  coral: "Coral",
};

export function buildClientProfileId(label: string, usedIds: Set<string>): string {
  const baseText =
    String(label || "emisor")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "emisor";
  let nextId = baseText;
  let suffix = 2;
  while (usedIds.has(nextId)) {
    nextId = `${baseText}-${suffix}`;
    suffix += 1;
  }
  return nextId;
}

/** Prefijo de numeración único (3–5 letras), alineado con validación legacy del servidor. */
export function suggestUniqueInvoiceNumberTag(newProfileId: string, existingProfiles: TemplateProfileConfig[]): string {
  const taken = new Set(
    existingProfiles.map((p) => String(p.invoiceNumberTag || "").trim().toUpperCase()).filter(Boolean),
  );
  const lettersOnly = newProfileId.replace(/[^A-Za-z]/g, "").toUpperCase();
  let base = lettersOnly.length >= 3 ? lettersOnly.slice(0, 5) : `${lettersOnly}NEW`.replace(/[^A-Z]/g, "").slice(0, 5);
  if (base.length < 3) {
    base = "USR";
  }
  base = base.slice(0, 5);
  for (let len = Math.min(5, base.length); len >= 3; len -= 1) {
    const candidate = base.slice(0, len);
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  const alphabet = "ABCDEFGHJKLMNOPQRSTUVWXYZ";
  for (let i = 0; i < 26 * 26 * 8; i += 1) {
    const a = alphabet[i % 26] ?? "X";
    const b = alphabet[Math.floor(i / 26) % 26] ?? "X";
    const candidate = `${base.slice(0, 3)}${a}${b}`.slice(0, 5);
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  return `${base.slice(0, 2)}ZZZ`.slice(0, 5);
}

/** Igual que legacy `getNextProfileColorKey()` (menos usado primero). */
export function getNextProfileColorKey(list: TemplateProfileConfig[]): ProfileColorKey {
  const counts = new Map<ProfileColorKey, number>(PROFILE_COLOR_KEYS.map((k) => [k, 0]));
  list.forEach((profile, index) => {
    const raw = String(profile.colorKey || "").trim().toLowerCase();
    const key: ProfileColorKey = PROFILE_COLOR_KEYS.includes(raw as ProfileColorKey)
      ? (raw as ProfileColorKey)
      : (PROFILE_COLOR_KEYS[index % PROFILE_COLOR_KEYS.length] || PROFILE_COLOR_KEYS[0]);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const sorted = [...counts.entries()].sort((a, b) => a[1] - b[1]);
  return (sorted[0]?.[0] as ProfileColorKey) || PROFILE_COLOR_KEYS[0];
}
