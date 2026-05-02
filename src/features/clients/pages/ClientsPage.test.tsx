import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClientsPage } from "@/features/clients/pages/ClientsPage";
import { createPageWrapper } from "@/test/test-utils";

const { fetchClientsMock, saveClientMock, searchState } = vi.hoisted(() => ({
  fetchClientsMock: vi.fn(),
  saveClientMock: vi.fn(),
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

vi.mock("@/infrastructure/api/clientsApi", () => ({
  fetchClients: fetchClientsMock,
  saveClient: saveClientMock,
}));

const searchPlaceholder = "Buscar por nombre, NIF/CIF, email, contacto, ciudad o recordId";

describe("ClientsPage regression", () => {
  beforeEach(() => {
    searchState.query = "";
  });

  it("lists, filters and saves a client", async () => {
    fetchClientsMock.mockResolvedValue([
      { recordId: "c1", name: "Acme Studio", taxId: "A111" },
      { recordId: "c2", name: "Beta Labs", taxId: "B222" },
    ]);
    saveClientMock.mockResolvedValue({
      recordId: "c1",
      name: "Acme Studio Updated",
      taxId: "A111",
    });

    render(<ClientsPage />, { wrapper: createPageWrapper() });

    await screen.findByText("Acme Studio");
    expect(screen.getByText("Beta Labs")).toBeTruthy();

    await userEvent.type(screen.getByPlaceholderText(searchPlaceholder), "Beta");
    expect(screen.queryByText("Acme Studio")).toBeNull();
    expect(screen.getByText("Beta Labs")).toBeTruthy();

    await userEvent.clear(screen.getByPlaceholderText(searchPlaceholder));
    await userEvent.click(screen.getByText("Acme Studio"));
    await userEvent.clear(screen.getByLabelText("Nombre o razón social"));
    await userEvent.type(screen.getByLabelText("Nombre o razón social"), "Acme Studio Updated");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cliente" }));

    await waitFor(() => {
      expect(saveClientMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Cliente guardado.")).toBeTruthy();
  });

  it("loads selection from recordId in URL when data arrives", async () => {
    searchState.query = "recordId=c1";
    fetchClientsMock.mockResolvedValue([
      { recordId: "c1", name: "Acme Studio", taxId: "A111", city: "Madrid" },
      { recordId: "c2", name: "Beta Labs", taxId: "B222" },
    ]);
    saveClientMock.mockResolvedValue({ recordId: "c1", name: "Acme Studio", taxId: "A111" });

    render(<ClientsPage />, { wrapper: createPageWrapper() });

    expect(await screen.findByDisplayValue("Acme Studio")).toBeTruthy();
    expect(screen.getByText("Cliente cargado desde URL.")).toBeTruthy();
    const recordIdLine = screen.getByText("recordId (Facturar / API):").closest("p");
    expect(recordIdLine?.textContent?.replace(/\s+/g, " ").trim()).toContain("c1");
    expect((screen.getByLabelText("Ciudad") as HTMLInputElement).value).toBe("Madrid");
  });
});

