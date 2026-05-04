import { cn } from "@/lib/utils";

/** Tablas de facturación / gastos: reparto estable de anchura para que el `truncate` funcione bien. */
export const workbookDataTableBase = "w-full table-fixed border-collapse text-sm";

/**
 * Celda con texto o controles que no deben pasar a segunda línea: elipsis si no cabe.
 * Usa `title` con el valor completo cuando haya riesgo de corte.
 */
export const workbookDataTdVariable = cn(
  "max-w-[9rem] min-w-0 overflow-hidden text-ellipsis whitespace-nowrap p-2 align-middle sm:max-w-[12rem] md:max-w-[16rem] lg:max-w-[20rem]",
);

export const workbookDataTdTight = "whitespace-nowrap p-2 align-middle";
