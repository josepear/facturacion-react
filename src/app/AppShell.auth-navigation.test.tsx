import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/app/AppShell";

const { navigateMock, logoutMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  logoutMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ pathname: "/facturar", search: "" }),
    Outlet: () => <div>outlet</div>,
    NavLink: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({ authVersion: 0, logout: logoutMock }),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock("@/infrastructure/api/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/infrastructure/api/httpClient")>("@/infrastructure/api/httpClient");
  return {
    ...actual,
    getAuthToken: () => "token-123",
  };
});

vi.mock("@/infrastructure/wizardFirstUseStorage", () => ({
  hasFirstUseWizardBeenDismissed: () => true,
  markFirstUseWizardDismissed: vi.fn(),
}));

describe("AppShell logout navigation policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("logout clears session and navigates to /login", async () => {
    render(<AppShell />);
    await userEvent.click(screen.getByLabelText("Cerrar sesión"));
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith("/login", { replace: true });
  });
});
