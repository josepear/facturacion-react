import { describe, expect, it } from "vitest";

import { resolveEmitterFieldsFromTemplateProfile } from "@/domain/document/resolveTemplateProfileEmitterDefaults";

describe("resolveEmitterFieldsFromTemplateProfile", () => {
  it("prefers profile paymentMethod over global defaults", () => {
    const profile = {
      id: "p1",
      defaults: { paymentMethod: "Bizum" },
    };
    const r = resolveEmitterFieldsFromTemplateProfile(profile, { paymentMethod: "Transferencia" });
    expect(r.paymentMethod).toBe("Bizum");
  });

  it("falls back to global paymentMethod when profile omits it", () => {
    const profile = { id: "p1", defaults: {} };
    const r = resolveEmitterFieldsFromTemplateProfile(profile, { paymentMethod: "Transferencia bancaria" });
    expect(r.paymentMethod).toBe("Transferencia bancaria");
  });

  it("uses profile taxRate when finite, else global", () => {
    expect(
      resolveEmitterFieldsFromTemplateProfile({ id: "a", defaults: { taxRate: 3 } }, { taxRate: 7 }).taxRate,
    ).toBe(3);
    expect(resolveEmitterFieldsFromTemplateProfile({ id: "a", defaults: {} }, { taxRate: 7 }).taxRate).toBe(7);
    expect(resolveEmitterFieldsFromTemplateProfile({ id: "a" }, undefined).taxRate).toBeNull();
  });

  it("uses valid withholding from profile first, else global", () => {
    expect(
      resolveEmitterFieldsFromTemplateProfile({ id: "a", defaults: { withholdingRate: 19 } }, { withholdingRate: 15 })
        .withholdingRate,
    ).toBe(19);
    expect(
      resolveEmitterFieldsFromTemplateProfile({ id: "a", defaults: { withholdingRate: 99 } }, { withholdingRate: 15 })
        .withholdingRate,
    ).toBe(15);
    expect(
      resolveEmitterFieldsFromTemplateProfile({ id: "a", defaults: { withholdingRate: 99 } }, { withholdingRate: 8 })
        .withholdingRate,
    ).toBe("");
  });

  it("reads bank and layout only from profile", () => {
    const r = resolveEmitterFieldsFromTemplateProfile(
      { id: "a", business: { bankAccount: "ES11" }, design: { layout: "editorial" } },
      { paymentMethod: "X" },
    );
    expect(r.bankAccount).toBe("ES11");
    expect(r.templateLayout).toBe("editorial");
  });

  it("exposes documentTenantId only from profile.tenantId", () => {
    expect(resolveEmitterFieldsFromTemplateProfile({ id: "a", tenantId: " org-a " }, undefined).documentTenantId).toBe(
      "org-a",
    );
    expect(resolveEmitterFieldsFromTemplateProfile({ id: "a" }, undefined).documentTenantId).toBeNull();
  });

  it("merges series and currency from profile then global defaults", () => {
    expect(
      resolveEmitterFieldsFromTemplateProfile(
        { id: "a", defaults: { series: "FAC", currency: "EUR" } },
        { series: "G", currency: "USD" },
      ).series,
    ).toBe("FAC");
    expect(
      resolveEmitterFieldsFromTemplateProfile({ id: "a", defaults: { currency: "EUR" } }, { series: "GLO", currency: "USD" })
        .series,
    ).toBe("GLO");
    expect(
      resolveEmitterFieldsFromTemplateProfile({ id: "a", defaults: { series: "X" } }, { currency: "GBP" }).currency,
    ).toBe("GBP");
  });
});
