import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useAuth } from "@/features/auth/AuthContext";
import { SESSION_QUERY_KEY } from "@/features/auth/sessionQueryKey";
import { ApiError, clearAuthToken, getAuthToken } from "@/infrastructure/api/httpClient";
import { fetchSession } from "@/infrastructure/api/sessionApi";

export { SESSION_QUERY_KEY } from "@/features/auth/sessionQueryKey";

/**
 * Sesión vía `GET /api/session` (Bearer). La clave incluye `authVersion` para refetch tras login/logout.
 * 401 o respuesta `authenticated: false` limpian el token (vía `clearAuthToken`).
 */
export function useSessionQuery() {
  const { authVersion } = useAuth();
  const queryClient = useQueryClient();
  const hasToken = Boolean(getAuthToken());

  const sessionQuery = useQuery({
    queryKey: [...SESSION_QUERY_KEY, authVersion] as const,
    queryFn: fetchSession,
    enabled: hasToken,
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!hasToken) {
      return;
    }
    const err = sessionQuery.error;
    if (err instanceof ApiError && err.status === 401) {
      clearAuthToken();
      queryClient.removeQueries({ queryKey: [...SESSION_QUERY_KEY] });
    }
  }, [hasToken, sessionQuery.error, queryClient]);

  useEffect(() => {
    if (!hasToken) {
      return;
    }
    const data = sessionQuery.data;
    if (sessionQuery.isSuccess && data && data.authenticated === false) {
      clearAuthToken();
      queryClient.removeQueries({ queryKey: [...SESSION_QUERY_KEY] });
    }
  }, [hasToken, sessionQuery.isSuccess, sessionQuery.data, queryClient]);

  return sessionQuery;
}
