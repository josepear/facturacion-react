import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm, useFormState, useWatch } from "react-hook-form";

import { calculateTotals } from "@/domain/document/calculateTotals";
import {
  FACTURAR_CLIENT_HISTORY_EMPTY_LIST,
  FACTURAR_CLIENT_HISTORY_NEED_CONFIRM,
  FACTURAR_CLIENT_HISTORY_NEED_NAME,
  facturarClientHistoryCountTip,
} from "@/features/invoices/lib/facturarClientHistoryCopy";
import { createEmptyDocument } from "@/domain/document/defaults";
import { getNextNumber, validateNumberAvailability } from "@/domain/numbering/usecases/getNextNumber";
import { invoiceDocumentSchema } from "@/domain/document/schemas";
import { accountingQuarterSelectFromIssueDate } from "@/domain/accounting/quarter";
import type { CalculatedTotals, InvoiceDocument } from "@/domain/document/types";
import { fetchClients } from "@/infrastructure/api/clientsApi";
import { useSessionQuery } from "@/features/shared/hooks/useSessionQuery";
import { fetchDocumentDetail, fetchRuntimeConfig, saveDocument } from "@/infrastructure/api/documentsApi";
import {
  openOfficialDocumentInNewTab,
  type OfficialDocumentOutputKind,
} from "@/infrastructure/api/openOfficialDocumentOutput";
import { fetchHistoryInvoices } from "@/infrastructure/api/historyApi";
import { mapFormToLegacyDocument, mapLegacyDocumentToForm } from "@/infrastructure/mappers/documentMapper";
import { sameClientName } from "@/lib/clientMatching";

function readStorageScopeForNumbering(): string | undefined {
  try {
    const ls = globalThis.localStorage;
    if (!ls || typeof ls.getItem !== "function") {
      return undefined;
    }
    const scope = ls.getItem("facturacion-storage-scope") ?? "production";
    return scope === "sandbox" ? "sandbox" : undefined;
  } catch {
    return undefined;
  }
}

function readStorageScopeForSave(): "sandbox" | undefined {
  try {
    const ls = globalThis.localStorage;
    if (!ls || typeof ls.getItem !== "function") {
      return undefined;
    }
    return ls.getItem("facturacion-storage-scope") === "sandbox" ? "sandbox" : undefined;
  } catch {
    return undefined;
  }
}

function applyTotals(document: InvoiceDocument): InvoiceDocument {
  const totals = calculateTotals(document);
  return {
    ...document,
    items: totals.items,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    withholdingAmount: totals.withholdingAmount,
    total: totals.total,
  };
}

function totalsAreConsistent(document: InvoiceDocument, totals: CalculatedTotals) {
  const epsilon = 0.005;
  return (
    Math.abs(document.subtotal - totals.subtotal) <= epsilon &&
    Math.abs(document.taxAmount - totals.taxAmount) <= epsilon &&
    Math.abs(document.withholdingAmount - totals.withholdingAmount) <= epsilon &&
    Math.abs(document.total - totals.total) <= epsilon
  );
}

export function useFacturarForm(initialRecordId?: string, initialTemplateProfileId?: string) {
  const [recordIdInput, setRecordIdInput] = useState("");
  const [serverRecordId, setServerRecordId] = useState("");
  const [numberAvailabilityText, setNumberAvailabilityText] = useState("");
  const [numberAvailabilityTone, setNumberAvailabilityTone] = useState<"neutral" | "success" | "error">("neutral");
  const [selectedClientOptionId, setSelectedClientOptionId] = useState("");
  const [selectedHistoryRecordId, setSelectedHistoryRecordId] = useState("");
  const [withoutWithholding, setWithoutWithholding] = useState(true);
  /** Hasta que el usuario elija IRPF o SIN IRPF, Fiscalidad sigue «Pendiente» (IGIC 7% por defecto). */
  const [fiscalIrpfChoiceAcknowledged, setFiscalIrpfChoiceAcknowledged] = useState(false);
  const fiscalIrpfChoiceAcknowledgedRef = useRef(false);
  fiscalIrpfChoiceAcknowledgedRef.current = fiscalIrpfChoiceAcknowledged;

  /** Tras rellenar cliente, «Completo» solo al pulsar Seleccionar (País). */
  const [clientModuleConfirmed, setClientModuleConfirmed] = useState(false);
  const clientModuleConfirmedRef = useRef(false);
  clientModuleConfirmedRef.current = clientModuleConfirmed;

  const [clientMoreDetailsOpen, setClientMoreDetailsOpen] = useState(false);
  const [officialOutputError, setOfficialOutputError] = useState<string | null>(null);
  const [officialOutputLoading, setOfficialOutputLoading] = useState<OfficialDocumentOutputKind | null>(null);
  /** Se incrementa al guardar o cargar un documento para refrescar la vista HTML incrustada en Facturar. */
  const [officialHtmlPreviewVersion, setOfficialHtmlPreviewVersion] = useState(0);
  /** Se incrementa solo tras un guardado OK para que FacturarPage restablezca acordeones y scroll del flujo. */
  const [workflowLayoutResetVersion, setWorkflowLayoutResetVersion] = useState(0);
  const [hasLastSetup, setHasLastSetup] = useState(false);
  const bootstrappedRecordIdRef = useRef("");
  const bootstrappedTemplateProfileRef = useRef("");
  const lastSavedSnapshotRef = useRef<InvoiceDocument | null>(null);
  const previousTotalsBasisRef = useRef<InvoiceDocument["totalsBasis"] | undefined>(undefined);

  const form = useForm<InvoiceDocument>({
    resolver: zodResolver(invoiceDocumentSchema),
    defaultValues: applyTotals(createEmptyDocument()),
    mode: "onBlur",
  });

  const itemsArray = useFieldArray({
    control: form.control,
    name: "items",
  });

  const configQuery = useQuery({
    queryKey: ["runtime-config"],
    queryFn: fetchRuntimeConfig,
  });

  const sessionQuery = useSessionQuery();

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients,
  });

  const historyQuery = useQuery({
    queryKey: ["history-invoices"],
    queryFn: fetchHistoryInvoices,
  });

  useEffect(() => {
    if (String(selectedClientOptionId || "").trim()) {
      setClientMoreDetailsOpen(true);
    }
  }, [selectedClientOptionId]);

  const issueDateForQuarter = useWatch({ control: form.control, name: "issueDate" });

  useEffect(() => {
    const iso = String(issueDateForQuarter || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(iso)) {
      return;
    }
    const nextQ = accountingQuarterSelectFromIssueDate(iso);
    if (!nextQ) {
      return;
    }
    const current = String(form.getValues("accounting.quarter") || "").trim();
    if (current === nextQ) {
      return;
    }
    form.setValue("accounting.quarter", nextQ, {
      shouldDirty: Boolean(current),
      shouldValidate: true,
    });
  }, [issueDateForQuarter, form]);

  const watched = useWatch({ control: form.control });
  const { dirtyFields } = useFormState({ control: form.control });

  useEffect(() => {
    const b = watched.totalsBasis === "gross" ? "gross" : "items";
    const prev = previousTotalsBasisRef.current;
    previousTotalsBasisRef.current = b;
    if (prev !== undefined && b === "gross" && prev !== "gross") {
      form.setValue("manualGrossSubtotal", 0, { shouldDirty: true, shouldValidate: true });
    }
  }, [watched.totalsBasis, form]);

  useEffect(() => {
    if (String(serverRecordId || "").trim()) {
      return;
    }
    if (dirtyFields.number) {
      return;
    }
    const profileId = String(watched.templateProfileId || "").trim();
    const layout = String(watched.templateLayout || "").trim();
    if (!profileId || !layout) {
      return;
    }
    if (!configQuery.data) {
      return;
    }
    const issueDate = String(watched.issueDate || "").trim();
    if (!issueDate) {
      return;
    }
    if (watched.type !== "factura" && watched.type !== "presupuesto") {
      return;
    }
    const invoiceNumberTag = String(
      configQuery.data.templateProfiles?.find((p) => p.id === profileId)?.invoiceNumberTag || "",
    ).trim();
    if (!invoiceNumberTag) {
      return;
    }

    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (form.getFieldState("number").isDirty) {
            return;
          }
          const docType = watched.type === "presupuesto" ? "presupuesto" : "factura";
          const number = await getNextNumber({
            type: docType,
            issueDate,
            series: String(watched.series || "").trim(),
            templateProfileId: profileId,
            recordId: undefined,
            storageScope: readStorageScopeForNumbering(),
            invoiceNumberTag,
          });
          if (!form.getFieldState("number").isDirty) {
            form.setValue("number", number, { shouldDirty: false, shouldValidate: true });
          }
        } catch {
          // Sin sesión o API: no bloquear el formulario.
        }
      })();
    }, 280);
    return () => clearTimeout(timer);
  }, [
    serverRecordId,
    dirtyFields.number,
    watched.templateProfileId,
    watched.templateLayout,
    watched.issueDate,
    watched.type,
    watched.series,
    configQuery.data,
    form,
  ]);

  const liveDocument = useMemo(
    () => applyTotals(mapLegacyDocumentToForm(watched)),
    [watched],
  );
  const totals = useMemo(
    () =>
      calculateTotals({
        items: (watched.items ?? []).map((item) => ({
          concept: String(item.concept ?? ""),
          description: String(item.description ?? ""),
          quantity: item.quantity ?? 0,
          unitPrice: item.unitPrice ?? 0,
          lineTotal: item.lineTotal,
          unitLabel: item.unitLabel,
          hidePerPersonSubtotalInBudget: item.hidePerPersonSubtotalInBudget,
        })),
        totalsBasis: watched.totalsBasis ?? "items",
        manualGrossSubtotal: watched.manualGrossSubtotal ?? 0,
        taxRate: watched.taxRate ?? 0,
        withholdingRate: watched.withholdingRate ?? "",
      }),
    [watched.items, watched.manualGrossSubtotal, watched.taxRate, watched.totalsBasis, watched.withholdingRate],
  );
  const taxValidation = useMemo(() => {
    const taxRate = Number(watched.taxRate ?? 0);
    const taxValid = Number.isFinite(taxRate) && taxRate >= 0;

    const withholdingValue = watched.withholdingRate;
    const withholdingNumeric = typeof withholdingValue === "number" ? withholdingValue : null;
    const withholdingSyntaxValid =
      withholdingValue === "" || withholdingNumeric === 15 || withholdingNumeric === 19 || withholdingNumeric === 21;
    const withholdingMode = withholdingValue === "" ? "sin_irpf" : `irpf_${withholdingValue}`;

    const isReady = taxValid && fiscalIrpfChoiceAcknowledged && withholdingSyntaxValid;

    return {
      igicValid: taxValid,
      irpfValid: withholdingSyntaxValid,
      withholdingMode,
      fiscalIrpfChoiceAcknowledged,
      irpfChoicePending: !fiscalIrpfChoiceAcknowledged,
      isReady,
      tip: !taxValid
        ? "Indica un IGIC válido."
        : !fiscalIrpfChoiceAcknowledged
          ? "Elige retención IRPF (15%, 19%, 21%) o marca SIN IRPF."
          : !withholdingSyntaxValid
            ? "Indica un IRPF válido (15%, 19%, 21%) o SIN IRPF."
            : "Fiscalidad lista.",
    };
  }, [watched.taxRate, watched.withholdingRate, fiscalIrpfChoiceAcknowledged]);

  const historyOptions = useMemo(
    () =>
      (historyQuery.data ?? [])
        .slice()
        .sort((left, right) => String(right.savedAt || right.issueDate).localeCompare(String(left.savedAt || left.issueDate)))
        .slice(0, 100)
        .map((item) => {
          const issueDate = String(item.issueDate || "").trim();
          const dateLabel = issueDate || "sin fecha";
          const numberLabel = String(item.number || "").trim() || "sin número";
          const clientLabel = String(item.clientName || "").trim() || "sin cliente";
          const typeLabel = String(item.typeLabel || item.type || "").trim();
          const totalLabel = Number.isFinite(Number(item.total))
            ? Number(item.total).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "";
          return {
            recordId: item.recordId,
            type: item.type,
            issueDate,
            label: `${numberLabel} · ${clientLabel} · ${dateLabel}${typeLabel ? ` · ${typeLabel}` : ""}${totalLabel ? ` · ${totalLabel} €` : ""}`,
          };
        }),
    [historyQuery.data],
  );

  /** Facturas/presupuestos guardados cuyo cliente coincide con el del borrador (sin filtros manuales). */
  const clientHistoryOptions = useMemo(() => {
    const name = String(watched.client?.name || "").trim();
    if (!name) {
      return [];
    }
    return (historyQuery.data ?? [])
      .filter(
        (item) =>
          (item.type === "factura" || item.type === "presupuesto") &&
          sameClientName(String(item.clientName || ""), name),
      )
      .slice()
      .sort((left, right) => String(right.savedAt || right.issueDate).localeCompare(String(left.savedAt || left.issueDate)))
      .slice(0, 100)
      .map((item) => {
        const issueDate = String(item.issueDate || "").trim();
        const dateLabel = issueDate || "sin fecha";
        const numberLabel = String(item.number || "").trim() || "sin número";
        const clientLabel = String(item.clientName || "").trim() || "sin cliente";
        const typeLabel = String(item.typeLabel || item.type || "").trim();
        const totalLabel = Number.isFinite(Number(item.total))
          ? Number(item.total).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : "";
        const totalNum = Number(item.total);
        const totalAmount = Number.isFinite(totalNum) ? totalNum : null;
        return {
          recordId: item.recordId,
          type: item.type,
          issueDate,
          number: numberLabel,
          typeLabel: typeLabel || (item.type === "presupuesto" ? "Presupuesto" : "Factura"),
          totalAmount,
          label: `${numberLabel} · ${clientLabel} · ${dateLabel}${typeLabel ? ` · ${typeLabel}` : ""}${totalLabel ? ` · ${totalLabel} €` : ""}`,
        };
      });
  }, [historyQuery.data, watched.client?.name]);

  useEffect(() => {
    const sel = String(selectedHistoryRecordId || "").trim();
    if (!sel) {
      return;
    }
    const ok = clientHistoryOptions.some((o) => o.recordId === sel);
    if (!ok) {
      setSelectedHistoryRecordId("");
    }
  }, [clientHistoryOptions, selectedHistoryRecordId]);

  const workflowChecklist = useMemo(() => {
    const hasTemplateProfile = Boolean(String(watched.templateProfileId || "").trim());
    const hasTemplateLayout = Boolean(String(watched.templateLayout || "").trim());
    const hasPaymentMethod = Boolean(String(watched.paymentMethod || "").trim());
    const hasBankAccount = Boolean(String(watched.bankAccount || "").trim());
    const emitterComplete = hasTemplateProfile && hasTemplateLayout && hasPaymentMethod && hasBankAccount;

    const documentTypeReady = watched.type === "factura" || watched.type === "presupuesto";
    const accountingStatusReady =
      watched.accounting?.status === "ENVIADA" ||
      watched.accounting?.status === "COBRADA" ||
      watched.accounting?.status === "CANCELADA";

    const documentComplete =
      documentTypeReady &&
      accountingStatusReady &&
      Boolean(String(watched.number || "").trim()) &&
      Boolean(String(watched.issueDate || "").trim());

    const hasClientName = Boolean(String(watched.client?.name || "").trim());
    const clientComplete = hasClientName && clientModuleConfirmed;

    const hasConceptItems = (watched.items ?? []).some((item) => String(item.concept || "").trim() || String(item.description || "").trim());
    const conceptsComplete = hasConceptItems;

    const fiscalComplete = taxValidation.isReady;
    const saveComplete = emitterComplete && documentComplete && clientComplete && conceptsComplete && fiscalComplete;

    return {
      emitter: {
        complete: emitterComplete,
        tip: emitterComplete
          ? "Emisor, plantilla, pago y cuenta listos."
          : "Elige emisor, plantilla/layout (obligatorio), y revisa forma de pago y cuenta.",
      },
      document: {
        complete: documentComplete,
        tip: documentComplete
          ? "Datos base de documento completos."
          : !documentTypeReady
            ? "Elige tipo de documento (factura o presupuesto)."
            : !accountingStatusReady
              ? "Elige estado contable."
              : "Faltan número o fecha de emisión.",
      },
      client: {
        complete: clientComplete,
        tip: !hasClientName
          ? "Añade al menos nombre o razón social."
          : !clientModuleConfirmed
            ? "Revisa los datos del cliente y pulsa Seleccionar junto a País (código)."
            : "Cliente listo para facturar.",
      },
      concepts: {
        complete: conceptsComplete,
        tip:
          watched.totalsBasis === "gross"
            ? (conceptsComplete
                ? "Modo bruto: totales calculados automáticamente desde las líneas."
                : "En bruto, añade al menos una línea con concepto o descripción.")
            : (conceptsComplete ? "Conceptos listos por líneas." : "Añade al menos una línea con concepto o descripción."),
      },
      fiscal: {
        complete: fiscalComplete,
        tip: taxValidation.tip,
      },
      history: {
        complete: true,
        tip: !hasClientName
          ? FACTURAR_CLIENT_HISTORY_NEED_NAME
          : !clientModuleConfirmed
            ? FACTURAR_CLIENT_HISTORY_NEED_CONFIRM
            : clientHistoryOptions.length > 0
              ? facturarClientHistoryCountTip(clientHistoryOptions.length)
              : FACTURAR_CLIENT_HISTORY_EMPTY_LIST,
      },
      save: {
        complete: saveComplete,
        tip: saveComplete ? "Todo listo para guardar." : "Completa los módulos pendientes antes de guardar.",
      },
    };
  }, [
    taxValidation.isReady,
    taxValidation.tip,
    watched.accounting?.status,
    watched.type,
    watched.client?.name,
    clientModuleConfirmed,
    watched.issueDate,
    watched.items,
    watched.number,
    watched.paymentMethod,
    watched.bankAccount,
    watched.templateProfileId,
    watched.templateLayout,
    watched.totalsBasis,
    clientHistoryOptions.length,
  ]);

  const profileOptions = useMemo(
    () =>
      (configQuery.data?.templateProfiles ?? []).map((profile) => ({
        id: profile.id,
        label: profile.label || profile.id,
        colorKey: profile.colorKey,
      })),
    [configQuery.data?.templateProfiles],
  );

  const activeTemplateProfileId = String(configQuery.data?.activeTemplateProfileId || "").trim();
  const selectedTemplateProfileId = String(watched.templateProfileId || "").trim();
  const effectiveTemplateProfileId = selectedTemplateProfileId || activeTemplateProfileId;

  const selectedProfile = useMemo(
    () => (configQuery.data?.templateProfiles ?? []).find((profile) => profile.id === effectiveTemplateProfileId) || null,
    [configQuery.data?.templateProfiles, effectiveTemplateProfileId],
  );

  const clientOptions = useMemo(
    () =>
      (clientsQuery.data ?? []).map((client, index) => {
        const optionId = String(client.recordId || "").trim() || `client-${index}`;
        const taxLabel = String(client.taxId || "").trim();
        const label = taxLabel ? `${client.name} · ${taxLabel}` : client.name;
        return {
          optionId,
          label,
          client,
        };
      }),
    [clientsQuery.data],
  );

  const profileIdForReload = String(watched.templateProfileId || "").trim();
  const profileDocumentReloadOptions = useMemo(() => {
    if (!profileIdForReload) {
      return [];
    }
    return (historyQuery.data ?? [])
      .filter(
        (item) =>
          String(item.templateProfileId || "").trim() === profileIdForReload &&
          (item.type === "factura" || item.type === "presupuesto"),
      )
      .slice()
      .sort((left, right) => String(right.savedAt || right.issueDate).localeCompare(String(left.savedAt || left.issueDate)))
      .map((item) => {
        const issueDate = String(item.issueDate || "").trim();
        const dateLabel = issueDate || "sin fecha";
        const numberLabel = String(item.number || "").trim() || "sin número";
        const clientLabel = String(item.clientName || "").trim() || "sin cliente";
        const typeLabel = String(item.typeLabel || item.type || "").trim();
        const totalLabel = Number.isFinite(Number(item.total))
          ? Number(item.total).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : "";
        return {
          recordId: item.recordId,
          label: `${numberLabel} · ${clientLabel} · ${dateLabel}${typeLabel ? ` · ${typeLabel}` : ""}${totalLabel ? ` · ${totalLabel} €` : ""}`,
        };
      });
  }, [historyQuery.data, profileIdForReload]);

  const ensureDefaults = () => {
    const current = form.getValues();
    const next = applyTotals(
      mapLegacyDocumentToForm({
        ...current,
        templateProfileId: String(current.templateProfileId || "").trim(),
        tenantId:
          current.tenantId
          || (sessionQuery.data?.authenticated ? sessionQuery.data.user.tenantId : undefined)
          || "default",
      }),
    );
    form.reset(next);
  };

  const applyTemplateProfile = (profileIdRaw: string) => {
    const profileId = String(profileIdRaw || "").trim();
    form.setValue("templateProfileId", profileId, { shouldDirty: true, shouldValidate: true });

    const profile = (configQuery.data?.templateProfiles ?? []).find((item) => item.id === profileId);
    if (!profile) {
      if (!profileId) {
        form.setValue("templateLayout", "", { shouldDirty: true, shouldValidate: true });
      }
      form.setValue("withholdingRate", "", { shouldDirty: true, shouldValidate: true });
      setWithoutWithholding(true);
      setFiscalIrpfChoiceAcknowledged(false);
      return;
    }

    // Plantilla/layout solo la elige el usuario en el desplegable (no se rellena desde el perfil).
    form.setValue("templateLayout", "", { shouldDirty: true, shouldValidate: true });

    const profilePayment = String(profile.defaults?.paymentMethod || "").trim();
    if (profilePayment) {
      form.setValue("paymentMethod", profilePayment, { shouldDirty: true, shouldValidate: true });
    }

    const profileBank = String(profile.business?.bankAccount || "").trim();
    if (profileBank) {
      form.setValue("bankAccount", profileBank, { shouldDirty: true, shouldValidate: true });
    }

    // IGIC/IRPF no se heredan del perfil: IGIC por defecto 7% en documento vacío; IRPF hasta que el usuario elija.
    form.setValue("withholdingRate", "", { shouldDirty: true, shouldValidate: true });
    setWithoutWithholding(true);
    setFiscalIrpfChoiceAcknowledged(false);
  };

  const applyWithholdingMode = (mode: "sin_irpf" | "irpf_15" | "irpf_19" | "irpf_21") => {
    if (mode === "sin_irpf") {
      setWithoutWithholding(true);
      form.setValue("withholdingRate", "", { shouldDirty: true, shouldValidate: true });
      setFiscalIrpfChoiceAcknowledged(true);
      return;
    }

    const value = mode === "irpf_15" ? 15 : mode === "irpf_19" ? 19 : 21;
    setWithoutWithholding(false);
    form.setValue("withholdingRate", value, { shouldDirty: true, shouldValidate: true });
    setFiscalIrpfChoiceAcknowledged(true);
  };

  const commitFiscalIrpfChoiceFromInput = useCallback(() => {
    const v = form.getValues("withholdingRate");
    if (v === "" || v === 15 || v === 19 || v === 21) {
      setFiscalIrpfChoiceAcknowledged(true);
    }
  }, [form]);

  const suggestNumberMutation = useMutation({
    mutationFn: async () => {
      ensureDefaults();
      const draft = form.getValues();
      if (draft.type !== "factura" && draft.type !== "presupuesto") {
        throw new Error("Selecciona factura o presupuesto antes de pedir el número.");
      }
      if (!draft.templateProfileId) {
        throw new Error("Selecciona emisor antes de pedir el número.");
      }
      const profileMeta = (configQuery.data?.templateProfiles ?? []).find((p) => p.id === draft.templateProfileId);
      const invoiceNumberTag = String(profileMeta?.invoiceNumberTag || "").trim() || undefined;
      const number = await getNextNumber({
        type: draft.type,
        issueDate: draft.issueDate,
        series: draft.series,
        templateProfileId: draft.templateProfileId,
        recordId: serverRecordId || undefined,
        storageScope: readStorageScopeForNumbering(),
        invoiceNumberTag,
      });
      form.setValue("number", number, { shouldDirty: true, shouldValidate: true });
      return number;
    },
    onSuccess: () => {
      setNumberAvailabilityText("Número sugerido desde el servidor.");
      setNumberAvailabilityTone("neutral");
    },
  });

  const checkAvailabilityMutation = useMutation({
    mutationFn: async () => {
      const draft = form.getValues();
      if (draft.type !== "factura" && draft.type !== "presupuesto") {
        throw new Error("Selecciona factura o presupuesto para validar el número.");
      }
      if (!draft.templateProfileId) {
        throw new Error("Selecciona emisor para validar número.");
      }
      const profileMeta = (configQuery.data?.templateProfiles ?? []).find((p) => p.id === draft.templateProfileId);
      const invoiceNumberTag = String(profileMeta?.invoiceNumberTag || "").trim() || undefined;
      const payload = await validateNumberAvailability({
        number: draft.number,
        type: draft.type,
        issueDate: draft.issueDate,
        series: draft.series,
        templateProfileId: draft.templateProfileId,
        recordId: serverRecordId || undefined,
        storageScope: readStorageScopeForNumbering(),
        invoiceNumberTag,
      });
      return payload;
    },
    onSuccess: (payload) => {
      if (payload.available) {
        setNumberAvailabilityText(`Número disponible${payload.canonicalNumber ? ` (${payload.canonicalNumber})` : ""}.`);
        setNumberAvailabilityTone("success");
      } else {
        setNumberAvailabilityText(payload.error || "Número no disponible.");
        setNumberAvailabilityTone("error");
      }
    },
  });

  const syncSelectedClientOptionByName = (clientNameRaw: string) => {
    const safeName = String(clientNameRaw || "").trim();
    if (!safeName) {
      setSelectedClientOptionId("");
      return;
    }
    const matched = clientOptions.find((option) => sameClientName(option.client.name || "", safeName));
    setSelectedClientOptionId(matched?.optionId || "");
  };

  const saveMutation = useMutation({
    mutationFn: async (values: InvoiceDocument) => {
      if (!fiscalIrpfChoiceAcknowledgedRef.current) {
        throw new Error("En Fiscalidad elige retención IRPF o marca SIN IRPF.");
      }
      const normalized = applyTotals(mapFormToLegacyDocument(values));
      if (!normalized.client.name.trim()) {
        throw new Error("Cliente obligatorio.");
      }
      if (!clientModuleConfirmedRef.current) {
        throw new Error("En Cliente pulsa Seleccionar junto a País (código).");
      }
      if (!normalized.items.some((item) => item.concept.trim() || item.description.trim())) {
        throw new Error("Añade al menos una línea con concepto o descripción.");
      }
      if (!totalsAreConsistent(normalized, calculateTotals(normalized))) {
        throw new Error("Los totales no son coherentes. Revisa líneas e impuestos.");
      }
      return saveDocument(normalized, serverRecordId || undefined, readStorageScopeForSave());
    },
    onSuccess: ({ recordId, document }) => {
      const mapped = applyTotals(mapLegacyDocumentToForm(document));
      setServerRecordId(recordId);
      setOfficialHtmlPreviewVersion((v) => v + 1);
      setOfficialOutputError(null);
      form.reset(mapped);
      lastSavedSnapshotRef.current = mapped;
      const snap = mapped;
      const hasClient = Boolean(snap.client?.name?.trim() || snap.client?.taxId?.trim());
      const hasItems =
        Array.isArray(snap.items) && snap.items.some((item) => String(item.concept || item.description || "").trim());
      setHasLastSetup(hasClient || hasItems);
      syncSelectedClientOptionByName(mapped.client?.name || "");
      setNumberAvailabilityText("Guardado correcto.");
      setNumberAvailabilityTone("success");
      setFiscalIrpfChoiceAcknowledged(true);
      setClientModuleConfirmed(true);
      setWorkflowLayoutResetVersion((v) => v + 1);
    },
  });

  const loadMutation = useMutation({
    mutationFn: async (rawRecordId: string) => {
      const safe = rawRecordId.trim();
      if (!safe) {
        throw new Error("Introduce un recordId para recargar.");
      }
      return fetchDocumentDetail(safe);
    },
    onSuccess: ({ recordId, document }) => {
      const mapped = applyTotals(mapLegacyDocumentToForm(document));
      setServerRecordId(recordId);
      setOfficialHtmlPreviewVersion((v) => v + 1);
      setOfficialOutputError(null);
      setRecordIdInput(recordId);
      setSelectedHistoryRecordId(recordId);
      form.reset(mapped);
      syncSelectedClientOptionByName(mapped.client?.name || "");
      setNumberAvailabilityText("Documento recargado.");
      setNumberAvailabilityTone("neutral");
      setFiscalIrpfChoiceAcknowledged(true);
      setClientModuleConfirmed(true);
    },
  });

  useEffect(() => {
    const safeInitial = String(initialRecordId || "").trim();
    if (!safeInitial) {
      return;
    }
    if (bootstrappedRecordIdRef.current === safeInitial) {
      return;
    }
    if (loadMutation.isPending) {
      return;
    }
    bootstrappedRecordIdRef.current = safeInitial;
    loadMutation.mutate(safeInitial);
  }, [initialRecordId, loadMutation]);

  useEffect(() => {
    const safeProfileId = String(initialTemplateProfileId || "").trim();
    if (!safeProfileId) {
      return;
    }
    if (bootstrappedTemplateProfileRef.current === safeProfileId) {
      return;
    }
    if (!configQuery.data) {
      return;
    }
    const profile = (configQuery.data.templateProfiles ?? []).find((item) => item.id === safeProfileId);
    if (!profile) {
      return;
    }
    if (serverRecordId) {
      return;
    }
    bootstrappedTemplateProfileRef.current = safeProfileId;
    form.setValue("templateProfileId", safeProfileId, { shouldDirty: false, shouldValidate: true });
    const profilePayment = String(profile.defaults?.paymentMethod || "").trim();
    if (profilePayment) {
      form.setValue("paymentMethod", profilePayment, { shouldDirty: false, shouldValidate: true });
    }
    const profileBank = String(profile.business?.bankAccount || "").trim();
    if (profileBank) {
      form.setValue("bankAccount", profileBank, { shouldDirty: false, shouldValidate: true });
    }
    form.setValue("withholdingRate", "", { shouldDirty: false, shouldValidate: true });
    setWithoutWithholding(true);
    setFiscalIrpfChoiceAcknowledged(false);
  }, [initialTemplateProfileId, configQuery.data, serverRecordId, form]);

  const replaceClientData = (selected: (typeof clientOptions)[number]["client"]) => {
    form.setValue("client.name", selected.name || "", { shouldDirty: true, shouldValidate: true });
    form.setValue("client.taxId", selected.taxId || "", { shouldDirty: true, shouldValidate: true });
    form.setValue("client.address", selected.address || "", { shouldDirty: true, shouldValidate: true });
    form.setValue("client.city", selected.city || "", { shouldDirty: true, shouldValidate: true });
    form.setValue("client.province", selected.province || "", { shouldDirty: true, shouldValidate: true });
    form.setValue("client.taxCountryCode", selected.taxCountryCode || "ES", { shouldDirty: true, shouldValidate: true });
    form.setValue("client.taxIdType", selected.taxIdType || "", { shouldDirty: true, shouldValidate: true });
    form.setValue("client.email", selected.email || "", { shouldDirty: true, shouldValidate: true });
    form.setValue("client.contactPerson", selected.contactPerson || "", { shouldDirty: true, shouldValidate: true });
  };

  const clearClientData = () => {
    setSelectedClientOptionId("");
    setClientModuleConfirmed(false);
    setClientMoreDetailsOpen(false);
    form.setValue("client.name", "", { shouldDirty: true, shouldValidate: true });
    form.setValue("client.taxId", "", { shouldDirty: true, shouldValidate: true });
    form.setValue("client.address", "", { shouldDirty: true, shouldValidate: true });
    form.setValue("client.city", "", { shouldDirty: true, shouldValidate: true });
    form.setValue("client.province", "", { shouldDirty: true, shouldValidate: true });
    form.setValue("client.taxCountryCode", "ES", { shouldDirty: true, shouldValidate: true });
    form.setValue("client.taxIdType", "", { shouldDirty: true, shouldValidate: true });
    form.setValue("client.email", "", { shouldDirty: true, shouldValidate: true });
    form.setValue("client.contactPerson", "", { shouldDirty: true, shouldValidate: true });
  };

  const applyClientByOptionId = (optionId: string) => {
    const safeOptionId = String(optionId || "").trim();
    setSelectedClientOptionId(safeOptionId);

    if (!safeOptionId) {
      clearClientData();
      return;
    }

    const selected = clientOptions.find((option) => option.optionId === safeOptionId)?.client;
    if (!selected) {
      setClientModuleConfirmed(false);
      return;
    }

    replaceClientData(selected);
    setClientModuleConfirmed(false);
  };

  const applyClientByName = (name: string) => {
    const safeName = String(name || "").trim();
    if (!safeName) {
      return;
    }
    const selectedOption = clientOptions.find((option) => sameClientName(option.client.name || "", safeName));
    if (!selectedOption) {
      return;
    }
    setSelectedClientOptionId(selectedOption.optionId);
    replaceClientData(selectedOption.client);
    setClientModuleConfirmed(false);
  };

  const confirmClientModule = useCallback(() => {
    setClientModuleConfirmed(true);
    setClientMoreDetailsOpen(false);
  }, []);

  const submit = form.handleSubmit(async (values) => {
    await saveMutation.mutateAsync(values as InvoiceDocument);
  });

  const loadBySelectedHistory = () => {
    const safeRecordId = String(selectedHistoryRecordId || "").trim();
    if (!safeRecordId) {
      return;
    }
    loadMutation.mutate(safeRecordId);
  };

  const openOfficialOutput = useCallback(
    async (kind: OfficialDocumentOutputKind) => {
      const id = String(serverRecordId || "").trim();
      if (!id) {
        return;
      }
      setOfficialOutputError(null);
      setOfficialOutputLoading(kind);
      try {
        const result = await openOfficialDocumentInNewTab(id, kind);
        if (!result.ok) {
          setOfficialOutputError(result.message);
        }
      } finally {
        setOfficialOutputLoading(null);
      }
    },
    [serverRecordId],
  );

  const duplicateDocument = () => {
    const wasAck = fiscalIrpfChoiceAcknowledgedRef.current;
    const wasClientConfirm = clientModuleConfirmedRef.current;
    const current = form.getValues();
    const copy = { ...current, number: "" };
    setServerRecordId("");
    setRecordIdInput("");
    setSelectedHistoryRecordId("");
    setOfficialOutputError(null);
    form.reset(copy);
    setFiscalIrpfChoiceAcknowledged(wasAck);
    setClientModuleConfirmed(wasClientConfirm);
    setNumberAvailabilityText("Copia lista. Edita el número y guarda para crear nuevo documento.");
    setNumberAvailabilityTone("neutral");
  };

  const repeatLastSetup = () => {
    const snap = lastSavedSnapshotRef.current;
    if (!snap) {
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const copy: InvoiceDocument = {
      ...snap,
      number: "",
      numberEnd: "",
      issueDate: today,
      dueDate: "",
      reference: "",
      accounting: { ...snap.accounting, status: "ENVIADA" },
    };
    setServerRecordId("");
    setRecordIdInput("");
    setSelectedHistoryRecordId("");
    setOfficialOutputError(null);
    form.reset(copy);
    setFiscalIrpfChoiceAcknowledged(true);
    setClientModuleConfirmed(true);
    setNumberAvailabilityText("Factura repetitiva lista. Revisa y guarda.");
    setNumberAvailabilityTone("neutral");
  };

  return {
    form,
    submit,
    totals,
    itemsArray,
    profileOptions,
    selectedProfile,
    activeTemplateProfileId,
    applyTemplateProfile,
    duplicateDocument,
    hasLastSetup,
    repeatLastSetup,
    taxValidation,
    withoutWithholding,
    setWithoutWithholding,
    applyWithholdingMode,
    commitFiscalIrpfChoiceFromInput,
    workflowChecklist,
    clientOptions,
    clients: clientsQuery.data ?? [],
    ensureDefaults,
    applyClientByName,
    applyClientByOptionId,
    clearClientData,
    selectedClientOptionId,
    clientMoreDetailsOpen,
    setClientMoreDetailsOpen,
    confirmClientModule,
    suggestNumber: () => suggestNumberMutation.mutate(),
    checkNumberAvailability: () => checkAvailabilityMutation.mutate(),
    saveMutation,
    loadMutation,
    suggestNumberMutation,
    checkAvailabilityMutation,
    numberAvailabilityText,
    numberAvailabilityTone,
    recordIdInput,
    setRecordIdInput,
    loadByRecordId: () => loadMutation.mutate(recordIdInput),
    profileDocumentReloadOptions,
    historyOptions,
    clientHistoryOptions,
    selectedHistoryRecordId,
    setSelectedHistoryRecordId,
    loadBySelectedHistory,
    loadingHistory: historyQuery.isLoading,
    totalHistoryCount: historyQuery.data?.length ?? 0,
    serverRecordId,
    openOfficialOutput,
    officialOutputError,
    officialOutputLoading,
    canOpenOfficialOutput: Boolean(serverRecordId),
    officialHtmlPreviewVersion,
    workflowLayoutResetVersion,
    loadingConfig: configQuery.isLoading,
    liveDocument,
    isDirty: form.formState.isDirty,
  };
}
