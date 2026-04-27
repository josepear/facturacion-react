import { request } from "@/infrastructure/api/httpClient";

export type TrashItem = {
  path: string;
  category: "documentos" | "gastos" | "clientes" | "otros";
  fileType: string;
};

type TrashResponse = {
  items?: TrashItem[];
  groups?: Array<{
    id: string;
    dir: string;
    stem: string;
    category: string;
    members: Array<{ path: string; fileType: string }>;
  }>;
  summary?: {
    total?: number;
    totalGroups?: number;
    byCategory?: Record<string, number>;
    byFileType?: Record<string, number>;
  };
};

export async function fetchTrash() {
  return request<TrashResponse>("/api/trash");
}

export async function deleteTrashEntries(paths: string[]) {
  return request<{ ok: boolean; removedEntries?: number }>("/api/trash/delete", {
    method: "POST",
    body: { paths },
  });
}

