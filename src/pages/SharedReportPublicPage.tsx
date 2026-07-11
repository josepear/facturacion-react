import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileBadge } from "@/components/ui/ProfileBadge";
import { QuarterBadge } from "@/components/ui/QuarterBadge";
import { formatQuarterShortLabel, normalizeQuarterValue } from "@/domain/accounting/quarter";
import {
  accountingStatusLabel,
  formatAdvisorQuarterSelectionLabel,
  formatAdvisorCompactDate,
  formatAdvisorSectionTitle,
  normalizeAdvisorQuarterSelection,
} from "@/features/data/lib/advisorShareFilters";
import { resolveCalendarQuarter, workbookQuarterRowToneClass } from "@/features/shared/lib/quarterVisual";
import { workbookDataTableBase, workbookDataTdTight, workbookDataTdVariable } from "@/features/shared/lib/workbookTableText";
import type { PublicShareReportPayload } from "@/infrastructure/api/exportReportsApi";
import {
  downloadPublicShareWorkbookExport,
  fetchPublicShareReport,
  normalizeShareReportToken,
} from "@/infrastructure/api/exportReportsApi";
import { getErrorMessageFromUnknown } from "@/infrastructure/api/httpClient";
import { cn, formatCurrency } from "@/lib/utils";

import {
  PickableTotalButton,
  ShareReportPickSumDock,
  pickIdExpense,
  pickIdInvoice,
  useShareReportPickSum,
} from "@/pages/sharedReportPickSum";

const PUBLIC_SHARE_QUARTERS = ["T1", "T2", "T3", "T4"] as const;

type PublicShareViewMode = "all" | "documents" | "invoices" | "quotes" | "expenses";

function scopeLabel(scope: string): string {
  const s = String(scope || "").trim().toLowerCase();
  if (s === "invoices") {
    return "Documentos";
  }
  if (s === "expenses") {
    return "Solo gastos";
  }
  return "Todo";
}

function metaSummaryLine(report: PublicShareReportPayload): string {
  const meta = report.meta || {};
  const yearLabel = meta.year === "all" || !meta.year ? "Todos los ejercicios" : String(meta.year);
  const quarterLabel = formatAdvisorQuarterSelectionLabel(
    normalizeAdvisorQuarterSelection(meta.quarters ?? (meta.quarter ? [meta.quarter] : [])),
  );
  const profile = String(meta.profileLabel || meta.templateProfileId || "—").trim() || "—";
  return `${yearLabel} · ${quarterLabel} · ${profile} · ${scopeLabel(String(meta.scope || "both"))}`;
}

function normalizePublicSearchText(raw: string): string {
  return String(raw || "").trim().toLowerCase();
}

function buildInvoiceSearchText(row: NonNullable<PublicShareReportPayload["invoices"]>[number]): string {
  return [
    row.typeLabel,
    row.number,
    row.clientName,
    row.status,
    row.taskLabel,
    row.reference,
    row.description,
    row.templateProfileLabel,
    row.clientTaxId,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildExpenseSearchText(row: NonNullable<PublicShareReportPayload["expenses"]>[number]): string {
  return [
    row.vendor,
    row.expenseConcept,
    row.category,
    row.templateProfileLabel,
    row.taxId,
    row.operationDate,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function invoiceMatchesViewMode(
  row: NonNullable<PublicShareReportPayload["invoices"]>[number],
  viewMode: PublicShareViewMode,
): boolean {
  const typeLabel = String(row.typeLabel || "").trim().toLowerCase();
  const isQuote = typeLabel.includes("presupuesto");
  if (viewMode === "expenses") {
    return false;
  }
  if (viewMode === "invoices") {
    return !isQuote;
  }
  if (viewMode === "quotes") {
    return isQuote;
  }
  return true;
}

function expenseMatchesViewMode(viewMode: PublicShareViewMode): boolean {
  return viewMode === "all" || viewMode === "expenses";
}

function deriveExportScope(viewMode: PublicShareViewMode): "both" | "invoices" | "expenses" {
  if (viewMode === "expenses") {
    return "expenses";
  }
  if (viewMode === "documents" || viewMode === "invoices" || viewMode === "quotes") {
    return "invoices";
  }
  return "both";
}

function deriveExportDocumentKind(viewMode: PublicShareViewMode): "all" | "facturas" | "presupuestos" {
  if (viewMode === "invoices") {
    return "facturas";
  }
  if (viewMode === "quotes") {
    return "presupuestos";
  }
  return "all";
}

function buildVisibleScopeKey(viewMode: PublicShareViewMode, invoicesCount: number, expensesCount: number): "both" | "invoices" | "expenses" {
  if (expensesCount > 0 && invoicesCount === 0) {
    return "expenses";
  }
  if (invoicesCount > 0 && expensesCount === 0) {
    return "invoices";
  }
  return viewMode === "expenses" ? "expenses" : viewMode === "documents" || viewMode === "invoices" || viewMode === "quotes" ? "invoices" : "both";
}

function visibleSummaryLine(viewMode: PublicShareViewMode, quarters: string[], searchText: string): string {
  const parts: string[] = [];
  parts.push(`Vista: ${
    viewMode === "documents"
      ? "Documentos"
      : viewMode === "invoices"
        ? "Solo facturas"
        : viewMode === "quotes"
          ? "Solo presupuestos"
          : viewMode === "expenses"
            ? "Solo gastos"
            : "Todo"
  }`);
  if (quarters.length) {
    parts.push(`Trimestres: ${quarters.map((quarter) => formatQuarterShortLabel(quarter) || quarter).join(" + ")}`);
  }
  if (searchText.trim()) {
    parts.push(`Buscar: ${searchText.trim()}`);
  }
  return parts.join(" · ");
}

function filteredTotalsLabel(viewMode: PublicShareViewMode): string {
  if (viewMode === "expenses") {
    return "Total gastos filtrados";
  }
  if (viewMode === "documents" || viewMode === "invoices" || viewMode === "quotes") {
    return "Total documentos filtrados";
  }
  return "Total de los totales filtrados";
}

function quarterSectionSurfaceClass(quarter: string): string {
  const k = String(quarter || "").trim().toUpperCase();
  const by: Record<string, string> = {
    T1: "bg-emerald-500/12 text-emerald-950 dark:bg-emerald-500/18 dark:text-emerald-50",
    T2: "bg-sky-500/12 text-sky-950 dark:bg-sky-500/18 dark:text-sky-50",
    T3: "bg-violet-500/12 text-violet-950 dark:bg-violet-500/18 dark:text-violet-50",
    T4: "bg-amber-500/14 text-amber-950 dark:bg-amber-500/20 dark:text-amber-50",
  };
  return by[k] || "bg-muted/70 text-foreground";
}

function quarterSectionBorderClass(quarter: string): string {
  const k = String(quarter || "").trim().toUpperCase();
  const by: Record<string, string> = {
    T1: "border-emerald-500/40",
    T2: "border-sky-500/40",
    T3: "border-violet-500/40",
    T4: "border-amber-500/45",
  };
  return by[k] || "border-border";
}

function buildQuarterGroups<T>(
  rows: T[],
  getQuarter: (row: T) => string,
  getTotal: (row: T) => number,
): Array<{ quarter: string; total: number; rows: T[] }> {
  const groups: Array<{ quarter: string; total: number; rows: T[] }> = [];
  for (const row of rows) {
    const quarter = normalizeQuarterValue(String(getQuarter(row) || ""), "");
    const last = groups[groups.length - 1];
    if (!last || last.quarter !== quarter) {
      groups.push({
        quarter,
        total: Number(getTotal(row) || 0),
        rows: [row],
      });
      continue;
    }
    last.rows.push(row);
    last.total = Number((last.total + (Number(getTotal(row)) || 0)).toFixed(2));
  }
  return groups;
}

export function SharedReportPublicPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => normalizeShareReportToken(String(searchParams.get("t") || "")), [searchParams]);
  const [searchText, setSearchText] = useState("");
  const [selectedQuarters, setSelectedQuarters] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const reportQuery = useQuery({
    queryKey: ["public-share-report", token],
    queryFn: () => fetchPublicShareReport(token),
    enabled: Boolean(token),
    staleTime: 60_000,
  });

  const report = reportQuery.data;
  const totals = report?.totals;
  const meta = report?.meta;
  const invoices = report?.invoices ?? [];
  const expenses = report?.expenses ?? [];
  const scope = String(meta?.scope || "both").toLowerCase();
  const viewMode: PublicShareViewMode =
    scope === "expenses" ? "expenses" : scope === "invoices" ? "documents" : "all";

  const { handlePick, clear, selectAll, aggregates, isPicked } = useShareReportPickSum();

  useEffect(() => {
    clear();
  }, [report, clear]);

  useEffect(() => {
    setSearchText("");
    setSelectedQuarters([]);
  }, [scope, token]);

  const normalizedSearch = useMemo(() => normalizePublicSearchText(searchText), [searchText]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((row) => {
      if (!invoiceMatchesViewMode(row, viewMode)) {
        return false;
      }
      const quarter = normalizeQuarterValue("", String(row.issueDate || ""));
      if (selectedQuarters.length && !selectedQuarters.includes(quarter)) {
        return false;
      }
      if (normalizedSearch && !buildInvoiceSearchText(row).includes(normalizedSearch)) {
        return false;
      }
      return true;
    });
  }, [invoices, normalizedSearch, selectedQuarters, viewMode]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((row) => {
      if (!expenseMatchesViewMode(viewMode)) {
        return false;
      }
      const quarter = normalizeQuarterValue(String(row.quarter || ""), String(row.issueDate || ""));
      if (selectedQuarters.length && !selectedQuarters.includes(quarter)) {
        return false;
      }
      if (normalizedSearch && !buildExpenseSearchText(row).includes(normalizedSearch)) {
        return false;
      }
      return true;
    });
  }, [expenses, normalizedSearch, selectedQuarters, viewMode]);

  const invoiceQuarterGroups = useMemo(
    () =>
      buildQuarterGroups(
        filteredInvoices,
        (row) => normalizeQuarterValue("", String(row.issueDate || "")),
        (row) => Number(row.total ?? 0),
      ),
    [filteredInvoices],
  );

  const expenseQuarterGroups = useMemo(
    () =>
      buildQuarterGroups(
        filteredExpenses,
        (row) => normalizeQuarterValue(String(row.quarter || ""), String(row.issueDate || "")),
        (row) => Number(row.total ?? 0),
      ),
    [filteredExpenses],
  );

  useEffect(() => {
    clear();
  }, [clear, normalizedSearch, selectedQuarters, viewMode]);

  const filteredInvoiceCount = filteredInvoices.length;
  const filteredExpenseCount = filteredExpenses.length;
  const filteredInvoicesTotal = filteredInvoices.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
  const filteredInvoicesVigente = filteredInvoices.reduce((sum, row) => {
    const status = String(row.status || "").trim().toUpperCase();
    return status === "CANCELADA" ? sum : sum + (Number(row.total) || 0);
  }, 0);
  const filteredExpensesTotal = filteredExpenses.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
  const filteredCombinedTotal =
    viewMode === "expenses"
      ? filteredExpensesTotal
      : viewMode === "documents"
        ? filteredInvoicesTotal
        : filteredInvoicesTotal + filteredExpensesTotal;
  const margin =
    deriveExportScope(viewMode) === "both" && (filteredInvoiceCount > 0 || filteredExpenseCount > 0)
      ? filteredInvoicesVigente - filteredExpensesTotal
      : null;

  const metaQuarters = normalizeAdvisorQuarterSelection(meta?.quarters ?? (meta?.quarter ? [meta.quarter] : []));
  const invTitle = formatAdvisorSectionTitle("FACTURACIÓN", String(meta?.year || "all"), String(meta?.quarter || "all"), metaQuarters);
  const expTitle = formatAdvisorSectionTitle("GASTOS", String(meta?.year || "all"), String(meta?.quarter || "all"), metaQuarters);

  const hasPickableRows =
    filteredInvoiceCount > 0 || filteredExpenseCount > 0;
  const visibleScopeKey = buildVisibleScopeKey(viewMode, filteredInvoiceCount, filteredExpenseCount);

  async function handleExportWorkbook() {
    if (!token) {
      return;
    }
    setIsExporting(true);
    try {
      await downloadPublicShareWorkbookExport({
        token,
        scope: deriveExportScope(viewMode),
        documentKind: deriveExportDocumentKind(viewMode),
        searchText,
        quarters: selectedQuarters,
      });
    } catch (error) {
      window.alert(getErrorMessageFromUnknown(error));
    } finally {
      setIsExporting(false);
    }
  }

  function toggleQuarter(quarter: string) {
    setSelectedQuarters((current) =>
      current.includes(quarter) ? current.filter((item) => item !== quarter) : [...current, quarter].sort(),
    );
  }

  function resetTools() {
    setSearchText("");
    setSelectedQuarters([]);
  }

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 bg-background px-6 py-10 text-foreground">
        <h1 className="text-xl font-semibold">Informe compartido</h1>
        <p className="text-informative">Falta el identificador del enlace (parámetro <code className="rounded bg-muted px-1">t</code> en la URL).</p>
      </main>
    );
  }

  if (reportQuery.isLoading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 bg-background px-6 py-10 text-foreground">
        <p className="text-informative">Cargando informe…</p>
      </main>
    );
  }

  if (reportQuery.isError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 bg-background px-6 py-10 text-foreground">
        <h1 className="text-xl font-semibold">Informe compartido</h1>
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {getErrorMessageFromUnknown(reportQuery.error)}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 bg-background px-4 py-8 pb-36 text-foreground sm:px-6">
      <header className="space-y-2 border-b border-border pb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-informative">Solo lectura · sin sesión</p>
        <h1 className="text-2xl font-semibold tracking-tight">Resumen para asesoría</h1>
        <p className="text-sm text-informative">{metaSummaryLine(report!)}</p>
        <p className="text-xs text-informative">{visibleSummaryLine(viewMode, selectedQuarters, searchText)}</p>
        {report?.expiresAt ? (
          <p className="text-xs text-informative">
            Caducidad del enlace:{" "}
            {new Date(report.expiresAt).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        ) : null}
      </header>

      <Card className="border-primary/20 bg-muted/20">
        <CardHeader>
          <CardTitle className="text-base">Herramientas para asesoría</CardTitle>
          <CardDescription>
            Puedes filtrar esta vista, imprimirla o descargar un Excel con exactamente lo que estás viendo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4">
            <label className="space-y-2">
              <span className="text-sm font-medium">Buscar</span>
              <input
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
                placeholder="Cliente, proveedor, número, concepto, NIF..."
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
            </label>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/80 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-2 text-sm font-medium">Trimestres</span>
              {PUBLIC_SHARE_QUARTERS.map((quarter) => {
                const active = selectedQuarters.includes(quarter);
                return (
                  <Button
                    key={quarter}
                    type="button"
                    variant={active ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleQuarter(quarter)}
                  >
                    {formatQuarterShortLabel(quarter) || quarter}
                  </Button>
                );
              })}
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedQuarters([...PUBLIC_SHARE_QUARTERS])}>
                Todos
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedQuarters([])}>
                Ninguno
              </Button>
            </div>
            <p className="mt-3 text-xs text-informative">
              Si no marcas ninguno, se muestran todos. Puedes combinar, por ejemplo, 1T y 4T.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={resetTools}>
              Limpiar filtros
            </Button>
            <Button type="button" variant="outline" onClick={() => window.print()}>
              Imprimir
            </Button>
            <Button type="button" onClick={handleExportWorkbook} disabled={isExporting}>
              {isExporting ? "Preparando Excel..." : "Exportar Excel de esta vista"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-informative text-sm font-medium">Documentos visibles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{filteredInvoiceCount}</p>
            <p className="mt-1 text-xs text-informative">Total bruto: {formatCurrency(filteredInvoicesTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-informative text-sm font-medium">Gastos visibles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{filteredExpenseCount}</p>
            <p className="mt-1 text-xs text-informative">Total: {formatCurrency(filteredExpensesTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-informative text-sm font-medium">Ingresos vigentes visibles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{formatCurrency(filteredInvoicesVigente)}</p>
            <p className="mt-1 text-xs text-informative">Excluye facturas canceladas</p>
          </CardContent>
        </Card>
      </div>

      {margin !== null ? (
        <Card className="border-primary/25 bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resultado aproximado</CardTitle>
            <CardDescription>Ingresos vigentes visibles menos gastos visibles.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-semibold tabular-nums ${margin >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>
              {formatCurrency(margin)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {viewMode !== "expenses" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{invTitle}</CardTitle>
            <CardDescription>
              Documentos incluidos en el enlace. Los totales de fila siguen siendo sumables abajo.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0 sm:p-6">
            {filteredInvoices.length === 0 ? (
              <p className="p-4 text-sm text-informative">Sin documentos en este criterio.</p>
            ) : (
              <table className={cn(workbookDataTableBase, "min-w-[44rem]")}>
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-informative">
                    <th className="p-2 font-medium">Trim.</th>
                    <th className="p-2 font-medium">Tipo</th>
                    <th className="p-2 font-medium">Número</th>
                    <th className="p-2 font-medium">Cliente</th>
                    <th className="p-2 font-medium">Fecha</th>
                    <th className="p-2 font-medium">Estado</th>
                    <th className="p-2 font-medium">Emisor</th>
                    <th className="p-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceQuarterGroups.map((group, groupIndex) => (
                    <>
                      <tr
                        key={`invoice-quarter-${group.quarter}-${groupIndex}`}
                        className={`border-y-2 ${quarterSectionBorderClass(group.quarter)} ${quarterSectionSurfaceClass(group.quarter)}`}
                      >
                        <td colSpan={8} className="px-3 py-4">
                          <div className="flex flex-wrap items-end justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-xs font-semibold uppercase tracking-[0.24em] opacity-75">Cambio de trimestre</p>
                              <p className="text-2xl font-semibold tracking-tight">
                                {formatQuarterShortLabel(group.quarter) || group.quarter || "Sin trimestre"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-medium uppercase tracking-[0.22em] opacity-75">Total trimestre</p>
                              <p className="text-3xl font-semibold tabular-nums">
                                {formatCurrency(group.total)}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {group.rows.map((row, rowIndex) => {
                        const flatIndex = filteredInvoices.indexOf(row);
                        const pid = pickIdInvoice(flatIndex >= 0 ? flatIndex : rowIndex);
                        const qNorm = resolveCalendarQuarter("", String(row.issueDate || ""));
                        const client = row.clientName || "—";
                        const statusLabel = accountingStatusLabel(String(row.status ?? ""));
                        const typeLabel = String(row.typeLabel || "").trim() || "Documento";
                        return (
                          <tr key={`${row.number}-${row.issueDate}-${row.typeLabel}-${groupIndex}-${rowIndex}`} className={`border-b border-border/60 ${workbookQuarterRowToneClass(qNorm)}`}>
                            <td className="p-2 align-middle">
                              <QuarterBadge issueDate={String(row.issueDate || "")} />
                            </td>
                            <td className={workbookDataTdVariable} title={typeLabel}>
                              {typeLabel}
                            </td>
                            <td className={workbookDataTdVariable} title={row.number || undefined}>
                              {row.number || "—"}
                            </td>
                            <td className={workbookDataTdVariable} title={client !== "—" ? client : undefined}>
                              {client}
                            </td>
                            <td className={workbookDataTdTight} title={formatAdvisorCompactDate(String(row.issueDate || ""))}>
                              {formatAdvisorCompactDate(String(row.issueDate || ""))}
                            </td>
                            <td className={workbookDataTdVariable} title={statusLabel}>
                              {statusLabel}
                            </td>
                            <td className={workbookDataTdVariable} title={row.templateProfileLabel || undefined}>
                              {row.templateProfileLabel ? (
                                <span className="inline-flex min-w-0 max-w-full align-middle">
                                  <ProfileBadge label={row.templateProfileLabel} colorKey={row.colorKey} />
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className={`${workbookDataTdTight} text-right align-middle`}>
                              <PickableTotalButton
                                id={pid}
                                kind="invoice"
                                amount={Number(row.total ?? 0)}
                                picked={isPicked(pid)}
                                onPick={handlePick}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {viewMode === "all" || viewMode === "expenses" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{expTitle}</CardTitle>
            <CardDescription>
              Gastos incluidos en el enlace. También puedes sumarlos desde la barra inferior.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0 sm:p-6">
            {filteredExpenses.length === 0 ? (
              <p className="p-4 text-sm text-informative">Sin gastos en este criterio.</p>
            ) : (
              <table className={cn(workbookDataTableBase, "min-w-[32rem]")}>
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-informative">
                    <th className="p-2 font-medium">Trim.</th>
                    <th className="p-2 font-medium">Proveedor</th>
                    <th className="p-2 font-medium">Concepto</th>
                    <th className="p-2 font-medium">Fecha</th>
                    <th className="p-2 font-medium">Emisor</th>
                    <th className="p-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseQuarterGroups.map((group, groupIndex) => (
                    <>
                      <tr
                        key={`expense-quarter-${group.quarter}-${groupIndex}`}
                        className={`border-y-2 ${quarterSectionBorderClass(group.quarter)} ${quarterSectionSurfaceClass(group.quarter)}`}
                      >
                        <td colSpan={6} className="px-3 py-4">
                          <div className="flex flex-wrap items-end justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-xs font-semibold uppercase tracking-[0.24em] opacity-75">Cambio de trimestre</p>
                              <p className="text-2xl font-semibold tracking-tight">
                                {formatQuarterShortLabel(group.quarter) || group.quarter || "Sin trimestre"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-medium uppercase tracking-[0.22em] opacity-75">Total trimestre</p>
                              <p className="text-3xl font-semibold tabular-nums">
                                {formatCurrency(group.total)}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {group.rows.map((row, rowIndex) => {
                        const flatIndex = filteredExpenses.indexOf(row);
                        const pid = pickIdExpense(flatIndex >= 0 ? flatIndex : rowIndex);
                        const qNorm = resolveCalendarQuarter(String(row.quarter || ""), String(row.issueDate || ""));
                        const vendor = row.vendor || "—";
                        const concept = String(row.expenseConcept || "").trim() || "—";
                        return (
                          <tr key={`${row.vendor}-${row.issueDate}-${groupIndex}-${rowIndex}`} className={`border-b border-border/60 ${workbookQuarterRowToneClass(qNorm)}`}>
                            <td className="p-2 align-middle">
                              <QuarterBadge quarter={String(row.quarter || "")} issueDate={String(row.issueDate || "")} />
                            </td>
                            <td className={workbookDataTdVariable} title={vendor !== "—" ? vendor : undefined}>
                              {vendor}
                            </td>
                            <td className={workbookDataTdVariable} title={concept !== "—" ? concept : undefined}>
                              {concept}
                            </td>
                            <td className={workbookDataTdTight} title={formatAdvisorCompactDate(String(row.issueDate || ""))}>
                              {formatAdvisorCompactDate(String(row.issueDate || ""))}
                            </td>
                            <td className={workbookDataTdVariable} title={row.templateProfileLabel || undefined}>
                              {row.templateProfileLabel ? (
                                <span className="inline-flex min-w-0 max-w-full align-middle">
                                  <ProfileBadge label={row.templateProfileLabel} colorKey={row.colorKey} />
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className={`${workbookDataTdTight} text-right align-middle`}>
                              <PickableTotalButton
                                id={pid}
                                kind="expense"
                                amount={Number(row.total ?? 0)}
                                picked={isPicked(pid)}
                                onPick={handlePick}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {hasPickableRows ? (
        <div className={`fixed right-4 z-40 w-[min(26rem,calc(100vw-2rem))] ${hasPickableRows ? "bottom-32" : "bottom-6"}`}>
          <div className="rounded-2xl border border-primary/30 bg-background/95 px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.14)] backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-informative">
              {filteredTotalsLabel(viewMode)}
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-primary">
              {formatCurrency(filteredCombinedTotal)}
            </p>
            <p className="mt-1 text-xs text-informative">
              Documentos: {formatCurrency(filteredInvoicesTotal)} · Gastos: {formatCurrency(filteredExpensesTotal)}
            </p>
          </div>
        </div>
      ) : (
        <div className="fixed bottom-6 right-4 z-40 w-[min(26rem,calc(100vw-2rem))]">
          <div className="rounded-2xl border border-primary/30 bg-background/95 px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.14)] backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-informative">
              {filteredTotalsLabel(viewMode)}
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-primary">
              {formatCurrency(filteredCombinedTotal)}
            </p>
            <p className="mt-1 text-xs text-informative">
              Documentos: {formatCurrency(filteredInvoicesTotal)} · Gastos: {formatCurrency(filteredExpensesTotal)}
            </p>
          </div>
        </div>
      )}

      {hasPickableRows ? (
        <ShareReportPickSumDock
          scope={visibleScopeKey}
          invoices={filteredInvoices}
          expenses={filteredExpenses}
          aggregates={aggregates}
          onSelectAll={(mode) => selectAll(mode, filteredInvoices, filteredExpenses)}
          onClear={clear}
        />
      ) : null}

      <footer className="border-t border-border pt-6 text-center text-xs text-informative">
        Vista generada desde Facturación · el enlace sigue siendo seguro y solo añade herramientas de trabajo para revisar mejor la información.
      </footer>
    </main>
  );
}
