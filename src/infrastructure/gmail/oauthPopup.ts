/** Misma ventana que `public/app.js` (Gmail OAuth) para que `window.opener.postMessage` funcione. */
export const GMAIL_OAUTH_WINDOW_NAME = "facturacion_gmail_oauth";

export const GMAIL_OAUTH_POPUP_FEATURES = "width=520,height=640";

export type GmailOAuthPostMessagePayload = {
  type: "facturacion-gmail-oauth";
  ok: boolean;
  error: string;
};

export function waitForGmailOAuthMessage(timeoutMs = 120_000, expectedOrigin = ""): Promise<void> {
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
      const allowed = [window.location.origin, expectedOrigin].filter(Boolean);
      if (allowed.length > 0 && !allowed.includes(event.origin)) {
        return;
      }
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
  let serverOrigin = "";
  try {
    serverOrigin = new URL(authUrl, window.location.origin).origin;
  } catch { /* keep empty — falls back to window.location.origin only */ }
  await waitForGmailOAuthMessage(120_000, serverOrigin);
}
