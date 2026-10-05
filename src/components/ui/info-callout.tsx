import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export type InfoCalloutProps = {
  children: ReactNode;
  className?: string;
};

/** Estado/callout neutro unificado (carga, vacío, sin permisos). */
export function InfoCallout({ children, className }: InfoCalloutProps) {
  return (
    <Card className={cn("border-border bg-muted/40 dark:bg-muted/20", className)}>
      <div className="p-6 text-sm text-informative">{children}</div>
    </Card>
  );
}
