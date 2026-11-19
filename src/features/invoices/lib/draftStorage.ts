/**
 * Persistencia de borradores de factura/presupuesto en localStorage.
 * Guarda el estado del formulario para recuperar si se cierra la pestaña.
 */

import type { InvoiceDocument } from "@/domain/document/types";

const DRAFT_KEY = "facturacion-draft";
const DRAFT_META_KEY = "facturacion-draft-meta";

export type DraftMeta = {
  savedAt: string; // ISO timestamp
  number: string;
  type: string;
  clientName: string;
  templateProfileId: string;
};

/** Guarda el borrador completo. */
export function saveDraft(document: InvoiceDocument): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(document));
    const meta: DraftMeta = {
      savedAt: new Date().toISOString(),
      number: document.number || "",
      type: document.type || "",
      clientName: document.client?.name || "",
      templateProfileId: document.templateProfileId || "",
    };
    localStorage.setItem(DRAFT_META_KEY, JSON.stringify(meta));
  } catch {
    // localStorage lleno — fallo silencioso
  }
}

/** Carga el borrador guardado (si existe). */
export function loadDraft(): { document: InvoiceDocument; meta: DraftMeta } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    const rawMeta = localStorage.getItem(DRAFT_META_KEY);
    if (!raw) return null;
    const document = JSON.parse(raw) as InvoiceDocument;
    const meta = rawMeta ? (JSON.parse(rawMeta) as DraftMeta) : {
      savedAt: "",
      number: "",
      type: "",
      clientName: "",
      templateProfileId: "",
    };
    return { document, meta };
  } catch {
    return null;
  }
}

/** Elimina el borrador guardado. */
export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(DRAFT_META_KEY);
  } catch {
    // ignore
  }
}

/** Comprueba si hay un borrador sin cargar un JSON grande. */
export function hasDraft(): boolean {
  try {
    return localStorage.getItem(DRAFT_META_KEY) !== null;
  } catch {
    return false;
  }
}

/** Solo los metadatos del borrador (ligero). */
export function loadDraftMeta(): DraftMeta | null {
  try {
    const raw = localStorage.getItem(DRAFT_META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftMeta;
  } catch {
    return null;
  }
}
