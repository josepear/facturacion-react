import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { ApiError } from "@/infrastructure/api/httpClient";

const { fetchRuntimeConfigMock, fetchSessionMock, saveTemplateProfilesConfigMock, navigateMock, searchState } = vi.hoisted(
  () => ({
    fetchRuntimeConfigMock: vi.fn(),
    fetchSessionMock: vi.fn(),
    saveTemplateProfilesConfigMock: vi.fn(),
    navigateMock: vi.fn(),
    searchState: { query: "" },
  }),
);

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
  saveTemplateProfilesConfig: saveTemplateProfilesConfigMock,
}));

vi.mock("@/infrastructure/api/sessionApi", () => ({
  fetchSession: fetchSessionMock,
}));

describe("SettingsPage regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchState.query = "";
    fetchSessionMock.mockResolvedValue({
      authenticated: true,
      user: { id: "u1", name: "Admin", email: "admin@test", role: "admin", tenantId: "default" },
    });
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

    render(<SettingsPage />);

    await screen.findByText("Perfil activo (servidor)");

    await userEvent.selectOptions(screen.getByLabelText("Plantilla de emisor"), "perfil-2");
    expect(searchState.query).toContain("templateProfileId=perfil-2");
    expect(screen.getByText(/Cambios locales pendientes de guardar/)).toBeTruthy();
    const paymentInput = screen.getByPlaceholderText("Transferencia bancaria");
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

  it("keeps readonly mode for non-admin users", async () => {
    fetchSessionMock.mockResolvedValue({
      authenticated: true,
      user: { id: "u2", name: "Editor", email: "ed@test", role: "editor", tenantId: "default" },
    });
    fetchRuntimeConfigMock.mockResolvedValue({
      activeTemplateProfileId: "perfil-1",
      templateProfiles: [{ id: "perfil-1", label: "Perfil 1", defaults: { paymentMethod: "Transferencia" } }],
    });

    render(<SettingsPage />);
    await screen.findByText("Perfil activo (servidor)");

    const readOnlyBanner = screen.getByRole("status");
    expect(readOnlyBanner.textContent).toContain("Modo solo lectura");
    expect(readOnlyBanner.textContent).toContain("editor");
    expect(screen.getByRole("button", { name: "Guardar datos del emisor" }).hasAttribute("disabled")).toBe(true);
  });

  it("explains auth failure on /api/config separately from read-only role", async () => {
    fetchRuntimeConfigMock.mockRejectedValue(new ApiError("No autorizado", 401));

    render(<SettingsPage />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("HTTP 401");
    expect(alert.textContent).toContain("GET /api/config");
    expect(alert.textContent).toContain("No autorizado");
    expect(alert.textContent).toContain("Modo solo lectura");
    expect(screen.queryByText("Perfil activo (servidor)")).toBeNull();
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

    render(<SettingsPage />);

    await waitFor(() => {
      expect((screen.getByLabelText("Plantilla de emisor") as HTMLSelectElement).value).toBe("perfil-2");
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

    render(<SettingsPage />);
    await screen.findByText("Perfil activo (servidor)");

    await userEvent.click(screen.getByRole("button", { name: "Nuevo usuario" }));
    const inlineNameInput = await screen.findByLabelText("Nombre del nuevo perfil");
    await userEvent.clear(inlineNameInput);
    await userEvent.type(inlineNameInput, "Perfil Nuevo");
    await userEvent.click(screen.getByRole("button", { name: "Crear perfil" }));

    expect(screen.getByText(/Perfil nuevo en memoria/)).toBeTruthy();
    expect((screen.getByLabelText("Plantilla de emisor") as HTMLSelectElement).value).toContain("perfil-nuevo");
    expect(searchState.query).toContain("templateProfileId=perfil-nuevo");

    await userEvent.click(screen.getByRole("button", { name: "Guardar datos del emisor" }));
    await waitFor(() => {
      expect(saveTemplateProfilesConfigMock).toHaveBeenCalledTimes(1);
    });
    const payload = saveTemplateProfilesConfigMock.mock.calls[0]?.[0];
    expect(payload.templateProfiles.some((profile: { id: string; label?: string }) => profile.id === "perfil-nuevo" && profile.label === "Perfil Nuevo")).toBe(true);
  });
});

