import type { SessionResponse } from "@/domain/session/types";
import { request } from "@/infrastructure/api/httpClient";

export async function fetchSession(): Promise<SessionResponse> {
  return request<SessionResponse>("/api/session");
}
