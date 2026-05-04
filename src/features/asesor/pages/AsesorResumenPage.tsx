import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdvisorSummaryDialog } from "@/features/asesor/components/AdvisorSummaryDialog";
import { fetchRuntimeConfig } from "@/infrastructure/api/documentsApi";
import { fetchExpenses } from "@/infrastructure/api/expensesApi";
import { fetchHistoryInvoices } from "@/infrastructure/api/historyApi";

export function AsesorResumenPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

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
  const historyItems = historyQuery.data ?? [];
  const expenseItems = expensesQuery.data?.items ?? [];

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
          <Button type="button" onClick={() => setDialogOpen(true)}>
            Abrir resumen asesor
          </Button>
          <p className="text-sm text-informative">
            El enlace abre una vista pública con el aspecto de la app React. Necesitas elegir un emisor concreto antes
            de generar el enlace.
          </p>
        </CardContent>
      </Card>

      <AdvisorSummaryDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        historyItems={historyItems}
        expenseItems={expenseItems}
        profileOptions={profileOptions}
        pageFilterYear=""
        pageFilterProfile=""
        availableYears={availableYears}
      />
    </>
  );
}
