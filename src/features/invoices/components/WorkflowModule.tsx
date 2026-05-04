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
}: WorkflowModuleProps) {
  const headerId = useId();
  const panelId = useId();

  return (
    <section
      data-workflow-module={workflowModuleId}
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        "transition-[box-shadow,transform] duration-500 ease-out motion-reduce:duration-150",
        open && "shadow-md ring-1 ring-border/60",
        stateTone === "ok" && "border-emerald-100/80",
      )}
    >
      <button
        type="button"
        id={headerId}
        className={cn(
          "w-full p-3 text-left outline-none transition-colors duration-300 ease-out focus-visible:ring-2 focus-visible:ring-ring motion-reduce:duration-150 sm:p-4",
          open ? "bg-muted/20" : "hover:bg-muted/10",
        )}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpenChange(!open)}
      >
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
      </button>
      <div
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0">
          <div
            id={panelId}
            role="region"
            aria-labelledby={headerId}
            aria-hidden={!open}
            inert={!open}
            className="border-t p-3 pt-3 sm:p-4 sm:pt-3"
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
