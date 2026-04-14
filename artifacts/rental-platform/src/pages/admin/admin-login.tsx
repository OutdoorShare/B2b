import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Props {
  slug: string;
}

export default function AdminLoginPage({ slug }: Props) {
  const { toast } = useToast();

  const [tab, setTab] = useState<"owner" | "team">("owner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [redirectSlug, setRedirectSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOwnerLogin = async () => {
    setError(""); setRedirectSlug(null);
    if (!email || !password) { setError("Email and password are required."); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/auth/owner-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, slug }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.correctSlug) {
          setError("These credentials belong to a different company.");
          setRedirectSlug(data.correctSlug);
        } else {
          setError(data.error || "Login failed.");
        }
        return;
      }
      if (data.tenantSlug !== slug) {
        setError("These credentials belong to a different company.");
        setRedirectSlug(data.tenantSlug);
        return;
      }
      localStorage.setItem("admin_session", JSON.stringify({
        type: "owner",
        token: data.token,
        tenantId: data.tenantId,
        tenantName: data.tenantName,
        tenantSlug: data.tenantSlug,
        email: data.email,
        emailVerified: data.emailVerified ?? true,
      }));
      toast({ title: "Welcome back!", description: `Signed in as owner of ${data.tenantName}` });
      window.location.href = `${BASE}/${slug}/admin`;
    } catch {
      setError("Connection error. Please try again.");
    } finally { setLoading(false); }
  };

  const handleTeamLogin = async () => {
    setError("");
    if (!email || !password) { setError("Email and password are required."); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, slug }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Login failed."); return; }
      localStorage.setItem("admin_session", JSON.stringify({
        type: "user",
        token: data.token,
        tenantId: data.tenantId,
        tenantSlug: data.tenantSlug,
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
      }));
      toast({ title: `Welcome, ${data.user.name}!`, description: `Logged in as ${data.user.role}` });
      window.location.href = `${BASE}/${slug}/admin`;
    } catch {
      setError("Connection error. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Admin Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-medium text-foreground">{slug}</span> management dashboard
          </p>
        </div>

        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <div className="flex border-b">
            {(["owner", "team"] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); setEmail(""); setPassword(""); }}
                className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px
                  ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {t === "owner" ? "Owner" : "Staff"}
              </button>
            ))}
          </div>

          <form
            className="p-6 space-y-4"
            onSubmit={e => { e.preventDefault(); tab === "owner" ? handleOwnerLogin() : handleTeamLogin(); }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={tab === "owner" ? "owner@company.com" : "staff@company.com"}
                className="h-11"
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

            {error && (
              <div className="text-sm text-destructive font-medium space-y-1">
                <p>{error}</p>
                {redirectSlug && (
                  <a
                    href={`${BASE}/${redirectSlug}/admin`}
                    className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:opacity-80"
                  >
                    → Sign in to /{redirectSlug}/admin
                  </a>
                )}
              </div>
            )}

            <Button type="submit" className="w-full h-11 font-bold" disabled={loading}>
              {loading ? "Signing in…" : "Sign In to Dashboard"}
            </Button>

            <div className="text-center pt-1">
              <a
                href={`${BASE}/forgot-password?type=${tab === "owner" ? "owner" : "staff"}&slug=${encodeURIComponent(slug)}${email ? `&email=${encodeURIComponent(email)}` : ""}`}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                Forgot your password?
              </a>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground space-x-3">
          <a href={`/${slug}`} className="hover:underline">← Back to storefront</a>
          <span>·</span>
          <a href={`${BASE}/admin/login`} className="hover:underline">Sign in without a slug</a>
        </p>
      </div>
    </div>
  );
}
