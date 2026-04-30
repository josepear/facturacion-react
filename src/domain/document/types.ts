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
  /** Número final / rango (legacy `numberEnd`); opcional. */
  numberEnd: string;
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

export type TemplateProfileConfig = {
  id: string;
  label?: string;
  tenantId?: string;
  colorKey?: string;
  invoiceNumberTag?: string;
  defaults?: {
    paymentMethod?: string;
    taxRate?: number;
    withholdingRate?: number;
    /** Moneda por defecto (p. ej. EUR), alineado con legacy `defaultCurrency`. */
    currency?: string;
    /** Serie por defecto para numeración si el backend la publica en el perfil. */
    series?: string;
  };
  business?: {
    brand?: string;
    /** Responsable / nombre completo en factura (legacy `businessContactName`). */
    contactName?: string;
    /** Línea descriptiva corta (legacy `businessHeadline`). */
    headline?: string;
    taxId?: string;
    email?: string;
    address?: string;
    phone?: string;
    website?: string;
    /** Entidad bancaria (legacy `businessBankBrand`). */
    bankBrand?: string;
    bankAccount?: string;
    /** Ruta o URL de logo (legacy `businessBrandImage`). */
    brandImage?: string;
    /** Ruta o URL de firma (legacy `businessSignatureImage`). */
    signatureImage?: string;
  };
  design?: {
    layout?: string;
  };
};

export type ConfigResponse = {
  activeTemplateProfileId?: string;
  /**
   * Opcional en JSON legacy; la SPA no debe usarlo para rol/tenant.
   * Identidad: `GET /api/session`.
   */
  currentUser?: {
    id?: string;
    email?: string;
    name?: string;
    role?: string;
    tenantId?: string;
    allowedTemplateProfileIds?: string[];
  } | null;
  defaults?: {
    paymentMethod?: string;
    taxRate?: number;
    withholdingRate?: number;
    currency?: string;
    /** Serie por defecto a nivel tenant si el backend la publica. */
    series?: string;
  };
  templateProfiles?: TemplateProfileConfig[];
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
