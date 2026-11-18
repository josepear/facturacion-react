import { describe, expect, it } from "vitest";

import { calculateTotals } from "@/domain/document/calculateTotals";
import type { InvoiceDocument } from "@/domain/document/types";

const base = {
  totalsBasis: "items" as const,
  taxRate: 7,
  withholdingRate: 15 as const,
  manualGrossSubtotal: 0,
};

function build(overrides: Partial<InvoiceDocument>): InvoiceDocument {
  return {
    ...(overrides as InvoiceDocument),
    items: overrides.items ?? [],
  } as InvoiceDocument;
}

describe("calculateTotals", () => {
  it("suma líneas con cantidad y precio", () => {
    const totals = calculateTotals(
      build({
        ...base,
        items: [
          { concept: "Uno", description: "", quantity: 2, unitPrice: 100 },
          { concept: "Dos", description: "", quantity: 1, unitPrice: 50 },
        ],
      }),
    );
    expect(totals.subtotal).toBe(250);
    expect(totals.taxAmount).toBe(17.5);
    expect(totals.withholdingAmount).toBe(37.5);
    expect(totals.total).toBe(230);
  });

  it("en modo por bruto usa el importe manual aunque las líneas no tengan cifras", () => {
    const totals = calculateTotals(
      build({
        ...base,
        totalsBasis: "gross",
        manualGrossSubtotal: 1000,
        items: [
          { concept: "Solo concepto", description: "", quantity: 1, unitPrice: 0 },
          { concept: "Otro concepto", description: "con detalle", quantity: 1, unitPrice: 0 },
        ],
      }),
    );
    expect(totals.subtotal).toBe(1000);
    expect(totals.taxAmount).toBe(70);
    expect(totals.withholdingAmount).toBe(150);
    expect(totals.total).toBe(920);
    expect(totals.items.every((item) => item.total === 0)).toBe(true);
  });

  it("en modo por bruto sin importe manual cae en la suma de líneas", () => {
    const totals = calculateTotals(
      build({
        ...base,
        totalsBasis: "gross",
        manualGrossSubtotal: 0,
        items: [{ concept: "Solo concepto", description: "", quantity: 1, unitPrice: 0 }],
      }),
    );
    expect(totals.subtotal).toBe(0);
    expect(totals.total).toBe(0);
  });
});
