import type { InvoiceDocument } from "@/domain/document/types";
import { formatCurrency } from "@/lib/utils";

type FinanceCell = {
  label: string;
  value: string;
  accent?: boolean;
  dark?: boolean;
};

type PreviewItem = {
  concept: string;
  description: string;
  amountLabel: string;
};

export type LegacyPreviewModel = {
  title: string;
  documentLabel: string;
  numberLabel: string;
  seriesLabel: string;
  issueDateLabel: string;
  dueDateLabel: string;
  referenceLabel: string;
  paymentMethodLabel: string;
  paymentAccountLabel: string;
  issuerLabel: string;
  clientName: string;
  clientTaxLabel: string;
  clientTaxMetaLabel: string;
  clientAddressLabel: string;
  clientEmailLabel: string;
  clientContactLabel: string;
  items: PreviewItem[];
  totalsBasisLabel: string;
  subtotalBaseLabel: string;
  financeCells: FinanceCell[];
};

function getDocumentTitle(type: InvoiceDocument["type"]) {
  return type === "presupuesto" ? "PRESUPUESTO" : "FACTURA";
}

function formatDateLabel(value: string) {
  const safe = String(value || "").trim();
  if (!safe) {
    return "Sin fecha";
  }
  const date = new Date(`${safe}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return safe;
  }
  return new Intl.DateTimeFormat("es-ES").format(date);
}

function formatLineAmountLabel(quantity: number, unitPrice: number, total: number) {
  if (unitPrice > 0 && quantity > 0) {
    return `${quantity} × ${formatCurrency(unitPrice)} = ${formatCurrency(total)}`;
  }
  return formatCurrency(total);
}

export function buildLegacyPreviewModel(document: InvoiceDocument): LegacyPreviewModel {
  const sourceItems = (document.items || []).map((item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const explicitTotal = item.lineTotal !== undefined && item.lineTotal !== null ? Number(item.lineTotal) : undefined;
    const total = unitPrice > 0 ? quantity * unitPrice : explicitTotal || 0;
    return {
      total,
      concept: String(item.concept || ""),
      description: String(item.description || ""),
      amountLabel: formatLineAmountLabel(quantity, unitPrice, total),
    };
  });
  const subtotalFromItems = sourceItems.reduce((sum, item) => sum + item.total, 0);
  const items = sourceItems.map((item) => ({
    concept: item.concept,
    description: item.description,
    amountLabel: item.amountLabel,
  }));

  const taxCountryCode = String(document.client?.taxCountryCode || "").trim();
  const taxIdType = String(document.client?.taxIdType || "").trim();
  const withholdingRate = document.withholdingRate === "" ? 0 : Number(document.withholdingRate || 0);
  const minusWithholding = withholdingRate > 0
    ? `-${formatCurrency(document.withholdingAmount || 0)}`
    : formatCurrency(document.withholdingAmount || 0);

  return {
    title: getDocumentTitle(document.type),
    documentLabel: document.type === "presupuesto" ? "Nº de PRESUPUESTO" : "Nº de FACTURA",
    numberLabel: String(document.number || "Sin número"),
    seriesLabel: String(document.series || ""),
    issueDateLabel: formatDateLabel(document.issueDate),
    dueDateLabel: formatDateLabel(document.dueDate),
    referenceLabel: String(document.reference || ""),
    paymentMethodLabel: String(document.paymentMethod || "-"),
    paymentAccountLabel: String(document.bankAccount || "-"),
    issuerLabel: String(document.templateProfileId || "Perfil sin asignar"),
    clientName: String(document.client?.name || "Sin cliente"),
    clientTaxLabel: String(document.client?.taxId || ""),
    clientTaxMetaLabel: [taxIdType, taxCountryCode].filter(Boolean).join(" · "),
    clientAddressLabel: [document.client?.address, document.client?.city, document.client?.province]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(" · "),
    clientEmailLabel: String(document.client?.email || ""),
    clientContactLabel: String(document.client?.contactPerson || ""),
    items,
    totalsBasisLabel: document.totalsBasis === "gross" ? "Base manual (bruto)" : "Suma de líneas",
    subtotalBaseLabel:
      document.totalsBasis === "gross"
        ? formatCurrency(Number(document.manualGrossSubtotal || 0))
        : formatCurrency(subtotalFromItems),
    financeCells: [
      {
        label: "BRUTO",
        value: formatCurrency(document.subtotal || 0),
        accent: true,
      },
      {
        label: `IGIC (${Number(document.taxRate || 0).toFixed(2)}%)`,
        value: formatCurrency(document.taxAmount || 0),
        accent: true,
      },
      {
        label: `IRPF (-${withholdingRate.toFixed(2)}%)`,
        value: minusWithholding,
        accent: true,
      },
      {
        label: "TOTAL A COBRAR",
        value: formatCurrency(document.total || 0),
        dark: true,
      },
    ],
  };
}
