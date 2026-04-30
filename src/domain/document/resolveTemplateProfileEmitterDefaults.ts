import type { ConfigResponse, TemplateProfileConfig } from "@/domain/document/types";

/**
 * Campos de emisor en Facturar que se rellenan al elegir plantilla o al hidratar desde `/api/config`.
 *
 * Orden de merge (misma capa que suele exponer el JSON de config):
 * - **Por campo:** valor del **perfil** (`templateProfiles[]`) si viene informado; si no, **`defaults` globales** del config.
 * - `bankAccount` y `templateLayout` solo existen en el perfil en el contrato actual (no hay fallback global tipado).
 *
 * `documentTenantId` solo toma `templateProfiles[].tenantId` si el backend lo envía; no inventa tenant de sesión aquí.
 *
 * `series` y `currency` siguen el mismo orden perfil → `config.defaults` (solo texto); `currency` no se escribe en el modelo de factura en React (solo contexto UI).
 *
 * No toca cliente, líneas, número de factura ni contabilidad extendida.
 */
export type ResolvedEmitterFieldsFromProfile = {
  paymentMethod: string;
  bankAccount: string;
  templateLayout: string;
  /** `null` = ninguna capa aporta tipo numérico finito; el formulario no debe sobrescribirse por plantilla. */
  taxRate: number | null;
  withholdingRate: "" | 15 | 19 | 21;
  /** Solo perfil; `null` = no sobrescribir `tenantId` del formulario al cambiar plantilla. */
  documentTenantId: string | null;
  /** Serie sugerida para el campo `series` del documento si el JSON trae `defaults.series`. */
  series: string;
  /** Solo lectura / hints; el documento no persiste `currency` en el tipo actual. */
  currency: string;
};

function trimStr(value: unknown): string {
  return String(value ?? "").trim();
}

function pickFiniteTaxRate(
  profile: TemplateProfileConfig | null | undefined,
  globalDefaults: ConfigResponse["defaults"] | undefined,
): number | null {
  const fromProfile = Number(profile?.defaults?.taxRate);
  if (Number.isFinite(fromProfile)) {
    return fromProfile;
  }
  const fromGlobal = Number(globalDefaults?.taxRate);
  if (Number.isFinite(fromGlobal)) {
    return fromGlobal;
  }
  return null;
}

function pickWithholding(
  profile: TemplateProfileConfig | null | undefined,
  globalDefaults: ConfigResponse["defaults"] | undefined,
): "" | 15 | 19 | 21 {
  const candidates = [profile?.defaults?.withholdingRate, globalDefaults?.withholdingRate];
  for (const raw of candidates) {
    const n = Number(raw);
    if (n === 15 || n === 19 || n === 21) {
      return n;
    }
  }
  return "";
}

export function resolveEmitterFieldsFromTemplateProfile(
  profile: TemplateProfileConfig | null | undefined,
  globalDefaults: ConfigResponse["defaults"] | undefined,
): ResolvedEmitterFieldsFromProfile {
  const paymentMethod = trimStr(profile?.defaults?.paymentMethod) || trimStr(globalDefaults?.paymentMethod);
  const bankAccount = trimStr(profile?.business?.bankAccount);
  const templateLayout = trimStr(profile?.design?.layout);
  const documentTenantId = trimStr(profile?.tenantId) || null;
  const series = trimStr(profile?.defaults?.series) || trimStr(globalDefaults?.series);
  const currency = trimStr(profile?.defaults?.currency) || trimStr(globalDefaults?.currency);

  return {
    paymentMethod,
    bankAccount,
    templateLayout,
    taxRate: pickFiniteTaxRate(profile, globalDefaults),
    withholdingRate: pickWithholding(profile, globalDefaults),
    documentTenantId,
    series,
    currency,
  };
}
