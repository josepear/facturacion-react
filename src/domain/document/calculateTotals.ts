import { isPerPersonUnitLabel, normalizePerPersonQuantity } from "@/domain/document/perPersonPricing";
import type { CalculatedTotals, InvoiceDocument, InvoiceItem } from "@/domain/document/types";
import { toNumber } from "@/lib/utils";

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

type TotalsInput = Pick<
  InvoiceDocument,
  "items" | "totalsBasis" | "taxRate" | "withholdingRate"
> & {
  manualGrossSubtotal: number | "" | null | undefined;
};

function parseOptionalLineTotal(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const total = toNumber(value);
  return Number.isFinite(total) ? total : undefined;
}

function mapItem(item: InvoiceItem): InvoiceItem & { total: number } {
  const hasExplicitQuantity =
    item.quantity !== undefined &&
    item.quantity !== null &&
    String(item.quantity).trim() !== "";
  const rawQuantity = hasExplicitQuantity ? toNumber(item.quantity) : 1;
  const perPerson = isPerPersonUnitLabel(item.unitLabel);
  const quantity = perPerson ? normalizePerPersonQuantity(rawQuantity) : rawQuantity;
  const unitPrice = toNumber(item.unitPrice);
  const explicitLineTotal = parseOptionalLineTotal(item.lineTotal);

  let total = 0;

  if (explicitLineTotal !== undefined) {
    total = roundCents(explicitLineTotal);
  } else if (unitPrice !== 0) {
    total = roundCents(quantity * unitPrice);
  }

  return {
    ...item,
    quantity,
    unitPrice,
    total,
  };
}

export function calculateTotals(document: TotalsInput): CalculatedTotals {
  const items = (document.items ?? []).map(mapItem);
  const basis = String(document.totalsBasis ?? "items").trim().toLowerCase() === "gross" ? "gross" : "items";
  const manualGross =
    document.manualGrossSubtotal === null || document.manualGrossSubtotal === undefined || document.manualGrossSubtotal === ""
      ? 0
      : toNumber(document.manualGrossSubtotal);

  if (basis === "gross" && manualGross > 0) {
    const subtotal = roundCents(manualGross);
    const taxAmount = roundCents(subtotal * (toNumber(document.taxRate) / 100));
    const withholdingAmount = roundCents(subtotal * (toNumber(document.withholdingRate) / 100));
    const total = roundCents(subtotal + taxAmount - withholdingAmount);

    return {
      items,
      subtotal,
      taxAmount,
      withholdingAmount,
      total,
    };
  }

  const subtotal = roundCents(items.reduce((sum, item) => sum + item.total, 0));
  const taxAmount = roundCents(subtotal * (toNumber(document.taxRate) / 100));
  const withholdingAmount = roundCents(subtotal * (toNumber(document.withholdingRate) / 100));
  const total = roundCents(subtotal + taxAmount - withholdingAmount);

  return {
    items,
    subtotal,
    taxAmount,
    withholdingAmount,
    total,
  };
}
