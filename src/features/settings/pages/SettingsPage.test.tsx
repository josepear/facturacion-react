import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { ApiError } from "@/infrastructure/api/httpClient";
import { createPageWrapper } from "@/test/test-utils";

const {
  fetchRuntimeConfigMock,
  fetchSessionMock,
  fetchSystemUsersMock,
  saveTemplateProfilesConfigMock,
  navigateMock,
  searchState,
  useSessionQueryMock,
  adminSessionQueryResult,
  editorSessionQueryResult,
  restrictedEditorSessionQueryResult,
} = vi.hoisted(() => {
  const admin = {
    data: {
      authenticated: true as const,
      user: { id: "u1", name: "Admin", email: "admin@test", role: "admin", tenantId: "default" },
    },
    isLoading: false,
    error: null,
    isSuccess: true,
  };
  const editor = {
    data: {
      authenticated: true as const,
      user: { id: "u2", name: "Editor", email: "ed@test", role: "editor", tenantId: "default" },
    },
    isLoading: false,
    error: null,
    isSuccess: true,
  };
  return {
    fetchRuntimeConfigMock: vi.fn(),
    fetchSessionMock: vi.fn(),
    fetchSystemUsersMock: vi.fn().mockResolvedValue({ items: [] }),
    saveTemplateProfilesConfigMock: vi.fn(),
    navigateMock: vi.fn(),
    searchState: { query: "" },
    useSessionQueryMock: vi.fn(() => admin),
    adminSessionQueryResult: admin,
    editorSessionQueryResult: editor,
    restrictedEditorSessionQueryResult: {
      data: {
        authenticated: true as const,
        user: {
          id: "u3",
          name: "Editor",
          email: "ed2@test",
          role: "editor",
          tenantId: "default",
          allowedTemplateProfileIds: ["perfil-1"],
        },
      },
      isLoading: false,
      error: null,
      isSuccess: true,
    },
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
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
  fetchFontsCatalog: vi.fn().mockResolvedValue({ families: [] }),
  saveTemplateProfilesConfig: saveTemplateProfilesConfigMock,
  propagateTemplateProfile: vi.fn().mockResolvedValue({ updated: 0, skipped: 0, failed: 0 }),
}));

vi.mock("@/infrastructure/api/historyApi", () => ({
  fetchHistoryInvoices: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/infrastructure/api/gmailApi", () => ({
  fetchGmailProfiles: vi.fn().mockResolvedValue({ items: [], configured: false }),
  fetchGmailOAuthStartUrl: vi.fn().mockResolvedValue({ authUrl: "https://example.com/oauth" }),
}));

vi.mock("@/infrastructure/gmail/oauthPopup", () => ({
  openGmailOAuthPopupAndWait: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/infrastructure/api/sessionApi", () => ({
  fetchSession: fetchSessionMock,
}));

vi.mock("@/infrastructure/api/usersApi", () => ({
  fetchSystemUsers: (...args: unknown[]) => fetchSystemUsersMock(...args),
  upsertSystemUser: vi.fn().mockResolvedValue({
    id: "u1",
    name: "Admin",
    email: "admin@test",
    role: "admin",
    tenantId: "default",
    allowedTemplateProfileIds: [],
  }),
  deleteSystemUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/infrastructure/api/trashApi", () => ({
  fetchTrash: vi.fn().mockResolvedValue({
    items: [],
    groups: [],
    summary: { total: 0, totalGroups: 0, byCategory: {}, byFileType: {} },
  }),
  emptyTrash: vi.fn().mockResolvedValue(undefined),
  deleteTrashEntries: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/shared/hooks/useSessionQuery", () => ({
  SESSION_QUERY_KEY: ["session"],
  useSessionQuery: () => useSessionQueryMock(),
}));

describe("SettingsPage regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchState.query = "";
    fetchSystemUsersMock.mockResolvedValue({ items: [] });
    fetchSessionMock.mockResolvedValue({
      authenticated: true,
      user: { id: "u1", name: "Admin", email: "admin@test", role: "admin", tenantId: "default" },
    });
    useSessionQueryMock.mockReturnValue(adminSessionQueryResult);
  });

  it("shows system members UI alongside emitters list", async () => {
    fetchRuntimeConfigMock.mockResolvedValue({
      activeTemplateProfileId: "perfil-1",
      templateProfiles: [{ id: "perfil-1", label: "Perfil 1", defaults: { paymentMethod: "Transferencia" } }],
    });

    render(<SettingsPage />, { wrapper: createPageWrapper() });

    await screen.findByText(/Listado de emisores configurados/);
    expect(screen.getByText("Miembros del sistema")).toBeTruthy();
  });

  it("loads and saves active profile/defaults for admin", async () => {
    fetchRuntimeConfigMock.mockResolvedValue({
      activeTemplateProfileId: "perfil-1",
      defaults: { paymentMethod: "Transferencia", taxRate: 7, withholdingRate: 15 },
      templateProfiles: [
        {
          id: "perfil-1",
          label: "Perfil 1",
          defaults: { paymentMethod: "Transferencia", taxRate: 7, withholdingRate: 15 },
          business: { bankAccount: "ES11", brand: "Brand 1" },
          design: { layout: "pear" },
        },
        {
          id: "perfil-2",
          label: "Perfil 2",
          defaults: { paymentMethod: "Tarjeta", taxRate: 0, withholdingRate: 0 },
          business: { bankAccount: "ES22", brand: "Brand 2" },
          design: { layout: "editorial" },
        },
      ],
    });
    saveTemplateProfilesConfigMock.mockImplementation(async (payload) => payload);

    render(<SettingsPage />, { wrapper: createPageWrapper() });

    await screen.findByText(/Listado de emisores configurados/);

    await userEvent.click(within(screen.getByTestId("emitter-row-perfil-2")).getByRole("button", { name: "Editar" }));
    expect(searchState.query).toContain("templateProfileId=perfil-2");
    expect(screen.getByText(/Cambios locales pendientes de guardar/)).toBeTruthy();
    const advancedDetails = screen.getByText("Avanzado del usuario").closest("details");
    expect(advancedDetails).toBeTruthy();
    await userEvent.click(screen.getByText("Avanzado del usuario"));
    const paymentInput = within(advancedDetails as HTMLElement).getByPlaceholderText("Transferencia bancaria");
    await userEvent.clear(paymentInput);
    await userEvent.type(paymentInput, "Bizum");
    await userEvent.click(screen.getByRole("button", { name: "Guardar datos del emisor" }));

    await waitFor(() => {
      expect(saveTemplateProfilesConfigMock).toHaveBeenCalledTimes(1);
    });

    const payload = saveTemplateProfilesConfigMock.mock.calls[0]?.[0];
    expect(payload.activeTemplateProfileId).toBe("perfil-2");
    const editedProfile = payload.templateProfiles.find((profile: { id: string }) => profile.id === "perfil-2");
    expect(editedProfile?.defaults?.paymentMethod).toBe("Bizum");
  });

  it("does not show members section for editor", async () => {
    useSessionQueryMock.mockReturnValue(editorSessionQueryResult);
    fetchRuntimeConfigMock.mockResolvedValue({
      activeTemplateProfileId: "perfil-1",
      templateProfiles: [{ id: "perfil-1", label: "Perfil 1", defaults: { paymentMethod: "Transferencia" } }],
    });

    render(<SettingsPage />, { wrapper: createPageWrapper() });
    await screen.findByText(/Listado de emisores configurados/);
    expect(screen.queryByText("Miembros del sistema")).toBeNull();
  });

  it("hides emitter management actions for editor and does not call save API", async () => {
    useSessionQueryMock.mockReturnValue(editorSessionQueryResult);
    fetchRuntimeConfigMock.mockResolvedValue({
      activeTemplateProfileId: "perfil-1",
      templateProfiles: [{ id: "perfil-1", label: "Perfil 1", defaults: { paymentMethod: "Transferencia" } }],
    });
    saveTemplateProfilesConfigMock.mockImplementation(async (payload) => payload);

    render(<SettingsPage />, { wrapper: createPageWrapper() });
    await screen.findByText(/Listado de emisores configurados/);

    expect(screen.queryByRole("button", { name: "Nuevo emisor" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Borrar" })).toBeNull();
    expect(screen.getByTestId("emitter-row-perfil-1")).toBeTruthy();
    expect(saveTemplateProfilesConfigMock).not.toHaveBeenCalled();
  });

  it("lists all emitters for restricted editor but hides management actions on every row", async () => {
    useSessionQueryMock.mockReturnValue(restrictedEditorSessionQueryResult);
    fetchRuntimeConfigMock.mockResolvedValue({
      activeTemplateProfileId: "perfil-1",
      templateProfiles: [
        {
          id: "perfil-1",
          label: "Perfil 1",
          defaults: { paymentMethod: "Transferencia" },
        },
        {
          id: "perfil-2",
          label: "Perfil 2",
          defaults: { paymentMethod: "Tarjeta" },
        },
      ],
    });
    saveTemplateProfilesConfigMock.mockImplementation(async (payload) => payload);

    render(<SettingsPage />, { wrapper: createPageWrapper() });
    await screen.findByText(/Listado de emisores configurados/);

    expect(screen.getByTestId("emitter-row-perfil-1")).toBeTruthy();
    expect(screen.getByTestId("emitter-row-perfil-2")).toBeTruthy();

    expect(within(screen.getByTestId("emitter-row-perfil-1")).queryByRole("button", { name: "Editar" })).toBeNull();
    expect(within(screen.getByTestId("emitter-row-perfil-2")).queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Borrar" })).toBeNull();
    expect(saveTemplateProfilesConfigMock).not.toHaveBeenCalled();
  });

  it("explains auth failure on /api/config separately from read-only role", async () => {
    fetchRuntimeConfigMock.mockRejectedValue(new ApiError("No autorizado", 401));

    render(<SettingsPage />, { wrapper: createPageWrapper() });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("HTTP 401");
    expect(alert.textContent).toContain("GET /api/config");
    expect(alert.textContent).toContain("No autorizado");
    expect(alert.textContent).toContain("Modo solo lectura");
    expect(screen.queryByText("Emisor activo (servidor)")).toBeNull();
  });

  it("selects profile from templateProfileId in URL after config loads", async () => {
    searchState.query = "templateProfileId=perfil-2";
    fetchRuntimeConfigMock.mockResolvedValue({
      activeTemplateProfileId: "perfil-1",
      defaults: { paymentMethod: "Transferencia", taxRate: 7, withholdingRate: 15 },
      templateProfiles: [
        {
          id: "perfil-1",
          label: "Perfil 1",
          defaults: { paymentMethod: "Transferencia", taxRate: 7, withholdingRate: 15 },
          business: { bankAccount: "ES11", brand: "Brand 1" },
          design: { layout: "pear" },
        },
        {
          id: "perfil-2",
          label: "Perfil 2",
          defaults: { paymentMethod: "Tarjeta", taxRate: 0, withholdingRate: 0 },
          business: { bankAccount: "ES22", brand: "Brand 2" },
          design: { layout: "editorial" },
        },
      ],
    });

    render(<SettingsPage />, { wrapper: createPageWrapper() });

    await waitFor(() => {
      expect((screen.getByLabelText("Emisor") as HTMLSelectElement).value).toBe("perfil-2");
    });
    expect(screen.getByText(/Cambios locales pendientes de guardar/)).toBeTruthy();
  });

  it("creates new profile inline without window.prompt and persists on save", async () => {
    fetchRuntimeConfigMock.mockResolvedValue({
      activeTemplateProfileId: "perfil-1",
      defaults: { paymentMethod: "Transferencia", taxRate: 7, withholdingRate: 15 },
      templateProfiles: [
        {
          id: "perfil-1",
          label: "Perfil 1",
          invoiceNumberTag: "P1",
          defaults: { paymentMethod: "Transferencia", taxRate: 7, withholdingRate: 15 },
          business: { bankAccount: "ES11", brand: "Brand 1" },
          design: { layout: "pear" },
          colorKey: "teal",
        },
      ],
    });
    saveTemplateProfilesConfigMock.mockImplementation(async (payload) => payload);

    render(<SettingsPage />, { wrapper: createPageWrapper() });
    await screen.findByText(/Listado de emisores configurados/);

    await userEvent.click(screen.getByRole("button", { name: "Nuevo emisor" }));
    const inlineNameInput = await screen.findByLabelText("Nombre del nuevo emisor");
    await userEvent.clear(inlineNameInput);
    await userEvent.type(inlineNameInput, "Perfil Nuevo");
    await userEvent.click(screen.getByRole("button", { name: "Crear emisor" }));

    expect(screen.getByText(/Emisor nuevo en memoria/)).toBeTruthy();
    expect((screen.getByLabelText("Emisor") as HTMLSelectElement).value).toContain("perfil-nuevo");
    expect(searchState.query).toContain("templateProfileId=perfil-nuevo");

    await userEvent.click(screen.getByRole("button", { name: "Guardar datos del emisor" }));
    await waitFor(() => {
      expect(saveTemplateProfilesConfigMock).toHaveBeenCalledTimes(1);
    });
    const payload = saveTemplateProfilesConfigMock.mock.calls[0]?.[0];
    const nuevo = payload.templateProfiles.find(
      (profile: { id: string; label?: string }) => profile.id === "perfil-nuevo" && profile.label === "Perfil Nuevo",
    );
    expect(nuevo).toBeTruthy();
    expect(nuevo.invoiceNumberTag).not.toBe("P1");
    expect(nuevo.invoiceNumberTag).toBe("PERFI");
  });

  it("clones profile using merged draft (not stale server fields) and does not reuse source invoiceNumberTag", async () => {
    fetchRuntimeConfigMock.mockResolvedValue({
      activeTemplateProfileId: "perfil-1",
      defaults: { paymentMethod: "Transferencia", taxRate: 7, withholdingRate: 15 },
      templateProfiles: [
        {
          id: "perfil-1",
          label: "Perfil 1",
          invoiceNumberTag: "P1",
          defaults: { paymentMethod: "Transferencia", taxRate: 7, withholdingRate: 15 },
          business: { bankAccount: "ES11", brand: "Brand 1" },
          design: { layout: "pear" },
          colorKey: "teal",
        },
      ],
    });
    saveTemplateProfilesConfigMock.mockImplementation(async (payload) => payload);

    render(<SettingsPage />, { wrapper: createPageWrapper() });
    await screen.findByText(/Listado de emisores configurados/);
    await userEvent.click(within(screen.getByTestId("emitter-row-perfil-1")).getByRole("button", { name: "Editar" }));

    const advancedDetails = screen.getByText("Avanzado del usuario").closest("details");
    expect(advancedDetails).toBeTruthy();
    await userEvent.click(screen.getByText("Avanzado del usuario"));
    const paymentInput = within(advancedDetails as HTMLElement).getByPlaceholderText("Transferencia bancaria");
    await userEvent.clear(paymentInput);
    await userEvent.type(paymentInput, "Bizum");

    await userEvent.click(screen.getByRole("button", { name: "Nuevo emisor" }));
    await screen.findByLabelText("Nombre del nuevo emisor");
    await userEvent.click(screen.getByRole("button", { name: "Crear emisor" }));

    expect((screen.getByLabelText("Emisor") as HTMLSelectElement).value).toBe("perfil-1-copia");
    expect((within(advancedDetails as HTMLElement).getByPlaceholderText("Transferencia bancaria") as HTMLInputElement).value).toBe(
      "Bizum",
    );

    await userEvent.click(screen.getByRole("button", { name: "Guardar datos del emisor" }));
    await waitFor(() => {
      expect(saveTemplateProfilesConfigMock).toHaveBeenCalledTimes(1);
    });
    const payload = saveTemplateProfilesConfigMock.mock.calls[0]?.[0];
    const copia = payload.templateProfiles.find((p: { id: string }) => p.id === "perfil-1-copia");
    expect(copia?.defaults?.paymentMethod).toBe("Bizum");
    expect(copia?.invoiceNumberTag).not.toBe("P1");
    expect(copia?.invoiceNumberTag).toBe("PERFI");
  });
});
