import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UseFormRegisterReturn } from "react-hook-form";

type ProfileOption = {
  id: string;
  label: string;
};

type InvoiceHeaderProps = {
  issueDateError?: string;
  numberAvailabilityText: string;
  numberAvailabilityTone: "neutral" | "success" | "error";
  loadingNumber: boolean;
  checkingAvailability: boolean;
  profiles: ProfileOption[];
  onSuggestNumber: () => void;
  onCheckAvailability: () => void;
  register: {
    templateProfileId: UseFormRegisterReturn;
    issueDate: UseFormRegisterReturn;
    series: UseFormRegisterReturn;
    number: UseFormRegisterReturn;
    recordIdInput: string;
    setRecordIdInput: (value: string) => void;
    onLoadRecord: () => void;
    loadingRecord: boolean;
  };
};

function getToneClass(tone: "neutral" | "success" | "error") {
  if (tone === "success") {
    return "text-emerald-600";
  }
  if (tone === "error") {
    return "text-red-600";
  }
  return "text-muted-foreground";
}

export function InvoiceHeader({
  issueDateError,
  numberAvailabilityText,
  numberAvailabilityTone,
  loadingNumber,
  checkingAvailability,
  profiles,
  onSuggestNumber,
  onCheckAvailability,
  register,
}: InvoiceHeaderProps) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Perfil plantilla">
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            {...register.templateProfileId}
          >
            <option value="">Selecciona perfil</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha emisión" error={issueDateError}>
          <Input type="date" {...register.issueDate} />
        </Field>
        <Field label="Serie">
          <Input placeholder="Serie opcional" {...register.series} />
        </Field>
        <Field label="Número">
          <Input placeholder="Número factura" {...register.number} />
        </Field>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={onSuggestNumber} disabled={loadingNumber}>
          {loadingNumber ? "Pidiendo número..." : "Pedir siguiente número"}
        </Button>
        <Button type="button" variant="outline" onClick={onCheckAvailability} disabled={checkingAvailability}>
          {checkingAvailability ? "Comprobando..." : "Validar disponibilidad"}
        </Button>
        <span className={`self-center text-sm ${getToneClass(numberAvailabilityTone)}`}>
          {numberAvailabilityText}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Recargar por recordId">
          <Input
            placeholder="facturas/2026/..."
            value={register.recordIdInput}
            onChange={(event) => register.setRecordIdInput(event.target.value)}
          />
        </Field>
        <Button type="button" variant="outline" onClick={register.onLoadRecord} disabled={register.loadingRecord}>
          {register.loadingRecord ? "Cargando..." : "Recargar documento"}
        </Button>
      </div>
    </div>
  );
}
