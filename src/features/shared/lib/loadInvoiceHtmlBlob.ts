import { fetchDocumentDetail, fetchDocumentLegacyPreviewBlob } from "@/infrastructure/api/documentsApi";
import { fetchWithAuth } from "@/infrastructure/api/httpClient";
import { mapLegacyDocumentToForm } from "@/infrastructure/mappers/documentMapper";

/**
 * HTML de factura/presupuesto guardado (`rendered-html`) o, si no está disponible, vista previa generada
 * desde el detalle (`preview-html`), misma cadena que Facturar.
 */
export async function loadInvoiceHtmlBlob(recordId: string, signal?: AbortSignal): Promise<Blob> {
  const id = String(recordId ?? "").trim();
  if (!id) {
    throw new Error("Falta recordId para la vista previa.");
  }
  const path = `/api/documents/rendered-html?recordId=${encodeURIComponent(id)}`;
  const response = await fetchWithAuth(path, { signal });
  if (response.ok) {
    return response.blob();
  }
  const detail = await fetchDocumentDetail(id);
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  const doc = mapLegacyDocumentToForm(detail.document);
  return fetchDocumentLegacyPreviewBlob(doc, signal);
}
