import { ApiError } from "@/infrastructure/api/httpClient";

type LoginJson = {
  token?: string;
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
