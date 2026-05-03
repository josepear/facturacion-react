import { describe, expect, it } from "vitest";

import { normalizeGmailRecordId } from "@/infrastructure/api/gmailApi";

describe("normalizeGmailRecordId", () => {
  it("deja sin cambio las rutas que ya terminan en .json", () => {
    expect(normalizeGmailRecordId("docs/2026/f-1.json")).toBe("docs/2026/f-1.json");
  });

  it("añade .json si falta (contrato send-invoice del servidor)", () => {
    expect(normalizeGmailRecordId("docs/2026/f-1")).toBe("docs/2026/f-1.json");
  });

  it("normaliza barras invertidas", () => {
    expect(normalizeGmailRecordId("docs\\2026\\f-1.json")).toBe("docs/2026/f-1.json");
  });
});
