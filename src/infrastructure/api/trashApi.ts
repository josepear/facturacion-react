import { request } from "@/infrastructure/api/httpClient";

export type TrashCategory = "documentos" | "gastos" | "clientes" | "otros";
export type TrashFileType = "json" | "html" | "pdf" | "other";

export type TrashItem = {
  path: string;
  category: TrashCategory;
  fileType: TrashFileType;
};

export type TrashSummary = {
  total: number;
  totalGroups: number;
  byCategory: Record<string, number>;
  byFileType: Record<string, number>;
};

export type TrashResponse = {
  items: TrashItem[];
  groups: unknown[];
  summary: TrashSummary;
};

export async function fetchTrash() {
  return request<TrashResponse>("/api/trash");
}

export async function emptyTrash() {
  return request<{ ok: boolean; removedEntries: number }>("/api/trash/empty", {
    method: "POST",
  });
}

export async function deleteTrashEntries(paths: string[]) {
  return request<{ ok: boolean; removedEntries?: number }>("/api/trash/delete", {
    method: "POST",
    body: { paths },
  });
}
