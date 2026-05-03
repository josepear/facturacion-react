import { Calendar } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker, useSearchParams } from "react-router-dom";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProfileBadge } from "@/components/ui/ProfileBadge";
import { DocumentLivePreview } from "@/features/invoices/components/DocumentLivePreview";
import { InvoiceItemsTable } from "@/features/invoices/components/InvoiceItemsTable";
import { InvoiceTotalsPanel } from "@/features/invoices/components/InvoiceTotalsPanel";
import { WorkflowModule } from "@/features/invoices/components/WorkflowModule";
import { useFacturarForm } from "@/features/invoices/hooks/useFacturarForm";
import {
  archiveDocument,
  checkDocumentNumberAvailability,
  fetchNextcloudFolder,
} from "@/infrastructure/api/documentsApi";
import { fetchGmailOAuthStartUrl, fetchGmailStatus, sendGmailInvoice } from "@/infrastructure/api/gmailApi";
import { useMutation, useQuery } from "@tanstack/react-query";

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
    workflowChecklist,
    clientOptions,
    clients,
    applyClientByName,
    applyClientByOptionId,
    clearClientData,
    selectedClientOptionId,
    suggestNumber,
    checkNumberAvailability,
    saveMutation,
    loadMutation,
    suggestNumberMutation,
    checkAvailabilityMutation,
    numberAvailabilityText,
    numberAvailabilityTone,
    recordIdInput,
    setRecordIdInput,
    loadByRecordId,
    historyOptions,
    filteredHistoryOptions,
    historySearchTerm,
    setHistorySearchTerm,
    selectedHistoryRecordId,
    setSelectedHistoryRecordId,
    loadBySelectedHistory,
    loadingHistory,
    totalHistoryCount,
    serverRecordId,
    openOfficialOutput,
    officialOutputError,
    officialOutputLoading,
    canOpenOfficialOutput,
    loadingConfig,
    liveDocument,
    duplicateDocument,
    hasLastSetup,
    repeatLastSetup,
    isDirty,
  } = useFacturarForm(initialRecordId, initialTemplateProfileId);
  const {
    register,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = form;
  const taxRateWatched = watch("taxRate");
  const withholdingRateWatched = watch("withholdingRate");
  const templateProfileIdWatched = watch("templateProfileId");
  const templateProfileIdForGmail = String(templateProfileIdWatched || "").trim();
  const numberWatched = watch("number");
  const [debouncedNumber, setDebouncedNumber] = useState(numberWatched);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedNumber(String(numberWatched || "").trim()), 600);
    return () => clearTimeout(t);
  }, [numberWatched]);
  const selectedTemplateProfile = useMemo(() => {
    const id = String(templateProfileIdWatched || "").trim();
    if (!id) {
      return null;
    }
    return profileOptions.find((p) => p.id === id) ?? null;
  }, [templateProfileIdWatched, profileOptions]);
  const [historyYearFilter, setHistoryYearFilter] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("");
  const [gmailDialog, setGmailDialog] = useState(false);
  const [gmailTo, setGmailTo] = useState("");
  const [gmailBodyText, setGmailBodyText] = useState("");
  const [gmailSentMessage, setGmailSentMessage] = useState("");
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
    queryKey: ["number-availability", debouncedNumber, templateProfileIdForGmail],
    queryFn: () => checkDocumentNumberAvailability(debouncedNumber, templateProfileIdForGmail),
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
    onSuccess: () => {
      setGmailSentMessage("Factura enviada por Gmail.");
      setGmailDialog(false);
    },
    onError: (err) => {
      setGmailSentMessage((err as Error).message || "Error al enviar por Gmail.");
    },
  });

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

  const historyYearOptions = useMemo(() => {
    const years = new Set(
      historyOptions
        .map((o) => String(o.issueDate || "").trim().slice(0, 4))
        .filter((y) => /^\d{4}$/.test(y))
    );
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [historyOptions]);

  const yearFilteredHistoryOptions = useMemo(() => {
    return filteredHistoryOptions.filter((option) => {
      if (historyYearFilter && !String(option.issueDate || "").startsWith(historyYearFilter)) {
        return false;
      }
      if (historyTypeFilter && option.type !== historyTypeFilter) {
        return false;
      }
      return true;
    });
  }, [filteredHistoryOptions, historyTypeFilter, historyYearFilter]);
  const hasHistoryFilters = Boolean(historyYearFilter || historyTypeFilter || historySearchTerm.trim());
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
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Facturar</h1>
        <p className="text-sm text-muted-foreground">
          Crea o edita documentos; también puedes reabrirlos desde Historial.
        </p>
      </header>

      <form className="grid gap-6 lg:grid-cols-[2fr_1fr]" onSubmit={submit}>
        <div className="grid gap-6">
          <WorkflowModule
            title="Emisor"
            stateLabel={workflowChecklist.emitter.complete ? "Completo" : "Pendiente"}
            stateTone={workflowChecklist.emitter.complete ? "ok" : "pending"}
            help={workflowChecklist.emitter.tip}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Perfil plantilla">
                <div className="grid gap-1">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    {...register("templateProfileId")}
                    onChange={(event) => {
                      register("templateProfileId").onChange(event);
                      applyTemplateProfile(event.target.value);
                    }}
                  >
                    <option value="">Selecciona perfil</option>
                    {profileOptions.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.label}
                      </option>
                    ))}
                  </select>
                  {selectedTemplateProfile ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <ProfileBadge
                        label={selectedTemplateProfile.label}
                        colorKey={selectedTemplateProfile.colorKey}
                      />
                    </div>
                  ) : null}
                </div>
              </Field>
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
                <Input placeholder="Transferencia" list="facturar-payment-methods" {...register("paymentMethod")} />
                <datalist id="facturar-payment-methods">
                  <option value="Transferencia bancaria" />
                  <option value="Tarjeta de crédito" />
                  <option value="Tarjeta de débito" />
                  <option value="Domiciliación bancaria" />
                  <option value="Efectivo" />
                  <option value="PayPal" />
                </datalist>
              </Field>
              <Field label="Cuenta bancaria">
                <Input placeholder="ES..." {...register("bankAccount")} />
              </Field>
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Tenant documento:</span>{" "}
              {String(watch("tenantId") || "").trim() || "-"}
            </p>
          </WorkflowModule>

          <WorkflowModule
            title="Datos del documento"
            stateLabel={workflowChecklist.document.complete ? "Completo" : "Pendiente"}
            stateTone={workflowChecklist.document.complete ? "ok" : "pending"}
            help={workflowChecklist.document.tip}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Tipo" error={errors.type?.message}>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("type")}
                >
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
                hint="Por defecto «Enviada». Elige otro valor solo si el documento ya está cobrado o cancelado."
                error={errors.accounting?.status?.message}
              >
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("accounting.status")}
                >
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

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Serie" hint="Opcional. Separa secuencias de numeración (ej: A, RECT, 2025).">
                <Input placeholder="Opcional" {...register("series")} />
              </Field>
              <Field label="Vencimiento" hint="Dejar vacío si no aplica." error={errors.dueDate?.message}>
                <Input type="date" {...register("dueDate")} />
              </Field>
              <Field label="Referencia interna" error={errors.reference?.message}>
                <Input placeholder="Tu referencia / código interno" {...register("reference")} />
              </Field>
            </div>

            <details className="group mt-2">
              <summary className="cursor-pointer select-none text-sm text-muted-foreground hover:text-foreground list-none flex items-center gap-1">
                <span className="transition-transform group-open:rotate-90">▶</span>
                <span>Otros campos del documento (contabilidad, rango…)</span>
              </summary>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            </details>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={suggestNumber} disabled={suggestNumberMutation.isPending}>
                {suggestNumberMutation.isPending ? "Pidiendo número..." : "Pedir siguiente número"}
              </Button>
              <Button type="button" variant="outline" onClick={checkNumberAvailability} disabled={checkAvailabilityMutation.isPending}>
                {checkAvailabilityMutation.isPending ? "Comprobando..." : "Validar disponibilidad"}
              </Button>
              <span
                className={`self-center text-sm ${
                  numberAvailabilityTone === "success"
                    ? "text-emerald-600"
                    : numberAvailabilityTone === "error"
                      ? "text-red-600"
                      : "text-muted-foreground"
                }`}
              >
                {numberAvailabilityText}
              </span>
            </div>

            <div className="grid gap-4 pt-2 sm:grid-cols-1">
              <Field label="Recargar por recordId">
                <div className="flex gap-2">
                  <Input
                    placeholder="facturas/2026/..."
                    value={recordIdInput}
                    onChange={(event) => setRecordIdInput(event.target.value)}
                  />
                  <Button type="button" variant="outline" onClick={loadByRecordId} disabled={loadMutation.isPending}>
                    {loadMutation.isPending ? "Cargando..." : "Recargar"}
                  </Button>
                </div>
              </Field>
            </div>
          </WorkflowModule>

          <WorkflowModule
            title="Histórico"
            stateLabel={workflowChecklist.history.complete ? "Disponible" : "Pendiente"}
            stateTone={workflowChecklist.history.complete ? "ok" : "pending"}
            help={workflowChecklist.history.tip}
          >
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Ejercicio">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={historyYearFilter}
                    onChange={(event) => setHistoryYearFilter(event.target.value)}
                  >
                    <option value="">Todos los ejercicios</option>
                    {historyYearOptions.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Tipo">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={historyTypeFilter}
                    onChange={(event) => setHistoryTypeFilter(event.target.value)}
                  >
                    <option value="">Todos los tipos</option>
                    <option value="factura">Factura</option>
                    <option value="presupuesto">Presupuesto</option>
                  </select>
                </Field>
                <Field label="Buscar documento">
                  <Input
                    placeholder="Número, cliente, tipo o recordId"
                    value={historySearchTerm}
                    onChange={(event) => setHistorySearchTerm(event.target.value)}
                  />
                </Field>
              </div>
              {hasHistoryFilters ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setHistoryYearFilter("");
                      setHistoryTypeFilter("");
                      setHistorySearchTerm("");
                    }}
                  >
                    Limpiar filtros histórico
                  </Button>
                </div>
              ) : null}
              <Field label="Selección rápida (histórico)">
                <div className="flex gap-2">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedHistoryRecordId}
                    onChange={(event) => setSelectedHistoryRecordId(event.target.value)}
                  >
                    <option value="">Selecciona documento</option>
                    {yearFilteredHistoryOptions.map((option) => (
                      <option key={option.recordId} value={option.recordId}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={loadBySelectedHistory}
                    disabled={!selectedHistoryRecordId || loadMutation.isPending}
                  >
                    {loadMutation.isPending ? "Cargando..." : "Cargar"}
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground">
                  {loadingHistory
                    ? "Cargando histórico..."
                    : <>
                        {yearFilteredHistoryOptions.length} de {historyOptions.length} recientes
                        {totalHistoryCount > historyOptions.length
                          ? <> · <Link to="/historial" className="underline underline-offset-2">ver los {totalHistoryCount} en Historial</Link></>
                          : null}
                      </>}
                </span>
              </Field>
            </div>
          </WorkflowModule>

          <WorkflowModule
            title="Cliente"
            stateLabel={workflowChecklist.client.complete ? "Completo" : "Pendiente"}
            stateTone={workflowChecklist.client.complete ? "ok" : "pending"}
            help={workflowChecklist.client.tip}
          >
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>

            <details className="group mt-2">
              <summary className="cursor-pointer select-none text-sm text-muted-foreground hover:text-foreground list-none flex items-center gap-1">
                <span className="transition-transform group-open:rotate-90">▶</span>
                <span>Más datos del cliente (NIF, dirección, contacto…)</span>
              </summary>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
                <Field label="País (código)">
                  <Input list="facturar-country-codes" placeholder="ES" {...register("client.taxCountryCode")} />
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
          >
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Modo cálculo conceptos" hint="'Por concepto' suma las líneas. 'Por bruto' introduce la base directamente sin líneas.">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    {...register("totalsBasis")}
                  >
                    <option value="items">Por concepto (suma líneas)</option>
                    <option value="gross">Por bruto (base imponible manual)</option>
                  </select>
                </Field>
                {liveDocument.totalsBasis === "gross" ? (
                  <Field label="Base imponible bruta">
                    <Input
                      type="number"
                      step="0.01"
                      {...register("manualGrossSubtotal", {
                        setValueAs: (value) => {
                          if (value === "" || value === null || value === undefined) {
                            return 0;
                          }
                          const parsed = Number(value);
                          return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
                        },
                      })}
                    />
                  </Field>
                ) : null}
              </div>
              <InvoiceItemsTable
                register={register}
                errors={errors}
                itemCount={itemsArray.fields.length}
                totalsBasis={liveDocument.totalsBasis}
                onAddItem={() =>
                  itemsArray.append({
                    concept: "",
                    description: "",
                    quantity: 1,
                    unitPrice: 0,
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
          >
            <InvoiceTotalsPanel
              register={register}
              taxRate={taxRateWatched}
              withholdingRate={withholdingRateWatched}
              totals={totals}
              taxValidation={taxValidation}
              onTaxRatePreset={(rate) => setValue("taxRate", rate, { shouldDirty: true, shouldValidate: true })}
              onWithholdingModeChange={applyWithholdingMode}
            />
          </WorkflowModule>

          <DocumentLivePreview document={liveDocument} />
        </div>

        <div className="grid gap-6">
          <WorkflowModule
            title="Guardar"
            stateLabel={workflowChecklist.save.complete ? "Completo" : "Pendiente"}
            stateTone={workflowChecklist.save.complete ? "ok" : "pending"}
            help={workflowChecklist.save.tip}
            defaultOpen
          >
            <div className="grid gap-3">
              <Button type="submit" disabled={isSubmitting || saveMutation.isPending || loadingConfig}>
                {saveMutation.isPending ? "Guardando..." : "Guardar documento"}
              </Button>
              <div className="flex flex-wrap gap-2">
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
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Ir a carpeta Nextcloud
                  </a>
                ) : null}
                {canOpenOfficialOutput && gmailConfigured && !gmailConnected ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const { authUrl } = await fetchGmailOAuthStartUrl(templateProfileIdForGmail);
                        window.open(authUrl, "_blank");
                      } catch {}
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
                      setGmailDialog(true);
                    }}
                  >
                    Enviar por Gmail
                  </Button>
                ) : null}
              </div>
              {officialOutputError ? <p className="text-sm text-red-600">{officialOutputError}</p> : null}
              <span className="text-sm text-muted-foreground">
                {serverRecordId ? `recordId: ${serverRecordId}` : "Documento nuevo"}
              </span>
              <span className="text-xs text-muted-foreground">
                {canOpenOfficialOutput
                  ? "Salida oficial habilitada para este recordId guardado."
                  : "Guarda o carga un documento para habilitar HTML/PDF oficiales."}
              </span>
              {(saveMutation.error || loadMutation.error || suggestNumberMutation.error || checkAvailabilityMutation.error) && (
                <p className="text-sm text-red-600">
                  {(saveMutation.error as Error | null)?.message ||
                    (loadMutation.error as Error | null)?.message ||
                    (suggestNumberMutation.error as Error | null)?.message ||
                    (checkAvailabilityMutation.error as Error | null)?.message}
                </p>
              )}
            </div>
          </WorkflowModule>
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
