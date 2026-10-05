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

function buildOfficialFileName(recordId: string, kind: OfficialDocumentOutputKind): string {
  const base = String(recordId || "documento")
    .replace(/\.json$/iu, "")
    .split("/")
    .filter(Boolean)
    .pop() || "documento";

  return `${base}.${kind === "pdf" ? "pdf" : "html"}`;
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
}

/**
 * HTML/PDF oficial con Bearer sin popup: PDF descarga directa, HTML abre misma pestaña.
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

    if (kind === "pdf") {
      triggerBlobDownload(blob, buildOfficialFileName(id, kind));
      return { ok: true };
    }

    const objectUrl = URL.createObjectURL(blob);
    window.location.assign(objectUrl);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: (error as Error).message || `No se pudo cargar ${label.toLowerCase()}.`,
    };
  }
}
