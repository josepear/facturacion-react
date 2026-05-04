import { useEffect, useState } from "react";

import { fetchWithAuth } from "@/infrastructure/api/httpClient";

type FacturarOfficialHtmlPreviewProps = {
  recordId: string;
  /** Incrementar tras guardar o recargar para volver a pedir el HTML al servidor. */
  refreshVersion: number;
};

export function FacturarOfficialHtmlPreview({ recordId, refreshVersion }: FacturarOfficialHtmlPreviewProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = String(recordId ?? "").trim();
    if (!id) {
      setSrc(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    setLoading(true);
    setError(null);
    setSrc(null);

    const path = `/api/documents/rendered-html?recordId=${encodeURIComponent(id)}`;

    void (async () => {
      try {
        const response = await fetchWithAuth(path);
        if (!response.ok) {
          if (!cancelled) {
            setError(`No se pudo cargar el HTML (HTTP ${response.status}).`);
          }
          return;
        }
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setSrc(objectUrl);
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
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [recordId, refreshVersion]);

  if (loading) {
    return (
      <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-8 text-center text-sm text-muted-foreground">
        Cargando HTML oficial…
      </p>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!src) {
    return null;
  }

  return (
    <iframe
      title="Vista previa HTML oficial"
      src={src}
      className="h-[min(70vh,920px)] w-full rounded-md border border-border bg-white shadow-sm"
    />
  );
}
