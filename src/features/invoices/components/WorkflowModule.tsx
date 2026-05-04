import type { ReactNode } from "react";
import { useId } from "react";

import { cn } from "@/lib/utils";

type WorkflowModuleProps = {
  title: string;
  stateLabel: string;
  stateTone: "ok" | "pending";
  help: string;
  /** Controlado desde la página (p. ej. acordeón guiado en Facturar). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** Ancla para scroll suave cuando el flujo automático abre el siguiente módulo (Facturar). */
  workflowModuleId?: string;
  /**
   * Columna principal de Facturar: sin marco propio, cabecera 80px colapsada, título 2rem colapsado,
   * fondo distinto al expandir; el contenedor padre aporta borde único y `divide-y`.
   */
  stacked?: boolean;
  /** Cabecera fija y contenido siempre visible (p. ej. módulo Guardar al final del flujo). Requiere `stacked`. */
  alwaysExpanded?: boolean;
  /** Clases extra del `<h2>` (p. ej. `text-[2rem]` en Guardar). Solo aplica con `alwaysExpanded` + `stacked`. */
  titleClassName?: string;
};

function getStateToneClass(stateTone: "ok" | "pending") {
  return stateTone === "ok"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors duration-500 ease-out motion-reduce:duration-150"
    : "border-amber-200 bg-amber-50 text-amber-700 transition-colors duration-500 ease-out motion-reduce:duration-150";
}

export function WorkflowModule({
  title,
  stateLabel,
  stateTone,
  help,
  open,
  onOpenChange,
  children,
  workflowModuleId,
  stacked = false,
  alwaysExpanded = false,
  titleClassName,
}: WorkflowModuleProps) {
  const headerId = useId();
  const panelId = useId();

  if (stacked && alwaysExpanded) {
    return (
      <section
        data-workflow-module={workflowModuleId}
        className={cn(
          "bg-muted/45 text-card-foreground transition-[background-color] duration-300 ease-out motion-reduce:duration-150",
          "rounded-none border-0 shadow-none",
        )}
      >
        <div id={headerId} className="px-2.5 py-3 sm:px-4 sm:py-4">
          <div className="flex min-h-[4.5rem] flex-col justify-center gap-1 sm:min-h-[5.25rem]">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={cn("font-semibold", titleClassName ?? "text-base leading-snug")}>{title}</h2>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getStateToneClass(stateTone)}`}>
                {stateLabel}
              </span>
            </div>
            <p className="text-pretty text-sm text-informative">{help}</p>
          </div>
        </div>
        <div
          id={panelId}
          role="region"
          aria-labelledby={headerId}
          className="border-t border-border/60 p-2.5 pt-3 sm:p-4 sm:pt-3"
        >
          {children}
        </div>
      </section>
    );
  }

  return (
    <section
      data-workflow-module={workflowModuleId}
      className={cn(
        "text-card-foreground",
        stacked
          ? cn(
              "rounded-none border-0 bg-transparent shadow-none",
              "transition-[background-color] duration-300 ease-out motion-reduce:duration-150",
              open && "bg-muted/45",
            )
          : cn(
              "rounded-lg border bg-card shadow-sm",
              "transition-[box-shadow,transform] duration-500 ease-out motion-reduce:duration-150",
              open && "shadow-md ring-1 ring-border/60",
              stateTone === "ok" && "border-emerald-100/80",
            ),
      )}
    >
      <button
        type="button"
        id={headerId}
        className={cn(
          "w-full text-left outline-none transition-colors duration-300 ease-out focus-visible:ring-2 focus-visible:ring-ring motion-reduce:duration-150",
          stacked
            ? cn(
                open
                  ? "bg-transparent px-2.5 py-3 sm:px-4 sm:py-4"
                  : "h-20 shrink-0 overflow-hidden px-3 sm:px-4 hover:bg-muted/15",
              )
            : cn("p-3 sm:p-4", open ? "bg-muted/20" : "hover:bg-muted/10"),
        )}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpenChange(!open)}
      >
        {stacked ? (
          open ? (
            <div className="flex min-h-[4.5rem] flex-col justify-center gap-1 sm:min-h-[5.25rem]">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold leading-snug">{title}</h2>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getStateToneClass(stateTone)}`}>
                  {stateLabel}
                </span>
              </div>
              <p className="text-pretty text-sm text-informative transition-opacity duration-300 ease-out motion-reduce:duration-150">
                {help}
              </p>
            </div>
          ) : (
            <div className="flex h-full min-h-0 items-center justify-between gap-2 sm:gap-3">
              <h2 className="min-w-0 truncate text-xl font-semibold leading-tight tracking-tight sm:text-2xl">{title}</h2>
              <span
                className={`max-w-[42%] shrink-0 truncate rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium sm:max-w-none sm:text-xs ${getStateToneClass(stateTone)}`}
              >
                {stateLabel}
              </span>
              <span className="sr-only">{help}</span>
            </div>
          )
        ) : (
          <div className="flex min-h-[44px] flex-col justify-center gap-1 sm:min-h-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{title}</h2>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getStateToneClass(stateTone)}`}>
                {stateLabel}
              </span>
            </div>
            <p className="text-informative transition-opacity duration-300 ease-out motion-reduce:duration-150">
              {help}
            </p>
          </div>
        )}
      </button>
      <div
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[minmax(0,1fr)]" : "grid-rows-[minmax(0,0fr)]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            id={panelId}
            role="region"
            aria-labelledby={headerId}
            aria-hidden={!open}
            inert={!open}
            className={cn(
              stacked ? "border-t border-border/60 p-2.5 pt-3 sm:p-4 sm:pt-3" : "border-t p-3 pt-3 sm:p-4 sm:pt-3",
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
