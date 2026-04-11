import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, CheckCircle, AlertCircle, Loader2, Lock } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getTokenFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("token") ?? "";
}

type PageState = "loading" | "ready" | "invalid" | "expired" | "already_accepted" | "submitting" | "success" | "error";

interface InviteInfo {
  name: string;
  email: string;
  role: string;
  tenantSlug: string | null;
}

export default function AdminAcceptInvite() {
  const [, navigate] = useLocation();
  const [state, setState] = useState<PageState>("loading");
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const token = getTokenFromUrl();

  useEffect(() => {
    if (!token) { setState("invalid"); return; }

    (async () => {
      try {
        const res = await fetch(`${BASE}/api/admin/team/accept-invite?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (res.status === 410) { setState("expired"); return; }
        if (res.status === 409) { setState("already_accepted"); return; }
        if (!res.ok) { setState("invalid"); return; }
        setInviteInfo(data);
        setState("ready");
      } catch {
        setState("error");
        setErrorMsg("Connection error. Please try again.");
      }
    })();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (password.length < 8) { setErrorMsg("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setErrorMsg("Passwords don't match."); return; }

    setState("submitting");
    try {
      const res = await fetch(`${BASE}/api/admin/team/accept-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 410) { setState("expired"); return; }
        if (res.status === 409) { setState("already_accepted"); return; }
        setState("ready");
        setErrorMsg(data.error || "Failed to set password. Please try again.");
        return;
      }
      setState("success");
    } catch {
      setState("ready");
      setErrorMsg("Connection error. Please try again.");
    }
  };

  const roleLabel = inviteInfo?.role === "owner" ? "Owner" : inviteInfo?.role === "manager" ? "Manager" : "Staff";
  const loginPath = inviteInfo?.tenantSlug ? `/${inviteInfo.tenantSlug}/admin` : "/";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#3ab549" }}>
              <Lock className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-800 tracking-tight">OutdoorShare</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          {state === "loading" && (
            <div className="p-10 flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#3ab549" }} />
              <p className="text-sm">Verifying your invitation…</p>
            </div>
          )}

          {(state === "invalid" || state === "error") && (
            <div className="p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Invalid Link</h2>
                <p className="text-sm text-slate-500 mt-2">
                  This invitation link is invalid or has already been used. Ask your admin to resend the invite.
                </p>
              </div>
            </div>
          )}

          {state === "expired" && (
            <div className="p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Invitation Expired</h2>
                <p className="text-sm text-slate-500 mt-2">
                  This invitation link has expired (invitations are valid for 48 hours). Ask your admin to resend it.
                </p>
              </div>
            </div>
          )}

          {state === "already_accepted" && (
            <div className="p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Already Accepted</h2>
                <p className="text-sm text-slate-500 mt-2">
                  You've already set your password. Go to the admin login to sign in.
                </p>
              </div>
              <Button onClick={() => navigate(loginPath)} className="mt-2 text-white" style={{ backgroundColor: "#3ab549" }}>
                Go to Login
              </Button>
            </div>
          )}

          {(state === "ready" || state === "submitting") && inviteInfo && (
            <div className="p-8">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-800">Set Your Password</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Welcome, <strong>{inviteInfo.name}</strong>! You've been invited as <strong>{roleLabel}</strong>.
                  Set a password to activate your account.
                </p>
              </div>

              <div className="mb-5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500 mb-0.5">Signing in as</p>
                <p className="text-sm font-semibold text-slate-700">{inviteInfo.email}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>New Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="pr-10"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Confirm Password</Label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                  />
                </div>

                {errorMsg && (
                  <p className="text-sm text-red-600 font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={state === "submitting"}
                  className="w-full text-white hover:opacity-90 mt-2"
                  style={{ backgroundColor: "#3ab549" }}
                >
                  {state === "submitting" ? (
                    <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Setting password…</span>
                  ) : "Set Password & Log In"}
                </Button>
              </form>
            </div>
          )}

          {state === "success" && (
            <div className="p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Password Set!</h2>
                <p className="text-sm text-slate-500 mt-2">
                  Your account is now active. Click below to log in to the admin dashboard.
                </p>
              </div>
              <Button onClick={() => navigate(loginPath)} className="mt-2 text-white" style={{ backgroundColor: "#3ab549" }}>
                Go to Login
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          OutdoorShare Platform &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
