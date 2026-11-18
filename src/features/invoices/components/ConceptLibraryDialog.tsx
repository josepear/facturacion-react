import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addConcept,
  deleteConcept,
  type LibraryConcept,
  loadConceptLibrary,
  updateConcept,
} from "@/features/invoices/lib/conceptLibrary";

type ConceptLibraryDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Cuando el usuario elige un concepto para insertarlo en la factura. */
  onPickConcept?: (concept: LibraryConcept) => void;
  /** Modo: "manage" para gestionar la biblioteca, "pick" para elegir un concepto. */
  mode?: "manage" | "pick";
};

type EditingState = {
  id: string | null; // null = nuevo
  concept: string;
  description: string;
  unitPrice: string;
};

const EMPTY_EDIT: EditingState = { id: null, concept: "", description: "", unitPrice: "" };

export function ConceptLibraryDialog({ open, onClose, onPickConcept, mode = "manage" }: ConceptLibraryDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [concepts, setConcepts] = useState<LibraryConcept[]>([]);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [search, setSearch] = useState("");

  const reload = useCallback(() => setConcepts(loadConceptLibrary()), []);

  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  function handleSaveEdit() {
    if (!editing || !editing.concept.trim()) return;
    const price = editing.unitPrice.trim() ? Number(editing.unitPrice) : null;
    if (editing.id) {
      updateConcept(editing.id, {
        concept: editing.concept.trim(),
        description: editing.description.trim(),
        unitPrice: price !== null && Number.isFinite(price) ? price : null,
      });
    } else {
      addConcept({
        concept: editing.concept.trim(),
        description: editing.description.trim(),
        unitPrice: price !== null && Number.isFinite(price) ? price : null,
      });
    }
    setEditing(null);
    reload();
  }

  function handleDelete(id: string) {
    if (!window.confirm("¿Eliminar este concepto de la biblioteca?")) return;
    deleteConcept(id);
    reload();
  }

  const filtered = search.trim()
    ? concepts.filter(
        (c) =>
          c.concept.toLowerCase().includes(search.toLowerCase()) ||
          c.description.toLowerCase().includes(search.toLowerCase()),
      )
    : concepts;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 z-50 m-auto max-h-[85dvh] w-[calc(100vw-1rem)] max-w-2xl overflow-hidden rounded-xl border border-border bg-background p-0 shadow-xl backdrop:bg-black/40"
    >
      <div className="flex h-full max-h-[85dvh] flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-lg font-semibold">
            {mode === "pick" ? "Elegir concepto" : "Biblioteca de conceptos"}
          </h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search + Add */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-5 py-3">
          <Input
            placeholder="Buscar concepto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1"
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0 gap-1"
            onClick={() => setEditing({ ...EMPTY_EDIT })}
          >
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        </div>

        {/* Edit form */}
        {editing ? (
          <div className="border-b border-border/60 bg-muted/30 px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs sm:col-span-2">
                <span className="font-medium">Nombre del concepto *</span>
                <Input
                  value={editing.concept}
                  onChange={(e) => setEditing({ ...editing, concept: e.target.value })}
                  placeholder="Ej: Diseño identidad visual"
                  autoFocus
                />
              </label>
              <label className="grid gap-1 text-xs sm:col-span-2">
                <span className="font-medium">Descripción</span>
                <Textarea
                  rows={2}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Detalle del concepto"
                />
              </label>
              <label className="grid gap-1 text-xs">
                <span className="font-medium">Precio unitario (EUR)</span>
                <Input
                  type="number"
                  step="0.01"
                  value={editing.unitPrice}
                  onChange={(e) => setEditing({ ...editing, unitPrice: e.target.value })}
                  placeholder="Opcional"
                />
              </label>
              <div className="flex items-end gap-2">
                <Button type="button" onClick={handleSaveEdit} disabled={!editing.concept.trim()}>
                  {editing.id ? "Actualizar" : "Añadir"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {search ? "Sin resultados para esta búsqueda." : "La biblioteca está vacía. Añade tu primer concepto."}
            </p>
          ) : (
            <div className="grid gap-2">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  className="group flex flex-col gap-2 rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-start sm:gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-medium text-foreground">{c.concept}</span>
                      {c.unitPrice !== null ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {c.unitPrice.toLocaleString("es-ES", { minimumFractionDigits: 2 })} EUR
                        </span>
                      ) : null}
                    </div>
                    {c.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                    ) : null}
                  </div>
                  <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
                    {mode === "pick" && onPickConcept ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          onPickConcept(c);
                          onClose();
                        }}
                      >
                        Usar
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      title="Editar"
                      onClick={() =>
                        setEditing({
                          id: c.id,
                          concept: c.concept,
                          description: c.description,
                          unitPrice: c.unitPrice !== null ? String(c.unitPrice) : "",
                        })
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      title="Eliminar"
                      onClick={() => handleDelete(c.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="text-xs text-muted-foreground">{concepts.length} conceptos en biblioteca</span>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </dialog>
  );
}
