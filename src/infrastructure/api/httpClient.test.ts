import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, getErrorMessageFromUnknown, request } from "@/infrastructure/api/httpClient";

describe("getErrorMessageFromUnknown", () => {
  it("prefers payload.message on ApiError", () => {
    const err = new ApiError("Bad Request", 400, { message: "Proveedor duplicado" });
    expect(getErrorMessageFromUnknown(err)).toBe("Proveedor duplicado");
  });

  it("uses payload.detail when message missing", () => {
    const err = new ApiError("Bad Request", 422, { detail: "Falta subtotal" });
    expect(getErrorMessageFromUnknown(err)).toBe("Falta subtotal");
  });

  it("falls back to ApiError.message", () => {
    const err = new ApiError("Sin cuerpo útil", 500, {});
    expect(getErrorMessageFromUnknown(err)).toBe("Sin cuerpo útil");
  });

  it("uses payload.error when message and detail are absent", () => {
    const err = new ApiError("", 403, { error: "No tienes acceso a ese perfil de importación." });
    expect(getErrorMessageFromUnknown(err)).toBe("No tienes acceso a ese perfil de importación.");
  });

  it("handles generic Error", () => {
    expect(getErrorMessageFromUnknown(new Error("local"))).toBe("local");
  });
});

describe("request", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws ApiError whose message comes from JSON error on non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 403,
        json: async () => ({ error: "No tienes acceso a ese perfil de importación." }),
      })),
    );

    await expect(request("/api/historical-import/run", { method: "POST", body: {} })).rejects.toEqual(
      expect.objectContaining({
        status: 403,
        message: "No tienes acceso a ese perfil de importación.",
      }),
    );
  });

  it("uses status text when error body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      })),
    );

    await expect(request("/api/x")).rejects.toEqual(
      expect.objectContaining({
        status: 502,
        message: "Request failed with status 502",
      }),
    );
  });
});
