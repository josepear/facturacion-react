import { normalizeQuarterValue } from "@/domain/accounting/quarter";
import type { ExpenseRecord } from "@/domain/expenses/types";
import type { HistoryInvoice } from "@/features/history/types/historyInvoice";

export const ADVISOR_PROFILE_ALL = "__all__";
export const ADVISOR_PROFILE_UNASSIGNED = "__unassigned__";

export type AdvisorShareScope = "both" | "invoices" | "expenses";

export type AdvisorInvoiceStatusFilter = "all" | "COBRADA" | "ENVIADA" | "CANCELADA" | "pending_any";

export type AdvisorShareSpec = {
  year: string;
  quarter: string;
  profile: string;
  scope: AdvisorShareScope;
  invoiceStatus: AdvisorInvoiceStatusFilter;
  client: string;
  expenseDeductible: string;
  vendor: string;
  category: string;
};

export function normAdvisorStatus(raw: string | undefined): string {
  return String(raw || "").trim().toUpperCase();
}

export function exerciseYearFromItem(item: { year?: string; issueDate?: string }): string {
  const y = String(item.year || "").trim();
  if (/^\d{4}$/u.test(y)) {
    return y;
  }
  const d = String(item.issueDate || "").trim();
  if (/^\d{4}/u.test(d)) {
    return d.slice(0, 4);
  }
  return "";
}

export function matchesControlProfileFilter(
  item: { templateProfileId?: string },
  selectedProfile: string,
  profileAllToken = ADVISOR_PROFILE_ALL,
  profileUnassignedToken = ADVISOR_PROFILE_UNASSIGNED,
): boolean {
  const profileId = String(item?.templateProfileId || "").trim();
  if (selectedProfile === profileAllToken) {
    return true;
  }
  if (selectedProfile === profileUnassignedToken) {
    return !profileId;
  }
  return profileId === selectedProfile;
}

type InvoiceFilterStatus = "all" | "paid" | "pending";

function filterInvoicesBase(
  items: HistoryInvoice[],
  opts: {
    filterYear: string;
    filterQuarter: string;
    filterStatus: InvoiceFilterStatus;
    searchText: string;
    selectedProfile: string;
    profileAllToken?: string;
    profileUnassignedToken?: string;
  },
): HistoryInvoice[] {
  const profileAllToken = opts.profileAllToken ?? ADVISOR_PROFILE_ALL;
  const profileUnassignedToken = opts.profileUnassignedToken ?? ADVISOR_PROFILE_UNASSIGNED;
  const normalizedSearch = String(opts.searchText || "").trim().toLowerCase();

  return items.filter((item) => {
    const itemType = String((item as { type?: string }).type || "factura").trim().toLowerCase();
    if (itemType !== "factura" && itemType !== "presupuesto") {
      return false;
    }

    const exYear = exerciseYearFromItem(item);
    const matchesYear = opts.filterYear === "all" || exYear === opts.filterYear;
    const itemQuarter = normalizeQuarterValue(
      String((item as { quarter?: string }).quarter || ""),
      String(item.issueDate || ""),
    );
    const matchesQuarter = opts.filterQuarter === "all" || itemQuarter === opts.filterQuarter;

    const st = normAdvisorStatus(item.status);
    const matchesStatus =
      opts.filterStatus === "all" || (opts.filterStatus === "paid" ? st === "COBRADA" : st !== "COBRADA");

    const matchesProfile = matchesControlProfileFilter(item, opts.selectedProfile, profileAllToken, profileUnassignedToken);

    const haystack = [
      item.number,
      item.clientName,
      item.status,
      item.typeLabel,
      item.templateProfileLabel,
      item.recordId,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      matchesYear &&
      matchesQuarter &&
      matchesStatus &&
      matchesProfile &&
      (!normalizedSearch || haystack.includes(normalizedSearch))
    );
  });
}

export function buildShareReportInvoiceListFromParams(
  items: HistoryInvoice[],
  params: Pick<AdvisorShareSpec, "year" | "quarter" | "profile" | "invoiceStatus" | "client">,
): HistoryInvoice[] {
  const filterStatus: InvoiceFilterStatus =
    params.invoiceStatus === "COBRADA" ? "paid" : params.invoiceStatus === "pending_any" ? "pending" : "all";

  let list = filterInvoicesBase(items, {
    filterYear: params.year,
    filterQuarter: params.quarter,
    filterStatus,
    searchText: "",
    selectedProfile: params.profile,
  });

  const st = String(params.invoiceStatus || "").trim();
  if (st === "ENVIADA") {
    list = list.filter((item) => normAdvisorStatus(item.status) === "ENVIADA");
  } else if (st === "CANCELADA") {
    list = list.filter((item) => normAdvisorStatus(item.status) === "CANCELADA");
  }

  if (params.client && params.client !== "all") {
    list = list.filter((item) => String(item.clientName || "").trim() === params.client);
  }

  return list;
}

/** Alineado con `filterControlExpenses` en `public/modules/control-filter-helpers.mjs` (motor de la hoja de control). */
export function filterControlExpensesWorkbook(
  items: ExpenseRecord[],
  params: {
    filterYear: string;
    filterQuarter: string;
    filterDeductible: "all" | "yes" | "no";
    searchText: string;
    selectedProfile: string;
    profileAllToken?: string;
    profileUnassignedToken?: string;
  },
): ExpenseRecord[] {
  const profileAllToken = params.profileAllToken ?? ADVISOR_PROFILE_ALL;
  const profileUnassignedToken = params.profileUnassignedToken ?? ADVISOR_PROFILE_UNASSIGNED;
  const normalizedSearch = String(params.searchText || "").trim().toLowerCase();

  return items.filter((item) => {
    const exYear = exerciseYearFromItem(item);
    const matchesYear = params.filterYear === "all" || exYear === params.filterYear;
    const itemQuarter = normalizeQuarterValue(String(item.quarter || ""), String(item.issueDate || ""));
    const matchesQuarter = params.filterQuarter === "all" || itemQuarter === params.filterQuarter;
    const matchesDeductible =
      params.filterDeductible === "all" ||
      (params.filterDeductible === "yes" ? Boolean(item.deductible) : !item.deductible);
    const matchesProfile = matchesControlProfileFilter(
      item,
      params.selectedProfile,
      profileAllToken,
      profileUnassignedToken,
    );
    const haystack = [
      item.vendor,
      item.description,
      item.invoiceNumber,
      item.invoiceNumberEnd,
      item.taxId,
      item.taxIdType,
      item.taxCountryCode,
      item.operationDate,
      item.expenseConcept,
      item.category,
      item.templateProfileLabel,
    ]
      .filter(Boolean)
      .join(" ")
      .trim()
      .toLowerCase();

    return (
      matchesYear &&
      matchesQuarter &&
      matchesDeductible &&
      matchesProfile &&
      (!normalizedSearch || haystack.includes(normalizedSearch))
    );
  });
}

/** Alineado con `getExerciseScopeItems` solo para gastos (año + perfil, sin trimestre ni búsqueda). */
export function filterExerciseScopeExpensesWorkbook(
  items: ExpenseRecord[],
  params: {
    filterYear: string;
    selectedProfile: string;
    profileAllToken?: string;
    profileUnassignedToken?: string;
  },
): ExpenseRecord[] {
  const profileAllToken = params.profileAllToken ?? ADVISOR_PROFILE_ALL;
  const profileUnassignedToken = params.profileUnassignedToken ?? ADVISOR_PROFILE_UNASSIGNED;

  return items.filter((item) => {
    const exYear = exerciseYearFromItem(item);
    const matchesYear = params.filterYear === "all" || exYear === params.filterYear;
    const matchesProfile = matchesControlProfileFilter(
      item,
      params.selectedProfile,
      profileAllToken,
      profileUnassignedToken,
    );
    return matchesYear && matchesProfile;
  });
}

/** Orden por defecto de la tabla de gastos en hoja de control (`compareExpenseRecordsByDefault` en legacy). */
export function sortExpenseWorkbookDefault(items: ExpenseRecord[]): ExpenseRecord[] {
  return [...items].sort((left, right) => {
    const leftDate = String(left.issueDate || "").trim();
    const rightDate = String(right.issueDate || "").trim();
    if (leftDate !== rightDate) {
      return rightDate.localeCompare(leftDate);
    }
    const vendorCompare = String(left.vendor || "").localeCompare(String(right.vendor || ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (vendorCompare !== 0) {
      return vendorCompare;
    }
    return String(left.recordId || "").localeCompare(String(right.recordId || ""), undefined, { numeric: true });
  });
}

export function buildShareReportExpenseListFromParams(
  items: ExpenseRecord[],
  params: Pick<AdvisorShareSpec, "year" | "quarter" | "profile" | "expenseDeductible" | "vendor" | "category">,
): ExpenseRecord[] {
  const ded: "all" | "yes" | "no" =
    params.expenseDeductible === "yes" ? "yes" : params.expenseDeductible === "no" ? "no" : "all";

  let list = filterControlExpensesWorkbook(items, {
    filterYear: params.year,
    filterQuarter: params.quarter,
    filterDeductible: ded,
    searchText: "",
    selectedProfile: params.profile,
  });

  if (params.vendor && params.vendor !== "all") {
    list = list.filter((item) => String(item.vendor || "").trim() === params.vendor);
  }
  if (params.category && params.category !== "all") {
    list = list.filter((item) => String(item.category || "").trim() === params.category);
  }

  return list;
}

export function sortInvoiceRowsForAdvisor(items: HistoryInvoice[]): HistoryInvoice[] {
  return [...items].sort((left, right) => {
    const leftNumber = String(left.number || "").trim();
    const rightNumber = String(right.number || "").trim();
    const numberCompare = leftNumber.localeCompare(rightNumber, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (numberCompare !== 0) {
      return numberCompare;
    }
    return String(left.issueDate || "").localeCompare(String(right.issueDate || ""));
  });
}

export function sortExpenseRowsForAdvisor(items: ExpenseRecord[]): ExpenseRecord[] {
  return [...items].sort((left, right) => {
    const dateCompare = String(right.issueDate || "").localeCompare(String(left.issueDate || ""));
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return String(left.vendor || "").localeCompare(String(right.vendor || ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

export type AdvisorAlert = { tone: "neutral"; text: string };

export function collectShareReportAlerts(
  wideInvoices: HistoryInvoice[],
  wideExpenses: ExpenseRecord[],
): AdvisorAlert[] {
  const alerts: AdvisorAlert[] = [];
  const invNoClient = wideInvoices.filter((item) => !String(item.clientName || "").trim()).length;
  if (invNoClient) {
    alerts.push({
      tone: "neutral",
      text: `Atención: ${invNoClient} factura(s) sin cliente claro en el periodo y perfil elegidos (revisa el destinatario).`,
    });
  }

  const invNoDate = wideInvoices.filter((item) => !String(item.issueDate || "").trim()).length;
  if (invNoDate) {
    alerts.push({
      tone: "neutral",
      text: `Atención: ${invNoDate} factura(s) sin fecha de emisión en ese criterio.`,
    });
  }

  const invOddStatus = wideInvoices.filter((item) => {
    const s = normAdvisorStatus(item.status);
    return Boolean(s) && !["COBRADA", "ENVIADA", "CANCELADA"].includes(s);
  }).length;
  if (invOddStatus) {
    alerts.push({
      tone: "neutral",
      text: `${invOddStatus} factura(s) con un estado poco habitual; se muestran tal cual en los datos.`,
    });
  }

  const expNoVendor = wideExpenses.filter((item) => !String(item.vendor || "").trim()).length;
  if (expNoVendor) {
    alerts.push({
      tone: "neutral",
      text: `Atención: ${expNoVendor} gasto(s) sin proveedor en el periodo y perfil elegidos.`,
    });
  }

  const expZero = wideExpenses.filter((item) => !(Number(item.total) > 0)).length;
  if (expZero) {
    alerts.push({
      tone: "neutral",
      text: `${expZero} gasto(s) con importe 0 o vacío (siguen contando en el número de filas).`,
    });
  }

  return alerts;
}

export function formatAdvisorSectionTitle(prefix: string, yearRaw: string, quarterRaw: string): string {
  const year = yearRaw === "all" ? "TODOS" : String(yearRaw);
  const quarter =
    quarterRaw === "all" ? "TODO-AÑO" : (() => {
      const m = String(quarterRaw).trim().toUpperCase().match(/^T([1-4])$/u);
      return m ? `Q${m[1]}` : String(quarterRaw);
    })();
  return `${prefix}-${quarter}-${year}`;
}

export function formatAdvisorCompactDate(value = ""): string {
  const normalized = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) {
    return normalized || "Sin fecha";
  }
  const parts = normalized.split("-");
  const y = parts[0] ?? "";
  const month = parts[1] ?? "";
  const day = parts[2] ?? "";
  return `${day}/${month}/${y.slice(-2)}`;
}

export function accountingStatusLabel(statusRaw: string): string {
  const s = normAdvisorStatus(statusRaw);
  if (s === "COBRADA") {
    return "Cobrada";
  }
  if (s === "CANCELADA") {
    return "Cancelada";
  }
  if (s === "ENVIADA") {
    return "Enviada";
  }
  return s || "—";
}
