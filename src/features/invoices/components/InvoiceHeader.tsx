import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UseFormRegisterReturn } from "react-hook-form";

type ProfileOption = {
  id: string;
  label: string;
};

type SelectedProfileMeta = {
  id: string;
  label?: string;
  defaults?: {
    paymentMethod?: string;
  };
  business?: {
    bankAccount?: string;
  };
  design?: {
    layout?: string;
  };
} | null;

type InvoiceHeaderProps = {
  typeError?: string;
  issueDateError?: string;
  dueDateError?: string;
  referenceError?: string;
  statusError?: string;
  numberAvailabilityText: string;
  numberAvailabilityTone: "neutral" | "success" | "error";
  loadingNumber: boolean;
  checkingAvailability: boolean;
  profiles: ProfileOption[];
  activeTemplateProfileId: string;
  selectedProfile: SelectedProfileMeta;
  onSuggestNumber: () => void;
  onCheckAvailability: () => void;
  onTemplateProfileChange: (value: string) => void;
  register: {
    type: UseFormRegisterReturn;
    templateProfileId: UseFormRegisterReturn;
    issueDate: UseFormRegisterReturn;
    dueDate: UseFormRegisterReturn;
    reference: UseFormRegisterReturn;
    accountingStatus: UseFormRegisterReturn;
    paymentMethod: UseFormRegisterReturn;
    bankAccount: UseFormRegisterReturn;
    templateLayout: UseFormRegisterReturn;
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
  typeError,
  issueDateError,
  dueDateError,
  referenceError,
  statusError,
  numberAvailabilityText,
  numberAvailabilityTone,
  loadingNumber,
  checkingAvailability,
  profiles,
  activeTemplateProfileId,
  selectedProfile,
  onSuggestNumber,
  onCheckAvailability,
  onTemplateProfileChange,
  register,
}: InvoiceHeaderProps) {
  const selectedProfileLabel = selectedProfile?.label || selectedProfile?.id || "-";
  const profilePaymentMethod = String(selectedProfile?.defaults?.paymentMethod || "").trim() || "-";
  const profileBankAccount = String(selectedProfile?.business?.bankAccount || "").trim() || "-";
  const profileLayout = String(selectedProfile?.design?.layout || "").trim() || "-";

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 rounded-md border p-4">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Emisor y perfil</span>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Perfil plantilla">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register.templateProfileId}
              onChange={(event) => {
                register.templateProfileId.onChange(event);
                onTemplateProfileChange(event.target.value);
              }}
            >
              <option value="">Selecciona perfil</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Plantilla/layout">
            <Input placeholder="pear/editorial/voulita" {...register.templateLayout} />
          </Field>
          <Field label="Forma de pago">
            <Input placeholder="Transferencia" {...register.paymentMethod} />
          </Field>
          <Field label="Cuenta bancaria">
            <Input placeholder="ES..." {...register.bankAccount} />
          </Field>
        </div>
        <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          <span>Perfil activo config: {activeTemplateProfileId || "-"}</span>
          <span>Perfil aplicado: {selectedProfileLabel}</span>
          <span>Default pago perfil: {profilePaymentMethod}</span>
          <span>Default cuenta perfil: {profileBankAccount}</span>
          <span>Layout perfil: {profileLayout}</span>
        </div>
      </div>

      <div className="grid gap-4 rounded-md border p-4">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Datos del documento</span>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Tipo" error={typeError}>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register.type}
            >
              <option value="factura">Factura</option>
              <option value="presupuesto">Presupuesto</option>
            </select>
          </Field>
          <Field label="Número">
            <Input placeholder="Número factura" {...register.number} />
          </Field>
          <Field label="Serie">
            <Input placeholder="Serie opcional" {...register.series} />
          </Field>
          <Field label="Estado" error={statusError}>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register.accountingStatus}
            >
              <option value="ENVIADA">Enviada</option>
              <option value="COBRADA">Cobrada</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </Field>
          <Field label="Fecha emisión" error={issueDateError}>
            <Input type="date" {...register.issueDate} />
          </Field>
          <Field label="Vencimiento" error={dueDateError}>
            <Input type="date" {...register.dueDate} />
          </Field>
          <Field label="Referencia" error={referenceError}>
            <Input placeholder="Referencia documento" {...register.reference} />
          </Field>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Perfil plantilla">
          <Input value={selectedProfileLabel} readOnly />
        </Field>
        <Field label="Forma de pago">
          <Input value={profilePaymentMethod} readOnly />
        </Field>
        <Field label="Cuenta perfil">
          <Input value={profileBankAccount} readOnly />
        </Field>
        <Field label="Layout perfil">
          <Input value={profileLayout} readOnly />
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
