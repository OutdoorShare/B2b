import { useState, useEffect } from "react";
import { useLocation, useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, User } from "lucide-react";

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


  const handleCustomerAuth = async () => {
    setError("");
    if (!email || !password) { setError("Email and password are required."); return; }

    if (tab === "register") {
      if (!name) { setError("Please enter your full name."); return; }
      if (!phone) { setError("Please enter your phone number."); return; }
      if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
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
                  placeholder={tab === "register" ? "Min. 8 characters" : "Your password"}
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

            {tab === "login" && (
              <div className="text-center pt-1">
                <a
                  href={`${BASE}/forgot-password?type=customer&slug=${encodeURIComponent(slug ?? "")}${email ? `&email=${encodeURIComponent(email)}` : ""}`}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                >
                  Forgot your password?
                </a>
              </div>
            )}
          </form>
        </div>

      </div>
    </div>
  );
}
