import { describe, expect, it } from "vitest";

import type { HistoryInvoice } from "@/features/history/types/historyInvoice";

import { ADVISOR_PROFILE_ALL, buildShareReportInvoiceListFromParams } from "./advisorShareFilters";

describe("advisorShareFilters", () => {
  it("applies pending_any as not COBRADA then leaves ENVIADA/CANCELADA in list", () => {
    const items: HistoryInvoice[] = [
      {
        recordId: "a",
        type: "factura",
        typeLabel: "Factura",
        number: "1",
        clientName: "C1",
        issueDate: "2024-03-10",
        total: 100,
        savedAt: "",
        status: "COBRADA",
        templateProfileId: "p1",
        templateProfileLabel: "P1",
      },
      {
        recordId: "b",
        type: "factura",
        typeLabel: "Factura",
        number: "2",
        clientName: "C2",
        issueDate: "2024-03-11",
        total: 50,
        savedAt: "",
        status: "ENVIADA",
        templateProfileId: "p1",
        templateProfileLabel: "P1",
      },
    ];
    const pending = buildShareReportInvoiceListFromParams(items, {
      year: "2024",
      quarter: "all",
      profile: ADVISOR_PROFILE_ALL,
      invoiceStatus: "pending_any",
      client: "all",
    });
    expect(pending.map((i) => i.recordId)).toEqual(["b"]);
  });
});
