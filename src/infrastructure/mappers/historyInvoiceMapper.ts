import type { HistoryInvoice } from "@/features/history/types/historyInvoice";
import type { HistoryInvoiceDto } from "@/infrastructure/api/historyInvoiceDto";

export function mapHistoryInvoiceDtoToDomain(dto: HistoryInvoiceDto): HistoryInvoice {
  return {
    recordId: dto.recordId,
    type: dto.type,
    typeLabel: dto.typeLabel,
    number: dto.number,
    clientName: dto.clientName,
    issueDate: dto.issueDate,
    total: dto.total,
    savedAt: dto.savedAt,
    status: dto.status,
    templateProfileId: dto.templateProfileId,
    templateProfileLabel: dto.templateProfileLabel,
  };
}

export function mapHistoryInvoiceDtosToDomain(dtos: HistoryInvoiceDto[]): HistoryInvoice[] {
  return dtos.map(mapHistoryInvoiceDtoToDomain);
}
