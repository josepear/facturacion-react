import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdvisorSummaryDialog } from "@/features/asesor/components/AdvisorSummaryDialog";
import { ADVISOR_QUARTERS } from "@/features/data/lib/advisorShareFilters";
import { useSessionQuery } from "@/features/shared/hooks/useSessionQuery";
import { isTemplateProfileInScope, resolveSessionScope } from "@/features/shared/lib/sessionScope";
import { fetchRuntimeConfig } from "@/infrastructure/api/documentsApi";
import { fetchExpenses } from "@/infrastructure/api/expensesApi";
import { fetchHistoryInvoices } from "@/infrastructure/api/historyApi";

export function AsesorResumenPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterYear, setFilterYear] = useState("");
  const [filterQuarters, setFilterQuarters] = useState<string[]>([]);
  const [filterProfile, setFilterProfile] = useState("");
  const [filterScope, setFilterScope] = useState<"both" | "invoices" | "expenses">("both");
  const sessionQuery = useSessionQuery();

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

  const profileOptions = useMemo(() => configQuery.data?.templateProfiles ?? [], [configQuery.data?.templateProfiles]);

  const sessionScope = useMemo(
    () => resolveSessionScope(sessionQuery.data, profileOptions),
    [sessionQuery.data, profileOptions],
  );

  const scopedProfileOptions = useMemo(
    () => profileOptions.filter((p) => isTemplateProfileInScope(p.id, sessionScope)),
    [profileOptions, sessionScope],
  );

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

  useEffect(() => {
    if (filterProfile) {
      return;
    }
    if (!sessionScope.hasEmitterScope) {
      return;
    }
    const first = String(scopedProfileOptions[0]?.id || "").trim();
    if (first) {
      setFilterProfile(first);
    }
  }, [filterProfile, scopedProfileOptions, sessionScope.hasEmitterScope]);

  const toggleQuarterFilter = (quarter: string) => {
    setFilterQuarters((prev) =>
      prev.includes(quarter) ? prev.filter((value) => value !== quarter) : [...prev, quarter].sort(),
    );
  };

  const hasActiveFilters = Boolean(filterYear || filterQuarters.length || filterProfile || filterScope !== "both");

  return (
    <>
      <Card className="border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/20">
        <CardHeader>
          <CardTitle>Resumen para asesoría</CardTitle>
          <CardDescription>
            Previsualiza facturas y gastos con los mismos criterios que la hoja de control, genera un enlace de solo
            lectura y compártelo con quien declare o revise (sin acceso al resto de la aplicación).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 pt-1">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_minmax(0,1fr)] sm:items-end">
            <label className="grid min-w-0 gap-1 text-sm">
              <span className="font-medium text-foreground">Ejercicio</span>
              <select
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
            <label className="grid min-w-0 gap-1 text-sm">
              <span className="font-medium text-foreground">Emisor</span>
              <select
                className="flex h-10 min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:min-h-10"
                value={filterProfile}
                onChange={(e) => setFilterProfile(e.target.value)}
                disabled={!sessionScope.hasEmitterScope}
              >
                {sessionScope.isAdmin ? <option value="">Todos los emisores</option> : null}
                {(sessionScope.isAdmin ? profileOptions : scopedProfileOptions).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label || p.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1 text-sm">
              <span className="font-medium text-foreground">Mostrar</span>
              <select
                className="flex h-10 min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:min-h-10"
                value={filterScope}
                onChange={(e) => setFilterScope(e.target.value as "both" | "invoices" | "expenses")}
              >
                <option value="both">Todo</option>
                <option value="invoices">Documentos</option>
                <option value="expenses">Solo gastos</option>
              </select>
            </label>
          </div>
          <div className="grid gap-3 rounded-md border border-border/60 bg-background/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium text-foreground">Trimestres</span>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setFilterQuarters([...ADVISOR_QUARTERS])}>
                  Todos
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setFilterQuarters([])}>
                  Ninguno
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {ADVISOR_QUARTERS.map((quarter) => {
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
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={!sessionScope.hasEmitterScope} onClick={() => setDialogOpen(true)}>
              Abrir resumen asesor
            </Button>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFilterYear("");
                  setFilterQuarters([]);
                  setFilterProfile("");
                  setFilterScope("both");
                }}
              >
                Limpiar filtros
              </Button>
            ) : (
              <span className="text-sm text-muted-foreground">Sin filtros activos</span>
            )}
          </div>
          {!sessionScope.hasEmitterScope ? (
            <p className="text-sm text-informative">Sin emisores asignados en tu sesión no puedes generar el resumen.</p>
          ) : (
            <p className="text-sm text-informative">
              El enlace abre una vista pública con el aspecto de la app React y el diálogo heredará estos filtros al abrirse.
            </p>
          )}
        </CardContent>
      </Card>

      <AdvisorSummaryDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        historyItems={historyItems}
        expenseItems={expenseItems}
        profileOptions={sessionScope.isAdmin ? profileOptions : scopedProfileOptions}
        includeAllProfilesOption={sessionScope.isAdmin}
        pageFilterYear={filterYear}
        pageFilterProfile={filterProfile}
        pageFilterQuarters={filterQuarters}
        pageFilterScope={filterScope}
        availableYears={availableYears}
      />
    </>
  );
}
