import { ApiError } from "@/infrastructure/api/httpClient";

type LoginJson = {
  token?: string;
  error?: string;
};

type OAuthStartJson = {
  ok?: boolean;
  provider?: string;
  url?: string;
  error?: string;
};

type OAuthExchangeJson = {
  token?: string;
  user?: unknown;
  error?: string;
};

/**
 * Autenticación: `POST /login` con JSON `{ email, password }` (ruta real del backend).
 * Respuesta exitosa: `{ token }` (la identidad se obtiene con `GET /api/session` + Bearer).
 */
export async function loginWithPassword(email: string, password: string): Promise<{ token: string }> {
  const response = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: String(email || "").trim(),
      password: String(password || ""),
    }),
  });

  const payload = (await response.json().catch(() => null)) as LoginJson | null;

  if (!response.ok) {
    const message = String(payload?.error || "").trim() || `Error de acceso (${response.status})`;
    throw new ApiError(message, response.status, payload);
  }

  const token = String(payload?.token || "").trim();
  if (!token) {
    throw new ApiError("El servidor no devolvió token de sesión.", response.status, payload);
  }

  return { token };
}

export async function getGoogleOAuthStartUrl(returnTo: string): Promise<{ url: string }> {
  const params = new URLSearchParams({
    mode: "json",
    return_to: String(returnTo || "/react").trim() || "/react",
  });
  const response = await fetch(`/api/oauth/google/start?${params.toString()}`, {
    method: "GET",
  });
  const payload = (await response.json().catch(() => null)) as OAuthStartJson | null;
  if (!response.ok) {
    const message = String(payload?.error || "").trim() || `Error OAuth (${response.status})`;
    throw new ApiError(message, response.status, payload);
  }
  const url = String(payload?.url || "").trim();
  if (!url) {
    throw new ApiError("El servidor no devolvió URL OAuth.", response.status, payload);
  }
  return { url };
}

export async function exchangeGoogleOAuthSession(payload: {
  code?: string;
  state?: string;
  exchangeToken?: string;
}): Promise<{ token: string }> {
  const response = await fetch("/api/oauth/session/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await response.json().catch(() => null)) as OAuthExchangeJson | null;
  if (!response.ok) {
    const message = String(json?.error || "").trim() || `Error OAuth (${response.status})`;
    throw new ApiError(message, response.status, json);
  }
  const token = String(json?.token || "").trim();
  if (!token) {
    throw new ApiError("El servidor no devolvió token de sesión.", response.status, json);
  }
  return { token };
}
