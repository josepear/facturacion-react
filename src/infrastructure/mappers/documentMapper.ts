import type { DocumentAccountingStatus, InvoiceDocument, InvoiceItem } from "@/domain/document/types";
import { createEmptyDocument } from "@/domain/document/defaults";
import { toNumber } from "@/lib/utils";

function getQuarterLabel(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const month = date.getMonth() + 1;
  if (month <= 3) return "1ER TRIMESTRE";
  if (month <= 6) return "2º TRIMESTRE";
  if (month <= 9) return "3ER TRIMESTRE";
  return "4º TRIMESTRE";
}

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

function toValidWithholdingRate(value: unknown): "" | 15 | 19 | 21 {
  if (value === "" || value === null || value === undefined) {
    return "";
  }
  const numeric = toNumber(value);
  if (numeric === 15 || numeric === 19 || numeric === 21) {
    return numeric;
  }
  return "";
}

export function mapLegacyDocumentToForm(input: unknown): InvoiceDocument {
  const base = createEmptyDocument();
  const record = asRecord(input);
  const client = asRecord(record.client);
  const accounting = asRecord(record.accounting);
  const design = asRecord(record.design);
  const rawItems = Array.isArray(record.items) ? record.items : [];

  const mappedItems = rawItems.length ? rawItems.map(mapItem) : base.items;

  return {
    ...base,
    type: asString(record.type) === "presupuesto" ? "presupuesto" : "factura",
    templateProfileId: asString(record.templateProfileId) || base.templateProfileId,
    tenantId: asString(record.tenantId) || base.tenantId,
    number: asString(record.number),
    numberEnd: asString(record.numberEnd),
    series: asString(record.series),
    issueDate: asString(record.issueDate) || base.issueDate,
    dueDate: asString(record.dueDate),
    reference: asString(record.reference),
    templateLayout: asString(design.layout) || base.templateLayout,
    paymentMethod: asString(record.paymentMethod) || base.paymentMethod,
    bankAccount: asString(record.bankAccount),
    accounting: {
      status: ((): InvoiceDocument["accounting"]["status"] => {
        const status = asString(accounting.status).toUpperCase();
        if (status === "COBRADA" || status === "CANCELADA") {
          return status;
        }
        return "ENVIADA";
      })(),
      paymentDate: asString(accounting.paymentDate),
      quarter: asString(accounting.quarter) || getQuarterLabel(asString(accounting.paymentDate)),
      invoiceId: asString(accounting.invoiceId || accounting.driveLabel) || (asString(record.type) === "presupuesto" ? "Presupuesto" : "Factura"),
      netCollected: toNumber(accounting.netCollected),
      taxes: asString(accounting.taxes || accounting.taxNote),
    },
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
    withholdingRate: toValidWithholdingRate(record.withholdingRate),
    totalsBasis: asString(record.totalsBasis) === "gross" ? "gross" : "items",
    manualGrossSubtotal: toNumber(record.manualGrossSubtotal),
    subtotal: toNumber(record.subtotal),
    taxAmount: toNumber(record.taxAmount),
    withholdingAmount: toNumber(record.withholdingAmount),
    total: toNumber(record.total),
  };
}

export function mapFormToLegacyDocument(document: InvoiceDocument): InvoiceDocument {
  const accountingStatus = ((): DocumentAccountingStatus => {
    const status = asString(document.accounting.status || "ENVIADA").toUpperCase();
    if (status === "COBRADA" || status === "CANCELADA") {
      return status;
    }
    return "ENVIADA";
  })();

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
    accounting: {
      ...document.accounting,
      status: accountingStatus,
      paymentDate: asString(document.accounting.paymentDate),
      quarter: asString(document.accounting.quarter) || getQuarterLabel(asString(document.accounting.paymentDate)),
      invoiceId: asString(document.accounting.invoiceId) || (document.type === "presupuesto" ? "Presupuesto" : "Factura"),
      netCollected: toNumber(document.accounting.netCollected),
      taxes: asString(document.accounting.taxes),
    },
  };
}
