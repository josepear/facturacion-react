import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";

export type PickKind = "invoice" | "expense";
export type PickEntry = { kind: PickKind; amount: number };

export function pickIdInvoice(index: number): string {
  return `inv:${index}`;
}

export function pickIdExpense(index: number): string {
  return `exp:${index}`;
}

export function useShareReportPickSum() {
  const [picked, setPicked] = useState<Map<string, PickEntry>>(() => new Map());

  const clear = useCallback(() => {
    setPicked(new Map());
  }, []);

  const handlePick = useCallback((id: string, entry: PickEntry, e: React.MouseEvent<HTMLButtonElement>) => {
    const additive = e.ctrlKey || e.metaKey;
    setPicked((prev) => {
      if (!additive) {
        if (prev.size === 1 && prev.has(id)) {
          return new Map();
        }
        return new Map([[id, entry]]);
      }
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.set(id, entry);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(
    (mode: "invoice" | "expense" | "both", invoices: { total?: number }[], expenses: { total?: number }[]) => {
      const next = new Map<string, PickEntry>();
      if (mode === "invoice" || mode === "both") {
        invoices.forEach((row, i) => {
          next.set(pickIdInvoice(i), { kind: "invoice", amount: Number(row.total) || 0 });
        });
      }
      if (mode === "expense" || mode === "both") {
        expenses.forEach((row, i) => {
          next.set(pickIdExpense(i), { kind: "expense", amount: Number(row.total) || 0 });
        });
      }
      setPicked(next);
    },
    [],
  );

  const aggregates = useMemo(() => {
    let invSum = 0;
    let invN = 0;
    let expSum = 0;
    let expN = 0;
    for (const v of picked.values()) {
      if (v.kind === "invoice") {
        invSum += v.amount;
        invN += 1;
      } else {
        expSum += v.amount;
        expN += 1;
      }
    }
    return {
      invSum,
      invN,
      expSum,
      expN,
      totalSum: invSum + expSum,
      totalN: invN + expN,
    };
  }, [picked]);

  const isPicked = useCallback((id: string) => picked.has(id), [picked]);

  return { picked, handlePick, clear, selectAll, aggregates, isPicked };
}

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
      aria-label={`Importe ${formatCurrency(safe)}. Pulsa para sumar; con Control o Meta añade o quita de la suma.`}
      onClick={(e) => onPick(id, { kind, amount: safe }, e)}
    >
      {formatCurrency(safe)}
    </button>
  );
}

type DockProps = {
  scope: "both" | "invoices" | "expenses";
  invoices: { total?: number }[];
  expenses: { total?: number }[];
  aggregates: ReturnType<typeof useShareReportPickSum>["aggregates"];
  onSelectAll: (mode: "invoice" | "expense" | "both") => void;
  onClear: () => void;
};

export function ShareReportPickSumDock({ scope, invoices, expenses, aggregates, onSelectAll, onClear }: DockProps) {
  const showInv = scope !== "expenses";
  const showExp = scope !== "invoices";
  const showBothKinds = showInv && showExp;
  const { invSum, invN, expSum, expN, totalSum, totalN } = aggregates;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur supports-[padding:max(0px)]:pb-[max(12px,env(safe-area-inset-bottom))]"
      role="region"
      aria-label="Suma de importes seleccionados"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
        <div className="text-sm text-foreground">
          {totalN === 0 ? (
            <p className="text-informative">
              Pulsa un <strong>total</strong> de fila para sumarlo (como en la vista legacy). Con <strong>Ctrl</strong> o{" "}
              <strong>⌘</strong> añades o quitas importes sin borrar el resto.
            </p>
          ) : showBothKinds ? (
            <div className="grid gap-1.5 sm:grid-cols-3">
              <p>
                <span className="text-informative">Facturas seleccionadas</span>{" "}
                <span className="font-semibold text-primary">{invN}</span> ·{" "}
                <strong className="tabular-nums">{formatCurrency(invSum)}</strong>
              </p>
              <p>
                <span className="text-informative">Gastos seleccionados</span>{" "}
                <span className="font-semibold text-primary">{expN}</span> ·{" "}
                <strong className="tabular-nums">{formatCurrency(expSum)}</strong>
              </p>
              <p>
                <span className="text-informative">Total selección</span>{" "}
                <span className="font-semibold text-primary">{totalN}</span> importe(s) ·{" "}
                <strong className="tabular-nums">{formatCurrency(totalSum)}</strong>
              </p>
            </div>
          ) : showInv ? (
            <p>
              <span className="text-informative">Suma seleccionada</span>{" "}
              <span className="font-semibold text-primary">{invN}</span> importe(s) ·{" "}
              <strong className="tabular-nums">{formatCurrency(invSum)}</strong>
            </p>
          ) : (
            <p>
              <span className="text-informative">Suma seleccionada</span>{" "}
              <span className="font-semibold text-primary">{expN}</span> importe(s) ·{" "}
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
  );
}
