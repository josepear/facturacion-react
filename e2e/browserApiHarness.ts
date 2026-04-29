import type { Page } from "@playwright/test";

import { readBearerFile } from "./authStorage";

export const AUTH_TOKEN_KEY = "facturacion-auth-token";

export const API_TARGET = String(process.env.E2E_API_TARGET || "https://facturacion.pearandco.es").trim();

export type RuntimeConfig = {
  activeTemplateProfileId?: string;
  templateProfiles?: Array<{
    id?: string;
    label?: string;
    defaults?: { paymentMethod?: string };
    business?: { bankAccount?: string };
  }>;
};

export async function fetchApiJson(pathname: string) {
  const token = readBearerFile();
  const url = new URL(pathname, API_TARGET).toString();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const preview = (await response.text()).replace(/\s+/g, " ").slice(0, 180);
    throw new Error(`Fallo API ${pathname} (${response.status}): ${preview}`);
  }
  return response.json().catch(() => ({}));
}

export async function fetchRuntimeConfigForE2E() {
  const config = (await fetchApiJson("/api/config")) as RuntimeConfig;
  const profiles = (config.templateProfiles || []).filter((profile) => String(profile?.id || "").trim());
  if (profiles.length === 0) {
    throw new Error("Precondición E2E incumplida: /api/config no expone templateProfiles válidos para Facturar.");
  }

  const activeId = String(config.activeTemplateProfileId || "").trim();
  const activeProfile = profiles.find((profile) => profile.id === activeId);
  return { config, profile: activeProfile || profiles[0] };
}

export async function bootstrapAuthInBrowser(page: Page) {
  const token = readBearerFile();
  await page.context().addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [AUTH_TOKEN_KEY, token] as [string, string],
  );

  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const sourceUrl = new URL(request.url());
    if (!sourceUrl.pathname.startsWith("/api/")) {
      await route.fallback();
      return;
    }

    const targetUrl = new URL(`${sourceUrl.pathname}${sourceUrl.search}`, API_TARGET).toString();

    if (sourceUrl.pathname === "/api/config") {
      const config = await fetchApiJson("/api/config");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(config),
      });
      return;
    }

    const headers = {
      ...request.headers(),
      authorization: `Bearer ${token}`,
    };
    delete headers.host;
    delete headers["content-length"];

    try {
      const response = await route.fetch({
        url: targetUrl,
        headers,
      });
      await route.fulfill({ response });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Target page, context or browser has been closed")) {
        return;
      }
      throw error;
    }
  });
}

/** POST /api/expenses/archive con bearer (limpieza E2E). */
export async function archiveExpenseByRecordId(recordId: string) {
  const token = readBearerFile();
  const url = new URL("/api/expenses/archive", API_TARGET).toString();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ recordId }),
  });
  return response;
}
