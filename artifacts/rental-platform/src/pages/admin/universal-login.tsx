import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Eye, EyeOff, Building2, ChevronRight, Users } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AccountMatch {
  type: "owner" | "staff";
  tenantId: number;
  tenantSlug: string;
  tenantName: string;
  userId?: number;
  userName?: string;
  role?: string;
}

type Step = "credentials" | "selector";

export default function UniversalAdminLogin() {
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<AccountMatch[]>([]);
  const [selecting, setSelecting] = useState<number | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/auth/universal-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid email or password.");
        return;
      }

      if (data.single) {
        const m: AccountMatch = data.match;
        const session = m.type === "owner"
          ? { type: "owner", tenantId: m.tenantId, tenantSlug: m.tenantSlug, tenantName: m.tenantName, email }
          : { type: "user", tenantId: m.tenantId, tenantSlug: m.tenantSlug, id: m.userId, name: m.userName, role: m.role };
        localStorage.setItem("admin_session", JSON.stringify(session));
        toast({ title: "Welcome back!", description: `Signed in to ${m.tenantName}` });
        window.location.href = `${BASE}/${m.tenantSlug}/admin`;
      } else {
        setAccounts(data.accounts);
        setStep("selector");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAccount = async (account: AccountMatch, idx: number) => {
    setSelecting(idx);
    try {
      const endpoint = account.type === "owner"
        ? `${BASE}/api/admin/auth/owner-login`
        : `${BASE}/api/admin/auth/login`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, slug: account.tenantSlug }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to sign in to this account.");
        setStep("credentials");
        return;
      }
      const session = account.type === "owner"
        ? { type: "owner", tenantId: data.tenantId, tenantSlug: data.tenantSlug, tenantName: data.tenantName, email }
        : { type: "user", tenantId: data.tenantId, tenantSlug: data.tenantSlug, id: data.user?.id, name: data.user?.name, role: data.user?.role };
      localStorage.setItem("admin_session", JSON.stringify(session));
      toast({ title: "Welcome back!", description: `Signed in to ${account.tenantName}` });
      window.location.href = `${BASE}/${account.tenantSlug}/admin`;
    } catch {
      setError("Connection error. Please try again.");
      setStep("credentials");
    } finally {
      setSelecting(null);
    }
  };

  if (step === "selector") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Choose an account</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your email is linked to multiple admin accounts.
            </p>
          </div>

          <div className="space-y-2">
            {accounts.map((account, idx) => (
              <button
                key={`${account.tenantSlug}-${account.type}`}
                onClick={() => handleSelectAccount(account, idx)}
                disabled={selecting !== null}
                className="w-full flex items-center gap-3 p-4 bg-card border rounded-xl hover:border-primary hover:bg-primary/5 transition-colors text-left disabled:opacity-50"
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{account.tenantName}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {account.type === "owner" ? "Owner" : account.role ?? "Staff"}
                  </p>
                </div>
                {selecting === idx
                  ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                }
              </button>
            ))}
          </div>

          {error && <p className="text-sm text-destructive font-medium text-center">{error}</p>}

          <p className="text-center text-xs text-muted-foreground">
            <button
              onClick={() => { setStep("credentials"); setError(""); }}
              className="hover:underline"
            >
              ← Use a different email
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Admin Sign In</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sign in to your rental management dashboard
          </p>
        </div>

        <div className="bg-card rounded-2xl border shadow-sm">
          <form className="p-6 space-y-4" onSubmit={handleLogin}>
            <div className="space-y-1.5">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@yourcompany.com"
                className="h-11"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-password">Password</Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-destructive font-medium">{error}</p>}

            <Button type="submit" className="w-full h-11 font-bold" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </Button>

            <div className="text-center pt-1">
              <a
                href={`${BASE}/forgot-password?type=owner${email ? `&email=${encodeURIComponent(email.trim())}` : ""}`}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                Forgot your password?
              </a>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Need access?{" "}
          <a href={`${BASE}/get-started`} className="hover:underline text-primary">
            Get started
          </a>
        </p>
      </div>
    </div>
  );
}
