import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { calculateTotals } from "@/domain/document/calculateTotals";
import { createEmptyDocument } from "@/domain/document/defaults";
import { getNextNumber, validateNumberAvailability } from "@/domain/numbering/usecases/getNextNumber";
import { invoiceDocumentSchema } from "@/domain/document/schemas";
import type { CalculatedTotals, InvoiceDocument } from "@/domain/document/types";
import { fetchClients } from "@/infrastructure/api/clientsApi";
import { fetchDocumentDetail, fetchRuntimeConfig, saveDocument } from "@/infrastructure/api/documentsApi";
import { mapFormToLegacyDocument, mapLegacyDocumentToForm } from "@/infrastructure/mappers/documentMapper";

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

export function useFacturarForm() {
  const [recordIdInput, setRecordIdInput] = useState("");
  const [serverRecordId, setServerRecordId] = useState("");
  const [numberAvailabilityText, setNumberAvailabilityText] = useState("Pendiente de validar número.");
  const [numberAvailabilityTone, setNumberAvailabilityTone] = useState<"neutral" | "success" | "error">("neutral");

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

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients,
  });

  const watched = useWatch({ control: form.control });
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

  const profileOptions = useMemo(
    () =>
      (configQuery.data?.templateProfiles ?? []).map((profile) => ({
        id: profile.id,
        label: profile.label || profile.id,
      })),
    [configQuery.data?.templateProfiles],
  );

  const ensureDefaults = () => {
    const current = form.getValues();
    const next = applyTotals(
      mapLegacyDocumentToForm({
        ...current,
        templateProfileId: current.templateProfileId || configQuery.data?.activeTemplateProfileId || "",
        tenantId: current.tenantId || configQuery.data?.currentUser?.tenantId || "default",
      }),
    );
    form.reset(next);
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
      form.reset(mapped);
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
      form.reset(mapped);
      setNumberAvailabilityText("Documento recargado.");
      setNumberAvailabilityTone("neutral");
    },
  });

  const applyClientByName = (name: string) => {
    const selected = (clientsQuery.data ?? []).find((client) => client.name === name);
    if (!selected) {
      return;
    }
    form.setValue("client.taxId", selected.taxId || "");
    form.setValue("client.email", selected.email || "");
    form.setValue("client.address", selected.address || "");
    form.setValue("client.city", selected.city || "");
    form.setValue("client.province", selected.province || "");
    form.setValue("client.taxCountryCode", selected.taxCountryCode || "ES");
    form.setValue("client.taxIdType", selected.taxIdType || "");
    form.setValue("client.contactPerson", selected.contactPerson || "");
  };

  const submit = form.handleSubmit(async (values) => {
    await saveMutation.mutateAsync(values);
  });

  return {
    form,
    submit,
    totals,
    itemsArray,
    profileOptions,
    clients: clientsQuery.data ?? [],
    ensureDefaults,
    applyClientByName,
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
    serverRecordId,
    loadingConfig: configQuery.isLoading,
  };
}
