import { describe, expect, it } from "vitest";

import {
  MAX_EMAIL_RECIPIENTS,
  hasSendableRecipients,
  parseRecipientList,
} from "@/features/shared/lib/emailRecipients";

describe("parseRecipientList", () => {
  it("acepta una sola dirección", () => {
    const result = parseRecipientList("cliente@ejemplo.com");
    expect(result.valid).toEqual(["cliente@ejemplo.com"]);
    expect(result.invalid).toEqual([]);
    expect(result.normalized).toBe("cliente@ejemplo.com");
    expect(hasSendableRecipients(result)).toBe(true);
  });

  it("separa por comas y puntos y coma, recortando espacios", () => {
    const result = parseRecipientList(" a@x.com , b@y.com;c@z.com ");
    expect(result.valid).toEqual(["a@x.com", "b@y.com", "c@z.com"]);
    expect(result.normalized).toBe("a@x.com, b@y.com, c@z.com");
  });

  it("deduplica ignorando mayúsculas", () => {
    const result = parseRecipientList("A@x.com, a@X.com");
    expect(result.valid).toEqual(["A@x.com"]);
  });

  it("reporta direcciones inválidas", () => {
    const result = parseRecipientList("bueno@x.com, roto, otro@");
    expect(result.valid).toEqual(["bueno@x.com"]);
    expect(result.invalid).toEqual(["roto", "otro@"]);
    expect(result.error).toContain("roto");
    expect(hasSendableRecipients(result)).toBe(false);
  });

  it("rechaza listas por encima del máximo", () => {
    const many = Array.from({ length: MAX_EMAIL_RECIPIENTS + 1 }, (_, i) => `u${i}@x.com`).join(", ");
    const result = parseRecipientList(many);
    expect(result.tooMany).toBe(true);
    expect(hasSendableRecipients(result)).toBe(false);
  });

  it("lista vacía no es enviable", () => {
    const result = parseRecipientList("   ");
    expect(result.valid).toEqual([]);
    expect(hasSendableRecipients(result)).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
