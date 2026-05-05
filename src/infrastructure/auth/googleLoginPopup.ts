export const GOOGLE_LOGIN_POPUP_NAME = "facturacion_google_login";
export const GOOGLE_LOGIN_POPUP_FEATURES = "width=520,height=700";

export type GooglePopupResult =
  | { type: "success"; code: string; state: string }
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
  const popup = window.open(authUrl, GOOGLE_LOGIN_POPUP_NAME, GOOGLE_LOGIN_POPUP_FEATURES);
  if (!popup) {
    throw new Error("El navegador bloqueó la ventana emergente. Permite ventanas para este sitio.");
  }
  const timeoutMs = Number(options.timeoutMs || 120_000);
  const pollMs = Number(options.pollMs || 250);
  return new Promise<GooglePopupResult>((resolve, reject) => {
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(interval);
        resolve({ type: "cancelled" });
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        popup.close();
        window.clearInterval(interval);
        reject(new Error("Tiempo de espera agotado al validar OAuth Google."));
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
      popup.close();
      window.clearInterval(interval);
      const code = String(url.searchParams.get("code") || "").trim();
      const state = String(url.searchParams.get("state") || "").trim();
      const providerError = String(url.searchParams.get("error") || "").trim();
      if (providerError) {
        resolve({ type: "provider_error", error: providerError, state });
        return;
      }
      if (!code || !state) {
        reject(new Error("No se recibió respuesta OAuth válida."));
        return;
      }
      resolve({ type: "success", code, state });
    }, pollMs);
  });
}
