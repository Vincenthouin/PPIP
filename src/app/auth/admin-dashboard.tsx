import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  AdminUser,
  apiDeleteUser,
  apiListUsers,
  apiSetUserRole,
  Role,
} from "./supabase-client";
import { useAuth } from "./auth-context";

const roleVariant: Record<Role, "default" | "secondary" | "outline"> = {
  admin: "default",
  editor: "secondary",
  viewer: "outline",
};

export function AdminDashboard() {
  const { token, me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { users } = await apiListUsers(token);
      setUsers(users);
    } catch (err: any) {
      toast.error(`Failed to load users: ${err?.message ?? err}`);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const changeRole = async (u: AdminUser, role: Role) => {
    if (!token || u.role === role) return;
    setBusyId(u.id);
    try {
      await apiSetUserRole(token, u.id, role);
      setUsers((cur) => cur.map((x) => (x.id === u.id ? { ...x, role } : x)));
      toast.success(`${u.email} is now ${role}.`);
    } catch (err: any) {
      toast.error(`Could not update role for ${u.email}: ${err?.message ?? err}`);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (u: AdminUser) => {
    if (!token) return;
    if (!confirm(`Delete ${u.email}? This cannot be undone.`)) return;
    setBusyId(u.id);
    try {
      await apiDeleteUser(token, u.id);
      setUsers((cur) => cur.filter((x) => x.id !== u.id));
      toast.success(`Deleted ${u.email}.`);
    } catch (err: any) {
      toast.error(`Could not delete ${u.email}: ${err?.message ?? err}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Team access</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Grant view or edit rights. Only admins can manage this list.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b">
              <tr>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Last sign-in</th>
                <th className="py-2 pr-3">Created</th>
                <th className="py-2 pr-0 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === me?.id;
                return (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      {u.name || <span className="text-muted-foreground">—</span>}
                      {isSelf && (
                        <Badge variant="outline" className="ml-2">
                          you
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{u.email}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={roleVariant[u.role]}>{u.role}</Badge>
                        <Select
                          value={u.role}
                          onValueChange={(v) => changeRole(u, v as Role)}
                          disabled={busyId === u.id || (isSelf && u.role === "admin")}
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">viewer</SelectItem>
                            <SelectItem value="editor">editor</SelectItem>
                            <SelectItem value="admin">admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground text-xs">
                      {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString() : "—"}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-0 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={isSelf || busyId === u.id}
                        onClick={() => remove(u)}
                        title={isSelf ? "You can't delete yourself" : "Delete user"}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
