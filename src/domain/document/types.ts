export type DocumentType = "factura" | "presupuesto";
export type TotalsBasis = "items" | "gross";

export type InvoiceItem = {
  concept: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal?: number;
};

export type DocumentClient = {
  name: string;
  taxId: string;
  taxIdType: string;
  taxCountryCode: string;
  address: string;
  city: string;
  province: string;
  email: string;
  contactPerson: string;
};

export type DocumentAccountingStatus = "ENVIADA" | "COBRADA" | "CANCELADA";

export type DocumentAccounting = {
  status: DocumentAccountingStatus;
  paymentDate: string;
  quarter: string;
  invoiceId: string;
  netCollected: number;
  taxes: string;
};

export type InvoiceDocument = {
  type: DocumentType;
  templateProfileId: string;
  tenantId: string;
  number: string;
  series: string;
  issueDate: string;
  dueDate: string;
  reference: string;
  templateLayout: string;
  paymentMethod: string;
  bankAccount: string;
  accounting: DocumentAccounting;
  client: DocumentClient;
  items: InvoiceItem[];
  taxRate: number;
  withholdingRate: "" | 15 | 19 | 21;
  totalsBasis: TotalsBasis;
  manualGrossSubtotal: number;
  subtotal: number;
  taxAmount: number;
  withholdingAmount: number;
  total: number;
};

export type CalculatedTotals = {
  items: Array<InvoiceItem & { total: number }>;
  subtotal: number;
  taxAmount: number;
  withholdingAmount: number;
  total: number;
};

export type ConfigResponse = {
  activeTemplateProfileId?: string;
  currentUser?: {
    tenantId?: string;
  } | null;
  templateProfiles?: Array<{
    id: string;
    label?: string;
    defaults?: {
      paymentMethod?: string;
      taxRate?: number;
      withholdingRate?: number;
    };
    business?: {
      bankAccount?: string;
    };
    design?: {
      layout?: string;
    };
  }>;
};

export type ClientRecord = {
  recordId?: string;
  name: string;
  taxId?: string;
  email?: string;
  address?: string;
  city?: string;
  province?: string;
  taxCountryCode?: string;
  taxIdType?: string;
  contactPerson?: string;
};
