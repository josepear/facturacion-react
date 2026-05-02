import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { calculateTotals } from "@/domain/document/calculateTotals";
import { useSessionQuery } from "@/features/shared/hooks/useSessionQuery";
import { archiveDocument, archiveDocumentYear, fetchDocumentDetail, fetchRuntimeConfig } from "@/infrastructure/api/documentsApi";
import { openOfficialDocumentInNewTab } from "@/infrastructure/api/openOfficialDocumentOutput";
import { fetchHistoryInvoices } from "@/infrastructure/api/historyApi";
import { deleteTrashEntries, fetchTrash } from "@/infrastructure/api/trashApi";
import { mapLegacyDocumentToForm } from "@/infrastructure/mappers/documentMapper";
import { formatCurrency } from "@/lib/utils";

function formatDate(value: string): string {
  const safe = String(value || "").trim();
  if (!safe) {
    return "-";
  }
  return safe;
}

const ACCOUNTING_STATUS_LABELS: Record<string, string> = {
  ENVIADA: "Enviada",
  COBRADA: "Cobrada",
  CANCELADA: "Cancelada",
};

function formatAccountingStatusLabel(status: string): string {
  const key = String(status || "").trim().toUpperCase();
  return ACCOUNTING_STATUS_LABELS[key] || (key ? key : "-");
}

export function HistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = String(searchParams.get("q") || "").trim();
  const initialType = String(searchParams.get("type") || "").trim();
  const initialYear = String(searchParams.get("year") || "").trim();
  const initialStatus = String(searchParams.get("status") || "").trim();
  const initialProfile = String(searchParams.get("profile") || "").trim();
  const initialRecordId = String(searchParams.get("recordId") || "").trim();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [filterType, setFilterType] = useState<"" | "factura" | "presupuesto">(
    initialType === "factura" || initialType === "presupuesto" ? initialType : "",
  );
  const [filterYear, setFilterYear] = useState(initialYear);
  const [filterStatus, setFilterStatus] = useState(initialStatus);
  const [filterProfile, setFilterProfile] = useState(initialProfile);
  const [selectedRecordId, setSelectedRecordId] = useState(initialRecordId);
  const [archiveYear, setArchiveYear] = useState("");
  const [archiveProfileId, setArchiveProfileId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");
  const [outputFeedback, setOutputFeedback] = useState<{ text: string; tone: "error" } | null>(null);
  const [officialOutputLoading, setOfficialOutputLoading] = useState<"html" | "pdf" | null>(null);
  const [recordIdCopyFeedback, setRecordIdCopyFeedback] = useState<{ text: string; tone: "success" | "error" } | null>(null);

  const selectRecord = (recordId: string) => {
    setSelectedRecordId(recordId);
    const next = new URLSearchParams(searchParams);
    const safeRecordId = String(recordId || "").trim();
    if (safeRecordId) {
      next.set("recordId", safeRecordId);
    } else {
      next.delete("recordId");
    }
    setSearchParams(next, { replace: true });
    setOutputFeedback(null);
    setRecordIdCopyFeedback(null);
  };

  const historyQuery = useQuery({
    queryKey: ["history-invoices"],
    queryFn: fetchHistoryInvoices,
  });

  const configQuery = useQuery({
    queryKey: ["runtime-config"],
    queryFn: fetchRuntimeConfig,
  });

  const sessionQuery = useSessionQuery();

  const trashQuery = useQuery({
    queryKey: ["trash"],
    queryFn: fetchTrash,
  });

  const detailQuery = useQuery({
    queryKey: ["document-detail", selectedRecordId],
    queryFn: () => fetchDocumentDetail(selectedRecordId),
    enabled: Boolean(selectedRecordId),
  });

  const filteredItems = useMemo(() => {
    const term = String(searchTerm || "").trim().toLowerCase();
    let items = historyQuery.data ?? [];
    if (filterType) {
      items = items.filter((item) => item.type === filterType);
    }
    if (filterYear) {
      items = items.filter((item) => String(item.issueDate || "").startsWith(filterYear));
    }
    if (filterStatus) {
      items = items.filter((item) => String(item.status || "").toUpperCase() === filterStatus.toUpperCase());
    }
    if (filterProfile) {
      items = items.filter((item) => item.templateProfileId === filterProfile);
    }
    if (!term) {
      return items;
    }
    return items.filter((item) => {
      const recordId = String(item.recordId || "").toLowerCase();
      const number = String(item.number || "").toLowerCase();
      const client = String(item.clientName || "").toLowerCase();
      const typeLabel = String(item.typeLabel || "").toLowerCase();
      const typeRaw = String(item.type || "").toLowerCase();
      const profileLabel = String(item.templateProfileLabel || "").toLowerCase();
      return (
        recordId.includes(term) ||
        number.includes(term) ||
        client.includes(term) ||
        typeLabel.includes(term) ||
        typeRaw.includes(term) ||
        profileLabel.includes(term)
      );
    });
  }, [historyQuery.data, searchTerm, filterType, filterYear, filterStatus, filterProfile]);

  const openedDocument = useMemo(() => {
    if (!detailQuery.data?.document) {
      return null;
    }
    const mapped = mapLegacyDocumentToForm(detailQuery.data.document);
    return {
      ...mapped,
      computedTotals: calculateTotals(mapped),
    };
  }, [detailQuery.data]);

  const years = useMemo(
    () =>
      Array.from(new Set((historyQuery.data ?? []).map((item) => String(item.issueDate || "").slice(0, 4)).filter(Boolean)))
        .sort((a, b) => b.localeCompare(a)),
    [historyQuery.data],
  );

  const profileOptions = useMemo(
    () => configQuery.data?.templateProfiles ?? [],
    [configQuery.data?.templateProfiles],
  );

  /** Solo lectura: `id` viene del detalle; `label` solo si coincide con `/api/config` ya cargado (sin inferir). */
  const documentProfileSummary = useMemo(() => {
    if (!openedDocument) {
      return null;
    }
    const id = String(openedDocument.templateProfileId || "").trim();
    if (!id) {
      return null;
    }
    const label = profileOptions.find((p) => p.id === id)?.label?.trim();
    return label ? `${label} (${id})` : id;
  }, [openedDocument, profileOptions]);

  const isAdmin =
    Boolean(sessionQuery.data?.authenticated) &&
    String(sessionQuery.data?.user?.role || "").trim().toLowerCase() === "admin";
  const trashDocumentItems = useMemo(
    () => (trashQuery.data?.items ?? []).filter((item) => item.category === "documentos"),
    [trashQuery.data?.items],
  );

  const rawHistoryCount = historyQuery.data?.length ?? 0;
  const hasActiveFilters = Boolean(filterType || filterYear || filterStatus || filterProfile || String(searchTerm || "").trim());
  const selectionHiddenByFilters = Boolean(
    selectedRecordId && !filteredItems.some((item) => item.recordId === selectedRecordId),
  );
  const syncFiltersToUrl = (
    nextSearch: string,
    nextType: "" | "factura" | "presupuesto",
    nextYear: string,
    nextStatus: string,
    nextProfile: string,
  ) => {
    const next = new URLSearchParams(searchParams);
    const safeSearch = String(nextSearch || "").trim();
    const safeYear = String(nextYear || "").trim();
    const safeStatus = String(nextStatus || "").trim();
    const safeProfile = String(nextProfile || "").trim();
    if (safeSearch) { next.set("q", safeSearch); } else { next.delete("q"); }
    if (nextType) { next.set("type", nextType); } else { next.delete("type"); }
    if (safeYear) { next.set("year", safeYear); } else { next.delete("year"); }
    if (safeStatus) { next.set("status", safeStatus); } else { next.delete("status"); }
    if (safeProfile) { next.set("profile", safeProfile); } else { next.delete("profile"); }
    setSearchParams(next, { replace: true });
  };

  const copySelectedRecordId = async () => {
    const id = String(selectedRecordId || "").trim();
    if (!id) {
      return;
    }
    setRecordIdCopyFeedback(null);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(id);
      } else {
        const ta = document.createElement("textarea");
        ta.value = id;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) {
          throw new Error("copy");
        }
      }
      setRecordIdCopyFeedback({ text: "Copiado al portapapeles.", tone: "success" });
    } catch {
      setRecordIdCopyFeedback({ text: "No se pudo copiar.", tone: "error" });
    }
    window.setTimeout(() => setRecordIdCopyFeedback(null), 2500);
  };

  const openOfficialOutput = async (kind: "html" | "pdf") => {
    if (!selectedRecordId) {
      return;
    }
    setOutputFeedback(null);
    setOfficialOutputLoading(kind);
    try {
      const result = await openOfficialDocumentInNewTab(selectedRecordId, kind);
      if (!result.ok) {
        setOutputFeedback({ text: result.message, tone: "error" });
      }
    } finally {
      setOfficialOutputLoading(null);
    }
  };

  const archiveDocumentMutation = useMutation({
    mutationFn: (recordId: string) => archiveDocument(recordId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["history-invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["trash"] }),
      ]);
      setStatusMessage("Documento archivado.");
      setStatusTone("success");
      selectRecord("");
    },
    onError: (error) => {
      setStatusMessage((error as Error).message || "No se pudo archivar el documento.");
      setStatusTone("error");
    },
  });

  const archiveYearMutation = useMutation({
    mutationFn: () => {
      const safeYear = String(archiveYear || "").trim();
      const safeProfileId = String(archiveProfileId || "").trim();
      if (!safeYear) {
        throw new Error("Selecciona ejercicio.");
      }
      if (!safeProfileId) {
        throw new Error("Selecciona perfil.");
      }
      return archiveDocumentYear({ year: safeYear, templateProfileId: safeProfileId });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["history-invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["trash"] }),
      ]);
      setStatusMessage("Ejercicio de documentos archivado.");
      setStatusTone("success");
    },
    onError: (error) => {
      setStatusMessage((error as Error).message || "No se pudo archivar el ejercicio.");
      setStatusTone("error");
    },
  });

  const deleteTrashMutation = useMutation({
    mutationFn: (path: string) => deleteTrashEntries([path]),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["trash"] });
      setStatusMessage("Elemento borrado definitivamente de papelera.");
      setStatusTone("success");
    },
    onError: (error) => {
      setStatusMessage((error as Error).message || "No se pudo borrar de papelera.");
      setStatusTone("error");
    },
  });

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Historial</h1>
        <p className="text-sm text-muted-foreground">
          Localiza documentos y reábrelos en Facturar para revisarlos o editarlos.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Listado de documentos</CardTitle>
            <CardDescription>Fuente: contrato legacy de `GET /api/history`.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Tipo de documento</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={filterType}
                  onChange={(event) => {
                    const nextType = event.target.value as "" | "factura" | "presupuesto";
                    setFilterType(nextType);
                    syncFiltersToUrl(searchTerm, nextType, filterYear, filterStatus, filterProfile);
                  }}
                  aria-label="Filtrar por tipo de documento"
                >
                  <option value="">Todos</option>
                  <option value="factura">Factura</option>
                  <option value="presupuesto">Presupuesto</option>
                </select>
              </div>
              <div className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Ejercicio (fecha emisión)</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={filterYear}
                  onChange={(event) => {
                    const nextYear = event.target.value;
                    setFilterYear(nextYear);
                    syncFiltersToUrl(searchTerm, filterType, nextYear, filterStatus, filterProfile);
                  }}
                  aria-label="Filtrar por año de emisión"
                >
                  <option value="">Todos</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Estado contable</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={filterStatus}
                  onChange={(event) => {
                    const nextStatus = event.target.value;
                    setFilterStatus(nextStatus);
                    syncFiltersToUrl(searchTerm, filterType, filterYear, nextStatus, filterProfile);
                  }}
                  aria-label="Filtrar por estado contable"
                >
                  <option value="">Todos</option>
                  <option value="ENVIADA">Enviada</option>
                  <option value="COBRADA">Cobrada</option>
                  <option value="CANCELADA">Cancelada</option>
                </select>
              </div>
              <div className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Perfil de plantilla</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={filterProfile}
                  onChange={(event) => {
                    const nextProfile = event.target.value;
                    setFilterProfile(nextProfile);
                    syncFiltersToUrl(searchTerm, filterType, filterYear, filterStatus, nextProfile);
                  }}
                  aria-label="Filtrar por perfil de plantilla"
                >
                  <option value="">Todos</option>
                  {profileOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label || p.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Input
              placeholder="Filtrar por número, cliente, perfil, recordId o tipo"
              value={searchTerm}
              onChange={(event) => {
                const nextSearch = event.target.value;
                setSearchTerm(nextSearch);
                syncFiltersToUrl(nextSearch, filterType, filterYear, filterStatus, filterProfile);
              }}
              aria-label="Filtrar listado de historial"
            />
            {hasActiveFilters ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterType("");
                    setFilterYear("");
                    setFilterStatus("");
                    setFilterProfile("");
                    setSearchTerm("");
                    syncFiltersToUrl("", "", "", "", "");
                  }}
                >
                  Limpiar filtros
                </Button>
              </div>
            ) : null}
            {historyQuery.isSuccess ? (
              <p className="text-xs text-muted-foreground">
                Mostrando {filteredItems.length} de {rawHistoryCount} documento{rawHistoryCount === 1 ? "" : "s"}
                {rawHistoryCount === 0 ? " (lista vacía desde el servidor)" : ""}.
              </p>
            ) : null}
            <div className="max-h-[560px] overflow-auto rounded-md border">
              {historyQuery.isLoading ? (
                <p className="p-3 text-sm text-muted-foreground">Cargando historial...</p>
              ) : historyQuery.isError ? (
                <p className="p-3 text-sm text-red-600">
                  {(historyQuery.error as Error).message || "No se pudo cargar el historial. Revisa la conexión y vuelve a entrar en la página."}
                </p>
              ) : filteredItems.length ? (
                <ul className="divide-y">
                  {filteredItems.map((item) => {
                    const isActive = item.recordId === selectedRecordId;
                    return (
                      <li key={item.recordId}>
                        <button
                          type="button"
                          className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                            isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                          }`}
                          onClick={() => selectRecord(item.recordId)}
                        >
                          <p className="font-medium">{item.number || "Sin número"}</p>
                          <p className={`text-xs ${isActive ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
                            {item.clientName || "Sin cliente"} · {item.typeLabel || item.type} · {formatDate(item.issueDate)}
                          </p>
                          <p className={`text-xs ${isActive ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
                            {formatCurrency(Number(item.total || 0))}
                            {item.templateProfileLabel ? ` · ${item.templateProfileLabel}` : ""}
                            {item.status ? ` · ${formatAccountingStatusLabel(item.status)}` : ""}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : rawHistoryCount === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No hay documentos en el historial.</p>
              ) : (
                <div className="grid gap-3 p-3">
                  <p className="text-sm text-muted-foreground">
                    Ningún documento coincide con los filtros activos (tipo, ejercicio, estado, perfil o búsqueda).
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    onClick={() => {
                      setFilterType("");
                      setFilterYear("");
                      setFilterStatus("");
                      setFilterProfile("");
                      setSearchTerm("");
                      syncFiltersToUrl("", "", "", "", "");
                    }}
                  >
                    Limpiar filtros
                  </Button>
                </div>
              )}
            </div>
            <div className="grid gap-2 rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">Archivar ejercicio (perfil + año)</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={archiveYear}
                  onChange={(event) => setArchiveYear(event.target.value)}
                >
                  <option value="">Selecciona ejercicio</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={archiveProfileId}
                  onChange={(event) => setArchiveProfileId(event.target.value)}
                >
                  <option value="">Selecciona perfil</option>
                  {profileOptions.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.label || profile.id}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="button" variant="outline" onClick={() => archiveYearMutation.mutate()} disabled={archiveYearMutation.isPending}>
                {archiveYearMutation.isPending ? "Archivando..." : "Archivar ejercicio"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documento abierto</CardTitle>
            <CardDescription>Detalle cargado con `GET /api/documents/detail`.</CardDescription>
            {selectedRecordId ? (
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 text-xs text-muted-foreground">
                    Seleccionado: <span className="font-mono break-all">{selectedRecordId}</span>
                  </p>
                  <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void copySelectedRecordId()}>
                    Copiar recordId
                  </Button>
                </div>
                {recordIdCopyFeedback ? (
                  <p
                    className={`text-xs ${recordIdCopyFeedback.tone === "success" ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {recordIdCopyFeedback.text}
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-3">
            {!selectedRecordId ? (
              <p className="text-sm text-muted-foreground">Selecciona un documento del listado para abrirlo.</p>
            ) : (
              <>
                {selectionHiddenByFilters ? (
                  <p className="text-sm text-muted-foreground">
                    Este documento no aparece en la lista filtrada; el detalle sigue disponible. Ajusta tipo, ejercicio o búsqueda para verlo en el listado.
                  </p>
                ) : null}
                {detailQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Abriendo documento...</p>
                ) : detailQuery.error ? (
                  <p className="text-sm text-red-600">{(detailQuery.error as Error).message || "No se pudo abrir el documento."}</p>
                ) : openedDocument ? (
              <>
                <div className="rounded-md border p-3 text-sm">
                  <p><strong>recordId:</strong> {selectedRecordId}</p>
                  {documentProfileSummary ? (
                    <p><strong>Perfil plantilla:</strong> {documentProfileSummary}</p>
                  ) : null}
                  {String(openedDocument.templateLayout || "").trim() ? (
                    <p><strong>Plantilla / layout:</strong> {String(openedDocument.templateLayout).trim()}</p>
                  ) : null}
                  <p><strong>Tipo:</strong> {openedDocument.type}</p>
                  <p><strong>Número:</strong> {openedDocument.number || "-"}</p>
                  <p><strong>Estado contable:</strong> {formatAccountingStatusLabel(openedDocument.accounting.status)}</p>
                  <p><strong>Fecha:</strong> {formatDate(openedDocument.issueDate)}</p>
                  <p><strong>Cliente:</strong> {openedDocument.client.name || "-"}</p>
                  <p><strong>Líneas:</strong> {openedDocument.items.length}</p>
                  <p><strong>Subtotal:</strong> {formatCurrency(openedDocument.computedTotals.subtotal)}</p>
                  <p><strong>Total:</strong> {formatCurrency(openedDocument.computedTotals.total)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      const profileId = String(openedDocument.templateProfileId || "").trim();
                      const query = profileId
                        ? `recordId=${encodeURIComponent(selectedRecordId)}&templateProfileId=${encodeURIComponent(profileId)}`
                        : `recordId=${encodeURIComponent(selectedRecordId)}`;
                      navigate(`/facturar?${query}`);
                    }}
                  >
                    Editar en Facturar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openOfficialOutput("html")}
                    disabled={officialOutputLoading !== null}
                  >
                    {officialOutputLoading === "html" ? "Abriendo HTML..." : "Ver HTML oficial"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openOfficialOutput("pdf")}
                    disabled={officialOutputLoading !== null}
                  >
                    {officialOutputLoading === "pdf" ? "Abriendo PDF..." : "Abrir PDF oficial"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => archiveDocumentMutation.mutate(selectedRecordId)}
                    disabled={archiveDocumentMutation.isPending}
                  >
                    {archiveDocumentMutation.isPending ? "Archivando..." : "Archivar documento"}
                  </Button>
                </div>
                {outputFeedback ? (
                  <p className="text-sm text-red-600">{outputFeedback.text}</p>
                ) : null}
              </>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin datos de documento.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Papelera documentos</CardTitle>
          <CardDescription>
            Borrado permanente disponible para admin. Restauración aún no soportada por contrato backend actual.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!isAdmin ? (
            <p className="text-sm text-muted-foreground">Sin permisos: solo los administradores pueden borrar en papelera.</p>
          ) : null}
          <div className="max-h-[280px] overflow-auto rounded-md border">
            {trashQuery.isLoading ? (
              <p className="p-3 text-sm text-muted-foreground">Cargando papelera...</p>
            ) : trashDocumentItems.length ? (
              <ul className="divide-y">
                {trashDocumentItems.slice(0, 60).map((item) => (
                  <li key={item.path} className="flex items-center justify-between gap-2 p-2 text-sm">
                    <span className="truncate">{item.path}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => deleteTrashMutation.mutate(item.path)}
                      disabled={!isAdmin || deleteTrashMutation.isPending}
                    >
                      Borrar
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-3 text-sm text-muted-foreground">No hay documentos en papelera.</p>
            )}
          </div>
          {statusMessage ? (
            <p className={`text-sm ${statusTone === "error" ? "text-red-600" : statusTone === "success" ? "text-emerald-600" : "text-muted-foreground"}`}>
              {statusMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
