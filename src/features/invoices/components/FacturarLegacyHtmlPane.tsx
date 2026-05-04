import { ZoomIn, ZoomOut } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { InvoiceDocument } from "@/domain/document/types";
import { fetchDocumentLegacyPreviewBlob } from "@/infrastructure/api/documentsApi";
import { fetchWithAuth } from "@/infrastructure/api/httpClient";
import { cn } from "@/lib/utils";

const PREVIEW_DEBOUNCE_MS = 420;
const ZOOM_STEP = 1.22;
const MAX_TOTAL_SCALE = 2.25;
const MAX_ZOOM_STEPS = 12;
const DEFAULT_INTRINSIC = { w: 794, h: 1123 };

type IntrinsicSize = { w: number; h: number };

function readIframeIntrinsicSize(iframe: HTMLIFrameElement): IntrinsicSize | null {
  try {
    const doc = iframe.contentDocument;
    const root = doc?.documentElement;
    const body = doc?.body;
    if (!root) {
      return null;
    }
    const w = Math.max(root.scrollWidth, body?.scrollWidth ?? 0, root.clientWidth);
    const h = Math.max(root.scrollHeight, body?.scrollHeight ?? 0, root.clientHeight);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 100 || h < 100) {
      return null;
    }
    return { w, h };
  } catch {
    return null;
  }
}

type ScaledHtmlPreviewProps = {
  src: string;
  /** Altura mínima del área de scroll (p. ej. vista incrustada). */
  boxClassName: string;
  /** Pasos de zoom sobre la escala «ajustar a caja» (0 = solo ajuste). */
  zoomSteps: number;
  /** Si true, bloquea clics en el HTML (p. ej. para que el clic abra el modal en el contenedor). */
  blockIframePointer: boolean;
  /** Clic en el área de previsualización (p. ej. abrir modal en vista incrustada). */
  onSurfaceClick?: () => void;
};

/**
 * Escala el HTML de la factura al ancho/alto del contenedor (misma idea que `fitPreviewToViewport` en legacy).
 */
function ScaledHtmlPreview({ src, boxClassName, zoomSteps, blockIframePointer, onSurfaceClick }: ScaledHtmlPreviewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [intrinsic, setIntrinsic] = useState<IntrinsicSize | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) {
      return;
    }
    const ro = new ResizeObserver(() => {
      setBox({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const base = intrinsic ?? DEFAULT_INTRINSIC;

  const baseFit = useMemo(() => {
    if (box.w < 32 || box.h < 32) {
      return 1;
    }
    const pad = 10;
    const sw = Math.max(box.w - pad, 1);
    const sh = Math.max(box.h - pad, 1);
    const widthScale = sw / base.w;
    const heightScale = sh / base.h;
    const raw = Math.min(widthScale, heightScale, 1);
    return raw < 1 ? raw * 0.988 : 1;
  }, [base.h, base.w, box.h, box.w]);

  const displayScale = useMemo(() => {
    const stepped = baseFit * ZOOM_STEP ** zoomSteps;
    return Math.min(stepped, MAX_TOTAL_SCALE);
  }, [baseFit, zoomSteps]);

  const layoutW = base.w * displayScale;
  const layoutH = base.h * displayScale;

  const handleIframeLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe) {
      return;
    }
    const next = readIframeIntrinsicSize(iframe);
    if (next) {
      setIntrinsic(next);
    }
  };

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative w-full min-w-0 overflow-auto bg-muted/20",
        boxClassName,
        onSurfaceClick && "cursor-zoom-in",
      )}
      onClick={onSurfaceClick}
      onKeyDown={
        onSurfaceClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSurfaceClick();
              }
            }
          : undefined
      }
      tabIndex={onSurfaceClick ? 0 : undefined}
      aria-label={onSurfaceClick ? "Abrir vista ampliada de la factura" : undefined}
    >
      <div
        className="relative mx-auto"
        style={{
          width: layoutW,
          height: layoutH,
        }}
      >
        <iframe
          ref={iframeRef}
          title="Vista previa HTML plantilla legacy"
          src={src}
          className={cn("absolute left-0 top-0 border-0 bg-white", blockIframePointer && "pointer-events-none")}
          style={{
            width: base.w,
            height: base.h,
            transform: `scale(${displayScale})`,
            transformOrigin: "top left",
          }}
          onLoad={handleIframeLoad}
        />
      </div>
    </div>
  );
}

type FacturarLegacyHtmlPaneProps = {
  liveDocument: InvoiceDocument;
  serverRecordId: string;
  isDirty: boolean;
  refreshVersion: number;
};

/**
 * HTML de plantilla legacy: desde disco si el borrador coincide con el último guardado;
 * en caso contrario, vista previa en vivo vía `POST /api/documents/preview-html` (debounced).
 * Vista incrustada ajustada al ancho; clic abre modal con lupa + / − (comportamiento similar a legacy).
 */
export function FacturarLegacyHtmlPane({ liveDocument, serverRecordId, isDirty, refreshVersion }: FacturarLegacyHtmlPaneProps) {
  const deferredDocument = useDeferredValue(liveDocument);
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalZoomSteps, setModalZoomSteps] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const savedId = String(serverRecordId || "").trim();
  const useSavedOnDisk = Boolean(savedId && !isDirty);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    const revokeIfNeeded = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    const applyBlobUrl = (blob: Blob) => {
      revokeIfNeeded();
      objectUrl = URL.createObjectURL(blob);
      if (!cancelled) {
        setSrc(objectUrl);
      } else {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    if (useSavedOnDisk) {
      setLoading(true);
      setError(null);
      setSrc(null);

      const path = `/api/documents/rendered-html?recordId=${encodeURIComponent(savedId)}`;

      void (async () => {
        try {
          const response = await fetchWithAuth(path);
          if (!response.ok) {
            if (!cancelled) {
              setError(`No se pudo cargar el HTML guardado (HTTP ${response.status}).`);
            }
            return;
          }
          const blob = await response.blob();
          if (cancelled) {
            return;
          }
          applyBlobUrl(blob);
        } catch (err) {
          if (!cancelled) {
            setError((err as Error).message || "Error al cargar el HTML oficial.");
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      })();

      return () => {
        cancelled = true;
        revokeIfNeeded();
        setSrc(null);
        setLoading(false);
      };
    }

    setLoading(true);
    setError(null);
    setSrc(null);

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      const ac = new AbortController();
      abortRef.current = ac;

      void (async () => {
        try {
          const blob = await fetchDocumentLegacyPreviewBlob(deferredDocument, ac.signal);
          if (ac.signal.aborted || cancelled) {
            return;
          }
          applyBlobUrl(blob);
        } catch (err) {
          if (ac.signal.aborted || cancelled) {
            return;
          }
          setError((err as Error).message || "No se pudo generar la vista previa.");
        } finally {
          if (!ac.signal.aborted && !cancelled) {
            setLoading(false);
          }
        }
      })();
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      revokeIfNeeded();
      setSrc(null);
      setLoading(false);
    };
  }, [deferredDocument, isDirty, refreshVersion, savedId, useSavedOnDisk]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) {
      return;
    }
    if (modalOpen) {
      setModalZoomSteps(0);
      d.showModal();
    } else {
      d.close();
    }
  }, [modalOpen]);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Factura (plantilla legacy)</h3>
        {loading ? <span className="text-xs text-muted-foreground">Actualizando…</span> : null}
      </div>
      {useSavedOnDisk ? (
        <p className="text-xs text-muted-foreground">HTML del último guardado en disco (coincide con «Ver HTML oficial»).</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Vista previa en vivo con la misma plantilla que el PDF/HTML oficial (~{PREVIEW_DEBOUNCE_MS / 1000}s de retardo
          al escribir).
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Pulsa la vista previa (o «Ampliar») para abrir el modal; dentro usa las lupas para acercar o alejar.
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {src ? (
        <div className="relative rounded-md border border-border bg-muted/10 shadow-sm">
          <ScaledHtmlPreview
            src={src}
            boxClassName="h-[min(55vh,720px)] min-h-[220px]"
            zoomSteps={0}
            blockIframePointer
            onSurfaceClick={() => setModalOpen(true)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="pointer-events-auto absolute bottom-2 right-2 z-10 bg-background/95 shadow-md"
            onClick={(e) => {
              e.stopPropagation();
              setModalOpen(true);
            }}
          >
            Ampliar
          </Button>
        </div>
      ) : loading ? (
        <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-8 text-center text-sm text-muted-foreground">
          Generando HTML…
        </p>
      ) : null}

      <dialog
        ref={dialogRef}
        className={cn(
          "w-[min(96vw,1180px)] max-w-[96vw] rounded-lg border border-border bg-background p-0 shadow-2xl",
          "open:flex open:max-h-[min(94vh,920px)] open:flex-col",
          "[&::backdrop]:bg-black/55",
        )}
        onClose={() => setModalOpen(false)}
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4">
          <h4 className="text-sm font-semibold">Vista de factura</h4>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9 shrink-0"
              aria-label="Ampliar"
              disabled={modalZoomSteps >= MAX_ZOOM_STEPS}
              onClick={() => setModalZoomSteps((s) => Math.min(MAX_ZOOM_STEPS, s + 1))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9 shrink-0"
              aria-label="Reducir"
              onClick={() => setModalZoomSteps((s) => Math.max(0, s - 1))}
              disabled={modalZoomSteps <= 0}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button type="button" variant="default" className="shrink-0" onClick={() => setModalOpen(false)}>
              Cerrar
            </Button>
          </div>
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-muted/30 p-3 sm:p-4">
          {src ? (
            <ScaledHtmlPreview
              src={src}
              boxClassName="min-h-[min(72vh,800px)] w-full"
              zoomSteps={modalZoomSteps}
              blockIframePointer={false}
            />
          ) : null}
        </div>
      </dialog>
    </div>
  );
}
