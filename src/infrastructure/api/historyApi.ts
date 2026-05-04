import type { HistoryInvoice } from "@/features/history/types/historyInvoice";
import { request } from "@/infrastructure/api/httpClient";
import type { HistoryInvoicesResponseDto } from "@/infrastructure/api/historyInvoiceDto";
import { mapHistoryInvoiceDtosToDomain } from "@/infrastructure/mappers/historyInvoiceMapper";

export async function fetchHistoryInvoices(): Promise<HistoryInvoice[]> {
  const payload = await request<HistoryInvoicesResponseDto>("/api/history");
  const raw = (payload.items ?? []).filter((item) => item.type === "factura" || item.type === "presupuesto");
  return mapHistoryInvoiceDtosToDomain(raw);
}
