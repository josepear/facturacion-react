import { describe, expect, it } from "vitest";

import { buildPublicShareInvoiceHtmlUrl, normalizeShareReportToken } from "@/infrastructure/api/exportReportsApi";

describe("normalizeShareReportToken", () => {
  it("elimina caracteres fuera de [A-Za-z0-9_-]", () => {
    expect(normalizeShareReportToken(" ab/cd?ef ")).toBe("abcdef");
  });

  it("recorta a 80 caracteres", () => {
    expect(normalizeShareReportToken("a".repeat(120))).toHaveLength(80);
  });

  it("devuelve cadena vacía con entradas vacías", () => {
    expect(normalizeShareReportToken("")).toBe("");
  });
});

describe("buildPublicShareInvoiceHtmlUrl", () => {
  it("construye la ruta pública del HTML de la factura", () => {
    expect(buildPublicShareInvoiceHtmlUrl("tok-123_abc", "deadbeefdeadbeef")).toBe(
      "/api/public-share-report/tok-123_abc/invoice-html?ref=deadbeefdeadbeef",
    );
  });

  it("sanea token y ref antes de construir la URL", () => {
    expect(buildPublicShareInvoiceHtmlUrl("tok/../x", "ref<script>")).toBe(
      "/api/public-share-report/tokx/invoice-html?ref=refscript",
    );
  });

  it("devuelve cadena vacía si falta el token o el ref", () => {
    expect(buildPublicShareInvoiceHtmlUrl("", "ref")).toBe("");
    expect(buildPublicShareInvoiceHtmlUrl("token", "")).toBe("");
    expect(buildPublicShareInvoiceHtmlUrl("token", "??")).toBe("");
  });
});
