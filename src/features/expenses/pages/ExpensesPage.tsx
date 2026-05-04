import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QuarterBadge } from "@/components/ui/QuarterBadge";
import type { ExpenseRecord } from "@/domain/expenses/types";
import {
  accountingQuarterSelectFromIssueDate,
  exerciseYearFromItem,
  filterControlExpensesWorkbook,
  filterExerciseScopeExpensesWorkbook,
  formatAdvisorCompactDate,
  sortExpenseWorkbookDefault,
} from "@/features/data/lib/advisorShareFilters";
import {
  groupExpensesByMonth,
  mapReactExpenseProfileFilterToControl,
  workbookQuarterRowToneClass,
} from "@/features/expenses/lib/controlWorkbookExpenseMonths";
import { workbookDataTableBase, workbookDataTdTight, workbookDataTdVariable } from "@/features/shared/lib/workbookTableText";
import { useSessionQuery } from "@/features/shared/hooks/useSessionQuery";
import { resolveCalendarQuarter } from "@/features/shared/lib/quarterVisual";
import { fetchRuntimeConfig } from "@/infrastructure/api/documentsApi";
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
import { cn, formatCurrency, toNumber } from "@/lib/utils";

function coerceExpenseQuarterSelectValue(raw: string): string {
  const s = String(raw || "").trim().toUpperCase();
  if (s === "T1") {
    return "1T";
  }
  if (s === "T2") {
    return "2T";
  }
  if (s === "T3") {
    return "3T";
  }
  if (s === "T4") {
    return "4T";
  }
  return String(raw || "").trim();
}

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

/** Lista única y sin vacíos (alineado con legacy `normalizeOptionList` para UX). */
function normalizeExpenseLabelList(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const v = String(raw ?? "").trim();
    if (!v || seen.has(v)) {
      continue;
    }
    seen.add(v);
    out.push(v);
  }
  return out;
}

function resolveLabelInsertBefore(rowEls: HTMLElement[], clientY: number): number {
  const n = rowEls.length;
  if (!n) {
    return 0;
  }
  for (let i = 0; i < n; i += 1) {
    const row = rowEls[i];
    if (!row) {
      continue;
    }
    const rect = row.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    if (clientY < mid) {
      return i;
    }
  }
  return n;
}

/** Misma semántica que legacy `reorderExpenseOptionDraftByInsertBefore`. */
function reorderExpenseLabelsByInsertBefore<T>(items: T[], fromIndex: number, insertBefore: number): T[] {
  const n = items.length;
  if (!n || fromIndex < 0 || fromIndex >= n || insertBefore < 0 || insertBefore > n) {
    return items;
  }
  if (insertBefore === fromIndex || insertBefore === fromIndex + 1) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) {
    return items;
  }
  let dest = insertBefore;
  if (insertBefore > fromIndex) {
    dest = insertBefore - 1;
  }
  next.splice(dest, 0, moved);
  return next;
}

function ExpenseCatalogBulkSection({
  canEdit,
  onOpenLabelsEditor,
}: {
  canEdit: boolean;
  onOpenLabelsEditor?: () => void;
}) {
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
          Edición masiva por líneas; para ordenar o borrar entradas con el mismo flujo que el legacy, usa el
          editor de etiquetas. {canEdit ? "Solo administradores pueden guardar aquí." : "Solo lectura."}
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
            {canEdit && onOpenLabelsEditor ? (
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={onOpenLabelsEditor}>
                Editor de etiquetas (ordenar, borrar…)
              </Button>
            ) : null}
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

  const issueDateNorm = String(expense.issueDate || "").trim();
  let quarterNorm = coerceExpenseQuarterSelectValue(String(expense.quarter || "").trim());
  if (!quarterNorm && /^\d{4}-\d{2}-\d{2}$/u.test(issueDateNorm)) {
    quarterNorm = accountingQuarterSelectFromIssueDate(issueDateNorm);
  }

  return {
    ...expense,
    issueDate: issueDateNorm,
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
    quarter: quarterNorm,
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

function formatExpenseImportSkippedLines(skipped: unknown): string[] {
  if (!Array.isArray(skipped)) {
    return [];
  }
  return skipped.map((item) => {
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const file = o.file != null ? String(o.file) : "";
      const sheet = o.sheet != null ? String(o.sheet) : "";
      const row = o.row != null ? String(o.row) : "";
      const reason = o.reason != null ? String(o.reason) : "";
      const loc = [file, sheet && `hoja ${sheet}`, row && `fila ${row}`].filter(Boolean).join(" · ");
      return [loc, reason].filter(Boolean).join(": ") || JSON.stringify(item);
    }
    return String(item ?? "");
  });
}

function formatExpenseImportErrorLines(errors: unknown): string[] {
  if (!Array.isArray(errors)) {
    return [];
  }
  return errors.map((item) => {
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const file = o.file != null ? String(o.file) : "";
      const sheet = o.sheet != null ? String(o.sheet) : "";
      const row = o.row != null ? String(o.row) : "";
      const err = o.error != null ? String(o.error) : "";
      const loc = [file, sheet && `hoja ${sheet}`, row && `fila ${row}`].filter(Boolean).join(" · ");
      return [loc, err].filter(Boolean).join(": ") || JSON.stringify(item);
    }
    return String(item ?? "");
  });
}

export function ExpensesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRecordId = String(searchParams.get("recordId") || "").trim();
  const initialSearchTerm = String(searchParams.get("q") || "").trim();
  const initialYearFilter = String(searchParams.get("year") || "all").trim() || "all";
  const initialProfileFilter = String(searchParams.get("profile") || "all").trim() || "all";
  const initialQuarterFilter = (() => {
    const v = String(searchParams.get("qtr") || "all").trim().toUpperCase();
    if (v === "T1" || v === "T2" || v === "T3" || v === "T4") {
      return v;
    }
    return "all";
  })();
  const initialDeductibleFilter = (() => {
    const v = String(searchParams.get("ded") || "all").trim().toLowerCase();
    if (v === "yes" || v === "no") {
      return v as "yes" | "no";
    }
    return "all" as const;
  })();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [yearFilter, setYearFilter] = useState(initialYearFilter);
  const [profileFilter, setProfileFilter] = useState(initialProfileFilter);
  const [quarterFilter, setQuarterFilter] = useState(initialQuarterFilter);
  const [deductibleFilter, setDeductibleFilter] = useState<"all" | "yes" | "no">(initialDeductibleFilter);
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [archiveYear, setArchiveYear] = useState("");
  const [archiveProfileId, setArchiveProfileId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");
  const didHydrateDefaultTemplateProfile = useRef(false);
  const [labelsModalOpen, setLabelsModalOpen] = useState(false);
  const [labelsModalFocus, setLabelsModalFocus] = useState<"vendor" | "category">("vendor");
  const [catalogVendorsDraft, setCatalogVendorsDraft] = useState<string[]>([]);
  const [catalogCategoriesDraft, setCatalogCategoriesDraft] = useState<string[]>([]);
  const [newVendorInModal, setNewVendorInModal] = useState("");
  const [newCategoryInModal, setNewCategoryInModal] = useState("");
  const [labelsModalMessage, setLabelsModalMessage] = useState<{
    text: string;
    tone: "neutral" | "success" | "error";
  } | null>(null);
  const expenseLabelsDialogRef = useRef<HTMLDialogElement>(null);
  const newVendorInModalRef = useRef<HTMLInputElement>(null);
  const newCategoryInModalRef = useRef<HTMLInputElement>(null);
  const dragLabelRef = useRef<{ list: "vendors" | "categories"; fromIndex: number } | null>(null);
  const [importProfileId, setImportProfileId] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importResult, setImportResult] = useState<{
    created?: number;
    skipped?: string[];
    errors?: string[];
  } | null>(null);
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

  const profileControlToken = useMemo(() => mapReactExpenseProfileFilterToControl(profileFilter), [profileFilter]);

  const workbookFilteredExpenses = useMemo(() => {
    const items = expensesQuery.data?.items ?? [];
    const ded: "all" | "yes" | "no" = deductibleFilter;
    const filtered = filterControlExpensesWorkbook(items, {
      filterYear: yearFilter,
      filterQuarter: quarterFilter,
      filterDeductible: ded,
      searchText: searchTerm,
      selectedProfile: profileControlToken,
    });
    return sortExpenseWorkbookDefault(filtered);
  }, [deductibleFilter, expensesQuery.data?.items, profileControlToken, quarterFilter, searchTerm, yearFilter]);

  const exerciseScopeExpenses = useMemo(() => {
    const items = expensesQuery.data?.items ?? [];
    return filterExerciseScopeExpensesWorkbook(items, {
      filterYear: yearFilter,
      selectedProfile: profileControlToken,
    });
  }, [expensesQuery.data?.items, profileControlToken, yearFilter]);

  const expenseMonthGroups = useMemo(() => groupExpensesByMonth(workbookFilteredExpenses), [workbookFilteredExpenses]);

  const workbookExpenseTotal = useMemo(
    () => workbookFilteredExpenses.reduce((s, e) => s + (Number(e.total) || 0), 0),
    [workbookFilteredExpenses],
  );
  const exerciseExpenseTotal = useMemo(
    () => exerciseScopeExpenses.reduce((s, e) => s + (Number(e.total) || 0), 0),
    [exerciseScopeExpenses],
  );

  const deductibleFilterLabel =
    deductibleFilter === "yes" ? "Solo deducibles" : deductibleFilter === "no" ? "Solo no deducibles" : "Todos los gastos";

  const expenseTableMetaLine = `${deductibleFilterLabel} · ${workbookFilteredExpenses.length} visibles · ${formatCurrency(workbookExpenseTotal)} en el filtro · ${formatCurrency(exerciseExpenseTotal)} en el ejercicio`;

  const hasActiveFilters =
    yearFilter !== "all"
    || profileFilter !== "all"
    || quarterFilter !== "all"
    || deductibleFilter !== "all"
    || String(searchTerm || "").trim().length > 0;
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
    mutationFn: (payload: {
      templateProfileId: string;
      files: { name: string; contentBase64: string }[];
      previewOnly?: boolean;
    }) => importControlExpenses(payload),
    onSuccess: (data) => {
      if (importFileRef.current) {
        importFileRef.current.value = "";
      }
      setImportFileName("");

      const firstPreview = Array.isArray(data.previews) ? data.previews[0] : undefined;
      const previewExpense = firstPreview?.expense;
      const treatAsPdfPreview = Boolean(data.preview) || Boolean(previewExpense);

      if (treatAsPdfPreview) {
        if (previewExpense) {
          setImportResult(null);
          setDraft(normalizeExpenseDraft(previewExpense));
          setSelectedRecordId("");
          setRecordIdSearchParam("");
          const label = String(firstPreview?.file || "PDF").trim() || "PDF";
          setStatusMessage(
            `«${label}» analizado: datos en el formulario como gasto nuevo. Revisa y pulsa «Guardar gasto».`,
          );
          setStatusTone("success");
          return;
        }
        setImportResult({
          created: 0,
          skipped: formatExpenseImportSkippedLines(data.skipped),
          errors: formatExpenseImportErrorLines(data.errors),
        });
        setStatusMessage("No se pudo rellenar el formulario desde ese PDF. Revisa omitidos o errores abajo.");
        setStatusTone(data.errors?.length ? "error" : "neutral");
        return;
      }

      const created = data.created ?? 0;
      setImportResult({
        created,
        skipped: formatExpenseImportSkippedLines(data.skipped),
        errors: formatExpenseImportErrorLines(data.errors),
      });
      void queryClient.invalidateQueries({ queryKey: ["expenses"] });
      if (created > 0) {
        setStatusMessage(
          `Se guardaron ${created} gasto(s) en el servidor (importación clásica). Revisa el listado; con la versión nueva del servidor el PDF puede rellenar el formulario sin guardar hasta que confirmes.`,
        );
        setStatusTone("success");
      }
    },
    onError: () => {
      setImportResult(null);
    },
  });

  function handleImportExpenses() {
    const file = importFileRef.current?.files?.[0];
    if (!importProfileId) {
      setStatusMessage("Selecciona el emisor destino antes de importar.");
      setStatusTone("error");
      return;
    }
    if (!file) {
      setStatusMessage("Selecciona un archivo .xlsx o .pdf.");
      setStatusTone("error");
      return;
    }
    const isPdf = /\.pdf$/iu.test(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const contentBase64 = String(e.target?.result || "").split(",")[1] ?? "";
      if (!contentBase64.trim()) {
        setStatusMessage("No se pudo leer el archivo (codificación vacía).");
        setStatusTone("error");
        return;
      }
      importExpensesMutation.mutate({
        templateProfileId: importProfileId,
        files: [{ name: file.name, contentBase64 }],
        previewOnly: isPdf,
      });
    };
    reader.readAsDataURL(file);
  }

  const saveCatalogListsMutation = useMutation({
    mutationFn: (payload: { vendors: string[]; categories: string[] }) =>
      saveExpenseOptions({
        vendors: normalizeExpenseLabelList(payload.vendors),
        categories: normalizeExpenseLabelList(payload.categories),
      }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["expense-options"] });
      const v = data.vendors ?? [];
      const c = data.categories ?? [];
      setCatalogVendorsDraft([...v]);
      setCatalogCategoriesDraft([...c]);
      setLabelsModalMessage({
        text: `Guardado (${v.length} proveedores, ${c.length} conceptos).`,
        tone: "success",
      });
    },
    onError: (error) => {
      const msg = getErrorMessageFromUnknown(error) || "No se pudo guardar el catálogo.";
      setLabelsModalMessage({ text: msg, tone: "error" });
      setStatusMessage(msg);
      setStatusTone("error");
    },
  });

  const mutateCatalogLists = saveCatalogListsMutation.mutate;

  const openExpenseLabelsModal = useCallback((focus: "vendor" | "category" = "vendor") => {
    const v = expenseOptionsQuery.data?.vendors ?? [];
    const c = expenseOptionsQuery.data?.categories ?? [];
    setCatalogVendorsDraft([...v]);
    setCatalogCategoriesDraft([...c]);
    setNewVendorInModal("");
    setNewCategoryInModal("");
    setLabelsModalFocus(focus);
    setLabelsModalMessage({
      text: "Arrastra cada fila para reordenar; ✕ borra la etiqueta.",
      tone: "neutral",
    });
    setLabelsModalOpen(true);
  }, [expenseOptionsQuery.data?.categories, expenseOptionsQuery.data?.vendors]);

  useEffect(() => {
    const el = expenseLabelsDialogRef.current;
    if (!el) {
      return;
    }
    if (labelsModalOpen) {
      if (!el.open) {
        el.showModal();
      }
    } else if (el.open) {
      el.close();
    }
  }, [labelsModalOpen]);

  useEffect(() => {
    if (!labelsModalOpen) {
      return;
    }
    const id = requestAnimationFrame(() => {
      if (labelsModalFocus === "category") {
        newCategoryInModalRef.current?.focus();
      } else {
        newVendorInModalRef.current?.focus();
      }
    });
    return () => {
      cancelAnimationFrame(id);
    };
  }, [labelsModalFocus, labelsModalOpen]);

  const handleDropLabelRow = useCallback(
    (listKey: "vendors" | "categories", e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const st = dragLabelRef.current;
      const root = e.currentTarget;
      if (!st || st.list !== listKey) {
        dragLabelRef.current = null;
        return;
      }
      const rowEls = [...root.querySelectorAll<HTMLElement>("[data-expense-label-row]")];
      const insertBefore = resolveLabelInsertBefore(rowEls, e.clientY);
      dragLabelRef.current = null;
      const nextVendors =
        listKey === "vendors"
          ? reorderExpenseLabelsByInsertBefore(catalogVendorsDraft, st.fromIndex, insertBefore)
          : catalogVendorsDraft;
      const nextCategories =
        listKey === "categories"
          ? reorderExpenseLabelsByInsertBefore(catalogCategoriesDraft, st.fromIndex, insertBefore)
          : catalogCategoriesDraft;
      if (listKey === "vendors" && nextVendors === catalogVendorsDraft) {
        return;
      }
      if (listKey === "categories" && nextCategories === catalogCategoriesDraft) {
        return;
      }
      setCatalogVendorsDraft(nextVendors);
      setCatalogCategoriesDraft(nextCategories);
      mutateCatalogLists({ vendors: nextVendors, categories: nextCategories });
    },
    [catalogCategoriesDraft, catalogVendorsDraft, mutateCatalogLists],
  );

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
    if (quarterFilter && quarterFilter !== "all") {
      next.set("qtr", quarterFilter);
    } else {
      next.delete("qtr");
    }
    if (deductibleFilter && deductibleFilter !== "all") {
      next.set("ded", deductibleFilter);
    } else {
      next.delete("ded");
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [deductibleFilter, profileFilter, quarterFilter, searchParams, searchTerm, setSearchParams, yearFilter]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Gastos</h1>
        <p className="text-informative">
          Módulo real conectado a `/api/expenses` con ciclo de vida y control por emisor.
        </p>
      </header>

      <div className={`grid gap-6 lg:items-start ${isAdmin ? "lg:grid-cols-2" : ""}`}>
        {isAdmin ? (
          <Card>
            <div className="grid gap-4 p-4">
              <h2 className="text-base font-semibold">Importar gastos</h2>
              <p className="text-informative">
                <strong>Excel (.xlsx):</strong> importa filas y crea gastos en el servidor (como en la vista legacy).
                <strong className="mt-1 block">PDF:</strong> un solo PDF rellena el formulario de la derecha como{" "}
                <strong>gasto nuevo</strong> (sin guardar hasta que pulses «Guardar gasto»). Varios PDFs seguidos:
                súbelos uno a uno en vista previa, o usa Excel para carga masiva.
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
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".xlsx,.pdf"
                  className="text-sm"
                  onChange={(event) => setImportFileName(event.target.files?.[0]?.name || "")}
                />
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleImportExpenses}
                disabled={importExpensesMutation.isPending || !importProfileId}
              >
                {importExpensesMutation.isPending
                  ? "Procesando..."
                  : /\.pdf$/iu.test(importFileName)
                    ? "Analizar PDF en formulario"
                    : "Importar desde Excel"}
              </Button>

              {importExpensesMutation.isError ? (
                <p className="text-sm text-red-600">
                  {(importExpensesMutation.error as Error)?.message || "Error al importar."}
                </p>
              ) : null}

              {importResult ? (
                <div className="grid gap-2 rounded-md border border-border bg-muted/20 p-3 text-sm">
                  <p className="font-medium text-foreground">Resultado</p>
                  <p className="text-emerald-700">Creados en servidor: {importResult.created ?? 0}</p>
                  {(importResult.skipped ?? []).length > 0 ? (
                    <div className="grid gap-1">
                      <p className="text-xs font-medium text-informative">Omitidos</p>
                      <ul className="max-h-40 list-inside list-disc overflow-y-auto text-xs text-informative">
                        {(importResult.skipped ?? []).map((line) => (
                          <li key={line} className="break-words">
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {(importResult.errors ?? []).length > 0 ? (
                    <div className="grid gap-1">
                      <p className="text-xs font-medium text-red-700">Errores</p>
                      <ul className="max-h-40 list-inside list-disc overflow-y-auto text-xs text-red-700">
                        {(importResult.errors ?? []).map((line) => (
                          <li key={line} className="break-words">
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}
        <ExpenseCatalogBulkSection canEdit={isAdmin} onOpenLabelsEditor={() => openExpenseLabelsModal("vendor")} />
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Gastos</CardTitle>
            <CardDescription>Vista del filtro actual; mismo criterio que la hoja de control (perfil, ejercicio, trimestre, deducible y búsqueda).</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <label className="grid gap-1 text-sm" htmlFor="expense-workbook-search">
                <span className="font-medium text-foreground">Buscar en gastos</span>
                <Input
                  id="expense-workbook-search"
                  type="search"
                  autoComplete="off"
                  placeholder="Proveedor, concepto, categoría, NIF…"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  aria-label="Filtrar filas de gastos por texto"
                />
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-foreground">Usuario o emisor</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={profileFilter}
                  onChange={(event) => setProfileFilter(event.target.value)}
                  aria-label="Perfil para gastos"
                >
                  <option value="all">Todos los emisores</option>
                  <option value="__default__">Emisor por defecto</option>
                  <option value="__unassigned__">Sin emisor asignado</option>
                  {profileOptions.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.label || profile.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-foreground">Ejercicio</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={yearFilter}
                  onChange={(event) => setYearFilter(event.target.value)}
                  aria-label="Ejercicio para gastos"
                >
                  <option value="all">Todos los años</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-foreground">Trimestre</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={quarterFilter}
                  onChange={(event) => setQuarterFilter(event.target.value)}
                  aria-label="Trimestre para gastos"
                >
                  <option value="all">Todos</option>
                  <option value="T1">T1</option>
                  <option value="T2">T2</option>
                  <option value="T3">T3</option>
                  <option value="T4">T4</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-foreground">Deducible</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={deductibleFilter}
                  onChange={(event) => setDeductibleFilter(event.target.value as "all" | "yes" | "no")}
                  aria-label="Filtro por deducibilidad"
                >
                  <option value="all">Todos</option>
                  <option value="yes">Deducibles</option>
                  <option value="no">No deducibles</option>
                </select>
              </label>
            </div>
            <p className="text-sm text-informative">{expenseTableMetaLine}</p>
            <div className="flex flex-wrap items-center gap-2">
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
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setYearFilter("all");
                    setProfileFilter("all");
                    setQuarterFilter("all");
                    setDeductibleFilter("all");
                  }}
                >
                  Limpiar filtro
                </Button>
              ) : null}
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
            <div className="max-h-[min(70vh,36rem)] overflow-auto rounded-md border">
              {expensesQuery.isLoading ? (
                <p className="p-3 text-informative">Cargando gastos...</p>
              ) : workbookFilteredExpenses.length ? (
                <table className={cn(workbookDataTableBase, "min-w-[44rem]")} aria-label="Gastos del ejercicio filtrados">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-informative">
                      <th className="p-2 font-medium">Trim.</th>
                      <th className="p-2 font-medium">Fecha</th>
                      <th className="p-2 font-medium">Proveedor</th>
                      <th className="p-2 font-medium">Factura</th>
                      <th className="p-2 text-right font-medium">Total</th>
                      <th className="p-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  {expenseMonthGroups.map((group) => (
                    <tbody key={group.monthKey} className="border-b border-border/80">
                      <tr>
                        <th colSpan={6} scope="colgroup" className="bg-muted/30 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-foreground">
                          <span>{group.title}</span>
                          <span className="ml-2 font-normal normal-case text-informative">
                            {group.items.length} gasto(s) · {formatCurrency(group.monthTotal)}
                          </span>
                        </th>
                      </tr>
                      {group.items.map((item) => {
                        const rid = String(item.recordId || item.id || "").trim();
                        const qNorm = resolveCalendarQuarter(String(item.quarter || ""), String(item.issueDate || ""));
                        const dateMeta =
                          String(item.operationDate || "").trim()
                          && String(item.operationDate || "").trim() !== String(item.issueDate || "").trim()
                            ? `Operación ${formatAdvisorCompactDate(String(item.operationDate || ""))}`
                            : exerciseYearFromItem(item) || "";
                        const vendorMeta = [
                          item.taxId ? `NIF ${item.taxId}` : "",
                          item.taxIdType ? `Tipo ${item.taxIdType}` : "",
                          item.taxCountryCode ? `País ${item.taxCountryCode}` : "",
                          item.templateProfileLabel ? `Perfil ${item.templateProfileLabel}` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ");
                        const isActive = rid === selectedRecordId;
                        const nc = String(item.nextcloudUrl || "").trim();
                        const issueFmt = formatAdvisorCompactDate(String(item.issueDate || ""));
                        const dateTitle = [issueFmt, dateMeta].filter(Boolean).join(" · ");
                        const vendorTitle = [item.vendor || "—", vendorMeta].filter(Boolean).join(" · ");
                        return (
                          <tr
                            key={rid || `${group.monthKey}-${item.vendor}-${item.issueDate}`}
                            className={`cursor-pointer border-b border-border/50 hover:bg-accent/50 ${workbookQuarterRowToneClass(qNorm)} ${
                              isActive ? "bg-primary/10" : ""
                            }`}
                            onClick={() => {
                              if (!rid) {
                                return;
                              }
                              setSelectedRecordId(rid);
                              setRecordIdSearchParam(rid);
                              setDraft(normalizeExpenseDraft(item));
                              setStatusMessage("Gasto cargado para edición.");
                              setStatusTone("neutral");
                            }}
                          >
                            <td className="p-2 align-middle">
                              <QuarterBadge quarter={String(item.quarter || "")} issueDate={String(item.issueDate || "")} />
                            </td>
                            <td className={workbookDataTdVariable} title={dateTitle || undefined}>
                              <span className="block truncate font-mono text-xs">{issueFmt}</span>
                            </td>
                            <td className={workbookDataTdVariable} title={vendorTitle || undefined}>
                              <span className="block truncate font-medium">{item.vendor || "—"}</span>
                            </td>
                            <td
                              className={`${workbookDataTdVariable} text-xs`}
                              title={nc || undefined}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {!nc ? (
                                <span className="text-informative">—</span>
                              ) : /^https?:\/\//iu.test(nc) ? (
                                <a
                                  href={nc}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block truncate text-primary underline"
                                >
                                  {nc}
                                </a>
                              ) : (
                                <span className="block truncate">{nc}</span>
                              )}
                            </td>
                            <td className={`${workbookDataTdTight} text-right tabular-nums font-medium`}>{formatCurrency(Number(item.total || 0))}</td>
                            <td className={`${workbookDataTdTight} align-middle`} onClick={(e) => e.stopPropagation()}>
                              <div className="flex flex-nowrap gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2"
                                  aria-label="Editar gasto"
                                  onClick={() => {
                                    if (!rid) {
                                      return;
                                    }
                                    setSelectedRecordId(rid);
                                    setRecordIdSearchParam(rid);
                                    setDraft(normalizeExpenseDraft(item));
                                    setStatusMessage("Gasto cargado para edición.");
                                    setStatusTone("neutral");
                                  }}
                                >
                                  Editar
                                </Button>
                                {isAdmin && rid ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-red-600 hover:text-red-700"
                                    disabled={archiveExpenseMutation.isPending}
                                    onClick={() => archiveExpenseMutation.mutate(rid)}
                                  >
                                    Archivar
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-muted/20 text-xs font-medium text-informative">
                        <td colSpan={4} className="p-2">
                          Total {group.title}
                        </td>
                        <td className="p-2 text-right tabular-nums text-foreground">{formatCurrency(group.monthTotal)}</td>
                        <td />
                      </tr>
                    </tbody>
                  ))}
                  <tfoot>
                    <tr className="border-t bg-muted/30 font-medium">
                      <td colSpan={4} className="p-2">
                        Totales gastos (filtro)
                      </td>
                      <td className="p-2 text-right tabular-nums">{formatCurrency(workbookExpenseTotal)}</td>
                      <td />
                    </tr>
                    <tr className="bg-muted/15 font-medium">
                      <td colSpan={4} className="p-2 text-informative">
                        Total ejercicio
                      </td>
                      <td className="p-2 text-right tabular-nums">{formatCurrency(exerciseExpenseTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <p className="p-4 text-informative">
                  Ningún gasto coincide con el filtro. Ajusta ejercicio, emisor o trimestre; si no hay datos, regístralos en el formulario
                  de la derecha.
                </p>
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
                  onChange={(event) => {
                    const issueDate = event.target.value;
                    const nextQuarter = /^\d{4}-\d{2}-\d{2}$/u.test(issueDate)
                      ? accountingQuarterSelectFromIssueDate(issueDate)
                      : "";
                    setDraft((prev) => ({
                      ...prev,
                      issueDate,
                      quarter: nextQuarter,
                    }));
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                  title="Usar la fecha de hoy"
                  aria-label="Poner fecha factura a hoy"
                  onClick={() => {
                    const issueDate = new Date().toISOString().slice(0, 10);
                    setDraft((prev) => ({
                      ...prev,
                      issueDate,
                      quarter: accountingQuarterSelectFromIssueDate(issueDate),
                    }));
                  }}
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
                      disabled={saveCatalogListsMutation.isPending}
                      onClick={() =>
                        mutateCatalogLists({
                          vendors: [...(expenseOptionsQuery.data?.vendors ?? []), String(draft.vendor || "").trim()],
                          categories: expenseOptionsQuery.data?.categories ?? [],
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
                    onClick={() => openExpenseLabelsModal("vendor")}
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
                    onClick={() => openExpenseLabelsModal("category")}
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
                          disabled={saveCatalogListsMutation.isPending}
                          onClick={() =>
                            mutateCatalogLists({
                              vendors: expenseOptionsQuery.data?.vendors ?? [],
                              categories: [
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

      <dialog
        ref={expenseLabelsDialogRef}
        className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-0 shadow-lg backdrop:bg-black/50"
        aria-labelledby="expense-labels-modal-heading"
        onClose={() => {
          setLabelsModalOpen(false);
          dragLabelRef.current = null;
        }}
      >
        {labelsModalOpen ? (
          <div className="flex max-h-[min(90vh,44rem)] flex-col overflow-hidden">
            <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-informative">Etiquetas</p>
                <h2 id="expense-labels-modal-heading" className="text-lg font-semibold tracking-tight">
                  Editar etiquetas de gastos
                </h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                aria-label="Cerrar"
                onClick={() => expenseLabelsDialogRef.current?.close()}
              >
                ×
              </Button>
            </header>

            <div className="grid flex-1 gap-4 overflow-auto p-6 md:grid-cols-2">
              <section className="grid gap-3 rounded-md border border-border p-4">
                <h3 className="text-base font-semibold">Proveedores</h3>
                <div className="grid gap-1">
                  <span className="text-sm text-informative">Nueva etiqueta de proveedor</span>
                  <div className="flex flex-wrap items-stretch gap-2">
                    <Input
                      ref={newVendorInModalRef}
                      className="min-w-0 flex-1"
                      value={newVendorInModal}
                      onChange={(e) => setNewVendorInModal(e.target.value)}
                      placeholder="Añadir proveedor nuevo"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const t = newVendorInModal.trim();
                          if (!t || catalogVendorsDraft.includes(t)) {
                            return;
                          }
                          const next = [...catalogVendorsDraft, t];
                          setCatalogVendorsDraft(next);
                          setNewVendorInModal("");
                          mutateCatalogLists({ vendors: next, categories: catalogCategoriesDraft });
                        }
                      }}
                    />
                    <Button
                      type="button"
                      disabled={saveCatalogListsMutation.isPending}
                      onClick={() => {
                        const t = newVendorInModal.trim();
                        if (!t || catalogVendorsDraft.includes(t)) {
                          return;
                        }
                        const next = [...catalogVendorsDraft, t];
                        setCatalogVendorsDraft(next);
                        setNewVendorInModal("");
                        mutateCatalogLists({ vendors: next, categories: catalogCategoriesDraft });
                      }}
                    >
                      Añadir
                    </Button>
                  </div>
                </div>
                <div
                  className="max-h-64 overflow-auto rounded-md border border-input"
                  onDragOver={(e) => {
                    if (dragLabelRef.current?.list === "vendors") {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }
                  }}
                  onDrop={(e) => handleDropLabelRow("vendors", e)}
                >
                  {catalogVendorsDraft.length === 0 ? (
                    <p className="p-3 text-sm text-informative">No hay etiquetas en esta lista.</p>
                  ) : (
                    catalogVendorsDraft.map((item, i) => (
                      <div
                        key={`v-${i}-${item}`}
                        data-expense-label-row
                        draggable
                        title="Mantén pulsado y arrastra para reordenar"
                        onDragStart={(e) => {
                          if ((e.target as HTMLElement).closest("button")) {
                            e.preventDefault();
                            return;
                          }
                          dragLabelRef.current = { list: "vendors", fromIndex: i };
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", `vendor:${i}`);
                        }}
                        onDragEnd={() => {
                          dragLabelRef.current = null;
                        }}
                        className="flex cursor-grab items-center gap-2 border-b border-border px-2 py-2 text-sm last:border-b-0"
                      >
                        <span aria-hidden className="select-none text-informative">
                          ⠿
                        </span>
                        <span className="min-w-0 flex-1 font-medium">{item}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          draggable={false}
                          className="shrink-0 text-destructive hover:text-destructive"
                          aria-label="Borrar"
                          disabled={saveCatalogListsMutation.isPending}
                          onClick={() => {
                            const next = catalogVendorsDraft.filter((_, j) => j !== i);
                            setCatalogVendorsDraft(next);
                            mutateCatalogLists({ vendors: next, categories: catalogCategoriesDraft });
                          }}
                        >
                          ✕
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="grid gap-3 rounded-md border border-border p-4">
                <h3 className="text-base font-semibold">Conceptos del gasto</h3>
                <div className="grid gap-1">
                  <span className="text-sm text-informative">Nueva etiqueta de concepto</span>
                  <div className="flex flex-wrap items-stretch gap-2">
                    <Input
                      ref={newCategoryInModalRef}
                      className="min-w-0 flex-1"
                      value={newCategoryInModal}
                      onChange={(e) => setNewCategoryInModal(e.target.value)}
                      placeholder="Añadir concepto nuevo"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const t = newCategoryInModal.trim();
                          if (!t || catalogCategoriesDraft.includes(t)) {
                            return;
                          }
                          const next = [...catalogCategoriesDraft, t];
                          setCatalogCategoriesDraft(next);
                          setNewCategoryInModal("");
                          mutateCatalogLists({ vendors: catalogVendorsDraft, categories: next });
                        }
                      }}
                    />
                    <Button
                      type="button"
                      disabled={saveCatalogListsMutation.isPending}
                      onClick={() => {
                        const t = newCategoryInModal.trim();
                        if (!t || catalogCategoriesDraft.includes(t)) {
                          return;
                        }
                        const next = [...catalogCategoriesDraft, t];
                        setCatalogCategoriesDraft(next);
                        setNewCategoryInModal("");
                        mutateCatalogLists({ vendors: catalogVendorsDraft, categories: next });
                      }}
                    >
                      Añadir
                    </Button>
                  </div>
                </div>
                <div
                  className="max-h-64 overflow-auto rounded-md border border-input"
                  onDragOver={(e) => {
                    if (dragLabelRef.current?.list === "categories") {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }
                  }}
                  onDrop={(e) => handleDropLabelRow("categories", e)}
                >
                  {catalogCategoriesDraft.length === 0 ? (
                    <p className="p-3 text-sm text-informative">No hay etiquetas en esta lista.</p>
                  ) : (
                    catalogCategoriesDraft.map((item, i) => (
                      <div
                        key={`c-${i}-${item}`}
                        data-expense-label-row
                        draggable
                        title="Mantén pulsado y arrastra para reordenar"
                        onDragStart={(e) => {
                          if ((e.target as HTMLElement).closest("button")) {
                            e.preventDefault();
                            return;
                          }
                          dragLabelRef.current = { list: "categories", fromIndex: i };
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", `category:${i}`);
                        }}
                        onDragEnd={() => {
                          dragLabelRef.current = null;
                        }}
                        className="flex cursor-grab items-center gap-2 border-b border-border px-2 py-2 text-sm last:border-b-0"
                      >
                        <span aria-hidden className="select-none text-informative">
                          ⠿
                        </span>
                        <span className="min-w-0 flex-1 font-medium">{item}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          draggable={false}
                          className="shrink-0 text-destructive hover:text-destructive"
                          aria-label="Borrar"
                          disabled={saveCatalogListsMutation.isPending}
                          onClick={() => {
                            const next = catalogCategoriesDraft.filter((_, j) => j !== i);
                            setCatalogCategoriesDraft(next);
                            mutateCatalogLists({ vendors: catalogVendorsDraft, categories: next });
                          }}
                        >
                          ✕
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <p
              className={`border-t border-border px-6 py-3 text-sm ${
                labelsModalMessage?.tone === "error"
                  ? "text-red-600"
                  : labelsModalMessage?.tone === "success"
                    ? "text-emerald-600"
                    : "text-informative"
              }`}
            >
              {labelsModalMessage?.text ?? "Arrastra cada fila para reordenar; ✕ borra la etiqueta."}
            </p>

            <div className="border-t border-border px-6 py-3">
              <Button
                type="button"
                variant="outline"
                disabled={saveCatalogListsMutation.isPending}
                onClick={() => expenseLabelsDialogRef.current?.close()}
              >
                Cerrar
              </Button>
            </div>
          </div>
        ) : null}
      </dialog>
    </main>
  );
}

