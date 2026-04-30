import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DocumentLivePreview } from "@/features/invoices/components/DocumentLivePreview";
import { InvoiceItemsTable } from "@/features/invoices/components/InvoiceItemsTable";
import { InvoiceTotalsPanel } from "@/features/invoices/components/InvoiceTotalsPanel";
import { WorkflowModule } from "@/features/invoices/components/WorkflowModule";
import { useFacturarForm } from "@/features/invoices/hooks/useFacturarForm";

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
    selectedProfile,
    templateEmitterResolved,
    activeTemplateProfileId,
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
    serverRecordId,
    openOfficialOutput,
    officialOutputError,
    officialOutputLoading,
    canOpenOfficialOutput,
    loadingConfig,
    liveDocument,
  } = useFacturarForm(initialRecordId, initialTemplateProfileId);
  const {
    register,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = form;
  const taxRateWatched = watch("taxRate");
  const withholdingRateWatched = watch("withholdingRate");
  const [historyYearFilter, setHistoryYearFilter] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("");

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
                <Input placeholder="Transferencia" {...register("paymentMethod")} />
              </Field>
              <Field label="Cuenta bancaria">
                <Input placeholder="ES..." {...register("bankAccount")} />
              </Field>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Tenant documento:</span>{" "}
                {String(watch("tenantId") || "").trim() || "-"}
              </p>
              <p className="text-xs leading-relaxed">
                <span className="font-medium text-foreground">Contexto perfil (solo lectura):</span>{" "}
                {selectedProfile
                  ? `${selectedProfile.label || selectedProfile.id} · id ${selectedProfile.id}${
                      selectedProfile.invoiceNumberTag ? ` · tag ${selectedProfile.invoiceNumberTag}` : ""
                    }${selectedProfile.colorKey ? ` · color ${String(selectedProfile.colorKey).trim()}` : ""}${
                      selectedProfile.tenantId ? ` · tenant API ${String(selectedProfile.tenantId).trim()}` : ""
                    }`
                  : "Sin perfil resuelto (elige plantilla o espera a que cargue la config)."}
              </p>
              <p className="text-xs leading-relaxed">
                <span className="font-medium text-foreground">Defaults efectivos (perfil + defaults globales config):</span>{" "}
                pago {templateEmitterResolved.paymentMethod || "—"} · IGIC{" "}
                {templateEmitterResolved.taxRate !== null ? `${templateEmitterResolved.taxRate}%` : "—"} · IRPF{" "}
                {templateEmitterResolved.withholdingRate === ""
                  ? "sin retención"
                  : `${templateEmitterResolved.withholdingRate}%`}
                {templateEmitterResolved.series ? ` · serie sugerida ${templateEmitterResolved.series}` : ""}
                {templateEmitterResolved.currency ? ` · moneda config ${templateEmitterResolved.currency}` : ""}
                {activeTemplateProfileId ? ` · activo servidor: ${activeTemplateProfileId}` : ""}
              </p>
              <p className="text-xs leading-relaxed">
                <span className="font-medium text-foreground">Serie en el documento:</span>{" "}
                {String(watch("series") || "").trim() || "—"}
              </p>
            </div>
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
                <Input placeholder="Número factura" {...register("number")} />
              </Field>
              <Field label="Estado" error={errors.accounting?.status?.message}>
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
                <div className="flex gap-2">
                  <Input type="date" {...register("issueDate")} />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => form.setValue("issueDate", new Date().toISOString().slice(0, 10))}
                  >
                    Hoy
                  </Button>
                </div>
              </Field>
            </div>

            <details className="group mt-2">
              <summary className="cursor-pointer select-none text-sm text-muted-foreground hover:text-foreground list-none flex items-center gap-1">
                <span className="transition-transform group-open:rotate-90">▶</span>
                <span>Más campos del documento</span>
              </summary>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Serie">
                  <Input placeholder="Serie opcional" {...register("series")} />
                </Field>
                <Field label="Número final" error={errors.numberEnd?.message}>
                  <Input placeholder="Opcional (rango o número final)" {...register("numberEnd")} />
                </Field>
                <Field label="Vencimiento" error={errors.dueDate?.message}>
                  <Input type="date" {...register("dueDate")} />
                </Field>
                <Field label="Referencia" error={errors.reference?.message}>
                  <Input placeholder="Referencia documento" {...register("reference")} />
                </Field>
                <Field label="Fecha cobro" error={errors.accounting?.paymentDate?.message}>
                  <Input type="date" {...register("accounting.paymentDate")} />
                </Field>
                <Field label="Trimestre contable">
                  <Input placeholder="Q1 / 1T / 2026-Q1" {...register("accounting.quarter")} />
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
                    : `${yearFilteredHistoryOptions.length} de ${historyOptions.length} documentos recientes`}
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
              <Field label="Cliente guardado">
                <div className="flex gap-2">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                  <Button type="button" variant="outline" onClick={clearClientData}>
                    Limpiar cliente
                  </Button>
                </div>
              </Field>
              <Field label="Nombre cliente" error={errors.client?.name?.message}>
                <Input
                  list="client-options"
                  placeholder="Nombre cliente"
                  {...register("client.name")}
                  onBlur={(event) => applyClientByName(event.target.value)}
                />
                <datalist id="client-options">
                  {clients.map((client) => (
                    <option key={client.recordId || client.name} value={client.name} />
                  ))}
                </datalist>
              </Field>
              <Field label="NIF/CIF">
                <Input placeholder="NIF/CIF" {...register("client.taxId")} />
              </Field>
            </div>

            <details className="group mt-2">
              <summary className="cursor-pointer select-none text-sm text-muted-foreground hover:text-foreground list-none flex items-center gap-1">
                <span className="transition-transform group-open:rotate-90">▶</span>
                <span>Más datos del cliente</span>
              </summary>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
                  <Input placeholder="ES" {...register("client.taxCountryCode")} />
                </Field>
                <Field label="Tipo NIF">
                  <Input placeholder="NIF/CIF/VAT..." {...register("client.taxIdType")} />
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
                <Field label="Modo cálculo conceptos">
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
    </main>
  );
}
