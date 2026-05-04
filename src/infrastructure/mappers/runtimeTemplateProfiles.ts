import type { TemplateProfileConfig } from "@/domain/document/types";

/**
 * Normaliza `templateProfiles` tal como llegan de `GET /api/config`.
 * - Asegura `id` estable (acepta `templateProfileId` como alias de algunos volcados legacy).
 * - Ignora entradas no objeto o sin identificador usable.
 * - Dedupe por `id` conservando la primera aparición.
 */
export function normalizeTemplateProfilesFromApi(raw: unknown): TemplateProfileConfig[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const out: TemplateProfileConfig[] = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== "object") {
      continue;
    }
    const rec = entry as Record<string, unknown>;
    const id = String(rec.id ?? rec.templateProfileId ?? "").trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push({ ...(entry as TemplateProfileConfig), id });
  }
  return out;
}
