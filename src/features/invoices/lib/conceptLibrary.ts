/**
 * Biblioteca de conceptos predefinidos.
 * Almacenamiento en localStorage — CRUD completo.
 */

export type LibraryConcept = {
  id: string;
  concept: string;
  description: string;
  unitPrice: number | null;
};

const STORAGE_KEY = "facturacion-concept-library";

function generateId(): string {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Lee toda la biblioteca del localStorage. */
export function loadConceptLibrary(): LibraryConcept[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultConcepts();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return getDefaultConcepts();
    return parsed as LibraryConcept[];
  } catch {
    return getDefaultConcepts();
  }
}

/** Guarda toda la biblioteca. */
function persistLibrary(concepts: LibraryConcept[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(concepts));
  } catch {
    // localStorage lleno — fallo silencioso
  }
}

/** Añade un concepto. */
export function addConcept(concept: Omit<LibraryConcept, "id">): LibraryConcept {
  const lib = loadConceptLibrary();
  const entry: LibraryConcept = { id: generateId(), ...concept };
  lib.push(entry);
  persistLibrary(lib);
  return entry;
}

/** Actualiza un concepto existente. */
export function updateConcept(id: string, updates: Partial<Omit<LibraryConcept, "id">>): void {
  const lib = loadConceptLibrary();
  const idx = lib.findIndex((c) => c.id === id);
  if (idx < 0) return;
  const existing = lib[idx];
  if (!existing) return;
  lib[idx] = { ...existing, ...updates };
  persistLibrary(lib);
}

/** Elimina un concepto. */
export function deleteConcept(id: string): void {
  const lib = loadConceptLibrary().filter((c) => c.id !== id);
  persistLibrary(lib);
}

/** Conceptos de ejemplo que se cargan la primera vez. */
export function getDefaultConcepts(): LibraryConcept[] {
  return [
    {
      id: "default_1",
      concept: "Diseño identidad visual",
      description: "Diseño completo de identidad visual corporativa incluyendo logotipo, paleta de colores y tipografías",
      unitPrice: 650,
    },
    {
      id: "default_2",
      concept: "Desarrollo web WordPress",
      description: "Desarrollo de sitio web corporativo con WordPress, diseño responsive y SEO básico",
      unitPrice: 1200,
    },
    {
      id: "default_3",
      concept: "Servicio de catering - Croissants variados",
      description: "Surtido de croissants variados (mantequilla, chocolate, almendra) para evento",
      unitPrice: 3.5,
    },
    {
      id: "default_4",
      concept: "Servicio de catering - Menú completo",
      description: "Menú completo por comensal: entrante, principal, postre y bebida",
      unitPrice: 28,
    },
    {
      id: "default_5",
      concept: "Mantenimiento web mensual",
      description: "Mantenimiento mensual: actualizaciones, copias de seguridad, monitorización y soporte básico",
      unitPrice: 90,
    },
    {
      id: "default_6",
      concept: "Sesión fotográfica",
      description: "Sesión fotográfica profesional con edición y entrega de archivos digitales",
      unitPrice: null,
    },
    {
      id: "default_7",
      concept: "Adaptaciones de logotipo",
      description: "Adaptaciones del logotipo a diferentes formatos y soportes",
      unitPrice: 180,
    },
  ];
}
