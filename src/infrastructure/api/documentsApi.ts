import { request } from "@/infrastructure/api/httpClient";

import type { ConfigResponse, InvoiceDocument } from "@/domain/document/types";

export type SaveDocumentResponse = {
  recordId: string;
  document: InvoiceDocument;
};

export async function fetchRuntimeConfig() {
  return request<ConfigResponse>("/api/config");
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
