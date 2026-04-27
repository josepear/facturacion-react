import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InvoiceHeader } from "@/features/invoices/components/InvoiceHeader";
import { InvoiceItemsTable } from "@/features/invoices/components/InvoiceItemsTable";
import { InvoiceTotalsPanel } from "@/features/invoices/components/InvoiceTotalsPanel";
import { useFacturarForm } from "@/features/invoices/hooks/useFacturarForm";

export function FacturarPage() {
  const {
    form,
    submit,
    totals,
    itemsArray,
    profileOptions,
    clients,
    applyClientByName,
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
    serverRecordId,
    loadingConfig,
  } = useFacturarForm();
  const {
    register,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Facturar</h1>
        <p className="text-sm text-muted-foreground">
          Paridad funcional base con legacy: edición, numeración, validación, guardado y recarga.
        </p>
      </header>

      <form className="grid gap-6 lg:grid-cols-[2fr_1fr]" onSubmit={submit}>
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Cabecera documento</CardTitle>
              <CardDescription>Número, fecha, perfil y recarga por recordId.</CardDescription>
            </CardHeader>
            <CardContent>
              <InvoiceHeader
                issueDateError={errors.issueDate?.message}
                numberAvailabilityText={numberAvailabilityText}
                numberAvailabilityTone={numberAvailabilityTone}
                loadingNumber={suggestNumberMutation.isPending}
                checkingAvailability={checkAvailabilityMutation.isPending}
                profiles={profileOptions}
                onSuggestNumber={suggestNumber}
                onCheckAvailability={checkNumberAvailability}
                register={{
                  templateProfileId: register("templateProfileId"),
                  issueDate: register("issueDate"),
                  series: register("series"),
                  number: register("number"),
                  recordIdInput,
                  setRecordIdInput,
                  onLoadRecord: loadByRecordId,
                  loadingRecord: loadMutation.isPending,
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cliente</CardTitle>
              <CardDescription>Cliente obligatorio (alineado con validación legacy de guardado).</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
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
              <Field label="Email">
                <Input placeholder="email@cliente.com" {...register("client.email")} />
              </Field>
              <Field label="Dirección">
                <Input placeholder="Dirección fiscal" {...register("client.address")} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Líneas de factura</CardTitle>
              <CardDescription>Múltiples líneas con alta/baja/edición.</CardDescription>
            </CardHeader>
            <CardContent>
              <InvoiceItemsTable
                register={register}
                errors={errors}
                itemCount={itemsArray.fields.length}
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
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6">
          <InvoiceTotalsPanel register={register} totals={totals} />
          <Card>
            <CardHeader>
              <CardTitle>Persistencia</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button type="submit" disabled={isSubmitting || saveMutation.isPending || loadingConfig}>
                {saveMutation.isPending ? "Guardando..." : "Guardar documento"}
              </Button>
              <span className="text-sm text-muted-foreground">
                {serverRecordId ? `recordId: ${serverRecordId}` : "Documento nuevo"}
              </span>
              {(saveMutation.error || loadMutation.error || suggestNumberMutation.error || checkAvailabilityMutation.error) && (
                <p className="text-sm text-red-600">
                  {(saveMutation.error as Error | null)?.message ||
                    (loadMutation.error as Error | null)?.message ||
                    (suggestNumberMutation.error as Error | null)?.message ||
                    (checkAvailabilityMutation.error as Error | null)?.message}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </form>
    </main>
  );
}
