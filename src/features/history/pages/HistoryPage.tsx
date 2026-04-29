import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { calculateTotals } from "@/domain/document/calculateTotals";
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

export function HistoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [archiveYear, setArchiveYear] = useState("");
  const [archiveProfileId, setArchiveProfileId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");
  const [outputFeedback, setOutputFeedback] = useState<{ text: string; tone: "error" } | null>(null);
  const [officialOutputLoading, setOfficialOutputLoading] = useState<"html" | "pdf" | null>(null);

  const selectRecord = (recordId: string) => {
    setSelectedRecordId(recordId);
    setOutputFeedback(null);
  };

  const historyQuery = useQuery({
    queryKey: ["history-invoices"],
    queryFn: fetchHistoryInvoices,
  });

  const configQuery = useQuery({
    queryKey: ["runtime-config"],
    queryFn: fetchRuntimeConfig,
  });

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
    const items = historyQuery.data ?? [];
    if (!term) {
      return items;
    }
    return items.filter((item) => {
      const recordId = String(item.recordId || "").toLowerCase();
      const number = String(item.number || "").toLowerCase();
      const client = String(item.clientName || "").toLowerCase();
      const typeLabel = String(item.typeLabel || "").toLowerCase();
      return recordId.includes(term) || number.includes(term) || client.includes(term) || typeLabel.includes(term);
    });
  }, [historyQuery.data, searchTerm]);

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

  const profileOptions = configQuery.data?.templateProfiles ?? [];
  const isAdmin = String(configQuery.data?.currentUser?.role || "").trim().toLowerCase() === "admin";
  const trashDocumentItems = useMemo(
    () => (trashQuery.data?.items ?? []).filter((item) => item.category === "documentos"),
    [trashQuery.data?.items],
  );

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
          Consulta documentos, reabre en Facturar y ejecuta operaciones de ciclo de vida.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Listado de documentos</CardTitle>
            <CardDescription>Fuente: contrato legacy de `GET /api/history`.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Input
              placeholder="Buscar por número, cliente, tipo o recordId"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <div className="max-h-[560px] overflow-auto rounded-md border">
              {historyQuery.isLoading ? (
                <p className="p-3 text-sm text-muted-foreground">Cargando historial...</p>
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
                            {formatCurrency(Number(item.total || 0))} · {item.recordId}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="p-3 text-sm text-muted-foreground">No hay documentos para ese filtro.</p>
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
          </CardHeader>
          <CardContent className="grid gap-3">
            {!selectedRecordId ? (
              <p className="text-sm text-muted-foreground">Selecciona un documento del listado para abrirlo.</p>
            ) : detailQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Abriendo documento...</p>
            ) : detailQuery.error ? (
              <p className="text-sm text-red-600">{(detailQuery.error as Error).message || "No se pudo abrir el documento."}</p>
            ) : openedDocument ? (
              <>
                <div className="rounded-md border p-3 text-sm">
                  <p><strong>recordId:</strong> {selectedRecordId}</p>
                  <p><strong>Tipo:</strong> {openedDocument.type}</p>
                  <p><strong>Número:</strong> {openedDocument.number || "-"}</p>
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
