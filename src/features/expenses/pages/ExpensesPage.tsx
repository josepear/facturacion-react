import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProfileBadge } from "@/components/ui/ProfileBadge";
import type { ExpenseRecord } from "@/domain/expenses/types";
import { useSessionQuery } from "@/features/shared/hooks/useSessionQuery";
import { fetchRuntimeConfig } from "@/infrastructure/api/documentsApi";
import { downloadControlWorkbookExport, runAccountingExportDownload } from "@/infrastructure/api/exportReportsApi";
import {
  archiveExpense,
  archiveExpenseYear,
  fetchExpenseOptions,
  fetchExpenses,
  importControlExpenses,
  saveExpense,
  saveExpenseOptions,
} from "@/infrastructure/api/expensesApi";
import { ApiError, getErrorMessageFromUnknown } from "@/infrastructure/api/httpClient";
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

function ExpenseCatalogBulkSection({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const optionsQuery = useQuery({
    queryKey: ["expense-options"],
    queryFn: fetchExpenseOptions,
  });
  const [vendorsDraft, setVendorsDraft] = useState<string | null>(null);
  const [categoriesDraft, setCategoriesDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; tone: "success" | "error" | "neutral" } | null>(null);

  const serverVendors = (optionsQuery.data?.vendors ?? []).join("\n");
  const serverCategories = (optionsQuery.data?.categories ?? []).join("\n");

  const toList = (raw: string) =>
    raw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveExpenseOptions({
        vendors: toList(vendorsDraft ?? serverVendors),
        categories: toList(categoriesDraft ?? serverCategories),
      }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["expense-options"] });
      setVendorsDraft(null);
      setCategoriesDraft(null);
      setStatus({
        text: `Guardado: ${(data.vendors ?? []).length} proveedores, ${(data.categories ?? []).length} categorías.`,
        tone: "success",
      });
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : String(err);
      setStatus({ text: `Error al guardar: ${msg}`, tone: "error" });
    },
  });

  const hasPendingChanges = vendorsDraft !== null || categoriesDraft !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Catálogo de gastos</CardTitle>
        <CardDescription>
          Proveedores y categorías del formulario (listas sugeridas y «Gestionar» en cada campo).{" "}
          {canEdit ? "Solo administradores pueden guardar aquí." : "Solo lectura."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {optionsQuery.isLoading && <p className="text-informative">Cargando catálogo...</p>}
        {optionsQuery.isError && (
          <p className="text-sm text-red-600">No se pudo cargar el catálogo de gastos.</p>
        )}
        {optionsQuery.isSuccess && (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-1">
                <label className="text-informative font-medium">
                  Proveedores ({toList(vendorsDraft ?? serverVendors).length})
                </label>
                <textarea
                  className="flex min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  readOnly={!canEdit}
                  value={vendorsDraft ?? serverVendors}
                  onChange={(e) => setVendorsDraft(e.target.value)}
                  aria-label="Lista de proveedores, uno por línea"
                />
              </div>
              <div className="grid gap-1">
                <label className="text-informative font-medium">
                  Categorías ({toList(categoriesDraft ?? serverCategories).length})
                </label>
                <textarea
                  className="flex min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  readOnly={!canEdit}
                  value={categoriesDraft ?? serverCategories}
                  onChange={(e) => setCategoriesDraft(e.target.value)}
                  aria-label="Lista de categorías, uno por línea"
                />
              </div>
            </div>
            {canEdit && (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  disabled={!hasPendingChanges || saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending ? "Guardando..." : "Guardar catálogo"}
                </Button>
                {hasPendingChanges ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setVendorsDraft(null);
                      setCategoriesDraft(null);
                      setStatus(null);
                    }}
                  >
                    Descartar cambios
                  </Button>
                ) : null}
                {status ? (
                  <p
                    className={
                      status.tone === "error"
                        ? "text-sm text-red-600"
                        : status.tone === "success"
                          ? "text-sm text-emerald-600"
                          : "text-informative"
                    }
                  >
                    {status.text}
                  </p>
                ) : null}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function normalizeExpenseDraft(expense: ExpenseRecord): ExpenseRecord {
  const subtotal = toNumber(expense.subtotal);
  const taxRate = toNumber(expense.taxRate);
  const withholdingRate = toNumber(expense.withholdingRate);
  // Preserve explicit amounts if already set; only auto-calculate when undefined
  const taxAmount = expense.taxAmount !== undefined
    ? toNumber(expense.taxAmount)
    : Number((subtotal * (taxRate / 100)).toFixed(2));
  const withholdingAmount = expense.withholdingAmount !== undefined
    ? toNumber(expense.withholdingAmount)
    : Number((subtotal * (withholdingRate / 100)).toFixed(2));
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
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRecordId = String(searchParams.get("recordId") || "").trim();
  const initialSearchTerm = String(searchParams.get("q") || "").trim();
  const initialYearFilter = String(searchParams.get("year") || "all").trim() || "all";
  const initialProfileFilter = String(searchParams.get("profile") || "all").trim() || "all";
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [yearFilter, setYearFilter] = useState(initialYearFilter);
  const [profileFilter, setProfileFilter] = useState(initialProfileFilter);
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [archiveYear, setArchiveYear] = useState("");
  const [archiveProfileId, setArchiveProfileId] = useState("");
  const [exportYear, setExportYear] = useState(() => String(new Date().getFullYear()));
  const [exportProfile, setExportProfile] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");
  const didHydrateDefaultTemplateProfile = useRef(false);
  const [catalogDialog, setCatalogDialog] = useState<"vendor" | "category" | null>(null);
  const [catalogDraft, setCatalogDraft] = useState<string[]>([]);
  const [newCatalogItem, setNewCatalogItem] = useState("");
  const catalogDialogRef = useRef<HTMLDialogElement>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [importProfileId, setImportProfileId] = useState("");
  const [importResult, setImportResult] = useState<{ created?: number; skipped?: string[] } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const configQuery = useQuery({
    queryKey: ["runtime-config"],
    queryFn: fetchRuntimeConfig,
  });

  const sessionQuery = useSessionQuery();

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
  const activeProfileLabel = profileOptions.find((p) => p.id === activeProfileId)?.label || activeProfileId;
  const isAdmin =
    Boolean(sessionQuery.data?.authenticated) &&
    String(sessionQuery.data?.user?.role || "").trim().toLowerCase() === "admin";
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
      if (profileFilter !== "all") {
        const itemProfileId = String(item.templateProfileId || "").trim();
        if (profileFilter === "__default__") {
          if (itemProfileId) {
            return false;
          }
        } else if (itemProfileId !== profileFilter) {
          return false;
        }
      }
      if (!term) {
        return true;
      }
      const vendor = String(item.vendor || "").toLowerCase();
      const description = String(item.description || "").toLowerCase();
      const category = String(item.category || "").toLowerCase();
      const invoiceNumber = String(item.invoiceNumber || "").toLowerCase();
      const recordId = String(item.recordId || "").toLowerCase();
      const paymentMethod = String(item.paymentMethod || "").toLowerCase();
      const quarter = String(item.quarter || "").toLowerCase();
      return (
        vendor.includes(term)
        || description.includes(term)
        || category.includes(term)
        || invoiceNumber.includes(term)
        || recordId.includes(term)
        || paymentMethod.includes(term)
        || quarter.includes(term)
      );
    });
  }, [expensesQuery.data?.items, yearFilter, profileFilter, searchTerm]);
  const hasActiveFilters = yearFilter !== "all" || profileFilter !== "all" || String(searchTerm || "").trim().length > 0;
  const setRecordIdSearchParam = (recordId: string) => {
    const next = new URLSearchParams(searchParams);
    if (recordId) {
      next.set("recordId", recordId);
    } else {
      next.delete("recordId");
    }
    setSearchParams(next, { replace: true });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const normalized = normalizeExpenseDraft(draft);
      if (!normalized.vendor && !normalized.description) {
        throw new Error("Indica al menos proveedor o descripción.");
      }
      if (!normalized.issueDate) {
        throw new Error("La fecha de factura es obligatoria.");
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
      setStatusMessage(getErrorMessageFromUnknown(error) || "No se pudo guardar el gasto.");
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
        throw new Error("Selecciona emisor.");
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

  const accountingExportMutation = useMutation({
    mutationFn: async () => {
      const y = String(exportYear || "").trim();
      if (y === "all") {
        throw new Error("El Excel de asesoría requiere un ejercicio concreto.");
      }
      if (!/^\d{4}$/u.test(y)) {
        throw new Error("Selecciona un ejercicio válido (AAAA).");
      }
      const pid = String(exportProfile || "").trim();
      await runAccountingExportDownload({
        year: y,
        templateProfileId:
          pid && pid !== "__all__" && pid !== "__unassigned__" ? pid : undefined,
      });
    },
    onSuccess: () => {
      setStatusMessage("Excel de asesoría generado. Revisa la descarga del navegador.");
      setStatusTone("success");
    },
    onError: (error) => {
      setStatusMessage(getErrorMessageFromUnknown(error));
      setStatusTone("error");
    },
  });

  const controlWorkbookMutation = useMutation({
    mutationFn: async () => {
      const yearToken = String(exportYear || "").trim() || "all";
      const rawProfile = String(exportProfile || "").trim();
      let invoiceProfile = "__all__";
      let expenseProfile = "__all__";
      if (rawProfile === "__unassigned__") {
        invoiceProfile = "__unassigned__";
        expenseProfile = "__unassigned__";
      } else if (rawProfile && rawProfile !== "__all__") {
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
    onSuccess: () => {
      setStatusMessage("Libro de control descargado.");
      setStatusTone("success");
    },
    onError: (error) => {
      setStatusMessage(getErrorMessageFromUnknown(error));
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

  const importExpensesMutation = useMutation({
    mutationFn: (payload: { templateProfileId: string; files: { name: string; contentBase64: string }[] }) =>
      importControlExpenses(payload),
    onSuccess: (data) => {
      setImportResult({ created: data.created, skipped: data.skipped });
      void queryClient.invalidateQueries({ queryKey: ["expenses"] });
      if (importFileRef.current) {
        importFileRef.current.value = "";
      }
    },
    onError: () => {
      setImportResult(null);
    },
  });

  function handleImportExpenses() {
    const file = importFileRef.current?.files?.[0];
    if (!file || !importProfileId) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const contentBase64 = String(e.target?.result || "").split(",")[1] ?? "";
      importExpensesMutation.mutate({
        templateProfileId: importProfileId,
        files: [{ name: file.name, contentBase64 }],
      });
    };
    reader.readAsDataURL(file);
  }

  const saveCatalogMutation = useMutation({
    mutationFn: (arg?: { type: "vendors" | "categories"; items: string[] }) => {
      const baseVendors = expenseOptionsQuery.data?.vendors ?? [];
      const baseCategories = expenseOptionsQuery.data?.categories ?? [];
      if (arg) {
        return saveExpenseOptions({
          vendors: arg.type === "vendors" ? arg.items : baseVendors,
          categories: arg.type === "categories" ? arg.items : baseCategories,
        });
      }
      return saveExpenseOptions({
        vendors: catalogDialog === "vendor" ? catalogDraft : baseVendors,
        categories: catalogDialog === "category" ? catalogDraft : baseCategories,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["expense-options"] });
      setCatalogDialog(null);
      setNewCatalogItem("");
    },
    onError: (error) => {
      setStatusMessage(getErrorMessageFromUnknown(error) || "No se pudo guardar el catálogo.");
      setStatusTone("error");
    },
  });

  const addCatalogItem = () => {
    const next = newCatalogItem.trim();
    if (!next) {
      return;
    }
    setCatalogDraft((prev) => [...prev, next]);
    setNewCatalogItem("");
  };

  useEffect(() => {
    const el = catalogDialogRef.current;
    if (!el) {
      return;
    }
    if (catalogDialog !== null) {
      if (!el.open) {
        el.showModal();
      }
    } else if (el.open) {
      el.close();
    }
  }, [catalogDialog]);

  const computedDraft = useMemo(() => normalizeExpenseDraft(draft), [draft]);

  useEffect(() => {
    if (!initialRecordId || selectedRecordId || !expensesQuery.data?.items?.length) {
      return;
    }
    const target = expensesQuery.data.items.find((item) => String(item.recordId || "").trim() === initialRecordId);
    if (!target) {
      return;
    }
    const timeoutId = globalThis.setTimeout(() => {
      setSelectedRecordId(initialRecordId);
      setDraft(normalizeExpenseDraft(target));
      setStatusMessage(`Gasto ${initialRecordId} cargado desde URL.`);
      setStatusTone("neutral");
    }, 0);
    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [expensesQuery.data?.items, initialRecordId, selectedRecordId]);

  /**
   * Alta sin `recordId`: una vez que llega `/api/config`, si el borrador sigue sin `templateProfileId`,
   * rellena con el activo del servidor. No se re-ejecuta al cambiar solo el borrador (p. ej. usuario elige
   * «Emisor por defecto» con valor vacío explícito).
   */
  useEffect(() => {
    if (yearFilter !== "all") {
      setExportYear(yearFilter);
    }
  }, [yearFilter]);

  useEffect(() => {
    if (selectedRecordId) {
      didHydrateDefaultTemplateProfile.current = false;
      return;
    }
    if (!configQuery.data || didHydrateDefaultTemplateProfile.current) {
      return;
    }
    const active = String(configQuery.data.activeTemplateProfileId || "").trim();
    if (!active) {
      return;
    }
    setDraft((prev) => {
      if (String(prev.templateProfileId || "").trim()) {
        didHydrateDefaultTemplateProfile.current = true;
        return prev;
      }
      didHydrateDefaultTemplateProfile.current = true;
      return { ...prev, templateProfileId: active };
    });
  }, [configQuery.data, selectedRecordId]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const safeSearch = String(searchTerm || "").trim();
    if (safeSearch) {
      next.set("q", safeSearch);
    } else {
      next.delete("q");
    }
    if (yearFilter && yearFilter !== "all") {
      next.set("year", yearFilter);
    } else {
      next.delete("year");
    }
    if (profileFilter && profileFilter !== "all") {
      next.set("profile", profileFilter);
    } else {
      next.delete("profile");
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [profileFilter, searchParams, searchTerm, setSearchParams, yearFilter]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Gastos</h1>
        <p className="text-informative">
          Módulo real conectado a `/api/expenses` con ciclo de vida y control por emisor.
        </p>
      </header>

      <ExpenseCatalogBulkSection canEdit={isAdmin} />

      <section className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Listado de gastos</CardTitle>
            <CardDescription>Consulta y filtro básico de gastos existentes.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-3">
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
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={profileFilter}
                onChange={(event) => setProfileFilter(event.target.value)}
              >
                <option value="all">Todos los emisores</option>
                <option value="__default__">Emisor por defecto</option>
                {profileOptions.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label || profile.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-informative">
              <span>
                Mostrando {filteredItems.length} de {(expensesQuery.data?.items ?? []).length} gastos
              </span>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setYearFilter("all");
                    setProfileFilter("all");
                  }}
                >
                  Limpiar filtros
                </Button>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedRecordId("");
                setRecordIdSearchParam("");
                didHydrateDefaultTemplateProfile.current = false;
                setDraft(createEmptyExpense(activeProfileId));
                setStatusMessage("Nuevo gasto.");
                setStatusTone("neutral");
              }}
            >
              Nuevo gasto
            </Button>
            <div className="grid gap-2 rounded-md border p-3">
              <p className="text-informative font-medium">Exportación (servidor)</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={exportYear}
                  onChange={(event) => setExportYear(event.target.value)}
                  aria-label="Ejercicio para exportación"
                >
                  <option value="all">Todos los ejercicios (solo libro de control)</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                  {availableYears.length === 0 ? (
                    <option value={String(new Date().getFullYear())}>{String(new Date().getFullYear())}</option>
                  ) : null}
                </select>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={exportProfile}
                  onChange={(event) => setExportProfile(event.target.value)}
                  aria-label="Emisor para exportación"
                >
                  <option value="">Todos los emisores</option>
                  <option value="__unassigned__">Sin emisor asignado</option>
                  {profileOptions.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.label || profile.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={accountingExportMutation.isPending}
                  onClick={() => accountingExportMutation.mutate()}
                >
                  {accountingExportMutation.isPending ? "Generando…" : "Excel asesoría (Celia)"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={controlWorkbookMutation.isPending}
                  onClick={() => controlWorkbookMutation.mutate()}
                >
                  {controlWorkbookMutation.isPending ? "Generando…" : "Libro de control (Excel)"}
                </Button>
              </div>
            </div>
            <div className="grid gap-2 rounded-md border p-3">
              <p className="text-informative font-medium">Archivar ejercicio (emisor + año)</p>
              {isAdmin ? (
                <>
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
                      <option value="">Selecciona emisor</option>
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
                </>
              ) : (
                <p className="text-informative">Solo administradores.</p>
              )}
            </div>
            <div className="max-h-[540px] overflow-auto rounded-md border">
              {expensesQuery.isLoading ? (
                <p className="p-3 text-informative">Cargando gastos...</p>
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
                            const nextRecordId = String(item.recordId || "");
                            setSelectedRecordId(nextRecordId);
                            if (nextRecordId) {
                              setRecordIdSearchParam(nextRecordId);
                            }
                            setDraft(normalizeExpenseDraft(item));
                            setStatusMessage("Gasto cargado para edición.");
                            setStatusTone("neutral");
                          }}
                        >
                          <p className="font-medium">{item.vendor || item.description || "Sin referencia"}</p>
                          <p className={isActive ? "text-xs text-primary-foreground/85" : "text-informative"}>
                            {item.issueDate || "-"} · {item.category || "sin categoría"} · {item.invoiceNumber || "sin nº factura"}
                          </p>
                          <p className={isActive ? "text-xs text-primary-foreground/85" : "text-informative"}>
                            {formatCurrency(Number(item.total || 0))} · {item.recordId}
                          </p>
                          {String(item.quarter || "").trim() ? (
                            <p className={isActive ? "text-xs text-primary-foreground/85" : "text-informative"}>
                              Trimestre: {String(item.quarter).trim()}
                            </p>
                          ) : null}
                          {(String(item.operationDate || "").trim() || String(item.paymentMethod || "").trim()) ? (
                            <p className={isActive ? "text-xs text-primary-foreground/85" : "text-informative"}>
                              {String(item.operationDate || "").trim() ? `Devengo: ${String(item.operationDate).trim()}` : "Devengo: -"}
                              {String(item.paymentMethod || "").trim() ? ` · Pago: ${String(item.paymentMethod).trim()}` : ""}
                            </p>
                          ) : null}
                          <p className={isActive ? "text-xs text-primary-foreground/85" : "text-informative"}>
                            {item.deductible ? "Deducible" : "No deducible"}
                          </p>
                          <p className={isActive ? "text-xs text-primary-foreground/85" : "text-informative"}>
                            Emisor:{" "}
                            <ProfileBadge
                              label={item.templateProfileLabel || item.templateProfileId || "por defecto"}
                              colorKey={profileOptions.find((p) => p.id === item.templateProfileId)?.colorKey}
                            />
                          </p>
                          {String(item.nextcloudUrl || "").trim() ? (
                            <p className={isActive ? "text-xs text-primary-foreground/85" : "text-informative"}>
                              <a
                                href={String(item.nextcloudUrl).trim()}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="underline"
                              >
                                Carpeta Nextcloud
                              </a>
                            </p>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="p-3 text-informative">No hay gastos para ese filtro.</p>
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
            {String(draft.year || "").trim() ? (
              <p className="sm:col-span-2 text-informative">
                <span className="font-medium text-foreground">Ejercicio (registro):</span>{" "}
                {String(draft.year).trim()}
              </p>
            ) : null}
            <Field label="Emisor">
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.templateProfileId || ""}
                onChange={(event) => setDraft((prev) => ({ ...prev, templateProfileId: event.target.value }))}
              >
                <option value="">
                  {activeProfileId
                    ? `Emisor por defecto (servidor: ${activeProfileLabel || activeProfileId})`
                    : "Emisor por defecto"}
                </option>
                {(configQuery.data?.templateProfiles ?? []).map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label || profile.id}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-informative">
                El emisor activo de Configuración es <span className="font-medium text-foreground">{activeProfileId || "—"}</span>
                {activeProfileLabel && activeProfileLabel !== activeProfileId ? ` (${activeProfileLabel})` : ""}. Vacío = el
                servidor aplica ese activo; puedes forzar un emisor concreto de la lista.
              </p>
            </Field>
            <Field label="Fecha factura" hint="Obligatoria.">
              <div className="flex items-stretch gap-1">
                <Input
                  type="date"
                  aria-label="Fecha factura del gasto"
                  className="min-w-0 flex-1"
                  value={draft.issueDate || ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, issueDate: event.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                  title="Usar la fecha de hoy"
                  aria-label="Poner fecha factura a hoy"
                  onClick={() => setDraft((prev) => ({ ...prev, issueDate: new Date().toISOString().slice(0, 10) }))}
                >
                  <span className="text-xs font-medium">Hoy</span>
                </Button>
              </div>
            </Field>
            <Field label="Proveedor" hint="Requerido si no se rellena la descripción.">
              <div className="grid gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1">
                  <Input
                    aria-label="Proveedor del gasto"
                    list="expense-vendors"
                    className="min-w-0 flex-1"
                    value={draft.vendor || ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, vendor: event.target.value }))}
                  />
                  {String(draft.vendor || "").trim()
                  && !(expenseOptionsQuery.data?.vendors ?? []).includes(String(draft.vendor || "").trim()) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="ml-1 shrink-0 text-informative underline-offset-2 hover:underline"
                      disabled={saveCatalogMutation.isPending}
                      onClick={() =>
                        saveCatalogMutation.mutate({
                          type: "vendors",
                          items: [...(expenseOptionsQuery.data?.vendors ?? []), String(draft.vendor || "").trim()],
                        })
                      }
                    >
                      Añadir al catálogo
                    </Button>
                  ) : null}
                </div>
                <datalist id="expense-vendors">
                  {(expenseOptionsQuery.data?.vendors ?? []).map((vendor) => (
                    <option key={vendor} value={vendor} />
                  ))}
                </datalist>
                {isAdmin ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit justify-self-start"
                    onClick={() => {
                      setCatalogDraft([...(expenseOptionsQuery.data?.vendors ?? [])]);
                      setCatalogDialog("vendor");
                    }}
                  >
                    Gestionar
                  </Button>
                ) : null}
              </div>
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
              <div className="grid gap-2">
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
                {isAdmin ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit justify-self-start"
                    onClick={() => {
                      setCatalogDraft([...(expenseOptionsQuery.data?.categories ?? [])]);
                      setCatalogDialog("category");
                    }}
                  >
                    Gestionar
                  </Button>
                ) : null}
              </div>
            </Field>
            <Field label="Descripción" hint="Si se rellena, el proveedor pasa a ser opcional.">
              <Input
                aria-label="Descripción del gasto"
                value={draft.description || ""}
                onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
              />
            </Field>
            <Field label="Forma de pago">
              <Input
                list="expense-payment-methods"
                value={draft.paymentMethod || ""}
                onChange={(event) => setDraft((prev) => ({ ...prev, paymentMethod: event.target.value }))}
              />
              <datalist id="expense-payment-methods">
                <option value="Transferencia bancaria" />
                <option value="Tarjeta de crédito" />
                <option value="Tarjeta de débito" />
                <option value="Domiciliación bancaria" />
                <option value="Efectivo" />
                <option value="PayPal" />
              </datalist>
            </Field>

            <details className="sm:col-span-2 group rounded-md border border-dashed p-3">
              <summary className="cursor-pointer text-informative font-medium outline-none group-open:text-foreground">
                Gasto avanzado — devengo, rango, fiscal proveedor, trimestre, enlaces y concepto
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Fecha operación / devengo">
                  <div className="flex items-stretch gap-1">
                    <Input
                      type="date"
                      className="min-w-0 flex-1"
                      value={draft.operationDate || ""}
                      onChange={(event) => setDraft((prev) => ({ ...prev, operationDate: event.target.value }))}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                      title="Usar la fecha de hoy"
                      aria-label="Poner fecha operación a hoy"
                      onClick={() => setDraft((prev) => ({ ...prev, operationDate: new Date().toISOString().slice(0, 10) }))}
                    >
                      <span className="text-xs font-medium">Hoy</span>
                    </Button>
                  </div>
                </Field>
                <Field label="Número final (rango)">
                  <Input
                    value={draft.invoiceNumberEnd || ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, invoiceNumberEnd: event.target.value }))}
                  />
                </Field>
                <Field label="Tipo NIF/CIF proveedor">
                  <Input
                    list="expense-taxid-types"
                    placeholder="NIF / CIF / VAT…"
                    value={draft.taxIdType || ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, taxIdType: event.target.value }))}
                  />
                  <datalist id="expense-taxid-types">
                    <option value="NIF" />
                    <option value="CIF" />
                    <option value="NIE" />
                    <option value="Pasaporte" />
                    <option value="VAT" />
                  </datalist>
                </Field>
                <Field label="País fiscal proveedor">
                  <Input
                    list="expense-country-codes"
                    placeholder="ES"
                    maxLength={2}
                    value={draft.taxCountryCode || ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, taxCountryCode: event.target.value.toUpperCase() }))}
                  />
                  <datalist id="expense-country-codes">
                    <option value="ES" /><option value="PT" /><option value="FR" />
                    <option value="DE" /><option value="IT" /><option value="GB" />
                    <option value="NL" /><option value="US" /><option value="MX" />
                    <option value="AR" /><option value="CN" />
                  </datalist>
                </Field>
                <Field label="Trimestre">
                  <select
                    aria-label="Trimestre"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={draft.quarter || ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, quarter: event.target.value }))}
                  >
                    <option value="">—</option>
                    <option value="1T">1T</option>
                    <option value="2T">2T</option>
                    <option value="3T">3T</option>
                    <option value="4T">4T</option>
                  </select>
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
                  {(expenseOptionsQuery.data?.categories ?? []).length ? (
                    <div className="mb-1 flex flex-wrap gap-1">
                      {(expenseOptionsQuery.data?.categories ?? []).map((category) => (
                        <button
                          key={category}
                          type="button"
                          className="cursor-pointer rounded-full border border-input bg-background px-2 py-0.5 text-xs transition-colors hover:bg-accent"
                          onClick={() => setDraft((prev) => ({ ...prev, expenseConcept: category }))}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <Field label="Concepto gasto" hint="Etiqueta contable interna; distinto del campo descripción.">
                    <div className="flex min-w-0 flex-wrap items-center gap-1">
                      <Input
                        className="min-w-0 flex-1"
                        value={draft.expenseConcept || ""}
                        onChange={(event) => setDraft((prev) => ({ ...prev, expenseConcept: event.target.value }))}
                      />
                      {String(draft.expenseConcept || "").trim()
                      && !(expenseOptionsQuery.data?.categories ?? []).includes(String(draft.expenseConcept || "").trim()) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="ml-1 shrink-0 text-informative underline-offset-2 hover:underline"
                          disabled={saveCatalogMutation.isPending}
                          onClick={() =>
                            saveCatalogMutation.mutate({
                              type: "categories",
                              items: [
                                ...(expenseOptionsQuery.data?.categories ?? []),
                                String(draft.expenseConcept || "").trim(),
                              ],
                            })
                          }
                        >
                          Añadir al catálogo
                        </Button>
                      ) : null}
                    </div>
                  </Field>
                </div>
              </div>
            </details>

            <Field label="Base (subtotal)">
              <Input
                type="number"
                step="0.01"
                value={String(draft.subtotal ?? 0)}
                onChange={(event) => {
                  const subtotal = toNumber(event.target.value);
                  setDraft((prev) => ({
                    ...prev,
                    subtotal,
                    taxAmount: Number((subtotal * (toNumber(prev.taxRate) / 100)).toFixed(2)),
                    withholdingAmount: Number((subtotal * (toNumber(prev.withholdingRate) / 100)).toFixed(2)),
                  }));
                }}
              />
            </Field>
            <Field label="IGIC %">
              <Input
                type="number"
                step="0.01"
                value={String(draft.taxRate ?? 0)}
                onChange={(event) => {
                  const taxRate = toNumber(event.target.value);
                  setDraft((prev) => ({
                    ...prev,
                    taxRate,
                    taxAmount: Number((toNumber(prev.subtotal) * (taxRate / 100)).toFixed(2)),
                  }));
                }}
              />
            </Field>
            <Field label="Cuota IGIC (€)">
              <Input
                type="number"
                step="0.01"
                value={String(draft.taxAmount ?? 0)}
                onChange={(event) => setDraft((prev) => ({ ...prev, taxAmount: toNumber(event.target.value) }))}
              />
            </Field>
            <Field label="IRPF %">
              <Input
                type="number"
                step="0.01"
                value={String(draft.withholdingRate ?? 0)}
                onChange={(event) => {
                  const withholdingRate = toNumber(event.target.value);
                  setDraft((prev) => ({
                    ...prev,
                    withholdingRate,
                    withholdingAmount: Number((toNumber(prev.subtotal) * (withholdingRate / 100)).toFixed(2)),
                  }));
                }}
              />
            </Field>
            <Field label="Importe retención IRPF (€)">
              <Input
                type="number"
                step="0.01"
                value={String(draft.withholdingAmount ?? 0)}
                onChange={(event) => setDraft((prev) => ({ ...prev, withholdingAmount: toNumber(event.target.value) }))}
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
              <span className="font-medium">Total: {formatCurrency(computedDraft.total || 0)}</span>
            </div>

            <div className="sm:col-span-2 flex flex-wrap gap-2">
              <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Guardando..." : "Guardar gasto"}
              </Button>
              {selectedRecordId && isAdmin ? (
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
                    setRecordIdSearchParam("");
                    didHydrateDefaultTemplateProfile.current = false;
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
              <p
                className={
                  statusTone === "error"
                    ? "sm:col-span-2 text-sm text-red-600"
                    : statusTone === "success"
                      ? "sm:col-span-2 text-sm text-emerald-600"
                      : "sm:col-span-2 text-informative"
                }
              >
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
            <p className="text-informative">Sin permisos: solo los administradores pueden borrar en papelera.</p>
          ) : null}
          <div className="max-h-[280px] overflow-auto rounded-md border">
            {trashQuery.isLoading ? (
              <p className="p-3 text-informative">Cargando papelera...</p>
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
              <p className="p-3 text-informative">No hay gastos en papelera.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {isAdmin ? (
        <Card>
          <div className="grid gap-4 p-4">
            <h2 className="text-base font-semibold">Importar gastos</h2>
            <p className="text-informative">
              Sube el libro de control (.xlsx) o uno o varios PDFs de facturas para importar gastos en bloque.
            </p>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Emisor destino</label>
              <select
                value={importProfileId}
                onChange={(e) => setImportProfileId(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="">— Selecciona emisor —</option>
                {profileOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label || p.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Archivo (.xlsx o .pdf)</label>
              <input ref={importFileRef} type="file" accept=".xlsx,.pdf" className="text-sm" />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleImportExpenses}
              disabled={importExpensesMutation.isPending || !importProfileId}
            >
              {importExpensesMutation.isPending ? "Importando..." : "Importar gastos"}
            </Button>

            {importExpensesMutation.isError ? (
              <p className="text-sm text-red-600">
                {(importExpensesMutation.error as Error)?.message || "Error al importar."}
              </p>
            ) : null}

            {importResult ? (
              <div className="grid gap-1">
                <p className="text-sm text-green-700">Importados: {importResult.created ?? 0}</p>
                {(importResult.skipped ?? []).length > 0 ? (
                  <p className="text-informative">
                    Omitidos: {(importResult.skipped ?? []).join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      <dialog
        ref={catalogDialogRef}
        className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-0 shadow-lg backdrop:bg-black/50"
        onClose={() => {
          setCatalogDialog(null);
          setNewCatalogItem("");
        }}
      >
        {catalogDialog !== null ? (
          <div className="grid max-h-[min(32rem,85vh)] gap-4 overflow-auto p-6">
            <h2 className="text-lg font-semibold leading-none tracking-tight">
              {catalogDialog === "vendor" ? "Proveedores" : "Categorías"}
            </h2>
            <div className="grid gap-1 border-b border-border pb-3">
              {catalogDraft.map((item, i) => (
                <div
                  key={i}
                  draggable
                  onDragStart={() => {
                    dragIndexRef.current = i;
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={() => {
                    const from = dragIndexRef.current;
                    if (from === null || from === i) {
                      return;
                    }
                    setCatalogDraft((prev) => {
                      const next = [...prev];
                      const [moved] = next.splice(from, 1);
                      if (moved !== undefined) next.splice(i, 0, moved);
                      return next;
                    });
                    dragIndexRef.current = null;
                  }}
                  onDragEnd={() => {
                    dragIndexRef.current = null;
                  }}
                  className="flex cursor-grab items-center gap-2 py-1"
                >
                  <span aria-hidden="true" className="select-none text-informative">
                    ⠿
                  </span>
                  <span className="flex-1 text-sm">{item}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCatalogDraft((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <input
                className="flex h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newCatalogItem}
                onChange={(event) => setNewCatalogItem(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCatalogItem();
                  }
                }}
                placeholder="Nuevo elemento..."
              />
              <Button type="button" onClick={addCatalogItem}>
                Añadir
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={saveCatalogMutation.isPending} onClick={() => saveCatalogMutation.mutate(undefined)}>
                {saveCatalogMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={saveCatalogMutation.isPending}
                onClick={() => catalogDialogRef.current?.close()}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
      </dialog>
    </main>
  );
}

