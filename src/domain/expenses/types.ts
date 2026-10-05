import { z } from "zod";

export const expenseRecordSchema = z.object({
  vendor: z.string().trim().min(1, "El proveedor es obligatorio."),
  issueDate: z.string().trim().min(1, "La fecha es obligatoria."),
  subtotal: z.number().finite(),
  total: z.number().finite(),
  taxRate: z.number().finite().nonnegative().max(100).optional(),
  taxAmount: z.number().finite().optional(),
  withholdingRate: z.number().finite().nonnegative().max(100).optional(),
  withholdingAmount: z.number().finite().optional(),
  category: z.string().trim().optional(),
  expenseConcept: z.string().trim().optional(),
  deductible: z.boolean().optional(),
});

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
