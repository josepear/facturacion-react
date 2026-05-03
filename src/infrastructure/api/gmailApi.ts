import { request } from "@/infrastructure/api/httpClient";

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
    body: params,
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
      recordIds: params.recordIds,
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
