import { test as setup, expect } from "@playwright/test";

import { fetchBearerToken } from "./bearer";
import { readBearerFile, USER_STORAGE_PATH, writeBearerFile } from "./authStorage";

const AUTH_TOKEN_KEY = "facturacion-auth-token";

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
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [AUTH_TOKEN_KEY, resolvedToken] as [string, string],
  );

  await page.goto("/facturar", { waitUntil: "domcontentloaded" });

  await page.waitForURL(/\/facturar(?:\?.*)?$/, { timeout: 25000 });

  await expect.poll(async () => page.evaluate((key) => localStorage.getItem(key), AUTH_TOKEN_KEY)).toBe(resolvedToken);

  await expect(page.getByRole("button", { name: "Guardar documento" })).toBeVisible({ timeout: 15000 });

  await page.context().storageState({ path: USER_STORAGE_PATH });
});
