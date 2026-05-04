import type { ReactNode } from "react";

import type { CalculatedTotals, InvoiceDocument } from "@/domain/document/types";
import { formatCurrency } from "@/lib/utils";

type FacturarSaveSummaryProps = {
  document: InvoiceDocument;
  profileLabel: string;
  lineTotals: CalculatedTotals["items"];
};

function typeLabel(type: InvoiceDocument["type"]): string {
  if (type === "factura") return "Factura";
  if (type === "presupuesto") return "Presupuesto";
  return "Sin elegir";
}

function accountingStatusLabel(status: string): string {
  const u = String(status || "").toUpperCase();
  if (u === "ENVIADA") return "Enviada";
  if (u === "COBRADA") return "Cobrada";
  if (u === "CANCELADA") return "Cancelada";
  return "Sin elegir";
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 font-medium text-foreground">{children}</span>
    </div>
  );
}

export function FacturarSaveSummary({ document, profileLabel, lineTotals }: FacturarSaveSummaryProps) {
  const w = document.withholdingRate;
  const irpfPct = w === "" ? 0 : w;

  return (
    <section className="rounded-md border border-border bg-muted/30 p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Resumen antes de guardar</h3>
      <div className="grid gap-3 text-sm">
        <div className="space-y-2 border-b border-border pb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Emisor</p>
          <Row label="Emisor">{profileLabel.trim() || "—"}</Row>
          <Row label="Plantilla">{String(document.templateLayout || "").trim() || "—"}</Row>
          <Row label="Pago">{String(document.paymentMethod || "").trim() || "—"}</Row>
          <Row label="Cuenta">{String(document.bankAccount || "").trim() || "—"}</Row>
        </div>

        <div className="space-y-2 border-b border-border pb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documento</p>
          <Row label="Tipo">{typeLabel(document.type)}</Row>
          <Row label="Estado contable">{accountingStatusLabel(document.accounting.status)}</Row>
          <Row label="Número">{String(document.number || "").trim() || "—"}</Row>
          <Row label="Serie">{String(document.series || "").trim() || "—"}</Row>
          <Row label="Emisión">{String(document.issueDate || "").trim() || "—"}</Row>
          <Row label="Vencimiento">{String(document.dueDate || "").trim() || "—"}</Row>
          <Row label="Referencia">{String(document.reference || "").trim() || "—"}</Row>
          <Row label="Cálculo conceptos">
            {document.totalsBasis === "gross" ? "Por bruto (desde líneas)" : "Por líneas"}
          </Row>
        </div>

        <div className="space-y-2 border-b border-border pb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente</p>
          <Row label="Nombre">{String(document.client?.name || "").trim() || "—"}</Row>
          <Row label="CIF/NIF">{String(document.client?.taxId || "").trim() || "—"}</Row>
          <Row label="Ciudad">{String(document.client?.city || "").trim() || "—"}</Row>
          <Row label="Email">{String(document.client?.email || "").trim() || "—"}</Row>
        </div>

        <div className="space-y-2 border-b border-border pb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fiscal</p>
          <Row label="IGIC">{`${Number(document.taxRate ?? 0).toFixed(2)} %`}</Row>
          <Row label="IRPF">{w === "" ? "Sin retención" : `${irpfPct} %`}</Row>
        </div>

        <div className="space-y-2 border-b border-border pb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Importes</p>
          <Row label="Bruto">{formatCurrency(document.subtotal)}</Row>
          <Row label="IGIC">{formatCurrency(document.taxAmount)}</Row>
          <Row label="IRPF">{formatCurrency(document.withholdingAmount)}</Row>
          <Row label="Total">{formatCurrency(document.total)}</Row>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Líneas</p>
          {lineTotals.length ? (
            <ul className="grid list-none gap-1.5 pl-0">
              {lineTotals.map((line, index) => {
                const title = String(line.concept || "").trim() || String(line.description || "").trim() || `Línea ${index + 1}`;
                return (
                  <li key={`${title}-${index}`} className="flex flex-wrap justify-between gap-2 text-sm">
                    <span className="min-w-0 flex-1 break-words">{title}</span>
                    <span className="shrink-0 tabular-nums">{formatCurrency(line.total)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground">Sin líneas.</p>
          )}
        </div>
      </div>
    </section>
  );
}
