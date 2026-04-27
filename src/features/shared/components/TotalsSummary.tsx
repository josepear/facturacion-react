import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

type TotalsSummaryProps = {
  subtotal: number;
  taxAmount: number;
  withholdingAmount: number;
  total: number;
};

type TotalRowProps = {
  label: string;
  value: string;
  strong?: boolean;
};

function TotalRow({ label, value, strong = false }: TotalRowProps) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={strong ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={strong ? "font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}

export function TotalsSummary({ subtotal, taxAmount, withholdingAmount, total }: TotalsSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <TotalRow label="Subtotal" value={formatCurrency(subtotal)} />
        <TotalRow label="Impuestos" value={formatCurrency(taxAmount)} />
        <TotalRow label="Retención" value={formatCurrency(withholdingAmount)} />
        <TotalRow label="Total" value={formatCurrency(total)} strong />
      </CardContent>
    </Card>
  );
}
