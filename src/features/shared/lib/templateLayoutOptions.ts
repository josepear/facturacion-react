/** Opciones de plantilla PDF / layout compartidas entre Facturar y Configuración (emisores). */
export const TEMPLATE_LAYOUT_OPTIONS = [
  { value: "pear", label: "Pear&co. clásica" },
  { value: "editorial", label: "Editorial / Nacho" },
  { value: "voulita", label: "Eventos / La Jaulita" },
] as const;

export type TemplateLayoutValue = (typeof TEMPLATE_LAYOUT_OPTIONS)[number]["value"];
