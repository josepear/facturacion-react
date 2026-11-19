import { describe, expect, it } from "vitest";

import { calculateTotals } from "@/domain/document/calculateTotals";
import { createEmptyDocument } from "@/domain/document/defaults";

function baseDoc() {
  const doc = createEmptyDocument();
  doc.items = [
    { concept: "Servicio", description: "", quantity: 2, unitPrice: 50, unitLabel: "" },
  ];
  doc.taxRate = 7;
  doc.withholdingRate = 0;
  return doc;
}

describe("calculateTotals", () => {
  it("suma las líneas en modo por concepto", () => {
    const totals = calculateTotals(baseDoc());
    expect(totals.subtotal).toBe(100);
    expect(totals.taxAmount).toBe(7);
    expect(totals.total).toBe(107);
  });

  it("usa el importe bruto manual en modo bruto e ignora las líneas para el cálculo", () => {
    const doc = baseDoc();
    doc.totalsBasis = "gross";
    doc.manualGrossSubtotal = 200;
    doc.withholdingRate = 15;

    const totals = calculateTotals(doc);
    expect(totals.subtotal).toBe(200);
    expect(totals.taxAmount).toBe(14);
    expect(totals.withholdingAmount).toBe(30);
    expect(totals.total).toBe(184);
    // Las líneas se conservan como detalle para la vista previa.
    expect(totals.items).toHaveLength(1);
  });

  it("si el modo bruto está a 0, cae de nuevo a la suma de líneas", () => {
    const doc = baseDoc();
    doc.totalsBasis = "gross";
    doc.manualGrossSubtotal = 0;

    const totals = calculateTotals(doc);
    expect(totals.subtotal).toBe(100);
    expect(totals.total).toBe(107);
  });

  it("admite el importe bruto vacío como 0", () => {
    const doc = baseDoc();
    doc.totalsBasis = "gross";

    const totals = calculateTotals({ ...doc, manualGrossSubtotal: "" });
    expect(totals.subtotal).toBe(100);
  });
});
