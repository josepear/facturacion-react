import type { PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/features/auth/AuthContext";
import { getAuthToken } from "@/infrastructure/api/httpClient";
import { useSessionQuery } from "@/features/shared/hooks/useSessionQuery";

/**
 * Puerta de entrada: sin token → `/login`; con token → espera a `GET /api/session` válida.
 */
export function RequireAuth({ children }: PropsWithChildren) {
  const { authVersion } = useAuth();
  void authVersion;
  const location = useLocation();
  const token = getAuthToken();
  const sessionQuery = useSessionQuery();

  if (!token) {
    const next = `${location.pathname}${location.search}`;
    const qs = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
    return <Navigate to={`/login${qs}`} replace />;
  }

  if (sessionQuery.isLoading && !sessionQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Comprobando sesión…</p>
      </div>
    );
  }

  if (sessionQuery.error) {
    return <Navigate to="/login" replace />;
  }

  const data = sessionQuery.data;
  if (!data?.authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
