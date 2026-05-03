import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  filesToHistoricalEncoded,
  filesToHistoricalPdfEncoded,
  runHistoricalPdfImport,
  runHistoricalWorkbookImport,
  scanHistoricalImportFolder,
  uploadHistoricalPdfs,
  uploadHistoricalWorkbooks,
  type HistoricalImportPdfPreviewRow,
  type HistoricalImportPdfReviewRow,
  type HistoricalImportScanPerson,
  type HistoricalImportScanResponse,
  type HistoricalImportUploadResponse,
} from "@/infrastructure/api/historicalImportApi";
import { getErrorMessageFromUnknown } from "@/infrastructure/api/httpClient";

type TemplateProfileOption = {
  id: string;
  label?: string;
};

type PdfFieldEdits = Record<string, string>;

function pickStr(edit: PdfFieldEdits, key: string, fallback: string | undefined): string | undefined {
  if (Object.prototype.hasOwnProperty.call(edit, key)) {
    const v = String(edit[key] ?? "").trim();
    if (v.length) {
      return v;
    }
    const fb = String(fallback ?? "").trim();
    return fb.length ? fb : undefined;
  }
  return fallback;
}

function pickNum(edit: PdfFieldEdits, key: string, fallback: number | undefined): number | undefined {
  if (!Object.prototype.hasOwnProperty.call(edit, key)) {
    return fallback;
  }
  const raw = String(edit[key] ?? "").trim();
  if (!raw) {
    return fallback;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function mergePdfReviewRows(
  previewRows: HistoricalImportPdfPreviewRow[],
  edits: Record<string, PdfFieldEdits>,
): HistoricalImportPdfReviewRow[] {
  return previewRows.map((row) => {
    const sourceFile = String(row.sourceFile || "").trim();
    const e = edits[sourceFile] || {};
    return {
      sourceFile,
      issueDate: pickStr(e, "issueDate", row.issueDate),
      number: pickStr(e, "number", row.number),
      client: pickStr(e, "client", row.client),
      clientTaxId: pickStr(e, "clientTaxId", row.clientTaxId),
      clientAddress: pickStr(e, "clientAddress", row.clientAddress),
      clientCity: pickStr(e, "clientCity", row.clientCity),
      clientProvince: pickStr(e, "clientProvince", row.clientProvince),
      clientEmail: pickStr(e, "clientEmail", row.clientEmail),
      clientContactPerson: pickStr(e, "clientContactPerson", row.clientContactPerson),
      concept: pickStr(e, "concept", row.concept),
      description: pickStr(e, "description", row.description),
      status: pickStr(e, "status", row.status),
      subtotal: pickNum(e, "subtotal", row.subtotal),
      taxAmount: pickNum(e, "taxAmount", row.taxAmount),
      withholdingAmount: pickNum(e, "withholdingAmount", row.withholdingAmount),
      total: pickNum(e, "total", row.total),
    };
  });
}

export type DataHistoricalImportPanelProps = {
  templateProfiles: TemplateProfileOption[];
};

export function DataHistoricalImportPanel({ templateProfiles }: DataHistoricalImportPanelProps) {
  const queryClient = useQueryClient();
  const [scanResult, setScanResult] = useState<HistoricalImportScanResponse | null>(null);
  const [excelResult, setExcelResult] = useState<HistoricalImportUploadResponse | null>(null);
  const [pdfResult, setPdfResult] = useState<Awaited<ReturnType<typeof uploadHistoricalPdfs>> | null>(null);

  const [serverPersonCode, setServerPersonCode] = useState("");
  const [serverYear, setServerYear] = useState("");
  const [serverProfileId, setServerProfileId] = useState("");

  const [excelPersonCode, setExcelPersonCode] = useState("");
  const [excelYear, setExcelYear] = useState("");
  const [excelProfileId, setExcelProfileId] = useState("");

  const [pdfProfileId, setPdfProfileId] = useState("");
  const [pdfSendReviewRows, setPdfSendReviewRows] = useState(false);
  const [pdfRowEdits, setPdfRowEdits] = useState<Record<string, PdfFieldEdits>>({});

  const [excelFiles, setExcelFiles] = useState<File[]>([]);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);

  const [message, setMessage] = useState<{ text: string; tone: "success" | "error" } | null>(null);

  const invalidateAfterImport = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["history-invoices"] }),
      queryClient.invalidateQueries({ queryKey: ["expenses"] }),
      queryClient.invalidateQueries({ queryKey: ["runtime-config"] }),
      queryClient.invalidateQueries({ queryKey: ["clients"] }),
    ]);
  }, [queryClient]);

  const scanMutation = useMutation({
    mutationFn: scanHistoricalImportFolder,
    onSuccess: (data) => {
      setScanResult(data);
      const first = data.persons[0];
      setServerPersonCode(first?.code ?? "");
      const y = first?.years?.[0]?.year ?? "";
      setServerYear(y);
      setMessage({ text: "Carpeta escaneada.", tone: "success" });
    },
    onError: (err) => {
      setMessage({ text: getErrorMessageFromUnknown(err), tone: "error" });
    },
  });

  const excelUploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const encoded = await filesToHistoricalEncoded(files);
      return uploadHistoricalWorkbooks(encoded);
    },
    onSuccess: (data) => {
      setExcelResult(data);
      const first = data.persons[0];
      setExcelPersonCode(first?.code ?? "");
      setExcelYear(first?.years?.[0]?.year ?? "");
      setMessage({ text: "Excel preparado en el servidor.", tone: "success" });
    },
    onError: (err) => {
      setMessage({ text: getErrorMessageFromUnknown(err), tone: "error" });
    },
  });

  const pdfUploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const encoded = await filesToHistoricalPdfEncoded(files);
      const emptyPayload = encoded.filter((e) => !String(e.contentBase64 || "").trim());
      if (emptyPayload.length) {
        throw new Error("Algún PDF no se pudo leer (contenido vacío). Prueba con menos ficheros o comprueba que no estén corruptos.");
      }
      return uploadHistoricalPdfs(encoded);
    },
    onSuccess: (data) => {
      if (!data.summary.pdfCount) {
        setMessage({
          text: "El servidor no guardó ningún PDF. Suele deberse a nombres sin extensión .pdf o a ficheros no-PDF; vuelve a seleccionarlos o renómbralos antes de subir.",
          tone: "error",
        });
        setPdfResult(null);
        return;
      }
      setPdfResult(data);
      setPdfRowEdits({});
      setMessage({ text: "PDF analizados.", tone: "success" });
    },
    onError: (err) => {
      setMessage({ text: getErrorMessageFromUnknown(err), tone: "error" });
    },
  });

  const runServerMutation = useMutation({
    mutationFn: () => {
      if (!scanResult?.sourceDir) {
        throw new Error("Primero escanea la carpeta del servidor.");
      }
      return runHistoricalWorkbookImport({
        sourceDir: scanResult.sourceDir,
        personCode: serverPersonCode,
        year: serverYear,
        templateProfileId: serverProfileId,
      });
    },
    onSuccess: async (data) => {
      await invalidateAfterImport();
      setMessage({
        text: `Importación terminada: +${data.createdInvoices} facturas nuevas, ${data.updatedInvoices} actualizadas, ${data.skippedInvoices} omitidas; gastos +${data.createdExpenses}, ${data.skippedExpenses} omitidos.`,
        tone: "success",
      });
    },
    onError: (err) => {
      setMessage({ text: getErrorMessageFromUnknown(err), tone: "error" });
    },
  });

  const runExcelMutation = useMutation({
    mutationFn: () => {
      const uid = String(excelResult?.uploadId || "").trim();
      if (!uid) {
        throw new Error("Sube primero los Excel.");
      }
      return runHistoricalWorkbookImport({
        uploadId: uid,
        personCode: excelPersonCode,
        year: excelYear,
        templateProfileId: excelProfileId,
      });
    },
    onSuccess: async (data) => {
      await invalidateAfterImport();
      setMessage({
        text: `Importación terminada: +${data.createdInvoices} facturas nuevas, ${data.updatedInvoices} actualizadas, ${data.skippedInvoices} omitidas; gastos +${data.createdExpenses}, ${data.skippedExpenses} omitidos.`,
        tone: "success",
      });
    },
    onError: (err) => {
      setMessage({ text: getErrorMessageFromUnknown(err), tone: "error" });
    },
  });

  const pdfRunMutation = useMutation({
    mutationFn: () => {
      const uid = String(pdfResult?.uploadId || "").trim();
      if (!uid) {
        throw new Error("Sube primero los PDF.");
      }
      const body: Parameters<typeof runHistoricalPdfImport>[0] = {
        uploadId: uid,
        templateProfileId: pdfProfileId,
      };
      if (pdfSendReviewRows && pdfResult?.previewRows?.length) {
        body.reviewRows = mergePdfReviewRows(pdfResult.previewRows, pdfRowEdits);
      }
      return runHistoricalPdfImport(body);
    },
    onSuccess: async (data) => {
      await invalidateAfterImport();
      setMessage({
        text: `Importación PDF: ${data.createdInvoices} facturas creadas, ${data.skippedInvoices} omitidas.`,
        tone: "success",
      });
    },
    onError: (err) => {
      setMessage({ text: getErrorMessageFromUnknown(err), tone: "error" });
    },
  });

  useEffect(() => {
    if (!templateProfiles.length) {
      return;
    }
    if (!serverProfileId) {
      setServerProfileId(templateProfiles[0]!.id);
    }
    if (!excelProfileId) {
      setExcelProfileId(templateProfiles[0]!.id);
    }
    if (!pdfProfileId) {
      setPdfProfileId(templateProfiles[0]!.id);
    }
  }, [templateProfiles, serverProfileId, excelProfileId, pdfProfileId]);

  const serverPerson: HistoricalImportScanPerson | undefined = useMemo(
    () => scanResult?.persons.find((p) => p.code === serverPersonCode),
    [scanResult, serverPersonCode],
  );

  const excelPerson = useMemo(
    () => excelResult?.persons.find((p) => p.code === excelPersonCode),
    [excelResult, excelPersonCode],
  );

  const copyText = async (value: string, okMsg: string) => {
    const v = String(value || "").trim();
    if (!v) {
      return;
    }
    try {
      await navigator.clipboard.writeText(v);
      setMessage({ text: okMsg, tone: "success" });
    } catch {
      setMessage({ text: "No se pudo copiar al portapapeles.", tone: "error" });
    }
  };

  const busy =
    scanMutation.isPending ||
    excelUploadMutation.isPending ||
    pdfUploadMutation.isPending ||
    runServerMutation.isPending ||
    runExcelMutation.isPending ||
    pdfRunMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Importación histórica</CardTitle>
        <CardDescription>
          Herramientas de administración: escaneo en servidor, subida de Excel/PDF e importación al almacén actual.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-8">
        {message ? (
          <p className={`text-sm ${message.tone === "error" ? "text-red-600" : "text-emerald-700"}`}>{message.text}</p>
        ) : null}

        <section className="grid gap-3">
          <h3 className="text-sm font-semibold">A) Carpeta histórica en el servidor</h3>
          <p className="text-xs text-muted-foreground">
            Lee <code className="rounded bg-muted px-1">historico/&lt;tenant&gt;</code> del almacén. Tras escanear puedes importar con la ruta devuelta.
          </p>
          <Button type="button" variant="outline" disabled={busy} onClick={() => scanMutation.mutate()}>
            {scanMutation.isPending ? "Escaneando…" : "Escanear carpeta histórica del servidor"}
          </Button>
          {scanResult ? (
            <div className="grid gap-3 rounded-md border p-3 text-sm">
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Resumen:</span>{" "}
                {scanResult.summary.workbookCount} libros, {scanResult.summary.invoiceSheetCount} hojas factura,{" "}
                {scanResult.summary.expenseSheetCount} hojas gasto, {scanResult.summary.invoiceRowCount} filas factura,{" "}
                {scanResult.summary.expenseRowCount} filas gasto.
              </p>
              <p className="break-all text-xs text-muted-foreground" title={scanResult.sourceDir}>
                <span className="font-medium text-foreground">Ruta:</span> {scanResult.sourceDir}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] text-xs">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-2 font-medium">Persona (carpeta)</th>
                      <th className="p-2 font-medium">Años / conteos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanResult.persons.map((p) => (
                      <tr key={p.code} className="border-b border-border/60">
                        <td className="p-2 whitespace-nowrap">{p.label || p.code}</td>
                        <td className="p-2">
                          {p.years.map((y) => (
                            <span key={y.year} className="mr-2 inline-block">
                              {y.year}: {y.workbookCount} lib., {y.invoiceRowCount} fact., {y.expenseRowCount} gast.
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <label className="grid gap-1 text-xs">
                  <span className="text-muted-foreground">Persona</span>
                  <select
                    className="flex h-9 rounded-md border border-input bg-background px-2 py-1"
                    value={serverPersonCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      setServerPersonCode(code);
                      const person = scanResult.persons.find((x) => x.code === code);
                      setServerYear(person?.years[0]?.year ?? "");
                    }}
                  >
                    {scanResult.persons.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.label || p.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs">
                  <span className="text-muted-foreground">Año</span>
                  <select
                    className="flex h-9 rounded-md border border-input bg-background px-2 py-1"
                    value={serverYear}
                    onChange={(e) => setServerYear(e.target.value)}
                  >
                    {(serverPerson?.years ?? []).map((y) => (
                      <option key={y.year} value={y.year}>
                        {y.year}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs sm:col-span-2">
                  <span className="text-muted-foreground">Perfil destino</span>
                  <select
                    className="flex h-9 rounded-md border border-input bg-background px-2 py-1"
                    value={serverProfileId}
                    onChange={(e) => setServerProfileId(e.target.value)}
                  >
                    {templateProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label || p.id}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <Button
                type="button"
                disabled={busy || !serverPersonCode || !serverYear || !serverProfileId}
                onClick={() => runServerMutation.mutate()}
              >
                {runServerMutation.isPending ? "Importando…" : "Importar Excel desde servidor"}
              </Button>
            </div>
          ) : null}
        </section>

        <section className="grid gap-3">
          <h3 className="text-sm font-semibold">B) Subir Excel (.xlsx / .xls)</h3>
          <input
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            multiple
            className="text-sm"
            onChange={(e) => setExcelFiles(Array.from(e.target.files ?? []))}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy || !excelFiles.length}
              onClick={() => excelUploadMutation.mutate(excelFiles)}
            >
              {excelUploadMutation.isPending ? "Subiendo…" : "Preparar subida en servidor"}
            </Button>
          </div>
          {excelResult ? (
            <div className="grid gap-3 rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">uploadId:</span>
                <code className="rounded bg-muted px-1 text-xs">{excelResult.uploadId}</code>
                <Button type="button" size="sm" variant="ghost" onClick={() => void copyText(excelResult.uploadId, "uploadId copiado.")}>
                  Copiar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{excelResult.uploadLabel}</p>
              <p className="text-muted-foreground">
                Resumen: {excelResult.summary.workbookCount} libros, {excelResult.summary.invoiceRowCount} filas factura,{" "}
                {excelResult.summary.expenseRowCount} filas gasto, {excelResult.summary.detectedYearCount} años detectados.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <label className="grid gap-1 text-xs">
                  <span className="text-muted-foreground">Persona (código)</span>
                  <select
                    className="flex h-9 rounded-md border border-input bg-background px-2 py-1"
                    value={excelPersonCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      setExcelPersonCode(code);
                      const person = excelResult.persons.find((x) => x.code === code);
                      setExcelYear(person?.years[0]?.year ?? "");
                    }}
                  >
                    {excelResult.persons.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.label || p.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs">
                  <span className="text-muted-foreground">Año</span>
                  <select
                    className="flex h-9 rounded-md border border-input bg-background px-2 py-1"
                    value={excelYear}
                    onChange={(e) => setExcelYear(e.target.value)}
                  >
                    {(excelPerson?.years ?? []).map((y) => (
                      <option key={y.year} value={y.year}>
                        {y.year}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs sm:col-span-2">
                  <span className="text-muted-foreground">Perfil destino</span>
                  <select
                    className="flex h-9 rounded-md border border-input bg-background px-2 py-1"
                    value={excelProfileId}
                    onChange={(e) => setExcelProfileId(e.target.value)}
                  >
                    {templateProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label || p.id}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <Button
                type="button"
                disabled={busy || !excelPersonCode || !excelYear || !excelProfileId}
                onClick={() => runExcelMutation.mutate()}
              >
                {runExcelMutation.isPending ? "Importando…" : "Importar Excel subido"}
              </Button>
              <p className="text-xs text-muted-foreground">
                La subida queda ligada a tu sesión: si otro usuario usa tu <code className="rounded bg-muted px-0.5">uploadId</code>, el
                servidor responderá con error de propiedad.
              </p>
            </div>
          ) : null}
        </section>

        <section className="grid gap-3">
          <h3 className="text-sm font-semibold">C) PDF históricos</h3>
          <p className="text-xs text-muted-foreground">
            Vista previa y avisos según el servidor. Puedes corregir celdas y enviar{" "}
            <code className="rounded bg-muted px-0.5">reviewRows</code> en la importación, o importar solo lo que el analizador marque como
            válido.
          </p>
          <input
            type="file"
            accept=".pdf,.PDF,application/pdf,application/x-pdf,application/octet-stream"
            multiple
            className="text-sm"
            onChange={(e) => setPdfFiles(Array.from(e.target.files ?? []))}
          />
          <Button type="button" variant="outline" disabled={busy || !pdfFiles.length} onClick={() => pdfUploadMutation.mutate(pdfFiles)}>
            {pdfUploadMutation.isPending ? "Analizando…" : "Subir y analizar PDF"}
          </Button>
          {pdfResult ? (
            <div className="grid gap-3 rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">uploadId:</span>
                <code className="rounded bg-muted px-1 text-xs">{pdfResult.uploadId}</code>
                <Button type="button" size="sm" variant="ghost" onClick={() => void copyText(pdfResult.uploadId, "uploadId copiado.")}>
                  Copiar
                </Button>
              </div>
              <p className="text-muted-foreground">
                Resumen: {pdfResult.summary.pdfCount} PDF, listas {pdfResult.summary.readyInvoiceCount} /{" "}
                {pdfResult.summary.reviewRowCount}, incompletas {pdfResult.summary.incompleteInvoiceCount}, errores de lectura{" "}
                {pdfResult.summary.parseErrorCount}.
              </p>
              <label className="grid gap-1 text-xs sm:max-w-md">
                <span className="text-muted-foreground">Perfil destino</span>
                <select
                  className="flex h-9 rounded-md border border-input bg-background px-2 py-1"
                  value={pdfProfileId}
                  onChange={(e) => setPdfProfileId(e.target.value)}
                >
                  {templateProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label || p.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={pdfSendReviewRows}
                  onChange={(e) => setPdfSendReviewRows(e.target.checked)}
                />
                Enviar filas de la tabla como revisión (corrige avisos antes: el servidor omite filas con avisos si envías revisión).
              </label>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[48rem] text-xs">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-1 font-medium">Fichero</th>
                      <th className="p-1 font-medium">Avisos</th>
                      <th className="p-1 font-medium">Fecha</th>
                      <th className="p-1 font-medium">Nº</th>
                      <th className="p-1 font-medium">Cliente</th>
                      <th className="p-1 font-medium">Base</th>
                      <th className="p-1 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pdfResult.previewRows.map((row) => {
                      const sf = String(row.sourceFile || "").trim();
                      const edit = pdfRowEdits[sf] || {};
                      const display = (key: string, fallback: string | number | undefined) => {
                        if (Object.prototype.hasOwnProperty.call(edit, key)) {
                          return edit[key]!;
                        }
                        if (fallback === undefined || fallback === null) {
                          return "";
                        }
                        return String(fallback);
                      };
                      const setCell = (key: string, value: string) => {
                        setPdfRowEdits((prev) => ({
                          ...prev,
                          [sf]: { ...prev[sf], [key]: value },
                        }));
                      };
                      return (
                        <tr key={sf} className="border-b border-border/60 align-top">
                          <td className="p-1 whitespace-nowrap">{sf}</td>
                          <td className="p-1 text-amber-700">
                            {(row.warnings ?? []).join(", ")}
                            {row.parseError ? ` · ${row.parseError}` : ""}
                          </td>
                          <td className="p-1">
                            <Input
                              className="h-8 text-xs"
                              value={display("issueDate", row.issueDate)}
                              onChange={(e) => setCell("issueDate", e.target.value)}
                              aria-label={`Fecha ${sf}`}
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              className="h-8 text-xs"
                              value={display("number", row.number)}
                              onChange={(e) => setCell("number", e.target.value)}
                              aria-label={`Número ${sf}`}
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              className="h-8 text-xs"
                              value={display("client", row.client)}
                              onChange={(e) => setCell("client", e.target.value)}
                              aria-label={`Cliente ${sf}`}
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              className="h-8 text-xs"
                              type="number"
                              value={display("subtotal", row.subtotal)}
                              onChange={(e) => setCell("subtotal", e.target.value)}
                              aria-label={`Base ${sf}`}
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              className="h-8 text-xs"
                              type="number"
                              value={display("total", row.total)}
                              onChange={(e) => setCell("total", e.target.value)}
                              aria-label={`Total ${sf}`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Button type="button" disabled={busy || !pdfProfileId} onClick={() => pdfRunMutation.mutate()}>
                {pdfRunMutation.isPending ? "Importando PDF…" : "Importar PDF"}
              </Button>
            </div>
          ) : null}
        </section>
      </CardContent>
    </Card>
  );
}
