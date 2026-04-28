import fs from "node:fs";

import { fetchBearerToken } from "./bearer";
import { BEARER_PATH, writeBearerFile } from "./authStorage";
import { e2eEnv } from "./env";

async function ensureOk(pathname: string, expectedMessage: string, token?: string) {
  const url = new URL(pathname, e2eEnv.apiTarget).toString();
  const response = await fetch(url, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });
  if (!response.ok) {
    const bodyPreview = (await response.text()).replace(/\s+/g, " ").slice(0, 180);
    const authHint =
      response.status === 401 || response.status === 403
        ? " Verifica credenciales E2E y que el usuario tenga acceso al API."
        : "";
    throw new Error(`${expectedMessage} (${response.status}) -> ${url}. ${bodyPreview}${authHint}`);
  }
  return response;
}

export default async function globalSetup() {
  await ensureOk("/api/health", "El backend E2E no responde en /api/health");

  const validateToken = async (token: string, source: string) => {
    const configResponse = await ensureOk("/api/config", `No se pudo cargar /api/config para E2E (${source})`, token);
    const runtimeConfig = (await configResponse.json()) as {
      templateProfiles?: Array<{ id?: string }>;
    };
    const profileCount = (runtimeConfig.templateProfiles ?? []).filter((profile) => String(profile?.id || "").trim()).length;
    if (profileCount === 0) {
      throw new Error(
        `Precondicion E2E incumplida: /api/config no expone templateProfiles validos en ${e2eEnv.apiTarget}`,
      );
    }
    return { token, runtimeConfig };
  };

  const explicitToken = String(process.env.E2E_USER_TOKEN || "").trim();
  const cachedToken = fs.existsSync(BEARER_PATH) ? String(fs.readFileSync(BEARER_PATH, "utf8") || "").trim() : "";

  let auth: { token: string; runtimeConfig: { templateProfiles?: Array<{ id?: string }> } } | null = null;
  const authErrors: string[] = [];

  if (explicitToken) {
    try {
      auth = await validateToken(explicitToken, "token explícito");
    } catch (error) {
      authErrors.push(`E2E_USER_TOKEN inválido: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!auth && cachedToken) {
    try {
      auth = await validateToken(cachedToken, "token cacheado");
    } catch (error) {
      authErrors.push(`Token cacheado inválido: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!auth) {
    try {
      const token = await fetchBearerToken();
      auth = await validateToken(token, "login");
    } catch (error) {
      authErrors.push(`Login falló: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!auth) {
    throw new Error(
      [
        `No se pudo autenticar E2E contra ${e2eEnv.apiTarget}.`,
        "Opciones soportadas: E2E_USER_TOKEN o (E2E_USER_EMAIL + E2E_USER_PASSWORD).",
        ...authErrors.map((item) => `- ${item}`),
      ].join("\n"),
    );
  }

  writeBearerFile(auth.token);

  if (e2eEnv.requireExpenseWrite) {
    const optionsResponse = await ensureOk(
      "/api/expense-options",
      "No se pudo validar /api/expense-options para pruebas de gastos",
      auth.token,
    );
    const options = (await optionsResponse.json().catch(() => null)) as
      | { vendors?: string[]; categories?: string[]; data?: { vendors?: string[]; categories?: string[] } }
      | null;

    const vendors = options?.vendors ?? options?.data?.vendors;
    const categories = options?.categories ?? options?.data?.categories;

    if (!Array.isArray(vendors) || !Array.isArray(categories)) {
      const shapePreview = JSON.stringify(options).slice(0, 220);
      console.warn(
        `[E2E setup] /api/expense-options devolvió formato no estándar. ` +
          `Se continúa porque los tests críticos actuales no dependen de este contrato. Preview: ${shapePreview}`,
      );
    }
  }
}
