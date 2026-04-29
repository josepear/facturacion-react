import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { TemplateProfileConfig } from "@/domain/document/types";
import { fetchRuntimeConfig, saveTemplateProfilesConfig } from "@/infrastructure/api/documentsApi";
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
  const counts = new Map<string, number>(PROFILE_COLOR_KEYS.map((k) => [k, 0]));
  list.forEach((profile, index) => {
    const raw = String(profile.colorKey || "").trim().toLowerCase();
    const key = PROFILE_COLOR_KEYS.includes(raw as (typeof PROFILE_COLOR_KEYS)[number])
      ? raw
      : PROFILE_COLOR_KEYS[index % PROFILE_COLOR_KEYS.length];
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
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    queryKey: ["runtime-config"],
    queryFn: fetchRuntimeConfig,
  });
  const [activeProfileIdDraft, setActiveProfileIdDraft] = useState("");
  const [editingProfileId, setEditingProfileId] = useState("");
  const [draftByProfileId, setDraftByProfileId] = useState<Record<string, ProfileDraft>>({});
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");
  const [profileListOverride, setProfileListOverride] = useState<TemplateProfileConfig[] | null>(null);

  const serverProfiles = configQuery.data?.templateProfiles ?? [];
  const profiles = profileListOverride ?? serverProfiles;
  const currentUserRole = String(configQuery.data?.currentUser?.role || "").trim().toLowerCase();
  const canEdit = currentUserRole === "admin";

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

  const activeProfile = useMemo(() => {
    if (!effectiveActiveProfileId) {
      return null;
    }
    return profiles.find((profile) => profile.id === effectiveActiveProfileId) || null;
  }, [effectiveActiveProfileId, profiles]);

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
  };

  const handleNewTemplateProfile = () => {
    if (!canEdit) {
      return;
    }
    const source =
      profiles.find((p) => p.id === effectiveActiveProfileId) || profiles.find((p) => p.id === effectiveEditingProfileId) || profiles[0];
    if (!source) {
      return;
    }
    const suggestedLabel = `${String(source.label || source.id || "Perfil").trim()} copia`;
    const requested = window.prompt("Nombre del nuevo perfil", suggestedLabel);
    if (requested === null) {
      return;
    }
    const nextLabel = String(requested || "").trim() || suggestedLabel;
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
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Miembros / Emisor</h1>
        <p className="text-sm text-muted-foreground">
          Datos fiscales, logo y textos por defecto del <strong>emisor activo</strong>. Al pulsar «Guardar datos del emisor» se
          guardan en el servidor (legacy pestaña Emisor). Es independiente de «Guardar documento» en Facturar.
        </p>
      </header>

      {configQuery.isLoading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Cargando configuración...</CardContent>
        </Card>
      ) : configQuery.error ? (
        <Card>
          <CardContent className="pt-6 text-sm text-red-600">
            {(configQuery.error as Error).message || "No se pudo leer la configuración."}
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Perfil activo (servidor)</CardTitle>
                <CardDescription>
                  El que publica <code className="text-xs">/api/config</code> como <code className="text-xs">activeTemplateProfileId</code>.
                  Elige el usuario emisor en «Emisor activo» y guarda abajo.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <p><strong>Id:</strong> {safeValue(activeProfile?.id)}</p>
                <p><strong>Nombre del usuario:</strong> {safeValue(activeProfile?.label || activeProfile?.id)}</p>
                <p><strong>Forma de pago:</strong> {safeValue(activeProfile?.defaults?.paymentMethod)}</p>
                <p><strong>Cuenta:</strong> {safeValue(activeProfile?.business?.bankAccount)}</p>
                <p><strong>Plantilla PDF:</strong> {safeValue(activeProfile?.design?.layout)}</p>
                <p><strong>IGIC:</strong> {safeValue(activeProfile?.defaults?.taxRate)}</p>
                <p><strong>IRPF:</strong> {safeValue(activeProfile?.defaults?.withholdingRate)}</p>
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
                <p><strong>Tenant:</strong> {safeValue(configQuery.data?.currentUser?.tenantId)}</p>
                <p><strong>Rol usuario:</strong> {safeValue(configQuery.data?.currentUser?.role)}</p>
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
                (pestaña Plantilla).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
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
                    <Button type="button" variant="outline" disabled={!canEdit} onClick={handleNewTemplateProfile}>
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
                      variant="secondary"
                      onClick={() =>
                        navigate(`/facturar?templateProfileId=${encodeURIComponent(String(effectiveEditingProfileId || ""))}`)
                      }
                      disabled={!effectiveEditingProfileId}
                    >
                      Abrir Facturar
                    </Button>
                  </div>

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
    </main>
  );
}
