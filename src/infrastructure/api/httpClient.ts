type HttpMethod = "GET" | "POST";

const AUTH_TOKEN_KEY = "facturacion-auth-token";

function getBrowserAuthToken(): string | null {
  if (typeof globalThis === "undefined" || !("localStorage" in globalThis)) {
    return null;
  }
  try {
    return globalThis.localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown,
  ) {
    super(message);
  }
}

/** Mensaje legible para UI: prioriza cuerpo JSON típico (`message`, `detail`) y cae al mensaje de `ApiError`. */
export function getErrorMessageFromUnknown(error: unknown): string {
  if (error instanceof ApiError) {
    const payload = error.payload;
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const rec = payload as Record<string, unknown>;
      const fromMessage = typeof rec.message === "string" ? rec.message.trim() : "";
      if (fromMessage) {
        return fromMessage;
      }
      const fromDetail = typeof rec.detail === "string" ? rec.detail.trim() : "";
      if (fromDetail) {
        return fromDetail;
      }
    }
    const base = String(error.message || "").trim();
    if (base) {
      return base;
    }
    return `HTTP ${error.status}`;
  }
  if (error instanceof Error) {
    return String(error.message || "").trim() || "Error desconocido.";
  }
  return "Error desconocido.";
}

export async function request<TResponse>(
  path: string,
  options: {
    method?: HttpMethod;
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<TResponse> {
  const token = getBrowserAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (payload as { error?: string } | null)?.error ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  return payload as TResponse;
}

/** Misma cabecera `Authorization` que `request`, sin forzar JSON (p. ej. HTML/PDF oficiales). */
export async function fetchWithAuth(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const token = getBrowserAuthToken();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}
