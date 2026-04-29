import { fetchWithAuth } from "@/infrastructure/api/httpClient";

export type OfficialDocumentOutputKind = "html" | "pdf";

export type OpenOfficialDocumentInNewTabResult =
  | { ok: true }
  | { ok: false; message: string };

function buildPath(recordId: string, kind: OfficialDocumentOutputKind): string {
  const encoded = encodeURIComponent(recordId);
  return kind === "html"
    ? `/api/documents/rendered-html?recordId=${encoded}`
    : `/api/documents/pdf?recordId=${encoded}`;
}

const KIND_LABEL: Record<OfficialDocumentOutputKind, string> = {
  html: "HTML oficial",
  pdf: "PDF oficial",
};

const HTTP_ERROR_DETAIL =
  "Si el documento está archivado o aún no tiene salida generada, revisa en Historial o en la app legacy.";

/**
 * Descarga HTML/PDF oficial con Bearer, abre en nueva pestaña mediante blob URL.
 */
export async function openOfficialDocumentInNewTab(
  recordId: string,
  kind: OfficialDocumentOutputKind,
): Promise<OpenOfficialDocumentInNewTabResult> {
  const id = String(recordId ?? "").trim();
  if (!id) {
    return { ok: false, message: "No hay recordId para abrir la salida oficial." };
  }
  const path = buildPath(id, kind);
  const label = KIND_LABEL[kind];
  try {
    const response = await fetchWithAuth(path);
    if (!response.ok) {
      return {
        ok: false,
        message: `${label} no disponible (HTTP ${response.status}). ${HTTP_ERROR_DETAIL}`,
      };
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const win = window.open(objectUrl, "_blank", "noopener,noreferrer");
    if (!win) {
      URL.revokeObjectURL(objectUrl);
      return {
        ok: false,
        message:
          "El navegador bloqueó la ventana emergente. Permite ventanas para este sitio e inténtalo de nuevo.",
      };
    }
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: (error as Error).message || `No se pudo cargar ${label.toLowerCase()}.`,
    };
  }
}
