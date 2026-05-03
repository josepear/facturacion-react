import type { PropsWithChildren } from "react";
import { useLayoutEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/features/auth/AuthContext";
import { ApiError, getAuthToken } from "@/infrastructure/api/httpClient";
import { useSessionQuery } from "@/features/shared/hooks/useSessionQuery";

/**
 * Token-first: con token se renderiza el shell al instante; `GET /api/session` corre en background.
 * Solo ante **401** o `authenticated: false` se fuerza login. Errores de red o 5xx tras reinicio del
 * servidor no deben expulsar al usuario (React Query reintenta sesión).
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
    const err = sessionQuery.error;
    if (err instanceof ApiError && err.status === 401) {
      return <Navigate to="/login" replace />;
    }
  }

  if (sessionQuery.isSuccess && sessionQuery.data && !sessionQuery.data.authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
