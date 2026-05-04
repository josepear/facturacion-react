import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExpensesPage } from "@/features/expenses/pages/ExpensesPage";
import { ApiError } from "@/infrastructure/api/httpClient";
import { createPageWrapper } from "@/test/test-utils";

vi.mock("@/features/shared/hooks/useSessionQuery", () => ({
  SESSION_QUERY_KEY: ["session"],
  useSessionQuery: () => ({
    data: {
      authenticated: true as const,
      user: { id: "u1", name: "Admin", email: "a@test", role: "admin", tenantId: "default" },
    },
    isLoading: false,
    error: null,
    isSuccess: true,
  }),
}));

const {
  fetchRuntimeConfigMock,
  fetchSessionMock,
  fetchExpensesMock,
  fetchExpenseOptionsMock,
  saveExpenseOptionsMock,
  saveExpenseMock,
  archiveExpenseMock,
  archiveExpenseYearMock,
  fetchTrashMock,
  deleteTrashEntriesMock,
  searchState,
} = vi.hoisted(() => ({
  fetchRuntimeConfigMock: vi.fn(),
  fetchSessionMock: vi.fn(),
  fetchExpensesMock: vi.fn(),
  fetchExpenseOptionsMock: vi.fn(),
  saveExpenseOptionsMock: vi.fn(),
  saveExpenseMock: vi.fn(),
  archiveExpenseMock: vi.fn(),
  archiveExpenseYearMock: vi.fn(),
  fetchTrashMock: vi.fn(),
  deleteTrashEntriesMock: vi.fn(),
  searchState: { query: "" },
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useSearchParams: () => {
      const params = new URLSearchParams(searchState.query);
      const setSearchParams = (next: URLSearchParams) => {
        searchState.query = next.toString();
      };
      return [params, setSearchParams];
    },
  };
});

vi.mock("@/infrastructure/api/documentsApi", () => ({
  fetchRuntimeConfig: fetchRuntimeConfigMock,
}));

vi.mock("@/infrastructure/api/sessionApi", () => ({
  fetchSession: fetchSessionMock,
}));

vi.mock("@/infrastructure/api/expensesApi", () => ({
  fetchExpenses: fetchExpensesMock,
  fetchExpenseOptions: fetchExpenseOptionsMock,
  saveExpenseOptions: saveExpenseOptionsMock,
  saveExpense: saveExpenseMock,
  archiveExpense: archiveExpenseMock,
  archiveExpenseYear: archiveExpenseYearMock,
}));

vi.mock("@/infrastructure/api/historyApi", () => ({
  fetchHistoryInvoices: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/infrastructure/api/exportReportsApi", () => ({
  postShareReport: vi.fn().mockResolvedValue({ ok: true, shareViewUrl: "https://example.com/share" }),
}));

vi.mock("@/infrastructure/api/trashApi", () => ({
  fetchTrash: fetchTrashMock,
  deleteTrashEntries: deleteTrashEntriesMock,
}));

describe("ExpensesPage regression", () => {
  beforeEach(() => {
    searchState.query = "";
  });

  it("lists, filters and saves an expense", async () => {
    fetchSessionMock.mockResolvedValue({
      authenticated: true,
      user: { id: "u1", name: "Admin", email: "a@test", role: "admin", tenantId: "default" },
    });
    fetchRuntimeConfigMock.mockResolvedValue({
      activeTemplateProfileId: "perfil-main",
      templateProfiles: [{ id: "perfil-main", label: "Main" }],
    });
    fetchExpensesMock.mockResolvedValue({
      items: [
        {
          recordId: "g/1.json",
          year: "2026",
          issueDate: "2026-01-10",
          vendor: "Proveedor Uno",
          category: "Software",
          invoiceNumber: "1",
          total: 100,
        },
        {
          recordId: "g/2.json",
          year: "2025",
          issueDate: "2025-06-01",
          vendor: "Proveedor Dos",
          category: "Asesoría",
          invoiceNumber: "2",
          total: 200,
        },
      ],
      years: ["2026", "2025"],
    });
    fetchExpenseOptionsMock.mockResolvedValue({
      vendors: ["Proveedor Uno", "Proveedor Dos"],
      categories: ["Software", "Asesoría"],
    });
    saveExpenseOptionsMock.mockImplementation(async (opts) => ({
      vendors: opts.vendors ?? [],
      categories: opts.categories ?? [],
    }));
    saveExpenseMock.mockResolvedValue({
      mode: "updated",
      id: "id-1",
      recordId: "g/1.json",
      expense: {
        recordId: "g/1.json",
        issueDate: "2026-01-10",
        vendor: "Proveedor Uno",
        description: "Licencia actualizada",
        subtotal: 100,
        taxRate: 7,
        withholdingRate: 0,
      },
    });
    archiveExpenseMock.mockResolvedValue({ ok: true });
    archiveExpenseYearMock.mockResolvedValue({ ok: true, archivedCount: 1 });
    fetchTrashMock.mockResolvedValue({
      items: [{ path: "_papelera/gastos/2026/g-1.json", category: "gastos", fileType: "json" }],
    });
    deleteTrashEntriesMock.mockResolvedValue({ ok: true });

    render(<ExpensesPage />, { wrapper: createPageWrapper() });

    const workbookTable = await screen.findByRole("table", { name: "Gastos del ejercicio filtrados" });
    expect(within(workbookTable).getByText("Proveedor Uno")).toBeTruthy();
    const searchInput = screen.getByLabelText("Filtrar filas de gastos por texto");
    await userEvent.type(searchInput, "Dos");
    expect(within(workbookTable).queryByText("Proveedor Uno")).toBeNull();
    expect(within(workbookTable).getByText("Proveedor Dos")).toBeTruthy();

    await userEvent.clear(searchInput);
    const proveedorUnoInTable = within(workbookTable).getAllByText("Proveedor Uno");
    const firstProveedorUno = proveedorUnoInTable[0];
    if (!firstProveedorUno) {
      throw new Error("expected Proveedor Uno in workbook table");
    }
    await userEvent.click(firstProveedorUno);
    await userEvent.clear(screen.getByRole("textbox", { name: "Descripción del gasto" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Descripción del gasto" }), "Licencia actualizada");
    await userEvent.click(screen.getByRole("button", { name: "Guardar gasto" }));

    await waitFor(() => {
      expect(saveExpenseMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Gasto actualizado.")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Archivar gasto" }));
    await waitFor(() => {
      expect(archiveExpenseMock).toHaveBeenCalledWith("g/1.json");
    });

    await userEvent.selectOptions(screen.getByDisplayValue("Selecciona ejercicio"), "2026");
    await userEvent.selectOptions(screen.getByDisplayValue("Selecciona emisor"), "perfil-main");
    await userEvent.click(screen.getByRole("button", { name: "Archivar ejercicio" }));
    await waitFor(() => {
      expect(archiveExpenseYearMock).toHaveBeenCalledWith({ year: "2026", templateProfileId: "perfil-main" });
    });

    await userEvent.click(screen.getByRole("button", { name: "Borrar" }));
    await waitFor(() => {
      expect(deleteTrashEntriesMock).toHaveBeenCalledWith(["_papelera/gastos/2026/g-1.json"]);
    });
  });

  it("shows server validation message when saveExpense rejects with ApiError payload", async () => {
    fetchSessionMock.mockResolvedValue({
      authenticated: true,
      user: { id: "u1", name: "Admin", email: "a@test", role: "admin", tenantId: "default" },
    });
    fetchRuntimeConfigMock.mockResolvedValue({
      activeTemplateProfileId: "perfil-main",
      templateProfiles: [{ id: "perfil-main", label: "Main" }],
    });
    fetchExpensesMock.mockResolvedValue({ items: [], years: [] });
    fetchExpenseOptionsMock.mockResolvedValue({ vendors: [], categories: [] });
    saveExpenseOptionsMock.mockImplementation(async (opts) => ({
      vendors: opts.vendors ?? [],
      categories: opts.categories ?? [],
    }));
    saveExpenseMock.mockImplementation(() =>
      Promise.reject(new ApiError("Bad Request", 400, { message: "Error fiscal del servidor" })),
    );

    render(<ExpensesPage />, { wrapper: createPageWrapper() });

    await screen.findByRole("button", { name: "Nuevo gasto" });
    await userEvent.click(screen.getByRole("button", { name: "Poner fecha factura a hoy" }));
    await userEvent.type(screen.getByRole("combobox", { name: "Proveedor del gasto" }), "Proveedor X");
    await userEvent.click(screen.getByRole("button", { name: "Guardar gasto" }));

    await waitFor(() => {
      expect(saveExpenseMock).toHaveBeenCalled();
    });
    expect(await screen.findByText("Error fiscal del servidor")).toBeTruthy();
  });
});

