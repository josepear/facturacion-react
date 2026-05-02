import type { PropsWithChildren } from "react";
import { useLayoutEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/features/auth/AuthContext";
import { getAuthToken } from "@/infrastructure/api/httpClient";
import { useSessionQuery } from "@/features/shared/hooks/useSessionQuery";

/**
 * Puerta de entrada: sin token → `/login`.
 * Con token: deja entrar a la app de inmediato (como legacy); `GET /api/session` valida después.
 * Mientras llega la sesión, banner no bloqueante; si falla o no autentica, vuelta a login.
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

  const showSessionBanner =
    !sessionQuery.data && !sessionQuery.error && (sessionQuery.isPending || sessionQuery.isLoading);

  return (
    <div className="min-h-screen">
      {showSessionBanner ? (
        <div
          className="border-b bg-muted/40 px-4 py-2 text-center text-xs text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          Sincronizando sesión con el servidor…
        </div>
      ) : null}
      {children}
    </div>
  );
}
