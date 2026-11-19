/** En borrador el usuario debe elegir explícitamente en Facturar. */
export type DocumentType = "" | "factura" | "presupuesto";
export type TotalsBasis = "items" | "gross";

export type InvoiceItem = {
  concept: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal?: number;
  /** Etiqueta de unidad; modo por persona si coincide con persona/personas/comensal/comensales/pax (legacy). */
  unitLabel?: string;
  /** Solo aplica en modo por persona: en presupuesto/PDF oculta el subtotal explícito en el texto del concepto. */
  hidePerPersonSubtotalInBudget?: boolean;
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

export type DocumentAccountingStatus = "" | "ENVIADA" | "COBRADA" | "CANCELADA";

export type DocumentAccounting = {
  status: DocumentAccountingStatus;
  paymentDate: string;
  quarter: string;
  invoiceId: string;
  netCollected: number;
  taxes: string;
};

export type InvoiceDocumentDesign = {
  layout?: string;
  [key: string]: unknown;
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
  /** Nombre del proyecto al que se factura/presupuesta (se imprime en la plantilla). */
  projectName: string;
  templateLayout: string;
  /** Datos visuales legacy (tipografias, colores, medidas, etc.). */
  design: InvoiceDocumentDesign;
  paymentMethod: string;
  bankAccount: string;
  accounting: DocumentAccounting;
  client: DocumentClient;
  items: InvoiceItem[];
  taxRate: number;
  withholdingRate: 0 | 7 | 15 | 19 | 21;
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

export type TemplateProfileDesign = {
  layout?: string;
  fontFamily?: string;
  /** Parámetros completos del diseño del PDF (`designConfig.ts`). */
  [key: string]: unknown;
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
    /** Bloque de servicios superior del PDF (legacy `businessReferenceTopCopy`). */
    referenceTopCopy?: string;
    showReferenceTopCopy?: boolean;
    /** Pie de página del PDF. */
    footerUrl?: string;
    footerSloganTop?: string;
    footerSloganBottom?: string;
    footerNote?: string;
    showFooterSlogan?: boolean;
    showFooterUrl?: boolean;
    showFooterNote?: boolean;
    showSignature?: boolean;
    showPaymentStrip?: boolean;
    showFinanceStrip?: boolean;
  };
  design?: TemplateProfileDesign;
  /** Diseño propio para presupuestos (si difiere del de facturas). */
  designPresupuesto?: TemplateProfileDesign;
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
  };
  templateProfiles?: TemplateProfileConfig[];
};

export type ClientRecord = {
  recordId?: string;
  /** Emisor (plantilla) al que pertenece el cliente; vacío = legacy hasta normalizar (solo admin en API). */
  templateProfileId?: string;
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
