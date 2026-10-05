import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  type HistoricalExpensePreviewRow,
  type FiscalRule,
  fetchFiscalRules,
  saveFiscalRules,
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
  const [excelReviewConfirmed, setExcelReviewConfirmed] = useState(false);
  const [excelSelectedExpenseRowKeys, setExcelSelectedExpenseRowKeys] = useState<string[]>([]);

  const [pdfProfileId, setPdfProfileId] = useState("");
  const [pdfSendReviewRows, setPdfSendReviewRows] = useState(false);
  const [pdfRowEdits, setPdfRowEdits] = useState<Record<string, PdfFieldEdits>>({});

  const [excelFiles, setExcelFiles] = useState<File[]>([]);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);

  const [message, setMessage] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [fiscalRuleDraft, setFiscalRuleDraft] = useState<{ field: FiscalRule["field"]; matchText: string; decision: FiscalRule["decision"] }>({
    field: "vendor",
    matchText: "",
    decision: "possible",
  });

  const fiscalRulesQuery = useQuery({
    queryKey: ["fiscal-rules"],
    queryFn: fetchFiscalRules,
    staleTime: 60_000,
  });

  const saveFiscalRulesMutation = useMutation({
    mutationFn: (rules: FiscalRule[]) => saveFiscalRules(rules),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["fiscal-rules"] });
      setMessage({ text: "Diccionario fiscal guardado.", tone: "success" });
    },
    onError: (err) => {
      setMessage({ text: getErrorMessageFromUnknown(err), tone: "error" });
    },
  });

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
      setExcelReviewConfirmed(false);
      setExcelSelectedExpenseRowKeys([]);
      const first = data.persons[0];
      setExcelPersonCode(first?.code ?? "");
      setExcelYear(first?.years?.[0]?.year ?? "");
      setMessage({ text: "Excel preparado en el servidor. Revísalo antes de importarlo.", tone: "success" });
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
      setExcelSelectedExpenseRowKeys([]);
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
        selectedExpenseRowKeys: excelSelectedExpenseRowKeys,
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

  const excelYearBucket = useMemo(
    () => excelPerson?.years.find((bucket) => bucket.year === excelYear) ?? null,
    [excelPerson, excelYear],
  );

  const excelExpensePreviewRows = useMemo(
    () => (excelYearBucket?.expensePreviewRows ?? []) as HistoricalExpensePreviewRow[],
    [excelYearBucket],
  );

  useEffect(() => {
    const keys = excelExpensePreviewRows.map((row) => String(row.rowKey || "").trim()).filter(Boolean);
    setExcelSelectedExpenseRowKeys(keys);
    setExcelReviewConfirmed(false);
  }, [excelExpensePreviewRows, excelPersonCode, excelYear]);

  const excelSelectedExpenseKeySet = useMemo(
    () => new Set(excelSelectedExpenseRowKeys.map((key) => String(key || "").trim()).filter(Boolean)),
    [excelSelectedExpenseRowKeys],
  );

  const excelSelectedExpenseCount = excelExpensePreviewRows.filter((row) => excelSelectedExpenseKeySet.has(String(row.rowKey || "").trim())).length;
  const excelLikelyDeductibleExpenseCount = excelExpensePreviewRows.filter((row) => row.deductibleKind === "yes").length;
  const excelPossibleDeductibleExpenseCount = excelExpensePreviewRows.filter((row) => row.deductibleKind === "possible").length;

  const toggleExcelExpenseRow = useCallback((rowKey: string, checked: boolean) => {
    const safeKey = String(rowKey || "").trim();
    if (!safeKey) {
      return;
    }
    setExcelReviewConfirmed(false);
    setExcelSelectedExpenseRowKeys((prev) => {
      const next = new Set(prev.map((key) => String(key || "").trim()).filter(Boolean));
      if (checked) {
        next.add(safeKey);
      } else {
        next.delete(safeKey);
      }
      return Array.from(next);
    });
  }, []);

  const keepOnlyDeductibleExcelExpenses = useCallback(() => {
    setExcelReviewConfirmed(false);
    setExcelSelectedExpenseRowKeys(
      excelExpensePreviewRows
        .filter((row) => row.deductibleKind === "yes" || row.deductibleKind === "possible")
        .map((row) => String(row.rowKey || "").trim())
        .filter(Boolean),
    );
  }, [excelExpensePreviewRows]);

  const selectAllExcelExpenses = useCallback(() => {
    setExcelReviewConfirmed(false);
    setExcelSelectedExpenseRowKeys(
      excelExpensePreviewRows.map((row) => String(row.rowKey || "").trim()).filter(Boolean),
    );
  }, [excelExpensePreviewRows]);

  const addFiscalRule = useCallback(() => {
    const matchText = String(fiscalRuleDraft.matchText || "").trim();
    if (!matchText) {
      setMessage({ text: "Escribe un texto para el diccionario fiscal.", tone: "error" });
      return;
    }
    const existing = fiscalRulesQuery.data ?? [];
    const next: FiscalRule[] = [
      ...existing.filter((rule) => !(rule.field === fiscalRuleDraft.field && rule.decision === fiscalRuleDraft.decision && String(rule.matchText || "").trim().toLowerCase() === matchText.toLowerCase())),
      {
        id: `rule-${Date.now()}`,
        field: fiscalRuleDraft.field,
        matchText,
        decision: fiscalRuleDraft.decision,
      },
    ];
    saveFiscalRulesMutation.mutate(next);
    setFiscalRuleDraft((prev) => ({ ...prev, matchText: "" }));
  }, [fiscalRuleDraft, fiscalRulesQuery.data, saveFiscalRulesMutation]);

  const deleteFiscalRule = useCallback((ruleId: string) => {
    const existing = fiscalRulesQuery.data ?? [];
    saveFiscalRulesMutation.mutate(existing.filter((rule) => rule.id !== ruleId));
  }, [fiscalRulesQuery.data, saveFiscalRulesMutation]);

  const loadFiscalRuleDraftFromRow = useCallback((row: HistoricalExpensePreviewRow, field: FiscalRule["field"]) => {
    const matchText = field === "vendor" ? String(row.vendor || "").trim() : field === "category" ? String(row.category || "").trim() : String(row.vendor || row.category || "").trim();
    setFiscalRuleDraft((prev) => ({ ...prev, field, matchText }));
  }, []);

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
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
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
          <p className="text-informative">
            Lee <code className="rounded bg-muted px-1">historico/&lt;tenant&gt;</code> del almacén. Tras escanear puedes importar con la ruta devuelta.
          </p>
          <Button type="button" variant="outline" disabled={busy} onClick={() => scanMutation.mutate()}>
            {scanMutation.isPending ? "Escaneando…" : "Escanear carpeta histórica del servidor"}
          </Button>
          {scanResult ? (
            <div className="grid gap-3 rounded-md border p-3 text-sm">
              <p className="text-informative">
                <span className="font-medium text-foreground">Resumen:</span>{" "}
                {scanResult.summary.workbookCount} libros, {scanResult.summary.invoiceSheetCount} hojas factura,{" "}
                {scanResult.summary.expenseSheetCount} hojas gasto, {scanResult.summary.invoiceRowCount} filas factura,{" "}
                {scanResult.summary.expenseRowCount} filas gasto.
              </p>
              <p className="break-all text-informative" title={scanResult.sourceDir}>
                <span className="font-medium text-foreground">Ruta:</span> {scanResult.sourceDir}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] text-xs">
                  <thead>
                    <tr className="border-b text-left text-informative">
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
                  <span className="text-informative">Persona</span>
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
                  <span className="text-informative">Año</span>
                  <Input
                    className="h-9"
                    list="historical-server-years"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="AAAA"
                    value={serverYear}
                    onChange={(e) => setServerYear(e.target.value)}
                  />
                  <datalist id="historical-server-years">
                    {(serverPerson?.years ?? []).map((y) => (
                      <option key={y.year} value={y.year} />
                    ))}
                  </datalist>
                </label>
                <label className="grid gap-1 text-xs sm:col-span-2">
                  <span className="text-informative">Emisor destino</span>
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
                <span className="text-informative">uploadId:</span>
                <code className="rounded bg-muted px-1 text-xs">{excelResult.uploadId}</code>
                <Button type="button" size="sm" variant="ghost" onClick={() => void copyText(excelResult.uploadId, "uploadId copiado.")}>
                  Copiar
                </Button>
              </div>
              <p className="text-informative">{excelResult.uploadLabel}</p>
              <p className="text-informative">
                Resumen: {excelResult.summary.workbookCount} libros, {excelResult.summary.invoiceRowCount} filas factura,{" "}
                {excelResult.summary.expenseRowCount} filas gasto, {excelResult.summary.detectedYearCount} años detectados.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <label className="grid gap-1 text-xs">
                  <span className="text-informative">Persona (código)</span>
                  <select
                    className="flex h-9 rounded-md border border-input bg-background px-2 py-1"
                    value={excelPersonCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      setExcelPersonCode(code);
                      const person = excelResult.persons.find((x) => x.code === code);
                      setExcelYear(person?.years[0]?.year ?? "");
                      setExcelReviewConfirmed(false);
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
                  <span className="text-informative">Año</span>
                  <Input
                    className="h-9"
                    list="historical-excel-years"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="AAAA"
                    value={excelYear}
                    onChange={(e) => {
                      setExcelYear(e.target.value);
                      setExcelReviewConfirmed(false);
                    }}
                  />
                  <datalist id="historical-excel-years">
                    {(excelPerson?.years ?? []).map((y) => (
                      <option key={y.year} value={y.year} />
                    ))}
                  </datalist>
                </label>
                <label className="grid gap-1 text-xs sm:col-span-2">
                  <span className="text-informative">Emisor destino</span>
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
              <div className="grid gap-3 rounded-md border border-amber-300 bg-white/70 p-3">
                <p className="text-sm font-medium text-foreground">Revisión previa antes de integrar</p>
                <p className="text-xs text-informative">
                  Todavía no se ha guardado nada en la aplicación. Revisa esta muestra del Excel y luego confirma la importación.
                </p>
                {excelYearBucket?.workbookNames?.length ? (
                  <p className="text-xs text-informative">
                    Ficheros detectados: {excelYearBucket.workbookNames.join(", ")}
                  </p>
                ) : null}
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-2">
                    <p className="text-xs font-medium text-foreground">Muestra de facturas del año seleccionado</p>
                    {excelYearBucket?.invoicePreviewRows?.length ? (
                      <div className="overflow-x-auto rounded-md border border-border bg-background">
                        <table className="w-full min-w-[34rem] text-xs">
                          <thead>
                            <tr className="border-b text-left text-informative">
                              <th className="p-2 font-medium">Fecha</th>
                              <th className="p-2 font-medium">Número</th>
                              <th className="p-2 font-medium">Cliente</th>
                              <th className="p-2 font-medium">Concepto</th>
                              <th className="p-2 text-right font-medium">Total</th>
                                <th className="p-2 font-medium">Aprender</th>
                            </tr>
                          </thead>
                          <tbody>
                            {excelYearBucket.invoicePreviewRows.map((row, index) => (
                              <tr key={`invoice-${index}`} className="border-b border-border/60 last:border-b-0">
                                <td className="p-2">{row.issueDate || "—"}</td>
                                <td className="p-2">{row.number || "—"}</td>
                                <td className="p-2">{row.client || "—"}</td>
                                <td className="p-2">{row.concept || "—"}</td>
                                <td className="p-2 text-right tabular-nums">
                                  {typeof row.total === "number" ? row.total.toFixed(2) : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-informative">No hay muestra de facturas para esta selección.</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">Gastos detectados del año seleccionado</p>
                      {excelExpensePreviewRows.length ? (
                        <p className="text-xs text-informative">
                          Seleccionados: {excelSelectedExpenseCount} de {excelExpensePreviewRows.length} · Claros: {excelLikelyDeductibleExpenseCount} · Posibles: {excelPossibleDeductibleExpenseCount}
                        </p>
                      ) : null}
                    </div>
                    {excelExpensePreviewRows.length ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => keepOnlyDeductibleExcelExpenses()}>
                            Dejar claros y posibles
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => selectAllExcelExpenses()}>
                            Volver a marcar todo
                          </Button>
                        </div>
                        <div className="max-h-[28rem] overflow-auto rounded-md border border-border bg-background">
                          <table className="w-full min-w-[48rem] text-xs">
                            <thead>
                              <tr className="sticky top-0 border-b bg-background text-left text-informative">
                                <th className="p-2 font-medium">Importar</th>
                                <th className="p-2 font-medium">Fecha</th>
                                <th className="p-2 font-medium">Proveedor</th>
                                <th className="p-2 font-medium">Categoría</th>
                                <th className="p-2 font-medium">Trim.</th>
                                <th className="p-2 font-medium">Filtro fiscal</th>
                                <th className="p-2 text-right font-medium">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {excelExpensePreviewRows.map((row, index) => {
                                const rowKey = String(row.rowKey || `expense-${index}`).trim();
                                const checked = excelSelectedExpenseKeySet.has(rowKey);
                                return (
                                  <tr key={rowKey || `expense-${index}`} className="border-b border-border/60 last:border-b-0">
                                    <td className="p-2 align-middle">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(event) => toggleExcelExpenseRow(rowKey, event.target.checked)}
                                        aria-label={`Importar gasto ${row.vendor || row.category || index + 1}`}
                                      />
                                    </td>
                                    <td className="p-2">{row.issueDate || "—"}</td>
                                    <td className="p-2">{row.vendor || "—"}</td>
                                    <td className="p-2">{row.category || "—"}</td>
                                    <td className="p-2">{row.quarter || "—"}</td>
                                    <td className="p-2">{row.deductibleLabel || (row.deductible ? "Si" : "No")}</td>
                                    <td className="p-2 text-right tabular-nums">
                                      {typeof row.total === "number" ? row.total.toFixed(2) : "—"}
                                    </td>
                                    <td className="p-2">
                                      <div className="flex flex-wrap gap-1">
                                        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => loadFiscalRuleDraftFromRow(row, "vendor")}>Proveedor</Button>
                                        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => loadFiscalRuleDraftFromRow(row, "category")}>Categoria</Button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-informative">No hay gastos detectados para esta selección.</p>
                    )}
                  </div>
                </div>
                <label className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={excelReviewConfirmed}
                    onChange={(e) => setExcelReviewConfirmed(e.target.checked)}
                  />
                  <span>He revisado las filas seleccionadas y quiero integrar solo esos gastos en la aplicación.</span>
                </label>
              </div>
              <Button
                type="button"
                disabled={busy || !excelPersonCode || !excelYear || !excelProfileId || !excelReviewConfirmed || excelSelectedExpenseCount === 0}
                onClick={() => runExcelMutation.mutate()}
              >
                {runExcelMutation.isPending ? "Importando…" : "Confirmar importación del Excel"}
              </Button>
              <p className="text-informative">
                La subida queda ligada a tu sesión: si otro usuario usa tu <code className="rounded bg-muted px-0.5">uploadId</code>, el
                servidor responderá con error de propiedad.
              </p>
            </div>
          ) : null}
        </section>

        <section className="grid gap-3">
          <h3 className="text-sm font-semibold">C) PDF históricos</h3>
          <p className="text-informative">
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
                <span className="text-informative">uploadId:</span>
                <code className="rounded bg-muted px-1 text-xs">{pdfResult.uploadId}</code>
                <Button type="button" size="sm" variant="ghost" onClick={() => void copyText(pdfResult.uploadId, "uploadId copiado.")}>
                  Copiar
                </Button>
              </div>
              <p className="text-informative">
                Resumen: {pdfResult.summary.pdfCount} PDF, listas {pdfResult.summary.readyInvoiceCount} /{" "}
                {pdfResult.summary.reviewRowCount}, incompletas {pdfResult.summary.incompleteInvoiceCount}, errores de lectura{" "}
                {pdfResult.summary.parseErrorCount}.
              </p>
              <label className="grid gap-1 text-xs sm:max-w-md">
                <span className="text-informative">Emisor destino</span>
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
                    <tr className="border-b text-left text-informative">
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
