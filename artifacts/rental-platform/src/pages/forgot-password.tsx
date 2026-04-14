import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Mail, ArrowLeft, CheckCircle } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type UserType = "owner" | "staff" | "superadmin" | "customer";

const USER_TYPE_LABELS: Record<UserType, string> = {
  owner: "Company Owner",
  staff: "Staff Member",
  superadmin: "Super Admin",
  customer: "Renter Account",
};

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const userType = (params.get("type") ?? "owner") as UserType;
  const tenantSlug = params.get("slug") ?? "";

  const [email, setEmail] = useState(params.get("email") ?? "");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const backHref = userType === "superadmin"
    ? `${BASE}/superadmin`
    : userType === "customer"
      ? tenantSlug ? `${BASE}/${tenantSlug}/login` : `${BASE}/`
      : tenantSlug ? `${BASE}/${tenantSlug}/admin/login` : `${BASE}/`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Please enter your email address."); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), userType, tenantSlug: tenantSlug || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong. Please try again."); return; }
      setSent(true);
    } catch {
      setError("Connection error. Please try again.");
    } finally { setLoading(false); }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mx-auto">
            <CheckCircle className="w-7 h-7 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Check your email</h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              If an account exists for <strong>{email}</strong>, we've sent a password reset link.
              It expires in <strong>1 hour</strong>.
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left text-sm text-amber-800">
            <p className="font-medium mb-1">Didn't receive it?</p>
            <ul className="space-y-1 text-amber-700">
              <li>• Check your spam or junk folder</li>
              <li>• Make sure you used the correct email address</li>
              <li>• <button className="underline underline-offset-2" onClick={() => setSent(false)}>Try again with a different address</button></li>
            </ul>
          </div>
          <a href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </a>
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
          <h1 className="text-2xl font-bold">Forgot your password?</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter the email for your <span className="font-medium text-foreground">{USER_TYPE_LABELS[userType] ?? "account"}</span>
            {tenantSlug ? <> at <span className="font-medium text-foreground">{tenantSlug}</span></> : ""}.
            We'll send you a link to reset it.
          </p>
        </div>

        <div className="bg-card rounded-2xl border shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fp-email">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="fp-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11 pl-9"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive font-medium">{error}</p>
            )}

            <Button type="submit" className="w-full h-11 font-bold" disabled={loading}>
              {loading ? "Sending…" : "Send Reset Link"}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm">
          <a href={backHref} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </a>
        </p>
      </div>
    </div>
  );
}
