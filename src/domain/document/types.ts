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

export type InvoiceDocument = {
  type: DocumentType;
  templateProfileId: string;
  tenantId: string;
  number: string;
  series: string;
  issueDate: string;
  dueDate: string;
  reference: string;
  paymentMethod: string;
  bankAccount: string;
  client: DocumentClient;
  items: InvoiceItem[];
  taxRate: number;
  withholdingRate: number | "";
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
