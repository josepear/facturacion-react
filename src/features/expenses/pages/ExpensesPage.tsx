import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ExpenseRecord } from "@/domain/expenses/types";
import { fetchRuntimeConfig } from "@/infrastructure/api/documentsApi";
import { archiveExpense, archiveExpenseYear, fetchExpenseOptions, fetchExpenses, saveExpense } from "@/infrastructure/api/expensesApi";
import { deleteTrashEntries, fetchTrash } from "@/infrastructure/api/trashApi";
import { formatCurrency, toNumber } from "@/lib/utils";

function createEmptyExpense(profileId?: string): ExpenseRecord {
  return {
    issueDate: "",
    operationDate: "",
    vendor: "",
    taxId: "",
    taxIdType: "",
    taxCountryCode: "ES",
    invoiceNumber: "",
    invoiceNumberEnd: "",
    category: "",
    expenseConcept: "",
    paymentMethod: "",
    quarter: "",
    nextcloudUrl: "",
    description: "",
    subtotal: 0,
    taxRate: 7,
    taxAmount: 0,
    withholdingRate: 0,
    withholdingAmount: 0,
    total: 0,
    deductible: true,
    notes: "",
    templateProfileId: profileId || "",
  };
}

function normalizeExpenseDraft(expense: ExpenseRecord): ExpenseRecord {
  const subtotal = toNumber(expense.subtotal);
  const taxRate = toNumber(expense.taxRate);
  const withholdingRate = toNumber(expense.withholdingRate);
  const taxAmount = Number((subtotal * (taxRate / 100)).toFixed(2));
  const withholdingAmount = Number((subtotal * (withholdingRate / 100)).toFixed(2));
  const total = Number((subtotal + taxAmount - withholdingAmount).toFixed(2));

  return {
    ...expense,
    issueDate: String(expense.issueDate || "").trim(),
    operationDate: String(expense.operationDate || "").trim(),
    vendor: String(expense.vendor || "").trim(),
    taxId: String(expense.taxId || "").trim(),
    taxIdType: String(expense.taxIdType || "").trim(),
    taxCountryCode: String(expense.taxCountryCode || "ES").trim().toUpperCase(),
    invoiceNumber: String(expense.invoiceNumber || "").trim(),
    invoiceNumberEnd: String(expense.invoiceNumberEnd || "").trim(),
    category: String(expense.category || "").trim(),
    expenseConcept: String(expense.expenseConcept || "").trim(),
    paymentMethod: String(expense.paymentMethod || "").trim(),
    quarter: String(expense.quarter || "").trim(),
    nextcloudUrl: String(expense.nextcloudUrl || "").trim(),
    description: String(expense.description || "").trim(),
    subtotal,
    taxRate,
    taxAmount,
    withholdingRate,
    withholdingAmount,
    total,
    deductible: Boolean(expense.deductible),
    notes: String(expense.notes || "").trim(),
    templateProfileId: String(expense.templateProfileId || "").trim(),
  };
}

export function ExpensesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [archiveYear, setArchiveYear] = useState("");
  const [archiveProfileId, setArchiveProfileId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");

  const configQuery = useQuery({
    queryKey: ["runtime-config"],
    queryFn: fetchRuntimeConfig,
  });

  const expensesQuery = useQuery({
    queryKey: ["expenses"],
    queryFn: fetchExpenses,
  });

  const expenseOptionsQuery = useQuery({
    queryKey: ["expense-options"],
    queryFn: fetchExpenseOptions,
  });

  const trashQuery = useQuery({
    queryKey: ["trash"],
    queryFn: fetchTrash,
  });

  const activeProfileId = String(configQuery.data?.activeTemplateProfileId || "").trim();
  const [draft, setDraft] = useState<ExpenseRecord>(() => createEmptyExpense(activeProfileId));

  const availableYears = expensesQuery.data?.years ?? [];
  const profileOptions = configQuery.data?.templateProfiles ?? [];
  const isAdmin = String(configQuery.data?.currentUser?.role || "").trim().toLowerCase() === "admin";
  const trashExpenseItems = useMemo(
    () => (trashQuery.data?.items ?? []).filter((item) => item.category === "gastos"),
    [trashQuery.data?.items],
  );

  const filteredItems = useMemo(() => {
    const term = String(searchTerm || "").trim().toLowerCase();
    const items = expensesQuery.data?.items ?? [];
    return items.filter((item) => {
      if (yearFilter !== "all" && String(item.year || "").trim() !== yearFilter) {
        return false;
      }
      if (!term) {
        return true;
      }
      const vendor = String(item.vendor || "").toLowerCase();
      const description = String(item.description || "").toLowerCase();
      const category = String(item.category || "").toLowerCase();
      const invoiceNumber = String(item.invoiceNumber || "").toLowerCase();
      const recordId = String(item.recordId || "").toLowerCase();
      return (
        vendor.includes(term)
        || description.includes(term)
        || category.includes(term)
        || invoiceNumber.includes(term)
        || recordId.includes(term)
      );
    });
  }, [expensesQuery.data?.items, yearFilter, searchTerm]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const normalized = normalizeExpenseDraft(draft);
      if (!normalized.vendor && !normalized.description) {
        throw new Error("Indica al menos proveedor o descripción.");
      }
      return saveExpense({
        recordId: selectedRecordId || undefined,
        expense: normalized,
      });
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setSelectedRecordId(saved.recordId);
      setDraft(normalizeExpenseDraft(saved.expense));
      setStatusMessage(saved.mode === "updated" ? "Gasto actualizado." : "Gasto guardado.");
      setStatusTone("success");
    },
    onError: (error) => {
      setStatusMessage((error as Error).message || "No se pudo guardar el gasto.");
      setStatusTone("error");
    },
  });

  const archiveExpenseMutation = useMutation({
    mutationFn: (recordId: string) => archiveExpense(recordId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
        queryClient.invalidateQueries({ queryKey: ["trash"] }),
      ]);
      setStatusMessage("Gasto archivado.");
      setStatusTone("success");
      setSelectedRecordId("");
    },
    onError: (error) => {
      setStatusMessage((error as Error).message || "No se pudo archivar el gasto.");
      setStatusTone("error");
    },
  });

  const archiveYearMutation = useMutation({
    mutationFn: () => {
      const safeYear = String(archiveYear || "").trim();
      const safeProfileId = String(archiveProfileId || "").trim();
      if (!safeYear) {
        throw new Error("Selecciona ejercicio.");
      }
      if (!safeProfileId) {
        throw new Error("Selecciona perfil.");
      }
      return archiveExpenseYear({ year: safeYear, templateProfileId: safeProfileId });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
        queryClient.invalidateQueries({ queryKey: ["trash"] }),
      ]);
      setStatusMessage("Ejercicio de gastos archivado.");
      setStatusTone("success");
    },
    onError: (error) => {
      setStatusMessage((error as Error).message || "No se pudo archivar el ejercicio de gastos.");
      setStatusTone("error");
    },
  });

  const deleteTrashMutation = useMutation({
    mutationFn: (path: string) => deleteTrashEntries([path]),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["trash"] });
      setStatusMessage("Gasto borrado definitivamente de papelera.");
      setStatusTone("success");
    },
    onError: (error) => {
      setStatusMessage((error as Error).message || "No se pudo borrar de papelera.");
      setStatusTone("error");
    },
  });

  const computedDraft = useMemo(() => normalizeExpenseDraft(draft), [draft]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Gastos</h1>
        <p className="text-sm text-muted-foreground">
          Módulo real conectado a `/api/expenses` con ciclo de vida y control por perfil.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Listado de gastos</CardTitle>
            <CardDescription>Consulta y filtro básico de gastos existentes.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Buscar proveedor, descripción, categoría o factura"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
              >
                <option value="all">Todos los años</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedRecordId("");
                setDraft(createEmptyExpense(activeProfileId));
                setStatusMessage("Nuevo gasto.");
                setStatusTone("neutral");
              }}
            >
              Nuevo gasto
            </Button>
            <div className="grid gap-2 rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">Archivar ejercicio (perfil + año)</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={archiveYear}
                  onChange={(event) => setArchiveYear(event.target.value)}
                >
                  <option value="">Selecciona ejercicio</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={archiveProfileId}
                  onChange={(event) => setArchiveProfileId(event.target.value)}
                >
                  <option value="">Selecciona perfil</option>
                  {profileOptions.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.label || profile.id}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="button" variant="outline" onClick={() => archiveYearMutation.mutate()} disabled={archiveYearMutation.isPending}>
                {archiveYearMutation.isPending ? "Archivando..." : "Archivar ejercicio"}
              </Button>
            </div>
            <div className="max-h-[540px] overflow-auto rounded-md border">
              {expensesQuery.isLoading ? (
                <p className="p-3 text-sm text-muted-foreground">Cargando gastos...</p>
              ) : filteredItems.length ? (
                <ul className="divide-y">
                  {filteredItems.map((item) => {
                    const isActive = item.recordId === selectedRecordId;
                    return (
                      <li key={item.recordId}>
                        <button
                          type="button"
                          className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                            isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                          }`}
                          onClick={() => {
                            setSelectedRecordId(String(item.recordId || ""));
                            setDraft(normalizeExpenseDraft(item));
                            setStatusMessage("Gasto cargado para edición.");
                            setStatusTone("neutral");
                          }}
                        >
                          <p className="font-medium">{item.vendor || item.description || "Sin referencia"}</p>
                          <p className={`text-xs ${isActive ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
                            {item.issueDate || "-"} · {item.category || "sin categoría"} · {item.invoiceNumber || "sin nº factura"}
                          </p>
                          <p className={`text-xs ${isActive ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
                            {formatCurrency(Number(item.total || 0))} · {item.recordId}
                          </p>
                          <p className={`text-xs ${isActive ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
                            Perfil: {item.templateProfileLabel || item.templateProfileId || "por defecto"}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="p-3 text-sm text-muted-foreground">No hay gastos para ese filtro.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedRecordId ? "Editar gasto" : "Alta de gasto"}</CardTitle>
            <CardDescription>Edición mínima operativa sobre el contrato actual.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Perfil">
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.templateProfileId || ""}
                onChange={(event) => setDraft((prev) => ({ ...prev, templateProfileId: event.target.value }))}
              >
                <option value="">Perfil por defecto</option>
                {(configQuery.data?.templateProfiles ?? []).map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label || profile.id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fecha factura">
              <Input
                type="date"
                value={draft.issueDate || ""}
                onChange={(event) => setDraft((prev) => ({ ...prev, issueDate: event.target.value }))}
              />
            </Field>
            <Field label="Proveedor">
              <Input
                list="expense-vendors"
                value={draft.vendor || ""}
                onChange={(event) => setDraft((prev) => ({ ...prev, vendor: event.target.value }))}
              />
              <datalist id="expense-vendors">
                {(expenseOptionsQuery.data?.vendors ?? []).map((vendor) => (
                  <option key={vendor} value={vendor} />
                ))}
              </datalist>
            </Field>
            <Field label="NIF/CIF proveedor">
              <Input value={draft.taxId || ""} onChange={(event) => setDraft((prev) => ({ ...prev, taxId: event.target.value }))} />
            </Field>
            <Field label="Número factura">
              <Input
                value={draft.invoiceNumber || ""}
                onChange={(event) => setDraft((prev) => ({ ...prev, invoiceNumber: event.target.value }))}
              />
            </Field>
            <Field label="Categoría">
              <Input
                list="expense-categories"
                value={draft.category || ""}
                onChange={(event) => setDraft((prev) => ({ ...prev, category: event.target.value }))}
              />
              <datalist id="expense-categories">
                {(expenseOptionsQuery.data?.categories ?? []).map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </Field>
            <Field label="Descripción" >
              <Input
                value={draft.description || ""}
                onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
              />
            </Field>
            <Field label="Forma de pago">
              <Input
                value={draft.paymentMethod || ""}
                onChange={(event) => setDraft((prev) => ({ ...prev, paymentMethod: event.target.value }))}
              />
            </Field>

            <details className="sm:col-span-2 group rounded-md border border-dashed p-3">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground outline-none group-open:text-foreground">
                Más campos del gasto
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Fecha operación / devengo">
                  <Input
                    type="date"
                    value={draft.operationDate || ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, operationDate: event.target.value }))}
                  />
                </Field>
                <Field label="Número final (rango)">
                  <Input
                    value={draft.invoiceNumberEnd || ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, invoiceNumberEnd: event.target.value }))}
                  />
                </Field>
                <Field label="Tipo NIF/CIF proveedor">
                  <Input
                    placeholder="NIF / CIF / VAT..."
                    value={draft.taxIdType || ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, taxIdType: event.target.value }))}
                  />
                </Field>
                <Field label="País fiscal proveedor">
                  <Input
                    placeholder="ES"
                    maxLength={2}
                    value={draft.taxCountryCode || ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, taxCountryCode: event.target.value.toUpperCase() }))}
                  />
                </Field>
                <Field label="Trimestre">
                  <Input
                    placeholder="p. ej. Q1 o 1T"
                    value={draft.quarter || ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, quarter: event.target.value }))}
                  />
                </Field>
                <Field label="Enlace Nextcloud">
                  <Input
                    type="url"
                    inputMode="url"
                    placeholder="https://…"
                    value={draft.nextcloudUrl || ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, nextcloudUrl: event.target.value }))}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Concepto gasto">
                    <Input
                      value={draft.expenseConcept || ""}
                      onChange={(event) => setDraft((prev) => ({ ...prev, expenseConcept: event.target.value }))}
                    />
                  </Field>
                </div>
              </div>
            </details>

            <Field label="Base (subtotal)">
              <Input
                type="number"
                step="0.01"
                value={String(draft.subtotal ?? 0)}
                onChange={(event) => setDraft((prev) => ({ ...prev, subtotal: toNumber(event.target.value) }))}
              />
            </Field>
            <Field label="IGIC %">
              <Input
                type="number"
                step="0.01"
                value={String(draft.taxRate ?? 0)}
                onChange={(event) => setDraft((prev) => ({ ...prev, taxRate: toNumber(event.target.value) }))}
              />
            </Field>
            <Field label="IRPF %">
              <Input
                type="number"
                step="0.01"
                value={String(draft.withholdingRate ?? 0)}
                onChange={(event) => setDraft((prev) => ({ ...prev, withholdingRate: toNumber(event.target.value) }))}
              />
            </Field>
            <Field label="Deducible">
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.deductible ? "yes" : "no"}
                onChange={(event) => setDraft((prev) => ({ ...prev, deductible: event.target.value === "yes" }))}
              >
                <option value="yes">Sí</option>
                <option value="no">No</option>
              </select>
            </Field>
            <Field label="Notas">
              <Input value={draft.notes || ""} onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))} />
            </Field>

            <div className="sm:col-span-2 grid gap-2 rounded-md border p-3 text-sm">
              <span>Impuesto: {formatCurrency(computedDraft.taxAmount || 0)}</span>
              <span>Retención: {formatCurrency(computedDraft.withholdingAmount || 0)}</span>
              <span className="font-medium">Total: {formatCurrency(computedDraft.total || 0)}</span>
            </div>

            <div className="sm:col-span-2 flex flex-wrap gap-2">
              <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Guardando..." : "Guardar gasto"}
              </Button>
              {selectedRecordId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => archiveExpenseMutation.mutate(selectedRecordId)}
                  disabled={archiveExpenseMutation.isPending}
                >
                  {archiveExpenseMutation.isPending ? "Archivando..." : "Archivar gasto"}
                </Button>
              ) : null}
              {selectedRecordId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedRecordId("");
                    setDraft(createEmptyExpense(activeProfileId));
                    setStatusMessage("Nuevo gasto.");
                    setStatusTone("neutral");
                  }}
                >
                  Crear nuevo
                </Button>
              ) : null}
            </div>
            {statusMessage ? (
              <p className={`sm:col-span-2 text-sm ${statusTone === "error" ? "text-red-600" : statusTone === "success" ? "text-emerald-600" : "text-muted-foreground"}`}>
                {statusMessage}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Papelera gastos</CardTitle>
          <CardDescription>
            Borrado permanente disponible para admin. Restauración aún no soportada por contrato backend actual.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!isAdmin ? (
            <p className="text-sm text-muted-foreground">Sin permisos: solo los administradores pueden borrar en papelera.</p>
          ) : null}
          <div className="max-h-[280px] overflow-auto rounded-md border">
            {trashQuery.isLoading ? (
              <p className="p-3 text-sm text-muted-foreground">Cargando papelera...</p>
            ) : trashExpenseItems.length ? (
              <ul className="divide-y">
                {trashExpenseItems.slice(0, 60).map((item) => (
                  <li key={item.path} className="flex items-center justify-between gap-2 p-2 text-sm">
                    <span className="truncate">{item.path}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => deleteTrashMutation.mutate(item.path)}
                      disabled={!isAdmin || deleteTrashMutation.isPending}
                    >
                      Borrar
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-3 text-sm text-muted-foreground">No hay gastos en papelera.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

