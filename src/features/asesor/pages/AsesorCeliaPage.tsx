import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExpenseRecord } from "@/domain/expenses/types";
import { formatAdvisorCompactDate, sortExpenseWorkbookDefault } from "@/features/data/lib/advisorShareFilters";
import { useSessionQuery } from "@/features/shared/hooks/useSessionQuery";
import { isTemplateProfileInScope, resolveSessionScope } from "@/features/shared/lib/sessionScope";
import { fetchRuntimeConfig } from "@/infrastructure/api/documentsApi";
import { runAccountingExportDownload } from "@/infrastructure/api/exportReportsApi";
import { fetchExpenses } from "@/infrastructure/api/expensesApi";
import { fetchHistoryInvoices } from "@/infrastructure/api/historyApi";
import { getErrorMessageFromUnknown } from "@/infrastructure/api/httpClient";
import { ExpensePreviewListTrigger } from "@/features/shared/components/RecordListPreviewTriggers";
import { workbookDataTableBase, workbookDataTdTight, workbookDataTdVariable } from "@/features/shared/lib/workbookTableText";
import { cn, formatCurrency } from "@/lib/utils";

/** Misma semántica que el bloque legacy «Columnas Excel (por gasto)» en Datos → Celia (public/index.html). */
const CELIA_EXCEL_EXPENSE_FIELD_ROWS: { label: string; detail: string }[] = [
  { label: "Concepto de gasto", detail: "Etiqueta contable; si va vacío puede usarse el concepto interno." },
  { label: "Tipo NIF expedidor", detail: "Opcional (p. ej. código de tipo de identificador)." },
  { label: "Código país expedidor", detail: "Normalmente ES u otro ISO-2." },
  { label: "Identificación expedidor", detail: "CIF / NIF / VAT del proveedor." },
  { label: "Base imponible", detail: "Importe antes de impuestos." },
  { label: "Tipo IVA", detail: "Porcentaje aplicado a la base." },
  { label: "Cuota IVA", detail: "Importe de IVA (coherente con base y tipo)." },
  { label: "Tipo IRPF", detail: "Retención sobre la base, en porcentaje." },
  { label: "Importe IRPF", detail: "Cuota de retención." },
];

function buildGastosWorkbenchSearch(year: string, profile: string): string {
  const p = new URLSearchParams();
  const y = String(year || "").trim();
  if (/^\d{4}$/u.test(y)) {
    p.set("year", y);
  }
  const pid = String(profile || "").trim();
  if (pid === "__unassigned__") {
    p.set("profile", "__unassigned__");
  } else if (pid) {
    p.set("profile", pid);
  }
  const qs = p.toString();
  return qs ? `/gastos?${qs}` : "/gastos";
}

function buildGastosExpenseEditLink(recordId: string, year: string, profile: string): string {
  const p = new URLSearchParams();
  p.set("recordId", String(recordId || "").trim());
  const y = String(year || "").trim();
  if (/^\d{4}$/u.test(y)) {
    p.set("year", y);
  }
  const pid = String(profile || "").trim();
  if (pid === "__unassigned__") {
    p.set("profile", "__unassigned__");
  } else if (pid) {
    p.set("profile", pid);
  }
  return `/gastos?${p.toString()}`;
}

function filterExpensesForCeliaScope(items: ExpenseRecord[], year: string, profile: string): ExpenseRecord[] {
  const y = String(year || "").trim();
  let list = [...items];
  if (/^\d{4}$/u.test(y)) {
    list = list.filter((e) => String(e.issueDate || "").startsWith(y));
  }
  const pid = String(profile || "").trim();
  if (pid === "__unassigned__") {
    list = list.filter((e) => !String(e.templateProfileId || "").trim());
  } else if (pid) {
    list = list.filter((e) => String(e.templateProfileId || "").trim() === pid);
  }
  return sortExpenseWorkbookDefault(list);
}

export function AsesorCeliaPage() {
  const [exportYear, setExportYear] = useState(() => String(new Date().getFullYear()));
  const [exportProfile, setExportProfile] = useState("");

  const sessionQuery = useSessionQuery();

  const configQuery = useQuery({
    queryKey: ["runtime-config"],
    queryFn: fetchRuntimeConfig,
    staleTime: 300_000,
  });

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

  const profileOptions = useMemo(() => configQuery.data?.templateProfiles ?? [], [configQuery.data?.templateProfiles]);

  const sessionScope = useMemo(
    () => resolveSessionScope(sessionQuery.data, profileOptions),
    [sessionQuery.data, profileOptions],
  );

  const scopedProfileOptions = useMemo(
    () => profileOptions.filter((p) => isTemplateProfileInScope(p.id, sessionScope)),
    [profileOptions, sessionScope],
  );

  const isAdmin = sessionScope.isAdmin;

  const historyItemsRaw = historyQuery.data ?? [];
  const expenseItemsRaw = expensesQuery.data?.items ?? [];

  const historyItemsScoped = useMemo(
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

  const expenseItemsScoped = useMemo(
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
    const invoiceYears = historyItemsScoped.map((i) => String(i.issueDate || "").slice(0, 4));
    const expenseYears = expenseItemsScoped.map((e) => String(e.issueDate || "").slice(0, 4));
    return Array.from(new Set([...invoiceYears, ...expenseYears].filter(Boolean))).sort().reverse();
  }, [historyItemsScoped, expenseItemsScoped]);

  useEffect(() => {
    if (isAdmin) {
      return;
    }
    const pid = String(exportProfile || "").trim();
    if (!pid || pid === "__unassigned__" || !isTemplateProfileInScope(pid, sessionScope)) {
      const next = String(scopedProfileOptions[0]?.id || "").trim();
      setExportProfile(next);
    }
  }, [isAdmin, exportProfile, sessionScope, scopedProfileOptions]);

  const accountingExportMutation = useMutation({
    mutationFn: () => {
      const y = String(exportYear || "").trim();
      if (!/^\d{4}$/u.test(y)) {
        throw new Error("Selecciona un ejercicio (AAAA) para exportar el Excel Celia.");
      }
      const pid = String(exportProfile || "").trim();
      return runAccountingExportDownload({
        year: y,
        templateProfileId:
          pid && pid !== "__all__" && pid !== "__unassigned__" ? pid : undefined,
      });
    },
  });

  const celiaScopeExpenses = useMemo(
    () => filterExpensesForCeliaScope(expenseItemsScoped, exportYear, exportProfile),
    [expenseItemsScoped, exportProfile, exportYear],
  );

  const gastosFilteredHref = useMemo(
    () => buildGastosWorkbenchSearch(exportYear, exportProfile),
    [exportProfile, exportYear],
  );

  const exportBlocked =
    !sessionScope.hasEmitterScope ||
    (!isAdmin && !String(exportProfile || "").trim());

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Excel Celia</CardTitle>
          <CardDescription>
            Genera la plantilla de asesoría para el ejercicio y emisor elegidos. La descarga la gestiona el navegador.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!sessionScope.hasEmitterScope ? (
            <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-informative">
              Tu sesión no tiene emisores asignados para exportar aquí. Contacta con un administrador.
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-foreground">Ejercicio (AAAA)</span>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={exportYear}
                onChange={(e) => setExportYear(e.target.value)}
                aria-label="Ejercicio para Excel Celia"
              >
                {availableYears.length ? (
                  availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))
                ) : (
                  <option value={String(new Date().getFullYear())}>{String(new Date().getFullYear())}</option>
                )}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-foreground">Emisor</span>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={exportProfile}
                onChange={(e) => setExportProfile(e.target.value)}
                disabled={!sessionScope.hasEmitterScope}
                aria-label="Emisor para Excel Celia"
              >
                {isAdmin ? (
                  <>
                    <option value="">Todos los emisores</option>
                    <option value="__unassigned__">Sin emisor asignado</option>
                  </>
                ) : null}
                {(isAdmin ? profileOptions : scopedProfileOptions).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label || p.id}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button
            type="button"
            disabled={accountingExportMutation.isPending || exportBlocked}
            onClick={() => accountingExportMutation.mutate()}
          >
            {accountingExportMutation.isPending ? "Generando…" : "Exportar Excel Celia"}
          </Button>
          {accountingExportMutation.isError ? (
            <p className="text-sm text-red-600">{getErrorMessageFromUnknown(accountingExportMutation.error)}</p>
          ) : null}
          {accountingExportMutation.isSuccess ? (
            <p className="text-sm text-emerald-600">Descarga iniciada. Revisa la carpeta de descargas del navegador.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Columnas Excel (por gasto)</CardTitle>
          <CardDescription>
            Van ligadas a cada gasto; en la app React se rellenan y guardan en <strong>Gastos</strong> (bloque de
            importes, NIF y concepto contable). Puedes revisarlos aquí y abrir el gasto concreto antes de exportar.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to={gastosFilteredHref}>Abrir Gastos (mismo ejercicio y emisor)</Link>
            </Button>
          </div>

          <div className="rounded-md border border-border bg-muted/15 p-3">
            <p className="text-xs font-medium text-informative">Campos que alimentan columnas del Excel</p>
            <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
              {CELIA_EXCEL_EXPENSE_FIELD_ROWS.map((row) => (
                <li key={row.label} className="min-w-0">
                  <span className="font-medium text-foreground">{row.label}</span>
                  <span className="text-informative"> — {row.detail}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-medium text-foreground">
              Gastos del criterio ({celiaScopeExpenses.length})
            </p>
            {expensesQuery.isLoading ? (
              <p className="text-sm text-informative">Cargando gastos…</p>
            ) : expensesQuery.isError ? (
              <p className="text-sm text-red-600">{(expensesQuery.error as Error)?.message || "Error al cargar gastos."}</p>
            ) : celiaScopeExpenses.length === 0 ? (
              <p className="text-sm text-informative">No hay gastos en este ejercicio y emisor.</p>
            ) : (
              <div className="max-h-[min(50vh,22rem)] overflow-auto rounded-md border border-border">
                <table className={cn(workbookDataTableBase, "min-w-[20rem]")}>
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-informative">
                      <th className="whitespace-nowrap p-2 font-medium">Fecha</th>
                      <th className="p-2 font-medium">Proveedor</th>
                      <th className="whitespace-nowrap p-2 text-right font-medium">Total</th>
                      <th className="w-10 whitespace-nowrap p-2 text-center font-medium">Ver</th>
                      <th className="whitespace-nowrap p-2 text-right font-medium">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {celiaScopeExpenses.map((e) => {
                      const rid = String(e.recordId || e.id || "").trim();
                      const key = rid || `${e.issueDate}-${e.vendor}-${e.total}`;
                      const editHref = rid ? buildGastosExpenseEditLink(rid, exportYear, exportProfile) : gastosFilteredHref;
                      const vendor = e.vendor || "—";
                      return (
                        <tr key={key} className="border-b border-border/60">
                          <td className={workbookDataTdTight}>{formatAdvisorCompactDate(String(e.issueDate || ""))}</td>
                          <td className={workbookDataTdVariable} title={vendor !== "—" ? vendor : undefined}>
                            {vendor}
                          </td>
                          <td className={`${workbookDataTdTight} text-right tabular-nums`}>{formatCurrency(Number(e.total || 0))}</td>
                          <td className="p-2 text-center align-middle">
                            <ExpensePreviewListTrigger expense={e} />
                          </td>
                          <td className="p-2 text-right">
                            <Link
                              to={editHref}
                              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                            >
                              Editar en Gastos
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
