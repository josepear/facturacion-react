import { expect, test } from "@playwright/test";

import {
  archiveExpenseByRecordId,
  bootstrapAuthInBrowser,
  fetchApiJson,
  fetchRuntimeConfigForE2E,
} from "./browserApiHarness";

test.setTimeout(60000);

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

function e2eExpenseMarker() {
  return `E2E-GASTO-${Date.now()}`;
}

function normalizeExpenseOptionsBody(raw: unknown): { vendors: unknown[]; categories: unknown[] } {
  const r = raw as Record<string, unknown>;
  const inner = (r.expenseOptions as Record<string, unknown> | undefined) ?? r;
  const data = inner.data as Record<string, unknown> | undefined;
  const vendors = inner.vendors ?? data?.vendors;
  const categories = inner.categories ?? data?.categories;
  return {
    vendors: Array.isArray(vendors) ? vendors : [],
    categories: Array.isArray(categories) ? categories : [],
  };
}

type SaveExpenseResponse = {
  recordId?: string;
  id?: string;
  mode?: string;
  expense?: { description?: string; vendor?: string; subtotal?: number };
};

test("Gastos: smoke crear, guardar, editar y archivar", async ({ page }) => {
  const marker = e2eExpenseMarker();
  const descriptionInitial = `${marker} desc`;
  const descriptionEdited = `${marker} desc editada`;

  const rawOptions = await fetchApiJson("/api/expense-options");
  const { vendors, categories } = normalizeExpenseOptionsBody(rawOptions);
  if (!Array.isArray(vendors) || !Array.isArray(categories)) {
    throw new Error(
      `E2E Gastos: /api/expense-options debe incluir arrays vendors y categories (raíz o bajo expenseOptions). Recibido: ${JSON.stringify(rawOptions).slice(0, 280)}`,
    );
  }

  const { profile } = await fetchRuntimeConfigForE2E();
  const profileId = String(profile.id || "").trim();
  if (!profileId) {
    throw new Error("E2E Gastos: no hay templateProfileId usable desde /api/config.");
  }

  await bootstrapAuthInBrowser(page);
  await page.goto("/gastos");
  await page.waitForLoadState("domcontentloaded");

  const main = page.locator("main").first();
  await expect(main.getByRole("heading", { name: "Gastos", exact: true })).toBeVisible({ timeout: 20000 });

  await main.getByRole("button", { name: "Nuevo gasto" }).click();

  const formCard = main.locator("div.rounded-lg.border").filter({ has: page.getByRole("heading", { name: /Alta de gasto/ }) }).first();
  await expect(formCard.getByRole("heading", { name: "Alta de gasto" })).toBeVisible({ timeout: 15000 });

  const profileSelect = formCard.locator('label:has(span:text-is("Perfil")) select').first();
  await expect(profileSelect).toBeVisible();
  await profileSelect.selectOption(profileId);

  await formCard.locator('label:has(span:text-is("Fecha factura")) input[type="date"]').fill(new Date().toISOString().slice(0, 10));

  await formCard.locator('label:has(span:text-is("Proveedor")) input').first().fill(marker);

  await formCard.locator('label:has(span:text-is("Descripción")) input').first().fill(descriptionInitial);

  await formCard.locator('label:has(span:text-is("Base (subtotal)")) input').first().fill("10");

  const saveFirstPromise = page.waitForResponse(
    (response) => response.url().includes("/api/expenses") && response.request().method() === "POST",
    { timeout: 20000 },
  );

  await formCard.getByRole("button", { name: "Guardar gasto" }).click();

  const saveFirst = await saveFirstPromise;
  if (!saveFirst.ok()) {
    const text = await saveFirst.text();
    throw new Error(`POST /api/expenses (crear) falló (${saveFirst.status()}): ${text.slice(0, 220)}`);
  }

  const firstPayload = (await saveFirst.json().catch(() => null)) as SaveExpenseResponse | null;
  const recordId = String(firstPayload?.recordId || "").trim();
  if (!recordId) {
    throw new Error("POST /api/expenses (crear) respondió OK pero sin recordId.");
  }

  const vendorReturned = String(firstPayload?.expense?.vendor || "").trim();
  if (vendorReturned && vendorReturned !== marker) {
    throw new Error(`El gasto guardado no conserva el proveedor E2E. Esperado prefijo ${marker}, recibido: ${vendorReturned}`);
  }

  await expect(main.getByRole("heading", { name: "Editar gasto" })).toBeVisible({ timeout: 15000 });

  const formEdit = main.locator("div.rounded-lg.border").filter({ has: page.getByRole("heading", { name: /Editar gasto/ }) }).first();
  const descInput = formEdit.locator('label:has(span:text-is("Descripción")) input').first();
  await expect(descInput).toBeVisible();
  await descInput.fill(descriptionEdited);

  const saveSecondPromise = page.waitForResponse(
    (response) => response.url().includes("/api/expenses") && response.request().method() === "POST",
    { timeout: 20000 },
  );

  await formEdit.getByRole("button", { name: "Guardar gasto" }).click();

  const saveSecond = await saveSecondPromise;
  if (!saveSecond.ok()) {
    const text = await saveSecond.text();
    throw new Error(`POST /api/expenses (editar) falló (${saveSecond.status()}): ${text.slice(0, 220)}`);
  }

  const secondPayload = (await saveSecond.json().catch(() => null)) as SaveExpenseResponse | null;
  const secondRecordId = String(secondPayload?.recordId || "").trim();
  if (secondRecordId !== recordId) {
    throw new Error(
      `Tras editar, recordId debía mantenerse. Antes: ${recordId}, después: ${secondRecordId || "(vacío)"}`,
    );
  }

  const descReturned = String(secondPayload?.expense?.description || "").trim();
  if (descReturned && descReturned !== descriptionEdited) {
    throw new Error(`La respuesta de edición no refleja la descripción actualizada. Recibido: ${descReturned}`);
  }

  const archiveResponse = await archiveExpenseByRecordId(recordId);
  if (!archiveResponse.ok) {
    const preview = (await archiveResponse.text()).replace(/\s+/g, " ").slice(0, 200);
    throw new Error(
      `Limpieza E2E: POST /api/expenses/archive falló (${archiveResponse.status}) para recordId=${recordId}. ${preview} Gasto dejado en sistema con prefijo ${marker}.`,
    );
  }
});
