import { request } from "@/infrastructure/api/httpClient";

/** El POST `/api/gmail/send-invoice` solo acepta rutas que terminen en `.json`. */
export function normalizeGmailRecordId(recordId: string): string {
  const id = String(recordId || "").trim().replace(/\\/gu, "/");
  if (!id) {
    return id;
  }
  if (/\.json$/iu.test(id)) {
    return id;
  }
  return `${id}.json`;
}

export type GmailStatusResponse = {
  configured: boolean;
  connected: boolean;
  email: string;
  templateProfileId?: string;
};

export type GmailSendResponse = {
  ok: boolean;
  sent?: unknown[];
};

export function fetchGmailStatus(templateProfileId: string): Promise<GmailStatusResponse> {
  return request<GmailStatusResponse>(
    `/api/gmail/status?templateProfileId=${encodeURIComponent(templateProfileId)}`,
  );
}

export function fetchGmailOAuthStartUrl(templateProfileId: string): Promise<{ authUrl: string }> {
  return request<{ authUrl: string }>(
    `/api/gmail/oauth/start?templateProfileId=${encodeURIComponent(templateProfileId)}`,
  );
}

export function sendGmailInvoice(params: {
  recordId: string;
  templateProfileId: string;
  to: string;
  bodyText?: string;
}): Promise<GmailSendResponse> {
  return request<GmailSendResponse>("/api/gmail/send-invoice", {
    method: "POST",
    body: {
      ...params,
      recordId: normalizeGmailRecordId(params.recordId),
    },
  });
}

export async function sendGmailInvoiceBatch(params: {
  recordIds: string[];
  templateProfileId: string;
  to?: string;
  bodyText?: string;
}): Promise<GmailSendResponse> {
  return request<GmailSendResponse>("/api/gmail/send-invoice", {
    method: "POST",
    body: {
      recordIds: params.recordIds.map((id) => normalizeGmailRecordId(id)),
      templateProfileId: params.templateProfileId,
      ...(params.to?.trim() ? { to: params.to.trim() } : {}),
      ...(params.bodyText?.trim() ? { bodyText: params.bodyText.trim() } : {}),
    },
  });
}

export type GmailProfileItem = {
  templateProfileId: string;
  label: string;
  connected: boolean;
  email: string;
  legacy?: boolean;
};

export type GmailProfilesResponse = {
  items: GmailProfileItem[];
  configured: boolean;
  sessionGmail?: { connected: boolean; email: string };
};

export function fetchGmailProfiles(): Promise<GmailProfilesResponse> {
  return request<GmailProfilesResponse>("/api/gmail/profiles");
}
