/**
 * Modelo y valores por defecto del diseño del documento (plantilla PDF).
 *
 * Debe mantenerse alineado con `DEFAULT_DESIGN` y `normalizeDesign` de
 * `public/modules/document-core.mjs` del backend: el documento final lo renderiza
 * el servidor y aquí solo editamos sus parámetros.
 */

export type HorizontalAlign = "left" | "center" | "right";
export type VerticalAlign = "top" | "center" | "bottom";

export type DesignConfig = {
  layout: string;
  contentAlign: "left" | "center";
  bodyFont: string;
  bodyFontCustom: string;
  bodyFontProvider: string;
  bodyFontFamily?: string;
  bodyFontWeight: number;
  displayFont: string;
  displayFontCustom: string;
  displayFontProvider: string;
  displayFontFamily?: string;
  displayFontWeight: number;
  accentColor: string;
  darkColor: string;
  bodySizePt: number;
  detailSizePt: number;
  serviceTextSizePt: number;
  itemTitleSizePt: number;
  conceptSizePt: number;
  metaNumberSizePt: number;
  footerSloganSizePt: number;
  accountNumberWeight: number;
  leftColumnWidthMm: number;
  logoWidthMm: number;
  titlePanelWidthMm: number;
  titlePanelHeightMm: number;
  brandAlignX: HorizontalAlign;
  brandAlignY: VerticalAlign;
  servicesAlignX: HorizontalAlign;
  servicesAlignY: VerticalAlign;
  titleAlignX: HorizontalAlign;
  titleAlignY: VerticalAlign;
  issuerAlignX: HorizontalAlign;
  issuerAlignY: VerticalAlign;
  issueAlignX: HorizontalAlign;
  issueAlignY: VerticalAlign;
  clientAlignX: HorizontalAlign;
  clientAlignY: VerticalAlign;
  sideAlignX: HorizontalAlign;
  sideAlignY: VerticalAlign;
  mainAlignX: HorizontalAlign;
  itemConceptAlignX: HorizontalAlign;
  itemDetailAlignX: HorizontalAlign;
  footerAlignX: HorizontalAlign;
  footerAlignY: VerticalAlign;
  paymentAlignX: HorizontalAlign;
  paymentAlignY: VerticalAlign;
  paymentBankAlignX: HorizontalAlign;
};

/** Textos de emisor que el legacy edita en la pestaña «Diseño» (viven en `business`). */
export type DesignBusinessTexts = {
  referenceTopCopy: string;
  showReferenceTopCopy: boolean;
  footerUrl: string;
  footerSloganTop: string;
  footerSloganBottom: string;
  footerNote: string;
};

/** Copia de `DEFAULT_DESIGN` del backend (`document-core.mjs`). */
export const DEFAULT_DESIGN: DesignConfig = {
  layout: "pear",
  contentAlign: "center",
  bodyFont: "googlesans",
  bodyFontCustom: "",
  bodyFontProvider: "google",
  bodyFontWeight: 400,
  displayFont: "googlesans",
  displayFontCustom: "",
  displayFontProvider: "google",
  displayFontWeight: 400,
  accentColor: "#ec1e63",
  darkColor: "#4b4b4b",
  bodySizePt: 7.6,
  detailSizePt: 7.6,
  serviceTextSizePt: 7.6,
  itemTitleSizePt: 12.8,
  conceptSizePt: 12.8,
  metaNumberSizePt: 15.5,
  footerSloganSizePt: 18.4,
  accountNumberWeight: 500,
  leftColumnWidthMm: 34,
  logoWidthMm: 34,
  titlePanelWidthMm: 41,
  titlePanelHeightMm: 31,
  brandAlignX: "center",
  brandAlignY: "center",
  servicesAlignX: "left",
  servicesAlignY: "top",
  titleAlignX: "center",
  titleAlignY: "center",
  issuerAlignX: "center",
  issuerAlignY: "center",
  issueAlignX: "center",
  issueAlignY: "center",
  clientAlignX: "left",
  clientAlignY: "top",
  sideAlignX: "center",
  sideAlignY: "top",
  mainAlignX: "center",
  itemConceptAlignX: "center",
  itemDetailAlignX: "center",
  footerAlignX: "left",
  footerAlignY: "bottom",
  paymentAlignX: "left",
  paymentAlignY: "bottom",
  paymentBankAlignX: "right",
};

export const DEFAULT_DESIGN_BUSINESS_TEXTS: DesignBusinessTexts = {
  referenceTopCopy: "",
  showReferenceTopCopy: true,
  footerUrl: "",
  footerSloganTop: "",
  footerSloganBottom: "",
  footerNote: "",
};

export const FONT_WEIGHT_OPTIONS = [
  { value: 300, label: "Light" },
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semi Bold" },
  { value: 700, label: "Bold" },
  { value: 800, label: "Extra Bold" },
] as const;

export const HORIZONTAL_ALIGN_OPTIONS: Array<{ value: HorizontalAlign; label: string }> = [
  { value: "left", label: "Izquierda" },
  { value: "center", label: "Centro" },
  { value: "right", label: "Derecha" },
];

export const VERTICAL_ALIGN_OPTIONS: Array<{ value: VerticalAlign; label: string }> = [
  { value: "top", label: "Arriba" },
  { value: "center", label: "Centro" },
  { value: "bottom", label: "Abajo" },
];

/** Rangos de los sliders (mm/pt) tal como los expone el legacy. */
export const DESIGN_NUMERIC_RANGES = {
  logoWidthMm: { min: 22, max: 45, step: 0.5, unit: "mm", label: "Anchura logo" },
  serviceTextSizePt: { min: 6, max: 12, step: 0.1, unit: "pt", label: "Texto servicios" },
  titlePanelWidthMm: { min: 28, max: 55, step: 0.5, unit: "mm", label: "Anchura caja título" },
  titlePanelHeightMm: { min: 20, max: 45, step: 0.5, unit: "mm", label: "Altura caja título" },
  metaNumberSizePt: { min: 10, max: 22, step: 0.1, unit: "pt", label: "Número fecha/factura" },
  leftColumnWidthMm: { min: 24, max: 48, step: 0.5, unit: "mm", label: "Anchura columna izquierda" },
  bodySizePt: { min: 6, max: 12, step: 0.1, unit: "pt", label: "Texto base" },
  detailSizePt: { min: 6, max: 12, step: 0.1, unit: "pt", label: "Detalle" },
  itemTitleSizePt: { min: 10, max: 20, step: 0.1, unit: "pt", label: "Título principal" },
  conceptSizePt: { min: 10, max: 20, step: 0.1, unit: "pt", label: "Concepto" },
  footerSloganSizePt: { min: 14, max: 30, step: 0.1, unit: "pt", label: "Slogan pie" },
} as const;

export type DesignNumericKey = keyof typeof DESIGN_NUMERIC_RANGES;

function toFiniteNumber(value: unknown, fallback: number) {
  const numeric = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  if (value === "" || value === null || value === undefined) {
    return fallback;
  }
  return Math.min(max, Math.max(min, toFiniteNumber(value, fallback)));
}

function pickHorizontal(value: unknown, fallback: HorizontalAlign): HorizontalAlign {
  return value === "left" || value === "center" || value === "right" ? value : fallback;
}

function pickVertical(value: unknown, fallback: VerticalAlign): VerticalAlign {
  return value === "top" || value === "center" || value === "bottom" ? value : fallback;
}

function pickFontWeight(value: unknown, fallback: number) {
  const numeric = toFiniteNumber(value, fallback);
  return FONT_WEIGHT_OPTIONS.some((option) => option.value === numeric) ? numeric : fallback;
}

/**
 * Normaliza el diseño que llega del servidor (o de un borrador local) a un objeto
 * completo y seguro para los controles. No inventa reglas nuevas: replica los
 * clamps de `normalizeDesign` del backend.
 */
export function mergeDesign(raw: unknown): DesignConfig {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_DESIGN;
  const layout = ["pear", "editorial", "voulita"].includes(String(source.layout || ""))
    ? String(source.layout)
    : d.layout;

  return {
    layout,
    contentAlign: source.contentAlign === "left" ? "left" : "center",
    bodyFont: String(source.bodyFont || d.bodyFont),
    bodyFontCustom: String(source.bodyFontCustom ?? ""),
    bodyFontProvider: String(source.bodyFontProvider || d.bodyFontProvider),
    bodyFontWeight: pickFontWeight(source.bodyFontWeight, d.bodyFontWeight),
    displayFont: String(source.displayFont || d.displayFont),
    displayFontCustom: String(source.displayFontCustom ?? ""),
    displayFontProvider: String(source.displayFontProvider || d.displayFontProvider),
    displayFontWeight: pickFontWeight(source.displayFontWeight, d.displayFontWeight),
    accentColor: String(source.accentColor || d.accentColor),
    darkColor: String(source.darkColor || d.darkColor),
    bodySizePt: clampNumber(source.bodySizePt, 6, 12, d.bodySizePt),
    detailSizePt: clampNumber(source.detailSizePt ?? source.bodySizePt, 6, 12, d.detailSizePt),
    serviceTextSizePt: clampNumber(source.serviceTextSizePt, 6, 12, d.serviceTextSizePt),
    itemTitleSizePt: clampNumber(source.itemTitleSizePt, 10, 20, d.itemTitleSizePt),
    conceptSizePt: clampNumber(source.conceptSizePt ?? source.itemTitleSizePt, 10, 20, d.conceptSizePt),
    metaNumberSizePt: clampNumber(source.metaNumberSizePt, 10, 22, d.metaNumberSizePt),
    footerSloganSizePt: clampNumber(source.footerSloganSizePt, 14, 30, d.footerSloganSizePt),
    accountNumberWeight: pickFontWeight(source.accountNumberWeight, d.accountNumberWeight),
    leftColumnWidthMm: clampNumber(source.leftColumnWidthMm, 24, 48, d.leftColumnWidthMm),
    logoWidthMm: clampNumber(source.logoWidthMm, 22, 45, d.logoWidthMm),
    titlePanelWidthMm: clampNumber(source.titlePanelWidthMm, 28, 55, d.titlePanelWidthMm),
    titlePanelHeightMm: clampNumber(source.titlePanelHeightMm, 20, 45, d.titlePanelHeightMm),
    brandAlignX: pickHorizontal(source.brandAlignX, d.brandAlignX),
    brandAlignY: pickVertical(source.brandAlignY, d.brandAlignY),
    servicesAlignX: pickHorizontal(source.servicesAlignX, d.servicesAlignX),
    servicesAlignY: pickVertical(source.servicesAlignY, d.servicesAlignY),
    titleAlignX: pickHorizontal(source.titleAlignX, d.titleAlignX),
    titleAlignY: pickVertical(source.titleAlignY, d.titleAlignY),
    issuerAlignX: pickHorizontal(source.issuerAlignX, d.issuerAlignX),
    issuerAlignY: pickVertical(source.issuerAlignY, d.issuerAlignY),
    issueAlignX: pickHorizontal(source.issueAlignX, d.issueAlignX),
    issueAlignY: pickVertical(source.issueAlignY, d.issueAlignY),
    clientAlignX: pickHorizontal(source.clientAlignX, d.clientAlignX),
    clientAlignY: pickVertical(source.clientAlignY, d.clientAlignY),
    sideAlignX: pickHorizontal(source.sideAlignX, d.sideAlignX),
    sideAlignY: pickVertical(source.sideAlignY, d.sideAlignY),
    mainAlignX: pickHorizontal(source.mainAlignX ?? source.itemConceptAlignX, d.mainAlignX),
    itemConceptAlignX: pickHorizontal(source.itemConceptAlignX ?? source.mainAlignX, d.itemConceptAlignX),
    itemDetailAlignX: pickHorizontal(source.itemDetailAlignX, d.itemDetailAlignX),
    footerAlignX: pickHorizontal(source.footerAlignX, d.footerAlignX),
    footerAlignY: pickVertical(source.footerAlignY, d.footerAlignY),
    paymentAlignX: pickHorizontal(source.paymentAlignX, d.paymentAlignX),
    paymentAlignY: pickVertical(source.paymentAlignY, d.paymentAlignY),
    paymentBankAlignX: pickHorizontal(source.paymentBankAlignX, d.paymentBankAlignX),
  };
}
