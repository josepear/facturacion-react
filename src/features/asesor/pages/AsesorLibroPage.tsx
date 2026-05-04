import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchRuntimeConfig } from "@/infrastructure/api/documentsApi";
import { downloadControlWorkbookExport } from "@/infrastructure/api/exportReportsApi";
import { fetchExpenses } from "@/infrastructure/api/expensesApi";
import { fetchHistoryInvoices } from "@/infrastructure/api/historyApi";
import { getErrorMessageFromUnknown } from "@/infrastructure/api/httpClient";

export function AsesorLibroPage() {
  const [workbookYear, setWorkbookYear] = useState("all");
  const [workbookProfile, setWorkbookProfile] = useState("");

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

  const availableYears = useMemo(() => {
    const historyItems = historyQuery.data ?? [];
    const expenseItems = expensesQuery.data?.items ?? [];
    const invoiceYears = historyItems.map((i) => String(i.issueDate || "").slice(0, 4));
    const expenseYears = expenseItems.map((e) => String(e.issueDate || "").slice(0, 4));
    return Array.from(new Set([...invoiceYears, ...expenseYears].filter(Boolean))).sort().reverse();
  }, [historyQuery.data, expensesQuery.data?.items]);

  const workbookMutation = useMutation({
    mutationFn: async () => {
      const yearToken = String(workbookYear || "").trim() || "all";
      const rawProfile = String(workbookProfile || "").trim();
      let invoiceProfile = "__all__";
      let expenseProfile = "__all__";
      if (rawProfile === "__unassigned__") {
        invoiceProfile = "__unassigned__";
        expenseProfile = "__unassigned__";
      } else if (rawProfile) {
        invoiceProfile = rawProfile;
        expenseProfile = rawProfile;
      }
      await downloadControlWorkbookExport({
        invoiceYear: yearToken,
        expenseYear: yearToken,
        invoiceQuarter: "all",
        expenseQuarter: "all",
        invoiceStatus: "all",
        expenseDeductible: "all",
        invoiceProfile,
        expenseProfile,
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Libro de control (Excel)</CardTitle>
        <CardDescription>
          Descarga un Excel con hojas de facturas y gastos según ejercicio y emisor. Equivale al export filtrado del
          legacy.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-foreground">Ejercicio</span>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={workbookYear}
              onChange={(e) => setWorkbookYear(e.target.value)}
              aria-label="Ejercicio para libro de control"
            >
              <option value="all">Todos los ejercicios</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-foreground">Emisor</span>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={workbookProfile}
              onChange={(e) => setWorkbookProfile(e.target.value)}
              aria-label="Emisor para libro de control"
            >
              <option value="">Todos los emisores</option>
              <option value="__unassigned__">Sin emisor asignado</option>
              {profileOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label || p.id}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Button type="button" variant="outline" disabled={workbookMutation.isPending} onClick={() => workbookMutation.mutate()}>
          {workbookMutation.isPending ? "Generando…" : "Descargar libro de control"}
        </Button>
        {workbookMutation.isError ? (
          <p className="text-sm text-red-600">{getErrorMessageFromUnknown(workbookMutation.error)}</p>
        ) : null}
        {workbookMutation.isSuccess ? (
          <p className="text-sm text-emerald-600">Descarga iniciada. Revisa la carpeta de descargas del navegador.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
