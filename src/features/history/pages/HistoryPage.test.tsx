import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { HistoryPage } from "@/features/history/pages/HistoryPage";

const {
  fetchHistoryInvoicesMock,
  fetchDocumentDetailMock,
  archiveDocumentMock,
  archiveDocumentYearMock,
  fetchRuntimeConfigMock,
  fetchTrashMock,
  deleteTrashEntriesMock,
  navigateMock,
} = vi.hoisted(() => ({
  fetchHistoryInvoicesMock: vi.fn(),
  fetchDocumentDetailMock: vi.fn(),
  archiveDocumentMock: vi.fn(),
  archiveDocumentYearMock: vi.fn(),
  fetchRuntimeConfigMock: vi.fn(),
  fetchTrashMock: vi.fn(),
  deleteTrashEntriesMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/infrastructure/api/historyApi", () => ({
  fetchHistoryInvoices: fetchHistoryInvoicesMock,
}));

vi.mock("@/infrastructure/api/documentsApi", () => ({
  fetchDocumentDetail: fetchDocumentDetailMock,
  archiveDocument: archiveDocumentMock,
  archiveDocumentYear: archiveDocumentYearMock,
  fetchRuntimeConfig: fetchRuntimeConfigMock,
}));

vi.mock("@/infrastructure/api/trashApi", () => ({
  fetchTrash: fetchTrashMock,
  deleteTrashEntries: deleteTrashEntriesMock,
}));

describe("HistoryPage regression", () => {
  it("lists, filters and opens selected document in Facturar", async () => {
    fetchHistoryInvoicesMock.mockResolvedValue([
      {
        recordId: "docs/a.json",
        type: "factura",
        typeLabel: "Factura",
        number: "F-1",
        clientName: "Acme",
        issueDate: "2026-01-05",
        total: 120,
        savedAt: "2026-01-05T10:00:00Z",
      },
      {
        recordId: "docs/b.json",
        type: "factura",
        typeLabel: "Factura",
        number: "F-2",
        clientName: "Beta",
        issueDate: "2026-01-06",
        total: 240,
        savedAt: "2026-01-06T10:00:00Z",
      },
    ]);
    fetchDocumentDetailMock.mockResolvedValue({
      recordId: "docs/b.json",
      document: {
        type: "factura",
        number: "F-2",
        issueDate: "2026-01-06",
        client: { name: "Beta" },
        items: [{ concept: "Servicio", quantity: 1, unitPrice: 200 }],
      },
    });
    archiveDocumentMock.mockResolvedValue({ ok: true });
    archiveDocumentYearMock.mockResolvedValue({ ok: true, archivedCount: 1 });
    fetchRuntimeConfigMock.mockResolvedValue({
      currentUser: { role: "admin", tenantId: "default" },
      templateProfiles: [{ id: "perfil-main", label: "Perfil Main" }],
    });
    fetchTrashMock.mockResolvedValue({
      items: [{ path: "_papelera/documentos/2026/facturas/f-1.json", category: "documentos", fileType: "json" }],
    });
    deleteTrashEntriesMock.mockResolvedValue({ ok: true });

    render(<HistoryPage />);

    await screen.findByText("F-1");
    await userEvent.type(screen.getByPlaceholderText("Buscar por número, cliente, tipo o recordId"), "Beta");
    expect(screen.queryByText("F-1")).toBeNull();
    expect(screen.getByText("F-2")).toBeTruthy();

    await userEvent.click(screen.getByText("F-2"));
    await waitFor(() => {
      expect(fetchDocumentDetailMock).toHaveBeenCalledWith("docs/b.json");
    });

    await userEvent.click(screen.getByRole("button", { name: "Editar en Facturar" }));
    expect(navigateMock).toHaveBeenCalledWith("/facturar?recordId=docs%2Fb.json");

    await userEvent.click(screen.getByRole("button", { name: "Archivar documento" }));
    await waitFor(() => {
      expect(archiveDocumentMock).toHaveBeenCalledWith("docs/b.json");
    });

    await userEvent.selectOptions(screen.getByDisplayValue("Selecciona ejercicio"), "2026");
    await userEvent.selectOptions(screen.getByDisplayValue("Selecciona perfil"), "perfil-main");
    await userEvent.click(screen.getByRole("button", { name: "Archivar ejercicio" }));
    await waitFor(() => {
      expect(archiveDocumentYearMock).toHaveBeenCalledWith({ year: "2026", templateProfileId: "perfil-main" });
    });

    await userEvent.click(screen.getByRole("button", { name: "Borrar" }));
    await waitFor(() => {
      expect(deleteTrashEntriesMock).toHaveBeenCalledWith(["_papelera/documentos/2026/facturas/f-1.json"]);
    });
  });
});

