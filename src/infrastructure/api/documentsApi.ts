import { request } from "@/infrastructure/api/httpClient";

import type { ConfigResponse, InvoiceDocument, TemplateProfileConfig } from "@/domain/document/types";

export type SaveDocumentResponse = {
  recordId: string;
  document: InvoiceDocument;
};

export async function fetchRuntimeConfig() {
  return request<ConfigResponse>("/api/config");
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
