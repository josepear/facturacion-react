import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClientsPage } from "@/features/clients/pages/ClientsPage";
import { createPageWrapper } from "@/test/test-utils";

const {
  fetchClientsMock,
  saveClientMock,
  archiveClientMock,
  fetchRuntimeConfigMock,
  useSessionQueryMock,
  adminSession,
  restrictedEditorSession,
  viewerSession,
  searchState,
} = vi.hoisted(() => {
  const admin = {
    data: {
      authenticated: true as const,
      user: { id: "u1", name: "Admin", email: "a@test", role: "admin", tenantId: "default" },
    },
    isLoading: false,
    error: null,
    isSuccess: true,
  };
  const restrictedEditor = {
    data: {
      authenticated: true as const,
      user: {
        id: "u2",
        name: "Ed",
        email: "e@test",
        role: "editor",
        tenantId: "default",
        allowedTemplateProfileIds: ["em-a"],
      },
    },
    isLoading: false,
    error: null,
    isSuccess: true,
  };
  const viewer = {
    data: {
      authenticated: true as const,
      user: { id: "u3", name: "V", email: "v@test", role: "viewer", tenantId: "default" },
    },
    isLoading: false,
    error: null,
    isSuccess: true,
  };
  return {
    fetchClientsMock: vi.fn(),
    saveClientMock: vi.fn(),
    archiveClientMock: vi.fn(),
    fetchRuntimeConfigMock: vi.fn(),
    useSessionQueryMock: vi.fn(() => admin),
    adminSession: admin,
    restrictedEditorSession: restrictedEditor,
    viewerSession: viewer,
    searchState: { query: "" },
  };
});

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
  archiveClient: archiveClientMock,
}));

vi.mock("@/infrastructure/api/documentsApi", () => ({
  fetchRuntimeConfig: fetchRuntimeConfigMock,
}));

vi.mock("@/features/shared/hooks/useSessionQuery", () => ({
  SESSION_QUERY_KEY: ["session"],
  useSessionQuery: () => useSessionQueryMock(),
}));

const searchPlaceholder = "Buscar por nombre, NIF/CIF, email, contacto, ciudad o recordId";

const defaultRuntimeConfig = {
  templateProfiles: [
    { id: "em-a", label: "A" },
    { id: "em-b", label: "B" },
  ],
  activeTemplateProfileId: "em-a",
};

describe("ClientsPage regression", () => {
  beforeEach(() => {
    searchState.query = "";
    vi.clearAllMocks();
    useSessionQueryMock.mockReturnValue(adminSession);
    fetchRuntimeConfigMock.mockResolvedValue(defaultRuntimeConfig);
  });

  it("lists, filters and saves a client", async () => {
    fetchClientsMock.mockResolvedValue([
      { recordId: "c1", name: "Acme Studio", taxId: "A111", templateProfileId: "em-a" },
      { recordId: "c2", name: "Beta Labs", taxId: "B222", templateProfileId: "em-a" },
    ]);
    saveClientMock.mockResolvedValue({
      recordId: "c1",
      name: "Acme Studio Updated",
      taxId: "A111",
      templateProfileId: "em-a",
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
      { recordId: "c1", name: "Acme Studio", taxId: "A111", city: "Madrid", templateProfileId: "em-a" },
      { recordId: "c2", name: "Beta Labs", taxId: "B222", templateProfileId: "em-a" },
    ]);
    saveClientMock.mockResolvedValue({ recordId: "c1", name: "Acme Studio", taxId: "A111", templateProfileId: "em-a" });

    render(<ClientsPage />, { wrapper: createPageWrapper() });

    expect(await screen.findByDisplayValue("Acme Studio")).toBeTruthy();
    expect(screen.getByText("Cliente cargado desde URL.")).toBeTruthy();
    const recordIdLine = screen.getByText("recordId (Facturar / API):").closest("p");
    expect(recordIdLine?.textContent?.replace(/\s+/g, " ").trim()).toContain("c1");
    expect((screen.getByLabelText("Ciudad") as HTMLInputElement).value).toBe("Madrid");
  });

  it("restricted editor can save and archive in-scope clients", async () => {
    useSessionQueryMock.mockReturnValue(restrictedEditorSession);
    fetchClientsMock.mockResolvedValue([
      { recordId: "ca", name: "En ámbito", taxId: "A1", templateProfileId: "em-a" },
    ]);
    saveClientMock.mockResolvedValue({ recordId: "ca", name: "En ámbito OK", taxId: "A1", templateProfileId: "em-a" });
    archiveClientMock.mockResolvedValue({ ok: true });

    render(<ClientsPage />, { wrapper: createPageWrapper() });

    await screen.findByText("En ámbito");
    expect(screen.getByText(/emisores permitidos/)).toBeTruthy();

    await userEvent.click(screen.getByText("En ámbito"));
    await userEvent.clear(screen.getByLabelText("Nombre o razón social"));
    await userEvent.type(screen.getByLabelText("Nombre o razón social"), "En ámbito OK");
    const saveBtn = screen.getByRole("button", { name: "Guardar cliente" });
    expect(saveBtn.hasAttribute("disabled")).toBe(false);
    await userEvent.click(saveBtn);
    await waitFor(() => expect(saveClientMock).toHaveBeenCalledTimes(1));

    const archiveBtn = screen.getByRole("button", { name: "Archivar cliente" });
    expect(archiveBtn.hasAttribute("disabled")).toBe(false);
  });

  it("admin can use Archivar cliente (editor-style scope)", async () => {
    fetchClientsMock.mockResolvedValue([
      { recordId: "cx", name: "X", taxId: "Z1", templateProfileId: "em-b" },
    ]);
    archiveClientMock.mockResolvedValue({ ok: true });

    render(<ClientsPage />, { wrapper: createPageWrapper() });
    await screen.findByText("X");
    await userEvent.click(screen.getByText("X"));
    const archiveBtn = screen.getByRole("button", { name: "Archivar cliente" });
    expect(archiveBtn.hasAttribute("disabled")).toBe(false);
  });

  it("viewer cannot save or archive", async () => {
    useSessionQueryMock.mockReturnValue(viewerSession);
    fetchClientsMock.mockResolvedValue([
      { recordId: "cv", name: "Vista", taxId: "V1", templateProfileId: "em-a" },
    ]);

    render(<ClientsPage />, { wrapper: createPageWrapper() });
    await screen.findByText("Vista");
    await userEvent.click(screen.getByText("Vista"));
    expect(screen.getByRole("button", { name: "Guardar cliente" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Archivar cliente" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/solo lectura/i)).toBeTruthy();
  });
});
