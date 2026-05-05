import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataPage } from "@/features/data/pages/DataPage";
import { createPageWrapper } from "@/test/test-utils";

const sessionState = vi.hoisted(() => ({
  user: {
    id: "ed1",
    name: "Editor",
    email: "ed@test",
    role: "editor",
    tenantId: "default",
    allowedTemplateProfileIds: ["em1"] as string[],
  } as {
    id: string;
    name: string;
    email: string;
    role: string;
    tenantId: string;
    allowedTemplateProfileIds: string[];
  },
}));

vi.mock("@/features/shared/hooks/useSessionQuery", () => ({
  SESSION_QUERY_KEY: ["session"],
  useSessionQuery: () => ({
    data: {
      authenticated: true as const,
      user: sessionState.user,
    },
    isLoading: false,
    error: null,
    isSuccess: true,
  }),
}));

const { fetchHistoryInvoicesMock, fetchExpensesMock, fetchRuntimeConfigMock } = vi.hoisted(() => ({
  fetchHistoryInvoicesMock: vi.fn(),
  fetchExpensesMock: vi.fn(),
  fetchRuntimeConfigMock: vi.fn(),
}));

vi.mock("@/infrastructure/api/historyApi", () => ({
  fetchHistoryInvoices: fetchHistoryInvoicesMock,
}));

vi.mock("@/infrastructure/api/expensesApi", () => ({
  fetchExpenses: fetchExpensesMock,
}));

vi.mock("@/infrastructure/api/documentsApi", () => ({
  fetchRuntimeConfig: fetchRuntimeConfigMock,
}));

describe("DataPage session scope", () => {
  beforeEach(() => {
    sessionState.user = {
      id: "ed1",
      name: "Editor",
      email: "ed@test",
      role: "editor",
      tenantId: "default",
      allowedTemplateProfileIds: ["em1"],
    };
    fetchRuntimeConfigMock.mockResolvedValue({
      templateProfiles: [{ id: "em1", label: "Emisor 1" }],
    });
  });

  it("editor: oculta facturas sin templateProfileId (legacy) del contador", async () => {
    fetchHistoryInvoicesMock.mockResolvedValue([
      {
        recordId: "docs/legacy.json",
        type: "factura",
        typeLabel: "Factura",
        number: "F-LEG",
        clientName: "Old",
        issueDate: "2026-01-01",
        total: 10,
        savedAt: "2026-01-01T10:00:00Z",
      },
      {
        recordId: "docs/ok.json",
        type: "factura",
        typeLabel: "Factura",
        number: "F-1",
        clientName: "Acme",
        issueDate: "2026-01-02",
        total: 100,
        savedAt: "2026-01-02T10:00:00Z",
        templateProfileId: "em1",
        templateProfileLabel: "Emisor 1",
      },
    ]);
    fetchExpensesMock.mockResolvedValue({ items: [] });

    render(<DataPage />, { wrapper: createPageWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Facturas (1)")).toBeTruthy();
    });
  });

  it("admin: ve facturas sin templateProfileId", async () => {
    sessionState.user = {
      id: "a1",
      name: "Admin",
      email: "a@test",
      role: "admin",
      tenantId: "default",
      allowedTemplateProfileIds: [],
    };

    fetchHistoryInvoicesMock.mockResolvedValue([
      {
        recordId: "docs/legacy.json",
        type: "factura",
        typeLabel: "Factura",
        number: "F-LEG",
        clientName: "Old",
        issueDate: "2026-01-01",
        total: 10,
        savedAt: "2026-01-01T10:00:00Z",
      },
      {
        recordId: "docs/ok.json",
        type: "factura",
        typeLabel: "Factura",
        number: "F-1",
        clientName: "Acme",
        issueDate: "2026-01-02",
        total: 100,
        savedAt: "2026-01-02T10:00:00Z",
        templateProfileId: "em1",
        templateProfileLabel: "Emisor 1",
      },
    ]);
    fetchExpensesMock.mockResolvedValue({ items: [] });

    render(<DataPage />, { wrapper: createPageWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Facturas (2)")).toBeTruthy();
    });
  });
});
