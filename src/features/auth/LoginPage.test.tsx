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
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  };
});

vi.mock("@/features/auth/AuthContext", () => ({
  AUTH_LOGOUT_EVENT: "facturacion-auth-logout",
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/shared/hooks/useSessionQuery", () => ({
  useSessionQuery: vi.fn(() => ({
    data: null,
    isSuccess: false,
    isError: false,
    isLoading: false,
    error: null,
  })),
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

  it("OAuth success with exchangeToken stores token and navigates to next", async () => {
    openGoogleLoginPopupAndWaitMock.mockResolvedValue({
      type: "success_exchange_token",
      exchangeToken: "exchange-token-123",
    });
    exchangeGoogleOAuthSessionMock.mockResolvedValue({ token: "internal-token-abc" });

    render(<LoginPage />);

    await userEvent.click(screen.getByRole("button", { name: "Entrar con Google" }));

    await waitFor(() => {
      expect(setAuthTokenMock).toHaveBeenCalledWith("internal-token-abc");
    });
    expect(exchangeGoogleOAuthSessionMock).toHaveBeenCalledWith({ exchangeToken: "exchange-token-123" });
    expect(navigateMock).toHaveBeenCalledWith("/historial", { replace: true });
  });

  it("falls back to code/state when exchangeToken is not available", async () => {
    openGoogleLoginPopupAndWaitMock.mockResolvedValue({
      type: "success_code_state",
      code: "code-123",
      state: "state-123",
    });
    exchangeGoogleOAuthSessionMock.mockResolvedValue({ token: "internal-token-fallback" });

    render(<LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: "Entrar con Google" }));

    await waitFor(() => {
      expect(setAuthTokenMock).toHaveBeenCalledWith("internal-token-fallback");
    });
    expect(exchangeGoogleOAuthSessionMock).toHaveBeenCalledWith({ code: "code-123", state: "state-123" });
  });

  it("shows unauthorized message on 403", async () => {
    openGoogleLoginPopupAndWaitMock.mockResolvedValue({
      type: "success_exchange_token",
      exchangeToken: "exchange-token-123",
    });
    exchangeGoogleOAuthSessionMock.mockRejectedValue(new ApiError("forbidden", 403));

    render(<LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: "Entrar con Google" }));

    expect(await screen.findByText("Tu cuenta Google no está autorizada.")).toBeTruthy();
    expect(setAuthTokenMock).not.toHaveBeenCalled();
  });

  it("shows expired/reused message on 409", async () => {
    openGoogleLoginPopupAndWaitMock.mockResolvedValue({
      type: "success_exchange_token",
      exchangeToken: "exchange-token-123",
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

  it("with token in /login redirects to /facturar when next is missing", async () => {
    getAuthTokenMock.mockReturnValue("token-123");
    searchState.query = "";
    render(<LoginPage />);
    expect(screen.getByTestId("navigate").getAttribute("data-to")).toBe("/facturar");
  });

  it("with token in /login redirects to next when valid next exists", async () => {
    getAuthTokenMock.mockReturnValue("token-123");
    searchState.query = "next=/gastos";
    render(<LoginPage />);
    expect(screen.getByTestId("navigate").getAttribute("data-to")).toBe("/gastos");
  });

  it("prevents double exchange on fast double click", async () => {
    let resolveStart!: (value: { url: string }) => void;
    const startPromise = new Promise<{ url: string }>((resolve) => {
      resolveStart = resolve;
    });
    getGoogleOAuthStartUrlMock.mockReturnValue(startPromise);
    openGoogleLoginPopupAndWaitMock.mockResolvedValue({ type: "success_exchange_token", exchangeToken: "exchange-token-once" });
    exchangeGoogleOAuthSessionMock.mockResolvedValue({ token: "internal-token-once" });

    render(<LoginPage />);
    const googleButton = screen.getByRole("button", { name: "Entrar con Google" });
    await userEvent.click(googleButton);
    await userEvent.click(googleButton);
    resolveStart({ url: "https://accounts.google.com/mock" });

    await waitFor(() => {
      expect(getGoogleOAuthStartUrlMock).toHaveBeenCalledTimes(1);
      expect(openGoogleLoginPopupAndWaitMock).toHaveBeenCalledTimes(1);
      expect(exchangeGoogleOAuthSessionMock).toHaveBeenCalledTimes(1);
    });
    expect(exchangeGoogleOAuthSessionMock).toHaveBeenCalledWith({ exchangeToken: "exchange-token-once" });
  });

  it("prevents duplicate exchange when popup result arrives late", async () => {
    let resolvePopup: ((value: { type: "success_exchange_token"; exchangeToken: string }) => void) | undefined;
    openGoogleLoginPopupAndWaitMock.mockImplementation(
      () =>
        new Promise<{ type: "success_exchange_token"; exchangeToken: string }>((resolve) => {
          resolvePopup = resolve;
        }),
    );
    exchangeGoogleOAuthSessionMock.mockResolvedValue({ token: "internal-token-late" });

    render(<LoginPage />);
    const googleButton = screen.getByRole("button", { name: "Entrar con Google" });
    await userEvent.click(googleButton);
    await userEvent.click(googleButton);

    expect(exchangeGoogleOAuthSessionMock).not.toHaveBeenCalled();
    if (resolvePopup) {
      resolvePopup({ type: "success_exchange_token", exchangeToken: "exchange-token-late" });
    }

    await waitFor(() => {
      expect(openGoogleLoginPopupAndWaitMock).toHaveBeenCalledTimes(1);
      expect(exchangeGoogleOAuthSessionMock).toHaveBeenCalledTimes(1);
    });
    expect(exchangeGoogleOAuthSessionMock).toHaveBeenCalledWith({ exchangeToken: "exchange-token-late" });
  });

  it("consumes logged_out query flag once and cleans URL state", async () => {
    searchState.query = "logged_out=1&next=/historial";
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    render(<LoginPage />);

    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    });
  });
});
