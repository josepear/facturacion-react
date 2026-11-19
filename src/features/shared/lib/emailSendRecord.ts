import type { EmailSendRecord } from "@/domain/history/types";

/** Fecha/hora legible de un envío (`es-ES`, corto). */
export function formatEmailSentAt(iso?: string | null): string {
  const raw = String(iso || "").trim();
  if (!raw) {
    return "";
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  return date.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

/** Texto tipo «Enviado a x@y · 19/11/26, 8:12» a partir del registro del servidor. */
export function describeEmailSend(record?: EmailSendRecord | null): string {
  if (!record?.sentAt) {
    return "";
  }
  const when = formatEmailSentAt(record.sentAt);
  const to = String(record.to || "").trim();
  const head = to ? `Enviado a ${to} · ${when}` : `Enviado · ${when}`;
  const count = Number(record.batchCount || 0);
  return count > 1 ? `${head} (${count} documentos)` : head;
}
