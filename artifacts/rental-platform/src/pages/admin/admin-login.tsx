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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [redirectSlug, setRedirectSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setRedirectSlug(null);
    if (!email.trim() || !password) { setError("Email and password are required."); return; }
    setLoading(true);

    try {
      // Use the universal login API which handles both owners and staff.
      // We then verify the result belongs to this specific tenant slug.
      const res = await fetch(`${BASE}/api/admin/auth/universal-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid email or password.");
        return;
      }

      if (data.single) {
        const m = data.match;

        if (m.tenantSlug !== slug) {
          // Valid credentials, but they belong to a different company
          setError("These credentials are linked to a different company.");
          setRedirectSlug(m.tenantSlug);
          return;
        }

        const session = m.type === "owner"
          ? { type: "owner", token: data.token, tenantId: m.tenantId, tenantSlug: m.tenantSlug, tenantName: m.tenantName, email: email.trim() }
          : { type: "user", token: data.token, tenantId: m.tenantId, tenantSlug: m.tenantSlug, id: m.userId, name: m.userName, role: m.role };
        localStorage.setItem("admin_session", JSON.stringify(session));
        toast({ title: "Welcome back!", description: `Signed in to ${m.tenantName}` });
        window.location.href = `${BASE}/${slug}/admin`;

      } else {
        // Multiple accounts — find the one for this slug
        const match = data.accounts?.find((a: any) => a.tenantSlug === slug);

        if (!match) {
          // Credentials are valid but not for this tenant — find any matching account
          const first = data.accounts?.[0];
          if (first) {
            setError("These credentials are linked to a different company.");
            setRedirectSlug(first.tenantSlug);
          } else {
            setError("Invalid email or password.");
          }
          return;
        }

        // Re-authenticate against the specific tenant endpoint to get a session token
        const endpoint = match.type === "owner"
          ? `${BASE}/api/admin/auth/owner-login`
          : `${BASE}/api/admin/auth/login`;
        const reRes = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: email.trim(), password, slug }),
        });
        const reData = await reRes.json();
        if (!reRes.ok) { setError(reData.error || "Sign in failed."); return; }

        const session = match.type === "owner"
          ? { type: "owner", token: reData.token, tenantId: reData.tenantId, tenantSlug: reData.tenantSlug, tenantName: reData.tenantName, email: email.trim() }
          : { type: "user", token: reData.token, tenantId: reData.tenantId, tenantSlug: reData.tenantSlug, id: reData.user?.id, name: reData.user?.name, role: reData.user?.role };
        localStorage.setItem("admin_session", JSON.stringify(session));
        toast({ title: "Welcome back!", description: `Signed in to ${match.tenantName}` });
        window.location.href = `${BASE}/${slug}/admin`;
      }
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
          <h1 className="text-2xl font-bold">Admin Sign In</h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-medium text-foreground">{slug}</span> management dashboard
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

            {error && (
              <div className="text-sm text-destructive font-medium space-y-1">
                <p>{error}</p>
                {redirectSlug && (
                  <a
                    href={`${BASE}/${redirectSlug}/admin`}
                    className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:opacity-80"
                  >
                    → Sign in to /{redirectSlug}
                  </a>
                )}
              </div>
            )}

            <Button type="submit" className="w-full h-11 font-bold" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </Button>

            <div className="text-center pt-1">
              <a
                href={`${BASE}/forgot-password?slug=${encodeURIComponent(slug)}${email ? `&email=${encodeURIComponent(email.trim())}` : ""}`}
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
          <a href={`${BASE}/admin/login`} className="hover:underline">Use a different account</a>
        </p>
      </div>
    </div>
  );
}
