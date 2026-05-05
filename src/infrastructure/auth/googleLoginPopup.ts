export const GOOGLE_LOGIN_POPUP_NAME_PREFIX = "facturacion_google_login_";
export const GOOGLE_LOGIN_POPUP_FEATURES = "width=520,height=700";

export type GooglePopupResult =
  | { type: "success_code_state"; code: string; state: string }
  | { type: "success_exchange_token"; exchangeToken: string }
  | { type: "provider_error"; error: string; state: string }
  | { type: "cancelled" };

type PopupWaitOptions = {
  timeoutMs?: number;
  pollMs?: number;
};

export async function openGoogleLoginPopupAndWait(
  authUrl: string,
  options: PopupWaitOptions = {},
): Promise<GooglePopupResult> {
  const popupName = `${GOOGLE_LOGIN_POPUP_NAME_PREFIX}${Date.now()}`;
  const popup = window.open(authUrl, popupName, GOOGLE_LOGIN_POPUP_FEATURES);
  if (!popup) {
    throw new Error("El navegador bloqueó la ventana emergente. Permite ventanas para este sitio.");
  }
  const timeoutMs = Number(options.timeoutMs || 120_000);
  const pollMs = Number(options.pollMs || 250);
  return new Promise<GooglePopupResult>((resolve, reject) => {
    let done = false;
    const startedAt = Date.now();
    let initialHref = "";
    try {
      initialHref = String(popup.location.href || "");
    } catch {
      initialHref = "";
    }
    const finish = (cb: () => void) => {
      if (done) {
        return;
      }
      done = true;
      window.clearInterval(interval);
      cb();
    };
    const interval = window.setInterval(() => {
      if (popup.closed) {
        finish(() => resolve({ type: "cancelled" }));
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        finish(() => {
          popup.close();
          reject(new Error("Tiempo de espera agotado al validar OAuth Google."));
        });
        return;
      }
      let href = "";
      try {
        href = String(popup.location.href || "");
      } catch {
        return;
      }
      if (!href) {
        return;
      }
      let url: URL;
      try {
        url = new URL(href);
      } catch {
        return;
      }
      if (url.pathname !== "/api/oauth/google/callback") {
        return;
      }
      // Ignore stale callback pages already open in a reused popup window.
      if (initialHref && href === initialHref) {
        return;
      }
      const code = String(url.searchParams.get("code") || "").trim();
      const state = String(url.searchParams.get("state") || "").trim();
      const providerError = String(url.searchParams.get("error") || "").trim();
      if (providerError) {
        finish(() => {
          popup.close();
          resolve({ type: "provider_error", error: providerError, state });
        });
        return;
      }

      // Preferred path: use exchangeToken from callback JSON payload when available.
      let exchangeToken = "";
      try {
        const bodyText = String(popup.document?.body?.innerText || popup.document?.body?.textContent || "").trim();
        if (bodyText.startsWith("{")) {
          const parsed = JSON.parse(bodyText) as { exchangeToken?: string };
          exchangeToken = String(parsed?.exchangeToken || "").trim();
        }
      } catch {
        // ignore parse/read failures and fallback to code+state
      }

      if (exchangeToken) {
        finish(() => {
          popup.close();
          resolve({ type: "success_exchange_token", exchangeToken });
        });
        return;
      }

      // Fallback path for older callback payloads.
      if (code && state) {
        finish(() => {
          popup.close();
          resolve({ type: "success_code_state", code, state });
        });
        return;
      }

      // Callback loaded but payload may still be rendering; keep polling.
      return;
    }, pollMs);
  });
}
