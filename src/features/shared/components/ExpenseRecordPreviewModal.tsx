import { useEffect } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import type { ExpenseRecord } from "@/domain/expenses/types";
import { formatAdvisorCompactDate } from "@/features/data/lib/advisorShareFilters";
import { CLOSE } from "@/features/shared/lib/uiActionCopy";
import { formatCurrency } from "@/lib/utils";

function row(label: string, value: string) {
  return (
    <div className="grid gap-0.5 border-b border-border/60 py-2 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{value || "—"}</dd>
    </div>
  );
}

export type ExpenseRecordPreviewModalProps = {
  open: boolean;
  expense: ExpenseRecord | null;
  onOpenChange: (open: boolean) => void;
};

/**
 * Resumen legible de un gasto (no hay HTML oficial en API como en facturas).
 */
export function ExpenseRecordPreviewModal({ open, expense, onOpenChange }: ExpenseRecordPreviewModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (typeof document === "undefined" || !open || !expense) {
    return null;
  }

  const rid = String(expense.recordId || expense.id || "").trim();
  const issue = String(expense.issueDate || "").trim();
  const issueFmt = issue ? formatAdvisorCompactDate(issue) : "—";

  return createPortal(
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-6" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label={`${CLOSE} vista de gasto`}
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="expense-preview-modal-title"
        className="relative z-[1] flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 id="expense-preview-modal-title" className="text-sm font-semibold text-foreground">
            Vista de gasto
          </h2>
          <Button type="button" variant="default" size="sm" onClick={() => onOpenChange(false)}>
            {CLOSE}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <dl>
            {row("recordId", rid)}
            {row("Proveedor", String(expense.vendor || ""))}
            {row("Descripción", String(expense.description || ""))}
            {row("Concepto contable", String(expense.expenseConcept || ""))}
            {row("Fecha factura", issueFmt)}
            {row("Fecha operación", String(expense.operationDate || "").trim() ? formatAdvisorCompactDate(String(expense.operationDate)) : "")}
            {row("Nº factura proveedor", String(expense.invoiceNumber || ""))}
            {row("Categoría", String(expense.category || ""))}
            {row("Forma de pago", String(expense.paymentMethod || ""))}
            {row("Emisor (perfil)", String(expense.templateProfileLabel || expense.templateProfileId || ""))}
            {row("Base", formatCurrency(Number(expense.subtotal || 0)))}
            {row("IGIC %", String(expense.taxRate ?? ""))}
            {row("Cuota IGIC", formatCurrency(Number(expense.taxAmount || 0)))}
            {row("IRPF %", String(expense.withholdingRate ?? ""))}
            {row("Retención", formatCurrency(Number(expense.withholdingAmount || 0)))}
            {row("Total", formatCurrency(Number(expense.total || 0)))}
            {row(
              "Deducible",
              expense.deductible === false ? "No deducible" : expense.deductible === true ? "Deducible" : "—",
            )}
            {row("Notas", String(expense.notes || ""))}
            {row("Nextcloud / enlace", String(expense.nextcloudUrl || ""))}
          </dl>
        </div>
      </div>
    </div>,
    document.body,
  );
}
