import { ApiError, fetchWithAuth, request } from "@/infrastructure/api/httpClient";

export type AccountingExportResult = {
  year: string;
  templateProfileId?: string;
  templateProfileLabel?: string;
  count: number;
  invoiceCount: number;
  expenseCount: number;
  downloadUrl: string;
};

export async function postAccountingExport(body: {
  year: string;
  templateProfileId?: string;
}): Promise<AccountingExportResult> {
  return request<AccountingExportResult>("/api/accounting/export", {
    method: "POST",
    body,
  });
}

export async function triggerBlobDownloadFromAuthPath(path: string, filename: string): Promise<void> {
  const response = await fetchWithAuth(path);
  if (!response.ok) {
    const text = await response.text();
    let message = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (typeof parsed.error === "string" && parsed.error.trim()) {
        message = parsed.error.trim();
      }
    } catch {
      if (text.trim()) {
        message = text.trim().slice(0, 200);
      }
    }
    throw new ApiError(message, response.status);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function runAccountingExportDownload(params: {
  year: string;
  templateProfileId?: string;
}): Promise<AccountingExportResult> {
  const body: { year: string; templateProfileId?: string } = { year: params.year };
  const profileId = String(params.templateProfileId || "").trim();
  if (profileId) {
    body.templateProfileId = profileId;
  }
  const result = await postAccountingExport(body);
  const downloadPath = String(result.downloadUrl || "").trim();
  if (!downloadPath.startsWith("/")) {
    throw new Error("URL de descarga no válida.");
  }
  const filename = `excel-celia-${result.year}.xlsx`;
  await triggerBlobDownloadFromAuthPath(downloadPath, filename);
  return result;
}

export type ControlWorkbookExportBody = {
  year?: string;
  invoiceYear?: string;
  expenseYear?: string;
  invoiceQuarter?: string;
  expenseQuarter?: string;
  invoiceStatus?: string;
  expenseDeductible?: string;
  invoiceSearch?: string;
  expenseSearch?: string;
  invoiceProfile?: string;
  expenseProfile?: string;
};

function parseFilenameFromContentDisposition(header: string | null, fallback: string): string {
  if (!header) {
    return fallback;
  }
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/iu);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/(^")|("$)/gu, "").trim());
    } catch {
      /* ignore */
    }
  }
  const quoted = header.match(/filename="([^"]+)"/iu);
  if (quoted?.[1]) {
    return quoted[1].trim();
  }
  const plain = header.match(/filename=([^;]+)/iu);
  if (plain?.[1]) {
    return plain[1].trim().replace(/^"+|"+$/gu, "");
  }
  return fallback;
}

export async function downloadControlWorkbookExport(body: ControlWorkbookExportBody): Promise<void> {
  const response = await fetchWithAuth("/api/control-workbook-export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    let message = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (typeof parsed.error === "string" && parsed.error.trim()) {
        message = parsed.error.trim();
      }
    } catch {
      if (text.trim()) {
        message = text.trim().slice(0, 200);
      }
    }
    throw new ApiError(message, response.status);
  }
  const blob = await response.blob();
  const filename = parseFilenameFromContentDisposition(
    response.headers.get("Content-Disposition"),
    "libro-control.xlsx",
  );
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export type ShareReportResponse = { ok: boolean; token?: string; shareViewUrl?: string };

export function postShareReport(body: {
  templateProfileId: string;
  year?: string;
  quarter?: string;
  scope?: string;
  invoiceStatus?: string;
  client?: string;
  expenseDeductible?: string;
  vendor?: string;
  category?: string;
}): Promise<ShareReportResponse> {
  return request<ShareReportResponse>("/api/share-reports", {
    method: "POST",
    body,
  });
}
