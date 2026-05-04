import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrashCategoryColumn } from "@/features/settings/components/TrashCategoryColumn";
import { getErrorMessageFromUnknown } from "@/infrastructure/api/httpClient";
import { deleteTrashEntries, emptyTrash, fetchTrash, type TrashItem } from "@/infrastructure/api/trashApi";

const EMPTY_TRASH_ITEMS: TrashItem[] = [];

export function TrashSection({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const trashQuery = useQuery({
    queryKey: ["trash"],
    queryFn: fetchTrash,
    enabled: canEdit,
  });
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [status, setStatus] = useState<{ text: string; tone: "success" | "error" | "neutral" } | null>(null);

  const items = trashQuery.data?.items ?? EMPTY_TRASH_ITEMS;
  const summary = trashQuery.data?.summary ?? {
    total: 0,
    totalGroups: 0,
    byCategory: {},
    byFileType: {},
  };

  useEffect(() => {
    if (!items.length) {
      setSelectedPaths([]);
      return;
    }
    const available = new Set(items.map((item) => item.path));
    setSelectedPaths((prev) => prev.filter((path) => available.has(path)));
  }, [items]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, TrashItem[]> = {
      documentos: [],
      gastos: [],
      clientes: [],
      otros: [],
    };
    items.forEach((item) => {
      groups[item.category] = [...(groups[item.category] ?? []), item];
    });
    return groups;
  }, [items]);

  const emptyMutation = useMutation({
    mutationFn: emptyTrash,
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["trash"] });
      setSelectedPaths([]);
      setStatus({
        text: `Papelera vaciada. Elementos eliminados: ${Number(data.removedEntries ?? 0)}.`,
        tone: "success",
      });
    },
    onError: (error) => {
      setStatus({ text: `Error al vaciar: ${getErrorMessageFromUnknown(error)}`, tone: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (paths: string[]) => deleteTrashEntries(paths),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["trash"] });
      setSelectedPaths([]);
      setStatus({ text: "Elementos seleccionados borrados.", tone: "success" });
    },
    onError: (error) => {
      setStatus({ text: `Error al borrar: ${getErrorMessageFromUnknown(error)}`, tone: "error" });
    },
  });

  if (!canEdit) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Papelera</CardTitle>
        <CardDescription>Gestión de archivos archivados. Solo administradores.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {trashQuery.isLoading ? (
          <p className="text-informative">Cargando papelera...</p>
        ) : trashQuery.isError ? (
          <p className="text-sm text-red-600">{getErrorMessageFromUnknown(trashQuery.error)}</p>
        ) : (
          <>
            <div className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
              <p className="sm:col-span-2 lg:col-span-1">
                <strong>Total:</strong> {summary.total}
              </p>
              <p>
                <strong>Documentos:</strong> {Number(summary.byCategory.documentos ?? 0)}
              </p>
              <p>
                <strong>Gastos:</strong> {Number(summary.byCategory.gastos ?? 0)}
              </p>
              <p>
                <strong>Clientes:</strong> {Number(summary.byCategory.clientes ?? 0)}
              </p>
              <p>
                <strong>Otros:</strong> {Number(summary.byCategory.otros ?? 0)}
              </p>
            </div>

            {items.length === 0 ? (
              <p className="text-informative">La papelera está vacía.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-4 lg:grid-cols-3 lg:items-start lg:gap-3">
                <TrashCategoryColumn
                  title="Documentos"
                  items={groupedItems.documentos ?? []}
                  selectedPaths={selectedPaths}
                  setSelectedPaths={setSelectedPaths}
                />
                <TrashCategoryColumn
                  title="Gastos"
                  items={groupedItems.gastos ?? []}
                  selectedPaths={selectedPaths}
                  setSelectedPaths={setSelectedPaths}
                />
                <TrashCategoryColumn
                  title="Clientes"
                  items={groupedItems.clientes ?? []}
                  selectedPaths={selectedPaths}
                  setSelectedPaths={setSelectedPaths}
                  className="md:col-span-2 lg:col-span-1"
                />
                {(groupedItems.otros ?? []).length > 0 ? (
                  <TrashCategoryColumn
                    title="Otros"
                    items={groupedItems.otros ?? []}
                    selectedPaths={selectedPaths}
                    setSelectedPaths={setSelectedPaths}
                    className="md:col-span-2 lg:col-span-3"
                  />
                ) : null}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={emptyMutation.isPending || deleteMutation.isPending || items.length === 0}
                onClick={() => {
                  const confirmed = window.confirm("Se borrará todo el contenido de la papelera. ¿Continuar?");
                  if (!confirmed) {
                    return;
                  }
                  emptyMutation.mutate();
                }}
              >
                {emptyMutation.isPending ? "Vaciando..." : "Vaciar papelera"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={deleteMutation.isPending || emptyMutation.isPending || selectedPaths.length === 0}
                onClick={() => {
                  const confirmed = window.confirm(`Se borrarán ${selectedPaths.length} elementos seleccionados. ¿Continuar?`);
                  if (!confirmed) {
                    return;
                  }
                  deleteMutation.mutate(selectedPaths);
                }}
              >
                {deleteMutation.isPending ? "Borrando..." : "Borrar seleccionados"}
              </Button>
            </div>
          </>
        )}
        {status ? (
          <p
            className={
              status.tone === "error"
                ? "text-sm text-red-600"
                : status.tone === "success"
                  ? "text-sm text-emerald-600"
                  : "text-informative"
            }
          >
            {status.text}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
