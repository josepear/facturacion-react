import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileBadge } from "@/components/ui/ProfileBadge";
import { QuarterBadge } from "@/components/ui/QuarterBadge";
import {
  accountingStatusLabel,
  formatAdvisorCompactDate,
  formatAdvisorSectionTitle,
  formatQuarterShortLabel,
} from "@/features/data/lib/advisorShareFilters";
import { resolveCalendarQuarter, workbookQuarterRowToneClass } from "@/features/shared/lib/quarterVisual";
import { workbookDataTableBase, workbookDataTdTight, workbookDataTdVariable } from "@/features/shared/lib/workbookTableText";
import type { PublicShareReportPayload } from "@/infrastructure/api/exportReportsApi";
import { fetchPublicShareReport, normalizeShareReportToken } from "@/infrastructure/api/exportReportsApi";
import { getErrorMessageFromUnknown } from "@/infrastructure/api/httpClient";
import { cn, formatCurrency } from "@/lib/utils";

import {
  PickableTotalButton,
  ShareReportPickSumDock,
  pickIdExpense,
  pickIdInvoice,
  useShareReportPickSum,
} from "@/pages/sharedReportPickSum";

function scopeLabel(scope: string): string {
  const s = String(scope || "").trim().toLowerCase();
  if (s === "invoices") {
    return "Solo facturación";
  }
  if (s === "expenses") {
    return "Solo gastos";
  }
  return "Facturación y gastos";
}

function metaSummaryLine(report: PublicShareReportPayload): string {
  const meta = report.meta || {};
  const yearLabel = meta.year === "all" || !meta.year ? "Todos los ejercicios" : String(meta.year);
  const quarterLabel =
    meta.quarter === "all" || !meta.quarter ? "Todo el año" : formatQuarterShortLabel(String(meta.quarter)) || meta.quarter;
  const profile = String(meta.profileLabel || meta.templateProfileId || "—").trim() || "—";
  return `${yearLabel} · ${quarterLabel} · ${profile} · ${scopeLabel(String(meta.scope || "both"))}`;
}

export function SharedReportPublicPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => normalizeShareReportToken(String(searchParams.get("t") || "")), [searchParams]);

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
  const scopeKey = scope === "invoices" || scope === "expenses" ? scope : "both";

  const { handlePick, clear, selectAll, aggregates, isPicked } = useShareReportPickSum();

  useEffect(() => {
    clear();
  }, [report, clear]);

  const invTitle = formatAdvisorSectionTitle("FACTURACIÓN", String(meta?.year || "all"), String(meta?.quarter || "all"));
  const expTitle = formatAdvisorSectionTitle("GASTOS", String(meta?.year || "all"), String(meta?.quarter || "all"));

  const margin =
    scope === "both" && (invoices.length > 0 || expenses.length > 0) && typeof totals?.marginApprox === "number"
      ? totals.marginApprox
      : null;

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

  const hasPickableRows =
    (scope !== "expenses" && invoices.length > 0) || (scope !== "invoices" && expenses.length > 0);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 bg-background px-4 py-8 pb-36 text-foreground sm:px-6">
      <header className="space-y-2 border-b border-border pb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-informative">Solo lectura · sin sesión</p>
        <h1 className="text-2xl font-semibold tracking-tight">Resumen para asesoría</h1>
        <p className="text-sm text-informative">{metaSummaryLine(report!)}</p>
        {report?.expiresAt ? (
          <p className="text-xs text-informative">
            Caducidad del enlace:{" "}
            {new Date(report.expiresAt).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-informative text-sm font-medium">Facturas (listado)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{totals?.invoiceCount ?? invoices.length}</p>
            <p className="mt-1 text-xs text-informative">Total bruto: {formatCurrency(Number(totals?.invoicesTotal ?? 0))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-informative text-sm font-medium">Gastos (listado)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{totals?.expenseCount ?? expenses.length}</p>
            <p className="mt-1 text-xs text-informative">Total: {formatCurrency(Number(totals?.expensesTotal ?? 0))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-informative text-sm font-medium">Ingresos vigentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{formatCurrency(Number(totals?.invoicesVigente ?? 0))}</p>
            <p className="mt-1 text-xs text-informative">Excluye facturas canceladas (aprox.)</p>
          </CardContent>
        </Card>
      </div>

      {margin !== null ? (
        <Card className="border-primary/25 bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resultado aproximado</CardTitle>
            <CardDescription>Ingresos vigentes del listado menos total de gastos del listado.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-semibold tabular-nums ${margin >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>
              {formatCurrency(margin)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {scope !== "expenses" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{invTitle}</CardTitle>
            <CardDescription>
              Facturación incluida en el enlace. Los totales de fila son pulsables para acumularlos en la barra inferior.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0 sm:p-6">
            {invoices.length === 0 ? (
              <p className="p-4 text-sm text-informative">Sin facturas en este criterio.</p>
            ) : (
              <table className={cn(workbookDataTableBase, "min-w-[36rem]")}>
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-informative">
                    <th className="p-2 font-medium">Trim.</th>
                    <th className="p-2 font-medium">Número</th>
                    <th className="p-2 font-medium">Cliente</th>
                    <th className="p-2 font-medium">Fecha</th>
                    <th className="p-2 font-medium">Estado</th>
                    <th className="p-2 font-medium">Emisor</th>
                    <th className="p-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((row, idx) => {
                    const pid = pickIdInvoice(idx);
                    const qNorm = resolveCalendarQuarter("", String(row.issueDate || ""));
                    const client = row.clientName || "—";
                    const statusLabel = accountingStatusLabel(String(row.status ?? ""));
                    return (
                    <tr key={`${row.number}-${row.issueDate}-${idx}`} className={`border-b border-border/60 ${workbookQuarterRowToneClass(qNorm)}`}>
                      <td className="p-2 align-middle">
                        <QuarterBadge issueDate={String(row.issueDate || "")} />
                      </td>
                      <td className={workbookDataTdTight} title={row.number || undefined}>
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
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {scope !== "invoices" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{expTitle}</CardTitle>
            <CardDescription>
              Gastos incluidos en el enlace. Los totales de fila se pueden sumar igual que en la vista legacy.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0 sm:p-6">
            {expenses.length === 0 ? (
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
                  {expenses.map((row, idx) => {
                    const pid = pickIdExpense(idx);
                    const qNorm = resolveCalendarQuarter(String(row.quarter || ""), String(row.issueDate || ""));
                    const vendor = row.vendor || "—";
                    const concept = String(row.expenseConcept || "").trim() || "—";
                    return (
                    <tr key={`${row.vendor}-${row.issueDate}-${idx}`} className={`border-b border-border/60 ${workbookQuarterRowToneClass(qNorm)}`}>
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
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {hasPickableRows ? (
        <ShareReportPickSumDock
          scope={scopeKey}
          invoices={invoices}
          expenses={expenses}
          aggregates={aggregates}
          onSelectAll={(mode) => selectAll(mode, invoices, expenses)}
          onClear={clear}
        />
      ) : null}

      <footer className="border-t border-border pt-6 text-center text-xs text-informative">
        Vista generada desde Facturación · los datos reflejan el momento en que se abrió el enlace.
      </footer>
    </main>
  );
}
