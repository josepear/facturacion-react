import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openGoogleLoginPopupAndWait } from "./googleLoginPopup";

type PopupLike = {
  closed: boolean;
  close: ReturnType<typeof vi.fn>;
  location: { href: string };
  document: { body: { innerText: string; textContent: string } };
};

describe("openGoogleLoginPopupAndWait", () => {
  let popup: PopupLike;

  beforeEach(() => {
    vi.useFakeTimers();
    popup = {
      closed: false,
      close: vi.fn(() => {
        popup.closed = true;
      }),
      location: { href: "" },
      document: { body: { innerText: "", textContent: "" } },
    };
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("prioritizes exchangeToken over code/state when both are present", async () => {
    const resultPromise = openGoogleLoginPopupAndWait("https://accounts.google.com", {
      pollMs: 10,
      timeoutMs: 2_000,
    });
    popup.location.href = "https://facturacion.pearandco.es/api/oauth/google/callback?code=abc&state=def";
    popup.document.body.innerText = JSON.stringify({ exchangeToken: "tok-123" });

    await vi.advanceTimersByTimeAsync(20);
    await expect(resultPromise).resolves.toEqual({ type: "success_exchange_token", exchangeToken: "tok-123" });
  });

  it("falls back to code/state when callback JSON has no exchangeToken", async () => {
    const resultPromise = openGoogleLoginPopupAndWait("https://accounts.google.com", {
      pollMs: 10,
      timeoutMs: 2_000,
    });
    popup.location.href = "https://facturacion.pearandco.es/api/oauth/google/callback?code=abc&state=def";
    popup.document.body.innerText = JSON.stringify({ next: "exchange_pending" });

    await vi.advanceTimersByTimeAsync(20);
    await expect(resultPromise).resolves.toEqual({ type: "success_code_state", code: "abc", state: "def" });
  });
});
