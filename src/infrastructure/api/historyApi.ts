import { request } from "@/infrastructure/api/httpClient";

export type HistoryInvoiceItem = {
  recordId: string;
  type: "factura" | "presupuesto";
  typeLabel: string;
  number: string;
  clientName: string;
  issueDate: string;
  total: number;
  savedAt: string;
};

type HistoryResponse = {
  items?: HistoryInvoiceItem[];
};

export async function fetchHistoryInvoices() {
  const payload = await request<HistoryResponse>("/api/history");
  return (payload.items ?? []).filter((item) => item.type === "factura" || item.type === "presupuesto");
}
