/** Microcopy compartido para acciones de UI (evitar divergencias entre pantallas). */

export const SAVE = "Guardar";
export const CANCEL = "Cancelar";
export const CLOSE = "Cerrar";

/**
 * Texto del botón u otra etiqueta mientras persiste un guardado.
 * `labelBase` queda reservado por si en el futuro se usa variante tipo «Guardando emisor…».
 */
export function savePending(_labelBase?: string): string {
  void _labelBase;
  return "Guardando...";
}
