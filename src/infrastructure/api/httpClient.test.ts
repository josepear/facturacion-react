import { describe, expect, it } from "vitest";

import { ApiError, getErrorMessageFromUnknown } from "@/infrastructure/api/httpClient";

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

  it("handles generic Error", () => {
    expect(getErrorMessageFromUnknown(new Error("local"))).toBe("local");
  });
});
