import type { PropsWithChildren } from "react";
import { useLayoutEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/features/auth/AuthContext";
import { getAuthToken } from "@/infrastructure/api/httpClient";
import { useSessionQuery } from "@/features/shared/hooks/useSessionQuery";

/**
 * Token-first: con token se renderiza el shell al instante; `GET /api/session` corre en background.
 * Si 401 / `authenticated: false` / error de sesión → limpiar y volver a `/login` (fallback acotado).
 */
export function RequireAuth({ children }: PropsWithChildren) {
  const { authVersion, logout } = useAuth();
  void authVersion;
  const location = useLocation();
  const token = getAuthToken();
  const sessionQuery = useSessionQuery();

  useLayoutEffect(() => {
    const data = sessionQuery.data;
    if (sessionQuery.isSuccess && data && !data.authenticated) {
      logout();
    }
  }, [sessionQuery.isSuccess, sessionQuery.data, logout]);

  if (!token) {
    const next = `${location.pathname}${location.search}`;
    const qs = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
    return <Navigate to={`/login${qs}`} replace />;
  }

  if (sessionQuery.isError) {
    return <Navigate to="/login" replace />;
  }

  if (sessionQuery.isSuccess && sessionQuery.data && !sessionQuery.data.authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
