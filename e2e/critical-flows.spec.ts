import { expect, test, type Locator, type Page } from "@playwright/test";

import { bootstrapAuthInBrowser, fetchRuntimeConfigForE2E } from "./browserApiHarness";

test.setTimeout(45000);

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

function marker(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

type SaveDocumentPayload = {
  recordId?: string;
  document?: {
    templateProfileId?: string;
    accounting?: { paymentDate?: string };
    client?: { name?: string; contactPerson?: string };
    items?: Array<{ concept?: string; description?: string }>;
  };
};

async function pendingSaveMessageCount(root: Locator) {
  return root.getByText("Completa los módulos pendientes antes de guardar.").evaluateAll((nodes) =>
    nodes.filter((node) => {
      const element = node as HTMLElement;
      if (!element.isConnected) return false;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }).length,
  ).catch(() => 0);
}

async function saveFromFacturar(page: Page, root: Locator) {
  await expect.poll(() => pendingSaveMessageCount(root), {
    timeout: 10000,
    message: "Facturar no queda en estado guardable antes de guardar.",
  }).toBe(0);

  const saveResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/documents") && response.request().method() === "POST",
    { timeout: 15000 },
  );

  const saveButton = root
    .locator(
      'button:has-text("Guardar documento"), button:has-text("Guardar borrador"), button:has-text("Guardar factura"), button:has-text("Guardar")',
    )
    .first();
  await expect(saveButton).toBeEnabled({ timeout: 10000 });
  await saveButton.click();

  const saveResponse = await saveResponsePromise.catch(async () => null);
  if (!saveResponse) {
    const uiError = String((await root.locator("p.text-red-600").first().textContent().catch(() => "")) || "").trim();
    throw new Error(`No se lanzó POST /api/documents al guardar.${uiError ? ` Error UI: ${uiError}` : ""}`);
  }

  if (!saveResponse.ok()) {
    const payload = await saveResponse.text();
    throw new Error(`Guardado en /api/documents falló (${saveResponse.status()}): ${payload.slice(0, 200)}`);
  }

  const savePayload = (await saveResponse.json().catch(() => null)) as SaveDocumentPayload | null;
  const recordId = String(savePayload?.recordId || "").trim();
  if (!recordId) {
    throw new Error("POST /api/documents respondió OK pero sin recordId.");
  }
  return { recordId, payload: savePayload };
}

async function waitForFacturarReady(page: Page, expectedRecordId?: string) {
  const root = page.locator("main:visible").first();
  const conceptInput = root.locator('input[name="items.0.concept"]').first();

  await page.waitForLoadState("domcontentloaded");
  await expect(conceptInput).toBeVisible({ timeout: 20000 });

  if (expectedRecordId) {
    await expect(root.locator("span").filter({ hasText: `recordId: ${expectedRecordId}` }).first()).toBeVisible({ timeout: 20000 });
  }

  return root;
}

async function canSaveFacturar(root: Locator) {
  return (await pendingSaveMessageCount(root)) === 0;
}

/** Salida oficial: misma condición que `canOpenOfficialOutput` en Facturar (`serverRecordId` no vacío). */
async function expectOfficialOutputActionsEnabled(root: Locator) {
  const htmlBtn = root.getByRole("button", { name: "Ver HTML oficial" });
  const pdfBtn = root.getByRole("button", { name: "Abrir PDF oficial" });
  await expect(htmlBtn).toBeEnabled();
  await expect(pdfBtn).toBeEnabled();
}

async function chooseTemplateProfileInUi(root: Locator, preferredProfileId: string) {
  const profileSelect = root.locator('select[name="templateProfileId"]').first();
  await expect(profileSelect).toBeVisible({ timeout: 20000 });

  const readProfileValues = () => profileSelect.locator("option").evaluateAll((options) =>
    options.map((option) => String((option as HTMLOptionElement).value || "").trim()).filter(Boolean),
  );

  await expect.poll(async () => (await readProfileValues()).length, {
    timeout: 20000,
    message: "La UI de Facturar no cargó opciones de emisor desde /api/config.",
  }).toBeGreaterThan(0);

  const values = await readProfileValues();

  const selected = String(await profileSelect.inputValue().catch(() => "")).trim();
  const profileId = selected || (values.includes(preferredProfileId) ? preferredProfileId : values[0]);
  await profileSelect.selectOption(profileId);
  await expect(profileSelect).toHaveValue(profileId);
  return profileId;
}

async function fillInputIfBlank(locator: Locator, value: string, options?: { force?: boolean }) {
  if (!(await locator.count())) return;
  const current = String(await locator.first().inputValue().catch(() => "")).trim();
  if (!current) {
    await locator.first().fill(value, options);
  }
}

async function fillPositiveNumberIfBlank(locator: Locator, value: string) {
  if (!(await locator.count())) return;
  const current = String(await locator.first().inputValue().catch(() => "")).trim();
  if (!current || Number(current) <= 0) {
    await locator.first().fill(value);
  }
}

async function openAllDetailsInRoot(root: Locator) {
  const allDetails = root.locator("details");
  const count = await allDetails.count();
  for (let i = 0; i < count; i++) {
    const detail = allDetails.nth(i);
    const isOpen = await detail.getAttribute("open");
    if (isOpen === null) {
      await detail.locator("summary").click().catch(() => {});
    }
  }
}

async function ensureSaveableFacturar(
  root: Locator,
  id: string,
  preferredProfileId: string,
  contactPerson: string,
  paymentDate: string,
) {
  await chooseTemplateProfileInUi(root, preferredProfileId);
  await openAllDetailsInRoot(root);

  await fillInputIfBlank(root.locator('input[name="templateLayout"]'), "pear");
  await fillInputIfBlank(root.locator('input[name="paymentMethod"]'), "Transferencia");
  await fillInputIfBlank(root.locator('input[name="bankAccount"]'), "ES00 E2E 0000 0000 0000");
  await fillInputIfBlank(root.locator('input[name="client.name"]'), `E2E Cliente ${id}`);
  await fillInputIfBlank(root.locator('input[name="client.contactPerson"]'), contactPerson, { force: true });
  await fillInputIfBlank(root.locator('input[name="items.0.concept"]'), `E2E Servicio ${id}`);
  await fillInputIfBlank(root.locator('input[name="number"]'), `E2E-${Date.now()}`);
  await fillPositiveNumberIfBlank(root.locator('input[name="items.0.quantity"]'), "1");
  await fillPositiveNumberIfBlank(root.locator('input[name="items.0.unitPrice"]'), "100");

  const issueDate = root.locator('input[name="issueDate"]').first();
  if (await issueDate.count()) {
    const value = String(await issueDate.inputValue().catch(() => "")).trim();
    if (!value) {
      await issueDate.fill(new Date().toISOString().slice(0, 10));
    }
  }

  await expect.poll(() => pendingSaveMessageCount(root), {
    timeout: 10000,
    message: "Facturar sigue con módulos pendientes tras rellenar las precondiciones mínimas.",
  }).toBe(0);

  // `paymentDate` se rellena para verificar round-trip, no como gate de guardado.
  await fillInputIfBlank(root.locator('input[name="accounting.paymentDate"]'), paymentDate);
}

async function openFacturarAndCreate(page: Page, id: string) {
  const { profile } = await fetchRuntimeConfigForE2E();
  const preferredProfileId = String(profile.id || "").trim();
  const contactPerson = `E2E Contact ${id}`;
  const paymentDate = new Date().toISOString().slice(0, 10);

  await bootstrapAuthInBrowser(page);
  await page.goto("/facturar");
  const root = await waitForFacturarReady(page);
  await ensureSaveableFacturar(root, id, preferredProfileId, contactPerson, paymentDate);

  const templateProfileId = String(await root.locator('select[name="templateProfileId"]').first().inputValue()).trim();
  if (!templateProfileId) {
    throw new Error("La UI de Facturar no aplicó ningún templateProfileId tras cargar /api/config.");
  }

  const saved = await saveFromFacturar(page, root);
  await expectOfficialOutputActionsEnabled(root);
  const savedTemplateProfileId = String(saved.payload?.document?.templateProfileId || templateProfileId).trim();
  const savedConcept = String(saved.payload?.document?.items?.[0]?.concept || "").trim();
  const savedContactPerson = String(saved.payload?.document?.client?.contactPerson || "").trim();
  const savedPaymentDate = String(saved.payload?.document?.accounting?.paymentDate || "").trim();
  if (savedContactPerson !== contactPerson) {
    throw new Error(`El contacto del documento guardado no conserva el valor esperado. Recibido: ${savedContactPerson}`);
  }
  if (savedConcept && savedConcept !== `E2E Servicio ${id}`) {
    throw new Error(`El documento guardado no conserva el concepto esperado. Recibido: ${savedConcept}`);
  }
  if (savedPaymentDate !== paymentDate) {
    throw new Error(`La fecha de cobro del documento guardado no conserva el valor esperado. Recibido: ${savedPaymentDate}`);
  }
  return { recordId: saved.recordId, templateProfileId: savedTemplateProfileId || templateProfileId, contactPerson, paymentDate };
}

test("Facturar: crear, guardar, recargar y editar", async ({ page }) => {
  const id = marker("facturar");
  const { profile } = await fetchRuntimeConfigForE2E();
  const preferredProfileId = String(profile.id || "").trim();

  const { recordId, templateProfileId, contactPerson, paymentDate } = await openFacturarAndCreate(page, id);
  if (!recordId) throw new Error("No se pudo obtener recordId tras guardar en Facturar");

  const reloadUrl = templateProfileId
    ? `/facturar?recordId=${encodeURIComponent(recordId)}&templateProfileId=${encodeURIComponent(templateProfileId)}`
    : `/facturar?recordId=${encodeURIComponent(recordId)}`;
  const detailResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/documents/detail") &&
      response.url().includes(encodeURIComponent(recordId)) &&
      response.ok(),
    { timeout: 20000 },
  );
  await page.goto(reloadUrl);
  await detailResponsePromise;

  const root = await waitForFacturarReady(page, recordId);
  await expectOfficialOutputActionsEnabled(root);
  const concept = root.locator('input[name="items.0.concept"]').first();
  await expect(concept).toBeVisible();
  await expect(root.locator('input[name="client.contactPerson"]').first()).toHaveValue(contactPerson);
  await expect(root.locator('input[name="accounting.paymentDate"]').first()).toHaveValue(paymentDate);
  await ensureSaveableFacturar(root, id, templateProfileId || preferredProfileId, contactPerson, paymentDate);

  if (!(await canSaveFacturar(root))) {
    throw new Error("El documento cargado no queda guardable en este entorno (faltan emisor, cliente, número u otros módulos).");
  }

  const nextConcept = `E2E Edit ${id}`;
  await concept.fill(nextConcept);

  const edited = await saveFromFacturar(page, root);
  await expectOfficialOutputActionsEnabled(root);
  const editedConcept = String(edited.payload?.document?.items?.[0]?.concept || "").trim();
  const editedContactPerson = String(edited.payload?.document?.client?.contactPerson || "").trim();
  if (editedContactPerson !== contactPerson) {
    throw new Error(`El contacto del documento editado no conserva el valor esperado. Recibido: ${editedContactPerson}`);
  }
  if (editedConcept && editedConcept !== nextConcept) {
    throw new Error(`El POST de edición no devolvió el concepto actualizado. Recibido: ${editedConcept}`);
  }

  await expect(root.locator('input[name="items.0.concept"]').first()).toHaveValue(nextConcept);
});
