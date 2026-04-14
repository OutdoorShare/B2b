import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type UserType = "owner" | "staff" | "superadmin" | "customer";

interface TokenInfo {
  valid: boolean;
  userType: UserType;
  tenantSlug: string | null;
  email: string;
}

export default function ResetPasswordPage() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [tokenError, setTokenError] = useState("");
  const [validating, setValidating] = useState(true);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [doneSlug, setDoneSlug] = useState<string | null>(null);
  const [doneUserType, setDoneUserType] = useState<UserType | null>(null);

  useEffect(() => {
    if (!token) {
      setTokenError("No reset token found. Please use the link from your email.");
      setValidating(false);
      return;
    }
    fetch(`${BASE}/api/auth/reset-password/validate/${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data.valid) {
          setTokenInfo(data);
        } else {
          setTokenError(data.error || "Invalid reset link.");
        }
      })
      .catch(() => setTokenError("Could not validate reset link. Please check your connection."))
      .finally(() => setValidating(false));
  }, [token]);

  const getLoginHref = (userType: UserType | null, slug: string | null): string => {
    if (userType === "superadmin") return `${BASE}/superadmin`;
    if (userType === "customer") return slug ? `${BASE}/${slug}/login` : `${BASE}/`;
    return slug ? `${BASE}/${slug}/admin/login` : `${BASE}/`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to reset password. Please try again.");
        return;
      }
      setDoneUserType(data.userType ?? null);
      setDoneSlug(data.tenantSlug ?? null);
      setDone(true);
    } catch {
      setError("Connection error. Please try again.");
    } finally { setSubmitting(false); }
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-destructive/10 mx-auto">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Link invalid or expired</h1>
            <p className="text-muted-foreground text-sm mt-2">{tokenError}</p>
          </div>
          <a href={`${BASE}/forgot-password`} className="inline-block text-sm text-primary underline underline-offset-2 hover:opacity-80">
            Request a new reset link
          </a>
        </div>
      </div>
    );
  }

  if (done) {
    const loginHref = getLoginHref(doneUserType, doneSlug);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mx-auto">
            <CheckCircle className="w-7 h-7 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Password updated!</h1>
            <p className="text-muted-foreground text-sm mt-2">
              Your password has been changed. You can now sign in with your new password.
            </p>
          </div>
          <a href={loginHref}>
            <Button className="w-full h-11 font-bold">Go to sign in</Button>
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
          <h1 className="text-2xl font-bold">Set a new password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            For <strong>{tokenInfo?.email}</strong>
          </p>
        </div>

        <div className="bg-card rounded-2xl border shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rp-password">New password</Label>
              <div className="relative">
                <Input
                  id="rp-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
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
              <Label htmlFor="rp-confirm">Confirm new password</Label>
              <div className="relative">
                <Input
                  id="rp-confirm"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your new password"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password strength hint */}
            {password.length > 0 && password.length < 8 && (
              <p className="text-xs text-amber-600 font-medium">Password must be at least 8 characters.</p>
            )}
            {password.length >= 8 && confirmPassword.length > 0 && password !== confirmPassword && (
              <p className="text-xs text-destructive font-medium">Passwords do not match.</p>
            )}

            {error && (
              <p className="text-sm text-destructive font-medium">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full h-11 font-bold"
              disabled={submitting || password.length < 8 || password !== confirmPassword}
            >
              {submitting ? "Updating password…" : "Update Password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
