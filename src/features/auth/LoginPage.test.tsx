import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "@/features/auth/LoginPage";
import { ApiError } from "@/infrastructure/api/httpClient";

const {
  navigateMock,
  searchState,
  useAuthMock,
  getAuthTokenMock,
  setAuthTokenMock,
  getGoogleOAuthStartUrlMock,
  openGoogleLoginPopupAndWaitMock,
  exchangeGoogleOAuthSessionMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  searchState: { query: "next=/historial" },
  useAuthMock: vi.fn(() => ({
    authVersion: 0,
    login: vi.fn(),
    loginError: null,
    clearLoginError: vi.fn(),
    isLoginPending: false,
    logout: vi.fn(),
  })),
  getAuthTokenMock: vi.fn(() => ""),
  setAuthTokenMock: vi.fn(),
  getGoogleOAuthStartUrlMock: vi.fn(),
  openGoogleLoginPopupAndWaitMock: vi.fn(),
  exchangeGoogleOAuthSessionMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useSearchParams: () => [new URLSearchParams(searchState.query), vi.fn()],
  };
});

vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/shared/hooks/useSessionQuery", () => ({
  useSessionQuery: vi.fn(),
  SESSION_QUERY_KEY: ["session"],
}));

vi.mock("@/infrastructure/api/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/infrastructure/api/httpClient")>("@/infrastructure/api/httpClient");
  return {
    ...actual,
    getAuthToken: () => getAuthTokenMock(),
    setAuthToken: (...args: unknown[]) => setAuthTokenMock(...args),
  };
});

vi.mock("@/infrastructure/api/authApi", () => ({
  loginWithPassword: vi.fn(),
  getGoogleOAuthStartUrl: (...args: unknown[]) => getGoogleOAuthStartUrlMock(...args),
  exchangeGoogleOAuthSession: (...args: unknown[]) => exchangeGoogleOAuthSessionMock(...args),
}));

vi.mock("@/infrastructure/auth/googleLoginPopup", () => ({
  openGoogleLoginPopupAndWait: (...args: unknown[]) => openGoogleLoginPopupAndWaitMock(...args),
}));

describe("LoginPage OAuth Google", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchState.query = "next=/historial";
    getAuthTokenMock.mockReturnValue("");
    getGoogleOAuthStartUrlMock.mockResolvedValue({ url: "https://accounts.google.com/mock" });
  });

  it("OAuth success stores token and navigates to next", async () => {
    openGoogleLoginPopupAndWaitMock.mockResolvedValue({
      type: "success",
      code: "code-123",
      state: "state-123",
    });
    exchangeGoogleOAuthSessionMock.mockResolvedValue({ token: "internal-token-abc" });

    render(<LoginPage />);

    await userEvent.click(screen.getByRole("button", { name: "Entrar con Google" }));

    await waitFor(() => {
      expect(setAuthTokenMock).toHaveBeenCalledWith("internal-token-abc");
    });
    expect(exchangeGoogleOAuthSessionMock).toHaveBeenCalledWith({ code: "code-123", state: "state-123" });
    expect(navigateMock).toHaveBeenCalledWith("/historial", { replace: true });
  });

  it("shows unauthorized message on 403", async () => {
    openGoogleLoginPopupAndWaitMock.mockResolvedValue({
      type: "success",
      code: "code-123",
      state: "state-123",
    });
    exchangeGoogleOAuthSessionMock.mockRejectedValue(new ApiError("forbidden", 403));

    render(<LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: "Entrar con Google" }));

    expect(await screen.findByText("Tu cuenta Google no está autorizada en este sistema.")).toBeTruthy();
    expect(setAuthTokenMock).not.toHaveBeenCalled();
  });

  it("shows expired/reused message on 409", async () => {
    openGoogleLoginPopupAndWaitMock.mockResolvedValue({
      type: "success",
      code: "code-123",
      state: "state-123",
    });
    exchangeGoogleOAuthSessionMock.mockRejectedValue(new ApiError("conflict", 409));

    render(<LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: "Entrar con Google" }));

    expect(await screen.findByText("La sesión OAuth caducó o ya fue usada. Inténtalo de nuevo.")).toBeTruthy();
    expect(setAuthTokenMock).not.toHaveBeenCalled();
  });

  it("shows non-blocking message on popup cancel", async () => {
    openGoogleLoginPopupAndWaitMock.mockResolvedValue({ type: "cancelled" });

    render(<LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: "Entrar con Google" }));

    expect(await screen.findByText("Inicio con Google cancelado.")).toBeTruthy();
    expect(exchangeGoogleOAuthSessionMock).not.toHaveBeenCalled();
    expect(setAuthTokenMock).not.toHaveBeenCalled();
  });
});
