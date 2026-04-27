import type { UseFormRegister } from "react-hook-form";

import { Field } from "@/components/forms/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TotalsSummary } from "@/features/shared/components/TotalsSummary";
import type { CalculatedTotals, InvoiceDocument } from "@/domain/document/types";

type InvoiceTotalsPanelProps = {
  register: UseFormRegister<InvoiceDocument>;
  totals: CalculatedTotals;
};

export function InvoiceTotalsPanel({ register, totals }: InvoiceTotalsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Totales</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3">
          <Field label="Impuesto (%)">
            <Input type="number" step="0.01" {...register("taxRate", { valueAsNumber: true })} />
          </Field>
          <Field label="Retención (%)">
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
