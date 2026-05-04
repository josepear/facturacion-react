import type { InvoiceDocument } from "@/domain/document/types";

export function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export function createEmptyDocument(): InvoiceDocument {
  return {
    type: "",
    templateProfileId: "",
    tenantId: "default",
    number: "",
    numberEnd: "",
    series: "",
    issueDate: getToday(),
    dueDate: "",
    reference: "",
    templateLayout: "",
    paymentMethod: "Transferencia",
    bankAccount: "",
    accounting: {
      status: "",
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
    items: [
      {
        concept: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
        unitLabel: "",
        hidePerPersonSubtotalInBudget: false,
      },
    ],
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
