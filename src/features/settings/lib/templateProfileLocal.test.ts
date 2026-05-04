import type { TemplateProfileConfig } from "@/domain/document/types";
import { describe, expect, it } from "vitest";
import {
  buildClientProfileId,
  getNextProfileColorKey,
  suggestUniqueInvoiceNumberTag,
} from "@/features/settings/lib/templateProfileLocal";

function profile(partial: Partial<TemplateProfileConfig> & { id: string }): TemplateProfileConfig {
  return {
    id: partial.id,
    label: partial.label,
    tenantId: partial.tenantId,
    colorKey: partial.colorKey,
    invoiceNumberTag: partial.invoiceNumberTag,
    defaults: partial.defaults,
    business: partial.business,
    design: partial.design,
  };
}

describe("templateProfileLocal", () => {
  describe("buildClientProfileId", () => {
    it("genera id único con sufijo cuando el base ya existe", () => {
      const used = new Set(["mi-empresa"]);
      expect(buildClientProfileId("Mi Empresa", used)).toBe("mi-empresa-2");
      expect(buildClientProfileId("Mi Empresa", new Set(["mi-empresa", "mi-empresa-2"]))).toBe("mi-empresa-3");
    });
  });

  describe("suggestUniqueInvoiceNumberTag", () => {
    it("devuelve prefijo 3–5 letras y evita colisión con tags existentes", () => {
      const existing: TemplateProfileConfig[] = [
        profile({ id: "a", invoiceNumberTag: "ABNEW" }),
      ];
      const tag = suggestUniqueInvoiceNumberTag("ab", existing);
      expect(tag.length).toBeGreaterThanOrEqual(3);
      expect(tag.length).toBeLessThanOrEqual(5);
      expect(/^[A-Z]+$/.test(tag)).toBe(true);
      expect(tag).not.toBe("ABNEW");
    });

    it("reutiliza prefijo corto libre cuando cabe en 3–5 letras", () => {
      const tag = suggestUniqueInvoiceNumberTag("abcdef", []);
      expect(tag).toBe("ABCDE");
    });
  });

  describe("getNextProfileColorKey", () => {
    it("elige el color con menor uso (empate a cero: primero en orden de menor conteo)", () => {
      expect(getNextProfileColorKey([])).toBe("teal");

      const oneTeal: TemplateProfileConfig[] = [profile({ id: "1", colorKey: "teal" })];
      expect(getNextProfileColorKey(oneTeal)).toBe("pink");

      const mostlyTeal: TemplateProfileConfig[] = [
        profile({ id: "1", colorKey: "teal" }),
        profile({ id: "2", colorKey: "teal" }),
        profile({ id: "3", colorKey: "pink" }),
      ];
      expect(getNextProfileColorKey(mostlyTeal)).toBe("amber");
    });
  });
});
