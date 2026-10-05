import { ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { ScaledHtmlPreview } from "@/features/shared/components/ScaledHtmlPreview";
import { loadInvoiceHtmlBlob } from "@/features/shared/lib/loadInvoiceHtmlBlob";
import { CLOSE } from "@/features/shared/lib/uiActionCopy";
import { getErrorMessageFromUnknown } from "@/infrastructure/api/httpClient";
import { cn } from "@/lib/utils";

const MAX_ZOOM_STEPS = 12;

export type InvoiceHtmlPreviewModalProps = {
  open: boolean;
  recordId: string | null;
  /** Texto auxiliar en cabecera (p. ej. número de factura). */
  subtitle?: string;
  onOpenChange: (open: boolean) => void;
};

/**
 * Modal con HTML oficial o vista previa de servidor para un `recordId` de documento.
 * Usa `<dialog showModal>` (portal a `document.body`) para apilar por encima de otros `<dialog>` (p. ej. resumen asesor).
 */
export function InvoiceHtmlPreviewModal({ open, recordId, subtitle, onOpenChange }: InvoiceHtmlPreviewModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomSteps, setZoomSteps] = useState(0);
  const objectUrlRef = useRef<string | null>(null);

  const revoke = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setSrc(null);
  }, []);

  useEffect(() => {
    if (!open || !recordId) {
      revoke();
      setError(null);
      setLoading(false);
      setZoomSteps(0);
      return;
    }

    const ac = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    revoke();

    void (async () => {
      try {
        const blob = await loadInvoiceHtmlBlob(recordId, ac.signal);
        if (cancelled || ac.signal.aborted) {
          return;
        }
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setSrc(url);
      } catch (err) {
        if (ac.signal.aborted || cancelled) {
          return;
        }
        setError(getErrorMessageFromUnknown(err));
      } finally {
        if (!cancelled && !ac.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
      revoke();
      setLoading(false);
    };
  }, [open, recordId, revoke]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) {
      return;
    }
    if (open && recordId) {
      if (!el.open) {
        el.showModal();
      }
    } else if (el.open) {
      el.close();
    }
  }, [open, recordId]);

  if (typeof document === "undefined" || !open || !recordId) {
    return null;
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className={cn(
        "fixed inset-0 z-50 m-0 flex h-[100dvh] max-h-none w-full max-w-none flex-col border-0 bg-transparent p-0 shadow-none backdrop:bg-black/55",
        "open:flex",
      )}
      aria-labelledby="invoice-preview-modal-title"
      aria-modal="true"
      onClose={() => onOpenChange(false)}
    >
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6">
        <button
          type="button"
          className="absolute inset-0 bg-black/55"
          aria-label={`${CLOSE} vista previa`}
          onClick={() => onOpenChange(false)}
        />
        <div className="relative z-[1] flex max-h-[min(94vh,920px)] w-full max-w-[min(96vw,1180px)] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4">
            <div className="min-w-0">
              <h2 id="invoice-preview-modal-title" className="truncate text-sm font-semibold text-foreground">
                Vista de factura
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
              <Button type="button" variant="default" className="shrink-0" onClick={() => onOpenChange(false)}>
                {CLOSE}
              </Button>
            </div>
          </div>
          <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-muted/30 p-3 sm:p-4">
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {loading ? (
              <p className="rounded-md border border-dashed border-border px-3 py-10 text-center text-sm text-muted-foreground">
                Cargando HTML…
              </p>
            ) : null}
            {src && !loading ? (
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
