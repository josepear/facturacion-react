import { describe, expect, it } from "vitest";

import { mapHistoryInvoiceDtoToDomain } from "@/infrastructure/mappers/historyInvoiceMapper";
import type { HistoryInvoiceDto } from "@/infrastructure/api/historyInvoiceDto";

const baseDto: HistoryInvoiceDto = {
  recordId: "docs/2026/f-1.json",
  type: "factura",
  typeLabel: "Factura",
  number: "F-1",
  clientName: "Cliente",
  issueDate: "2026-01-10",
  total: 100,
  savedAt: "2026-01-10T10:00:00.000Z",
  status: "ENVIADA",
  templateProfileId: "perfil-main",
  templateProfileLabel: "Perfil Main",
};

describe("mapHistoryInvoiceDtoToDomain", () => {
  it("normaliza gmailLastSend a null cuando no existe", () => {
    const mapped = mapHistoryInvoiceDtoToDomain(baseDto);
    expect(mapped.gmailLastSend).toBeNull();
  });

  it("conserva el registro del último envío", () => {
    const mapped = mapHistoryInvoiceDtoToDomain({
      ...baseDto,
      gmailLastSend: {
        sentAt: "2026-01-10T11:30:00.000Z",
        to: "asesor@example.com",
        messageId: "msg-1",
        fromEmail: "facturas@example.com",
      },
    });
    expect(mapped.gmailLastSend).toEqual({
      sentAt: "2026-01-10T11:30:00.000Z",
      to: "asesor@example.com",
      messageId: "msg-1",
      fromEmail: "facturas@example.com",
    });
  });
});
