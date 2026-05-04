/** Payload wire para GET `/api/history` (elementos del listado). */
export type HistoryInvoiceDto = {
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

export type HistoryInvoicesResponseDto = {
  items?: HistoryInvoiceDto[];
};
