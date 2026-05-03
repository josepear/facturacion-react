import { request } from "@/infrastructure/api/httpClient";

import type { ConfigResponse, InvoiceDocument, TemplateProfileConfig } from "@/domain/document/types";

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
  return payload as ConfigResponse;
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

export async function saveDocument(document: InvoiceDocument, recordId?: string) {
  return request<SaveDocumentResponse>("/api/documents", {
    method: "POST",
    body: {
      recordId,
      document,
    },
  });
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
): Promise<{ available: boolean; conflictRecordId?: string }> {
  const params = new URLSearchParams({ number, templateProfileId });
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
