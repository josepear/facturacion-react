import { useQuery } from "@tanstack/react-query";

import { fetchSession } from "@/infrastructure/api/sessionApi";

/** Misma clave en toda la app para deduplicar `GET /api/session` vía React Query. */
export const SESSION_QUERY_KEY = ["session"] as const;

export function useSessionQuery() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
  });
}
