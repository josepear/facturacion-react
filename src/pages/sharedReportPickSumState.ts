import { type MouseEvent, useCallback, useMemo, useState } from "react";

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

  const handlePick = useCallback((id: string, entry: PickEntry, e: MouseEvent<HTMLButtonElement>) => {
    const additive = e.ctrlKey || e.metaKey || e.shiftKey;
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

export type ShareReportPickAggregates = ReturnType<typeof useShareReportPickSum>["aggregates"];
