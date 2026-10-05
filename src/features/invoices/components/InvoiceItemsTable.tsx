import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
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

type SimpleInvoiceItem = {
  concept: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unitLabel: string;
  hidePerPersonSubtotalInBudget: boolean;
};

type InvoiceItemsTableProps = {
  register: UseFormRegister<InvoiceDocument>;
  control: Control<InvoiceDocument>;
  setValue: UseFormSetValue<InvoiceDocument>;
  getValues: UseFormGetValues<InvoiceDocument>;
  errors: FieldErrors<InvoiceDocument>;
  itemCount: number;
  totalsBasis: "items" | "gross";
  onAddItem: (afterIndex?: number) => void;
  onRemoveItem: (index: number) => void;
  onBulkImport: (items: SimpleInvoiceItem[]) => void;
};

function parseEuroNumber(rawValue: string): number | null {
  const cleaned = rawValue
    .replace(/€/gu, "")
    .replace(/eur/giu, "")
    .replace(/\s+/gu, "")
    .trim();

  if (!cleaned) {
    return null;
  }

  const commaIndex = cleaned.lastIndexOf(",");
  const dotIndex = cleaned.lastIndexOf(".");

  let normalized = cleaned;

  if (commaIndex >= 0 && dotIndex >= 0) {
    if (commaIndex > dotIndex) {
      normalized = cleaned.replace(/\./gu, "").replace(/,/gu, ".");
    } else {
      normalized = cleaned.replace(/,/gu, "");
    }
  } else if (commaIndex >= 0) {
    normalized = cleaned.replace(/\./gu, "").replace(/,/gu, ".");
  } else {
    normalized = cleaned.replace(/,/gu, "");
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseChunkAmountAndText(chunkLines: string[]): { description: string; amount: number | null } {
  if (!chunkLines.length) {
    return { description: "", amount: null };
  }

  const lastLine = chunkLines[chunkLines.length - 1] || "";
  const lastOnlyAmount = lastLine.match(/^(-?\d[\d\s.,]*)\s*(€|eur)?\s*$/iu);

  if (lastOnlyAmount) {
    const amount = parseEuroNumber(lastOnlyAmount[1] || "");
    const description = chunkLines.slice(0, -1).join(" ").trim();
    return { description, amount };
  }

  const fullText = chunkLines.join(" ").trim();
  const endAmount = fullText.match(/(-?\d[\d\s.,]*)\s*(€|eur)?\s*$/iu);

  if (!endAmount || typeof endAmount.index !== "number") {
    return { description: fullText, amount: null };
  }

  const amount = parseEuroNumber(endAmount[1] || "");
  const description = fullText.slice(0, endAmount.index).replace(/[\s;,:-]+$/gu, "").trim();
  return { description, amount };
}

function parseBulkLines(rawText: string): { items: SimpleInvoiceItem[]; invalidCount: number } {
  const lines = rawText
    .split(/\r?\n/gu)
    .map((line) => line.trim());

  const items: SimpleInvoiceItem[] = [];
  let invalidCount = 0;
  let pendingDescription = "";

  for (const line of lines) {
    if (!line) {
      continue;
    }

    const amountOnlyMatch = line.match(/^(-?\d[\d\s.,]*)\s*(€|eur)?\s*$/iu);

    if (amountOnlyMatch) {
      const amount = parseEuroNumber(amountOnlyMatch[1] || "");

      if (amount === null || !pendingDescription) {
        invalidCount += 1;
        pendingDescription = "";
        continue;
      }

      items.push({
        concept: "",
        description: pendingDescription,
        quantity: 1,
        unitPrice: amount,
        unitLabel: "",
        hidePerPersonSubtotalInBudget: false,
      });
      pendingDescription = "";
      continue;
    }

    const inlineMatch = line.match(/(-?\d[\d\s.,]*)\s*(€|eur)?\s*$/iu);

    if (inlineMatch && typeof inlineMatch.index === "number") {
      const amount = parseEuroNumber(inlineMatch[1] || "");
      const description = line.slice(0, inlineMatch.index).replace(/[\s;,:-]+$/gu, "").trim();

      if (amount !== null && description) {
        items.push({
          concept: "",
          description,
          quantity: 1,
          unitPrice: amount,
          unitLabel: "",
          hidePerPersonSubtotalInBudget: false,
        });
        pendingDescription = "";
        continue;
      }
    }

    // Guardamos texto para combinarlo con el próximo importe en la siguiente línea.
    pendingDescription = pendingDescription
      ? `${pendingDescription} ${line}`.trim()
      : line;
  }

  if (pendingDescription) {
    invalidCount += 1;
  }

  return { items, invalidCount };
}

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
  onBulkImport,
}: InvoiceItemsTableProps) {
  const items = useWatch({ control, name: "items" }) ?? [];
  const [expandedIndex, setExpandedIndex] = useState(0);
  const [bulkText, setBulkText] = useState("");
  const [bulkFeedback, setBulkFeedback] = useState("");

  useEffect(() => {
    setExpandedIndex((current) => {
      if (itemCount <= 0) {
        return 0;
      }
      return current >= itemCount ? itemCount - 1 : current;
    });
  }, [itemCount]);

  function handleAddItemAfter(index: number) {
    onAddItem(index);
    setExpandedIndex(index + 1);
  }

  function handleBulkImport() {
    const { items: parsedItems, invalidCount } = parseBulkLines(bulkText);

    if (!parsedItems.length) {
      setBulkFeedback("No pude leer líneas válidas. Usa bloques: descripción + importe.");
      return;
    }

    onBulkImport(parsedItems);
    setExpandedIndex(0);
    setBulkFeedback(
      invalidCount > 0
        ? `Importadas ${parsedItems.length} líneas. Omitidas ${invalidCount} por formato.`
        : `Importadas ${parsedItems.length} líneas correctamente.`,
    );
  }

  return (
    <section className="grid gap-3">
      <div className="grid gap-2 rounded-md border border-border/70 bg-muted/20 p-3">
        <p className="text-xs text-muted-foreground">
          Pegado rapido: un bloque por linea. Ejemplo: descripcion en una linea y precio en la siguiente.
        </p>
        <Textarea
          rows={5}
          value={bulkText}
          onChange={(event) => {
            setBulkText(event.target.value);
            if (bulkFeedback) {
              setBulkFeedback("");
            }
          }}
          placeholder={"Diseno nueva identidad visual institucional\n650 €\n\nAdaptaciones de logotipo\n180 €"}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={handleBulkImport}>
            Crear lineas desde texto
          </Button>
          {bulkFeedback ? <span className="text-xs text-muted-foreground">{bulkFeedback}</span> : null}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Lineas</h2>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            onAddItem(itemCount - 1);
            setExpandedIndex(itemCount);
          }}
        >
          Anadir linea
        </Button>
      </div>

      <div className="mb-1 hidden gap-3 px-1 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-12 sm:items-end">
        <div className="sm:col-span-5">Concepto</div>
        <div className="sm:col-span-2">Comensales</div>
        <div className="sm:col-span-2">EUR x persona</div>
        <div className="sm:col-span-2 text-right">Total linea</div>
        <div className="sm:col-span-1" aria-hidden />
      </div>

      {Array.from({ length: itemCount }).map((_, index) => {
        const row = items[index];
        const isPerPerson = isPerPersonUnitLabel(row?.unitLabel);
        const quantity = Number(row?.quantity ?? 0);
        const unitPrice = Number(row?.unitPrice ?? 0);
        const conceptLabel = String(row?.concept || row?.description || "").trim() || "Sin concepto";
        const lineTotalValue = Number(row?.lineTotal ?? quantity * unitPrice);
        const lineTotalLabel = Number.isFinite(lineTotalValue) ? formatCurrency(lineTotalValue) : "0,00 EUR";
        const isExpanded = expandedIndex === index;
        const hideSubtotal = Boolean(row?.hidePerPersonSubtotalInBudget);
        const perPersonHint =
          isPerPerson && quantity > 0 && unitPrice > 0
            ? hideSubtotal
              ? `${quantity.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} comensales - ${formatCurrency(unitPrice)} / persona`
              : `${quantity.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} comensales x ${formatCurrency(unitPrice)} = ${formatCurrency(quantity * unitPrice)}`
            : isPerPerson
              ? "Introduce comensales y precio por persona para calcular el subtotal de esta linea."
              : null;

        return (
          <div key={index} className="grid gap-3 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2">
              <button
                type="button"
                className="inline-flex min-w-0 items-center gap-2 text-left"
                onClick={() => setExpandedIndex(index)}
              >
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-border bg-muted px-2 text-xs font-semibold">
                  {index + 1}
                </span>
                <span className="truncate text-sm font-medium">{conceptLabel}</span>
              </button>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="hidden sm:inline">Total linea: {lineTotalLabel}</span>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-2 text-xs"
                  onClick={() => handleAddItemAfter(index)}
                >
                  Anadir linea debajo
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => onRemoveItem(index)}
                  disabled={itemCount <= 1}
                  aria-label={`Eliminar linea ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {!isExpanded ? null : (
              <>
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
                      <span className="sm:sr-only">{isPerPerson ? "EUR x persona" : "Precio"}</span>
                      <Input type="number" step="0.01" {...register(`items.${index}.unitPrice`, { valueAsNumber: true })} />
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="grid gap-1 text-xs">
                      <span className="sm:sr-only">Total linea</span>
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
                    <span className="text-xs text-muted-foreground">Linea {index + 1}</span>
                  </div>
                </div>
                <label className="grid gap-1 text-xs">
                  <span>Descripcion</span>
                  <Textarea placeholder="Detalle del concepto" rows={3} {...register(`items.${index}.description`)} />
                </label>
                <p className="text-informative text-sm">
                  Si informas total manual, prevalece sobre cantidad x precio.
                </p>
              </>
            )}
          </div>
        );
      })}

      {errors.items?.message ? <p className="text-sm text-red-600">{errors.items.message}</p> : null}
      {totalsBasis === "gross" ? (
        <p className="text-informative">
          En modo bruto, los importes se calculan a partir de estas lineas (detalle y vista previa).
        </p>
      ) : null}
    </section>
  );
}
