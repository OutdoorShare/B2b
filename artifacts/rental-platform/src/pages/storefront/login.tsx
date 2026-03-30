import { useState, useEffect } from "react";
import { useLocation, useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, User, ShieldCheck } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CustomerSession {
  id: number;
  email: string;
  name: string;
  phone?: string;
}

function loadSession(): CustomerSession | null {
  try {
    const raw = localStorage.getItem("rental_customer");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(c: CustomerSession) {
  localStorage.setItem("rental_customer", JSON.stringify(c));
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();

  const searchParams = new URLSearchParams(window.location.search);
  const redirectTo = searchParams.get("redirect") || (slug ? `/${slug}` : "/");

  // Redirect if already logged in
  useEffect(() => {
    const session = loadSession();
    if (session) setLocation(redirectTo);
  }, []);

  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Admin section
  const [showAdminSection, setShowAdminSection] = useState(false);
  const [adminTab, setAdminTab] = useState<"owner" | "team">("owner");
  const [adminError, setAdminError] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);

  const handleCustomerAuth = async () => {
    setError("");
    if (!email || !password) { setError("Email and password are required."); return; }

    if (tab === "register") {
      if (!name) { setError("Please enter your full name."); return; }
      if (!phone) { setError("Please enter your phone number."); return; }
      if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
      if (password !== confirmPassword) { setError("Passwords don't match."); return; }
    }

    setIsSubmitting(true);
    try {
      const endpoint = tab === "login"
        ? `${BASE}/api/customers/login`
        : `${BASE}/api/customers/register`;

      const body = tab === "login"
        ? { email, password, slug: slug ?? "" }
        : { email, password, name, phone, slug: slug ?? "" };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || (tab === "login" ? "Login failed." : "Registration failed.")); return; }

      saveSession(data);
      toast({ title: tab === "login" ? "Welcome back!" : "Account created!", description: `Signed in as ${data.name}` });
      setLocation(redirectTo);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOwnerLogin = async () => {
    setAdminError("");
    if (!ownerEmail || !ownerPassword) { setAdminError("Email and password are required."); return; }
    setOwnerLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/auth/owner-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setAdminError(data.error || "Login failed."); return; }
      localStorage.setItem("admin_session", JSON.stringify({
        type: "owner",
        token: data.token,
        tenantId: data.tenantId,
        tenantName: data.tenantName,
        tenantSlug: data.tenantSlug,
        email: data.email,
      }));
      toast({ title: `Welcome back!`, description: `Signed in as owner of ${data.tenantName}` });
      setLocation("/admin");
    } catch {
      setAdminError("Connection error. Please try again.");
    } finally { setOwnerLoading(false); }
  };

  const handleTeamLogin = async () => {
    setAdminError("");
    if (!staffEmail || !staffPassword) { setAdminError("Email and password are required."); return; }
    setStaffLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: staffEmail, password: staffPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setAdminError(data.error || "Login failed."); return; }
      localStorage.setItem("admin_session", JSON.stringify({ type: "user", token: data.token, id: data.user.id, name: data.user.name, email: data.user.email, role: data.user.role }));
      toast({ title: `Welcome, ${data.user.name}!`, description: `Logged in as ${data.user.role}` });
      setLocation("/admin");
    } catch {
      setAdminError("Connection error. Please try again.");
    } finally { setStaffLoading(false); }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">

        {/* Customer login card */}
        <div className="bg-background rounded-2xl border shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-6 pb-0">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-xl font-bold">Customer Account</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {tab === "login" ? "Sign in to manage your rentals." : "Create an account to start booking."}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex border-b mt-5 mx-6">
            {(["login", "register"] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); }}
                className={`flex-1 pb-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-px
                  ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {t === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <form
            className="p-6 space-y-4"
            onSubmit={e => { e.preventDefault(); handleCustomerAuth(); }}
            autoComplete="on"
          >
            {tab === "register" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-name">Full Name</Label>
                  <Input
                    id="reg-name"
                    name="name"
                    autoComplete="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Jane Smith"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-phone">Phone</Label>
                  <Input
                    id="reg-phone"
                    name="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    type="tel"
                    className="h-11"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                type="email"
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="login-password">Password</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  name="password"
                  autoComplete={tab === "register" ? "new-password" : "current-password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  placeholder={tab === "register" ? "Min. 6 characters" : "Your password"}
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

            {tab === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="login-confirm">Confirm Password</Label>
                <Input
                  id="login-confirm"
                  name="confirm-password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  placeholder="Repeat password"
                  className="h-11"
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive font-medium">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full h-11 font-bold"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? (tab === "login" ? "Signing in…" : "Creating account…")
                : (tab === "login" ? "Sign In" : "Create Account")}
            </Button>
          </form>
        </div>

        {/* Admin access — visually distinct */}
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 dark:bg-slate-900/40 dark:border-slate-700 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            onClick={() => { setShowAdminSection(v => !v); setAdminError(""); setAdminCode(""); }}
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Staff / Admin Portal
            </span>
            <span className="text-xs font-normal text-slate-400">{showAdminSection ? "Hide" : "Show"}</span>
          </button>

          {showAdminSection && (
            <div className="border-t border-dashed border-slate-300 dark:border-slate-700">
              {/* Sub-tabs */}
              <div className="flex border-b border-slate-200 dark:border-slate-700">
                {(["owner", "team"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => { setAdminTab(t); setAdminError(""); }}
                    className={`flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px
                      ${adminTab === t ? "border-primary text-foreground" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                  >
                    {t === "owner" ? "Owner Login" : "Staff Login"}
                  </button>
                ))}
              </div>

              <div className="px-5 py-4 space-y-3">
                {adminTab === "owner" ? (
                  <form onSubmit={e => { e.preventDefault(); handleOwnerLogin(); }} autoComplete="on">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Sign in with your company owner account to access the management dashboard.</p>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-slate-600 dark:text-slate-300 text-xs" htmlFor="owner-email">Owner Email</Label>
                        <Input
                          id="owner-email"
                          name="email"
                          autoComplete="email"
                          type="email"
                          value={ownerEmail}
                          onChange={e => setOwnerEmail(e.target.value)}
                          placeholder="owner@company.com"
                          className="h-10 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-slate-600 dark:text-slate-300 text-xs" htmlFor="owner-password">Password</Label>
                        <Input
                          id="owner-password"
                          name="password"
                          autoComplete="current-password"
                          type="password"
                          value={ownerPassword}
                          onChange={e => setOwnerPassword(e.target.value)}
                          placeholder="••••••"
                          className="h-10 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-sm"
                        />
                      </div>
                      {adminError && <p className="text-xs text-destructive font-medium">{adminError}</p>}
                      <Button type="submit" variant="outline" size="sm" className="w-full border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" disabled={ownerLoading}>
                        {ownerLoading ? "Signing in…" : "Sign In to Dashboard"}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={e => { e.preventDefault(); handleTeamLogin(); }} autoComplete="on">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Sign in with your staff account credentials.</p>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-slate-600 dark:text-slate-300 text-xs" htmlFor="staff-email">Email</Label>
                        <Input
                          id="staff-email"
                          name="email"
                          autoComplete="email"
                          type="email"
                          value={staffEmail}
                          onChange={e => setStaffEmail(e.target.value)}
                          placeholder="you@company.com"
                          className="h-10 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-slate-600 dark:text-slate-300 text-xs" htmlFor="staff-password">Password</Label>
                        <Input
                          id="staff-password"
                          name="password"
                          autoComplete="current-password"
                          type="password"
                          value={staffPassword}
                          onChange={e => setStaffPassword(e.target.value)}
                          placeholder="••••••"
                          className="h-10 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-sm"
                        />
                      </div>
                      {adminError && <p className="text-xs text-destructive font-medium">{adminError}</p>}
                      <Button type="submit" variant="outline" size="sm" className="w-full border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" disabled={staffLoading}>
                        {staffLoading ? "Signing in…" : "Sign In"}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
