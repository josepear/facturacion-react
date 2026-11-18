/**
 * Textos contextuales según el tipo de documento (factura / presupuesto).
 * Se usa para que toda la UI se adapte al tipo seleccionado.
 */

import type { DocumentType } from "@/domain/document/types";

export type DocLabels = {
  /** "Factura" / "Presupuesto" */
  singular: string;
  /** "factura" / "presupuesto" */
  singularLower: string;
  /** "la factura" / "el presupuesto" */
  article: string;
  /** "Número factura" / "Número presupuesto" */
  numberPlaceholder: string;
  /** "Factura enviada por Gmail." / "Presupuesto enviado por Gmail." */
  gmailSentMessage: string;
  /** "Enviar factura por Gmail" / "Enviar presupuesto por Gmail" */
  gmailDialogTitle: string;
  /** "Revise la factura en la vista previa…" / "Revise el presupuesto…" */
  reviewHint: string;
  /** "Repetir última factura" / "Repetir último presupuesto" */
  repeatLast: string;
  /** "Vista de factura" / "Vista de presupuesto" */
  previewTitle: string;
};

const FACTURA_LABELS: DocLabels = {
  singular: "Factura",
  singularLower: "factura",
  article: "la factura",
  numberPlaceholder: "Número factura",
  gmailSentMessage: "Factura enviada por Gmail.",
  gmailDialogTitle: "Enviar factura por Gmail",
  reviewHint: "Revise la factura en la vista previa HTML antes de guardar (panel de previsualización del documento).",
  repeatLast: "Repetir última factura",
  previewTitle: "Vista de factura",
};

const PRESUPUESTO_LABELS: DocLabels = {
  singular: "Presupuesto",
  singularLower: "presupuesto",
  article: "el presupuesto",
  numberPlaceholder: "Número presupuesto",
  gmailSentMessage: "Presupuesto enviado por Gmail.",
  gmailDialogTitle: "Enviar presupuesto por Gmail",
  reviewHint: "Revise el presupuesto en la vista previa HTML antes de guardar (panel de previsualización del documento).",
  repeatLast: "Repetir último presupuesto",
  previewTitle: "Vista de presupuesto",
};

/** Devuelve los textos adaptados al tipo. Por defecto usa factura. */
export function getDocLabels(type: DocumentType | string): DocLabels {
  return type === "presupuesto" ? PRESUPUESTO_LABELS : FACTURA_LABELS;
}
