import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const ZOOM_STEP = 1.22;
const MAX_TOTAL_SCALE = 2.25;
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

export type ScaledHtmlPreviewProps = {
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
export function ScaledHtmlPreview({
  src,
  boxClassName,
  zoomSteps,
  blockIframePointer,
  onSurfaceClick,
}: ScaledHtmlPreviewProps) {
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
