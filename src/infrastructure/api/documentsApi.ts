import { fetchWithAuth, request } from "@/infrastructure/api/httpClient";

import type { ConfigResponse, InvoiceDocument, TemplateProfileConfig } from "@/domain/document/types";
import { normalizeTemplateProfilesFromApi } from "@/infrastructure/mappers/runtimeTemplateProfiles";

export type SaveDocumentResponse = {
  recordId: string;
  document: InvoiceDocument;
};

export async function fetchRuntimeConfig(): Promise<ConfigResponse> {
  const payload = await request<unknown>("/api/config");
  if (payload === null || typeof payload !== "object") {
    throw new Error(
      "Respuesta vacía o inválida de /api/config (¿HTML de la SPA en lugar de JSON? Revisa proxy Vite y sesión).",
    );
  }
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.templateProfiles)) {
    throw new Error("/api/config no incluye templateProfiles[]; el backend devolvió otro formato.");
  }
  const base = payload as ConfigResponse;
  return {
    ...base,
    templateProfiles: normalizeTemplateProfilesFromApi(record.templateProfiles),
  };
}

type SaveTemplateProfilesInput = {
  activeTemplateProfileId: string;
  templateProfiles: TemplateProfileConfig[];
};

export async function saveTemplateProfilesConfig(input: SaveTemplateProfilesInput) {
  return request<ConfigResponse>("/api/template-profiles", {
    method: "POST",
    body: input,
  });
}

export async function propagateTemplateProfile(templateProfileId: string) {
  return request<{ updated: number; skipped: number; failed: number; templateProfileLabel?: string }>(
    "/api/template-profiles/propagate",
    { method: "POST", body: { templateProfileId } },
  );
}

export async function fetchDocumentDetail(recordId: string) {
  const url = `/api/documents/detail?recordId=${encodeURIComponent(recordId)}`;
  return request<{ recordId: string; document: InvoiceDocument }>(url);
}

export async function saveDocument(document: InvoiceDocument, recordId?: string, storageScope?: "sandbox") {
  return request<SaveDocumentResponse>("/api/documents", {
    method: "POST",
    body: {
      recordId,
      document,
      ...(storageScope ? { storageScope } : {}),
    },
  });
}

/**
 * HTML de plantilla legacy para el borrador (sin persistir). Requiere sesión.
 * Misma pipeline que el HTML guardado (`renderDocumentHtml` en servidor).
 */
export async function fetchDocumentLegacyPreviewBlob(document: InvoiceDocument, signal?: AbortSignal): Promise<Blob> {
  let storageScope: "sandbox" | undefined;
  try {
    storageScope =
      typeof globalThis !== "undefined" && globalThis.localStorage?.getItem("facturacion-storage-scope") === "sandbox"
        ? "sandbox"
        : undefined;
  } catch {
    storageScope = undefined;
  }
  const response = await fetchWithAuth("/api/documents/preview-html", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document, ...(storageScope ? { storageScope } : {}) }),
    signal,
  });
  if (!response.ok) {
    const asJson = (await response.json().catch(() => null)) as { error?: string } | null;
    const msg = typeof asJson?.error === "string" && asJson.error.trim() ? asJson.error.trim() : `HTTP ${response.status}`;
    throw new Error(msg);
  }
  return response.blob();
}

type ArchiveYearInput = {
  year: string;
  templateProfileId: string;
};

export async function archiveDocument(recordId: string) {
  return request<{ ok: boolean }>("/api/documents/archive", {
    method: "POST",
    body: { recordId },
  });
}

export async function archiveDocumentYear(input: ArchiveYearInput) {
  return request<{ ok?: boolean; archivedCount?: number }>("/api/documents/archive-year", {
    method: "POST",
    body: input,
  });
}

export async function checkDocumentNumberAvailability(
  number: string,
  templateProfileId: string,
  storageScope?: string,
): Promise<{ available: boolean; conflictRecordId?: string }> {
  const params = new URLSearchParams({ number, templateProfileId });
  if (storageScope === "sandbox") {
    params.set("storageScope", "sandbox");
  }
  return request<{ available: boolean; conflictRecordId?: string }>(
    `/api/document-number-availability?${params}`,
    { method: "GET" },
  );
}

export async function fetchNextcloudFolder(recordId: string): Promise<{ url: string }> {
  return request<{ url: string }>(`/api/nextcloud-folder?recordId=${encodeURIComponent(recordId)}`, { method: "GET" });
}

export async function fetchFontsCatalog(): Promise<{ families: string[] }> {
  return request<{ families: string[] }>("/api/fonts/catalog");
}
