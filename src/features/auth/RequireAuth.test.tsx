import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RequireAuth } from "@/features/auth/RequireAuth";

const { getAuthTokenMock, useSessionQueryMock, useAuthMock, locationState } = vi.hoisted(() => ({
  getAuthTokenMock: vi.fn(() => ""),
  useSessionQueryMock: vi.fn(() => ({
    data: null,
    isSuccess: false,
    isError: false,
    error: null,
  })),
  useAuthMock: vi.fn(() => ({
    authVersion: 0,
    logout: vi.fn(),
  })),
  locationState: { pathname: "/historial", search: "?f=1" },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useLocation: () => locationState,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  };
});

vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/shared/hooks/useSessionQuery", () => ({
  useSessionQuery: () => useSessionQueryMock(),
}));

vi.mock("@/infrastructure/api/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/infrastructure/api/httpClient")>("@/infrastructure/api/httpClient");
  return {
    ...actual,
    getAuthToken: () => getAuthTokenMock(),
  };
});

describe("RequireAuth navigation policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthTokenMock.mockReturnValue("");
    locationState.pathname = "/historial";
    locationState.search = "?f=1";
    useSessionQueryMock.mockReturnValue({
      data: null,
      isSuccess: false,
      isError: false,
      error: null,
    } as never);
  });

  it("without token redirects to /login with valid next", () => {
    render(
      <RequireAuth>
        <div>private</div>
      </RequireAuth>,
    );
    expect(screen.getByTestId("navigate").getAttribute("data-to")).toBe("/login?next=%2Fhistorial%3Ff%3D1");
  });

  it("with token and valid session keeps current route (renders children)", () => {
    getAuthTokenMock.mockReturnValue("token-123");
    useSessionQueryMock.mockReturnValue({
      data: { authenticated: true, user: { id: "u1" } },
      isSuccess: true,
      isError: false,
      error: null,
    } as never);
    render(
      <RequireAuth>
        <div>private</div>
      </RequireAuth>,
    );
    expect(screen.getByText("private")).toBeTruthy();
  });
});
