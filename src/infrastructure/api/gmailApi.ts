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
