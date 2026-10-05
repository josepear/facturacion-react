import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type SectionTitleProps = {
  as?: "h2" | "h3";
  id?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/** Título de sección unificado (h2/h3 internos). */
export function SectionTitle({ as = "h2", id, className, style, children }: SectionTitleProps) {
  const Comp = as;
  return (
    <Comp id={id} style={style} className={cn("text-lg font-semibold tracking-tight text-foreground", className)}>
      {children}
    </Comp>
  );
}
