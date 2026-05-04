import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProfileBadge } from "@/components/ui/ProfileBadge";
import { DataHistoricalImportPanel } from "@/features/data/components/DataHistoricalImportPanel";
import { useSessionQuery } from "@/features/shared/hooks/useSessionQuery";
import { fetchRuntimeConfig } from "@/infrastructure/api/documentsApi";
import { postShareReport, runAccountingExportDownload } from "@/infrastructure/api/exportReportsApi";
import { fetchExpenses } from "@/infrastructure/api/expensesApi";
import { getErrorMessageFromUnknown } from "@/infrastructure/api/httpClient";
import { fetchHistoryInvoices } from "@/infrastructure/api/historyApi";
import { formatCurrency } from "@/lib/utils";

function formatDate(value: string): string {
  const safe = String(value || "").trim();
  return safe || "-";
}

export function DataPage() {
  const [filterYear, setFilterYear] = useState("");
  const [filterProfile, setFilterProfile] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [shareMessage, setShareMessage] = useState<{ text: string; tone: "neutral" | "success" | "error" } | null>(null);
  const [shareProfileId, setShareProfileId] = useState("");

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

  useEffect(() => {
    if (filterProfile) {
      setShareProfileId(filterProfile);
    }
  }, [filterProfile]);

  const shareReportMutation = useMutation({
    mutationFn: () => {
      const pid = String(shareProfileId || "").trim();
      if (!pid) {
        throw new Error("Elige un perfil de plantilla para el enlace.");
      }
      return postShareReport({
        templateProfileId: pid,
        year: filterYear || "all",
        quarter: "all",
        scope: "both",
        invoiceStatus: "all",
        client: "all",
        expenseDeductible: "all",
        vendor: "all",
        category: "all",
      });
    },
    onSuccess: (data) => {
      const url = String(data.shareViewUrl || "").trim();
      setShareUrl(url);
      setShareMessage(
        url ? { text: "Enlace generado. Puedes copiarlo o abrirlo.", tone: "success" } : { text: "Respuesta sin URL.", tone: "error" },
      );
    },
    onError: (error) => {
      setShareUrl("");
      setShareMessage({ text: getErrorMessageFromUnknown(error), tone: "error" });
    },
  });

  const accountingExportMutation = useMutation({
    mutationFn: () => {
      const y = String(filterYear || "").trim();
      if (!/^\d{4}$/u.test(y)) {
        throw new Error("Selecciona un ejercicio (AAAA) para exportar el Excel Celia.");
      }
      const pid = String(filterProfile || "").trim();
      return runAccountingExportDownload({
        year: y,
        templateProfileId: pid || undefined,
      });
    },
  });

  const copyShareUrl = async () => {
    const url = String(shareUrl || "").trim();
    if (!url) {
      return;
    }
    setShareMessage(null);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) {
          throw new Error("copy");
        }
      }
      setShareMessage({ text: "Copiado al portapapeles.", tone: "success" });
    } catch {
      setShareMessage({ text: "No se pudo copiar.", tone: "error" });
    }
  };

  const hasActiveFilters = Boolean(filterYear || filterProfile);

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-6 p-4">
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
              Perfil
            </label>
            <select
              id="data-filter-profile"
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={filterProfile}
              onChange={(e) => setFilterProfile(e.target.value)}
            >
              <option value="">Todos los perfiles</option>
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
        <>
          <Card>
            <CardContent className="grid gap-4 pt-6">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={accountingExportMutation.isPending}
                  onClick={() => accountingExportMutation.mutate()}
                >
                  {accountingExportMutation.isPending ? "Exportando…" : "Exportar Excel Celia"}
                </Button>
              </div>
              {accountingExportMutation.isError ? (
                <p className="text-sm text-red-600">{getErrorMessageFromUnknown(accountingExportMutation.error)}</p>
              ) : null}
              <div className="grid gap-2 rounded-md border p-3">
                <p className="text-informative font-medium">Vista compartida (solo lectura)</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={shareProfileId}
                    onChange={(e) => setShareProfileId(e.target.value)}
                    aria-label="Perfil para enlace compartido"
                  >
                    <option value="">Elige perfil…</option>
                    {profileOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label || p.id}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={shareReportMutation.isPending || !profileOptions.length}
                    onClick={() => shareReportMutation.mutate()}
                  >
                    {shareReportMutation.isPending ? "Generando…" : "Generar enlace compartido"}
                  </Button>
                </div>
                {shareUrl ? (
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <Input readOnly value={shareUrl} aria-label="URL de vista compartida" />
                    <Button type="button" variant="outline" onClick={() => void copyShareUrl()}>
                      Copiar
                    </Button>
                  </div>
                ) : null}
                {shareMessage ? (
                  <p
                    className={
                      shareMessage.tone === "error"
                        ? "text-xs text-red-600"
                        : shareMessage.tone === "success"
                          ? "text-xs text-emerald-600"
                          : "text-informative"
                    }
                  >
                    {shareMessage.text}
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
          <DataHistoricalImportPanel
            templateProfiles={profileOptions.map((p) => ({ id: p.id, label: p.label ?? undefined }))}
          />
        </>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
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
              <table className="w-full min-w-[20rem] text-sm">
                <thead>
                  <tr className="border-b text-left text-informative">
                    <th className="p-2 font-medium">Número</th>
                    <th className="p-2 font-medium">Cliente</th>
                    <th className="p-2 font-medium">Fecha</th>
                    <th className="p-2 font-medium">Perfil</th>
                    <th className="p-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((i) => (
                    <tr key={i.recordId} className="border-b border-border/60">
                      <td className="p-2">{i.number || "—"}</td>
                      <td className="p-2">{i.clientName || "—"}</td>
                      <td className="p-2 whitespace-nowrap">{formatDate(i.issueDate)}</td>
                      <td className="p-2">
                        {i.templateProfileLabel ? (
                          <ProfileBadge
                            label={i.templateProfileLabel}
                            colorKey={profileOptions.find((p) => p.id === i.templateProfileId)?.colorKey}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-2 text-right tabular-nums">{formatCurrency(Number(i.total || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
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
              <table className="w-full min-w-[20rem] text-sm">
                <thead>
                  <tr className="border-b text-left text-informative">
                    <th className="p-2 font-medium">Proveedor</th>
                    <th className="p-2 font-medium">Concepto</th>
                    <th className="p-2 font-medium">Fecha</th>
                    <th className="p-2 font-medium">Perfil</th>
                    <th className="p-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((e) => {
                    const rid = String(e.recordId || e.id || "").trim() || `${e.issueDate}-${e.vendor}-${e.total}`;
                    return (
                      <tr key={rid} className="border-b border-border/60">
                        <td className="p-2">{e.vendor || "—"}</td>
                        <td className="p-2">{String(e.expenseConcept || e.description || "").trim() || "—"}</td>
                        <td className="p-2 whitespace-nowrap">{formatDate(String(e.issueDate || ""))}</td>
                        <td className="p-2">
                          {e.templateProfileLabel ? (
                            <ProfileBadge
                              label={e.templateProfileLabel}
                              colorKey={profileOptions.find((p) => p.id === e.templateProfileId)?.colorKey}
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-2 text-right tabular-nums">{formatCurrency(Number(e.total || 0))}</td>
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
