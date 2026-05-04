import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProfileBadge } from "@/components/ui/ProfileBadge";
import type { ExpenseRecord } from "@/domain/expenses/types";
import {
  accountingStatusLabel,
  ADVISOR_PROFILE_ALL,
  buildShareReportExpenseListFromParams,
  buildShareReportInvoiceListFromParams,
  collectShareReportAlerts,
  formatAdvisorCompactDate,
  formatAdvisorSectionTitle,
  formatQuarterShortLabel,
  normAdvisorStatus,
  type AdvisorInvoiceStatusFilter,
  type AdvisorShareScope,
  sortExpenseRowsForAdvisor,
  sortInvoiceRowsForAdvisor,
} from "@/features/data/lib/advisorShareFilters";
import type { HistoryInvoiceItem } from "@/infrastructure/api/historyApi";
import { postShareReport } from "@/infrastructure/api/exportReportsApi";
import { getErrorMessageFromUnknown } from "@/infrastructure/api/httpClient";
import { formatCurrency } from "@/lib/utils";

type ProfileOption = { id: string; label?: string; colorKey?: string };

type Props = {
  open: boolean;
  onClose: () => void;
  historyItems: HistoryInvoiceItem[];
  expenseItems: ExpenseRecord[];
  profileOptions: ProfileOption[];
  /** Año activo en la página Datos (`""` = todos). */
  pageFilterYear: string;
  /** Emisor activo en la página Datos (`""` = todos). */
  pageFilterProfile: string;
  availableYears: string[];
};

function scopeLabel(scope: AdvisorShareScope): string {
  if (scope === "invoices") {
    return "Solo facturación";
  }
  if (scope === "expenses") {
    return "Solo gastos";
  }
  return "Facturación y gastos";
}

function profileLabelFromId(profileId: string, options: ProfileOption[]): string {
  if (profileId === ADVISOR_PROFILE_ALL) {
    return "Todos los emisores";
  }
  const hit = options.find((p) => p.id === profileId);
  return hit?.label || hit?.id || "Perfil";
}

export function AdvisorSummaryDialog({
  open,
  onClose,
  historyItems,
  expenseItems,
  profileOptions,
  pageFilterYear,
  pageFilterProfile,
  availableYears,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogWasOpenRef = useRef(false);

  const [year, setYear] = useState("all");
  const [quarter, setQuarter] = useState("all");
  const [profileId, setProfileId] = useState(ADVISOR_PROFILE_ALL);
  const [scope, setScope] = useState<AdvisorShareScope>("both");
  const [invoiceStatus, setInvoiceStatus] = useState<AdvisorInvoiceStatusFilter>("all");

  const [shareUrl, setShareUrl] = useState("");
  const [urlStatus, setUrlStatus] = useState("");

  const spec = useMemo(
    () => ({
      year,
      quarter,
      profile: profileId,
      scope,
      invoiceStatus,
      client: "all" as const,
      expenseDeductible: "all" as const,
      vendor: "all" as const,
      category: "all" as const,
    }),
    [year, quarter, profileId, scope, invoiceStatus],
  );

  const { invoicePreview, expensePreview, wideInvoices, wideExpenses, periodLine, invTitle, expTitle, margin } =
    useMemo(() => {
      let inv = buildShareReportInvoiceListFromParams(historyItems, spec);
      let exp = buildShareReportExpenseListFromParams(expenseItems, spec);
      const sc = spec.scope || "both";
      if (sc === "invoices") {
        exp = [];
      } else if (sc === "expenses") {
        inv = [];
      }

      const sortedInv = sortInvoiceRowsForAdvisor(inv);
      const sortedExp = sortExpenseRowsForAdvisor(exp);

      const wideInvoicesInner = buildShareReportInvoiceListFromParams(historyItems, {
        ...spec,
        client: "all",
        invoiceStatus: "all",
      });
      const wideExpensesInner = buildShareReportExpenseListFromParams(expenseItems, {
        ...spec,
        vendor: "all",
        category: "all",
        expenseDeductible: "all",
      });

      const yearLabel = spec.year === "all" ? "Todos los ejercicios" : spec.year;
      const quarterLabel = spec.quarter === "all" ? "Todo el año" : formatQuarterShortLabel(spec.quarter) || spec.quarter;
      const profileLabel = profileLabelFromId(spec.profile, profileOptions);
      const periodLineInner = `${yearLabel} · ${quarterLabel} · ${profileLabel} · ${scopeLabel(sc)} · ${sortedInv.length} facturas · ${sortedExp.length} gastos`;

      const invTitleInner = formatAdvisorSectionTitle("FACTURACIÓN", spec.year, spec.quarter);
      const expTitleInner = formatAdvisorSectionTitle("GASTOS", spec.year, spec.quarter);

      const showMargin = sc === "both" && (sortedInv.length > 0 || sortedExp.length > 0);
      let marginInner: number | null = null;
      if (showMargin) {
        const totalVigente = sortedInv
          .filter((item) => normAdvisorStatus(item.status) !== "CANCELADA")
          .reduce((acc, item) => acc + (Number(item.total) || 0), 0);
        const expenseTotal = sortedExp.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
        marginInner = totalVigente - expenseTotal;
      }

      return {
        invoicePreview: sortedInv,
        expensePreview: sortedExp,
        wideInvoices: wideInvoicesInner,
        wideExpenses: wideExpensesInner,
        periodLine: periodLineInner,
        invTitle: invTitleInner,
        expTitle: expTitleInner,
        margin: marginInner,
      };
    }, [expenseItems, historyItems, profileOptions, spec]);

  const alerts = useMemo(() => collectShareReportAlerts(wideInvoices, wideExpenses), [wideExpenses, wideInvoices]);

  const shareMutation = useMutation({
    mutationFn: () => {
      if (!profileId || profileId === ADVISOR_PROFILE_ALL) {
        throw new Error("Elige un emisor concreto (no «Todos los emisores») para generar el enlace.");
      }
      return postShareReport({
        templateProfileId: profileId,
        year: spec.year,
        quarter: spec.quarter,
        scope: spec.scope,
        invoiceStatus: spec.invoiceStatus,
        client: spec.client,
        expenseDeductible: spec.expenseDeductible,
        vendor: spec.vendor,
        category: spec.category,
      });
    },
    onSuccess: (data) => {
      const url = String(data.shareViewUrl || "").trim();
      setShareUrl(url);
      const createdAt = String((data as { createdAt?: string }).createdAt || "").trim();
      const createdAtDate = createdAt ? new Date(createdAt) : null;
      const createdAtLabel = createdAtDate
        ? ` · Generado ${createdAtDate.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}`
        : "";
      setUrlStatus(
        url
          ? `Enlace listo${createdAtLabel}. Usa «Copiar enlace» o selecciona el texto.`
          : "Enlace generado.",
      );
    },
    onError: (error) => {
      setShareUrl("");
      setUrlStatus(getErrorMessageFromUnknown(error));
    },
  });

  const resetWorkbenchFilters = () => {
    const preferredYear = String(new Date().getFullYear());
    const nextYear =
      availableYears.includes(preferredYear) ? preferredYear : (availableYears[0] || "all");
    const allowedYear = nextYear && (nextYear === "all" || availableYears.includes(nextYear)) ? nextYear : "all";
    setYear(allowedYear);
    setQuarter("all");
    setProfileId(ADVISOR_PROFILE_ALL);
    setScope("both");
    setInvoiceStatus("all");
    setShareUrl("");
    setUrlStatus("");
  };

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) {
      return;
    }
    if (!open) {
      dialogWasOpenRef.current = false;
      if (typeof el.close === "function") {
        el.close();
      }
      return;
    }

    if (!dialogWasOpenRef.current) {
      dialogWasOpenRef.current = true;
      const pageY = String(pageFilterYear || "").trim();
      const preferred = String(new Date().getFullYear());
      let initialYear = "all";
      if (pageY && availableYears.includes(pageY)) {
        initialYear = pageY;
      } else if (availableYears.includes(preferred)) {
        initialYear = preferred;
      } else if (availableYears.length > 0) {
        initialYear = availableYears[0] ?? "all";
      }
      setYear(initialYear);
      const pid = String(pageFilterProfile || "").trim();
      setProfileId(pid && profileOptions.some((p) => p.id === pid) ? pid : ADVISOR_PROFILE_ALL);
      setQuarter("all");
      setScope("both");
      setInvoiceStatus("all");
      setShareUrl("");
      setUrlStatus("");
      if (typeof el.showModal === "function") {
        el.showModal();
      }
    }
  }, [open, pageFilterYear, pageFilterProfile, availableYears, profileOptions]);

  const handleDialogClose = () => {
    setShareUrl("");
    setUrlStatus("");
    onClose();
  };

  const copyShareUrl = async () => {
    const url = String(shareUrl || "").trim();
    if (!url) {
      setUrlStatus("Primero pulsa «Generar enlace».");
      return;
    }
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
      setUrlStatus("Enlace copiado al portapapeles.");
    } catch {
      setUrlStatus("No pude copiar solo; selecciona el texto del enlace y cópialo a mano.");
    }
  };

  const handleGenerate = () => {
    setUrlStatus("");
    setShareUrl("");
    if (!profileId || profileId === ADVISOR_PROFILE_ALL) {
      setUrlStatus("Elige un emisor concreto (no «Todos los emisores») para generar el enlace.");
      return;
    }
    setUrlStatus("Generando enlace…");
    shareMutation.mutate();
  };

  return (
    <dialog
      ref={dialogRef}
      className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-0 shadow-lg backdrop:bg-black/50"
      aria-labelledby="advisor-summary-dialog-title"
      onClose={handleDialogClose}
    >
      <div className="flex max-h-[min(92vh,52rem)] flex-col overflow-hidden">
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-informative">Solo lectura para terceros</p>
            <h2 id="advisor-summary-dialog-title" className="text-lg font-semibold tracking-tight">
              Resumen asesor
            </h2>
            <p className="text-sm text-informative">
              Elige emisor, ejercicio, trimestre y alcance. El listado replica la hoja de control (sin editar ni borrar).
              Genera el enlace y envíaselo; quien lo abre ve exactamente estas filas, sin límite de cantidad.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Cerrar" onClick={() => {
              const d = dialogRef.current;
              if (d && typeof d.close === "function") {
                d.close();
              }
            }}>
            ×
          </Button>
        </header>

        <div className="grid flex-1 gap-4 overflow-auto px-5 py-4 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-foreground">Ejercicio</span>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                aria-label="Ejercicio resumen asesor"
              >
                <option value="all">Todos</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-foreground">Trimestre</span>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                aria-label="Trimestre resumen asesor"
              >
                <option value="all">Todos</option>
                <option value="T1">T1</option>
                <option value="T2">T2</option>
                <option value="T3">T3</option>
                <option value="T4">T4</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-foreground">Usuario o emisor</span>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                aria-label="Emisor resumen asesor"
              >
                <option value={ADVISOR_PROFILE_ALL}>Todos los emisores</option>
                {profileOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label || p.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-foreground">Qué incluir en el enlace</span>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={scope}
                onChange={(e) => setScope(e.target.value as AdvisorShareScope)}
                aria-label="Alcance facturación o gastos"
              >
                <option value="both">Facturación y gastos</option>
                <option value="invoices">Solo facturación</option>
                <option value="expenses">Solo gastos</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2 lg:col-span-1">
              <span className="font-medium text-foreground">Estado de factura</span>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={invoiceStatus}
                onChange={(e) => setInvoiceStatus(e.target.value as AdvisorInvoiceStatusFilter)}
                aria-label="Estado factura resumen asesor"
              >
                <option value="all">Todas</option>
                <option value="COBRADA">Cobrada</option>
                <option value="ENVIADA">Enviada (pendiente de cobro)</option>
                <option value="CANCELADA">Cancelada</option>
                <option value="pending_any">No cobrada (incluye enviada y cancelada)</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={resetWorkbenchFilters}>
              Restablecer filtros
            </Button>
          </div>

          <p className="text-sm text-informative" role="status">
            {periodLine}
          </p>

          {scope !== "expenses" ? (
            <section className="grid gap-2">
              <h3 className="text-sm font-semibold">{invTitle}</h3>
              <div className="max-h-56 overflow-auto rounded-md border border-border">
                {invoicePreview.length === 0 ? (
                  <p className="p-3 text-sm text-informative">Sin facturas en este criterio.</p>
                ) : (
                  <table className="w-full min-w-[20rem] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-informative">
                        <th className="p-2 font-medium">Número</th>
                        <th className="p-2 font-medium">Cliente</th>
                        <th className="p-2 font-medium">Fecha</th>
                        <th className="p-2 font-medium">Estado</th>
                        <th className="p-2 font-medium">Emisor</th>
                        <th className="p-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoicePreview.map((i) => (
                        <tr key={i.recordId} className="border-b border-border/60">
                          <td className="p-2 whitespace-nowrap">{i.number || "—"}</td>
                          <td className="p-2">{i.clientName || "—"}</td>
                          <td className="p-2 whitespace-nowrap">{formatAdvisorCompactDate(String(i.issueDate || ""))}</td>
                          <td className="p-2">{accountingStatusLabel(i.status)}</td>
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
              </div>
            </section>
          ) : null}

          {scope !== "invoices" ? (
            <section className="grid gap-2">
              <h3 className="text-sm font-semibold">{expTitle}</h3>
              <div className="max-h-56 overflow-auto rounded-md border border-border">
                {expensePreview.length === 0 ? (
                  <p className="p-3 text-sm text-informative">Sin gastos en este criterio.</p>
                ) : (
                  <table className="w-full min-w-[20rem] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-informative">
                        <th className="p-2 font-medium">Proveedor</th>
                        <th className="p-2 font-medium">Concepto</th>
                        <th className="p-2 font-medium">Fecha</th>
                        <th className="p-2 font-medium">Emisor</th>
                        <th className="p-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expensePreview.map((e) => {
                        const rid = String(e.recordId || e.id || "").trim() || `${e.issueDate}-${e.vendor}-${e.total}`;
                        return (
                          <tr key={rid} className="border-b border-border/60">
                            <td className="p-2">{e.vendor || "—"}</td>
                            <td className="p-2">{String(e.expenseConcept || e.description || "").trim() || "—"}</td>
                            <td className="p-2 whitespace-nowrap">{formatAdvisorCompactDate(String(e.issueDate || ""))}</td>
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
              </div>
            </section>
          ) : null}

          {margin !== null ? (
            <section className="rounded-md border border-border bg-muted/20 p-3" aria-live="polite">
              <p className="text-xs font-medium text-informative">Resultado aproximado (ingresos vigentes − gastos del listado)</p>
              <p className="text-lg font-semibold tabular-nums">{formatCurrency(margin)}</p>
            </section>
          ) : null}

          <div className="grid gap-2" aria-live="polite">
            {alerts.length ? (
              alerts.map((a) => (
                <p key={a.text} className="rounded-md border border-border bg-background px-3 py-2 text-sm text-informative">
                  {a.text}
                </p>
              ))
            ) : (
              <p className="rounded-md border border-border bg-background px-3 py-2 text-sm text-informative">
                No detectamos incidencias obvias en los datos de este periodo.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-center">
            <Button type="button" disabled={shareMutation.isPending} onClick={handleGenerate}>
              {shareMutation.isPending ? "Generando enlace…" : "Generar enlace"}
            </Button>
            <Input readOnly className="min-w-0 sm:min-w-[12rem] sm:flex-1" value={shareUrl} placeholder="URL pública (solo lectura)" aria-label="URL de vista compartida" />
            <Button type="button" variant="outline" onClick={() => void copyShareUrl()}>
              Copiar enlace
            </Button>
          </div>
          {urlStatus ? <p className="text-sm text-informative">{urlStatus}</p> : null}
        </div>
      </div>
    </dialog>
  );
}
