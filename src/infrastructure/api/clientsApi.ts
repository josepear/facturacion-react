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

type SaveClientInput = {
  client: ClientRecord;
  recordId?: string;
};

export async function saveClient(input: SaveClientInput) {
  return request<ClientRecord & { recordId?: string }>("/api/clients", {
    method: "POST",
    body: {
      recordId: input.recordId,
      client: input.client,
    },
  });
}
