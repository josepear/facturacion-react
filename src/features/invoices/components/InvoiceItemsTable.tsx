import { Trash2 } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InvoiceDocument } from "@/domain/document/types";

type InvoiceItemsTableProps = {
  register: UseFormRegister<InvoiceDocument>;
  errors: FieldErrors<InvoiceDocument>;
  itemCount: number;
  totalsBasis: "items" | "gross";
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
};

export function InvoiceItemsTable({
  register,
  errors,
  itemCount,
  totalsBasis,
  onAddItem,
  onRemoveItem,
}: InvoiceItemsTableProps) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Líneas</h2>
        <Button type="button" variant="outline" onClick={onAddItem}>
          Añadir línea
        </Button>
      </div>

      {Array.from({ length: itemCount }).map((_, index) => (
        <div key={index} className="grid gap-3 rounded-md border p-3 sm:grid-cols-12">
          <div className="sm:col-span-4">
            <label className="grid gap-1 text-xs">
              <span>Concepto</span>
              <Input placeholder="Servicio" {...register(`items.${index}.concept`)} />
            </label>
          </div>
          <div className="sm:col-span-4">
            <label className="grid gap-1 text-xs">
              <span>Descripción</span>
              <Input placeholder="Detalle" {...register(`items.${index}.description`)} />
            </label>
          </div>
          <div className="sm:col-span-1">
            <label className="grid gap-1 text-xs">
              <span>Cant.</span>
              <Input type="number" step="1" {...register(`items.${index}.quantity`, { valueAsNumber: true })} />
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="grid gap-1 text-xs">
              <span>Precio</span>
              <Input type="number" step="0.01" {...register(`items.${index}.unitPrice`, { valueAsNumber: true })} />
            </label>
          </div>
          <div className="sm:col-span-1 flex items-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onRemoveItem(index)}
              disabled={itemCount <= 1}
              aria-label={`Eliminar línea ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

      {errors.items?.message ? <p className="text-sm text-red-600">{errors.items.message}</p> : null}
      {totalsBasis === "gross" ? (
        <p className="text-xs text-muted-foreground">
          En modo bruto, estas líneas se mantienen para detalle/preview, pero el cálculo usa la base imponible manual.
        </p>
      ) : null}
    </section>
  );
}
