import { Trash2 } from "lucide-react";
import type { Control, FieldErrors, UseFormGetValues, UseFormRegister, UseFormSetValue } from "react-hook-form";
import { useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  isPerPersonUnitLabel,
  normalizePerPersonQuantity,
  unitLabelAfterDisablingPerPerson,
} from "@/domain/document/perPersonPricing";
import type { InvoiceDocument } from "@/domain/document/types";
import { formatCurrency } from "@/lib/utils";

type InvoiceItemsTableProps = {
  register: UseFormRegister<InvoiceDocument>;
  control: Control<InvoiceDocument>;
  setValue: UseFormSetValue<InvoiceDocument>;
  getValues: UseFormGetValues<InvoiceDocument>;
  errors: FieldErrors<InvoiceDocument>;
  itemCount: number;
  totalsBasis: "items" | "gross";
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
};

export function InvoiceItemsTable({
  register,
  control,
  setValue,
  getValues,
  errors,
  itemCount,
  totalsBasis,
  onAddItem,
  onRemoveItem,
}: InvoiceItemsTableProps) {
  const items = useWatch({ control, name: "items" }) ?? [];

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Líneas</h2>
        <Button type="button" variant="outline" onClick={onAddItem}>
          Añadir línea
        </Button>
      </div>

      <div className="mb-1 hidden gap-3 px-1 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-12 sm:items-end">
        <div className="sm:col-span-5">Concepto</div>
        <div className="sm:col-span-2">Comensales</div>
        <div className="sm:col-span-2">€ x persona</div>
        <div className="sm:col-span-2 text-right">Total línea</div>
        <div className="sm:col-span-1" aria-hidden />
      </div>

      {Array.from({ length: itemCount }).map((_, index) => {
        const row = items[index];
        const isPerPerson = isPerPersonUnitLabel(row?.unitLabel);
        const quantity = Number(row?.quantity ?? 0);
        const unitPrice = Number(row?.unitPrice ?? 0);
        const hideSubtotal = Boolean(row?.hidePerPersonSubtotalInBudget);
        const perPersonHint =
          isPerPerson && quantity > 0 && unitPrice > 0
            ? hideSubtotal
              ? `${quantity.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} comensales · ${formatCurrency(unitPrice)} / persona`
              : `${quantity.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} comensales × ${formatCurrency(unitPrice)} = ${formatCurrency(quantity * unitPrice)}`
            : isPerPerson
              ? "Introduce comensales y precio por persona para calcular el subtotal de esta línea."
              : null;

        return (
          <div key={index} className="grid gap-3 rounded-md border p-3">
            <input type="hidden" {...register(`items.${index}.unitLabel`)} />
            <div className="grid gap-3 sm:grid-cols-12 sm:items-end sm:gap-3">
              <div className="sm:col-span-5">
                <label className="grid gap-1 text-xs">
                  <span className="sm:sr-only">Concepto</span>
                  <Input placeholder="Servicio" {...register(`items.${index}.concept`)} />
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 rounded border border-input"
                      checked={isPerPerson}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setValue(`items.${index}.unitLabel`, "persona", {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          const q = getValues(`items.${index}.quantity`);
                          setValue(`items.${index}.quantity`, normalizePerPersonQuantity(q ?? 1), {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        } else {
                          const prev = getValues(`items.${index}.unitLabel`);
                          setValue(`items.${index}.unitLabel`, unitLabelAfterDisablingPerPerson(prev), {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          setValue(`items.${index}.hidePerPersonSubtotalInBudget`, false, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }
                      }}
                    />
                    <span>Precio por persona</span>
                  </label>
                  {isPerPerson ? (
                    <label className="flex cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 rounded border border-input"
                        {...register(`items.${index}.hidePerPersonSubtotalInBudget`)}
                      />
                      <span>Ocultar subtotal en concepto</span>
                    </label>
                  ) : null}
                </div>
                {perPersonHint ? <p className="mt-1 text-xs text-muted-foreground">{perPersonHint}</p> : null}
              </div>
              <div className="sm:col-span-2">
                <label className="grid gap-1 text-xs">
                  <span className="sm:sr-only">{isPerPerson ? "Comensales" : "Cant."}</span>
                  <Input
                    type="number"
                    min={0}
                    step={isPerPerson ? 1 : "0.01"}
                    className="min-w-0 w-full"
                    {...register(`items.${index}.quantity`, {
                      valueAsNumber: true,
                      setValueAs: (value) => {
                        if (value === "" || value === null || value === undefined) {
                          return 1;
                        }
                        const parsed = Number(value);
                        if (!Number.isFinite(parsed) || parsed < 0) {
                          return isPerPerson ? 0 : 1;
                        }
                        return isPerPerson ? normalizePerPersonQuantity(parsed) : parsed;
                      },
                    })}
                  />
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="grid gap-1 text-xs">
                  <span className="sm:sr-only">{isPerPerson ? "€ x persona" : "Precio"}</span>
                  <Input type="number" step="0.01" {...register(`items.${index}.unitPrice`, { valueAsNumber: true })} />
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="grid gap-1 text-xs">
                  <span className="sm:sr-only">Total línea</span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Auto"
                    className="sm:text-right"
                    {...register(`items.${index}.lineTotal`, {
                      setValueAs: (value) => {
                        if (value === "" || value === null || value === undefined) {
                          return undefined;
                        }
                        const parsed = Number(value);
                        return Number.isFinite(parsed) ? parsed : undefined;
                      },
                    })}
                  />
                </label>
              </div>
              <div className="flex sm:col-span-1 sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => onRemoveItem(index)}
                  disabled={itemCount <= 1}
                  aria-label={`Eliminar línea ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <label className="grid gap-1 text-xs">
              <span>Descripción</span>
              <Textarea placeholder="Detalle del concepto" rows={3} {...register(`items.${index}.description`)} />
            </label>
            <p className="text-informative text-sm">
              Si informas total manual, prevalece sobre cantidad × precio.
            </p>
          </div>
        );
      })}

      {errors.items?.message ? <p className="text-sm text-red-600">{errors.items.message}</p> : null}
      {totalsBasis === "gross" ? (
        <p className="text-informative">
          En modo bruto, los importes se calculan a partir de estas líneas (detalle y vista previa).
        </p>
      ) : null}
    </section>
  );
}
