import { request } from "@/infrastructure/api/httpClient";

import type { ClientRecord } from "@/domain/document/types";

type ClientsResponse = {
  clients?: ClientRecord[];
};

export async function fetchClients() {
  const payload = await request<ClientsResponse>("/api/clients");
  return payload.clients ?? [];
}
