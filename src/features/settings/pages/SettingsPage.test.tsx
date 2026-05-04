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

  it("shows members API unavailable help and copies diagnostic on 404", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...globalThis.navigator, clipboard: { writeText } });

    fetchSystemUsersMock.mockReset();
    fetchSystemUsersMock.mockImplementation(() => Promise.reject(new ApiError("Not Found", 404)));
    fetchRuntimeConfigMock.mockResolvedValue({
      activeTemplateProfileId: "perfil-1",
      templateProfiles: [{ id: "perfil-1", label: "Perfil 1", defaults: { paymentMethod: "Transferencia" } }],
    });

    try {
      render(<SettingsPage />, { wrapper: createPageWrapper() });

      await screen.findByText("Miembros del sistema");
      await waitFor(() => expect(fetchSystemUsersMock).toHaveBeenCalled());
      expect(await screen.findByText("Gestión de miembros no disponible en este servidor")).toBeTruthy();
      expect(screen.getByText(/Este entorno no expone/)).toBeTruthy();
      expect(screen.getByText(/facturacion\.config\.json/)).toBeTruthy();

      await userEvent.click(screen.getByRole("button", { name: "Copiar diagnóstico" }));
      await waitFor(() => {
        expect(writeText).toHaveBeenCalledTimes(1);
      });
      const copied = String(writeText.mock.calls[0]?.[0] ?? "");
      expect(copied).toMatch(/^API miembros no disponible: GET \/api\/users -> 404 en /);
      expect(await screen.findByText("Diagnóstico copiado al portapapeles.")).toBeTruthy();
    } finally {
      vi.unstubAllGlobals();
    }
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

    await screen.findByText("Emisor activo (servidor)");

    await userEvent.selectOptions(screen.getByLabelText("Emisor"), "perfil-2");
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

  it("lets editors save emitter changes but not create new emitters", async () => {
    useSessionQueryMock.mockReturnValue(editorSessionQueryResult);
    fetchRuntimeConfigMock.mockResolvedValue({
      activeTemplateProfileId: "perfil-1",
      templateProfiles: [{ id: "perfil-1", label: "Perfil 1", defaults: { paymentMethod: "Transferencia" } }],
    });
    saveTemplateProfilesConfigMock.mockImplementation(async (payload) => payload);

    render(<SettingsPage />, { wrapper: createPageWrapper() });
    await screen.findByText("Emisor activo (servidor)");

    expect(screen.queryByText("Modo solo lectura")).toBeNull();
    expect(screen.getByText(/Rol editor/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Guardar datos del emisor" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "Nuevo emisor" }).hasAttribute("disabled")).toBe(true);

    const advancedDetails = screen.getByText("Avanzado del usuario").closest("details");
    expect(advancedDetails).toBeTruthy();
    await userEvent.click(screen.getByText("Avanzado del usuario"));
    const paymentInput = within(advancedDetails as HTMLElement).getByPlaceholderText("Transferencia bancaria");
    await userEvent.clear(paymentInput);
    await userEvent.type(paymentInput, "Tarjeta");
    await userEvent.click(screen.getByRole("button", { name: "Guardar datos del emisor" }));

    await waitFor(() => {
      expect(saveTemplateProfilesConfigMock).toHaveBeenCalledTimes(1);
    });
    const payload = saveTemplateProfilesConfigMock.mock.calls[0]?.[0];
    expect(payload.templateProfiles[0]?.defaults?.paymentMethod).toBe("Tarjeta");
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
    await screen.findByText("Emisor activo (servidor)");

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
    await screen.findByText("Emisor activo (servidor)");

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
