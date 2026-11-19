import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DesignPage } from "@/features/design/pages/DesignPage";
import { createPageWrapper } from "@/test/test-utils";

const { fetchRuntimeConfigMock, fetchDesignPreviewBlobMock, saveTemplateProfilesConfigMock, useSessionQueryMock } =
  vi.hoisted(() => {
    const admin = {
      data: {
        authenticated: true as const,
        user: { id: "u1", name: "Admin", email: "admin@test", role: "admin", tenantId: "default" },
      },
      isLoading: false,
      error: null,
      isSuccess: true,
    };
    return {
      fetchRuntimeConfigMock: vi.fn(),
      fetchDesignPreviewBlobMock: vi.fn(),
      saveTemplateProfilesConfigMock: vi.fn(),
      useSessionQueryMock: vi.fn(() => admin),
    };
  });

vi.mock("@/infrastructure/api/documentsApi", () => ({
  fetchRuntimeConfig: fetchRuntimeConfigMock,
  fetchFontsCatalog: vi.fn().mockResolvedValue({ families: ["Manrope"] }),
  fetchDesignPreviewBlob: fetchDesignPreviewBlobMock,
  saveTemplateProfilesConfig: saveTemplateProfilesConfigMock,
}));

vi.mock("@/features/shared/hooks/useSessionQuery", () => ({
  SESSION_QUERY_KEY: ["session"],
  useSessionQuery: () => useSessionQueryMock(),
}));

const baseConfig = {
  activeTemplateProfileId: "perfil-1",
  templateProfiles: [
    {
      id: "perfil-1",
      label: "Perfil 1",
      business: { brand: "Pear&co." },
      defaults: { paymentMethod: "Transferencia" },
      design: { layout: "pear", accentColor: "#ec1e63" },
    },
  ],
};

describe("DesignPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchRuntimeConfigMock.mockResolvedValue(baseConfig);
    fetchDesignPreviewBlobMock.mockResolvedValue(new Blob(["<html></html>"], { type: "text/html" }));
    saveTemplateProfilesConfigMock.mockResolvedValue(baseConfig);

    globalThis.URL.createObjectURL = vi.fn(() => "blob:design-preview");
    globalThis.URL.revokeObjectURL = vi.fn();
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  it("muestra el aviso de guardar solo cuando hay cambios y guarda el diseño de factura", async () => {
    const user = userEvent.setup();
    render(<DesignPage />, { wrapper: createPageWrapper() });

    const saveButton = (await screen.findByRole("button", { name: "Guardar diseño" })) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    const accent = screen.getByLabelText("Hex Acento");
    await user.clear(accent);
    await user.type(accent, "#123456");

    await waitFor(() => expect(saveButton.disabled).toBe(false));
    await user.click(saveButton);

    await waitFor(() => expect(saveTemplateProfilesConfigMock).toHaveBeenCalledTimes(1));
    const payload = saveTemplateProfilesConfigMock.mock.calls.at(-1)?.[0] as {
      activeTemplateProfileId: string;
      templateProfiles: Array<Record<string, unknown>>;
    };
    expect(payload.activeTemplateProfileId).toBe("perfil-1");
    const profile = payload.templateProfiles[0] as {
      design?: { accentColor?: string; layout?: string };
      business?: { brand?: string };
    };
    expect(profile.design?.accentColor).toBe("#123456");
    expect(profile.design?.layout).toBe("pear");
    expect(profile.business?.brand).toBe("Pear&co.");
  });

  it("guarda el diseño de presupuesto en su propio hueco (designPresupuesto)", async () => {
    const user = userEvent.setup();
    render(<DesignPage />, { wrapper: createPageWrapper() });

    await user.click(await screen.findByRole("radio", { name: "Presupuesto" }));

    const accent = screen.getByLabelText("Hex Acento");
    await user.clear(accent);
    await user.type(accent, "#ABCDEF");

    const saveButton = screen.getByRole("button", { name: "Guardar diseño" });
    await waitFor(() => expect((saveButton as HTMLButtonElement).disabled).toBe(false));
    await user.click(saveButton);

    await waitFor(() => expect(saveTemplateProfilesConfigMock).toHaveBeenCalledTimes(1));
    const payload = saveTemplateProfilesConfigMock.mock.calls.at(-1)?.[0] as {
      templateProfiles: Array<Record<string, unknown>>;
    };
    const profile = payload.templateProfiles[0] as {
      design?: { accentColor?: string };
      designPresupuesto?: { accentColor?: string };
    };
    expect(profile.designPresupuesto?.accentColor).toBe("#ABCDEF");
    // El diseño de factura guardado no se toca al editar presupuesto.
    expect(profile.design?.accentColor).toBe("#ec1e63");
  });

  it("pide la vista previa con el diseño del borrador (sin guardar)", async () => {
    const user = userEvent.setup();
    render(<DesignPage />, { wrapper: createPageWrapper() });

    const accent = await screen.findByLabelText("Hex Acento");
    await user.clear(accent);
    await user.type(accent, "#010203");

    await waitFor(() => expect(fetchDesignPreviewBlobMock).toHaveBeenCalled());
    const lastCall = fetchDesignPreviewBlobMock.mock.calls.at(-1)?.[0] as {
      document: { design: { accentColor: string } };
      businessOverride: { footerUrl: string };
    };
    expect(lastCall.document.design.accentColor).toBe("#010203");
  });

  it("restablece el estilo base sin tocar los textos de emisor", async () => {
    const user = userEvent.setup();
    render(<DesignPage />, { wrapper: createPageWrapper() });

    await user.click(await screen.findByRole("button", { name: "Estilo base" }));
    const accent = screen.getByLabelText("Hex Acento") as HTMLInputElement;
    expect(accent.value).toBe("#ec1e63");
  });
});
