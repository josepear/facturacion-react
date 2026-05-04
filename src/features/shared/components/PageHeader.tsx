import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Optional classes on `<header>` (e.g. Facturar uses `space-y-2` instead of default `space-y-1`). */
  className?: string;
};

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  const titleBlock = (
    <>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {description ? <p className="text-informative">{description}</p> : null}
    </>
  );

  if (actions) {
    return (
      <header className={cn("space-y-1", className)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 space-y-1">{titleBlock}</div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>
        </div>
      </header>
    );
  }

  return (
    <header className={cn("space-y-1", className)}>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {description ? <p className="text-informative">{description}</p> : null}
    </header>
  );
}
