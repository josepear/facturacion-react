import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { ApiError } from "@/infrastructure/api/httpClient";

const { fetchRuntimeConfigMock, saveTemplateProfilesConfigMock, navigateMock } = vi.hoisted(() => ({
  fetchRuntimeConfigMock: vi.fn(),
  saveTemplateProfilesConfigMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/infrastructure/api/documentsApi", () => ({
  fetchRuntimeConfig: fetchRuntimeConfigMock,
  saveTemplateProfilesConfig: saveTemplateProfilesConfigMock,
}));

describe("SettingsPage regression", () => {
  it("loads and saves active profile/defaults for admin", async () => {
    fetchRuntimeConfigMock.mockResolvedValue({
      activeTemplateProfileId: "perfil-1",
      currentUser: { role: "admin", tenantId: "default" },
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
    fetchRuntimeConfigMock.mockResolvedValue({
      activeTemplateProfileId: "perfil-1",
      currentUser: { role: "viewer", tenantId: "default" },
      templateProfiles: [{ id: "perfil-1", label: "Perfil 1", defaults: { paymentMethod: "Transferencia" } }],
    });

    render(<SettingsPage />);
    await screen.findByText("Perfil activo (servidor)");

    const readOnlyBanner = screen.getByRole("status");
    expect(readOnlyBanner.textContent).toContain("Modo solo lectura");
    expect(readOnlyBanner.textContent).toContain("viewer");
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
});

