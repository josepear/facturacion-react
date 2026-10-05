import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  children: ReactNode;
  className?: string;
};

/** Mensaje unificado para listas/tablas sin datos. */
export function EmptyState({ children, className }: EmptyStateProps) {
  return <p className={cn("p-3 text-informative", className)}>{children}</p>;
}
