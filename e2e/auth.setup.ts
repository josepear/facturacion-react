import { test as setup, expect, type Page } from "@playwright/test";

import { FIRST_USE_WIZARD_STORAGE_KEYS } from "../src/infrastructure/wizardFirstUseStorage";
import { fetchBearerToken } from "./bearer";
import { readBearerFile, USER_STORAGE_PATH, writeBearerFile } from "./authStorage";

const AUTH_TOKEN_KEY = "facturacion-auth-token";

setup.setTimeout(60000);

async function openFacturarWithRetry(page: Page) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto("/facturar", { waitUntil: "commit", timeout: 30000 });
      await page.waitForLoadState("domcontentloaded", { timeout: 30000 });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retriable = message.includes("ERR_ABORTED") || message.includes("frame was detached");
      if (!retriable || attempt === 2) {
        throw error;
      }
    }
  }
}

setup("login and save storage state", async ({ page }) => {
  const token = (() => {
    try {
      return readBearerFile();
    } catch {
      return "";
    }
  })();

  const resolvedToken = token || (await fetchBearerToken());
  writeBearerFile(resolvedToken);

  await page.context().addInitScript(
    ([tokenKey, token, reactWizardKey, legacyWizardKey]) => {
      localStorage.setItem(tokenKey, token);
      localStorage.setItem(reactWizardKey, "1");
      localStorage.setItem(legacyWizardKey, "1");
    },
    [
      AUTH_TOKEN_KEY,
      resolvedToken,
      FIRST_USE_WIZARD_STORAGE_KEYS.react,
      FIRST_USE_WIZARD_STORAGE_KEYS.legacy,
    ] as [string, string, string, string],
  );

  await openFacturarWithRetry(page);

  await page.waitForURL(/\/facturar(?:\?.*)?$/, { timeout: 25000 });

  await expect.poll(async () => page.evaluate((key) => localStorage.getItem(key), AUTH_TOKEN_KEY)).toBe(resolvedToken);

  await expect(page.getByRole("button", { name: "Guardar documento" })).toBeVisible({ timeout: 15000 });

  await page.context().storageState({ path: USER_STORAGE_PATH });
});
