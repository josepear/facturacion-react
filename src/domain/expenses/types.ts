export type ExpenseRecord = {
  recordId?: string;
  id?: string;
  year?: string;
  issueDate?: string;
  operationDate?: string;
  vendor?: string;
  taxId?: string;
  taxIdType?: string;
  taxCountryCode?: string;
  invoiceNumber?: string;
  invoiceNumberEnd?: string;
  category?: string;
  expenseConcept?: string;
  paymentMethod?: string;
  quarter?: string;
  nextcloudUrl?: string;
  description?: string;
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  withholdingRate?: number;
  withholdingAmount?: number;
  total?: number;
  deductible?: boolean;
  notes?: string;
  templateProfileId?: string;
  templateProfileLabel?: string;
  tenantId?: string;
  savedAt?: string;
  updatedAt?: string;
};

export type ExpenseOptions = {
  vendors?: string[];
  categories?: string[];
};

