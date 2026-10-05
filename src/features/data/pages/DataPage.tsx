import { BarChart2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileBadge } from "@/components/ui/ProfileBadge";
import { QuarterBadge } from "@/components/ui/QuarterBadge";
import { DataHistoricalImportPanel } from "@/features/data/components/DataHistoricalImportPanel";
import {
  ExpensePreviewListTrigger,
  InvoicePreviewListTrigger,
} from "@/features/shared/components/RecordListPreviewTriggers";
import { useSessionQuery } from "@/features/shared/hooks/useSessionQuery";
import { isTemplateProfileInScope, resolveSessionScope } from "@/features/shared/lib/sessionScope";
import { colorKeyForTemplateProfile } from "@/features/shared/lib/templateProfileLookup";
import { filterControlExpensesWorkbook } from "@/features/data/lib/advisorShareFilters";
import { groupExpensesByMonth, workbookQuarterRowToneClass } from "@/features/expenses/lib/controlWorkbookExpenseMonths";
import { resolveCalendarQuarter } from "@/features/shared/lib/quarterVisual";
import { workbookDataTableBase, workbookDataTdTight, workbookDataTdVariable } from "@/features/shared/lib/workbookTableText";
import { fetchRuntimeConfig } from "@/infrastructure/api/documentsApi";
import { fetchExpenses } from "@/infrastructure/api/expensesApi";
import { fetchHistoryInvoices } from "@/infrastructure/api/historyApi";
import { cn, formatCurrency } from "@/lib/utils";

function formatDate(value: string): string {
  const safe = String(value || "").trim();
  return safe || "-";
}

function normalizeSearchText(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .trim();
}

function buildInvoiceSearchHaystack(item: {
  number?: string;
  clientName?: string;
  issueDate?: string;
  templateProfileLabel?: string;
  typeLabel?: string;
  status?: string;
  recordId?: string;
}): string {
  return normalizeSearchText(
    [
      item.number,
      item.clientName,
      item.issueDate,
      item.templateProfileLabel,
      item.typeLabel,
      item.status,
      item.recordId,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function getMonthKeyFromIssueDate(issueDate: string): string {
  const safe = String(issueDate || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/u.test(safe)) {
    return safe.slice(0, 7);
  }
  return "_sin_mes";
}

function formatMonthBanner(monthKey: string): string {
  if (monthKey === "_sin_mes") {
    return "Sin mes en fecha";
  }
  const [yearRaw, monthRaw] = String(monthKey || "").split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return String(monthKey || "").trim() || "Mes desconocido";
  }
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

type DataInvoiceRow = {
  recordId: string;
  number?: string;
  clientName?: string;
  issueDate?: string;
  quarter?: string;
  total?: number;
  templateProfileId?: string;
  templateProfileLabel?: string;
  type?: string;
  typeLabel?: string;
  status?: string;
};

type InvoiceMonthGroup = {
  monthKey: string;
  title: string;
  items: DataInvoiceRow[];
  monthTotal: number;
};

function groupInvoicesByMonth(items: DataInvoiceRow[]): InvoiceMonthGroup[] {
  const groups = new Map<string, DataInvoiceRow[]>();
  for (const item of items) {
    const key = getMonthKeyFromIssueDate(String(item.issueDate || ""));
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }
  const keys = [...groups.keys()].sort((left, right) => {
    if (left === "_sin_mes") return 1;
    if (right === "_sin_mes") return -1;
    return String(right).localeCompare(String(left));
  });
  return keys.map((key) => {
    const itemsForMonth = groups.get(key) ?? [];
    return {
      monthKey: key,
      title: formatMonthBanner(key),
      items: itemsForMonth,
      monthTotal: itemsForMonth.reduce((sum: number, item: DataInvoiceRow) => sum + Number(item.total || 0), 0),
    };
  });
}

export function DataPage() {
  const [filterYear, setFilterYear] = useState("");
  const [filterQuarters, setFilterQuarters] = useState<string[]>([]);
  const [contentFilter, setContentFilter] = useState<"all" | "documents" | "invoices" | "budgets" | "expenses">("all");
  const [filterProfile, setFilterProfile] = useState("");
  const [searchText, setSearchText] = useState("");

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

  const sessionScope = useMemo(
    () => resolveSessionScope(sessionQuery.data, profileOptions),
    [sessionQuery.data, profileOptions],
  );

  const scopedProfileOptions = useMemo(
    () => profileOptions.filter((p) => isTemplateProfileInScope(p.id, sessionScope)),
    [profileOptions, sessionScope],
  );

  const isAdmin =
    Boolean(sessionQuery.data?.authenticated) &&
    String(sessionQuery.data?.user?.role || "").trim().toLowerCase() === "admin";

  const historyItemsRaw = historyQuery.data ?? [];
  const expenseItemsRaw = expensesQuery.data?.items ?? [];

  const historyItems = useMemo(
    () =>
      historyItemsRaw.filter((i) => {
        const pid = String(i.templateProfileId || "").trim();
        if (!pid) {
          return sessionScope.isAdmin;
        }
        return isTemplateProfileInScope(pid, sessionScope);
      }),
    [historyItemsRaw, sessionScope],
  );

  const expenseItems = useMemo(
    () =>
      expenseItemsRaw.filter((e) => {
        const pid = String(e.templateProfileId || "").trim();
        if (!pid) {
          return sessionScope.isAdmin;
        }
        return isTemplateProfileInScope(pid, sessionScope);
      }),
    [expenseItemsRaw, sessionScope],
  );

  const availableYears = useMemo(() => {
    const invoiceYears = historyItems.map((i) => String(i.issueDate || "").slice(0, 4));
    const expenseYears = expenseItems.map((e) => String(e.issueDate || "").slice(0, 4));
    return Array.from(new Set([...invoiceYears, ...expenseYears].filter(Boolean))).sort().reverse();
  }, [historyItems, expenseItems]);

  const filteredDocumentRows = useMemo(() => {
    const normalizedSearch = normalizeSearchText(searchText);
    return historyItems
      .filter((i) => !filterYear || String(i.issueDate || "").startsWith(filterYear))
      .filter((i) => !filterProfile || i.templateProfileId === filterProfile)
      .filter(
        (i) =>
          !filterQuarters.length ||
          filterQuarters.includes(
            resolveCalendarQuarter(String((i as { quarter?: string }).quarter || ""), String(i.issueDate || "")),
          ),
      )
      .filter((i) => !normalizedSearch || buildInvoiceSearchHaystack(i).includes(normalizedSearch))
      .sort((left, right) => {
        const leftDate = String(left.issueDate || "");
        const rightDate = String(right.issueDate || "");
        if (leftDate !== rightDate) {
          return rightDate.localeCompare(leftDate);
        }
        return String(left.number || "").localeCompare(String(right.number || ""), undefined, { numeric: true });
      });
  }, [historyItems, filterYear, filterProfile, filterQuarters, searchText]);

  const filteredInvoices = useMemo(
    () => filteredDocumentRows.filter((i) => String(i.type || "").trim().toLowerCase() === "factura"),
    [filteredDocumentRows],
  );

  const filteredBudgets = useMemo(
    () => filteredDocumentRows.filter((i) => String(i.type || "").trim().toLowerCase() === "presupuesto"),
    [filteredDocumentRows],
  );

  const filteredExpenses = useMemo(() => {
    return filterControlExpensesWorkbook(expenseItems, {
      filterYear: filterYear || "all",
      filterQuarter: filterQuarters.length === 1 ? filterQuarters[0]! : "all",
      filterDeductible: "all",
      searchText,
      selectedProfile: filterProfile || "__all__",
    }).filter((item) =>
      !filterQuarters.length || filterQuarters.includes(resolveCalendarQuarter(String(item.quarter || ""), String(item.issueDate || ""))),
    );
  }, [expenseItems, filterYear, filterProfile, filterQuarters, searchText]);

  const invoiceMonthGroups = useMemo(() => groupInvoicesByMonth(filteredInvoices), [filteredInvoices]);
  const budgetMonthGroups = useMemo(() => groupInvoicesByMonth(filteredBudgets), [filteredBudgets]);
  const expenseMonthGroups = useMemo(() => groupExpensesByMonth(filteredExpenses), [filteredExpenses]);

  const totalInvoiced = useMemo(
    () => filteredInvoices.reduce((s, i) => s + Number(i.total || 0), 0),
    [filteredInvoices],
  );
  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((s, e) => s + Number(e.total || 0), 0),
    [filteredExpenses],
  );
  const totalVisibleInvoiced = contentFilter === "expenses" ? 0 : totalInvoiced;
  const totalVisibleExpenses = (contentFilter === "invoices" || contentFilter === "budgets" || contentFilter === "documents") ? 0 : totalExpenses;
  const resultado = totalVisibleInvoiced - totalVisibleExpenses;

  const showInvoices = contentFilter === "all" || contentFilter === "documents" || contentFilter === "invoices";
  const showBudgets = contentFilter === "all" || contentFilter === "documents" || contentFilter === "budgets";
  const showExpenses = contentFilter === "all" || contentFilter === "expenses";

  const hasActiveFilters = Boolean(filterYear || filterQuarters.length || filterProfile || String(searchText || "").trim() || contentFilter !== "all");

  const toggleQuarterFilter = (quarter: string) => {
    setFilterQuarters((prev) =>
      prev.includes(quarter) ? prev.filter((value) => value !== quarter) : [...prev, quarter].sort(),
    );
  };

  useEffect(() => {
    if (!filterProfile) {
      return;
    }
    if (!isTemplateProfileInScope(filterProfile, sessionScope)) {
      setFilterProfile("");
    }
  }, [filterProfile, sessionScope]);

  return (
    <main className="app-page-shell mx-auto flex w-full max-w-[1680px] flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
      <header className="space-y-2 pt-1">
        <div className="flex min-h-[44px] items-center gap-2 sm:min-h-0">
          <BarChart2 className="h-7 w-7 shrink-0 text-informative" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Datos</h1>
        </div>
        <p className="text-pretty text-sm text-informative sm:text-base">
          Resumen financiero y listados de facturas y gastos con filtros de ejercicio, trimestres combinables, emisor, tipo y búsqueda,
          en una lectura más cercana a hoja Excel.
        </p>
      </header>

      {!sessionScope.hasEmitterScope ? (
        <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-informative">
          Tu sesión no tiene emisores asignados para ver datos aquí. Contacta con un administrador.
        </p>
      ) : null}

      <Card className="min-w-0 rounded-2xl border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>Totales con filtros</CardTitle>
          <CardDescription>
            Importes según año y emisor seleccionados en «Filtros del listado». Solo facturas de tipo factura.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-1">
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="grid gap-1 rounded-md border border-border/60 bg-muted/15 p-4">
              <span className="text-sm font-medium text-foreground">Facturado</span>
              <p className="text-2xl font-semibold tabular-nums">{formatCurrency(totalVisibleInvoiced)}</p>
            </div>
            <div className="grid gap-1 rounded-md border border-border/60 bg-muted/15 p-4">
              <span className="text-sm font-medium text-foreground">Gastos</span>
              <p className="text-2xl font-semibold tabular-nums">{formatCurrency(totalVisibleExpenses)}</p>
            </div>
            <div className="grid gap-1 rounded-md border border-border/60 bg-muted/15 p-4">
              <span className="text-sm font-medium text-foreground">Resultado</span>
              <p
                className={cn(
                  "text-2xl font-semibold tabular-nums",
                  resultado > 0 ? "text-green-700 dark:text-green-400" : resultado < 0 ? "text-red-600 dark:text-red-400" : "",
                )}
              >
                {formatCurrency(resultado)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 rounded-2xl border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>Filtros del listado</CardTitle>
          <CardDescription>Aplica filtros combinables a facturas, presupuestos y gastos.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 pt-1">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,18rem)] sm:items-end">
            <label className="grid min-w-0 gap-1 text-sm" htmlFor="data-filter-year">
              <span className="font-medium text-foreground">Año</span>
              <select
                id="data-filter-year"
                className="flex h-10 min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:min-h-10"
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
            </label>
            <label className="grid min-w-0 gap-1 text-sm" htmlFor="data-filter-profile">
              <span className="font-medium text-foreground">Emisor</span>
              <select
                id="data-filter-profile"
                className="flex h-10 min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:min-h-10"
                value={filterProfile}
                onChange={(e) => setFilterProfile(e.target.value)}
                disabled={!sessionScope.hasEmitterScope}
              >
                <option value="">{sessionScope.isAdmin ? "Todos los emisores" : "Todos tus emisores"}</option>
                {(sessionScope.isAdmin ? profileOptions : scopedProfileOptions).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label || p.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1 text-sm" htmlFor="data-filter-content">
              <span className="font-medium text-foreground">Mostrar</span>
              <select
                id="data-filter-content"
                className="flex h-10 min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:min-h-10"
                value={contentFilter}
                onChange={(e) => setContentFilter(e.target.value as typeof contentFilter)}
              >
                <option value="all">Todo</option>
                <option value="documents">Documentos</option>
                <option value="invoices">Solo facturas</option>
                <option value="budgets">Solo presupuestos</option>
                <option value="expenses">Solo gastos</option>
              </select>
            </label>
            <label className="grid min-w-0 gap-1 text-sm" htmlFor="data-filter-search">
              <span className="font-medium text-foreground">Buscar</span>
              <input
                id="data-filter-search"
                className="flex h-10 min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:min-h-10"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Número, cliente, proveedor, concepto…"
              />
            </label>
          </div>
          <div className="grid gap-3 rounded-md border border-border/60 bg-muted/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium text-foreground">Trimestres</span>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setFilterQuarters(["T1", "T2", "T3", "T4"])}>Todos</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setFilterQuarters([])}>Ninguno</Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["T1", "T2", "T3", "T4"] as const).map((quarter) => {
                const active = filterQuarters.includes(quarter);
                return (
                  <Button
                    key={quarter}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    onClick={() => toggleQuarterFilter(quarter)}
                  >
                    {quarter.replace("T", "") + "T"}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-informative">
              Si no marcas ninguno, se muestran todos. Puedes combinar, por ejemplo, 1T y 4T a la vez.
            </p>
          </div>
          <div className="flex min-h-[44px] items-end sm:min-h-0">
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px] w-full touch-manipulation sm:min-h-9 sm:w-auto"
                onClick={() => {
                  setFilterYear("");
                  setFilterQuarters([]);
                  setFilterProfile("");
                  setContentFilter("all");
                  setSearchText("");
                }}
              >
                Limpiar filtros
              </Button>
            ) : (
              <span className="text-sm text-muted-foreground sm:pb-2">Sin filtros activos</span>
            )}
          </div>
        </CardContent>
      </Card>

      {isAdmin ? (
        <DataHistoricalImportPanel
          templateProfiles={profileOptions.map((p) => ({ id: p.id, label: p.label ?? undefined }))}
        />
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-8">
        {showInvoices ? (
        <Card className="min-w-0 overflow-hidden rounded-2xl border-sky-200/80 bg-sky-50/45 shadow-sm dark:border-sky-900/60 dark:bg-sky-950/20">
          <CardHeader>
            <CardTitle>Facturas ({filteredInvoices.length})</CardTitle>
            <CardDescription>Listado con búsqueda, filtro por trimestre y agrupación por meses.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 overflow-x-auto p-0 sm:p-6">
            {historyQuery.isLoading ? (
              <p className="p-4 text-informative">Cargando…</p>
            ) : historyQuery.isError ? (
              <p className="p-4 text-sm text-red-600">{(historyQuery.error as Error)?.message || "Error al cargar facturas."}</p>
            ) : filteredInvoices.length === 0 ? (
              <p className="p-4 text-informative">Sin datos</p>
            ) : (
              <div className="grid gap-5">
                {invoiceMonthGroups.map((group) => (
                  <section key={group.monthKey} className="grid gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200/80 bg-white/85 px-4 py-3 text-sm dark:border-sky-900/60 dark:bg-sky-950/30">
                      <span className="font-medium text-foreground">{group.title}</span>
                      <span className="tabular-nums text-informative">{group.items.length} factura(s) · {formatCurrency(group.monthTotal)}</span>
                    </div>
                    <table className={cn(workbookDataTableBase, "min-w-[26rem]") }>
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-informative">
                          <th className="p-2 font-medium">Trim.</th>
                          <th className="p-2 font-medium">Número</th>
                          <th className="p-2 font-medium">Cliente</th>
                          <th className="p-2 font-medium">Fecha</th>
                          <th className="p-2 font-medium">Emisor</th>
                          <th className="p-2 text-right font-medium">Total</th>
                          <th className="w-10 whitespace-nowrap p-2 text-center font-medium" title="Vista previa">Ver</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((i) => {
                          const qNorm = resolveCalendarQuarter(String(i.quarter || ""), String(i.issueDate || ""));
                          const client = i.clientName || "—";
                          return (
                            <tr key={i.recordId} className={`border-b border-border/60 ${workbookQuarterRowToneClass(qNorm)}`}>
                              <td className="p-2 align-middle">
                                <QuarterBadge issueDate={String(i.issueDate || "")} quarter={String(i.quarter || "")} />
                              </td>
                              <td className={cn(workbookDataTdVariable, "text-left")} title={i.number || undefined}>{i.number || "—"}</td>
                              <td className={workbookDataTdVariable} title={client !== "—" ? client : undefined}>{client}</td>
                              <td className={workbookDataTdTight} title={formatDate(String(i.issueDate || ""))}>{formatDate(String(i.issueDate || ""))}</td>
                              <td className={workbookDataTdVariable} title={i.templateProfileLabel || undefined}>
                                {i.templateProfileLabel ? (
                                  <span className="inline-flex min-w-0 max-w-full align-middle">
                                    <ProfileBadge label={i.templateProfileLabel} colorKey={colorKeyForTemplateProfile(profileOptions, i.templateProfileId)} />
                                  </span>
                                ) : "—"}
                              </td>
                              <td className={`${workbookDataTdTight} text-right tabular-nums`}>{formatCurrency(Number(i.total || 0))}</td>
                              <td className="p-2 text-center align-middle">
                                <InvoicePreviewListTrigger recordId={i.recordId} label={i.number || i.recordId} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </section>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        ) : null}

        {showBudgets ? (
        <Card className="min-w-0 overflow-hidden rounded-2xl border-amber-200/80 bg-amber-50/45 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle>Presupuestos ({filteredBudgets.length})</CardTitle>
            <CardDescription>Separados de las facturas y fuera del cálculo contable de facturación.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 overflow-x-auto p-0 sm:p-6">
            {historyQuery.isLoading ? (
              <p className="p-4 text-informative">Cargando…</p>
            ) : historyQuery.isError ? (
              <p className="p-4 text-sm text-red-600">{(historyQuery.error as Error)?.message || "Error al cargar presupuestos."}</p>
            ) : filteredBudgets.length === 0 ? (
              <p className="p-4 text-informative">Sin datos</p>
            ) : (
              <div className="grid gap-5">
                {budgetMonthGroups.map((group) => (
                  <section key={group.monthKey} className="grid gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-white/85 px-4 py-3 text-sm dark:border-amber-900/60 dark:bg-amber-950/30">
                      <span className="font-medium text-foreground">{group.title}</span>
                      <span className="tabular-nums text-informative">{group.items.length} presupuesto(s) · {formatCurrency(group.monthTotal)}</span>
                    </div>
                    <table className={cn(workbookDataTableBase, "min-w-[26rem]") }>
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-informative">
                          <th className="p-2 font-medium">Trim.</th>
                          <th className="p-2 font-medium">Número</th>
                          <th className="p-2 font-medium">Cliente</th>
                          <th className="p-2 font-medium">Fecha</th>
                          <th className="p-2 font-medium">Emisor</th>
                          <th className="p-2 text-right font-medium">Total</th>
                          <th className="w-10 whitespace-nowrap p-2 text-center font-medium" title="Vista previa">Ver</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((i) => {
                          const qNorm = resolveCalendarQuarter(String(i.quarter || ""), String(i.issueDate || ""));
                          const client = i.clientName || "—";
                          return (
                            <tr key={i.recordId} className={`border-b border-border/60 ${workbookQuarterRowToneClass(qNorm)}`}>
                              <td className="p-2 align-middle">
                                <QuarterBadge issueDate={String(i.issueDate || "")} quarter={String(i.quarter || "")} />
                              </td>
                              <td className={cn(workbookDataTdVariable, "text-left")} title={i.number || undefined}>{i.number || "—"}</td>
                              <td className={workbookDataTdVariable} title={client !== "—" ? client : undefined}>{client}</td>
                              <td className={workbookDataTdTight} title={formatDate(String(i.issueDate || ""))}>{formatDate(String(i.issueDate || ""))}</td>
                              <td className={workbookDataTdVariable} title={i.templateProfileLabel || undefined}>
                                {i.templateProfileLabel ? (
                                  <span className="inline-flex min-w-0 max-w-full align-middle">
                                    <ProfileBadge label={i.templateProfileLabel} colorKey={colorKeyForTemplateProfile(profileOptions, i.templateProfileId)} />
                                  </span>
                                ) : "—"}
                              </td>
                              <td className={`${workbookDataTdTight} text-right tabular-nums`}>{formatCurrency(Number(i.total || 0))}</td>
                              <td className="p-2 text-center align-middle">
                                <InvoicePreviewListTrigger recordId={i.recordId} label={i.number || i.recordId} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </section>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        ) : null}

        {showExpenses ? (
        <Card className="min-w-0 overflow-hidden rounded-2xl border-emerald-200/80 bg-emerald-50/45 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <CardHeader>
            <CardTitle>Gastos ({filteredExpenses.length})</CardTitle>
            <CardDescription>Vista estilo hoja Excel, agrupada por meses como en Gastos.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 overflow-x-auto p-0 sm:p-6">
            {expensesQuery.isLoading ? (
              <p className="p-4 text-informative">Cargando…</p>
            ) : expensesQuery.isError ? (
              <p className="p-4 text-sm text-red-600">{(expensesQuery.error as Error)?.message || "Error al cargar gastos."}</p>
            ) : filteredExpenses.length === 0 ? (
              <p className="p-4 text-informative">Sin datos</p>
            ) : (
              <div className="grid gap-5">
                {expenseMonthGroups.map((group) => (
                  <section key={group.monthKey} className="grid gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200/80 bg-white/85 px-4 py-3 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/30">
                      <span className="font-medium text-foreground">{group.title}</span>
                      <span className="tabular-nums text-informative">{group.items.length} gasto(s) · {formatCurrency(group.monthTotal)}</span>
                    </div>
                    <table className={cn(workbookDataTableBase, "min-w-[26rem]") }>
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-informative">
                          <th className="p-2 font-medium">Trim.</th>
                          <th className="p-2 font-medium">Proveedor</th>
                          <th className="p-2 font-medium">Concepto</th>
                          <th className="p-2 font-medium">Fecha</th>
                          <th className="p-2 font-medium">Emisor</th>
                          <th className="p-2 text-right font-medium">Total</th>
                          <th className="w-10 whitespace-nowrap p-2 text-center font-medium" title="Vista del gasto">Ver</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((e) => {
                          const rid = String(e.recordId || e.id || "").trim() || `${e.issueDate}-${e.vendor}-${e.total}`;
                          const qNorm = resolveCalendarQuarter(String(e.quarter || ""), String(e.issueDate || ""));
                          const vendor = e.vendor || "—";
                          const concept = String(e.expenseConcept || e.description || "").trim() || "—";
                          return (
                            <tr key={rid} className={`border-b border-border/60 ${workbookQuarterRowToneClass(qNorm)}`}>
                              <td className="p-2 align-middle">
                                <QuarterBadge quarter={String(e.quarter || "")} issueDate={String(e.issueDate || "")} />
                              </td>
                              <td className={workbookDataTdVariable} title={vendor !== "—" ? vendor : undefined}>{vendor}</td>
                              <td className={workbookDataTdVariable} title={concept !== "—" ? concept : undefined}>{concept}</td>
                              <td className={workbookDataTdTight} title={formatDate(String(e.issueDate || ""))}>{formatDate(String(e.issueDate || ""))}</td>
                              <td className={workbookDataTdVariable} title={e.templateProfileLabel || undefined}>
                                {e.templateProfileLabel ? (
                                  <span className="inline-flex min-w-0 max-w-full align-middle">
                                    <ProfileBadge label={e.templateProfileLabel} colorKey={colorKeyForTemplateProfile(profileOptions, e.templateProfileId)} />
                                  </span>
                                ) : "—"}
                              </td>
                              <td className={`${workbookDataTdTight} text-right tabular-nums`}>{formatCurrency(Number(e.total || 0))}</td>
                              <td className="p-2 text-center align-middle">
                                <ExpensePreviewListTrigger expense={e} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </section>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        ) : null}
      </div>
    </main>
  );
}
