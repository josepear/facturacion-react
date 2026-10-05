import { z } from "zod";

const spanishTaxIdPattern = /^[A-Za-z0-9][0-9]{7}[A-Za-z0-9]$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const invoiceItemSchema = z.object({
  concept: z.string().trim(),
  description: z.string().trim(),
  quantity: z.number().positive("La cantidad debe ser mayor que 0."),
  unitPrice: z.number(),
  lineTotal: z.number().optional(),
  unitLabel: z.string().trim().optional(),
  hidePerPersonSubtotalInBudget: z.boolean().optional(),
});

export const invoiceClientSchema = z.object({
  name: z.string().trim().min(1, "El cliente es obligatorio."),
  taxId: z.string().trim().min(1, "El NIF/CIF es obligatorio.").regex(spanishTaxIdPattern, "Formato de NIF/CIF no válido."),
  taxIdType: z.string().trim(),
  taxCountryCode: z.string().trim(),
  address: z.string().trim(),
  city: z.string().trim(),
  province: z.string().trim(),
  email: z.string().trim().email("Formato de email no válido.").or(z.literal("")),
  contactPerson: z.string().trim(),
});

export const invoiceAccountingSchema = z.object({
  status: z.union([z.literal(""), z.enum(["ENVIADA", "COBRADA", "CANCELADA"])]),
  paymentDate: z.string().trim(),
  quarter: z.string().trim(),
  invoiceId: z.string().trim(),
  netCollected: z.number(),
  taxes: z.string().trim(),
});

export const invoiceDocumentSchema = z.object({
  type: z.union([z.literal(""), z.literal("factura"), z.literal("presupuesto")]),
  templateProfileId: z.string().trim().min(1, "Falta el emisor (plantilla)."),
  tenantId: z.string().trim(),
  number: z.string().trim(),
  numberEnd: z.string().trim(),
  series: z.string().trim(),
  issueDate: z.string().trim().min(1, "La fecha de emisión es obligatoria.").regex(isoDatePattern, "Formato de fecha no válido (YYYY-MM-DD)."),
  dueDate: z.string().trim(),
  reference: z.string().trim(),
  templateLayout: z.string().trim(),
  design: z.record(z.string(), z.unknown()),
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
  taxRate: z.number().finite().nonnegative().max(100, "El tipo impositivo no puede superar el 100%."),
  withholdingRate: z.union([z.literal(0), z.literal(7), z.literal(15), z.literal(19), z.literal(21)]),
  totalsBasis: z.enum(["items", "gross"]),
  manualGrossSubtotal: z.number().nonnegative(),
  subtotal: z.number(),
  taxAmount: z.number(),
  withholdingAmount: z.number(),
  total: z.number(),
})
  .superRefine((data, ctx) => {
    if (data.type !== "factura" && data.type !== "presupuesto") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Elige factura o presupuesto.",
        path: ["type"],
      });
    }
    if (!data.accounting.status) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Elige un estado contable.",
        path: ["accounting", "status"],
      });
    }
  });

export type InvoiceDocumentInput = z.infer<typeof invoiceDocumentSchema>;
