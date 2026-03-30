import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
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
  const { toast } = useToast();

  const searchParams = new URLSearchParams(window.location.search);
  const redirectTo = searchParams.get("redirect") || "/";

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
  const [adminCode, setAdminCode] = useState("");
  const [adminError, setAdminError] = useState("");

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
        ? { email, password }
        : { email, password, name, phone };

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

  const handleAdminAccess = () => {
    setAdminError("");
    if (!adminCode.trim()) { setAdminError("Enter your admin code."); return; }
    // Admin code validated client-side; in production this would be server-verified
    if (adminCode.trim() === "admin") {
      setLocation("/admin");
    } else {
      setAdminError("Invalid admin code.");
    }
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

          <div className="p-6 space-y-4">
            {tab === "register" && (
              <>
                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Jane Smith"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input
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
              <Label>Email</Label>
              <Input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                type="email"
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Password</Label>
              <div className="relative">
                <Input
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
                <Label>Confirm Password</Label>
                <Input
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
              className="w-full h-11 font-bold"
              onClick={handleCustomerAuth}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? (tab === "login" ? "Signing in…" : "Creating account…")
                : (tab === "login" ? "Sign In" : "Create Account")}
            </Button>
          </div>
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
            <div className="px-5 pb-5 space-y-3 border-t border-dashed border-slate-300 dark:border-slate-700 pt-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Enter your admin access code to reach the management dashboard.
              </p>
              <div className="space-y-1.5">
                <Label className="text-slate-600 dark:text-slate-300 text-xs">Admin Code</Label>
                <Input
                  value={adminCode}
                  onChange={e => setAdminCode(e.target.value)}
                  type="password"
                  placeholder="••••••"
                  className="h-10 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-sm"
                  onKeyDown={e => { if (e.key === "Enter") handleAdminAccess(); }}
                />
              </div>
              {adminError && <p className="text-xs text-destructive font-medium">{adminError}</p>}
              <Button
                variant="outline"
                size="sm"
                className="w-full border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={handleAdminAccess}
              >
                Access Dashboard
              </Button>
              <p className="text-[11px] text-slate-400 text-center">Default code: <code className="font-mono">admin</code></p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
