import { isPerPersonUnitLabel } from "@/domain/document/perPersonPricing";
import type { DocumentAccountingStatus, InvoiceDocument, InvoiceItem } from "@/domain/document/types";
import { createEmptyDocument } from "@/domain/document/defaults";
import { accountingQuarterSelectFromIssueDate } from "@/features/data/lib/advisorShareFilters";
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
  const unitLabel = asString(item.unitLabel);
  const hidePerPersonSubtotalInBudget = Boolean(item.hidePerPersonSubtotalInBudget);

  return {
    concept: asString(item.concept),
    description: asString(item.description),
    quantity: toNumber(item.quantity ?? 1),
    unitPrice: toNumber(item.unitPrice),
    lineTotal: item.lineTotal === undefined || item.lineTotal === null || item.lineTotal === ""
      ? undefined
      : toNumber(item.lineTotal),
    unitLabel,
    hidePerPersonSubtotalInBudget,
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
  const issueDateMapped = asString(record.issueDate) || base.issueDate;
  const paymentDateMapped = asString(accounting.paymentDate);

  const typeRaw = record.type;
  const rawType = asString(typeRaw).toLowerCase();
  const mappedType: InvoiceDocument["type"] =
    rawType === "presupuesto"
      ? "presupuesto"
      : rawType === "factura"
        ? "factura"
        : typeRaw === ""
          ? ""
          : "factura";

  return {
    ...base,
    type: mappedType,
    templateProfileId: asString(record.templateProfileId) || base.templateProfileId,
    tenantId: asString(record.tenantId) || base.tenantId,
    number: asString(record.number),
    numberEnd: asString(record.numberEnd),
    series: asString(record.series),
    issueDate: issueDateMapped,
    dueDate: asString(record.dueDate),
    reference: asString(record.reference),
    templateLayout: asString(design.layout) || base.templateLayout,
    paymentMethod: asString(record.paymentMethod) || base.paymentMethod,
    bankAccount: asString(record.bankAccount),
    accounting: {
      status: ((): InvoiceDocument["accounting"]["status"] => {
        const statusRaw = accounting.status;
        const status = asString(statusRaw).toUpperCase();
        if (status === "COBRADA" || status === "CANCELADA" || status === "ENVIADA") {
          return status as InvoiceDocument["accounting"]["status"];
        }
        if (statusRaw === "") {
          return "";
        }
        return "ENVIADA";
      })(),
      paymentDate: paymentDateMapped,
      quarter:
        asString(accounting.quarter)
        || accountingQuarterSelectFromIssueDate(issueDateMapped)
        || accountingQuarterSelectFromIssueDate(paymentDateMapped)
        || getQuarterLabel(issueDateMapped)
        || getQuarterLabel(paymentDateMapped),
      invoiceId:
        asString(accounting.invoiceId || accounting.driveLabel)
        || (mappedType === "presupuesto" ? "Presupuesto" : mappedType === "factura" ? "Factura" : ""),
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
  const docType: "factura" | "presupuesto" =
    document.type === "presupuesto"
      ? "presupuesto"
      : document.type === "factura"
        ? "factura"
        : (() => {
            throw new Error("Tipo de documento obligatorio.");
          })();

  const accountingStatus = ((): DocumentAccountingStatus => {
    const status = asString(document.accounting.status).toUpperCase();
    if (status === "COBRADA" || status === "CANCELADA" || status === "ENVIADA") {
      return status as DocumentAccountingStatus;
    }
    throw new Error("Estado contable obligatorio.");
  })();

  return {
    ...document,
    type: docType,
    items: document.items.map((item) => {
      const perPerson = isPerPersonUnitLabel(item.unitLabel);
      return {
        concept: asString(item.concept),
        description: asString(item.description),
        quantity: toNumber(item.quantity),
        unitPrice: toNumber(item.unitPrice),
        ...(item.lineTotal === undefined ? {} : { lineTotal: toNumber(item.lineTotal) }),
        unitLabel: asString(item.unitLabel),
        hidePerPersonSubtotalInBudget: perPerson && Boolean(item.hidePerPersonSubtotalInBudget),
      };
    }),
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
      quarter:
        asString(document.accounting.quarter)
        || accountingQuarterSelectFromIssueDate(asString(document.issueDate))
        || accountingQuarterSelectFromIssueDate(asString(document.accounting.paymentDate))
        || getQuarterLabel(asString(document.issueDate))
        || getQuarterLabel(asString(document.accounting.paymentDate)),
      invoiceId: asString(document.accounting.invoiceId) || (docType === "presupuesto" ? "Presupuesto" : "Factura"),
      netCollected: toNumber(document.accounting.netCollected),
      taxes: asString(document.accounting.taxes),
    },
  };
}
