import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SettingsPage } from "@/features/settings/pages/SettingsPage";

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

    await screen.findByText("Perfil activo");

    const comboboxes = screen.getAllByRole("combobox");
    await userEvent.selectOptions(comboboxes[0]!, "perfil-2");
    await userEvent.clear(screen.getByPlaceholderText("Forma de pago default"));
    await userEvent.type(screen.getByPlaceholderText("Forma de pago default"), "Bizum");
    await userEvent.click(screen.getByRole("button", { name: "Guardar configuración" }));

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
    await screen.findByText("Perfil activo");

    expect(screen.getByRole("button", { name: "Guardar configuración" }).hasAttribute("disabled")).toBe(true);
  });
});

