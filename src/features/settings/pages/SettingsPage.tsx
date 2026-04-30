import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { TemplateProfileConfig } from "@/domain/document/types";
import { fetchRuntimeConfig, saveTemplateProfilesConfig } from "@/infrastructure/api/documentsApi";
import { ApiError } from "@/infrastructure/api/httpClient";
import { useSessionQuery } from "@/features/shared/hooks/useSessionQuery";
import { toNumber } from "@/lib/utils";

/** Misma secuencia que legacy `PROFILE_COLOR_SEQUENCE` en `public/app.js`. */
const PROFILE_COLOR_KEYS = ["teal", "pink", "amber", "violet", "lime", "blue", "coral"] as const;

/** Mismas etiquetas que legacy `PROFILE_COLOR_LABELS`. */
const PROFILE_COLOR_LABELS: Record<(typeof PROFILE_COLOR_KEYS)[number], string> = {
  teal: "Turquesa",
  pink: "Rosa",
  amber: "Ámbar",
  violet: "Violeta",
  lime: "Lima",
  blue: "Azul",
  coral: "Coral",
};

const LAYOUT_OPTIONS = [
  { value: "pear", label: "Pear&co. clásica" },
  { value: "editorial", label: "Editorial / Nacho" },
  { value: "voulita", label: "Eventos / La Jaulita" },
] as const;

function buildClientProfileId(label: string, usedIds: Set<string>): string {
  const baseText =
    String(label || "perfil")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "perfil";
  let nextId = baseText;
  let suffix = 2;
  while (usedIds.has(nextId)) {
    nextId = `${baseText}-${suffix}`;
    suffix += 1;
  }
  return nextId;
}

/** Igual que legacy `getNextProfileColorKey()` (menos usado primero). */
function getNextProfileColorKey(list: TemplateProfileConfig[]): (typeof PROFILE_COLOR_KEYS)[number] {
  const counts = new Map<(typeof PROFILE_COLOR_KEYS)[number], number>(PROFILE_COLOR_KEYS.map((k) => [k, 0]));
  list.forEach((profile, index) => {
    const raw = String(profile.colorKey || "").trim().toLowerCase();
    const key: (typeof PROFILE_COLOR_KEYS)[number] = PROFILE_COLOR_KEYS.includes(raw as (typeof PROFILE_COLOR_KEYS)[number])
      ? (raw as (typeof PROFILE_COLOR_KEYS)[number])
      : (PROFILE_COLOR_KEYS[index % PROFILE_COLOR_KEYS.length] || PROFILE_COLOR_KEYS[0]);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const sorted = [...counts.entries()].sort((a, b) => a[1] - b[1]);
  return (sorted[0]?.[0] as (typeof PROFILE_COLOR_KEYS)[number]) || PROFILE_COLOR_KEYS[0];
}

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
        <p className="text-muted-foreground">
          Una petición a <code className="text-xs">GET /api/config</code> o <code className="text-xs">GET /api/session</code>{" "}
          fue rechazada: <span className="text-foreground">{error.message}</span>. Suele indicar sesión caducada, ausencia de
          token en este origen o credenciales no aceptadas por el servidor.
        </p>
        <p className="text-muted-foreground">
          Esto no es el modo solo lectura por rol: si la configuración cargara y tu rol en{" "}
          <code className="text-xs">GET /api/session</code> no fuera <code className="text-xs">admin</code>, verías el
          formulario con campos deshabilitados y el aviso «Modo solo lectura».
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
    design: {
      ...(profile.design || {}),
      layout: draft.layout.trim() || profile.design?.layout,
    },
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

  const serverProfiles = useMemo(
    () => configQuery.data?.templateProfiles ?? [],
    [configQuery.data?.templateProfiles],
  );
  const profiles = profileListOverride ?? serverProfiles;
  const urlTemplateProfileId = String(searchParams.get("templateProfileId") || "").trim();
  const sessionRole = sessionQuery.data?.authenticated
    ? String(sessionQuery.data.user.role || "").trim().toLowerCase()
    : "";
  const sessionReady = !sessionQuery.isLoading && !sessionQuery.error;
  const canEdit = sessionReady && sessionRole === "admin";
  const configuredRoleLabel = sessionQuery.data?.authenticated
    ? String(sessionQuery.data.user.role ?? "").trim()
    : "";

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
    const list = configQuery.data.templateProfiles ?? [];
    if (!list.some((p) => p.id === urlTemplateProfileId)) {
      return;
    }
    const timeoutId = globalThis.setTimeout(() => {
      setActiveProfileIdDraft(urlTemplateProfileId);
      setEditingProfileId(urlTemplateProfileId);
    }, 0);
    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [configQuery.data, configQuery.isLoading, urlTemplateProfileId]);

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

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const safeActiveProfileId = String(effectiveActiveProfileId || "").trim();
      if (!safeActiveProfileId) {
        throw new Error("Selecciona un perfil activo.");
      }
      if (!profiles.length) {
        throw new Error("No hay perfiles disponibles para guardar.");
      }
      const nextProfiles = profiles.map((profile) =>
        profile.id === effectiveEditingProfileId
          ? mergeProfileWithDraft(profile, editingDraft)
          : profile,
      );

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
    },
    onError: (error) => {
      setStatusMessage((error as Error).message || "No se pudo guardar la configuración.");
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
    if (!canEdit) {
      return;
    }
    const source =
      profiles.find((p) => p.id === effectiveActiveProfileId) || profiles.find((p) => p.id === effectiveEditingProfileId) || profiles[0];
    if (!source) {
      return;
    }
    const suggestedLabel = `${String(source.label || source.id || "Perfil").trim()} copia`;
    setNewProfileSourceId(source.id);
    setNewProfileLabelDraft(suggestedLabel);
    setIsCreatingProfile(true);
    setStatusMessage("Indica el nombre del nuevo perfil y confirma para crearlo en memoria.");
    setStatusTone("neutral");
  };

  const cancelNewTemplateProfile = () => {
    setIsCreatingProfile(false);
    setNewProfileLabelDraft("");
    setNewProfileSourceId("");
  };

  const confirmNewTemplateProfile = () => {
    if (!canEdit) {
      return;
    }
    const source =
      profiles.find((p) => p.id === newProfileSourceId)
      || profiles.find((p) => p.id === effectiveActiveProfileId)
      || profiles.find((p) => p.id === effectiveEditingProfileId)
      || profiles[0];
    if (!source) {
      return;
    }
    const nextLabel = String(newProfileLabelDraft || "").trim();
    if (!nextLabel) {
      setStatusMessage("Indica un nombre para el nuevo perfil.");
      setStatusTone("error");
      return;
    }
    const used = new Set(profiles.map((p) => p.id));
    const newId = buildClientProfileId(nextLabel, used);
    const clone = JSON.parse(JSON.stringify(source)) as TemplateProfileConfig;
    const nextProfile: TemplateProfileConfig = {
      ...clone,
      id: newId,
      label: nextLabel,
      colorKey: getNextProfileColorKey(profiles),
    };
    setProfileListOverride([...profiles, nextProfile]);
    syncLauncherSelection(newId);
    setDraftByProfileId({});
    setIsCreatingProfile(false);
    setNewProfileLabelDraft("");
    setNewProfileSourceId("");
    setStatusMessage("Perfil nuevo en memoria. Pulsa «Guardar datos del emisor» para fijarlo en el servidor.");
    setStatusTone("neutral");
  };

  const handleDeleteTemplateProfile = () => {
    if (!canEdit || profiles.length <= 1) {
      return;
    }
    const idToRemove = String(effectiveActiveProfileId || "").trim();
    const victim = profiles.find((p) => p.id === idToRemove);
    if (
      !window.confirm(
        `Se borrará el perfil «${victim?.label || idToRemove}». ¿Seguimos? (Igual que legacy: se elimina el perfil activo.)`,
      )
    ) {
      return;
    }
    const idx = profiles.findIndex((p) => p.id === idToRemove);
    const nextList = profiles.filter((p) => p.id !== idToRemove);
    const fallback = nextList[Math.max(0, idx - 1)] || nextList[0];
    if (!fallback) {
      return;
    }
    setProfileListOverride(nextList);
    setDraftByProfileId({});
    syncLauncherSelection(fallback.id);
    setStatusMessage("Perfil eliminado en memoria. Pulsa «Guardar datos del emisor» para fijarlo en el servidor.");
    setStatusTone("neutral");
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Miembros / Emisor</h1>
        <p className="text-sm text-muted-foreground">
          Datos fiscales, logo y textos por defecto del <strong>emisor activo</strong>. Al pulsar «Guardar datos del emisor» se
          guardan en el servidor (legacy pestaña Emisor). Es independiente de «Guardar documento» en Facturar.
        </p>
      </header>

      {configQuery.isLoading || sessionQuery.isLoading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Cargando configuración...</CardContent>
        </Card>
      ) : configQuery.error || sessionQuery.error ? (
        <Card>
          <CardContent className="pt-6 text-sm">
            <SettingsConfigLoadError error={configQuery.error ?? sessionQuery.error} />
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Perfil activo (servidor)</CardTitle>
                <CardDescription>
                  El que publica <code className="text-xs">/api/config</code> como <code className="text-xs">activeTemplateProfileId</code>{" "}
                  en el <strong>último guardado</strong>. La selección para el próximo guardado se hace en «Emisor activo»; el parámetro de URL{" "}
                  <code className="text-xs">templateProfileId</code> usa la misma clave que Facturar.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <p><strong>Id (servidor):</strong> {safeValue(serverActiveProfile?.id)}</p>
                <p><strong>Nombre del usuario:</strong> {safeValue(serverActiveProfile?.label || serverActiveProfile?.id)}</p>
                <p><strong>Forma de pago:</strong> {safeValue(serverActiveProfile?.defaults?.paymentMethod)}</p>
                <p><strong>Cuenta:</strong> {safeValue(serverActiveProfile?.business?.bankAccount)}</p>
                <p><strong>Plantilla PDF:</strong> {safeValue(serverActiveProfile?.design?.layout)}</p>
                <p><strong>IGIC:</strong> {safeValue(serverActiveProfile?.defaults?.taxRate)}</p>
                <p><strong>IRPF:</strong> {safeValue(serverActiveProfile?.defaults?.withholdingRate)}</p>
                {String(effectiveActiveProfileId || "").trim()
                && String(effectiveActiveProfileId || "").trim() !== String(serverActiveProfileId || "").trim() ? (
                  <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-900 dark:text-amber-100">
                    La selección de perfil activo en el formulario (
                    <strong>{safeValue(activeProfileForNextSave?.label || effectiveActiveProfileId)}</strong>
                    ) aún no está guardada en el servidor; pulsa «Guardar datos del emisor» para fijarla.
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
                    Abrir Facturar con este perfil
                  </Button>
                </div>
                {!canEdit ? (
                  <p className="text-xs text-muted-foreground">
                    Solo lectura: el contrato exige usuario administrador para persistir perfiles.
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
                <p><strong>Rol usuario:</strong> {safeValue(sessionQuery.data?.authenticated ? sessionQuery.data.user.role : "")}</p>
                <p><strong>Forma de pago:</strong> {safeValue(configQuery.data?.defaults?.paymentMethod)}</p>
                <p><strong>IGIC:</strong> {safeValue(configQuery.data?.defaults?.taxRate)}</p>
                <p><strong>IRPF:</strong> {safeValue(configQuery.data?.defaults?.withholdingRate)}</p>
                <p className="pt-2 text-xs text-muted-foreground">
                  La numeración en Facturar se calcula con el perfil activo/seleccionado vía `/api/next-number`.
                </p>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Emisor y PDF</p>
              <CardTitle>Emisor activo</CardTitle>
              <CardDescription>
                Orden habitual en legacy: primero guarda aquí el emisor; el constructor fino de módulos PDF sigue en la app legacy
                (pestaña Plantilla). Puedes abrir directamente un perfil con{" "}
                <code className="text-xs">/configuracion?templateProfileId=…</code> (mismo nombre de parámetro que en Facturar).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {hasUnsavedLocalChanges ? (
                <div
                  role="status"
                  className="rounded-md border border-border bg-muted/60 px-3 py-2 text-sm text-foreground"
                >
                  <p className="font-medium">Cambios locales pendientes de guardar</p>
                  <p className="mt-1 text-muted-foreground">
                    Hay ediciones o un perfil activo distinto del último guardado en servidor; nada de esto se aplica en el backend
                    hasta pulsar «Guardar datos del emisor».
                  </p>
                </div>
              ) : null}
              {!canEdit ? (
                <div
                  role="status"
                  className="rounded-md border border-border bg-muted/50 px-3 py-2.5 text-sm"
                >
                  <p className="font-medium text-foreground">Modo solo lectura</p>
                  <p className="mt-1 text-muted-foreground">
                    Editar datos del emisor, crear un usuario nuevo y guardar en el servidor solo están habilitados para la
                    sesión cuyo rol en <code className="rounded bg-muted px-1 text-xs">GET /api/session</code> es{" "}
                    <strong>admin</strong>.
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
              {profiles.length ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Plantilla de emisor">
                      <select
                        aria-label="Plantilla de emisor"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={effectiveEditingProfileId}
                        onChange={(event) => syncLauncherSelection(event.target.value)}
                      >
                        {profiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.label || profile.id}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Plantilla">
                      <select
                        aria-label="Plantilla"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={
                          LAYOUT_OPTIONS.some((o) => o.value === editingDraft.layout) ? editingDraft.layout : ""
                        }
                        onChange={(event) => updateDraft({ layout: event.target.value })}
                        disabled={!canEdit}
                      >
                        <option value="">Plantilla...</option>
                        {LAYOUT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!canEdit || isCreatingProfile}
                      onClick={startNewTemplateProfile}
                    >
                      Nuevo usuario
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={!canEdit || profiles.length <= 1}
                      onClick={handleDeleteTemplateProfile}
                    >
                      Borrar usuario
                    </Button>
                    <Button
                      type="button"
                      disabled={!canEdit || saveConfigMutation.isPending || !profiles.length}
                      onClick={() => saveConfigMutation.mutate()}
                    >
                      {saveConfigMutation.isPending ? "Guardando..." : "Guardar datos del emisor"}
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
                  {isCreatingProfile ? (
                    <div className="grid gap-2 rounded-md border border-dashed p-3 sm:grid-cols-[1fr_auto_auto]">
                      <Input
                        aria-label="Nombre del nuevo perfil"
                        placeholder="Nombre del nuevo perfil"
                        value={newProfileLabelDraft}
                        onChange={(event) => setNewProfileLabelDraft(event.target.value)}
                        disabled={!canEdit}
                      />
                      <Button type="button" onClick={confirmNewTemplateProfile} disabled={!canEdit}>
                        Crear perfil
                      </Button>
                      <Button type="button" variant="outline" onClick={cancelNewTemplateProfile}>
                        Cancelar
                      </Button>
                    </div>
                  ) : null}

                  <details className="group rounded-md border border-dashed p-3" open>
                    <summary className="cursor-pointer text-sm font-medium text-muted-foreground outline-none group-open:text-foreground">
                      Básico del usuario
                    </summary>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="Nombre del usuario">
                        <Input
                          placeholder="Ejemplo: Pear&co."
                          value={editingDraft.label}
                          onChange={(event) => updateDraft({ label: event.target.value })}
                          disabled={!canEdit}
                        />
                      </Field>
                      <Field
                        label="ID en el número de factura"
                        hint="Obligatorio en legacy: 3 a 5 letras (sin tilde, sin números en el prefijo). Distinto en cada usuario."
                      >
                        <Input
                          placeholder="Ej. JOS → JOS_1-2026"
                          value={editingDraft.invoiceNumberTag}
                          onChange={(event) => updateDraft({ invoiceNumberTag: event.target.value.toUpperCase() })}
                          maxLength={5}
                          autoComplete="off"
                          spellCheck={false}
                          disabled={!canEdit}
                        />
                      </Field>
                      <Field label="Color en listados y vista previa">
                        <select
                          aria-label="Color del usuario"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={editingDraft.colorKey}
                          onChange={(event) => updateDraft({ colorKey: event.target.value })}
                          disabled={!canEdit}
                        >
                          {PROFILE_COLOR_KEYS.map((key) => (
                            <option key={key} value={key}>
                              {PROFILE_COLOR_LABELS[key]}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Marca / empresa">
                        <Input
                          placeholder="Nombre comercial"
                          value={editingDraft.brand}
                          onChange={(event) => updateDraft({ brand: event.target.value })}
                          disabled={!canEdit}
                        />
                      </Field>
                      <div className="lg:col-span-2">
                        <Field label="Nombre completo / responsable">
                          <Input
                            placeholder="Persona que emite la factura"
                            value={editingDraft.contactName}
                            onChange={(event) => updateDraft({ contactName: event.target.value })}
                            disabled={!canEdit}
                          />
                        </Field>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <Field label="Descripcion corta">
                          <Input
                            placeholder="Linea descriptiva de la empresa"
                            value={editingDraft.headline}
                            onChange={(event) => updateDraft({ headline: event.target.value })}
                            disabled={!canEdit}
                          />
                        </Field>
                      </div>
                      <Field label="DNI / NIF / CIF">
                        <Input
                          value={editingDraft.taxId}
                          onChange={(event) => updateDraft({ taxId: event.target.value })}
                          disabled={!canEdit}
                        />
                      </Field>
                      <Field label="Email">
                        <Input
                          type="email"
                          value={editingDraft.email}
                          onChange={(event) => updateDraft({ email: event.target.value })}
                          disabled={!canEdit}
                        />
                      </Field>
                      <Field label="Telefono">
                        <Input
                          value={editingDraft.phone}
                          onChange={(event) => updateDraft({ phone: event.target.value })}
                          disabled={!canEdit}
                        />
                      </Field>
                      <Field label="Web">
                        <Input
                          placeholder="dominio.com"
                          value={editingDraft.website}
                          onChange={(event) => updateDraft({ website: event.target.value })}
                          disabled={!canEdit}
                        />
                      </Field>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <Field label="Direccion fiscal / postal">
                          <Input
                            value={editingDraft.address}
                            onChange={(event) => updateDraft({ address: event.target.value })}
                            disabled={!canEdit}
                          />
                        </Field>
                      </div>
                    </div>
                  </details>

                  <details className="group rounded-md border border-dashed p-3">
                    <summary className="cursor-pointer text-sm font-medium text-muted-foreground outline-none group-open:text-foreground">
                      Avanzado del usuario
                    </summary>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="sm:col-span-2 lg:col-span-3">
                        <Field label="Logo / imagen de marca">
                          <Input
                            placeholder="/assets/logo.svg o ruta absoluta (opcional)"
                            value={editingDraft.brandImage}
                            onChange={(event) => updateDraft({ brandImage: event.target.value })}
                            disabled={!canEdit}
                          />
                        </Field>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <Field label="Ruta firma">
                          <Input
                            placeholder="/assets/firma.png o ruta absoluta"
                            value={editingDraft.signatureImage}
                            onChange={(event) => updateDraft({ signatureImage: event.target.value })}
                            disabled={!canEdit}
                          />
                        </Field>
                      </div>
                      <Field label="Banco">
                        <Input
                          placeholder="ING, CaixaBank..."
                          value={editingDraft.bankBrand}
                          onChange={(event) => updateDraft({ bankBrand: event.target.value })}
                          disabled={!canEdit}
                        />
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="Cuenta bancaria / IBAN">
                          <Input
                            value={editingDraft.bankAccount}
                            onChange={(event) => updateDraft({ bankAccount: event.target.value })}
                            disabled={!canEdit}
                          />
                        </Field>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <Field label="Forma de pago por defecto">
                          <Input
                            placeholder="Transferencia bancaria"
                            value={editingDraft.paymentMethod}
                            onChange={(event) => updateDraft({ paymentMethod: event.target.value })}
                            disabled={!canEdit}
                          />
                        </Field>
                      </div>
                      <Field label="Moneda">
                        <Input
                          placeholder="EUR"
                          value={editingDraft.currency}
                          onChange={(event) => updateDraft({ currency: event.target.value })}
                          disabled={!canEdit}
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
                          disabled={!canEdit}
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
                          disabled={!canEdit}
                        />
                      </Field>
                    </div>
                  </details>

                  <div className="grid gap-1 rounded-md border p-3 text-xs text-muted-foreground sm:grid-cols-2">
                    <span>id perfil: {safeValue(editingProfile?.id)}</span>
                    <span>tenantId: {safeValue(editingProfile?.tenantId)}</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No hay perfiles de emisor disponibles.</p>
              )}

              {statusMessage ? (
                <p className={`text-sm ${statusTone === "error" ? "text-red-600" : statusTone === "success" ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {statusMessage}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

