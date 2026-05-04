import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileBadge } from "@/components/ui/ProfileBadge";
import { QuarterBadge } from "@/components/ui/QuarterBadge";
import { DataHistoricalImportPanel } from "@/features/data/components/DataHistoricalImportPanel";
import { useSessionQuery } from "@/features/shared/hooks/useSessionQuery";
import { colorKeyForTemplateProfile } from "@/features/shared/lib/templateProfileLookup";
import { resolveCalendarQuarter, workbookQuarterRowToneClass } from "@/features/shared/lib/quarterVisual";
import { workbookDataTableBase, workbookDataTdTight, workbookDataTdVariable } from "@/features/shared/lib/workbookTableText";
import { fetchRuntimeConfig } from "@/infrastructure/api/documentsApi";
import { fetchExpenses } from "@/infrastructure/api/expensesApi";
import { fetchHistoryInvoices } from "@/infrastructure/api/historyApi";
import { cn, formatCurrency } from "@/lib/utils";

function formatDate(value: string): string {
  const safe = String(value || "").trim();
  return safe || "-";
}

export function DataPage() {
  const [filterYear, setFilterYear] = useState("");
  const [filterProfile, setFilterProfile] = useState("");

  const historyQuery = useQuery({
    queryKey: ["history-invoices"],
    queryFn: fetchHistoryInvoices,
    staleTime: 60_000,
  });

  const expensesQuery = useQuery({
    queryKey: ["expenses"],
    queryFn: fetchExpenses,
    staleTime: 60_000,
  });

  const configQuery = useQuery({
    queryKey: ["runtime-config"],
    queryFn: fetchRuntimeConfig,
    staleTime: 300_000,
  });

  const sessionQuery = useSessionQuery();

  const profileOptions = useMemo(() => configQuery.data?.templateProfiles ?? [], [configQuery.data?.templateProfiles]);

  const isAdmin =
    Boolean(sessionQuery.data?.authenticated) &&
    String(sessionQuery.data?.user?.role || "").trim().toLowerCase() === "admin";

  const historyItems = historyQuery.data ?? [];
  const expenseItems = expensesQuery.data?.items ?? [];

  const availableYears = useMemo(() => {
    const invoiceYears = historyItems.map((i) => String(i.issueDate || "").slice(0, 4));
    const expenseYears = expenseItems.map((e) => String(e.issueDate || "").slice(0, 4));
    return Array.from(new Set([...invoiceYears, ...expenseYears].filter(Boolean))).sort().reverse();
  }, [historyItems, expenseItems]);

  const filteredInvoices = useMemo(() => {
    let items = historyItems.filter((i) => i.type === "factura");
    if (filterYear) {
      items = items.filter((i) => String(i.issueDate || "").startsWith(filterYear));
    }
    if (filterProfile) {
      items = items.filter((i) => i.templateProfileId === filterProfile);
    }
    return items;
  }, [historyItems, filterYear, filterProfile]);

  const filteredExpenses = useMemo(() => {
    let items = [...expenseItems];
    if (filterYear) {
      items = items.filter((e) => String(e.issueDate || "").startsWith(filterYear));
    }
    if (filterProfile) {
      items = items.filter((e) => e.templateProfileId === filterProfile);
    }
    return items;
  }, [expenseItems, filterYear, filterProfile]);

  const totalInvoiced = useMemo(
    () => filteredInvoices.reduce((s, i) => s + Number(i.total || 0), 0),
    [filteredInvoices],
  );
  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((s, e) => s + Number(e.total || 0), 0),
    [filteredExpenses],
  );
  const resultado = totalInvoiced - totalExpenses;

  const hasActiveFilters = Boolean(filterYear || filterProfile);

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 p-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Datos</h1>
        <p className="text-informative">Resumen financiero y listados de facturas y gastos con los mismos filtros.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-informative font-medium">Facturado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{formatCurrency(totalInvoiced)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-informative font-medium">Gastos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-informative font-medium">Resultado</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-semibold tabular-nums ${
                resultado > 0 ? "text-green-700" : resultado < 0 ? "text-red-600" : ""
              }`}
            >
              {formatCurrency(resultado)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="grid min-w-[10rem] gap-1">
            <label className="text-informative font-medium" htmlFor="data-filter-year">
              Año
            </label>
            <select
              id="data-filter-year"
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
            >
              <option value="">Todos los años</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="grid min-w-[12rem] flex-1 gap-1">
            <label className="text-informative font-medium" htmlFor="data-filter-profile">
              Emisor
            </label>
            <select
              id="data-filter-profile"
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={filterProfile}
              onChange={(e) => setFilterProfile(e.target.value)}
            >
              <option value="">Todos los emisores</option>
              {profileOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label || p.id}
                </option>
              ))}
            </select>
          </div>
          {hasActiveFilters ? (
            <Button type="button" variant="ghost" size="sm" className="mb-0.5" onClick={() => {
              setFilterYear("");
              setFilterProfile("");
            }}>
              Limpiar filtros
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {isAdmin ? (
        <DataHistoricalImportPanel
          templateProfiles={profileOptions.map((p) => ({ id: p.id, label: p.label ?? undefined }))}
        />
      ) : null}

      <div className="grid w-full grid-cols-1 gap-6">
        <Card className="w-full min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Facturas ({filteredInvoices.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0 sm:p-6">
            {historyQuery.isLoading ? (
              <p className="p-4 text-informative">Cargando…</p>
            ) : historyQuery.isError ? (
              <p className="p-4 text-sm text-red-600">{(historyQuery.error as Error)?.message || "Error al cargar facturas."}</p>
            ) : filteredInvoices.length === 0 ? (
              <p className="p-4 text-informative">Sin datos</p>
            ) : (
              <table className={`${workbookDataTableBase} min-w-[20rem]`}>
                <thead>
                  <tr className="border-b text-left text-informative">
                    <th className="p-2 font-medium">Trim.</th>
                    <th className="p-2 font-medium">Número</th>
                    <th className="p-2 font-medium">Cliente</th>
                    <th className="p-2 font-medium">Fecha</th>
                    <th className="p-2 font-medium">Emisor</th>
                    <th className="p-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((i) => {
                    const qNorm = resolveCalendarQuarter("", String(i.issueDate || ""));
                    const client = i.clientName || "—";
                    return (
                    <tr key={i.recordId} className={`border-b border-border/60 ${workbookQuarterRowToneClass(qNorm)}`}>
                      <td className="p-2 align-middle">
                        <QuarterBadge issueDate={String(i.issueDate || "")} />
                      </td>
                      <td className={cn(workbookDataTdTight, "text-left")} title={i.number || undefined}>
                        {i.number || "—"}
                      </td>
                      <td className={workbookDataTdVariable} title={client !== "—" ? client : undefined}>
                        {client}
                      </td>
                      <td className={workbookDataTdTight} title={formatDate(i.issueDate)}>
                        {formatDate(i.issueDate)}
                      </td>
                      <td className={workbookDataTdVariable} title={i.templateProfileLabel || undefined}>
                        {i.templateProfileLabel ? (
                          <span className="inline-flex min-w-0 max-w-full align-middle">
                            <ProfileBadge
                              label={i.templateProfileLabel}
                              colorKey={colorKeyForTemplateProfile(profileOptions, i.templateProfileId)}
                            />
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`${workbookDataTdTight} text-right tabular-nums`}>{formatCurrency(Number(i.total || 0))}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card className="w-full min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Gastos ({filteredExpenses.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0 sm:p-6">
            {expensesQuery.isLoading ? (
              <p className="p-4 text-informative">Cargando…</p>
            ) : expensesQuery.isError ? (
              <p className="p-4 text-sm text-red-600">{(expensesQuery.error as Error)?.message || "Error al cargar gastos."}</p>
            ) : filteredExpenses.length === 0 ? (
              <p className="p-4 text-informative">Sin datos</p>
            ) : (
              <table className={`${workbookDataTableBase} min-w-[20rem]`}>
                <thead>
                  <tr className="border-b text-left text-informative">
                    <th className="p-2 font-medium">Trim.</th>
                    <th className="p-2 font-medium">Proveedor</th>
                    <th className="p-2 font-medium">Concepto</th>
                    <th className="p-2 font-medium">Fecha</th>
                    <th className="p-2 font-medium">Emisor</th>
                    <th className="p-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((e) => {
                    const rid = String(e.recordId || e.id || "").trim() || `${e.issueDate}-${e.vendor}-${e.total}`;
                    const qNorm = resolveCalendarQuarter(String(e.quarter || ""), String(e.issueDate || ""));
                    const vendor = e.vendor || "—";
                    const concept = String(e.expenseConcept || e.description || "").trim() || "—";
                    return (
                      <tr key={rid} className={`border-b border-border/60 ${workbookQuarterRowToneClass(qNorm)}`}>
                        <td className="p-2 align-middle">
                          <QuarterBadge quarter={String(e.quarter || "")} issueDate={String(e.issueDate || "")} />
                        </td>
                        <td className={workbookDataTdVariable} title={vendor !== "—" ? vendor : undefined}>
                          {vendor}
                        </td>
                        <td className={workbookDataTdVariable} title={concept !== "—" ? concept : undefined}>
                          {concept}
                        </td>
                        <td className={workbookDataTdTight} title={formatDate(String(e.issueDate || ""))}>
                          {formatDate(String(e.issueDate || ""))}
                        </td>
                        <td className={workbookDataTdVariable} title={e.templateProfileLabel || undefined}>
                          {e.templateProfileLabel ? (
                            <span className="inline-flex min-w-0 max-w-full align-middle">
                              <ProfileBadge
                                label={e.templateProfileLabel}
                                colorKey={colorKeyForTemplateProfile(profileOptions, e.templateProfileId)}
                              />
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className={`${workbookDataTdTight} text-right tabular-nums`}>{formatCurrency(Number(e.total || 0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
