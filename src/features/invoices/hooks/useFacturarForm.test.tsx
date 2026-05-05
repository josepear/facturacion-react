import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createEmptyDocument } from "@/domain/document/defaults";
import { useFacturarForm } from "@/features/invoices/hooks/useFacturarForm";
import { createHookWrapper } from "@/test/test-utils";

const {
  fetchRuntimeConfigMock,
  fetchSessionMock,
  fetchDocumentDetailMock,
  saveDocumentMock,
  fetchClientsMock,
  fetchHistoryInvoicesMock,
  getNextNumberMock,
  validateNumberAvailabilityMock,
} = vi.hoisted(() => ({
  fetchRuntimeConfigMock: vi.fn(),
  fetchSessionMock: vi.fn(),
  fetchDocumentDetailMock: vi.fn(),
  saveDocumentMock: vi.fn(),
  fetchClientsMock: vi.fn(),
  fetchHistoryInvoicesMock: vi.fn(),
  getNextNumberMock: vi.fn(),
  validateNumberAvailabilityMock: vi.fn(),
}));

vi.mock("@/infrastructure/api/documentsApi", () => ({
  fetchRuntimeConfig: fetchRuntimeConfigMock,
  fetchDocumentDetail: fetchDocumentDetailMock,
  saveDocument: saveDocumentMock,
}));

vi.mock("@/infrastructure/api/httpClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/infrastructure/api/httpClient")>();
  return {
    ...actual,
    getAuthToken: () => "vitest-token",
  };
});

vi.mock("@/infrastructure/api/sessionApi", () => ({
  fetchSession: fetchSessionMock,
}));

vi.mock("@/infrastructure/api/clientsApi", () => ({
  fetchClients: fetchClientsMock,
}));

vi.mock("@/infrastructure/api/historyApi", () => ({
  fetchHistoryInvoices: fetchHistoryInvoicesMock,
}));

vi.mock("@/domain/numbering/usecases/getNextNumber", () => ({
  getNextNumber: getNextNumberMock,
  validateNumberAvailability: validateNumberAvailabilityMock,
}));

describe("useFacturarForm regression", () => {
  it("workflow checklist follows MVP completion rules", async () => {
    const document = createEmptyDocument();
    fetchSessionMock.mockResolvedValue({
      authenticated: true,
      user: { id: "u1", name: "User", email: "u@test", role: "admin", tenantId: "default" },
    });
    fetchRuntimeConfigMock.mockResolvedValue({
      activeTemplateProfileId: "perfil-main",
      templateProfiles: [
        {
          id: "perfil-main",
          label: "Perfil Main",
          defaults: { paymentMethod: "Transferencia", taxRate: 7, withholdingRate: 15 },
          business: { bankAccount: "ES00..." },
          design: { layout: "pear" },
        },
      ],
    });
    fetchClientsMock.mockResolvedValue([]);
    fetchHistoryInvoicesMock.mockResolvedValue([]);
    saveDocumentMock.mockImplementation(async (doc: typeof document) => ({ recordId: "docs/2026/doc-a.json", document: doc }));
    fetchDocumentDetailMock.mockResolvedValue({ recordId: "docs/2026/doc-a.json", document });
    getNextNumberMock.mockResolvedValue("1");
    validateNumberAvailabilityMock.mockResolvedValue({ available: true });

    const { result } = renderHook(() => useFacturarForm(), { wrapper: createHookWrapper() });
    await waitFor(() => {
      expect(result.current.profileOptions.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.form.setValue("templateProfileId", "perfil-main", { shouldValidate: true });
      result.current.form.setValue("templateLayout", "pear", { shouldValidate: true });
      result.current.form.setValue("type", "factura", { shouldValidate: true });
      result.current.form.setValue("number", "1", { shouldValidate: true });
      result.current.form.setValue("issueDate", "2026-05-05", { shouldValidate: true });
      result.current.form.setValue("client.name", "Cliente MVP", { shouldValidate: true });
      result.current.form.setValue("items.0.description", "Servicio", { shouldValidate: true });
      result.current.form.setValue("items.0.quantity", 1, { shouldValidate: true });
      result.current.form.setValue("items.0.unitPrice", 100, { shouldValidate: true });
      result.current.form.setValue("taxRate", 7, { shouldValidate: true });
    });

    await waitFor(() => {
      expect(result.current.workflowChecklist.emitter.complete).toBe(true);
      expect(result.current.workflowChecklist.document.complete).toBe(true);
      expect(result.current.workflowChecklist.client.complete).toBe(true);
      expect(result.current.workflowChecklist.concepts.complete).toBe(true);
      expect(result.current.workflowChecklist.fiscal.complete).toBe(true);
      expect(result.current.workflowChecklist.history.complete).toBe(true);
      expect(result.current.workflowChecklist.save.complete).toBe(true);
    });
  });

  it("creates, calculates, saves and reloads a document", async () => {
    const document = createEmptyDocument();
    document.templateProfileId = "perfil-main";

    fetchSessionMock.mockResolvedValue({
      authenticated: true,
      user: { id: "u1", name: "User", email: "u@test", role: "admin", tenantId: "default" },
    });
    fetchRuntimeConfigMock.mockResolvedValue({
      activeTemplateProfileId: "perfil-main",
      templateProfiles: [
        {
          id: "perfil-main",
          label: "Perfil Main",
          defaults: { paymentMethod: "Transferencia", taxRate: 7, withholdingRate: 15 },
          business: { bankAccount: "ES00..." },
          design: { layout: "pear" },
        },
      ],
    });
    fetchClientsMock.mockResolvedValue([{ recordId: "c1", name: "Cliente Test", taxId: "A123" }]);
    fetchHistoryInvoicesMock.mockResolvedValue([{ recordId: "doc-a", type: "factura", typeLabel: "Factura", number: "1", clientName: "Cliente Test", issueDate: "2026-01-01", total: 100, savedAt: "2026-01-01" }]);
    saveDocumentMock.mockImplementation(async (doc: typeof document) => ({ recordId: "docs/2026/doc-a.json", document: doc }));
    fetchDocumentDetailMock.mockResolvedValue({
      recordId: "docs/2026/doc-a.json",
      document: { ...document, client: { ...document.client, name: "Cliente Recargado" } },
    });
    getNextNumberMock.mockResolvedValue("1");
    validateNumberAvailabilityMock.mockResolvedValue({ available: true });

    const { result } = renderHook(() => useFacturarForm(), { wrapper: createHookWrapper() });

    await waitFor(() => {
      expect(result.current.profileOptions.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.form.setValue("client.name", "Cliente Test", { shouldValidate: true });
      result.current.confirmClientModule();
      result.current.form.setValue("items.0.concept", "Servicio", { shouldValidate: true });
      result.current.form.setValue("items.0.quantity", 2, { shouldValidate: true });
      result.current.form.setValue("items.0.unitPrice", 50, { shouldValidate: true });
      result.current.form.setValue("templateProfileId", "perfil-main", { shouldValidate: true });
      result.current.form.setValue("type", "factura", { shouldValidate: true });
      result.current.form.setValue("accounting.status", "ENVIADA", { shouldValidate: true });
      result.current.form.setValue("templateLayout", "pear", { shouldValidate: true });
      result.current.applyWithholdingMode("sin_irpf");
    });

    await waitFor(() => {
      expect(result.current.totals.total).toBeGreaterThan(100);
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(saveDocumentMock).toHaveBeenCalledTimes(1);
    expect(result.current.serverRecordId).toBe("docs/2026/doc-a.json");

    await act(async () => {
      await result.current.loadMutation.mutateAsync("docs/2026/doc-a.json");
    });

    await waitFor(() => {
      expect(fetchDocumentDetailMock).toHaveBeenCalledWith("docs/2026/doc-a.json");
    });
    await waitFor(() => {
      expect(result.current.form.getValues("client.name")).toBe("Cliente Recargado");
    });
  });

  it("editor restringido puede guardar con emisor permitido", async () => {
    const document = createEmptyDocument();
    fetchSessionMock.mockResolvedValue({
      authenticated: true,
      user: {
        id: "e1",
        name: "Editor",
        email: "e@test",
        role: "editor",
        tenantId: "default",
        allowedTemplateProfileIds: ["perfil-main"],
      },
    });
    fetchRuntimeConfigMock.mockResolvedValue({
      activeTemplateProfileId: "perfil-main",
      templateProfiles: [
        {
          id: "perfil-main",
          label: "Perfil Main",
          defaults: { paymentMethod: "Transferencia", taxRate: 7, withholdingRate: 15 },
          business: { bankAccount: "ES00..." },
          design: { layout: "pear" },
        },
        {
          id: "perfil-otro",
          label: "Otro",
          defaults: {},
          design: { layout: "pear" },
        },
      ],
    });
    fetchClientsMock.mockResolvedValue([]);
    fetchHistoryInvoicesMock.mockResolvedValue([]);
    saveDocumentMock.mockImplementation(async (doc: typeof document) => ({ recordId: "docs/2026/doc-ed.json", document: doc }));
    getNextNumberMock.mockResolvedValue("1");
    validateNumberAvailabilityMock.mockResolvedValue({ available: true });

    const { result } = renderHook(() => useFacturarForm(), { wrapper: createHookWrapper() });

    await waitFor(() => {
      expect(result.current.sessionScope.visibleTemplateProfileIds).toEqual(["perfil-main"]);
    });

    act(() => {
      result.current.form.setValue("templateProfileId", "perfil-main", { shouldValidate: true });
      result.current.form.setValue("templateLayout", "pear", { shouldValidate: true });
      result.current.form.setValue("type", "factura", { shouldValidate: true });
      result.current.form.setValue("number", "1", { shouldValidate: true });
      result.current.form.setValue("issueDate", "2026-05-05", { shouldValidate: true });
      result.current.form.setValue("accounting.status", "ENVIADA", { shouldValidate: true });
      result.current.form.setValue("client.name", "Cliente Ed", { shouldValidate: true });
      result.current.form.setValue("items.0.description", "Servicio", { shouldValidate: true });
      result.current.form.setValue("items.0.quantity", 1, { shouldValidate: true });
      result.current.form.setValue("items.0.unitPrice", 100, { shouldValidate: true });
      result.current.form.setValue("taxRate", 7, { shouldValidate: true });
      result.current.applyWithholdingMode("sin_irpf");
    });

    await waitFor(() => {
      expect(result.current.workflowChecklist.save.complete).toBe(true);
    });

    saveDocumentMock.mockClear();
    await act(async () => {
      await result.current.submit();
    });

    expect(saveDocumentMock).toHaveBeenCalledTimes(1);
  });
});

