import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { calculateTotals } from "@/domain/document/calculateTotals";
import { createEmptyDocument } from "@/domain/document/defaults";
import { getNextNumber, validateNumberAvailability } from "@/domain/numbering/usecases/getNextNumber";
import { invoiceDocumentSchema } from "@/domain/document/schemas";
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
  const [numberAvailabilityText, setNumberAvailabilityText] = useState("Pendiente de validar número.");
  const [numberAvailabilityTone, setNumberAvailabilityTone] = useState<"neutral" | "success" | "error">("neutral");
  const [selectedClientOptionId, setSelectedClientOptionId] = useState("");
  const [selectedHistoryRecordId, setSelectedHistoryRecordId] = useState("");
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [withoutWithholding, setWithoutWithholding] = useState(true);
  const [officialOutputError, setOfficialOutputError] = useState<string | null>(null);
  const [officialOutputLoading, setOfficialOutputLoading] = useState<OfficialDocumentOutputKind | null>(null);
  const bootstrappedRecordIdRef = useRef("");
  const bootstrappedTemplateProfileRef = useRef("");

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

  const watched = useWatch({ control: form.control });
  const liveDocument = useMemo(
    () => applyTotals(mapLegacyDocumentToForm(watched)),
    [watched],
  );
  const totals = useMemo(
    () =>
      calculateTotals({
        items: (watched.items ?? []).map((item) => ({
          concept: item.concept ?? "",
          description: item.description ?? "",
          quantity: item.quantity ?? 0,
          unitPrice: item.unitPrice ?? 0,
          lineTotal: item.lineTotal,
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
    const withholdingValid = withholdingValue === "" || withholdingNumeric === 15 || withholdingNumeric === 19 || withholdingNumeric === 21;
    const withholdingMode = withholdingValue === "" ? "sin_irpf" : `irpf_${withholdingValue}`;

    return {
      igicValid: taxValid,
      irpfValid: withholdingValid,
      withholdingMode,
      isReady: taxValid && withholdingValid,
      tip: !taxValid
        ? "Indica un IGIC válido."
        : !withholdingValid
          ? "Elige IRPF 15%, 19%, 21% o SIN IRPF."
          : "Fiscalidad lista.",
    };
  }, [watched.taxRate, watched.withholdingRate]);

  const workflowChecklist = useMemo(() => {
    const hasTemplateProfile = Boolean(String(watched.templateProfileId || "").trim());
    const hasPaymentMethod = Boolean(String(watched.paymentMethod || "").trim());
    const hasBankAccount = Boolean(String(watched.bankAccount || "").trim());
    const emitterComplete = hasTemplateProfile && hasPaymentMethod && hasBankAccount;

    const accountingStatus = String(watched.accounting?.status || "").trim();

    const documentComplete =
      Boolean(String(watched.type || "").trim()) &&
      Boolean(String(watched.number || "").trim()) &&
      Boolean(String(watched.issueDate || "").trim()) &&
      Boolean(accountingStatus);

    const clientComplete = Boolean(String(watched.client?.name || "").trim());

    const hasConceptItems = (watched.items ?? []).some((item) => String(item.concept || "").trim() || String(item.description || "").trim());
    const conceptsComplete = watched.totalsBasis === "gross"
      ? Number(watched.manualGrossSubtotal || 0) > 0 && hasConceptItems
      : hasConceptItems;

    const fiscalComplete = taxValidation.isReady;
    const saveComplete = emitterComplete && documentComplete && clientComplete && conceptsComplete && fiscalComplete;

    return {
      emitter: {
        complete: emitterComplete,
        tip: emitterComplete ? "Perfil y defaults de emisor listos." : "Elige perfil y revisa forma de pago/cuenta.",
      },
      document: {
        complete: documentComplete,
        tip: documentComplete ? "Datos base de documento completos." : "Faltan tipo, número, fecha o estado.",
      },
      client: {
        complete: clientComplete,
        tip: clientComplete ? "Cliente listo para facturar." : "Añade al menos nombre o razón social.",
      },
      concepts: {
        complete: conceptsComplete,
        tip:
          watched.totalsBasis === "gross"
            ? (conceptsComplete ? "Modo bruto listo: base manual y líneas con concepto." : "En bruto, indica base manual y al menos una línea.")
            : (conceptsComplete ? "Conceptos listos por líneas." : "Añade al menos una línea con concepto o descripción."),
      },
      fiscal: {
        complete: fiscalComplete,
        tip: taxValidation.tip,
      },
      history: {
        complete: true,
        tip: "Consulta y carga documentos recientes para re-editar.",
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
    watched.client?.name,
    watched.issueDate,
    watched.items,
    watched.manualGrossSubtotal,
    watched.number,
    watched.paymentMethod,
    watched.bankAccount,
    watched.templateProfileId,
    watched.totalsBasis,
    watched.type,
  ]);

  const profileOptions = useMemo(
    () =>
      (configQuery.data?.templateProfiles ?? []).map((profile) => ({
        id: profile.id,
        label: profile.label || profile.id,
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
  const filteredHistoryOptions = useMemo(() => {
    const term = String(historySearchTerm || "").trim().toLowerCase();
    if (!term) {
      return historyOptions;
    }

    return historyOptions.filter((option) => {
      const labelMatch = option.label.toLowerCase().includes(term);
      const recordMatch = option.recordId.toLowerCase().includes(term);
      return labelMatch || recordMatch;
    });
  }, [historyOptions, historySearchTerm]);

  const ensureDefaults = () => {
    const current = form.getValues();
    const next = applyTotals(
      mapLegacyDocumentToForm({
        ...current,
        templateProfileId: current.templateProfileId || configQuery.data?.activeTemplateProfileId || "",
        tenantId:
          current.tenantId
          || (sessionQuery.data?.authenticated ? sessionQuery.data.user.tenantId : undefined)
          || "default",
      }),
    );
    form.reset(next);
  };

  useEffect(() => {
    if (!configQuery.data) {
      return;
    }

    const current = form.getValues();
    if (String(current.templateProfileId || "").trim()) {
      return;
    }

    const fallbackProfileId = String(configQuery.data.activeTemplateProfileId || "").trim();
    if (!fallbackProfileId) {
      return;
    }

    const profile = (configQuery.data.templateProfiles ?? []).find((item) => item.id === fallbackProfileId);
    form.setValue("templateProfileId", fallbackProfileId, { shouldDirty: false, shouldValidate: true });
    if (!String(current.paymentMethod || "").trim() && String(profile?.defaults?.paymentMethod || "").trim()) {
      form.setValue("paymentMethod", String(profile?.defaults?.paymentMethod || "").trim(), { shouldDirty: false });
    }
    if (!String(current.bankAccount || "").trim() && String(profile?.business?.bankAccount || "").trim()) {
      form.setValue("bankAccount", String(profile?.business?.bankAccount || "").trim(), { shouldDirty: false });
    }
    if (!String(current.templateLayout || "").trim() && String(profile?.design?.layout || "").trim()) {
      form.setValue("templateLayout", String(profile?.design?.layout || "").trim(), { shouldDirty: false });
    }
  }, [configQuery.data, form]);

  const applyTemplateProfile = (profileIdRaw: string) => {
    const profileId = String(profileIdRaw || "").trim();
    form.setValue("templateProfileId", profileId, { shouldDirty: true, shouldValidate: true });

    const profile = (configQuery.data?.templateProfiles ?? []).find((item) => item.id === profileId);
    if (!profile) {
      return;
    }

    const profilePayment = String(profile.defaults?.paymentMethod || "").trim();
    if (profilePayment) {
      form.setValue("paymentMethod", profilePayment, { shouldDirty: true, shouldValidate: true });
    }

    const profileBank = String(profile.business?.bankAccount || "").trim();
    if (profileBank) {
      form.setValue("bankAccount", profileBank, { shouldDirty: true, shouldValidate: true });
    }

    const profileLayout = String(profile.design?.layout || "").trim();
    if (profileLayout) {
      form.setValue("templateLayout", profileLayout, { shouldDirty: true, shouldValidate: true });
    }

    const profileTaxRate = Number(profile.defaults?.taxRate);
    if (Number.isFinite(profileTaxRate)) {
      form.setValue("taxRate", profileTaxRate, { shouldDirty: true, shouldValidate: true });
    }

    const profileWithholding = Number(profile.defaults?.withholdingRate);
    const validWithholding = profileWithholding === 15 || profileWithholding === 19 || profileWithholding === 21;
    if (validWithholding) {
      form.setValue("withholdingRate", profileWithholding, { shouldDirty: true, shouldValidate: true });
      setWithoutWithholding(false);
    } else {
      form.setValue("withholdingRate", "", { shouldDirty: true, shouldValidate: true });
      setWithoutWithholding(true);
    }
  };

  const applyWithholdingMode = (mode: "sin_irpf" | "irpf_15" | "irpf_19" | "irpf_21") => {
    if (mode === "sin_irpf") {
      setWithoutWithholding(true);
      form.setValue("withholdingRate", "", { shouldDirty: true, shouldValidate: true });
      return;
    }

    const value = mode === "irpf_15" ? 15 : mode === "irpf_19" ? 19 : 21;
    setWithoutWithholding(false);
    form.setValue("withholdingRate", value, { shouldDirty: true, shouldValidate: true });
  };

  const suggestNumberMutation = useMutation({
    mutationFn: async () => {
      ensureDefaults();
      const draft = form.getValues();
      if (!draft.templateProfileId) {
        throw new Error("Selecciona perfil antes de pedir el número.");
      }
      const number = await getNextNumber({
        type: draft.type,
        issueDate: draft.issueDate,
        series: draft.series,
        templateProfileId: draft.templateProfileId,
        recordId: serverRecordId || undefined,
      });
      form.setValue("number", number, { shouldDirty: true, shouldValidate: true });
      return number;
    },
    onSuccess: () => {
      setNumberAvailabilityText("Número sugerido. Valida disponibilidad.");
      setNumberAvailabilityTone("neutral");
    },
  });

  const checkAvailabilityMutation = useMutation({
    mutationFn: async () => {
      const draft = form.getValues();
      if (!draft.templateProfileId) {
        throw new Error("Selecciona perfil para validar número.");
      }
      const payload = await validateNumberAvailability({
        number: draft.number,
        type: draft.type,
        issueDate: draft.issueDate,
        series: draft.series,
        templateProfileId: draft.templateProfileId,
        recordId: serverRecordId || undefined,
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
      const normalized = applyTotals(mapFormToLegacyDocument(values));
      if (!normalized.client.name.trim()) {
        throw new Error("Cliente obligatorio.");
      }
      if (!normalized.items.some((item) => item.concept.trim() || item.description.trim())) {
        throw new Error("Añade al menos una línea con concepto o descripción.");
      }
      if (!totalsAreConsistent(normalized, calculateTotals(normalized))) {
        throw new Error("Los totales no son coherentes. Revisa líneas e impuestos.");
      }
      return saveDocument(normalized, serverRecordId || undefined);
    },
    onSuccess: ({ recordId, document }) => {
      const mapped = applyTotals(mapLegacyDocumentToForm(document));
      setServerRecordId(recordId);
      setOfficialOutputError(null);
      form.reset(mapped);
      syncSelectedClientOptionByName(mapped.client?.name || "");
      setNumberAvailabilityText("Guardado correcto.");
      setNumberAvailabilityTone("success");
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
      setOfficialOutputError(null);
      setRecordIdInput(recordId);
      setSelectedHistoryRecordId(recordId);
      form.reset(mapped);
      syncSelectedClientOptionByName(mapped.client?.name || "");
      setNumberAvailabilityText("Documento recargado.");
      setNumberAvailabilityTone("neutral");
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
    const profileLayout = String(profile.design?.layout || "").trim();
    if (profileLayout) {
      form.setValue("templateLayout", profileLayout, { shouldDirty: false, shouldValidate: true });
    }
    const profileTaxRate = Number(profile.defaults?.taxRate);
    if (Number.isFinite(profileTaxRate)) {
      form.setValue("taxRate", profileTaxRate, { shouldDirty: false, shouldValidate: true });
    }
    const profileWithholding = Number(profile.defaults?.withholdingRate);
    const validWithholding = profileWithholding === 15 || profileWithholding === 19 || profileWithholding === 21;
    form.setValue("withholdingRate", validWithholding ? profileWithholding : "", { shouldDirty: false, shouldValidate: true });
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
      return;
    }

    replaceClientData(selected);
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
  };

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
    const current = form.getValues();
    const copy = { ...current, number: "" };
    setServerRecordId("");
    setRecordIdInput("");
    setSelectedHistoryRecordId("");
    setOfficialOutputError(null);
    form.reset(copy);
    setNumberAvailabilityText("Copia lista. Edita el número y guarda para crear nuevo documento.");
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
    taxValidation,
    withoutWithholding,
    setWithoutWithholding,
    applyWithholdingMode,
    workflowChecklist,
    clientOptions,
    clients: clientsQuery.data ?? [],
    ensureDefaults,
    applyClientByName,
    applyClientByOptionId,
    clearClientData,
    selectedClientOptionId,
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
    historyOptions,
    filteredHistoryOptions,
    historySearchTerm,
    setHistorySearchTerm,
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
    loadingConfig: configQuery.isLoading,
    liveDocument,
    isDirty: form.formState.isDirty,
  };
}
