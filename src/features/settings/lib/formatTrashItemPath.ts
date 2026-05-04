/**
 * Etiquetas cortas para rutas/URLs largas de la papelera (listado en Configuración).
 * La ruta completa debe seguir en `title` / data para borrado (sigue siendo `item.path`).
 */
export function formatTrashItemPath(fullPath: string): { primary: string; secondary?: string } {
  const raw = String(fullPath || "").trim();
  if (!raw) {
    return { primary: "—" };
  }

  if (/^https?:\/\//iu.test(raw)) {
    try {
      const u = new URL(raw);
      const segments = u.pathname.split("/").filter(Boolean);
      const last = segments.length ? decodeURIComponent(segments[segments.length - 1] ?? "") : "";
      const primary = last || u.hostname || raw;
      const pathPart = u.pathname.length > 64 ? `${u.pathname.slice(0, 32)}…${u.pathname.slice(-24)}` : u.pathname;
      const secondary = `${u.host}${pathPart}`;
      return { primary, secondary };
    } catch {
      return { primary: raw.length > 80 ? `${raw.slice(0, 40)}…${raw.slice(-28)}` : raw };
    }
  }

  const normalized = raw.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  const base = parts.length ? parts[parts.length - 1] ?? "" : raw;
  const primary = base || raw;

  const parentParts = parts.slice(0, -1);
  if (parentParts.length === 0) {
    return { primary };
  }

  const papeleraIdx = parentParts.findIndex((p) => p === "_papelera" || p === ".papelera");
  const fromPapelera =
    papeleraIdx >= 0 ? parentParts.slice(papeleraIdx).join("/") : parentParts.slice(-4).join("/");
  let secondary = fromPapelera;
  if (secondary.length > 72) {
    secondary = `…/${parentParts.slice(-3).join("/")}`;
  }

  return { primary, secondary };
}
