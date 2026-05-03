import { afterEach, describe, expect, it, vi } from "vitest";

import { openGmailOAuthPopupAndWait, waitForGmailOAuthMessage } from "@/infrastructure/gmail/oauthPopup";

describe("waitForGmailOAuthMessage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves when receiving ok postMessage", async () => {
    const p = waitForGmailOAuthMessage(5000);
    queueMicrotask(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: window.location.origin,
          data: { type: "facturacion-gmail-oauth", ok: true, error: "" },
        }),
      );
    });
    await expect(p).resolves.toBeUndefined();
  });

  it("rejects on error payload", async () => {
    const p = waitForGmailOAuthMessage(5000);
    queueMicrotask(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: window.location.origin,
          data: { type: "facturacion-gmail-oauth", ok: false, error: "access_denied" },
        }),
      );
    });
    await expect(p).rejects.toThrow(/access_denied/);
  });
});

describe("openGmailOAuthPopupAndWait", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens named popup and resolves after postMessage", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue({} as Window);
    const p = openGmailOAuthPopupAndWait("https://accounts.example/oauth");
    queueMicrotask(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: window.location.origin,
          data: { type: "facturacion-gmail-oauth", ok: true, error: "" },
        }),
      );
    });
    await expect(p).resolves.toBeUndefined();
    expect(openSpy).toHaveBeenCalledWith(
      "https://accounts.example/oauth",
      "facturacion_gmail_oauth",
      "width=520,height=640",
    );
  });

  it("throws when popup is blocked", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    await expect(openGmailOAuthPopupAndWait("https://accounts.example/oauth")).rejects.toThrow(/bloqueó/);
  });
});
