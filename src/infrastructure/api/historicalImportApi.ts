import { request } from "@/infrastructure/api/httpClient";

/** Archivo Excel/PDF enviado al servidor (nombre + contenido en base64 sin prefijo data:). */
export type HistoricalImportEncodedFile = {
  name: string;
  contentBase64: string;
};

export type HistoricalImportServerYearBucket = {
  year: string;
  workbookCount: number;
  invoiceSheetCount: number;
  expenseSheetCount: number;
  invoiceRowCount: number;
  expenseRowCount: number;
};

export type HistoricalImportScanPerson = {
  code: string;
  label: string;
  years: HistoricalImportServerYearBucket[];
};

export type HistoricalImportScanSummary = {
  workbookCount: number;
  invoiceSheetCount: number;
  expenseSheetCount: number;
  invoiceRowCount: number;
  expenseRowCount: number;
};

export type HistoricalImportScanResponse = {
  sourceDir: string;
  persons: HistoricalImportScanPerson[];
  people: Record<string, HistoricalImportScanPerson>;
  summary: HistoricalImportScanSummary;
};

export type HistoricalInvoicePreviewRow = {
  type?: string;
  issueDate?: string;
  number?: string;
  client?: string;
  concept?: string;
  status?: string;
  subtotal?: number;
  taxAmount?: number;
  withholdingAmount?: number;
  total?: number;
};

export type HistoricalExpensePreviewRow = {
  type?: string;
  issueDate?: string;
  vendor?: string;
  reference?: string;
  category?: string;
  deductible?: boolean;
  quarter?: string;
  total?: number;
};

export type HistoricalImportUploadYearBucket = {
  year: string;
  workbookCount: number;
  workbookNames?: string[];
  invoiceSheetCount: number;
  expenseSheetCount: number;
  invoiceRowCount: number;
  expenseRowCount: number;
  invoicePreviewRows?: HistoricalInvoicePreviewRow[];
  expensePreviewRows?: HistoricalExpensePreviewRow[];
};

export type HistoricalImportUploadPerson = {
  code: string;
  label: string;
  years: HistoricalImportUploadYearBucket[];
};

export type HistoricalImportUploadSummary = {
  workbookCount: number;
  invoiceSheetCount: number;
  expenseSheetCount: number;
  invoiceRowCount: number;
  expenseRowCount: number;
  detectedYearCount: number;
};

export type HistoricalImportUploadResponse = {
  uploadId: string;
  uploadLabel: string;
  persons: HistoricalImportUploadPerson[];
  people: Record<string, HistoricalImportUploadPerson>;
  summary: HistoricalImportUploadSummary;
};

export type HistoricalImportWorkbookRunBody = {
  personCode: string;
  year: string;
  templateProfileId: string;
  uploadId?: string;
  sourceDir?: string;
  tenantId?: string;
};

export type HistoricalImportWorkbookRunResult = {
  createdInvoices: number;
  updatedInvoices: number;
  skippedInvoices: number;
  createdExpenses: number;
  skippedExpenses: number;
  detectedInvoices: number;
  detectedExpenses: number;
  skippedWorkbooks?: unknown[];
  detectedClients?: number;
  createdClients?: number;
  updatedClients?: number;
  skippedClients?: number;
};

export type HistoricalImportPdfSummary = {
  pdfCount: number;
  reviewRowCount: number;
  detectedInvoiceCount: number;
  readyInvoiceCount: number;
  incompleteInvoiceCount: number;
  parseErrorCount: number;
  detectedYearCount: number;
};

export type HistoricalImportPdfPreviewRow = {
  issueDate?: string;
  number?: string;
  client?: string;
  clientRecordId?: string;
  clientTaxId?: string;
  clientAddress?: string;
  clientCity?: string;
  clientProvince?: string;
  clientEmail?: string;
  clientContactPerson?: string;
  concept?: string;
  description?: string;
  status?: string;
  subtotal?: number;
  taxAmount?: number;
  withholdingAmount?: number;
  total?: number;
  sourceFile: string;
  parseError?: string;
  warnings?: string[];
};

export type HistoricalImportPdfUploadResponse = {
  uploadId: string;
  uploadLabel: string;
  years: string[];
  summary: HistoricalImportPdfSummary;
  previewRows: HistoricalImportPdfPreviewRow[];
};

/** Fila de revisión fusionada en servidor (`applyHistoricalPdfReviewRow` / documento desde cero). */
export type HistoricalImportPdfReviewRow = {
  sourceFile: string;
  issueDate?: string;
  number?: string;
  client?: string;
  clientTaxId?: string;
  clientAddress?: string;
  clientCity?: string;
  clientProvince?: string;
  clientEmail?: string;
  clientContactPerson?: string;
  concept?: string;
  description?: string;
  status?: string;
  subtotal?: number;
  taxAmount?: number;
  withholdingAmount?: number;
  total?: number;
};

export type HistoricalImportPdfRunBody = {
  uploadId: string;
  templateProfileId: string;
  reviewRows?: HistoricalImportPdfReviewRow[];
  tenantId?: string;
};

export type HistoricalImportPdfRunCreatedItem = {
  recordId?: string;
  number?: string;
  issueDate?: string;
  client?: string;
  concept?: string;
  total?: number;
};

export type HistoricalImportPdfRunResult = {
  createdInvoices: number;
  skippedInvoices: number;
  detectedInvoices: number;
  years: string[];
  createdItems: HistoricalImportPdfRunCreatedItem[];
  skippedItems: HistoricalImportPdfRunCreatedItem[];
  detectedClients?: number;
  createdClients?: number;
  updatedClients?: number;
  skippedClients?: number;
};

export async function scanHistoricalImportFolder(): Promise<HistoricalImportScanResponse> {
  return request<HistoricalImportScanResponse>("/api/historical-import/scan", {
    method: "POST",
    body: {},
  });
}

export async function uploadHistoricalWorkbooks(
  files: HistoricalImportEncodedFile[],
): Promise<HistoricalImportUploadResponse> {
  return request<HistoricalImportUploadResponse>("/api/historical-import/upload", {
    method: "POST",
    body: { files },
  });
}

export async function uploadHistoricalPdfs(
  files: HistoricalImportEncodedFile[],
): Promise<HistoricalImportPdfUploadResponse> {
  return request<HistoricalImportPdfUploadResponse>("/api/historical-import/pdf-upload", {
    method: "POST",
    body: { files },
  });
}

export async function runHistoricalWorkbookImport(
  body: HistoricalImportWorkbookRunBody,
): Promise<HistoricalImportWorkbookRunResult> {
  return request<HistoricalImportWorkbookRunResult>("/api/historical-import/run", {
    method: "POST",
    body,
  });
}

export async function runHistoricalPdfImport(
  body: HistoricalImportPdfRunBody,
): Promise<HistoricalImportPdfRunResult> {
  return request<HistoricalImportPdfRunResult>("/api/historical-import/pdf-run", {
    method: "POST",
    body,
  });
}

/**
 * Nombre de fichero que entiende `saveHistoricalPdfUpload` en servidor: exige extensión `.pdf`
 * (case-insensitive). Algunos SO/navegadores suben `application/pdf` sin extensión; se añade `.pdf`
 * sin tocar el binario (el extractor Python sigue siendo el mismo).
 */
export function normalizeHistoricalPdfClientFileName(file: File): string {
  const raw = String(file.name || "").trim();
  const leaf = raw ? (raw.split(/[/\\]/u).pop() ?? raw).replace(/\0/g, "") : "";
  let name = leaf || "documento.pdf";
  if (/\.pdf$/iu.test(name)) {
    return name;
  }
  const mime = String(file.type || "").toLowerCase();
  const mimeLooksPdf =
    mime === "application/pdf" ||
    mime === "application/x-pdf" ||
    mime === "application/octet-stream";
  const hasExtension = /\.[^./\\]+$/u.test(name);
  if (mimeLooksPdf || (mime === "" && !hasExtension && name.length > 0)) {
    const dot = name.lastIndexOf(".");
    const base = dot > 0 ? name.slice(0, dot) : name;
    return `${base || "documento"}.pdf`;
  }
  return name;
}

/** Lee un `File` como base64 (sin prefijo `data:*;base64,`) para el cuerpo de subida histórica. */
export function readFileAsBase64Payload(file: File, nameOverride?: string): Promise<HistoricalImportEncodedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      const comma = raw.indexOf(",");
      const contentBase64 = comma >= 0 ? raw.slice(comma + 1) : raw;
      resolve({
        name: String(nameOverride ?? file.name).trim() || file.name,
        contentBase64,
      });
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("No se pudo leer el archivo."));
    };
    reader.readAsDataURL(file);
  });
}

export async function filesToHistoricalEncoded(files: File[]): Promise<HistoricalImportEncodedFile[]> {
  return Promise.all(files.map((f) => readFileAsBase64Payload(f)));
}

/** Igual que `filesToHistoricalEncoded` pero fuerza nombre `.pdf` para el endpoint `pdf-upload`. */
export async function filesToHistoricalPdfEncoded(files: File[]): Promise<HistoricalImportEncodedFile[]> {
  return Promise.all(files.map((f) => readFileAsBase64Payload(f, normalizeHistoricalPdfClientFileName(f))));
}
