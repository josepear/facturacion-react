import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ClientsPage } from "@/features/clients/pages/ClientsPage";

const { fetchClientsMock, saveClientMock } = vi.hoisted(() => ({
  fetchClientsMock: vi.fn(),
  saveClientMock: vi.fn(),
}));

vi.mock("@/infrastructure/api/clientsApi", () => ({
  fetchClients: fetchClientsMock,
  saveClient: saveClientMock,
}));

describe("ClientsPage regression", () => {
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

    render(<ClientsPage />);

    await screen.findByText("Acme Studio");
    expect(screen.getByText("Beta Labs")).toBeTruthy();

    await userEvent.type(screen.getByPlaceholderText("Buscar por nombre, NIF/CIF o email"), "Beta");
    expect(screen.queryByText("Acme Studio")).toBeNull();
    expect(screen.getByText("Beta Labs")).toBeTruthy();

    await userEvent.clear(screen.getByPlaceholderText("Buscar por nombre, NIF/CIF o email"));
    await userEvent.click(screen.getByText("Acme Studio"));
    await userEvent.clear(screen.getByLabelText("Nombre o razón social"));
    await userEvent.type(screen.getByLabelText("Nombre o razón social"), "Acme Studio Updated");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cliente" }));

    await waitFor(() => {
      expect(saveClientMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Cliente guardado.")).toBeTruthy();
  });
});

