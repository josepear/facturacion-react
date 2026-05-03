/** Clave que usa la SPA React para no volver a mostrar el wizard de primera visita. */
export const FIRST_USE_WIZARD_REACT_SEEN_KEY = "facturacion-wizard-seen";

/**
 * Clave del wizard «Orden sugerido la primera vez» en el monolito legacy (`public/app.js`,
 * `#first-use-wizard-modal`, botón «No volver a mostrar»).
 */
export const FIRST_USE_WIZARD_LEGACY_DISMISSED_KEY = "facturacion-first-use-wizard-dismissed";

export const FIRST_USE_WIZARD_STORAGE_KEYS = {
  react: FIRST_USE_WIZARD_REACT_SEEN_KEY,
  legacy: FIRST_USE_WIZARD_LEGACY_DISMISSED_KEY,
} as const;

function isWizardDismissedValue(value: string | null): boolean {
  return value === "1";
}

/** True si el usuario ya descartó el wizard en React o en legacy (mismo navegador). */
export function hasFirstUseWizardBeenDismissed(): boolean {
  try {
    if (typeof localStorage === "undefined" || typeof localStorage.getItem !== "function") {
      return false;
    }
    return (
      isWizardDismissedValue(localStorage.getItem(FIRST_USE_WIZARD_REACT_SEEN_KEY)) ||
      isWizardDismissedValue(localStorage.getItem(FIRST_USE_WIZARD_LEGACY_DISMISSED_KEY))
    );
  } catch {
    return false;
  }
}

/** Persiste el cierre en ambas claves para alinear React y la app legacy en `/`. */
export function markFirstUseWizardDismissed(): void {
  try {
    localStorage.setItem(FIRST_USE_WIZARD_REACT_SEEN_KEY, "1");
    localStorage.setItem(FIRST_USE_WIZARD_LEGACY_DISMISSED_KEY, "1");
  } catch {
    // El navegador puede bloquear localStorage (modo privado, políticas).
  }
}
