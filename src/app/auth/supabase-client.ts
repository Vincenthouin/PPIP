import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../../utils/supabase/info";

export const SERVER_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3775ce8a`;

let client: SupabaseClient | null = null;
export const supabase = (): SupabaseClient => {
  if (!client) {
    client = createClient(
      `https://${projectId}.supabase.co`,
      publicAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storage: typeof window !== "undefined" ? window.localStorage : undefined,
        },
      },
    );
  }
  return client;
};

export type Role = "admin" | "editor" | "viewer";

export interface Me {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  lastSignInAt: string | null;
}

const jsonHeaders = (token?: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token ?? publicAnonKey}`,
});

const handle = async (res: Response) => {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const msg = body?.error ?? `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return body;
};

export const apiSignup = async (
  email: string,
  password: string,
  name: string,
) => {
  const res = await fetch(`${SERVER_BASE}/signup`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ email, password, name }),
  });
  return handle(res);
};

export const apiMe = async (token: string): Promise<Me> => {
  const res = await fetch(`${SERVER_BASE}/me`, {
    headers: jsonHeaders(token),
  });
  return handle(res);
};

export const apiListUsers = async (token: string): Promise<{ users: AdminUser[] }> => {
  const res = await fetch(`${SERVER_BASE}/users`, {
    headers: jsonHeaders(token),
  });
  return handle(res);
};

export const apiSetUserRole = async (token: string, id: string, role: Role) => {
  const res = await fetch(`${SERVER_BASE}/users/${id}/role`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({ role }),
  });
  return handle(res);
};

export const apiDeleteUser = async (token: string, id: string) => {
  const res = await fetch(`${SERVER_BASE}/users/${id}`, {
    method: "DELETE",
    headers: jsonHeaders(token),
  });
  return handle(res);
};
