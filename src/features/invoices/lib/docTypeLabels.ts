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
  /** "Duplicar esta factura" / "Duplicar este presupuesto" */
  duplicateTitle: string;
  /** "Editar factura" / "Editar presupuesto" */
  editAction: string;
  /** "Seleccionar factura X" / "Seleccionar presupuesto X" */
  selectLabel: (id: string) => string;
  /** "Vista previa de la factura X" / "Vista previa del presupuesto X" */
  previewLabel: (id: string) => string;
  /** "Abrir vista ampliada de la factura" / "… del presupuesto" */
  expandedPreviewLabel: string;
  /** "Factura (plantilla legacy)" / "Presupuesto (plantilla legacy)" */
  legacyPaneTitle: string;
  /** "Factura repetitiva lista. Revisa y guarda." / "Presupuesto repetitivo…" */
  repeatReady: string;
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
  duplicateTitle: "Duplicar esta factura",
  editAction: "Editar factura",
  selectLabel: (id) => `Seleccionar factura ${id}`,
  previewLabel: (id) => `Vista previa de la factura ${id}`,
  expandedPreviewLabel: "Abrir vista ampliada de la factura",
  legacyPaneTitle: "Factura (plantilla legacy)",
  repeatReady: "Factura repetitiva lista. Revisa y guarda.",
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
  duplicateTitle: "Duplicar este presupuesto",
  editAction: "Editar presupuesto",
  selectLabel: (id) => `Seleccionar presupuesto ${id}`,
  previewLabel: (id) => `Vista previa del presupuesto ${id}`,
  expandedPreviewLabel: "Abrir vista ampliada del presupuesto",
  legacyPaneTitle: "Presupuesto (plantilla legacy)",
  repeatReady: "Presupuesto repetitivo listo. Revisa y guarda.",
};

/** Devuelve los textos adaptados al tipo. Por defecto usa factura. */
export function getDocLabels(type: DocumentType | string): DocLabels {
  return type === "presupuesto" ? PRESUPUESTO_LABELS : FACTURA_LABELS;
}
