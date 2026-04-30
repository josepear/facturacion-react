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
      result.current.form.setValue("items.0.concept", "Servicio", { shouldValidate: true });
      result.current.form.setValue("items.0.quantity", 2, { shouldValidate: true });
      result.current.form.setValue("items.0.unitPrice", 50, { shouldValidate: true });
      result.current.form.setValue("templateProfileId", "perfil-main", { shouldValidate: true });
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

  it("applyTemplateProfile fills payment, IGIC and IRPF from config.defaults when profile omits them", async () => {
    fetchSessionMock.mockResolvedValue({
      authenticated: true,
      user: { id: "u1", name: "User", email: "u@test", role: "admin", tenantId: "default" },
    });
    fetchRuntimeConfigMock.mockResolvedValue({
      activeTemplateProfileId: "p-empty",
      defaults: { paymentMethod: "GlobalPay", taxRate: 10, withholdingRate: 21 },
      templateProfiles: [
        {
          id: "p-empty",
          label: "Perfil mínimo",
          defaults: {},
          business: {},
          design: {},
        },
      ],
    });
    fetchClientsMock.mockResolvedValue([]);
    fetchHistoryInvoicesMock.mockResolvedValue([]);

    const { result } = renderHook(() => useFacturarForm(), { wrapper: createHookWrapper() });

    await waitFor(() => {
      expect(result.current.profileOptions.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.applyTemplateProfile("p-empty");
    });

    expect(result.current.form.getValues("paymentMethod")).toBe("GlobalPay");
    expect(result.current.form.getValues("taxRate")).toBe(10);
    expect(result.current.form.getValues("withholdingRate")).toBe(21);
    expect(result.current.withoutWithholding).toBe(false);
  });

  it("applyTemplateProfile sets tenantId when profile exposes tenantId in config", async () => {
    fetchSessionMock.mockResolvedValue({
      authenticated: true,
      user: { id: "u1", name: "User", email: "u@test", role: "admin", tenantId: "session-tenant" },
    });
    fetchRuntimeConfigMock.mockResolvedValue({
      activeTemplateProfileId: "p-a",
      defaults: {},
      templateProfiles: [
        {
          id: "p-a",
          label: "Perfil A",
          tenantId: "tenant-from-profile",
          defaults: { paymentMethod: "Transferencia", taxRate: 7 },
          business: { bankAccount: "ES00" },
          design: { layout: "pear" },
        },
      ],
    });
    fetchClientsMock.mockResolvedValue([]);
    fetchHistoryInvoicesMock.mockResolvedValue([]);

    const { result } = renderHook(() => useFacturarForm(), { wrapper: createHookWrapper() });

    await waitFor(() => {
      expect(result.current.profileOptions.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.applyTemplateProfile("p-a");
    });

    expect(result.current.form.getValues("tenantId")).toBe("tenant-from-profile");
  });

  it("applyTemplateProfile sets series from merged defaults.series when present in config", async () => {
    fetchSessionMock.mockResolvedValue({
      authenticated: true,
      user: { id: "u1", name: "User", email: "u@test", role: "admin", tenantId: "default" },
    });
    fetchRuntimeConfigMock.mockResolvedValue({
      activeTemplateProfileId: "p-ser",
      defaults: { series: "GLOBAL-S", paymentMethod: "Transferencia", taxRate: 7 },
      templateProfiles: [
        {
          id: "p-ser",
          label: "Con serie",
          defaults: { series: "FAC-2026", paymentMethod: "Bizum", taxRate: 3 },
          business: { bankAccount: "ES99" },
          design: { layout: "pear" },
        },
      ],
    });
    fetchClientsMock.mockResolvedValue([]);
    fetchHistoryInvoicesMock.mockResolvedValue([]);

    const { result } = renderHook(() => useFacturarForm(), { wrapper: createHookWrapper() });

    await waitFor(() => {
      expect(result.current.profileOptions.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.applyTemplateProfile("p-ser");
    });

    expect(result.current.form.getValues("series")).toBe("FAC-2026");
  });
});

