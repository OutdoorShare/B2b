import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
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
}

export default function SuperAdminAcceptInvite() {
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
        const res = await fetch(`${BASE}/api/superadmin/team/accept-invite?token=${encodeURIComponent(token)}`);
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
      const res = await fetch(`${BASE}/api/superadmin/team/accept-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
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

  const roleLabel = inviteInfo?.role === "super_admin" ? "Super Admin" : "Admin";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1a] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#3ab549" }}>
              <Lock className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">OutdoorShare</span>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
          {/* Loading */}
          {state === "loading" && (
            <div className="p-10 flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <p className="text-sm">Verifying your invitation…</p>
            </div>
          )}

          {/* Invalid token */}
          {(state === "invalid" || state === "error") && (
            <div className="p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-red-900/30 border border-red-700/40 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Invalid Invitation</h2>
                <p className="text-sm text-slate-400 mt-2">
                  {errorMsg || "This invitation link is invalid. Please ask an admin to send you a new invite."}
                </p>
              </div>
            </div>
          )}

          {/* Expired */}
          {state === "expired" && (
            <div className="p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-amber-900/30 border border-amber-700/40 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Invitation Expired</h2>
                <p className="text-sm text-slate-400 mt-2">
                  This invitation link has expired (links are valid for 48 hours). Please ask an admin to resend the invite.
                </p>
              </div>
            </div>
          )}

          {/* Already accepted */}
          {state === "already_accepted" && (
            <div className="p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-900/30 border border-emerald-700/40 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Already Accepted</h2>
                <p className="text-sm text-slate-400 mt-2">
                  This invitation has already been accepted. Use your email and password to log in.
                </p>
              </div>
              <Button onClick={() => navigate("/superadmin")} className="mt-2 text-white" style={{ backgroundColor: "#3ab549" }}>
                Go to Login
              </Button>
            </div>
          )}

          {/* Set password form */}
          {(state === "ready" || state === "submitting") && inviteInfo && (
            <div className="p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white">Welcome, {inviteInfo.name.split(" ")[0]}!</h2>
                <p className="text-sm text-slate-400 mt-1">
                  You've been invited as a <span className="text-emerald-400 font-medium">{roleLabel}</span>.
                  Set a password below to activate your account.
                </p>
                <div className="mt-3 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-400">
                  Logging in as: <span className="text-slate-200 font-medium">{inviteInfo.email}</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Password <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      required
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10"
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Confirm Password <span className="text-red-400">*</span></Label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
                {errorMsg && (
                  <p className="text-sm text-red-400 font-medium flex items-center gap-1.5">
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

          {/* Success */}
          {state === "success" && (
            <div className="p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-900/30 border border-emerald-700/40 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Password Set!</h2>
                <p className="text-sm text-slate-400 mt-2">
                  Your account is now active. Click below to log in to the super admin console.
                </p>
              </div>
              <Button onClick={() => navigate("/superadmin")} className="mt-2 text-white" style={{ backgroundColor: "#3ab549" }}>
                Go to Login
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          OutdoorShare Platform &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
