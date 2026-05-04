import { Calendar } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker, useSearchParams } from "react-router-dom";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProfileBadge } from "@/components/ui/ProfileBadge";
import { FacturarLegacyHtmlPane } from "@/features/invoices/components/FacturarLegacyHtmlPane";
import { FacturarSaveSummary } from "@/features/invoices/components/FacturarSaveSummary";
import { InvoiceItemsTable } from "@/features/invoices/components/InvoiceItemsTable";
import { InvoiceTotalsPanel } from "@/features/invoices/components/InvoiceTotalsPanel";
import { WorkflowModule } from "@/features/invoices/components/WorkflowModule";
import { useFacturarForm } from "@/features/invoices/hooks/useFacturarForm";
import { InvoicePreviewListTrigger } from "@/features/shared/components/RecordListPreviewTriggers";
import {
  archiveDocument,
  checkDocumentNumberAvailability,
  fetchNextcloudFolder,
} from "@/infrastructure/api/documentsApi";
import { fetchGmailOAuthStartUrl, fetchGmailStatus, sendGmailInvoice } from "@/infrastructure/api/gmailApi";
import { getErrorMessageFromUnknown } from "@/infrastructure/api/httpClient";
import { openGmailOAuthPopupAndWait } from "@/infrastructure/gmail/oauthPopup";
import { workbookDataTableBase, workbookDataTdTight } from "@/features/shared/lib/workbookTableText";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn, formatCurrency } from "@/lib/utils";

/** Badge de valor en módulo Emisor (misma estética que estado «Completo», solo lectura). */
const facturarIssuerValueBadgeClass =
  "inline-flex h-5 max-h-[1.25rem] min-h-[1.25rem] items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0 text-xs font-medium leading-none text-emerald-700";

/** Módulos del acordeón (un solo panel abierto en modo auto). «Guardar» va aparte, siempre visible. */
const FACTURAR_ACCORDION_MODULE_ORDER = ["emitter", "document", "client", "concepts", "fiscal", "history"] as const;
type FacturarAccordionModuleId = (typeof FACTURAR_ACCORDION_MODULE_ORDER)[number];
type FacturarWorkflowScrollTargetId = FacturarAccordionModuleId | "save";

type FacturarWorkflowChecklist = {
  emitter: { complete: boolean };
  document: { complete: boolean };
  history: { complete: boolean };
  client: { complete: boolean };
  concepts: { complete: boolean };
  fiscal: { complete: boolean };
  save: { complete: boolean };
};

/** Primer módulo incompleto del acordeón; si todo está listo para guardar, el scroll apunta al bloque Guardar. */
function autoOpenFacturarWorkflowTarget(checklist: FacturarWorkflowChecklist): FacturarWorkflowScrollTargetId {
  for (const id of FACTURAR_ACCORDION_MODULE_ORDER) {
    if (!checklist[id].complete) {
      return id;
    }
  }
  return "save";
}

type FacturarModuleUiMode = "auto" | "none" | FacturarAccordionModuleId | "save";

export function FacturarPage() {
  const [searchParams] = useSearchParams();
  const initialRecordId = String(searchParams.get("recordId") || "").trim();
  const initialTemplateProfileId = String(searchParams.get("templateProfileId") || "").trim();
  const {
    form,
    submit,
    totals,
    itemsArray,
    profileOptions,
    applyTemplateProfile,
    taxValidation,
    applyWithholdingMode,
    commitFiscalIrpfChoiceFromInput,
    workflowChecklist,
    clientOptions,
    clients,
    applyClientByName,
    applyClientByOptionId,
    clearClientData,
    selectedClientOptionId,
    clientMoreDetailsOpen,
    setClientMoreDetailsOpen,
    confirmClientModule,
    saveMutation,
    loadMutation,
    suggestNumberMutation,
    checkAvailabilityMutation,
    numberAvailabilityText,
    numberAvailabilityTone,
    profileDocumentReloadOptions,
    historyOptions,
    clientHistoryOptions,
    loadingHistory,
    totalHistoryCount,
    serverRecordId,
    openOfficialOutput,
    officialOutputError,
    officialOutputLoading,
    canOpenOfficialOutput,
    officialHtmlPreviewVersion,
    workflowLayoutResetVersion,
    loadingConfig,
    liveDocument,
    duplicateDocument,
    hasLastSetup,
    repeatLastSetup,
    isDirty,
  } = useFacturarForm(initialRecordId, initialTemplateProfileId);

  const autoOpenModuleId = useMemo(
    () => autoOpenFacturarWorkflowTarget(workflowChecklist),
    [
      workflowChecklist.emitter.complete,
      workflowChecklist.document.complete,
      workflowChecklist.history.complete,
      workflowChecklist.client.complete,
      workflowChecklist.concepts.complete,
      workflowChecklist.fiscal.complete,
    ],
  );

  const [moduleUiMode, setModuleUiMode] = useState<FacturarModuleUiMode>("auto");
  /**
   * Si el checklist marca Conceptos como «completo» mientras el usuario sigue en modo auto
   * rellenando líneas, el primer módulo incompleto pasa a ser Fiscal y el acordeón saltaba,
   * cerrando Conceptos (inputs con inert). Mantenemos Conceptos abierto hasta que el
   * usuario cierre ese panel o abra otro módulo explícitamente.
   */
  const [pinConceptsInWorkflowAuto, setPinConceptsInWorkflowAuto] = useState(false);
  const prevAutoOpenTargetRef = useRef(autoOpenModuleId);
  const lastWorkflowScrollTargetRef = useRef<string | null>(null);
  const workflowScrollBootRef = useRef(true);
  const lastWorkflowLayoutResetHandledRef = useRef(0);
  useEffect(() => {
    if (workflowLayoutResetVersion === 0) {
      return;
    }
    if (workflowLayoutResetVersion === lastWorkflowLayoutResetHandledRef.current) {
      return;
    }
    lastWorkflowLayoutResetHandledRef.current = workflowLayoutResetVersion;
    setModuleUiMode("auto");
    setPinConceptsInWorkflowAuto(false);
    setClientMoreDetailsOpen(false);
    prevAutoOpenTargetRef.current = autoOpenFacturarWorkflowTarget(workflowChecklist);
    lastWorkflowScrollTargetRef.current = null;
    workflowScrollBootRef.current = true;
  }, [workflowLayoutResetVersion, workflowChecklist, setClientMoreDetailsOpen]);
  useEffect(() => {
    const prev = prevAutoOpenTargetRef.current;
    if (prev === autoOpenModuleId) {
      return;
    }
    if (moduleUiMode === "auto" && prev === "concepts" && autoOpenModuleId !== "concepts") {
      setPinConceptsInWorkflowAuto(true);
    }
    prevAutoOpenTargetRef.current = autoOpenModuleId;
  }, [autoOpenModuleId, moduleUiMode]);
  /** Destino visual del scroll en modo auto (respeta el pin de Conceptos). */
  const autoScrollTargetId =
    moduleUiMode === "auto" && pinConceptsInWorkflowAuto ? "concepts" : autoOpenModuleId;

  useEffect(() => {
    if (moduleUiMode !== "auto") {
      return;
    }
    const key = autoScrollTargetId;
    if (lastWorkflowScrollTargetRef.current === key) {
      return;
    }
    if (workflowScrollBootRef.current) {
      workflowScrollBootRef.current = false;
      lastWorkflowScrollTargetRef.current = key;
      return;
    }
    lastWorkflowScrollTargetRef.current = key;
    const el = document.querySelector<HTMLElement>(`[data-workflow-module="${key}"]`);
    if (!el) {
      return;
    }
    const reduceMotion =
      typeof globalThis.matchMedia === "function" &&
      globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = globalThis.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest", inline: "nearest" });
    });
    return () => globalThis.cancelAnimationFrame(frame);
  }, [autoScrollTargetId, moduleUiMode]);

  const isModuleOpen = useCallback(
    (id: FacturarAccordionModuleId) => {
      if (moduleUiMode === "none") {
        return false;
      }
      if (moduleUiMode === "auto") {
        if (pinConceptsInWorkflowAuto) {
          return id === "concepts";
        }
        return id === autoOpenModuleId;
      }
      return moduleUiMode === id;
    },
    [autoOpenModuleId, moduleUiMode, pinConceptsInWorkflowAuto],
  );

  const handleWorkflowModuleOpenChange = useCallback((id: FacturarAccordionModuleId, nextOpen: boolean) => {
    if (nextOpen) {
      setPinConceptsInWorkflowAuto(false);
      setModuleUiMode(id);
    } else if (id === "concepts") {
      setPinConceptsInWorkflowAuto(false);
      setModuleUiMode("auto");
    } else {
      setModuleUiMode("none");
    }
  }, []);

  const queryClient = useQueryClient();
  const {
    register,
    watch,
    setValue,
    control,
    getValues,
    formState: { errors, isSubmitting },
  } = form;
  const taxRateWatched = watch("taxRate");
  const withholdingRateWatched = watch("withholdingRate");
  const templateProfileIdWatched = watch("templateProfileId");
  const paymentMethodWatched = watch("paymentMethod");
  const bankAccountWatched = watch("bankAccount");
  const templateProfileIdForGmail = String(templateProfileIdWatched || "").trim();
  const numberWatched = watch("number");
  const [debouncedNumber, setDebouncedNumber] = useState(numberWatched);
  const [storageScopeVersion, setStorageScopeVersion] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedNumber(String(numberWatched || "").trim()), 600);
    return () => clearTimeout(t);
  }, [numberWatched]);
  useEffect(() => {
    const name = "facturacion-storage-scope-changed";
    const onScope = () => setStorageScopeVersion((v) => v + 1);
    window.addEventListener(name, onScope);
    return () => window.removeEventListener(name, onScope);
  }, []);
  const selectedTemplateProfile = useMemo(() => {
    const id = String(templateProfileIdWatched || "").trim();
    if (!id) {
      return null;
    }
    return profileOptions.find((p) => p.id === id) ?? null;
  }, [templateProfileIdWatched, profileOptions]);

  const documentReloadSelectOptions = useMemo(() => {
    const id = String(serverRecordId || "").trim();
    const list = profileDocumentReloadOptions;
    if (!id || list.some((o) => o.recordId === id)) {
      return list;
    }
    const tail = id.includes("/") ? id.split("/").pop() ?? id : id;
    return [{ recordId: id, label: `Documento en edición · ${tail}` }, ...list];
  }, [profileDocumentReloadOptions, serverRecordId]);

  const reloadSelectValue =
    loadMutation.isPending && typeof loadMutation.variables === "string" && loadMutation.variables.trim()
      ? loadMutation.variables.trim()
      : String(serverRecordId || "").trim();

  const [gmailDialog, setGmailDialog] = useState(false);
  const [gmailTo, setGmailTo] = useState("");
  const [gmailBodyText, setGmailBodyText] = useState("");
  const [gmailSentMessage, setGmailSentMessage] = useState("");
  const [gmailAuthError, setGmailAuthError] = useState("");
  const gmailDialogRef = useRef<HTMLDialogElement>(null);

  const gmailStatusQuery = useQuery({
    queryKey: ["gmail-status", templateProfileIdForGmail],
    queryFn: () => fetchGmailStatus(templateProfileIdForGmail),
    enabled: Boolean(serverRecordId && templateProfileIdForGmail),
    staleTime: 60_000,
  });

  const gmailConfigured = Boolean(gmailStatusQuery.data?.configured);
  const gmailConnected = Boolean(gmailStatusQuery.data?.connected);

  const numberAvailabilityQuery = useQuery({
    queryKey: ["number-availability", debouncedNumber, templateProfileIdForGmail, storageScopeVersion],
    queryFn: () => {
      const storageScope = localStorage.getItem("facturacion-storage-scope") === "sandbox" ? "sandbox" : undefined;
      return checkDocumentNumberAvailability(debouncedNumber, templateProfileIdForGmail, storageScope);
    },
    enabled: Boolean(debouncedNumber && templateProfileIdForGmail),
    staleTime: 30_000,
  });

  const numberConflict =
    numberAvailabilityQuery.data?.available === false &&
    numberAvailabilityQuery.data?.conflictRecordId !== serverRecordId;

  const nextcloudQuery = useQuery({
    queryKey: ["nextcloud-folder", serverRecordId],
    queryFn: () => fetchNextcloudFolder(String(serverRecordId)),
    enabled: Boolean(serverRecordId),
    staleTime: 300_000,
  });
  const nextcloudUrl = String(nextcloudQuery.data?.url || "").trim();

  const gmailSendMutation = useMutation({
    mutationFn: () =>
      sendGmailInvoice({
        recordId: serverRecordId,
        templateProfileId: templateProfileIdForGmail,
        to: gmailTo,
        bodyText: gmailBodyText || undefined,
      }),
    onSuccess: async () => {
      setGmailSentMessage("Factura enviada por Gmail.");
      setGmailDialog(false);
      await queryClient.invalidateQueries({ queryKey: ["gmail-status", templateProfileIdForGmail] });
    },
    onError: (err) => {
      setGmailSentMessage(getErrorMessageFromUnknown(err));
    },
  });

  useEffect(() => {
    const onFocus = () => {
      setGmailAuthError("");
      void queryClient.invalidateQueries({ queryKey: ["gmail-status", templateProfileIdForGmail] });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [queryClient, templateProfileIdForGmail]);

  useEffect(() => {
    const el = gmailDialogRef.current;
    if (!el) {
      return;
    }
    if (gmailDialog) {
      if (!el.open) {
        el.showModal();
      }
    } else if (el.open) {
      el.close();
    }
  }, [gmailDialog]);

  const archiveMutation = useMutation({
    mutationFn: (recordId: string) => archiveDocument(recordId),
  });

  const shouldBlockNavigation = isDirty && !saveMutation.isPending && !saveMutation.isSuccess;
  const blocker = useBlocker(shouldBlockNavigation);

  useEffect(() => {
    if (blocker.state !== "blocked") {
      return;
    }
    const confirmed = window.confirm("Hay cambios sin guardar. ¿Salir de todas formas?");
    if (confirmed) {
      blocker.proceed();
      return;
    }
    blocker.reset();
  }, [blocker]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldBlockNavigation) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [shouldBlockNavigation]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Facturar</h1>
        <p className="text-informative">
          Crea o edita documentos; también puedes reabrirlos desde Historial.
        </p>
      </header>

      <form
        className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
        onSubmit={submit}
      >
        <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm divide-y divide-border">
          <WorkflowModule
            title="Emisor"
            stateLabel={workflowChecklist.emitter.complete ? "Completo" : "Pendiente"}
            stateTone={workflowChecklist.emitter.complete ? "ok" : "pending"}
            help={workflowChecklist.emitter.tip}
            open={isModuleOpen("emitter")}
            onOpenChange={(next) => handleWorkflowModuleOpenChange("emitter", next)}
            workflowModuleId="emitter"
            stacked
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Emisor</span>
                  {selectedTemplateProfile ? (
                    <ProfileBadge
                      label={selectedTemplateProfile.label}
                      colorKey={selectedTemplateProfile.colorKey}
                    />
                  ) : null}
                </div>
                <div className="grid gap-1">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    {...register("templateProfileId")}
                    onChange={(event) => {
                      register("templateProfileId").onChange(event);
                      applyTemplateProfile(event.target.value);
                    }}
                  >
                    <option value="">Selecciona emisor</option>
                    {profileOptions.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.label}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
              <Field label="Plantilla/layout">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("templateLayout")}
                >
                  <option value="">Plantilla...</option>
                  <option value="pear">Pear&amp;co. clásica</option>
                  <option value="editorial">Editorial / Nacho</option>
                  <option value="voulita">Eventos / La Jaulita</option>
                </select>
              </Field>
              <Field label="Forma de pago">
                <span
                  className={facturarIssuerValueBadgeClass}
                  style={{ lineHeight: 0 }}
                  aria-label={`Forma de pago: ${String(paymentMethodWatched || "").trim() || "sin definir"}`}
                >
                  {String(paymentMethodWatched || "").trim() || "—"}
                </span>
                <input type="hidden" {...register("paymentMethod")} />
              </Field>
              <Field label="Cuenta bancaria">
                <span
                  className={facturarIssuerValueBadgeClass}
                  style={{ lineHeight: 0 }}
                  aria-label={`Cuenta bancaria: ${String(bankAccountWatched || "").trim() || "sin definir"}`}
                >
                  {String(bankAccountWatched || "").trim() || "—"}
                </span>
                <input type="hidden" {...register("bankAccount")} />
              </Field>
            </div>
            <p className="text-informative">
              <span className="font-medium text-foreground">Tenant documento:</span>{" "}
              {String(watch("tenantId") || "").trim() || "-"}
            </p>
          </WorkflowModule>

          <WorkflowModule
            title="Datos del documento"
            stateLabel={workflowChecklist.document.complete ? "Completo" : "Pendiente"}
            stateTone={workflowChecklist.document.complete ? "ok" : "pending"}
            help={workflowChecklist.document.tip}
            open={isModuleOpen("document")}
            onOpenChange={(next) => handleWorkflowModuleOpenChange("document", next)}
            workflowModuleId="document"
            stacked
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Tipo" error={errors.type?.message}>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("type")}
                >
                  <option value="">Elegir tipo…</option>
                  <option value="factura">Factura</option>
                  <option value="presupuesto">Presupuesto</option>
                </select>
              </Field>
              <Field label="Número">
                <>
                  <Input placeholder="Número factura" {...register("number")} />
                  {numberConflict ? (
                    <p className="mt-0.5 text-xs text-amber-600">
                      Este número ya está en uso
                      {numberAvailabilityQuery.data?.conflictRecordId
                        ? ` (${numberAvailabilityQuery.data.conflictRecordId})`
                        : ""}
                      .
                    </p>
                  ) : null}
                </>
              </Field>
              <Field
                label="Estado contable"
                hint="Indica si el documento está enviado, cobrado o cancelado."
                error={errors.accounting?.status?.message}
              >
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("accounting.status")}
                >
                  <option value="">Elegir estado…</option>
                  <option value="ENVIADA">Enviada</option>
                  <option value="COBRADA">Cobrada</option>
                  <option value="CANCELADA">Cancelada</option>
                </select>
              </Field>
              <Field label="Fecha emisión" error={errors.issueDate?.message}>
                <div className="flex items-stretch gap-1">
                  <Input type="date" className="min-w-0 flex-1" {...register("issueDate")} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                    title="Usar la fecha de hoy"
                    aria-label="Poner fecha de emisión a hoy"
                    onClick={() => form.setValue("issueDate", new Date().toISOString().slice(0, 10), { shouldDirty: true })}
                  >
                    <Calendar className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </Field>
            </div>

            <details className="group mt-2">
              <summary className="cursor-pointer select-none text-informative hover:text-foreground list-none flex items-center gap-1">
                <span className="transition-transform group-open:rotate-90">▶</span>
                <span>Otros campos del documento (serie, vencimiento, referencia interna, contabilidad…)</span>
              </summary>
              <div className="mt-3 space-y-4">
                {numberAvailabilityText ? (
                  <p
                    className={`text-sm ${
                      numberAvailabilityTone === "success"
                        ? "text-emerald-600"
                        : numberAvailabilityTone === "error"
                          ? "text-red-600"
                          : "text-muted-foreground"
                    }`}
                  >
                    {numberAvailabilityText}
                  </p>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Serie" hint="Opcional. Separa secuencias de numeración (ej: A, RECT, 2025).">
                    <Input placeholder="Opcional" {...register("series")} />
                  </Field>
                  <Field label="Vencimiento" hint="Dejar vacío si no aplica." error={errors.dueDate?.message}>
                    <Input type="date" {...register("dueDate")} />
                  </Field>
                  <Field label="Referencia interna" error={errors.reference?.message}>
                    <Input placeholder="Tu referencia / código interno" {...register("reference")} />
                  </Field>
                  <Field label="Número final" error={errors.numberEnd?.message}>
                    <Input placeholder="Opcional (rango o número final)" {...register("numberEnd")} />
                  </Field>
                  <Field label="Fecha cobro" hint="Cuando el estado es Cobrada." error={errors.accounting?.paymentDate?.message}>
                    <Input type="date" {...register("accounting.paymentDate")} />
                  </Field>
                  <Field label="Trimestre contable">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      {...register("accounting.quarter")}
                    >
                      <option value="">—</option>
                      <option value="1T">1T</option>
                      <option value="2T">2T</option>
                      <option value="3T">3T</option>
                      <option value="4T">4T</option>
                    </select>
                  </Field>
                  <Field label="Referencia contable / ID">
                    <Input placeholder="ID contable / Drive label" {...register("accounting.invoiceId")} />
                  </Field>
                  <Field label="Importe cobrado (neto)" error={errors.accounting?.netCollected?.message}>
                    <Input
                      type="number"
                      step="0.01"
                      {...register("accounting.netCollected", {
                        setValueAs: (value) => {
                          if (value === "" || value === null || value === undefined) return 0;
                          const parsed = Number(value);
                          return Number.isFinite(parsed) ? parsed : 0;
                        },
                      })}
                    />
                  </Field>
                  <Field label="Nota fiscal">
                    <Input placeholder="Texto libre" {...register("accounting.taxes")} />
                  </Field>
                </div>
              </div>
            </details>

            <div className="grid gap-4 pt-2 sm:grid-cols-1">
              <Field
                label="Cargar documento guardado"
                hint={
                  !String(templateProfileIdWatched || "").trim()
                    ? "Elige un emisor en el desplegable para listar los documentos de ese emisor."
                    : loadingHistory
                      ? "Cargando listado del histórico…"
                      : documentReloadSelectOptions.length === 0
                        ? "No hay documentos en histórico para este emisor (o aún no se ha sincronizado)."
                        : undefined
                }
              >
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={reloadSelectValue}
                  disabled={loadMutation.isPending || !String(templateProfileIdWatched || "").trim()}
                  onChange={(event) => {
                    const next = String(event.target.value || "").trim();
                    if (!next || next === String(serverRecordId || "").trim()) {
                      return;
                    }
                    loadMutation.mutate(next);
                  }}
                >
                  <option value="">Elegir documento…</option>
                  {documentReloadSelectOptions.map((opt) => (
                    <option key={opt.recordId} value={opt.recordId}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </WorkflowModule>

          <WorkflowModule
            title="Cliente"
            stateLabel={workflowChecklist.client.complete ? "Completo" : "Pendiente"}
            stateTone={workflowChecklist.client.complete ? "ok" : "pending"}
            help={workflowChecklist.client.tip}
            open={isModuleOpen("client")}
            onOpenChange={(next) => handleWorkflowModuleOpenChange("client", next)}
            workflowModuleId="client"
            stacked
          >
            <div className="grid gap-4 sm:grid-cols-1">
              <Field label="Cliente guardado" hint="Si eliges uno, se rellenan los datos. «Quitar cliente» deja el bloque listo para otro.">
                <div className="flex gap-2">
                  <select
                    className="flex h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedClientOptionId}
                    onChange={(event) => applyClientByOptionId(event.target.value)}
                  >
                    <option value="">Seleccionar cliente guardado</option>
                    {clientOptions.map((option) => (
                      <option key={option.optionId} value={option.optionId}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 px-3 text-muted-foreground hover:text-foreground"
                    onClick={clearClientData}
                    title="Vaciar cliente seleccionado y campos asociados"
                  >
                    Quitar cliente
                  </Button>
                </div>
              </Field>
            </div>

            <details
              className="group mt-2"
              open={clientMoreDetailsOpen}
              onToggle={(event) => {
                setClientMoreDetailsOpen((event.currentTarget as HTMLDetailsElement).open);
              }}
            >
              <summary className="cursor-pointer select-none text-informative hover:text-foreground list-none flex items-center gap-1">
                <span className="transition-transform group-open:rotate-90">▶</span>
                <span>Más datos del cliente (nombre, NIF, dirección, contacto…)</span>
              </summary>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Nombre cliente" error={errors.client?.name?.message}>
                  <Input
                    list="client-options"
                    placeholder="Nombre o razón social"
                    {...register("client.name")}
                    onBlur={(event) => applyClientByName(event.target.value)}
                  />
                  <datalist id="client-options">
                    {clients.map((client) => (
                      <option key={client.recordId || client.name} value={client.name} />
                    ))}
                  </datalist>
                </Field>
                <Field label="NIF/CIF" error={errors.client?.taxId?.message}>
                  <Input placeholder="NIF/CIF" {...register("client.taxId")} />
                </Field>
                <Field label="Tipo NIF">
                  <Input list="facturar-taxid-types" placeholder="NIF / CIF / VAT…" {...register("client.taxIdType")} />
                  <datalist id="facturar-taxid-types">
                    <option value="NIF" />
                    <option value="CIF" />
                    <option value="NIE" />
                    <option value="Pasaporte" />
                    <option value="VAT" />
                  </datalist>
                </Field>
                <Field label="Email">
                  <Input placeholder="email@cliente.com" {...register("client.email")} />
                </Field>
                <Field label="Persona de contacto">
                  <Input placeholder="Persona de contacto" {...register("client.contactPerson")} />
                </Field>
                <Field label="Dirección">
                  <Input placeholder="Dirección fiscal" {...register("client.address")} />
                </Field>
                <Field label="Ciudad">
                  <Input placeholder="Ciudad" {...register("client.city")} />
                </Field>
                <Field label="Provincia">
                  <Input placeholder="Provincia" {...register("client.province")} />
                </Field>
                <Field
                  label="País (código)"
                  hint="Cuando los datos del cliente estén bien, pulsa Seleccionar para marcar el módulo como completo."
                >
                  <div className="flex flex-wrap items-stretch gap-2">
                    <Input
                      className="min-w-0 flex-1"
                      list="facturar-country-codes"
                      placeholder="ES"
                      {...register("client.taxCountryCode")}
                    />
                    <Button type="button" variant="outline" className="shrink-0" onClick={confirmClientModule}>
                      Seleccionar
                    </Button>
                  </div>
                  <datalist id="facturar-country-codes">
                    <option value="ES" /><option value="PT" /><option value="FR" />
                    <option value="DE" /><option value="IT" /><option value="GB" />
                    <option value="NL" /><option value="US" /><option value="MX" />
                    <option value="AR" /><option value="CN" />
                  </datalist>
                </Field>
              </div>
            </details>
          </WorkflowModule>

          <WorkflowModule
            title="Conceptos"
            stateLabel={workflowChecklist.concepts.complete ? "Completo" : "Pendiente"}
            stateTone={workflowChecklist.concepts.complete ? "ok" : "pending"}
            help={workflowChecklist.concepts.tip}
            open={isModuleOpen("concepts")}
            onOpenChange={(next) => handleWorkflowModuleOpenChange("concepts", next)}
            workflowModuleId="concepts"
            stacked
          >
            <div className="grid gap-4">
              {String(serverRecordId || "").trim() ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                  <span className="text-informative">Vista rápida del documento guardado (HTML oficial).</span>
                  <InvoicePreviewListTrigger
                    recordId={String(serverRecordId || "").trim()}
                    label={String(watch("number") || "").trim() || undefined}
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Tras guardar el documento, podrás abrir aquí la misma vista HTML que «Ver HTML oficial» sin salir de Conceptos.
                </p>
              )}
              <Field
                label="Modo cálculo conceptos"
                hint="'Por concepto' y 'Por bruto' calculan el total a partir de las líneas; en bruto las líneas siguen sirviendo para detalle y vista previa."
              >
                <select
                  className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("totalsBasis")}
                >
                  <option value="items">Por concepto (suma líneas)</option>
                  <option value="gross">Por bruto (totales desde líneas)</option>
                </select>
              </Field>
              <InvoiceItemsTable
                register={register}
                control={control}
                setValue={setValue}
                getValues={getValues}
                errors={errors}
                itemCount={itemsArray.fields.length}
                totalsBasis={liveDocument.totalsBasis}
                onAddItem={() =>
                  itemsArray.append({
                    concept: "",
                    description: "",
                    quantity: 1,
                    unitPrice: 0,
                    unitLabel: "",
                    hidePerPersonSubtotalInBudget: false,
                  })
                }
                onRemoveItem={(index) => itemsArray.remove(index)}
              />
            </div>
          </WorkflowModule>

          <WorkflowModule
            title="Fiscalidad"
            stateLabel={workflowChecklist.fiscal.complete ? "Completo" : "Pendiente"}
            stateTone={workflowChecklist.fiscal.complete ? "ok" : "pending"}
            help={workflowChecklist.fiscal.tip}
            open={isModuleOpen("fiscal")}
            onOpenChange={(next) => handleWorkflowModuleOpenChange("fiscal", next)}
            workflowModuleId="fiscal"
            stacked
          >
            <InvoiceTotalsPanel
              register={register}
              taxRate={taxRateWatched}
              withholdingRate={withholdingRateWatched}
              totals={totals}
              taxValidation={taxValidation}
              onTaxRatePreset={(rate) => setValue("taxRate", rate, { shouldDirty: true, shouldValidate: true })}
              onWithholdingModeChange={applyWithholdingMode}
              onIrpfFieldBlur={commitFiscalIrpfChoiceFromInput}
            />
          </WorkflowModule>

          <WorkflowModule
            title="Histórico"
            stateLabel={workflowChecklist.client.complete ? "Disponible" : "Pendiente"}
            stateTone={workflowChecklist.client.complete ? "ok" : "pending"}
            help={workflowChecklist.history.tip}
            open={isModuleOpen("history")}
            onOpenChange={(next) => handleWorkflowModuleOpenChange("history", next)}
            workflowModuleId="history"
            stacked
          >
            <div className="grid min-w-0 gap-3 sm:gap-4">
              <Field
                label="Documentos de este cliente"
                hint="Facturas y presupuestos guardados que coinciden con el nombre de cliente del borrador (sin filtros manuales)."
              >
                {!String(watch("client.name") || "").trim() ? (
                  <p className="text-sm text-informative">Indica y confirma el cliente en el módulo anterior para listar su historial.</p>
                ) : !workflowChecklist.client.complete ? (
                  <p className="text-sm text-informative">Confirma el cliente (Seleccionar junto a País) para habilitar la tabla.</p>
                ) : loadingHistory ? (
                  <p className="text-sm text-informative">Cargando histórico…</p>
                ) : clientHistoryOptions.length === 0 ? (
                  <p className="text-sm text-informative">No hay facturas ni presupuestos guardados con este nombre de cliente.</p>
                ) : (
                  <div className="-mx-2 max-h-[min(50vh,22rem)] overflow-auto rounded-md border sm:mx-0 sm:max-h-[min(60vh,28rem)]">
                    <table
                      className={cn(workbookDataTableBase, "min-w-[32rem] text-sm")}
                      aria-label="Facturas y presupuestos del cliente en el borrador"
                    >
                      <thead>
                        <tr className="sticky top-0 z-[1] border-b bg-muted/90 text-left text-informative backdrop-blur-sm">
                          <th className="p-2 pl-3 font-medium">Número</th>
                          <th className="p-2 font-medium">Tipo</th>
                          <th className="p-2 font-medium">Fecha</th>
                          <th className="p-2 text-right font-medium">Total</th>
                          <th className="w-12 p-2 text-center font-medium" title="Vista previa HTML">
                            Ver
                          </th>
                          <th className="p-2 pr-3 font-medium">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientHistoryOptions.map((row) => {
                          const pendingId =
                            loadMutation.isPending && typeof loadMutation.variables === "string"
                              ? loadMutation.variables.trim()
                              : "";
                          const rowLoading = Boolean(pendingId && pendingId === row.recordId);
                          const issueFmt =
                            row.issueDate && /^\d{4}-\d{2}-\d{2}$/u.test(row.issueDate)
                              ? new Date(`${row.issueDate}T12:00:00`).toLocaleDateString("es-ES")
                              : row.issueDate || "—";
                          return (
                            <tr
                              key={row.recordId}
                              className="border-b border-border/70 last:border-b-0 hover:bg-muted/25"
                            >
                              <td className={cn(workbookDataTdTight, "pl-3 font-medium text-foreground")} title={row.number}>
                                {row.number}
                              </td>
                              <td className={cn(workbookDataTdTight, "text-informative")}>{row.typeLabel}</td>
                              <td className={workbookDataTdTight}>{issueFmt}</td>
                              <td className={cn(workbookDataTdTight, "text-right tabular-nums")}>
                                {row.totalAmount !== null ? formatCurrency(row.totalAmount) : "—"}
                              </td>
                              <td className="p-1 text-center align-middle">
                                <InvoicePreviewListTrigger recordId={row.recordId} label={row.label} />
                              </td>
                              <td className={cn(workbookDataTdTight, "pr-3")}>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-9 min-h-[2.25rem] w-full max-w-[7.5rem] sm:h-8 sm:min-h-0"
                                  disabled={loadMutation.isPending && !rowLoading}
                                  onClick={() => loadMutation.mutate(row.recordId)}
                                >
                                  {rowLoading ? "Cargando…" : "Cargar"}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-2 text-pretty text-sm text-informative">
                  {!loadingHistory && workflowChecklist.client.complete && String(watch("client.name") || "").trim() ? (
                    <>
                      {clientHistoryOptions.length} documento(s) de este cliente
                      {totalHistoryCount > historyOptions.length ? (
                        <>
                          {" "}
                          ·{" "}
                          <Link to="/historial" className="underline underline-offset-2">
                            ver los {totalHistoryCount} en Historial
                          </Link>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </p>
              </Field>
            </div>
          </WorkflowModule>

          <div className="pt-5">
            <WorkflowModule
              title="Guardar"
              stateLabel={workflowChecklist.save.complete ? "Completo" : "Pendiente"}
              stateTone={workflowChecklist.save.complete ? "ok" : "pending"}
              help={workflowChecklist.save.tip}
              open
              onOpenChange={() => {}}
              workflowModuleId="save"
              stacked
              alwaysExpanded
              titleClassName="text-[2rem] leading-tight tracking-tight"
            >
              <div className="flex w-full flex-col items-stretch gap-3 sm:items-end">
                <div className="flex w-full max-w-full flex-col gap-3 sm:max-w-xl">
                  <Button type="submit" disabled={isSubmitting || saveMutation.isPending || loadingConfig}>
                    {saveMutation.isPending ? "Guardando..." : "Guardar documento"}
                  </Button>
                  <p className="text-pretty text-sm text-informative sm:max-w-xl sm:text-right">
                    Revise la factura en la vista previa HTML antes de guardar (panel de previsualización del documento).
                  </p>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openOfficialOutput("html")}
                      disabled={!canOpenOfficialOutput || officialOutputLoading !== null}
                    >
                      {officialOutputLoading === "html" ? "Abriendo HTML..." : "Ver HTML oficial"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openOfficialOutput("pdf")}
                      disabled={!canOpenOfficialOutput || officialOutputLoading !== null}
                    >
                      {officialOutputLoading === "pdf" ? "Abriendo PDF..." : "Abrir PDF oficial"}
                    </Button>
                    {hasLastSetup ? (
                      <Button type="button" variant="outline" onClick={repeatLastSetup}>
                        Repetir última factura
                      </Button>
                    ) : null}
                    {canOpenOfficialOutput ? (
                      <Button type="button" variant="outline" onClick={duplicateDocument}>
                        Duplicar documento
                      </Button>
                    ) : null}
                    {canOpenOfficialOutput ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={archiveMutation.isPending}
                        onClick={() => {
                          if (!serverRecordId) return;
                          if (!window.confirm("¿Archivar este documento? Se moverá a la papelera interna.")) return;
                          archiveMutation.mutate(serverRecordId);
                        }}
                      >
                        {archiveMutation.isPending ? "Archivando..." : "Archivar documento"}
                      </Button>
                    ) : null}
                    {nextcloudUrl ? (
                      <a
                        href={nextcloudUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-informative underline underline-offset-2 hover:text-foreground"
                      >
                        Ir a carpeta Nextcloud
                      </a>
                    ) : null}
                    {canOpenOfficialOutput && gmailConfigured && !gmailConnected ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          setGmailSentMessage("");
                          setGmailAuthError("");
                          try {
                            const { authUrl } = await fetchGmailOAuthStartUrl(templateProfileIdForGmail);
                            await openGmailOAuthPopupAndWait(authUrl);
                            await queryClient.invalidateQueries({ queryKey: ["gmail-status", templateProfileIdForGmail] });
                          } catch (err) {
                            setGmailAuthError(getErrorMessageFromUnknown(err));
                          }
                        }}
                      >
                        Conectar Gmail
                      </Button>
                    ) : null}
                    {canOpenOfficialOutput && gmailConfigured && gmailConnected ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setGmailTo(form.getValues("client.email") || "");
                          setGmailBodyText("");
                          setGmailSentMessage("");
                          setGmailAuthError("");
                          setGmailDialog(true);
                        }}
                      >
                        Enviar por Gmail
                      </Button>
                    ) : null}
                  </div>
                {gmailAuthError ? <p className="text-sm text-red-600 sm:text-right">{gmailAuthError}</p> : null}
                {officialOutputError ? <p className="text-sm text-red-600 sm:text-right">{officialOutputError}</p> : null}
                <div className="flex flex-col gap-1 text-informative sm:items-end sm:text-right">
                  <span>{serverRecordId ? `recordId: ${serverRecordId}` : "Documento nuevo"}</span>
                  <span>
                    {canOpenOfficialOutput
                      ? "Salida oficial habilitada para este recordId guardado."
                      : "Guarda o carga un documento para habilitar HTML/PDF oficiales."}
                  </span>
                </div>
                {(saveMutation.error || loadMutation.error || suggestNumberMutation.error || checkAvailabilityMutation.error) && (
                  <p className="text-sm text-red-600 sm:text-right">
                    {(saveMutation.error as Error | null)?.message ||
                      (loadMutation.error as Error | null)?.message ||
                      (suggestNumberMutation.error as Error | null)?.message ||
                      (checkAvailabilityMutation.error as Error | null)?.message}
                  </p>
                )}
                </div>
              </div>
            </WorkflowModule>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-1.5rem)] lg:overflow-y-auto lg:min-w-0">
          <FacturarSaveSummary
            document={liveDocument}
            profileLabel={selectedTemplateProfile?.label || String(watch("templateProfileId") || "").trim()}
            lineTotals={totals.items}
          />
          <FacturarLegacyHtmlPane
            liveDocument={liveDocument}
            serverRecordId={serverRecordId.trim()}
            isDirty={isDirty}
            refreshVersion={officialHtmlPreviewVersion}
          />
        </div>
      </form>

      <dialog
        ref={gmailDialogRef}
        onClose={() => setGmailDialog(false)}
        style={{ borderRadius: 8, padding: 24, maxWidth: 480, width: "90vw", border: "1px solid #ccc" }}
      >
        <h2 style={{ margin: "0 0 16px", fontSize: "1rem", fontWeight: 600 }}>Enviar factura por Gmail</h2>
        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 4, fontSize: "0.875rem" }}>
            Para (email)
            <input
              type="email"
              value={gmailTo}
              onChange={(e) => setGmailTo(e.target.value)}
              placeholder="cliente@ejemplo.com"
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: "0.875rem" }}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.875rem" }}>
            Mensaje (opcional)
            <textarea
              value={gmailBodyText}
              onChange={(e) => setGmailBodyText(e.target.value)}
              rows={4}
              placeholder="Texto adicional del correo..."
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: "0.875rem", resize: "vertical" }}
            />
          </label>
          {gmailSentMessage ? (
            <p
              style={{
                fontSize: "0.875rem",
                color: gmailSendMutation.isError ? "#dc2626" : "#16a34a",
                margin: 0,
              }}
            >
              {gmailSentMessage}
            </p>
          ) : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button type="button" variant="ghost" onClick={() => setGmailDialog(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!gmailTo.trim() || gmailSendMutation.isPending}
              onClick={() => gmailSendMutation.mutate()}
            >
              {gmailSendMutation.isPending ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </div>
      </dialog>
    </main>
  );
}
