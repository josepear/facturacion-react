/** Factura o presupuesto en el listado de historial (dominio UI). */
export type HistoryInvoice = {
  recordId: string;
  type: "factura" | "presupuesto";
  typeLabel: string;
  number: string;
  clientName: string;
  issueDate: string;
  total: number;
  savedAt: string;
  status: string;
  templateProfileId: string;
  templateProfileLabel: string;
};
