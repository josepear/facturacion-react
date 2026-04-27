import type { InvoiceDocument, InvoiceItem } from "@/domain/document/types";
import { createEmptyDocument } from "@/domain/document/defaults";
import { toNumber } from "@/lib/utils";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  if (value && typeof value === "object") {
    return value as UnknownRecord;
  }
  return {};
}

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function mapItem(rawItem: unknown): InvoiceItem {
  const item = asRecord(rawItem);

  return {
    concept: asString(item.concept),
    description: asString(item.description),
    quantity: toNumber(item.quantity ?? 1),
    unitPrice: toNumber(item.unitPrice),
    lineTotal: item.lineTotal === undefined || item.lineTotal === null || item.lineTotal === ""
      ? undefined
      : toNumber(item.lineTotal),
  };
}

export function mapLegacyDocumentToForm(input: unknown): InvoiceDocument {
  const base = createEmptyDocument();
  const record = asRecord(input);
  const client = asRecord(record.client);
  const rawItems = Array.isArray(record.items) ? record.items : [];

  const mappedItems = rawItems.length ? rawItems.map(mapItem) : base.items;

  return {
    ...base,
    type: asString(record.type) === "presupuesto" ? "presupuesto" : "factura",
    templateProfileId: asString(record.templateProfileId) || base.templateProfileId,
    tenantId: asString(record.tenantId) || base.tenantId,
    number: asString(record.number),
    series: asString(record.series),
    issueDate: asString(record.issueDate) || base.issueDate,
    dueDate: asString(record.dueDate),
    reference: asString(record.reference),
    paymentMethod: asString(record.paymentMethod) || base.paymentMethod,
    bankAccount: asString(record.bankAccount),
    client: {
      ...base.client,
      name: asString(client.name),
      taxId: asString(client.taxId),
      taxIdType: asString(client.taxIdType),
      taxCountryCode: asString(client.taxCountryCode) || base.client.taxCountryCode,
      address: asString(client.address),
      city: asString(client.city),
      province: asString(client.province),
      email: asString(client.email),
      contactPerson: asString(client.contactPerson),
    },
    items: mappedItems,
    taxRate: toNumber(record.taxRate ?? base.taxRate),
    withholdingRate:
      record.withholdingRate === "" || record.withholdingRate === null || record.withholdingRate === undefined
        ? ""
        : toNumber(record.withholdingRate),
    totalsBasis: asString(record.totalsBasis) === "gross" ? "gross" : "items",
    manualGrossSubtotal: toNumber(record.manualGrossSubtotal),
    subtotal: toNumber(record.subtotal),
    taxAmount: toNumber(record.taxAmount),
    withholdingAmount: toNumber(record.withholdingAmount),
    total: toNumber(record.total),
  };
}

export function mapFormToLegacyDocument(document: InvoiceDocument): InvoiceDocument {
  return {
    ...document,
    items: document.items.map((item) => ({
      concept: asString(item.concept),
      description: asString(item.description),
      quantity: toNumber(item.quantity),
      unitPrice: toNumber(item.unitPrice),
      ...(item.lineTotal === undefined ? {} : { lineTotal: toNumber(item.lineTotal) }),
    })),
    client: {
      ...document.client,
      name: asString(document.client.name),
      taxId: asString(document.client.taxId),
      taxIdType: asString(document.client.taxIdType),
      taxCountryCode: asString(document.client.taxCountryCode || "ES").toUpperCase(),
      address: asString(document.client.address),
      city: asString(document.client.city),
      province: asString(document.client.province),
      email: asString(document.client.email),
      contactPerson: asString(document.client.contactPerson),
    },
  };
}
