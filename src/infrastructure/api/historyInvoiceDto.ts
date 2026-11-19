/** Payload wire para GET `/api/history` (elementos del listado). */
import type { EmailSendRecord } from "@/domain/history/types";

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
  gmailLastSend?: EmailSendRecord | null;
};

export type HistoryInvoicesResponseDto = {
  items?: HistoryInvoiceDto[];
};
