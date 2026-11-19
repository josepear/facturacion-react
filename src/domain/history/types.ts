export type EmailSendRecord = {
  sentAt: string;
  messageId?: string;
  to?: string;
  senderTemplateProfileId?: string;
  fromEmail?: string;
  batchRecordIds?: string[];
  batchCount?: number;
};

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
  /** Último envío por Gmail registrado por el servidor (puede no existir). */
  gmailLastSend?: EmailSendRecord | null;
};
