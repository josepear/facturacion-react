export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId?: string;
};

export type SessionResponse =
  | { authenticated: true; user: SessionUser }
  | { authenticated: false; user: null };
