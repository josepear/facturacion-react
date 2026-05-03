import { describe, expect, it } from "vitest";

import {
  normalizeHistoricalPdfClientFileName,
  readFileAsBase64Payload,
} from "@/infrastructure/api/historicalImportApi";

describe("normalizeHistoricalPdfClientFileName", () => {
  it("preserves names that already end in .pdf", () => {
    const file = new File([], "Factura_01.PDF", { type: "application/pdf" });
    expect(normalizeHistoricalPdfClientFileName(file)).toBe("Factura_01.PDF");
  });

  it("appends .pdf for application/pdf without extension (p. ej. escáner / iOS)", () => {
    const file = new File([], "escaneo-sin-extension", { type: "application/pdf" });
    expect(normalizeHistoricalPdfClientFileName(file)).toBe("escaneo-sin-extension.pdf");
  });

  it("uses only the último segmento de ruta como nombre", () => {
    const file = new File([], "C:\\Users\\me\\docs\\a.pdf", { type: "application/pdf" });
    expect(normalizeHistoricalPdfClientFileName(file)).toBe("a.pdf");
  });
});

describe("readFileAsBase64Payload", () => {
  it("returns basename and base64 payload without data URL prefix", async () => {
    const bytes = new Uint8Array([0x48, 0x69]);
    const file = new File([bytes], "probe.bin", { type: "application/octet-stream" });
    const { name, contentBase64 } = await readFileAsBase64Payload(file);
    expect(name).toBe("probe.bin");
    expect(contentBase64).not.toContain("data:");
    expect(atob(contentBase64)).toBe("Hi");
  });

  it("uses nameOverride when provided", async () => {
    const bytes = new Uint8Array([0x48, 0x69]);
    const file = new File([bytes], "ignored.bin", { type: "application/pdf" });
    const { name } = await readFileAsBase64Payload(file, "renombrado.pdf");
    expect(name).toBe("renombrado.pdf");
  });
});
