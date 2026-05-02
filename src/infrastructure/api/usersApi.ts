import { request } from "@/infrastructure/api/httpClient";

export type SystemUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  allowedTemplateProfileIds: string[];
};

export type UpsertUserInput = {
  id?: string;
  email: string;
  name: string;
  password?: string;
  role: string;
  allowedTemplateProfileIds: string[];
};

export async function fetchSystemUsers(): Promise<{ items: SystemUser[] }> {
  return request<{ items: SystemUser[] }>("/api/users");
}

export async function upsertSystemUser(user: UpsertUserInput): Promise<SystemUser> {
  return request<SystemUser>("/api/users", {
    method: "POST",
    body: { user },
  });
}

export async function deleteSystemUser(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/users/delete", {
    method: "POST",
    body: { id },
  });
}
