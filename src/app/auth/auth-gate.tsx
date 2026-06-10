import { useEffect, useState } from "react";
import { LayoutDashboard, Loader2, Mail, Lock, User } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { toast } from "sonner";
import { apiSignup, supabase } from "./supabase-client";
import { useAuth } from "./auth-context";

type Mode = "login" | "signup" | "forgot" | "reset";

const ALLOWED = "@somfy.com";

export function AuthGate() {
  const { signIn, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase appends ?type=recovery#access_token=... on password reset links.
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token=")) {
      setMode("reset");
    }
  }, []);

  const validateEmail = (v: string) => {
    const clean = v.toLowerCase().trim();
    if (!clean) return "Email is required.";
    if (!clean.endsWith(ALLOWED))
      return `Only ${ALLOWED} email addresses are allowed.`;
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        const v = validateEmail(email);
        if (v) throw new Error(v);
        await signIn(email, password);
      } else if (mode === "signup") {
        const v = validateEmail(email);
        if (v) throw new Error(v);
        if (password.length < 8)
          throw new Error("Password must be at least 8 characters.");
        await apiSignup(email, password, name);
        await signIn(email, password);
        toast.success("Account created.");
      } else if (mode === "forgot") {
        const v = validateEmail(email);
        if (v) throw new Error(v);
        await resetPassword(email);
        toast.success(
          "If an account exists for that address, a reset link has been emailed.",
        );
        setMode("login");
      } else if (mode === "reset") {
        if (password.length < 8)
          throw new Error("Password must be at least 8 characters.");
        const { error: err } = await supabase().auth.updateUser({ password });
        if (err) throw new Error(err.message);
        toast.success("Password updated. You're signed in.");
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", window.location.pathname);
        }
      }
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === "login"
      ? "Sign in"
      : mode === "signup"
        ? "Create account"
        : mode === "forgot"
          ? "Reset your password"
          : "Choose a new password";

  return (
    <div className="min-h-screen w-full grid place-items-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-6">
      <Card className="w-full max-w-md p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary text-primary-foreground grid place-items-center">
            <LayoutDashboard className="size-5" />
          </div>
          <div>
            <h2>PI Production Planner</h2>
            <p className="text-xs text-muted-foreground">
              Somfy designers only — accounts restricted to {ALLOWED}.
            </p>
          </div>
        </div>

        <h3 className="text-base">{title}</h3>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Full name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-9"
                  placeholder="Your full name"
                  required
                />
              </div>
            </div>
          )}

          {mode !== "reset" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  placeholder={`name${ALLOWED}`}
                  autoComplete="email"
                  required
                />
              </div>
            </div>
          )}

          {(mode === "login" || mode === "signup" || mode === "reset") && (
            <div className="space-y-1.5">
              <Label className="text-xs">
                {mode === "reset" ? "New password" : "Password"}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-2 py-1.5">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {mode === "login" && "Sign in"}
            {mode === "signup" && "Create account"}
            {mode === "forgot" && "Email reset link"}
            {mode === "reset" && "Update password"}
          </Button>
        </form>

        <div className="text-xs text-muted-foreground flex flex-col gap-1">
          {mode === "login" && (
            <>
              <button
                className="text-left hover:underline"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
              >
                No account? Create one.
              </button>
              <button
                className="text-left hover:underline"
                onClick={() => {
                  setMode("forgot");
                  setError(null);
                }}
              >
                Forgot password?
              </button>
            </>
          )}
          {mode !== "login" && mode !== "reset" && (
            <button
              className="text-left hover:underline"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
            >
              Back to sign in
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
