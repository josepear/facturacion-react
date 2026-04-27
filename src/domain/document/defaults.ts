import type { InvoiceDocument } from "@/domain/document/types";

export function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export function createEmptyDocument(): InvoiceDocument {
  return {
    type: "factura",
    templateProfileId: "",
    tenantId: "default",
    number: "",
    series: "",
    issueDate: getToday(),
    dueDate: "",
    reference: "",
    templateLayout: "pear",
    paymentMethod: "Transferencia",
    bankAccount: "",
    accounting: {
      status: "ENVIADA",
      paymentDate: "",
      quarter: "",
      invoiceId: "",
      netCollected: 0,
      taxes: "",
    },
    client: {
      name: "",
      taxId: "",
      taxIdType: "",
      taxCountryCode: "ES",
      address: "",
      city: "",
      province: "",
      email: "",
      contactPerson: "",
    },
    items: [{ concept: "", description: "", quantity: 1, unitPrice: 0 }],
    taxRate: 7,
    withholdingRate: "",
    totalsBasis: "items",
    manualGrossSubtotal: 0,
    subtotal: 0,
    taxAmount: 0,
    withholdingAmount: 0,
    total: 0,
  };
}
