import { quarterBadgeSurfaceClass, quarterShortLabelForUi, resolveCalendarQuarter } from "@/features/shared/lib/quarterVisual";
import { cn } from "@/lib/utils";

type Props = {
  /** Valor persistido (p. ej. T1) o vacío. */
  quarter?: string;
  /** Fecha ISO YYYY-MM-DD; usada si `quarter` no normaliza (p. ej. facturas). */
  issueDate?: string;
  className?: string;
};

export function QuarterBadge({ quarter, issueDate, className }: Props) {
  const qNorm = resolveCalendarQuarter(quarter, issueDate);
  const label = quarterShortLabelForUi(qNorm);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium tabular-nums leading-none",
        quarterBadgeSurfaceClass(qNorm),
        className,
      )}
    >
      {label}
    </span>
  );
}
