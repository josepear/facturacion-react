import type { ReactNode } from "react";

type FieldProps = {
  label: string;
  error?: string;
  children: ReactNode;
  hint?: string;
};

export function Field({ label, error, children, hint }: FieldProps) {
  return (
    <label className="grid w-full gap-2 self-start text-sm content-start">
      <span className="font-medium">{label}</span>
      {/* Un solo hijo en la rejilla del label: evita que Fragmentos (p. ej. input + aviso) abran filas extra y desalineen respecto a otros campos */}
      <div className="grid min-w-0 w-full gap-1">{children}</div>
      {hint ? <span className="text-informative">{hint}</span> : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
