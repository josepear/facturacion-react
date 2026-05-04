import { Eye, ScanEye } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ExpenseRecord } from "@/domain/expenses/types";
import { ExpenseRecordPreviewModal } from "@/features/shared/components/ExpenseRecordPreviewModal";
import { InvoiceHtmlPreviewModal } from "@/features/shared/components/InvoiceHtmlPreviewModal";
import { cn } from "@/lib/utils";

export type InvoicePreviewListTriggerProps = {
  recordId: string;
  /** Número o etiqueta corta para accesibilidad y subtítulo del modal. */
  label?: string;
  className?: string;
};

/** Icono «ojo»: abre modal con HTML oficial / vista previa de la factura o presupuesto. */
export function InvoicePreviewListTrigger({ recordId, label, className }: InvoicePreviewListTriggerProps) {
  const [open, setOpen] = useState(false);
  const id = String(recordId || "").trim();
  if (!id) {
    return null;
  }
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground", className)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Vista previa de la factura ${label || id}`}
      >
        <Eye className="h-4 w-4" />
      </Button>
      <InvoiceHtmlPreviewModal open={open} recordId={open ? id : null} subtitle={label} onOpenChange={setOpen} />
    </>
  );
}

export type ExpensePreviewListTriggerProps = {
  expense: ExpenseRecord;
  className?: string;
};

/** Icono distinto (ScanEye): abre modal con resumen del gasto (no hay HTML de gasto en API). */
export function ExpensePreviewListTrigger({ expense, className }: ExpensePreviewListTriggerProps) {
  const [open, setOpen] = useState(false);
  const vendor = String(expense.vendor || "Gasto").trim();
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground", className)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Vista del gasto ${vendor}`}
      >
        <ScanEye className="h-4 w-4" />
      </Button>
      <ExpenseRecordPreviewModal open={open} expense={open ? expense : null} onOpenChange={setOpen} />
    </>
  );
}
