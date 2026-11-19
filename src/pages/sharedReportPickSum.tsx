import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import type { PickEntry, PickKind, ShareReportPickAggregates } from "@/pages/sharedReportPickSumState";

type PickableTotalProps = {
  id: string;
  kind: PickKind;
  amount: number;
  picked: boolean;
  onPick: (id: string, entry: PickEntry, e: React.MouseEvent<HTMLButtonElement>) => void;
};

export function PickableTotalButton({ id, kind, amount, picked, onPick }: PickableTotalProps) {
  const safe = Number(amount) || 0;
  return (
    <button
      type="button"
      className={cn(
        "mx-0 max-w-full rounded px-1 py-0.5 text-right font-semibold tabular-nums underline decoration-dotted decoration-primary/50 underline-offset-2 transition-colors hover:text-primary",
        picked ? "bg-primary/10 text-primary ring-2 ring-primary ring-offset-2 ring-offset-background no-underline" : "",
      )}
      aria-pressed={picked}
      aria-label={`Importe ${formatCurrency(safe)}. Pulsa para sumar; con Shift, Control o Meta añade o quita de la suma.`}
      onClick={(e) => onPick(id, { kind, amount: safe }, e)}
    >
      {formatCurrency(safe)}
    </button>
  );
}

const DOCK_QUARTERS = ["T1", "T2", "T3", "T4"] as const;

function QuarterToggle({
  quarter,
  active,
  onToggle,
}: {
  quarter: string;
  active: boolean;
  onToggle: (quarter: string) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onToggle(quarter)}
      className={cn(
        "h-6 min-w-[1.75rem] rounded-full border px-2 text-[11px] font-semibold tabular-nums transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-accent",
      )}
    >
      {quarter.replace("T", "") + "T"}
    </button>
  );
}

type DockProps = {
  scope: "both" | "invoices" | "expenses";
  invoices: { total?: number }[];
  expenses: { total?: number }[];
  aggregates: ShareReportPickAggregates;
  /** Etiqueta de los totales de la vista actual (p. ej. "Total visible"). */
  totalsLabel: string;
  invoicesTotal: number;
  expensesTotal: number;
  combinedTotal: number;
  invoiceQuarters: string[];
  expenseQuarters: string[];
  onToggleInvoiceQuarter: (quarter: string) => void;
  onToggleExpenseQuarter: (quarter: string) => void;
  onSelectAll: (mode: "invoice" | "expense" | "both") => void;
  onClear: () => void;
};

export function ShareReportPickSumDock({
  scope,
  invoices,
  expenses,
  aggregates,
  totalsLabel,
  invoicesTotal,
  expensesTotal,
  combinedTotal,
  invoiceQuarters,
  expenseQuarters,
  onToggleInvoiceQuarter,
  onToggleExpenseQuarter,
  onSelectAll,
  onClear,
}: DockProps) {
  const showInv = scope !== "expenses";
  const showExp = scope !== "invoices";
  const showBothKinds = showInv && showExp;
  const { invSum, invN, expSum, expN, totalSum, totalN } = aggregates;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur supports-[padding:max(0px)]:pb-[max(12px,env(safe-area-inset-bottom))] print:hidden"
      role="region"
      aria-label="Totales de la vista y suma de importes seleccionados"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {showInv ? (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-informative">Facturas</span>
              {DOCK_QUARTERS.map((q) => (
                <QuarterToggle
                  key={q}
                  quarter={q}
                  active={invoiceQuarters.includes(q)}
                  onToggle={onToggleInvoiceQuarter}
                />
              ))}
            </div>
          ) : null}
          {showExp ? (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-informative">Gastos</span>
              {DOCK_QUARTERS.map((q) => (
                <QuarterToggle
                  key={q}
                  quarter={q}
                  active={expenseQuarters.includes(q)}
                  onToggle={onToggleExpenseQuarter}
                />
              ))}
            </div>
          ) : null}
          <span className="text-[11px] text-informative">Sin marcar = todos</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/60 pb-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-informative">{totalsLabel}</span>
          <span className="text-xl font-semibold tabular-nums tracking-tight text-primary">
            {formatCurrency(combinedTotal)}
          </span>
          <span className="text-xs text-informative">
            Facturas {formatCurrency(invoicesTotal)} · Gastos {formatCurrency(expensesTotal)}
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-foreground">
            {totalN === 0 ? (
              <p className="text-informative">
                Pulsa un <strong>total</strong> de fila para sumarlo. Con <strong>Shift</strong>, <strong>Ctrl</strong> o{" "}
                <strong>⌘</strong> añades o quitas importes sin borrar el resto.
              </p>
            ) : showBothKinds ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <p>
                  <span className="text-informative">Facturas</span>{" "}
                  <span className="font-semibold text-primary">{invN}</span> ·{" "}
                  <strong className="tabular-nums">{formatCurrency(invSum)}</strong>
                </p>
                <p>
                  <span className="text-informative">Gastos</span>{" "}
                  <span className="font-semibold text-primary">{expN}</span> ·{" "}
                  <strong className="tabular-nums">{formatCurrency(expSum)}</strong>
                </p>
                <p>
                  <span className="text-informative">Total selección</span>{" "}
                  <span className="font-semibold text-primary">{totalN}</span> ·{" "}
                  <strong className="tabular-nums">{formatCurrency(totalSum)}</strong>
                </p>
              </div>
            ) : showInv ? (
              <p>
                <span className="text-informative">Suma seleccionada</span>{" "}
                <span className="font-semibold text-primary">{invN}</span> ·{" "}
                <strong className="tabular-nums">{formatCurrency(invSum)}</strong>
              </p>
            ) : (
              <p>
                <span className="text-informative">Suma seleccionada</span>{" "}
                <span className="font-semibold text-primary">{expN}</span> ·{" "}
                <strong className="tabular-nums">{formatCurrency(expSum)}</strong>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {showBothKinds ? (
              <>
                <Button type="button" size="sm" variant="outline" onClick={() => onSelectAll("both")}>
                  Seleccionar todos (facturas + gastos)
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => onSelectAll("invoice")}>
                  Solo facturas
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => onSelectAll("expense")}>
                  Solo gastos
                </Button>
              </>
            ) : showInv && invoices.length > 0 ? (
              <Button type="button" size="sm" variant="outline" onClick={() => onSelectAll("invoice")}>
                Seleccionar todas las facturas
              </Button>
            ) : showExp && expenses.length > 0 ? (
              <Button type="button" size="sm" variant="outline" onClick={() => onSelectAll("expense")}>
                Seleccionar todos los gastos
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" onClick={onClear}>
              Limpiar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
