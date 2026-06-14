import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as kv from "./kv_store.ts";

const app = new Hono();

app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const ALLOWED_DOMAIN = "somfy.com";
const ADMIN_EMAIL = "charlotte.lopez@somfy.com";
type Role = "admin" | "editor" | "viewer";

const supabaseAdmin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

const isAllowedEmail = (email: string) =>
  email.toLowerCase().trim().endsWith(`@${ALLOWED_DOMAIN}`);

// ---- user_roles helpers (replace kv_store role entries) -------------------
const getRole = async (userId: string): Promise<Role> => {
  const { data } = await supabaseAdmin()
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return ((data?.role as Role | undefined) ?? "viewer");
};

const setRole = async (userId: string, role: Role) => {
  const { error } = await supabaseAdmin()
    .from("user_roles")
    .upsert({ user_id: userId, role, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
};

const getRolesFor = async (userIds: string[]): Promise<Record<string, Role>> => {
  if (!userIds.length) return {};
  const { data } = await supabaseAdmin()
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", userIds);
  return Object.fromEntries(
    (data ?? []).map((r: any) => [r.user_id, r.role as Role]),
  );
};

const getCallerUser = async (c: any) => {
  const token = c.req.header("Authorization")?.split(" ")[1];
  if (!token) return null;
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
};

const getCallerRole = async (c: any): Promise<{ user: any; role: Role } | null> => {
  const user = await getCallerUser(c);
  if (!user) return null;
  const role = await getRole(user.id);
  return { user, role };
};

const ensureAdminBootstrap = async () => {
  try {
    const supa = supabaseAdmin();
    const { data: list } = await supa.auth.admin.listUsers();
    const admin = list?.users?.find(
      (u) => u.email?.toLowerCase() === ADMIN_EMAIL,
    );

    if (admin) {
      // Always ensure the admin email has admin role, even after account recreation
      await setRole(admin.id, "admin");
      await kv.set("bootstrap:admin_v1", new Date().toISOString());
      return;
    }

    // Admin user not found — create them if never bootstrapped
    const flagKey = "bootstrap:admin_v1";
    if (await kv.get(flagKey)) return;

    const { data, error } = await supa.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: "ChangeMe!Somfy2026",
      user_metadata: { name: "Charlotte Lopez" },
      email_confirm: true,
    });
    if (error) {
      console.log(
        `Admin bootstrap error while creating ${ADMIN_EMAIL}: ${error.message}`,
      );
      return;
    }
    await setRole(data.user!.id, "admin");
    await kv.set(flagKey, new Date().toISOString());
  } catch (e) {
    console.log(`Admin bootstrap exception: ${e}`);
  }
};

app.get("/make-server-3775ce8a/health", async (c) => {
  await ensureAdminBootstrap();
  return c.json({ status: "ok" });
});

app.post("/make-server-3775ce8a/signup", async (c) => {
  await ensureAdminBootstrap();
  try {
    const { email, password, name } = await c.req.json();
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }
    if (!isAllowedEmail(email)) {
      return c.json(
        { error: `Only @${ALLOWED_DOMAIN} email addresses can sign up.` },
        400,
      );
    }
    if (password.length < 8) {
      return c.json({ error: "Password must be at least 8 characters." }, 400);
    }
    const supa = supabaseAdmin();
    const { data, error } = await supa.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      user_metadata: { name: name ?? "" },
      // Email server isn't configured in this environment, so auto-confirm.
      email_confirm: true,
    });
    if (error) {
      console.log(
        `Signup error for ${email}: ${error.message}`,
      );
      return c.json({ error: error.message }, 400);
    }
    const role: Role =
      data.user!.email?.toLowerCase() === ADMIN_EMAIL ? "admin" : "viewer";
    await setRole(data.user!.id, role);
    return c.json({ id: data.user!.id, email: data.user!.email, role });
  } catch (e) {
    console.log(`Signup exception: ${e}`);
    return c.json({ error: String(e) }, 500);
  }
});

app.get("/make-server-3775ce8a/me", async (c) => {
  await ensureAdminBootstrap();
  const ctx = await getCallerRole(c);
  if (!ctx) return c.json({ error: "Unauthorized" }, 401);
  return c.json({
    id: ctx.user.id,
    email: ctx.user.email,
    name: ctx.user.user_metadata?.name ?? "",
    role: ctx.role,
  });
});

app.get("/make-server-3775ce8a/users", async (c) => {
  const ctx = await getCallerRole(c);
  if (!ctx) return c.json({ error: "Unauthorized" }, 401);
  if (ctx.role !== "admin") return c.json({ error: "Forbidden" }, 403);
  try {
    const { data, error } = await supabaseAdmin().auth.admin.listUsers();
    if (error) {
      console.log(`List users error: ${error.message}`);
      return c.json({ error: error.message }, 500);
    }
    const roles = await getRolesFor(data.users.map((u) => u.id));
    const users = data.users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name ?? "",
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at,
      role: (roles[u.id] ?? "viewer") as Role,
    }));
    return c.json({ users });
  } catch (e) {
    console.log(`List users exception: ${e}`);
    return c.json({ error: String(e) }, 500);
  }
});

app.post("/make-server-3775ce8a/users/:id/role", async (c) => {
  const ctx = await getCallerRole(c);
  if (!ctx) return c.json({ error: "Unauthorized" }, 401);
  if (ctx.role !== "admin") return c.json({ error: "Forbidden" }, 403);
  try {
    const id = c.req.param("id");
    const { role } = await c.req.json();
    if (!["admin", "editor", "viewer"].includes(role)) {
      return c.json({ error: "Invalid role" }, 400);
    }
    if (id === ctx.user.id && role !== "admin") {
      return c.json(
        { error: "You cannot downgrade your own admin role." },
        400,
      );
    }
    await setRole(id, role);
    return c.json({ id, role });
  } catch (e) {
    console.log(`Set role exception: ${e}`);
    return c.json({ error: String(e) }, 500);
  }
});

app.delete("/make-server-3775ce8a/users/:id", async (c) => {
  const ctx = await getCallerRole(c);
  if (!ctx) return c.json({ error: "Unauthorized" }, 401);
  if (ctx.role !== "admin") return c.json({ error: "Forbidden" }, 403);
  const id = c.req.param("id");
  if (id === ctx.user.id) {
    return c.json({ error: "You cannot delete your own account." }, 400);
  }
  try {
    const { error } = await supabaseAdmin().auth.admin.deleteUser(id);
    if (error) {
      console.log(`Delete user error: ${error.message}`);
      return c.json({ error: error.message }, 500);
    }
    // user_roles.user_id has ON DELETE CASCADE so the role row is removed
    // automatically when the auth user is deleted.
    return c.json({ ok: true });
  } catch (e) {
    console.log(`Delete user exception: ${e}`);
    return c.json({ error: String(e) }, 500);
  }
});

Deno.serve(app.fetch);
