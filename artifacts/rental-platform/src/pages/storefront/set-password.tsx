import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, KeyRound, CheckCircle2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function saveSession(c: { id: number; email: string; name: string; phone?: string }) {
  localStorage.setItem("rental_customer", JSON.stringify(c));
}

export default function SetPasswordPage() {
  const [, setLocation] = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();

  const searchParams = new URLSearchParams(window.location.search);
  const emailFromUrl = searchParams.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // If already logged in, go straight to my-bookings
  useEffect(() => {
    try {
      const raw = localStorage.getItem("rental_customer");
      if (raw) {
        const session = JSON.parse(raw);
        if (session?.id) setLocation(`/${slug}/my-bookings`);
      }
    } catch {}
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!password || password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/customers/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailFromUrl, password, tenantSlug: slug ?? "" }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setError("An account already exists for this email. Click below to sign in.");
        } else {
          setError(data.error || "Something went wrong. Please try again.");
        }
        return;
      }

      saveSession(data);
      setDone(true);
      toast({ title: "Account created!", description: "Credentials sent to your email." });

      setTimeout(() => setLocation(`/${slug}/my-bookings`), 2000);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">

        <div className="bg-background rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-6 pb-0">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-xl font-bold">Create Your Password</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Set a password to access your booking and account anytime.
            </p>
          </div>

          {done ? (
            <div className="p-6 flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <div>
                <p className="font-bold text-lg">You're all set!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your credentials have been sent to <strong>{emailFromUrl}</strong>. Redirecting to your bookings…
                </p>
              </div>
            </div>
          ) : (
            <form className="p-6 space-y-4" onSubmit={handleSubmit} autoComplete="on">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  value={emailFromUrl}
                  disabled
                  className="h-11 bg-muted/50 text-muted-foreground"
                  autoComplete="username"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sp-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="sp-password"
                    name="password"
                    autoComplete="new-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
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

              <div className="space-y-1.5">
                <Label htmlFor="sp-confirm">Confirm Password</Label>
                <Input
                  id="sp-confirm"
                  name="confirm-password"
                  autoComplete="new-password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="h-11"
                />
              </div>

              {error && (
                <div className="space-y-2">
                  <p className="text-sm text-destructive font-medium">{error}</p>
                  {error.includes("already exists") && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-10"
                      onClick={() => setLocation(`/${slug}/login`)}
                    >
                      Sign In Instead
                    </Button>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full h-11 font-bold" disabled={isSubmitting}>
                {isSubmitting ? "Creating account…" : "Create Account & View Booking"}
              </Button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
