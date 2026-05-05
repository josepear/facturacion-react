import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AsesorCeliaPage } from "@/features/asesor/pages/AsesorCeliaPage";
import { AsesorResumenPage } from "@/features/asesor/pages/AsesorResumenPage";
import { createPageWrapper } from "@/test/test-utils";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Link: ({ to, children }: { to: string; children?: ReactNode }) => (
      <a href={String(to)}>{children}</a>
    ),
  };
});

const sessionState = vi.hoisted(() => ({
  user: {
    id: "ed1",
    name: "Editor",
    email: "ed@test",
    role: "editor" as const,
    tenantId: "default",
    allowedTemplateProfileIds: ["em1"] as string[],
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

const {
  fetchHistoryInvoicesMock,
  fetchExpensesMock,
  fetchRuntimeConfigMock,
} = vi.hoisted(() => ({
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

describe("Asesor pages session scope", () => {
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
    fetchHistoryInvoicesMock.mockResolvedValue([]);
    fetchExpensesMock.mockResolvedValue({ items: [] });
  });

  it("AsesorCelia: editor no ve opción «Todos los emisores» en el desplegable", async () => {
    render(<AsesorCeliaPage />, { wrapper: createPageWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText("Emisor para Excel Celia")).toBeTruthy();
    });

    const sel = screen.getByLabelText("Emisor para Excel Celia") as HTMLSelectElement;
    const labels = Array.from(sel.querySelectorAll("option")).map((o) => o.textContent?.trim() || "");
    expect(labels.some((t) => t.includes("Todos los emisores"))).toBe(false);
    expect(sel.value).toBe("em1");
  });

  it("AsesorResumen: editor sin emisores visibles deshabilita el botón de resumen", async () => {
    fetchRuntimeConfigMock.mockResolvedValue({
      templateProfiles: [{ id: "other", label: "Otro" }],
    });
    sessionState.user = {
      id: "ed1",
      name: "Editor",
      email: "ed@test",
      role: "editor",
      tenantId: "default",
      allowedTemplateProfileIds: ["em1"],
    };

    render(<AsesorResumenPage />, { wrapper: createPageWrapper() });

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /abrir resumen asesor/i });
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it("AsesorResumen: editor con emisor en scope habilita el botón", async () => {
    render(<AsesorResumenPage />, { wrapper: createPageWrapper() });

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /abrir resumen asesor/i });
      expect((btn as HTMLButtonElement).disabled).toBe(false);
    });
  });
});
