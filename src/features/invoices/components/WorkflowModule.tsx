import type { ReactNode } from "react";

type WorkflowModuleProps = {
  title: string;
  stateLabel: string;
  stateTone: "ok" | "pending";
  help: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

function getStateToneClass(stateTone: "ok" | "pending") {
  return stateTone === "ok"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

export function WorkflowModule({
  title,
  stateLabel,
  stateTone,
  help,
  defaultOpen = true,
  children,
}: WorkflowModuleProps) {
  return (
    <details className="rounded-lg border bg-card text-card-foreground shadow-sm" open={defaultOpen}>
      <summary className="cursor-pointer list-none p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">{title}</h2>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getStateToneClass(stateTone)}`}>
            {stateLabel}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{help}</p>
      </summary>
      <div className="border-t p-4 pt-3">{children}</div>
    </details>
  );
}
