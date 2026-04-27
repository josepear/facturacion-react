import type { UseFormRegister } from "react-hook-form";

import { Field } from "@/components/forms/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TotalsSummary } from "@/features/shared/components/TotalsSummary";
import type { CalculatedTotals, InvoiceDocument } from "@/domain/document/types";

type InvoiceTotalsPanelProps = {
  register: UseFormRegister<InvoiceDocument>;
  totals: CalculatedTotals;
  taxValidation: {
    igicValid: boolean;
    irpfValid: boolean;
    withholdingMode: string;
    isReady: boolean;
    tip: string;
  };
  onWithholdingModeChange: (mode: "sin_irpf" | "irpf_15" | "irpf_19" | "irpf_21") => void;
};

export function InvoiceTotalsPanel({
  register,
  totals,
  taxValidation,
  onWithholdingModeChange,
}: InvoiceTotalsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Totales</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3">
          <Field label="IGIC (%)">
            <Input type="number" step="0.01" {...register("taxRate", { valueAsNumber: true })} />
          </Field>
          <Field label="IRPF (%)">
            <Input
              type="number"
              step="0.01"
              {...register("withholdingRate", {
                setValueAs: (value) => {
                  if (value === "" || value === null || value === undefined) {
                    return "";
                  }
                  const parsed = Number(value);
                  return Number.isFinite(parsed) ? parsed : "";
                },
              })}
            />
          </Field>
          <div className="grid gap-2">
            <span className="text-xs font-medium text-muted-foreground">Atajos IRPF / SIN IRPF</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border border-input px-3 py-1 text-xs"
                onClick={() => onWithholdingModeChange("irpf_15")}
              >
                IRPF 15%
              </button>
              <button
                type="button"
                className="rounded-md border border-input px-3 py-1 text-xs"
                onClick={() => onWithholdingModeChange("irpf_19")}
              >
                IRPF 19%
              </button>
              <button
                type="button"
                className="rounded-md border border-input px-3 py-1 text-xs"
                onClick={() => onWithholdingModeChange("irpf_21")}
              >
                IRPF 21%
              </button>
              <button
                type="button"
                className="rounded-md border border-input px-3 py-1 text-xs"
                onClick={() => onWithholdingModeChange("sin_irpf")}
              >
                SIN IRPF
              </button>
            </div>
            <span className={`text-xs ${taxValidation.isReady ? "text-emerald-600" : "text-amber-600"}`}>
              {taxValidation.tip}
            </span>
          </div>
        </div>

        <TotalsSummary
          subtotal={totals.subtotal}
          taxAmount={totals.taxAmount}
          withholdingAmount={totals.withholdingAmount}
          total={totals.total}
        />
      </CardContent>
    </Card>
  );
}
