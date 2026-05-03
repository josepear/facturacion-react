/** Misma ventana que `public/app.js` (Gmail OAuth) para que `window.opener.postMessage` funcione. */
export const GMAIL_OAUTH_WINDOW_NAME = "facturacion_gmail_oauth";

export const GMAIL_OAUTH_POPUP_FEATURES = "width=520,height=640";

export type GmailOAuthPostMessagePayload = {
  type: "facturacion-gmail-oauth";
  ok: boolean;
  error: string;
};

export function waitForGmailOAuthMessage(timeoutMs = 120_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("Tiempo de espera agotado al conectar Gmail."));
    }, timeoutMs);

    function onMessage(event: MessageEvent) {
      const data = event.data as GmailOAuthPostMessagePayload | null;
      if (!data || data.type !== "facturacion-gmail-oauth") {
        return;
      }
      // No exigir event.origin === location: el callback OAuth suele ser el host del redirect_uri
      // (p. ej. producción) mientras Vite corre en localhost; el HTML del servidor ya usa postMessage
      // con el Origin capturado en /api/gmail/oauth/start. El payload solo indica ok/error.
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      if (data.ok) {
        resolve();
      } else {
        reject(new Error(data.error || "No se pudo conectar Gmail."));
      }
    }

    window.addEventListener("message", onMessage);
  });
}

export async function openGmailOAuthPopupAndWait(authUrl: string): Promise<void> {
  const popup = window.open(authUrl, GMAIL_OAUTH_WINDOW_NAME, GMAIL_OAUTH_POPUP_FEATURES);
  if (!popup) {
    throw new Error("El navegador bloqueó la ventana emergente. Permite ventanas para este sitio.");
  }
  await waitForGmailOAuthMessage();
}
