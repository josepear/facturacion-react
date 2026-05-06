import { useReducer } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import calculate, { type CalculatorData } from "@/features/utilities/calculator/logic/calculate";
import { cn } from "@/lib/utils";

const INITIAL: CalculatorData = {
  total: null,
  next: null,
  operation: null,
};

function reducer(state: CalculatorData, buttonName: string): CalculatorData {
  const patch = calculate(state, buttonName);
  return { ...state, ...patch };
}

const ROWS: string[][] = [
  ["AC", "+/-", "%", "÷"],
  ["7", "8", "9", "x"],
  ["4", "5", "6", "-"],
  ["1", "2", "3", "+"],
];

function buttonClass(name: string): string {
  if (name === "AC" || name === "+/-" || name === "%") {
    return "bg-muted text-foreground hover:bg-muted/80";
  }
  if (name === "÷" || name === "x" || name === "-" || name === "+" || name === "=") {
    return "bg-orange-500 text-white hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-500";
  }
  return "bg-card text-foreground shadow-sm ring-1 ring-border hover:bg-muted/50";
}

export function CalculatorPage() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const displayRaw = state.next ?? state.total ?? "0";
  const display = displayRaw === "Error" ? "Error" : displayRaw;

  return (
    <main className="app-page-shell">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Calculadora</h1>
        <p className="text-pretty text-sm text-informative sm:text-base">
          Utilidad rápida para comprobar importes; misma lógica que la calculadora React clásica en GitHub (MIT).
        </p>
      </header>

      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>Vista previa</CardTitle>
          <CardDescription>Pulsa los botones; «AC» borra todo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <output
            aria-live="polite"
            className={cn(
              "flex min-h-[4.5rem] items-center justify-end rounded-xl bg-muted px-4 py-3 text-right text-4xl font-light tabular-nums tracking-tight text-foreground",
              display === "Error" && "text-destructive",
            )}
          >
            <span className="min-w-0 truncate">{display}</span>
          </output>

          <div className="mx-auto w-full max-w-[280px] space-y-2 sm:max-w-[320px]">
            {ROWS.map((row) => (
              <div key={row.join("")} className="grid grid-cols-4 gap-2">
                {row.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={cn(
                      "flex h-14 min-h-[44px] items-center justify-center rounded-xl text-xl font-medium transition-colors touch-manipulation sm:h-14 sm:min-h-0",
                      buttonClass(name),
                    )}
                    aria-label={name === "x" ? "multiplicar" : name === "÷" ? "dividir" : name}
                    onClick={() => dispatch(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            ))}
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                className={cn(
                  "col-span-2 flex h-14 min-h-[44px] items-center justify-center rounded-xl text-xl font-medium transition-colors touch-manipulation sm:h-14 sm:min-h-0",
                  buttonClass("0"),
                )}
                aria-label="cero"
                onClick={() => dispatch("0")}
              >
                0
              </button>
              <button
                type="button"
                className={cn(
                  "flex h-14 min-h-[44px] items-center justify-center rounded-xl text-xl font-medium transition-colors touch-manipulation sm:h-14 sm:min-h-0",
                  buttonClass("."),
                )}
                aria-label="punto decimal"
                onClick={() => dispatch(".")}
              >
                .
              </button>
              <button
                type="button"
                className={cn(
                  "flex h-14 min-h-[44px] items-center justify-center rounded-xl text-xl font-medium transition-colors touch-manipulation sm:h-14 sm:min-h-0",
                  buttonClass("="),
                )}
                aria-label="igual"
                onClick={() => dispatch("=")}
              >
                =
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Basada en{" "}
            <a
              href="https://github.com/andrewagain/calculator"
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2 hover:text-foreground"
            >
              andrewagain/calculator
            </a>{" "}
            (MIT).
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
