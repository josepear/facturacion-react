import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdvisorSummaryDialog } from "@/features/asesor/components/AdvisorSummaryDialog";
import { useSessionQuery } from "@/features/shared/hooks/useSessionQuery";
import { isTemplateProfileInScope, resolveSessionScope } from "@/features/shared/lib/sessionScope";
import { fetchRuntimeConfig } from "@/infrastructure/api/documentsApi";
import { fetchExpenses } from "@/infrastructure/api/expensesApi";
import { fetchHistoryInvoices } from "@/infrastructure/api/historyApi";

export function AsesorResumenPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
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

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Resumen para asesoría</CardTitle>
          <CardDescription>
            Previsualiza facturas y gastos con los mismos criterios que la hoja de control, genera un enlace de solo
            lectura y compártelo con quien declare o revise (sin acceso al resto de la aplicación).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button type="button" disabled={!sessionScope.hasEmitterScope} onClick={() => setDialogOpen(true)}>
            Abrir resumen asesor
          </Button>
          {!sessionScope.hasEmitterScope ? (
            <p className="text-sm text-informative">Sin emisores asignados en tu sesión no puedes generar el resumen.</p>
          ) : (
            <p className="text-sm text-informative">
              El enlace abre una vista pública con el aspecto de la app React. Necesitas elegir un emisor concreto antes
              de generar el enlace.
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
        pageFilterYear=""
        pageFilterProfile=""
        availableYears={availableYears}
      />
    </>
  );
}
