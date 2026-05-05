import { describe, expect, it } from "vitest";

import { isTemplateProfileInScope, resolveSessionScope } from "@/features/shared/lib/sessionScope";

describe("sessionScope", () => {
  it("sin sesión autenticada no asume «todos los emisores»", () => {
    const scope = resolveSessionScope(undefined, [{ id: "p-a" }]);
    expect(scope.hasEmitterScope).toBe(false);
    expect(scope.allowsAllEmitters).toBe(false);
    expect(scope.visibleTemplateProfileIds).toEqual([]);
  });

  it("editor restringido mantiene hasEmitterScope mientras templateProfiles aún no cargan", () => {
    const scope = resolveSessionScope(
      {
        authenticated: true,
        user: {
          id: "e1",
          name: "Ed",
          email: "e@test",
          role: "editor",
          tenantId: "t1",
          allowedTemplateProfileIds: ["p-a"],
        },
      },
      [],
    );
    expect(scope.hasEmitterScope).toBe(true);
    expect(scope.visibleTemplateProfileIds).toEqual([]);
    expect(isTemplateProfileInScope("p-a", scope)).toBe(false);
  });

  it("tras cruzar con config, editor ve solo emisores permitidos", () => {
    const scope = resolveSessionScope(
      {
        authenticated: true,
        user: {
          id: "e1",
          name: "Ed",
          email: "e@test",
          role: "editor",
          tenantId: "t1",
          allowedTemplateProfileIds: ["p-a"],
        },
      },
      [{ id: "p-a" }, { id: "p-b" }],
    );
    expect(scope.hasEmitterScope).toBe(true);
    expect(scope.visibleTemplateProfileIds).toEqual(["p-a"]);
    expect(isTemplateProfileInScope("p-a", scope)).toBe(true);
    expect(isTemplateProfileInScope("p-b", scope)).toBe(false);
  });

  it("editor restringido: sin templateProfileId no cuenta como en scope", () => {
    const scope = resolveSessionScope(
      {
        authenticated: true,
        user: {
          id: "e1",
          name: "Ed",
          email: "e@test",
          role: "editor",
          tenantId: "t1",
          allowedTemplateProfileIds: ["p-a"],
        },
      },
      [{ id: "p-a" }],
    );
    expect(isTemplateProfileInScope("", scope)).toBe(false);
  });

  it("editor con todos los emisores: id vacío sigue en scope (compat)", () => {
    const scope = resolveSessionScope(
      {
        authenticated: true,
        user: {
          id: "e1",
          name: "Ed",
          email: "e@test",
          role: "editor",
          tenantId: "t1",
          allowedTemplateProfileIds: [],
        },
      },
      [{ id: "p-a" }],
    );
    expect(scope.allowsAllEmitters).toBe(true);
    expect(isTemplateProfileInScope("", scope)).toBe(true);
  });
});
