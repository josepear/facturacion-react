import { z } from "zod";

export const invoiceItemSchema = z.object({
  concept: z.string().trim(),
  description: z.string().trim(),
  quantity: z.number().nonnegative(),
  unitPrice: z.number().nonnegative(),
  lineTotal: z.number().optional(),
});

export const invoiceClientSchema = z.object({
  name: z.string().trim().min(1, "El cliente es obligatorio."),
  taxId: z.string().trim(),
  taxIdType: z.string().trim(),
  taxCountryCode: z.string().trim(),
  address: z.string().trim(),
  city: z.string().trim(),
  province: z.string().trim(),
  email: z.string().trim(),
  contactPerson: z.string().trim(),
});

export const invoiceAccountingSchema = z.object({
  status: z.enum(["ENVIADA", "COBRADA", "CANCELADA"]),
  paymentDate: z.string().trim(),
  quarter: z.string().trim(),
  invoiceId: z.string().trim(),
  netCollected: z.number(),
  taxes: z.string().trim(),
});

export const invoiceDocumentSchema = z.object({
  type: z.enum(["factura", "presupuesto"]),
  templateProfileId: z.string().trim().min(1, "Falta el perfil de plantilla."),
  tenantId: z.string().trim(),
  number: z.string().trim(),
  series: z.string().trim(),
  issueDate: z.string().trim().min(1, "La fecha de emisión es obligatoria."),
  dueDate: z.string().trim(),
  reference: z.string().trim(),
  templateLayout: z.string().trim(),
  paymentMethod: z.string().trim(),
  bankAccount: z.string().trim(),
  accounting: invoiceAccountingSchema,
  client: invoiceClientSchema,
  items: z
    .array(invoiceItemSchema)
    .min(1, "Se necesita al menos una línea.")
    .refine((items) => items.some((item) => item.concept || item.description), {
      message: "Añade al menos un concepto o descripción.",
    }),
  taxRate: z.number().finite().nonnegative(),
  withholdingRate: z.union([z.literal(""), z.literal(15), z.literal(19), z.literal(21)]),
  totalsBasis: z.enum(["items", "gross"]),
  manualGrossSubtotal: z.number().nonnegative(),
  subtotal: z.number(),
  taxAmount: z.number(),
  withholdingAmount: z.number(),
  total: z.number(),
});

export type InvoiceDocumentInput = z.infer<typeof invoiceDocumentSchema>;
