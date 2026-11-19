import { ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { ScaledHtmlPreview } from "@/features/shared/components/ScaledHtmlPreview";
import { CLOSE } from "@/features/shared/lib/uiActionCopy";
import { buildPublicShareInvoiceHtmlUrl } from "@/infrastructure/api/exportReportsApi";
import { cn } from "@/lib/utils";

const MAX_ZOOM_STEPS = 12;

export type PublicInvoiceHtmlDialogProps = {
  /** Token del informe compartido (público). */
  token: string;
  /** `ref` opaco de la factura dentro del informe, o `null` para cerrar. */
  invoiceRef: string | null;
  /** Texto auxiliar en cabecera (p. ej. número de factura). */
  subtitle?: string;
  onClose: () => void;
};

/**
 * Muestra el HTML oficial de una factura de un informe compartido, sin sesión, dentro de la misma página.
 * El servidor valida que la factura pertenece al informe (mismo emisor/periodo) antes de servir el HTML.
 */
export function PublicInvoiceHtmlDialog({ token, invoiceRef, subtitle, onClose }: PublicInvoiceHtmlDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [zoomSteps, setZoomSteps] = useState(0);
  const open = Boolean(String(token || "").trim() && String(invoiceRef || "").trim());
  const src = open ? buildPublicShareInvoiceHtmlUrl(token, String(invoiceRef)) : "";

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) {
      return;
    }
    if (open) {
      if (!el.open) {
        el.showModal();
      }
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  if (typeof document === "undefined" || !open) {
    return null;
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className={cn(
        "fixed inset-0 z-50 m-0 flex h-[100dvh] max-h-none w-full max-w-none flex-col border-0 bg-transparent p-0 shadow-none backdrop:bg-black/55",
        "open:flex",
      )}
      aria-labelledby="public-invoice-viewer-title"
      aria-modal="true"
      onClose={onClose}
    >
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6">
        <button
          type="button"
          className="absolute inset-0 bg-black/55"
          aria-label={`${CLOSE} factura`}
          onClick={onClose}
        />
        <div className="relative z-[1] flex max-h-[min(94vh,920px)] w-full max-w-[min(96vw,1180px)] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4">
            <div className="min-w-0">
              <h2 id="public-invoice-viewer-title" className="truncate text-sm font-semibold text-foreground">
                Factura
              </h2>
              {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-9 w-9 shrink-0"
                aria-label="Ampliar"
                disabled={zoomSteps >= MAX_ZOOM_STEPS}
                onClick={() => setZoomSteps((s) => Math.min(MAX_ZOOM_STEPS, s + 1))}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-9 w-9 shrink-0"
                aria-label="Reducir"
                disabled={zoomSteps <= 0}
                onClick={() => setZoomSteps((s) => Math.max(0, s - 1))}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button type="button" variant="default" className="shrink-0" onClick={onClose}>
                {CLOSE}
              </Button>
            </div>
          </div>
          <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-muted/30 p-3 sm:p-4">
            {src ? (
              <ScaledHtmlPreview
                src={src}
                boxClassName="min-h-[min(70vh,780px)] w-full"
                zoomSteps={zoomSteps}
                blockIframePointer={false}
              />
            ) : null}
          </div>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
