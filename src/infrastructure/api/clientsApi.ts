import { request } from "@/infrastructure/api/httpClient";

import type { ClientRecord } from "@/domain/document/types";

type ClientsResponse = {
  items?: ClientRecord[];
  clients?: ClientRecord[];
};

export async function fetchClients() {
  const payload = await request<ClientsResponse>("/api/clients");
  return payload.items ?? payload.clients ?? [];
}
