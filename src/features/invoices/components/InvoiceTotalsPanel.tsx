import type { UseFormRegister } from "react-hook-form";

import { Field } from "@/components/forms/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TotalsSummary } from "@/features/shared/components/TotalsSummary";
import type { CalculatedTotals, InvoiceDocument } from "@/domain/document/types";

type InvoiceTotalsPanelProps = {
  register: UseFormRegister<InvoiceDocument>;
  taxRate: number;
  withholdingRate: InvoiceDocument["withholdingRate"];
  totals: CalculatedTotals;
  taxValidation: {
    igicValid: boolean;
    irpfValid: boolean;
    withholdingMode: string;
    isReady: boolean;
    tip: string;
  };
  onTaxRatePreset: (rate: number) => void;
  onWithholdingModeChange: (mode: "sin_irpf" | "irpf_15" | "irpf_19" | "irpf_21") => void;
};

function chipClass(active: boolean) {
  return [
    "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
    active
      ? "border-primary bg-primary/10 text-foreground"
      : "border-input bg-background text-muted-foreground hover:bg-muted/50",
  ].join(" ");
}

export function InvoiceTotalsPanel({
  register,
  taxRate,
  withholdingRate,
  totals,
  taxValidation,
  onTaxRatePreset,
  onWithholdingModeChange,
}: InvoiceTotalsPanelProps) {
  const sinIrpf = withholdingRate === "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Impuestos y retenciones</CardTitle>
        <CardDescription>Ajusta solo la parte fiscal de este documento.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3">
          <Field label="IGIC (%)">
            <div className="flex flex-wrap items-stretch gap-2">
              <Input
                type="number"
                step="0.01"
                className="min-w-[6rem] flex-1"
                {...register("taxRate", { valueAsNumber: true })}
              />
              <button type="button" className={chipClass(Number(taxRate) === 0)} onClick={() => onTaxRatePreset(0)}>
                0%
              </button>
              <button type="button" className={chipClass(Number(taxRate) === 3)} onClick={() => onTaxRatePreset(3)}>
                3%
              </button>
              <button type="button" className={chipClass(Number(taxRate) === 7)} onClick={() => onTaxRatePreset(7)}>
                7%
              </button>
              <button type="button" className={chipClass(Number(taxRate) === 15)} onClick={() => onTaxRatePreset(15)}>
                15%
              </button>
            </div>
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
            <span className="text-xs font-medium text-muted-foreground">Atajos IRPF</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={chipClass(withholdingRate === 15)}
                onClick={() => onWithholdingModeChange("irpf_15")}
              >
                15%
              </button>
              <button
                type="button"
                className={chipClass(withholdingRate === 19)}
                onClick={() => onWithholdingModeChange("irpf_19")}
              >
                19%
              </button>
              <button
                type="button"
                className={chipClass(withholdingRate === 21)}
                onClick={() => onWithholdingModeChange("irpf_21")}
              >
                21%
              </button>
              <label className="ml-1 flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={sinIrpf}
                  onChange={(event) => {
                    if (event.target.checked) {
                      onWithholdingModeChange("sin_irpf");
                    } else {
                      onWithholdingModeChange("irpf_15");
                    }
                  }}
                />
                <span>SIN IRPF</span>
              </label>
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
