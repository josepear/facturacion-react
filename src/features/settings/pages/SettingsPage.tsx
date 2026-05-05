import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { ProfileBadge } from "@/components/ui/ProfileBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { TemplateProfileConfig } from "@/domain/document/types";
import { MembersSection } from "@/features/settings/components/MembersSection";
import { TrashSection } from "@/features/settings/components/TrashSection";
import {
  PROFILE_COLOR_KEYS,
  PROFILE_COLOR_LABELS,
  buildClientProfileId,
  getNextProfileColorKey,
  suggestUniqueInvoiceNumberTag,
} from "@/features/settings/lib/templateProfileLocal";
import {
  fetchFontsCatalog,
  fetchRuntimeConfig,
  propagateTemplateProfile,
  saveTemplateProfilesConfig,
} from "@/infrastructure/api/documentsApi";
import { fetchGmailOAuthStartUrl, fetchGmailProfiles, type GmailProfileItem } from "@/infrastructure/api/gmailApi";
import { fetchHistoryInvoices } from "@/infrastructure/api/historyApi";
import { ApiError, getErrorMessageFromUnknown } from "@/infrastructure/api/httpClient";
import { openGmailOAuthPopupAndWait } from "@/infrastructure/gmail/oauthPopup";
import { useSessionQuery } from "@/features/shared/hooks/useSessionQuery";
import { isTemplateProfileInScope, resolveSessionScope } from "@/features/shared/lib/sessionScope";
import { TEMPLATE_LAYOUT_OPTIONS, type TemplateLayoutValue } from "@/features/shared/lib/templateLayoutOptions";
import { CANCEL, SAVE, savePending } from "@/features/shared/lib/uiActionCopy";
import { cn, toNumber } from "@/lib/utils";

/** UI de miembros del sistema oculta temporalmente (emisores como foco único). */
const SHOW_SYSTEM_MEMBERS_UI = true;

function safeValue(value: unknown): string {
  const normalized = String(value ?? "").trim();
  return normalized || "-";
}

type ProfileDraft = {
  label: string;
  invoiceNumberTag: string;
  colorKey: string;
  paymentMethod: string;
  taxRate: number;
  withholdingRate: number;
  currency: string;
  bankAccount: string;
  bankBrand: string;
  layout: string;
  fontFamily: string;
  brand: string;
  contactName: string;
  headline: string;
  taxId: string;
  email: string;
  address: string;
  phone: string;
  website: string;
  brandImage: string;
  signatureImage: string;
};

function toProfileDraft(profile: TemplateProfileConfig | null): ProfileDraft {
  const rawColor = String(profile?.colorKey || "").trim().toLowerCase();
  const colorKey = PROFILE_COLOR_KEYS.includes(rawColor as (typeof PROFILE_COLOR_KEYS)[number]) ? rawColor : PROFILE_COLOR_KEYS[0];
  return {
    label: String(profile?.label || profile?.id || "").trim(),
    invoiceNumberTag: String(profile?.invoiceNumberTag || "").trim(),
    colorKey,
    paymentMethod:
      String(profile?.defaults?.paymentMethod || "").trim() || "Transferencia bancaria",
    taxRate: toNumber(profile?.defaults?.taxRate),
    withholdingRate: toNumber(profile?.defaults?.withholdingRate),
    currency: String(profile?.defaults?.currency || "EUR").trim(),
    bankAccount: String(profile?.business?.bankAccount || "").trim(),
    bankBrand: String(profile?.business?.bankBrand || "").trim(),
    layout: String(profile?.design?.layout || "").trim(),
    fontFamily: String(profile?.design?.fontFamily || "").trim(),
    brand: String(profile?.business?.brand || "").trim(),
    contactName: String(profile?.business?.contactName || "").trim(),
    headline: String(profile?.business?.headline || "").trim(),
    taxId: String(profile?.business?.taxId || "").trim(),
    email: String(profile?.business?.email || "").trim(),
    address: String(profile?.business?.address || "").trim(),
    phone: String(profile?.business?.phone || "").trim(),
    website: String(profile?.business?.website || "").trim(),
    brandImage: String(profile?.business?.brandImage || "").trim(),
    signatureImage: String(profile?.business?.signatureImage || "").trim(),
  };
}

function SettingsConfigLoadError({ error }: { error: unknown }) {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    return (
      <div role="alert" className="space-y-2">
        <p className="font-medium text-red-600">No se pudo cargar la configuración (HTTP {error.status})</p>
        <p className="text-informative">
          Una petición a <code className="text-xs">GET /api/config</code> o <code className="text-xs">GET /api/session</code>{" "}
          fue rechazada: <span className="text-foreground">{error.message}</span>. Suele indicar sesión caducada, ausencia de
          token en este origen o credenciales no aceptadas por el servidor.
        </p>
        <p className="text-informative">
          Esto no es el modo solo lectura por rol: si la configuración cargara y tu rol en{" "}
          <code className="text-xs">GET /api/session</code> fuera solo lectura (viewer), verías el formulario de emisores con
          campos deshabilitados y el aviso «Modo solo lectura».
        </p>
      </div>
    );
  }
  return (
    <p role="alert" className="text-red-600">
      {(error as Error)?.message || "No se pudo leer la configuración."}
    </p>
  );
}

function mergeProfileWithDraft(profile: TemplateProfileConfig, draft: ProfileDraft): TemplateProfileConfig {
  const tag = draft.invoiceNumberTag.trim().toUpperCase();
  const color = draft.colorKey.trim().toLowerCase();
  return {
    ...profile,
    label: draft.label || profile.id,
    invoiceNumberTag: tag || undefined,
    colorKey: PROFILE_COLOR_KEYS.includes(color as (typeof PROFILE_COLOR_KEYS)[number]) ? color : PROFILE_COLOR_KEYS[0],
    defaults: {
      ...(profile.defaults || {}),
      paymentMethod: draft.paymentMethod,
      taxRate: draft.taxRate,
      withholdingRate: draft.withholdingRate,
      currency: draft.currency.trim() || undefined,
    },
    business: {
      ...(profile.business || {}),
      bankAccount: draft.bankAccount,
      bankBrand: draft.bankBrand.trim() || undefined,
      brand: draft.brand,
      contactName: draft.contactName.trim() || undefined,
      headline: draft.headline.trim() || undefined,
      taxId: draft.taxId,
      email: draft.email,
      address: draft.address,
      phone: draft.phone,
      website: draft.website,
      brandImage: draft.brandImage.trim() || undefined,
      signatureImage: draft.signatureImage.trim() || undefined,
    },
    design: (() => {
      const next: NonNullable<TemplateProfileConfig["design"]> = {
        ...(profile.design || {}),
        layout: draft.layout.trim() || profile.design?.layout,
      };
      const ff = String(draft.fontFamily ?? "").trim();
      if (ff) {
        next.fontFamily = ff;
      } else {
        delete next.fontFamily;
      }
      return next;
    })(),
  };
}

export function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    queryKey: ["runtime-config"],
    queryFn: fetchRuntimeConfig,
  });
  const fontsCatalogQuery = useQuery({
    queryKey: ["fonts-catalog"],
    queryFn: fetchFontsCatalog,
    staleTime: 3_600_000,
  });
  const fontFamilies: string[] = fontsCatalogQuery.data?.families ?? [];
  const sessionQuery = useSessionQuery();
  const [activeProfileIdDraft, setActiveProfileIdDraft] = useState("");
  const [editingProfileId, setEditingProfileId] = useState("");
  const [draftByProfileId, setDraftByProfileId] = useState<Record<string, ProfileDraft>>({});
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");
  const [profileListOverride, setProfileListOverride] = useState<TemplateProfileConfig[] | null>(null);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [newProfileLabelDraft, setNewProfileLabelDraft] = useState("");
  const [newProfileSourceId, setNewProfileSourceId] = useState("");
  const brandImageFileInputRef = useRef<HTMLInputElement>(null);
  const [brandImageFileError, setBrandImageFileError] = useState("");
  const [invoiceTagSuggestions, setInvoiceTagSuggestions] = useState<string[]>([]);
  const newBaseDialogRef = useRef<HTMLDialogElement>(null);
  const [newBaseOpen, setNewBaseOpen] = useState(false);
  const [newBaseLabel, setNewBaseLabel] = useState("");
  const [newBaseLayout, setNewBaseLayout] = useState<TemplateLayoutValue>("pear");
  const [gmailOAuthSectionError, setGmailOAuthSectionError] = useState("");
  const emitterDialogRef = useRef<HTMLDialogElement>(null);
  const lastEmitterDialogTriggerRef = useRef<HTMLElement | null>(null);
  const emitterPrimaryFieldRef = useRef<HTMLInputElement | null>(null);
  const emitterNewProfileFieldRef = useRef<HTMLInputElement | null>(null);
  const [isEmitterDialogOpen, setIsEmitterDialogOpen] = useState(false);

  const serverProfiles = useMemo(
    () => configQuery.data?.templateProfiles ?? [],
    [configQuery.data?.templateProfiles],
  );
  const allProfiles = profileListOverride ?? serverProfiles;
  const sessionScope = useMemo(
    () => resolveSessionScope(sessionQuery.data, allProfiles),
    [sessionQuery.data, allProfiles],
  );
  const profiles = useMemo(
    () => allProfiles.filter((profile) => isTemplateProfileInScope(profile.id, sessionScope)),
    [allProfiles, sessionScope],
  );
  const urlTemplateProfileId = String(searchParams.get("templateProfileId") || "").trim();
  const sessionRole = sessionQuery.data?.authenticated
    ? String(sessionQuery.data.user.role || "").trim().toLowerCase()
    : "";
  const sessionReady = !sessionQuery.isLoading && !sessionQuery.error;
  const isAdmin = sessionReady && sessionRole === "admin";
  /** Editar y guardar datos de emisores ya existentes (admin o editor). */
  const canEditEmitterData = sessionReady && sessionScope.hasEmitterScope && (sessionRole === "admin" || sessionRole === "editor");
  const configuredRoleLabel = sessionQuery.data?.authenticated
    ? String(sessionQuery.data.user.role ?? "").trim()
    : "";

  const gmailProfilesQuery = useQuery({
    queryKey: ["gmail-profiles"],
    queryFn: fetchGmailProfiles,
    staleTime: 60_000,
  });

  const serverActiveProfileId = String(configQuery.data?.activeTemplateProfileId || "").trim();
  const effectiveActiveProfileId = activeProfileIdDraft || serverActiveProfileId;

  const effectiveEditingProfileId = useMemo(() => {
    const selected = String(editingProfileId || "").trim();
    if (selected) {
      return selected;
    }
    if (effectiveActiveProfileId) {
      return effectiveActiveProfileId;
    }
    return String(profiles[0]?.id || "").trim();
  }, [editingProfileId, effectiveActiveProfileId, profiles]);

  /** Perfil marcado como activo en el último JSON de servidor (no incluye borradores locales). */
  const serverActiveProfile = useMemo(() => {
    const id = String(serverActiveProfileId || "").trim();
    if (!id) {
      return null;
    }
    return serverProfiles.find((profile) => profile.id === id) || null;
  }, [serverActiveProfileId, serverProfiles]);

  const historyForSummaryQuery = useQuery({
    queryKey: ["history-invoices"],
    queryFn: fetchHistoryInvoices,
    staleTime: 120_000,
    enabled: Boolean(serverActiveProfileId),
  });

  const activeProfileStats = useMemo(() => {
    const items = historyForSummaryQuery.data ?? [];
    const forProfile = items.filter((i) => i.templateProfileId === serverActiveProfileId && i.type === "factura");
    const total = forProfile.reduce((s, i) => s + Number(i.total || 0), 0);
    const lastIssueDate = forProfile.map((i) => String(i.issueDate || "")).sort().reverse()[0] ?? "";
    return { count: forProfile.length, total, lastIssueDate };
  }, [historyForSummaryQuery.data, serverActiveProfileId]);

  const activeProfileForNextSave = useMemo(() => {
    if (!effectiveActiveProfileId) {
      return null;
    }
    return profiles.find((profile) => profile.id === effectiveActiveProfileId) || null;
  }, [effectiveActiveProfileId, profiles]);

  const hasUnsavedLocalChanges = Boolean(
    profileListOverride !== null
    || Object.keys(draftByProfileId).length > 0
    || String(serverActiveProfileId || "").trim() !== String(effectiveActiveProfileId || "").trim(),
  );

  useEffect(() => {
    if (configQuery.isLoading || !configQuery.data || !urlTemplateProfileId) {
      return;
    }
    /** Incluye `profileListOverride` (perfiles solo en memoria), no solo el último JSON del servidor. */
    if (!profiles.some((p) => p.id === urlTemplateProfileId)) {
      return;
    }
    const timeoutId = globalThis.setTimeout(() => {
      setActiveProfileIdDraft(urlTemplateProfileId);
      setEditingProfileId(urlTemplateProfileId);
    }, 0);
    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [configQuery.data, configQuery.isLoading, urlTemplateProfileId, profiles]);

  const editingProfile = useMemo(() => {
    if (!effectiveEditingProfileId) {
      return null;
    }
    return profiles.find((profile) => profile.id === effectiveEditingProfileId) || null;
  }, [effectiveEditingProfileId, profiles]);

  const editingDraft = useMemo(() => {
    if (!effectiveEditingProfileId) {
      return toProfileDraft(null);
    }
    return draftByProfileId[effectiveEditingProfileId] ?? toProfileDraft(editingProfile);
  }, [draftByProfileId, editingProfile, effectiveEditingProfileId]);

  const brandImageSummary = useMemo(() => {
    const bi = String(editingDraft.brandImage || "").trim();
    if (bi.startsWith("data:")) {
      return "Logo embebido en el emisor (base64)";
    }
    if (bi.startsWith("/") || bi.startsWith("http")) {
      return bi;
    }
    return "Sin logo";
  }, [editingDraft.brandImage]);

  useEffect(() => {
    setBrandImageFileError("");
    if (brandImageFileInputRef.current) {
      brandImageFileInputRef.current.value = "";
    }
  }, [effectiveEditingProfileId]);

  useEffect(() => {
    const el = newBaseDialogRef.current;
    if (!el) {
      return;
    }
    if (newBaseOpen) {
      if (!el.open) {
        el.showModal();
      }
    } else if (el.open) {
      el.close();
    }
  }, [newBaseOpen]);

  useEffect(() => {
    const el = emitterDialogRef.current;
    if (!el) {
      return;
    }
    if (isEmitterDialogOpen) {
      if (!el.open) {
        if (typeof el.showModal === "function") {
          el.showModal();
        } else {
          el.setAttribute("open", "");
        }
      }
      globalThis.setTimeout(() => {
        if (isCreatingProfile) {
          emitterNewProfileFieldRef.current?.focus();
          return;
        }
        emitterPrimaryFieldRef.current?.focus();
      }, 0);
      return;
    }
    if (el.open) {
      if (typeof el.close === "function") {
        el.close();
      } else {
        el.removeAttribute("open");
      }
    }
    lastEmitterDialogTriggerRef.current?.focus();
  }, [isEmitterDialogOpen, isCreatingProfile]);

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const safeActiveProfileId = String(effectiveActiveProfileId || "").trim();
      if (!safeActiveProfileId) {
        throw new Error("Selecciona un emisor activo.");
      }
      if (!profiles.length) {
        throw new Error("No hay emisores disponibles para guardar.");
      }
      const nextProfiles = profiles.map((profile) =>
        profile.id === effectiveEditingProfileId
          ? mergeProfileWithDraft(profile, editingDraft)
          : profile,
      );
      if (!isAdmin) {
        const serverIds = new Set(serverProfiles.map((p) => p.id));
        if (profileListOverride !== null) {
          throw new Error("Solo un administrador puede crear o eliminar emisores en la lista.");
        }
        if (nextProfiles.length !== serverProfiles.length) {
          throw new Error("Solo un administrador puede eliminar emisores.");
        }
        for (const p of nextProfiles) {
          if (!serverIds.has(p.id)) {
            throw new Error("Solo un administrador puede crear emisores nuevos.");
          }
        }
      }

      return saveTemplateProfilesConfig({
        activeTemplateProfileId: safeActiveProfileId,
        templateProfiles: nextProfiles,
      });
    },
    onSuccess: async (savedConfig) => {
      queryClient.setQueryData(["runtime-config"], savedConfig);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["runtime-config"] }),
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
      ]);
      setDraftByProfileId({});
      setActiveProfileIdDraft("");
      setProfileListOverride(null);
      const savedActiveId = String(savedConfig.activeTemplateProfileId || "").trim();
      if (savedActiveId) {
        const next = new URLSearchParams(searchParams);
        next.set("templateProfileId", savedActiveId);
        if (next.toString() !== searchParams.toString()) {
          setSearchParams(next, { replace: true });
        }
      }
      setStatusMessage("Datos del emisor guardados.");
      setStatusTone("success");
      setInvoiceTagSuggestions([]);
      setIsEmitterDialogOpen(false);
    },
    onError: (error) => {
      setStatusMessage(getErrorMessageFromUnknown(error));
      setStatusTone("error");
      if (error instanceof ApiError && error.payload && typeof error.payload === "object" && !Array.isArray(error.payload)) {
        const raw = (error.payload as Record<string, unknown>).suggestions;
        setInvoiceTagSuggestions(Array.isArray(raw) ? raw.map((x) => String(x).trim()).filter(Boolean) : []);
      } else {
        setInvoiceTagSuggestions([]);
      }
    },
  });

  const propagateMutation = useMutation({
    mutationFn: (templateProfileId: string) => propagateTemplateProfile(templateProfileId),
    onSuccess: (result) => {
      const label = result.templateProfileLabel ? ` (${result.templateProfileLabel})` : "";
      setStatusMessage(
        `Diseño propagado${label}: ${result.updated} documento${result.updated === 1 ? "" : "s"} actualizados, ${result.skipped} sin cambios.`,
      );
      setStatusTone("success");
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : String(err);
      setStatusMessage(`Error al propagar: ${msg}`);
      setStatusTone("error");
    },
  });

  const updateDraft = (patch: Partial<ProfileDraft>) => {
    if (!effectiveEditingProfileId) {
      return;
    }
    setDraftByProfileId((prev) => ({
      ...prev,
      [effectiveEditingProfileId]: {
        ...editingDraft,
        ...patch,
      },
    }));
  };

  const handleBrandImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setBrandImageFileError("El logo tiene que ser un SVG o una imagen válida.");
      event.target.value = "";
      return;
    }
    setBrandImageFileError("");
    const profileId = String(effectiveEditingProfileId || "").trim();
    if (!profileId) {
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") {
        return;
      }
      setDraftByProfileId((prev) => {
        const current = prev[profileId];
        if (!current) {
          return prev;
        }
        return { ...prev, [profileId]: { ...current, brandImage: dataUrl } };
      });
    };
    reader.readAsDataURL(file);
  };

  const syncLauncherSelection = (profileId: string) => {
    const id = String(profileId || "").trim();
    if (!id) {
      return;
    }
    setActiveProfileIdDraft(id);
    setEditingProfileId(id);
    const next = new URLSearchParams(searchParams);
    next.set("templateProfileId", id);
    setSearchParams(next, { replace: true });
  };

  const startNewTemplateProfile = () => {
    if (!isAdmin) {
      return;
    }
    const source =
      profiles.find((p) => p.id === effectiveActiveProfileId) || profiles.find((p) => p.id === effectiveEditingProfileId) || profiles[0];
    if (!source) {
      return;
    }
    const suggestedLabel = `${String(source.label || source.id || "Emisor").trim()} copia`;
    setNewProfileSourceId(source.id);
    setNewProfileLabelDraft(suggestedLabel);
    setIsCreatingProfile(true);
    setIsEmitterDialogOpen(true);
    setStatusMessage("Indica el nombre del nuevo emisor y confirma para crearlo en memoria.");
    setStatusTone("neutral");
  };

  const cancelNewTemplateProfile = () => {
    setIsCreatingProfile(false);
    setNewProfileLabelDraft("");
    setNewProfileSourceId("");
  };

  const closeEmitterDialog = () => {
    cancelNewTemplateProfile();
    setIsEmitterDialogOpen(false);
  };

  const confirmNewTemplateProfile = () => {
    if (!isAdmin) {
      return;
    }
    const sourceBase =
      profiles.find((p) => p.id === newProfileSourceId)
      || profiles.find((p) => p.id === effectiveActiveProfileId)
      || profiles.find((p) => p.id === effectiveEditingProfileId)
      || profiles[0];
    if (!sourceBase) {
      return;
    }
    /** Copiar lo que el usuario ve en el formulario del origen, no solo el objeto servidor sin borrador. */
    const sourceDraft = draftByProfileId[sourceBase.id];
    const source = sourceDraft ? mergeProfileWithDraft(sourceBase, sourceDraft) : sourceBase;
    const nextLabel = String(newProfileLabelDraft || "").trim();
    if (!nextLabel) {
      setStatusMessage("Indica un nombre para el nuevo emisor.");
      setStatusTone("error");
      return;
    }
    const used = new Set(profiles.map((p) => p.id));
    const newId = buildClientProfileId(nextLabel, used);
    const clone = JSON.parse(JSON.stringify(source)) as TemplateProfileConfig;
    const invoiceNumberTag = suggestUniqueInvoiceNumberTag(newId, profiles);
    const nextProfile: TemplateProfileConfig = {
      ...clone,
      id: newId,
      label: nextLabel,
      colorKey: getNextProfileColorKey(profiles),
      invoiceNumberTag,
    };
    const nextList = [...profiles, nextProfile];
    setProfileListOverride(nextList);
    syncLauncherSelection(newId);
    setIsCreatingProfile(false);
    setNewProfileLabelDraft("");
    setNewProfileSourceId("");
    setStatusMessage(`Emisor nuevo en memoria. Pulsa «${SAVE} datos del emisor» para fijarlo en el servidor.`);
    setStatusTone("neutral");
  };

  const confirmNewProfileFromBase = () => {
    if (!isAdmin) {
      return;
    }
    const nextLabel = String(newBaseLabel || "").trim();
    if (!nextLabel) {
      setStatusMessage("Indica un nombre para el nuevo emisor.");
      setStatusTone("error");
      return;
    }
    const first = profiles[0];
    if (!first) {
      setStatusMessage("No hay emisores de referencia en configuración.");
      setStatusTone("error");
      return;
    }
    const used = new Set(profiles.map((p) => p.id));
    const newId = buildClientProfileId(nextLabel, used);
    const nextProfile: TemplateProfileConfig = {
      id: newId,
      label: nextLabel,
      tenantId: String(first.tenantId || "default").trim() || "default",
      colorKey: getNextProfileColorKey(profiles),
      invoiceNumberTag: suggestUniqueInvoiceNumberTag(newId, profiles),
      defaults: first.defaults ? { ...first.defaults } : undefined,
      design: { layout: newBaseLayout },
      business: {},
    };
    setProfileListOverride([...profiles, nextProfile]);
    syncLauncherSelection(newId);
    setNewBaseOpen(false);
    setNewBaseLabel("");
    setNewBaseLayout("pear");
    newBaseDialogRef.current?.close();
    setStatusMessage(`Emisor nuevo desde plantilla en memoria. Pulsa «${SAVE} datos del emisor» para fijarlo en el servidor.`);
    setStatusTone("neutral");
  };

  const handleDeleteEmitterById = (idToRemove: string) => {
    if (!isAdmin) {
      setStatusMessage("Solo un administrador puede borrar emisores.");
      setStatusTone("error");
      return;
    }
    if (profiles.length <= 1) {
      setStatusMessage("Tiene que existir al menos un emisor en la configuración.");
      setStatusTone("error");
      return;
    }
    const safeId = String(idToRemove || "").trim();
    const victim = profiles.find((p) => p.id === safeId);
    if (!victim) {
      return;
    }
    if (
      !window.confirm(
        `Se eliminará el emisor «${victim.label || safeId}» de la lista local (debes pulsar «${SAVE} datos del emisor» para aplicarlo en el servidor). ¿Continuar?`,
      )
    ) {
      return;
    }
    const idx = profiles.findIndex((p) => p.id === safeId);
    const nextList = profiles.filter((p) => p.id !== safeId);
    const fallback = nextList[Math.max(0, idx - 1)] || nextList[0];
    if (!fallback) {
      return;
    }
    setProfileListOverride(nextList);
    setDraftByProfileId((prev) => {
      const next = { ...prev };
      delete next[safeId];
      return next;
    });
    syncLauncherSelection(fallback.id);
    setStatusMessage(`Emisor eliminado en memoria. Pulsa «${SAVE} datos del emisor» para fijarlo en el servidor.`);
    setStatusTone("neutral");
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configuración · Emisores</h1>
        <p className="text-informative">
          Gestiona emisores desde el listado: edita o borra cada fila y guarda los cambios en el servidor con «{SAVE} datos del
          emisor». Independiente de «{SAVE} documento» en Facturar.
        </p>
      </header>

      {configQuery.isLoading || sessionQuery.isLoading ? (
        <Card>
          <CardContent className="pt-6 text-informative">Cargando configuración...</CardContent>
        </Card>
      ) : configQuery.error || sessionQuery.error ? (
        <Card>
          <CardContent className="pt-6 text-sm">
            <SettingsConfigLoadError error={configQuery.error ?? sessionQuery.error} />
          </CardContent>
        </Card>
      ) : (
        <>
          {!sessionScope.hasEmitterScope ? (
            <Card>
              <CardContent className="pt-6 text-sm text-informative">
                Tu sesión no tiene emisores asignados para operar en Configuración. Contacta con un administrador.
              </CardContent>
            </Card>
          ) : null}
          {sessionScope.hasEmitterScope ? (
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0 space-y-1">
                <CardTitle>Emisores</CardTitle>
                <CardDescription>
                  Listado de emisores configurados. «Activo en servidor» es el que publica hoy <code className="text-xs">/api/config</code>.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={!isAdmin || isCreatingProfile}
                onClick={(event) => {
                  lastEmitterDialogTriggerRef.current = event.currentTarget;
                  startNewTemplateProfile();
                }}
              >
                Nuevo emisor
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4">
              {profiles.length ? (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-[28rem] text-left text-sm">
                    <thead className="border-b border-border bg-muted/40 text-informative">
                      <tr>
                        <th className="px-3 py-2 font-medium">Nombre</th>
                        <th className="px-3 py-2 font-medium">Email</th>
                        <th className="px-3 py-2 font-medium text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profiles.map((profile) => {
                        const rowDraft = draftByProfileId[profile.id];
                        const merged = rowDraft ? mergeProfileWithDraft(profile, rowDraft) : profile;
                        const email = String(merged.business?.email || "").trim();
                        const isServerActive = profile.id === serverActiveProfileId;
                        const isRowSelected = profile.id === effectiveEditingProfileId;
                        return (
                          <tr
                            key={profile.id}
                            data-testid={`emitter-row-${profile.id}`}
                            className={cn("border-b border-border last:border-b-0", isRowSelected && "bg-muted/30")}
                          >
                            <td className="px-3 py-2 align-middle">
                              <div className="flex flex-wrap items-center gap-2">
                                <ProfileBadge label={merged.label || profile.id} colorKey={merged.colorKey} />
                                {isServerActive ? (
                                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                                    Activo en servidor
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="max-w-[14rem] truncate px-3 py-2 align-middle text-informative" title={email || undefined}>
                              {email || "—"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right align-middle">
                              <div className="flex flex-wrap justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={(event) => {
                                    lastEmitterDialogTriggerRef.current = event.currentTarget;
                                    syncLauncherSelection(profile.id);
                                    setIsEmitterDialogOpen(true);
                                  }}
                                >
                                  Editar
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  disabled={!isAdmin || profiles.length <= 1}
                                  title={
                                    !isAdmin
                                      ? "Solo los administradores pueden borrar emisores."
                                      : profiles.length <= 1
                                        ? "Tiene que existir al menos un emisor."
                                        : undefined
                                  }
                                  onClick={() => handleDeleteEmitterById(profile.id)}
                                >
                                  Borrar
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-informative">No hay emisores configurados.</p>
              )}
              <select
                aria-label="Emisor"
                className="sr-only"
                value={effectiveEditingProfileId}
                onChange={(event) => syncLauncherSelection(event.target.value)}
                disabled={!profiles.length}
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label || profile.id}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>
          ) : null}

          {sessionScope.hasEmitterScope ? <details className="group rounded-lg border border-border bg-card">
            <summary className="cursor-pointer list-none px-4 py-3 font-medium text-foreground outline-none marker:hidden [&::-webkit-details-marker]:hidden">
              <span className="text-informative group-open:text-foreground">Servidor y resumen técnico (opcional)</span>
            </summary>
            <div className="grid gap-4 border-t border-border p-4 pt-2">
              {serverActiveProfile ? (
                <Card>
                  <div className="grid gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <ProfileBadge
                        label={serverActiveProfile.label || serverActiveProfile.id}
                        colorKey={serverActiveProfile.colorKey}
                      />
                      <span className="text-informative font-medium">Emisor activo en servidor</span>
                    </div>

                    {serverActiveProfile.business?.brandImage ? (
                      <img
                        src={serverActiveProfile.business.brandImage}
                        alt="Logo del emisor"
                        style={{ maxHeight: 40, maxWidth: 120, objectFit: "contain" }}
                      />
                    ) : null}

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg border p-2">
                        <p className="text-lg font-semibold">{activeProfileStats.count}</p>
                        <p className="text-informative">Facturas</p>
                      </div>
                      <div className="rounded-lg border p-2">
                        <p className="text-lg font-semibold">
                          {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
                            activeProfileStats.total,
                          )}
                        </p>
                        <p className="text-informative">Facturado</p>
                      </div>
                      <div className="rounded-lg border p-2">
                        <p className="text-lg font-semibold">
                          {activeProfileStats.lastIssueDate ? activeProfileStats.lastIssueDate.slice(0, 10) : "—"}
                        </p>
                        <p className="text-informative">Última factura</p>
                      </div>
                    </div>

                    {serverActiveProfile.business?.brand || serverActiveProfile.business?.taxId ? (
                      <p className="text-informative">
                        {[serverActiveProfile.business?.brand, serverActiveProfile.business?.taxId].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                </Card>
              ) : null}

              <section className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Emisor activo (servidor)</CardTitle>
                    <CardDescription>
                      El que publica <code className="text-xs">/api/config</code> como <code className="text-xs">activeTemplateProfileId</code>{" "}
                      en el <strong>último guardado</strong>. El parámetro de URL{" "}
                      <code className="text-xs">templateProfileId</code> usa la misma clave que Facturar.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm">
                    <p><strong>Id (servidor):</strong> {safeValue(serverActiveProfile?.id)}</p>
                    <p className="flex flex-wrap items-center gap-2">
                      <strong>Nombre:</strong>
                      {serverActiveProfile ? (
                        <ProfileBadge
                          label={String(serverActiveProfile.label || serverActiveProfile.id)}
                          colorKey={serverActiveProfile.colorKey}
                        />
                      ) : (
                        safeValue(undefined)
                      )}
                    </p>
                    <p><strong>Forma de pago:</strong> {safeValue(serverActiveProfile?.defaults?.paymentMethod)}</p>
                    <p><strong>Cuenta:</strong> {safeValue(serverActiveProfile?.business?.bankAccount)}</p>
                    <p><strong>Plantilla PDF:</strong> {safeValue(serverActiveProfile?.design?.layout)}</p>
                    <p><strong>IGIC:</strong> {safeValue(serverActiveProfile?.defaults?.taxRate)}</p>
                    <p><strong>IRPF:</strong> {safeValue(serverActiveProfile?.defaults?.withholdingRate)}</p>
                    {String(effectiveActiveProfileId || "").trim()
                    && String(effectiveActiveProfileId || "").trim() !== String(serverActiveProfileId || "").trim() ? (
                      <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-900 dark:text-amber-100">
                        La selección de emisor activo en el formulario (
                        <strong>{safeValue(activeProfileForNextSave?.label || effectiveActiveProfileId)}</strong>
                        ) aún no está guardada en el servidor; pulsa «{SAVE} datos del emisor» para fijarla.
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        type="button"
                        onClick={() =>
                          navigate(`/facturar?templateProfileId=${encodeURIComponent(String(effectiveActiveProfileId || ""))}`)
                        }
                        disabled={!effectiveActiveProfileId}
                      >
                        Abrir Facturar con este emisor
                      </Button>
                    </div>
                    {!canEditEmitterData ? (
                      <p className="text-informative">
                        Solo lectura: necesitas rol editor o administrador para guardar cambios de emisor.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Defaults runtime</CardTitle>
                    <CardDescription>Valores efectivos publicados por `/api/config`.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-1 text-sm">
                    <p><strong>Tenant:</strong> {safeValue(sessionQuery.data?.authenticated ? sessionQuery.data.user.tenantId : "")}</p>
                    <p><strong>Rol sesión:</strong> {safeValue(sessionQuery.data?.authenticated ? sessionQuery.data.user.role : "")}</p>
                    <p><strong>Forma de pago:</strong> {safeValue(configQuery.data?.defaults?.paymentMethod)}</p>
                    <p><strong>IGIC:</strong> {safeValue(configQuery.data?.defaults?.taxRate)}</p>
                    <p><strong>IRPF:</strong> {safeValue(configQuery.data?.defaults?.withholdingRate)}</p>
                    <p className="pt-2 text-informative">
                      La numeración en Facturar se calcula con el emisor activo o seleccionado vía `/api/next-number`.
                    </p>
                  </CardContent>
                </Card>
              </section>
            </div>
          </details> : null}

          <dialog
            ref={emitterDialogRef}
            onClose={closeEmitterDialog}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                closeEmitterDialog();
              }
            }}
            className="z-[60] w-[min(100vw-1rem,1080px)] max-h-[min(100vh-1.5rem,920px)] overflow-y-auto rounded-lg border border-border bg-background p-4 text-foreground shadow-lg sm:p-6"
            aria-label={isCreatingProfile ? "Nuevo emisor" : "Editar emisor"}
          >
            <CardHeader className="px-0 pt-0">
              <p className="text-informative font-medium uppercase tracking-wide">Formulario</p>
              <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
                {editingProfile ? (
                  <>
                    <span>Editando</span>
                    <ProfileBadge label={String(editingDraft.label || editingProfile.id)} colorKey={editingDraft.colorKey} />
                    <span className="text-informative text-base font-normal normal-case">({editingProfile.id})</span>
                  </>
                ) : (
                  "Emisor"
                )}
              </CardTitle>
              <CardDescription>
                Elige el emisor en el listado superior. Elige la plantilla PDF y completa los datos; guarda con «{SAVE} datos del
                emisor». El ajuste fino de módulos PDF sigue en la app legacy (pestaña Plantilla).
              </CardDescription>
              <div className="pt-2">
                <Button type="button" variant="outline" onClick={closeEmitterDialog}>
                  {CANCEL}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 px-0 pb-0">
              {hasUnsavedLocalChanges ? (
                <div
                  role="status"
                  className="rounded-md border border-border bg-muted/60 px-3 py-2 text-sm text-foreground"
                >
                  <p className="font-medium">Cambios locales pendientes de guardar</p>
                  <p className="mt-1 text-informative">
                    Hay ediciones o un emisor activo distinto del último guardado en servidor; nada de esto se aplica en el backend
                    hasta pulsar «{SAVE} datos del emisor».
                  </p>
                </div>
              ) : null}
              {!canEditEmitterData ? (
                <div
                  role="status"
                  className="rounded-md border border-border bg-muted/50 px-3 py-2.5 text-sm"
                >
                  <p className="font-medium text-foreground">Modo solo lectura</p>
                  <p className="mt-1 text-informative">
                    Con rol <strong>solo lectura</strong> (viewer) no puedes modificar emisores ni guardar aquí. Los roles{" "}
                    <strong>editor</strong> y <strong>administrador</strong> pueden editar datos de emisores ya existentes y
                    guardarlos; crear o borrar emisores queda reservado a administradores.
                    {configuredRoleLabel ? (
                      <>
                        {" "}
                        Tu sesión publica el rol: <strong>{configuredRoleLabel}</strong>.
                      </>
                    ) : (
                      <> En esta carga no figura un valor de rol en la sesión.</>
                    )}
                  </p>
                </div>
              ) : null}
              {canEditEmitterData && !isAdmin ? (
                <div
                  role="status"
                  className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm"
                >
                  <p className="font-medium text-foreground">Rol editor</p>
                  <p className="mt-1 text-informative">
                    Puedes cambiar datos de los emisores existentes y guardar. Crear emisores nuevos, borrarlos o propagar
                    diseño a facturas antiguas solo lo puede hacer un administrador.
                  </p>
                </div>
              ) : null}
              {profiles.length ? (
                <>
                  <Field label="Plantilla PDF">
                    <select
                      aria-label="Plantilla"
                      className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={
                        TEMPLATE_LAYOUT_OPTIONS.some((o) => o.value === editingDraft.layout) ? editingDraft.layout : ""
                      }
                      onChange={(event) => updateDraft({ layout: event.target.value })}
                      disabled={!canEditEmitterData}
                    >
                      <option value="">Plantilla...</option>
                      {TEMPLATE_LAYOUT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={!canEditEmitterData || saveConfigMutation.isPending || !profiles.length}
                      onClick={() => saveConfigMutation.mutate()}
                    >
                      {saveConfigMutation.isPending ? savePending() : `${SAVE} datos del emisor`}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        navigate(`/facturar?templateProfileId=${encodeURIComponent(String(effectiveEditingProfileId || ""))}`)
                      }
                      disabled={!effectiveEditingProfileId}
                    >
                      Abrir Facturar
                    </Button>
                  </div>
                  {isAdmin ? (
                    <details className="rounded-md border border-dashed border-border p-3">
                      <summary className="cursor-pointer text-sm font-medium text-informative outline-none">
                        Más acciones (admin)
                      </summary>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!isAdmin || isCreatingProfile || newBaseOpen}
                          onClick={() => {
                            setNewBaseLabel("");
                            setNewBaseLayout("pear");
                            setNewBaseOpen(true);
                          }}
                        >
                          Nueva base de diseño
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={propagateMutation.isPending || saveConfigMutation.isPending}
                          onClick={() => {
                            const profileId = String(effectiveActiveProfileId || "").trim();
                            if (!profileId) {
                              setStatusMessage("Selecciona un emisor activo antes de propagar.");
                              setStatusTone("error");
                              return;
                            }
                            propagateMutation.mutate(profileId);
                          }}
                        >
                          {propagateMutation.isPending
                            ? "Propagando..."
                            : "Guardar diseño y actualizar facturas anteriores"}
                        </Button>
                      </div>
                    </details>
                  ) : null}
                  {isCreatingProfile ? (
                    <div className="grid gap-2 rounded-md border border-dashed p-3 sm:grid-cols-[1fr_auto_auto]">
                      <Input
                        ref={emitterNewProfileFieldRef}
                        aria-label="Nombre del nuevo emisor"
                        placeholder="Nombre del nuevo emisor"
                        value={newProfileLabelDraft}
                        onChange={(event) => setNewProfileLabelDraft(event.target.value)}
                        disabled={!isAdmin}
                      />
                      <Button type="button" onClick={confirmNewTemplateProfile} disabled={!isAdmin}>
                        Crear emisor
                      </Button>
                      <Button type="button" variant="outline" onClick={cancelNewTemplateProfile}>
                        {CANCEL}
                      </Button>
                    </div>
                  ) : null}

                  <details className="group rounded-md border border-dashed p-3" open>
                    <summary className="cursor-pointer text-informative font-medium outline-none group-open:text-foreground">
                      Datos principales del emisor
                    </summary>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="Nombre visible">
                        <Input
                          ref={emitterPrimaryFieldRef}
                          placeholder="Ejemplo: Pear&co."
                          value={editingDraft.label}
                          onChange={(event) => updateDraft({ label: event.target.value })}
                          disabled={!canEditEmitterData}
                        />
                      </Field>
                      <Field
                        label="ID en el número de factura"
                        hint="Obligatorio en legacy: 3 a 5 letras (sin tilde, sin números en el prefijo). Distinto en cada usuario."
                      >
                        <Input
                          placeholder="Ej. JOS → JOS_1-2026"
                          value={editingDraft.invoiceNumberTag}
                          onChange={(event) => {
                            setInvoiceTagSuggestions([]);
                            updateDraft({ invoiceNumberTag: event.target.value.toUpperCase() });
                          }}
                          maxLength={5}
                          autoComplete="off"
                          spellCheck={false}
                          disabled={!canEditEmitterData}
                        />
                        {invoiceTagSuggestions.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            <p className="w-full text-informative">Prefijos sugeridos (elige uno):</p>
                            {invoiceTagSuggestions.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                className="rounded-full border border-input bg-background px-2 py-0.5 text-xs font-medium text-foreground hover:bg-accent"
                                onClick={() => {
                                  updateDraft({ invoiceNumberTag: tag });
                                  setInvoiceTagSuggestions([]);
                                }}
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </Field>
                      <Field label="Color en listados y vista previa">
                        <select
                          aria-label="Color del usuario"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={editingDraft.colorKey}
                          onChange={(event) => updateDraft({ colorKey: event.target.value })}
                          disabled={!canEditEmitterData}
                        >
                          {PROFILE_COLOR_KEYS.map((key) => (
                            <option key={key} value={key}>
                              {PROFILE_COLOR_LABELS[key]}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Fuente del documento">
                        <select
                          value={String(editingDraft.fontFamily ?? "")}
                          onChange={(event) => updateDraft({ fontFamily: event.target.value })}
                          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                          disabled={!canEditEmitterData}
                        >
                          <option value="">— Por defecto —</option>
                          {fontFamilies.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Marca / empresa">
                        <Input
                          placeholder="Nombre comercial"
                          value={editingDraft.brand}
                          onChange={(event) => updateDraft({ brand: event.target.value })}
                          disabled={!canEditEmitterData}
                        />
                      </Field>
                      <div className="lg:col-span-2">
                        <Field label="Nombre completo / responsable">
                          <Input
                            placeholder="Persona que emite la factura"
                            value={editingDraft.contactName}
                            onChange={(event) => updateDraft({ contactName: event.target.value })}
                            disabled={!canEditEmitterData}
                          />
                        </Field>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <Field label="Descripcion corta">
                          <Input
                            placeholder="Linea descriptiva de la empresa"
                            value={editingDraft.headline}
                            onChange={(event) => updateDraft({ headline: event.target.value })}
                            disabled={!canEditEmitterData}
                          />
                        </Field>
                      </div>
                      <Field label="DNI / NIF / CIF">
                        <Input
                          value={editingDraft.taxId}
                          onChange={(event) => updateDraft({ taxId: event.target.value })}
                          disabled={!canEditEmitterData}
                        />
                      </Field>
                      <Field label="Email de contacto (factura)">
                        <Input
                          type="email"
                          value={editingDraft.email}
                          onChange={(event) => updateDraft({ email: event.target.value })}
                          disabled={!canEditEmitterData}
                        />
                      </Field>
                      <p className="sm:col-span-2 lg:col-span-3 text-xs text-informative">
                        Los emisores no tienen contraseña de acceso a la aplicación; el login lo gestionan los usuarios del sistema
                        (fuera de esta pantalla). No hay rol por emisor en la API actual.
                      </p>
                      <Field label="Telefono">
                        <Input
                          value={editingDraft.phone}
                          onChange={(event) => updateDraft({ phone: event.target.value })}
                          disabled={!canEditEmitterData}
                        />
                      </Field>
                      <Field label="Web">
                        <Input
                          placeholder="dominio.com"
                          value={editingDraft.website}
                          onChange={(event) => updateDraft({ website: event.target.value })}
                          disabled={!canEditEmitterData}
                        />
                      </Field>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <Field label="Direccion fiscal / postal">
                          <Input
                            value={editingDraft.address}
                            onChange={(event) => updateDraft({ address: event.target.value })}
                            disabled={!canEditEmitterData}
                          />
                        </Field>
                      </div>
                    </div>
                  </details>

                  <details className="group rounded-md border border-dashed p-3">
                    <summary className="cursor-pointer text-informative font-medium outline-none group-open:text-foreground">
                      Avanzado del usuario
                    </summary>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="sm:col-span-2 lg:col-span-3">
                        <Field label="Logo / imagen de marca">
                          <div className="grid gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                ref={brandImageFileInputRef}
                                type="file"
                                accept=".svg,image/svg+xml,image/png,image/webp,image/jpeg"
                                disabled={!canEditEmitterData}
                                onChange={handleBrandImageFileChange}
                                className="max-w-full text-sm file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!canEditEmitterData}
                                onClick={() => {
                                  updateDraft({ brandImage: "" });
                                  setBrandImageFileError("");
                                  if (brandImageFileInputRef.current) {
                                    brandImageFileInputRef.current.value = "";
                                  }
                                }}
                              >
                                Quitar logo
                              </Button>
                            </div>
                            <p className="text-informative">{brandImageSummary}</p>
                            {brandImageFileError ? (
                              <p className="text-xs text-red-600">{brandImageFileError}</p>
                            ) : null}
                            <Input
                              placeholder="/assets/logo.svg o ruta absoluta (opcional)"
                              value={editingDraft.brandImage}
                              onChange={(event) => {
                                setBrandImageFileError("");
                                updateDraft({ brandImage: event.target.value });
                              }}
                              disabled={!canEditEmitterData}
                            />
                          </div>
                        </Field>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <Field label="Ruta firma">
                          <Input
                            placeholder="/assets/firma.png o ruta absoluta"
                            value={editingDraft.signatureImage}
                            onChange={(event) => updateDraft({ signatureImage: event.target.value })}
                            disabled={!canEditEmitterData}
                          />
                        </Field>
                      </div>
                      <Field label="Banco">
                        <Input
                          placeholder="ING, CaixaBank..."
                          value={editingDraft.bankBrand}
                          onChange={(event) => updateDraft({ bankBrand: event.target.value })}
                          disabled={!canEditEmitterData}
                        />
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="Cuenta bancaria / IBAN">
                          <Input
                            value={editingDraft.bankAccount}
                            onChange={(event) => updateDraft({ bankAccount: event.target.value })}
                            disabled={!canEditEmitterData}
                          />
                        </Field>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <Field label="Forma de pago por defecto">
                          <Input
                            placeholder="Transferencia bancaria"
                            value={editingDraft.paymentMethod}
                            onChange={(event) => updateDraft({ paymentMethod: event.target.value })}
                            disabled={!canEditEmitterData}
                          />
                        </Field>
                      </div>
                      <Field label="Moneda">
                        <Input
                          placeholder="EUR"
                          value={editingDraft.currency}
                          onChange={(event) => updateDraft({ currency: event.target.value })}
                          disabled={!canEditEmitterData}
                        />
                      </Field>
                      <Field label="IGIC / IVA por defecto">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          value={String(editingDraft.taxRate)}
                          onChange={(event) => updateDraft({ taxRate: toNumber(event.target.value) })}
                          disabled={!canEditEmitterData}
                        />
                      </Field>
                      <Field label="IRPF por defecto">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          value={String(editingDraft.withholdingRate)}
                          onChange={(event) => updateDraft({ withholdingRate: toNumber(event.target.value) })}
                          disabled={!canEditEmitterData}
                        />
                      </Field>
                    </div>
                  </details>

                  <div className="grid gap-1 rounded-md border p-3 text-informative sm:grid-cols-2">
                    <span>id emisor: {safeValue(editingProfile?.id)}</span>
                    <span>tenantId: {safeValue(editingProfile?.tenantId)}</span>
                  </div>
                </>
              ) : (
                <p className="text-informative">No hay emisores configurados.</p>
              )}

              {statusMessage ? (
                <p
                  className={
                    statusTone === "error"
                      ? "text-sm text-red-600"
                      : statusTone === "success"
                        ? "text-sm text-emerald-600"
                        : "text-informative"
                  }
                >
                  {statusMessage}
                </p>
              ) : null}
            </CardContent>
          </dialog>

          {isAdmin && sessionScope.hasEmitterScope ? (
            <Card>
              <div className="grid gap-4 p-4">
                <h2 className="text-base font-semibold">Integración Gmail</h2>

                {gmailOAuthSectionError ? <p className="text-sm text-red-600">{gmailOAuthSectionError}</p> : null}

                {gmailProfilesQuery.isLoading ? (
                  <p className="text-informative">Cargando estado de Gmail...</p>
                ) : null}

                {!gmailProfilesQuery.isLoading && !gmailProfilesQuery.data?.configured ? (
                  <p className="text-informative">
                    Gmail no está configurado en el servidor (faltan credenciales OAuth).
                  </p>
                ) : null}

                {gmailProfilesQuery.data?.configured ? (
                  <div className="grid gap-3">
                    {(gmailProfilesQuery.data?.items ?? []).map((item: GmailProfileItem) => (
                      <div key={item.templateProfileId} className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          {item.connected && item.email ? (
                            <p className="text-informative">{item.email}</p>
                          ) : null}
                          {!item.connected ? <p className="text-informative">No conectado</p> : null}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            setGmailOAuthSectionError("");
                            try {
                              const { authUrl } = await fetchGmailOAuthStartUrl(item.templateProfileId);
                              await openGmailOAuthPopupAndWait(authUrl);
                              await queryClient.invalidateQueries({ queryKey: ["gmail-profiles"] });
                            } catch (err) {
                              setGmailOAuthSectionError(getErrorMessageFromUnknown(err));
                            }
                          }}
                        >
                          {item.connected ? "Reconectar" : "Conectar"}
                        </Button>
                      </div>
                    ))}

                    {gmailProfilesQuery.data?.items?.length === 0 ? (
                      <p className="text-informative">No hay emisores con Gmail configurado.</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          <TrashSection canEdit={isAdmin && sessionScope.hasEmitterScope} />

          <dialog
            ref={newBaseDialogRef}
            onClose={() => {
              setNewBaseOpen(false);
              setNewBaseLabel("");
              setNewBaseLayout("pear");
            }}
            className="z-[60] w-[min(100vw-2rem,420px)] rounded-lg border border-border bg-background p-6 text-foreground shadow-lg"
          >
            <div className="grid gap-4">
              <h2 className="text-base font-semibold">Nueva base de diseño</h2>
              <p className="text-informative">
                Crea un emisor vacío con la plantilla visual elegida. Completa datos fiscales y guarda en el servidor.
              </p>
              <Field label="Nombre del emisor">
                <Input
                  value={newBaseLabel}
                  onChange={(e) => setNewBaseLabel(e.target.value)}
                  placeholder="Ej. Eventos Canarias"
                  autoComplete="off"
                />
              </Field>
              <Field label="Plantilla base">
                <select
                  aria-label="Plantilla base del nuevo emisor"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newBaseLayout}
                  onChange={(e) => setNewBaseLayout(e.target.value as TemplateLayoutValue)}
                >
                  {TEMPLATE_LAYOUT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    newBaseDialogRef.current?.close();
                  }}
                >
                  {CANCEL}
                </Button>
                <Button type="button" onClick={confirmNewProfileFromBase} disabled={!isAdmin}>
                  Crear en memoria
                </Button>
              </div>
            </div>
          </dialog>

          {SHOW_SYSTEM_MEMBERS_UI && isAdmin ? (
            <MembersSection
              canEdit
              profiles={serverProfiles}
              currentUserId={String(sessionQuery.data?.authenticated ? sessionQuery.data.user.id ?? "" : "")}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
