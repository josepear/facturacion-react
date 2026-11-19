import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_DESIGN,
  DESIGN_NUMERIC_RANGES,
  FONT_WEIGHT_OPTIONS,
  HORIZONTAL_ALIGN_OPTIONS,
  VERTICAL_ALIGN_OPTIONS,
  type DesignBusinessTexts,
  type DesignConfig,
  type DesignNumericKey,
  mergeDesign,
} from "@/domain/design/designConfig";
import { createEmptyDocument, getToday } from "@/domain/document/defaults";
import type { InvoiceDocument, TemplateProfileConfig } from "@/domain/document/types";
import {
  fetchDesignPreviewBlob,
  fetchFontsCatalog,
  fetchRuntimeConfig,
  saveTemplateProfilesConfig,
} from "@/infrastructure/api/documentsApi";
import { getErrorMessageFromUnknown } from "@/infrastructure/api/httpClient";
import { PageHeader } from "@/features/shared/components/PageHeader";
import { ScaledHtmlPreview } from "@/features/shared/components/ScaledHtmlPreview";
import { useSessionQuery } from "@/features/shared/hooks/useSessionQuery";
import { isTemplateProfileInScope, resolveSessionScope } from "@/features/shared/lib/sessionScope";
import { TEMPLATE_LAYOUT_OPTIONS } from "@/features/shared/lib/templateLayoutOptions";
import { cn } from "@/lib/utils";

const PREVIEW_DEBOUNCE_MS = 380;

type DocumentType = "factura" | "presupuesto";

type DesignDraft = {
  design: DesignConfig;
  business: DesignBusinessTexts;
};

function readDesignForType(profile: TemplateProfileConfig | null | undefined, docType: DocumentType) {
  if (!profile) {
    return DEFAULT_DESIGN;
  }
  if (docType === "presupuesto") {
    return mergeDesign(profile.designPresupuesto ?? profile.design);
  }
  return mergeDesign(profile.design);
}

function readDraft(profile: TemplateProfileConfig, docType: DocumentType): DesignDraft {
  const business = profile.business || {};
  return {
    design: readDesignForType(profile, docType),
    business: {
      referenceTopCopy: String(business.referenceTopCopy ?? ""),
      showReferenceTopCopy: business.showReferenceTopCopy !== false,
      footerUrl: String(business.footerUrl ?? ""),
      footerSloganTop: String(business.footerSloganTop ?? ""),
      footerSloganBottom: String(business.footerSloganBottom ?? ""),
      footerNote: String(business.footerNote ?? ""),
    },
  };
}

function buildSampleDocument(profileId: string, docType: DocumentType, draft: DesignDraft): InvoiceDocument {
  const base = createEmptyDocument();
  return {
    ...base,
    type: docType,
    templateProfileId: profileId,
    number: docType === "presupuesto" ? "P-2026-001" : "2026-001",
    series: "A",
    issueDate: getToday(),
    dueDate: "",
    reference: "Muestra de diseño",
    projectName: "Proyecto de ejemplo",
    templateLayout: draft.design.layout,
    design: { ...draft.design },
    client: {
      ...base.client,
      name: "Cliente de ejemplo S.L.",
      taxId: "B12345678",
      address: "Calle Ejemplo 1",
      city: "Las Palmas de Gran Canaria",
      province: "Las Palmas",
      email: "cliente@ejemplo.es",
    },
    items: [
      {
        concept: "Servicio de ejemplo",
        description: "Detalle de la línea para comprobar tipografías y tamaños.",
        quantity: 1,
        unitPrice: 300,
        unitLabel: "",
        hidePerPersonSubtotalInBudget: false,
      },
      {
        concept: "Segunda línea",
        description: "",
        quantity: 2,
        unitPrice: 75,
        unitLabel: "",
        hidePerPersonSubtotalInBudget: false,
      },
    ],
    taxRate: 7,
    withholdingRate: 0,
    totalsBasis: "items",
    manualGrossSubtotal: 0,
  };
}

function normalizeHex(value: string) {
  const raw = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/u.test(raw) ? raw : "#000000";
}

type RangeFieldProps = {
  designKey: DesignNumericKey;
  value: number;
  disabled: boolean;
  onChange: (next: number) => void;
};

function RangeField({ designKey, value, disabled, onChange }: RangeFieldProps) {
  const range = DESIGN_NUMERIC_RANGES[designKey];
  return (
    <Field label={range.label}>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          aria-label={`${range.label} (${range.unit})`}
          min={range.min}
          max={range.max}
          step={range.step}
          value={Number.isFinite(value) ? value : ""}
          disabled={disabled}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) {
              onChange(Math.min(range.max, Math.max(range.min, next)));
            }
          }}
          className="w-24"
        />
        <span className="text-xs text-informative">{range.unit}</span>
      </div>
      <input
        type="range"
        aria-label={`${range.label} deslizador`}
        min={range.min}
        max={range.max}
        step={range.step}
        value={Number.isFinite(value) ? value : range.min}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary"
      />
    </Field>
  );
}

type AlignFieldProps = {
  label: string;
  vertical?: boolean;
  value: string;
  disabled: boolean;
  onChange: (next: string) => void;
};

function AlignField({ label, vertical = false, value, disabled, onChange }: AlignFieldProps) {
  const options = vertical ? VERTICAL_ALIGN_OPTIONS : HORIZONTAL_ALIGN_OPTIONS;
  return (
    <Field label={label}>
      <Select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

type ColorFieldProps = {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (hex: string) => void;
};

function ColorField({ label, value, disabled, onChange }: ColorFieldProps) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`Selector ${label}`}
          value={normalizeHex(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-input bg-background"
        />
        <Input
          aria-label={`Hex ${label}`}
          value={value}
          maxLength={7}
          spellCheck={false}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="w-32 font-mono"
        />
      </div>
    </Field>
  );
}

export function DesignPage() {
  const configQuery = useQuery({ queryKey: ["runtime-config"], queryFn: fetchRuntimeConfig });
  const fontsCatalogQuery = useQuery({
    queryKey: ["fonts-catalog"],
    queryFn: fetchFontsCatalog,
    staleTime: 3_600_000,
  });
  const sessionQuery = useSessionQuery();
  const queryClient = useQueryClient();

  const serverProfiles = useMemo(
    () => configQuery.data?.templateProfiles ?? [],
    [configQuery.data?.templateProfiles],
  );
  const sessionScope = useMemo(
    () => resolveSessionScope(sessionQuery.data, serverProfiles),
    [sessionQuery.data, serverProfiles],
  );
  const profiles = useMemo(
    () => serverProfiles.filter((profile) => isTemplateProfileInScope(profile.id, sessionScope)),
    [serverProfiles, sessionScope],
  );
  const sessionRole = sessionQuery.data?.authenticated
    ? String(sessionQuery.data.user.role || "").trim().toLowerCase()
    : "";
  const sessionReady = !sessionQuery.isLoading && !sessionQuery.error;
  const canEdit =
    sessionReady && sessionScope.hasEmitterScope && (sessionRole === "admin" || sessionRole === "editor");

  const [profileId, setProfileId] = useState("");
  const [docType, setDocType] = useState<DocumentType>("factura");
  const [draft, setDraft] = useState<DesignDraft | null>(null);
  const [baseline, setBaseline] = useState<DesignDraft | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");

  const effectiveProfileId = profiles.some((profile) => profile.id === profileId)
    ? profileId
    : String(configQuery.data?.activeTemplateProfileId || profiles[0]?.id || "");
  const profile = profiles.find((item) => item.id === effectiveProfileId) || null;

  // Ajuste de estado en render al cambiar de emisor o de tipo de documento
  // (patrón recomendado por React frente a setState dentro de un efecto).
  const profileKey = profile ? `${profile.id}:${docType}` : "";
  if (profile && profileKey !== loadedKey) {
    const next = readDraft(profile, docType);
    setLoadedKey(profileKey);
    setDraft(next);
    setBaseline(next);
  }

  // Vista previa en vivo (debounce) con el diseño del borrador, sin guardar.
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!draft || !profile || !effectiveProfileId) {
      return;
    }
    let cancelled = false;

    const timer = globalThis.setTimeout(() => {
      const ac = new AbortController();
      previewAbortRef.current?.abort();
      previewAbortRef.current = ac;
      setPreviewLoading(true);
      setPreviewError(null);

      void (async () => {
        try {
          const blob = await fetchDesignPreviewBlob(
            {
              document: buildSampleDocument(effectiveProfileId, docType, draft),
              businessOverride: { ...draft.business },
            },
            ac.signal,
          );
          if (cancelled || ac.signal.aborted) {
            return;
          }
          if (previewObjectUrlRef.current) {
            URL.revokeObjectURL(previewObjectUrlRef.current);
          }
          const nextUrl = URL.createObjectURL(blob);
          previewObjectUrlRef.current = nextUrl;
          setPreviewSrc(nextUrl);
        } catch (error) {
          if (cancelled || ac.signal.aborted) {
            return;
          }
          setPreviewError(getErrorMessageFromUnknown(error));
        } finally {
          if (!cancelled && !ac.signal.aborted) {
            setPreviewLoading(false);
          }
        }
      })();
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, [draft, docType, effectiveProfileId, profile]);

  useEffect(
    () => () => {
      previewAbortRef.current?.abort();
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
    },
    [],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft || !profile) {
        throw new Error("No hay diseño que guardar.");
      }
      const snapshot = { draft, profileId: profile.id, docType };
      const nextProfiles = serverProfiles.map((item) => {
        if (item.id !== profile.id) {
          return item;
        }
        const next: TemplateProfileConfig = {
          ...item,
          business: { ...(item.business || {}), ...draft.business },
        };
        if (docType === "presupuesto") {
          next.designPresupuesto = { ...draft.design };
        } else {
          next.design = { ...draft.design };
        }
        return next;
      });
      const config = await saveTemplateProfilesConfig({
        activeTemplateProfileId: String(configQuery.data?.activeTemplateProfileId || profile.id),
        templateProfiles: nextProfiles,
      });
      return { config, snapshot };
    },
    onSuccess: async ({ snapshot }) => {
      setStatusTone("success");
      setStatusMessage("Diseño guardado. Las facturas y presupuestos nuevos ya salen con este estilo.");
      if (snapshot.profileId === effectiveProfileId && snapshot.docType === docType) {
        setBaseline(snapshot.draft);
      }
      await queryClient.invalidateQueries({ queryKey: ["runtime-config"] });
    },
    onError: (error) => {
      setStatusTone("error");
      setStatusMessage(getErrorMessageFromUnknown(error));
    },
  });

  const updateDesign = (patch: Partial<DesignConfig>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            design: { ...current.design, ...patch },
          }
        : current,
    );
  };

  const updateBusiness = (patch: Partial<DesignBusinessTexts>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            business: { ...current.business, ...patch },
          }
        : current,
    );
  };

  const isDirty = Boolean(draft && baseline && JSON.stringify(draft) !== JSON.stringify(baseline));
  const fontFamilies: string[] = fontsCatalogQuery.data?.families ?? [];
  const bodyFontValue = draft ? draft.design.bodyFontCustom || draft.design.bodyFontFamily || "" : "";
  const displayFontValue = draft ? draft.design.displayFontCustom || draft.design.displayFontFamily || "" : "";

  if (configQuery.isLoading) {
    return <p className="text-informative">Cargando diseño…</p>;
  }
  if (configQuery.error) {
    return <p className="text-danger">{getErrorMessageFromUnknown(configQuery.error)}</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Diseño"
        description="Mismos ajustes que la pestaña Diseño del legacy: plantilla, tipografías, colores y medidas del PDF. Los cambios se previsualizan al instante y se aplican al guardar."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={!canEdit || !draft || saveMutation.isPending || !isDirty}
            >
              {saveMutation.isPending ? "Guardando…" : "Guardar diseño"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!draft}
              onClick={() => {
                setDraft((current) =>
                  current ? { ...current, design: { ...DEFAULT_DESIGN } } : current,
                );
                setStatusTone("neutral");
                setStatusMessage("Estilo base aplicado en el formulario. Guarda para fijarlo.");
              }}
            >
              Estilo base
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!baseline || !isDirty}
              onClick={() => {
                setDraft(baseline);
                setStatusTone("neutral");
                setStatusMessage("Cambios descartados.");
              }}
            >
              Cancelar
            </Button>
          </div>
        }
      />

      {statusMessage ? (
        <p
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            statusTone === "success" && "border-emerald-300 bg-emerald-50 text-emerald-900",
            statusTone === "error" && "border-red-300 bg-red-50 text-red-900",
            statusTone === "neutral" && "border-border bg-muted/30 text-foreground",
          )}
        >
          {statusMessage}
        </p>
      ) : null}

      {!profiles.length ? (
        <p className="text-informative">No hay emisores en tu ámbito para editar el diseño.</p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,520px)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Emisor y documento</CardTitle>
              <CardDescription>
                Cada emisor tiene su propio diseño; factura y presupuesto pueden tener estilos distintos.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Emisor">
                <Select
                  aria-label="Emisor"
                  value={effectiveProfileId}
                  onChange={(event) => setProfileId(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {profiles.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label || item.id}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tipo de documento">
                <div className="flex gap-2" role="radiogroup" aria-label="Editar diseño para factura o presupuesto">
                  {(["factura", "presupuesto"] as const).map((value) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      role="radio"
                      aria-checked={docType === value}
                      variant={docType === value ? "default" : "outline"}
                      onClick={() => setDocType(value)}
                    >
                      {value === "factura" ? "Factura" : "Presupuesto"}
                    </Button>
                  ))}
                </div>
              </Field>
              <Field label="Plantilla (PDF)">
                <Select
                  aria-label="Plantilla PDF"
                  value={draft?.design.layout ?? ""}
                  disabled={!canEdit || !draft}
                  onChange={(event) => updateDesign({ layout: event.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Plantilla…</option>
                  {TEMPLATE_LAYOUT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                <ColorField
                  label="Acento"
                  value={draft?.design.accentColor ?? ""}
                  disabled={!canEdit || !draft}
                  onChange={(hex) => updateDesign({ accentColor: hex })}
                />
                <ColorField
                  label="Oscuro"
                  value={draft?.design.darkColor ?? ""}
                  disabled={!canEdit || !draft}
                  onChange={(hex) => updateDesign({ darkColor: hex })}
                />
              </div>
            </CardContent>
          </Card>

          {draft ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Logo</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <RangeField
                    designKey="logoWidthMm"
                    value={draft.design.logoWidthMm}
                    disabled={!canEdit}
                    onChange={(next) => updateDesign({ logoWidthMm: next })}
                  />
                  <AlignField
                    label="Justificación horizontal"
                    value={draft.design.brandAlignX}
                    disabled={!canEdit}
                    onChange={(next) => updateDesign({ brandAlignX: next as DesignConfig["brandAlignX"] })}
                  />
                  <AlignField
                    label="Posición vertical"
                    vertical
                    value={draft.design.brandAlignY}
                    disabled={!canEdit}
                    onChange={(next) => updateDesign({ brandAlignY: next as DesignConfig["brandAlignY"] })}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Servicios</CardTitle>
                  <CardDescription>
                    Bloque de texto superior del PDF. Si el texto está vacío se usan las palabras clave del perfil.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <Field label="Fuente Google texto">
                    <Select
                      aria-label="Fuente Google texto"
                      value={bodyFontValue}
                      disabled={!canEdit}
                      onChange={(event) => {
                        const family = event.target.value;
                        updateDesign({
                          bodyFont: "custom",
                          bodyFontProvider: "google",
                          bodyFontCustom: family,
                          bodyFontFamily: family,
                        });
                      }}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Google Sans Flex (por defecto)</option>
                      {fontFamilies.map((family) => (
                        <option key={family} value={family}>
                          {family}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Peso texto">
                    <Select
                      aria-label="Peso texto"
                      value={String(draft.design.bodyFontWeight)}
                      disabled={!canEdit}
                      onChange={(event) => updateDesign({ bodyFontWeight: Number(event.target.value) })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {FONT_WEIGHT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <RangeField
                    designKey="serviceTextSizePt"
                    value={draft.design.serviceTextSizePt}
                    disabled={!canEdit}
                    onChange={(next) => updateDesign({ serviceTextSizePt: next })}
                  />
                  <AlignField
                    label="Justificación horizontal"
                    value={draft.design.servicesAlignX}
                    disabled={!canEdit}
                    onChange={(next) => updateDesign({ servicesAlignX: next as DesignConfig["servicesAlignX"] })}
                  />
                  <AlignField
                    label="Posición vertical"
                    vertical
                    value={draft.design.servicesAlignY}
                    disabled={!canEdit}
                    onChange={(next) => updateDesign({ servicesAlignY: next as DesignConfig["servicesAlignY"] })}
                  />
                  <div className="sm:col-span-2">
                    <Field label="Texto servicios (una línea por servicio)">
                      <Textarea
                        aria-label="Texto servicios"
                        rows={4}
                        value={draft.business.referenceTopCopy}
                        disabled={!canEdit}
                        placeholder="Una línea por servicio. Si lo dejas vacío, se usarán las palabras clave del perfil."
                        onChange={(event) => updateBusiness({ referenceTopCopy: event.target.value })}
                      />
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.business.showReferenceTopCopy}
                      disabled={!canEdit}
                      onChange={(event) => updateBusiness({ showReferenceTopCopy: event.target.checked })}
                    />
                    <span>Mostrar bloque de servicios superior</span>
                  </label>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Título</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <Field label="Fuente Google titulares">
                    <Select
                      aria-label="Fuente Google titulares"
                      value={displayFontValue}
                      disabled={!canEdit}
                      onChange={(event) => {
                        const family = event.target.value;
                        updateDesign({
                          displayFont: "custom",
                          displayFontProvider: "google",
                          displayFontCustom: family,
                          displayFontFamily: family,
                        });
                      }}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Google Sans Flex (por defecto)</option>
                      {fontFamilies.map((family) => (
                        <option key={family} value={family}>
                          {family}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Peso titulares">
                    <Select
                      aria-label="Peso titulares"
                      value={String(draft.design.displayFontWeight)}
                      disabled={!canEdit}
                      onChange={(event) => updateDesign({ displayFontWeight: Number(event.target.value) })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {FONT_WEIGHT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <RangeField
                    designKey="titlePanelWidthMm"
                    value={draft.design.titlePanelWidthMm}
                    disabled={!canEdit}
                    onChange={(next) => updateDesign({ titlePanelWidthMm: next })}
                  />
                  <RangeField
                    designKey="titlePanelHeightMm"
                    value={draft.design.titlePanelHeightMm}
                    disabled={!canEdit}
                    onChange={(next) => updateDesign({ titlePanelHeightMm: next })}
                  />
                  <AlignField
                    label="Justificación horizontal"
                    value={draft.design.titleAlignX}
                    disabled={!canEdit}
                    onChange={(next) => updateDesign({ titleAlignX: next as DesignConfig["titleAlignX"] })}
                  />
                  <AlignField
                    label="Posición vertical"
                    vertical
                    value={draft.design.titleAlignY}
                    disabled={!canEdit}
                    onChange={(next) => updateDesign({ titleAlignY: next as DesignConfig["titleAlignY"] })}
                  />
                </CardContent>
              </Card>

              <details className="rounded-lg border border-border bg-card p-4" open>
                <summary className="cursor-pointer text-sm font-semibold">Ajustes finos</summary>
                <div className="mt-4 space-y-6">
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold">Datos superiores</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <RangeField
                        designKey="metaNumberSizePt"
                        value={draft.design.metaNumberSizePt}
                        disabled={!canEdit}
                        onChange={(next) => updateDesign({ metaNumberSizePt: next })}
                      />
                      <AlignField
                        label="CIF / email horizontal"
                        value={draft.design.issuerAlignX}
                        disabled={!canEdit}
                        onChange={(next) => updateDesign({ issuerAlignX: next as DesignConfig["issuerAlignX"] })}
                      />
                      <AlignField
                        label="CIF / email vertical"
                        vertical
                        value={draft.design.issuerAlignY}
                        disabled={!canEdit}
                        onChange={(next) => updateDesign({ issuerAlignY: next as DesignConfig["issuerAlignY"] })}
                      />
                      <AlignField
                        label="Fecha / número horizontal"
                        value={draft.design.issueAlignX}
                        disabled={!canEdit}
                        onChange={(next) => updateDesign({ issueAlignX: next as DesignConfig["issueAlignX"] })}
                      />
                      <AlignField
                        label="Fecha / número vertical"
                        vertical
                        value={draft.design.issueAlignY}
                        disabled={!canEdit}
                        onChange={(next) => updateDesign({ issueAlignY: next as DesignConfig["issueAlignY"] })}
                      />
                      <AlignField
                        label="Cliente horizontal"
                        value={draft.design.clientAlignX}
                        disabled={!canEdit}
                        onChange={(next) => updateDesign({ clientAlignX: next as DesignConfig["clientAlignX"] })}
                      />
                      <AlignField
                        label="Cliente vertical"
                        vertical
                        value={draft.design.clientAlignY}
                        disabled={!canEdit}
                        onChange={(next) => updateDesign({ clientAlignY: next as DesignConfig["clientAlignY"] })}
                      />
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold">Lateral y contenido</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <RangeField
                        designKey="leftColumnWidthMm"
                        value={draft.design.leftColumnWidthMm}
                        disabled={!canEdit}
                        onChange={(next) => updateDesign({ leftColumnWidthMm: next })}
                      />
                      <RangeField
                        designKey="bodySizePt"
                        value={draft.design.bodySizePt}
                        disabled={!canEdit}
                        onChange={(next) => updateDesign({ bodySizePt: next })}
                      />
                      <RangeField
                        designKey="detailSizePt"
                        value={draft.design.detailSizePt}
                        disabled={!canEdit}
                        onChange={(next) => updateDesign({ detailSizePt: next })}
                      />
                      <RangeField
                        designKey="itemTitleSizePt"
                        value={draft.design.itemTitleSizePt}
                        disabled={!canEdit}
                        onChange={(next) => updateDesign({ itemTitleSizePt: next })}
                      />
                      <RangeField
                        designKey="conceptSizePt"
                        value={draft.design.conceptSizePt}
                        disabled={!canEdit}
                        onChange={(next) => updateDesign({ conceptSizePt: next })}
                      />
                      <AlignField
                        label="Lateral horizontal"
                        value={draft.design.sideAlignX}
                        disabled={!canEdit}
                        onChange={(next) => updateDesign({ sideAlignX: next as DesignConfig["sideAlignX"] })}
                      />
                      <AlignField
                        label="Lateral vertical"
                        vertical
                        value={draft.design.sideAlignY}
                        disabled={!canEdit}
                        onChange={(next) => updateDesign({ sideAlignY: next as DesignConfig["sideAlignY"] })}
                      />
                      <AlignField
                        label="Concepto"
                        value={draft.design.itemConceptAlignX}
                        disabled={!canEdit}
                        onChange={(next) =>
                          updateDesign({
                            itemConceptAlignX: next as DesignConfig["itemConceptAlignX"],
                            mainAlignX: next as DesignConfig["mainAlignX"],
                            contentAlign: next === "left" ? "left" : "center",
                          })
                        }
                      />
                      <AlignField
                        label="Detalle"
                        value={draft.design.itemDetailAlignX}
                        disabled={!canEdit}
                        onChange={(next) => updateDesign({ itemDetailAlignX: next as DesignConfig["itemDetailAlignX"] })}
                      />
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold">Pie y cobro</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <RangeField
                        designKey="footerSloganSizePt"
                        value={draft.design.footerSloganSizePt}
                        disabled={!canEdit}
                        onChange={(next) => updateDesign({ footerSloganSizePt: next })}
                      />
                      <Field label="Peso número de cuenta">
                        <Select
                          aria-label="Peso número de cuenta"
                          value={String(draft.design.accountNumberWeight)}
                          disabled={!canEdit}
                          onChange={(event) => updateDesign({ accountNumberWeight: Number(event.target.value) })}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          {FONT_WEIGHT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <AlignField
                        label="Pie marca horizontal"
                        value={draft.design.footerAlignX}
                        disabled={!canEdit}
                        onChange={(next) => updateDesign({ footerAlignX: next as DesignConfig["footerAlignX"] })}
                      />
                      <AlignField
                        label="Pie marca vertical"
                        vertical
                        value={draft.design.footerAlignY}
                        disabled={!canEdit}
                        onChange={(next) => updateDesign({ footerAlignY: next as DesignConfig["footerAlignY"] })}
                      />
                      <AlignField
                        label="Bloque cobro horizontal"
                        value={draft.design.paymentAlignX}
                        disabled={!canEdit}
                        onChange={(next) => updateDesign({ paymentAlignX: next as DesignConfig["paymentAlignX"] })}
                      />
                      <AlignField
                        label="Bloque cobro vertical"
                        vertical
                        value={draft.design.paymentAlignY}
                        disabled={!canEdit}
                        onChange={(next) => updateDesign({ paymentAlignY: next as DesignConfig["paymentAlignY"] })}
                      />
                      <AlignField
                        label="Fila banco / cuenta"
                        value={draft.design.paymentBankAlignX}
                        disabled={!canEdit}
                        onChange={(next) =>
                          updateDesign({ paymentBankAlignX: next as DesignConfig["paymentBankAlignX"] })
                        }
                      />
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold">Pie y cierre</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="URL pie">
                        <Input
                          aria-label="URL pie"
                          value={draft.business.footerUrl}
                          disabled={!canEdit}
                          placeholder="pearandco.es"
                          onChange={(event) => updateBusiness({ footerUrl: event.target.value })}
                        />
                      </Field>
                      <Field label="Slogan superior">
                        <Input
                          aria-label="Slogan superior"
                          value={draft.business.footerSloganTop}
                          disabled={!canEdit}
                          placeholder="CREAMOS"
                          onChange={(event) => updateBusiness({ footerSloganTop: event.target.value })}
                        />
                      </Field>
                      <Field label="Slogan inferior">
                        <Input
                          aria-label="Slogan inferior"
                          value={draft.business.footerSloganBottom}
                          disabled={!canEdit}
                          placeholder="SOLUCIONES"
                          onChange={(event) => updateBusiness({ footerSloganBottom: event.target.value })}
                        />
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="Nota pie">
                          <Textarea
                            aria-label="Nota pie"
                            rows={3}
                            value={draft.business.footerNote}
                            disabled={!canEdit}
                            placeholder="Texto legal o nota final"
                            onChange={(event) => updateBusiness({ footerNote: event.target.value })}
                          />
                        </Field>
                      </div>
                    </div>
                  </section>
                </div>
              </details>
            </>
          ) : null}
        </div>

        <div className="xl:sticky xl:top-4 xl:self-start">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Vista previa</CardTitle>
                <CardDescription>Muestra de {docType === "presupuesto" ? "presupuesto" : "factura"} con el diseño actual.</CardDescription>
              </div>
              {previewLoading ? <span className="text-xs text-informative">Actualizando…</span> : null}
            </CardHeader>
            <CardContent>
              {previewError ? <p className="text-sm text-danger">{previewError}</p> : null}
              {previewSrc ? (
                <div className="overflow-hidden rounded-xl border border-border bg-white">
                  <ScaledHtmlPreview
                    src={previewSrc}
                    boxClassName="h-[min(70dvh,860px)] w-full"
                    zoomSteps={0}
                    blockIframePointer
                    docType={docType}
                  />
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-8 text-center text-sm text-informative">
                  Generando vista previa…
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
