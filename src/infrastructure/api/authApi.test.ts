import { afterEach, describe, expect, it, vi } from "vitest";

import { loginWithPassword } from "@/infrastructure/api/authApi";
import { ApiError } from "@/infrastructure/api/httpClient";

describe("loginWithPassword", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns token on 200 with token field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ token: "abc123hex" }),
      })) as unknown as typeof fetch,
    );

    const result = await loginWithPassword("user@test.com", "secret");
    expect(result.token).toBe("abc123hex");
    expect(fetch).toHaveBeenCalledWith(
      "/login",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toEqual({ email: "user@test.com", password: "secret" });
  });

  it("throws ApiError on 401 with server message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: "Email o contraseña incorrectos." }),
      })) as unknown as typeof fetch,
    );

    try {
      await loginWithPassword("x", "y");
      expect.fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toBe("Email o contraseña incorrectos.");
      expect((error as ApiError).status).toBe(401);
    }
  });

  it("throws when 200 without token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({}),
      })) as unknown as typeof fetch,
    );

    await expect(loginWithPassword("x", "y")).rejects.toThrow(/token/);
  });
});
