import { useState } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const OS_GREEN = "#3ab549";
const OS_GREEN_DARK = "#2e9a3d";

export default function SuperAdminLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!email.trim()) { setError("Email is required."); return; }
    if (!password) { setError("Password is required."); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/superadmin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Invalid credentials."); return; }

      // Store only non-sensitive user metadata — the auth token is in an httpOnly cookie set by the server
      localStorage.removeItem("superadmin_key");
      localStorage.removeItem("superadmin_token");
      localStorage.setItem("superadmin_user", JSON.stringify(data.user));
      setLocation("/superadmin/dashboard");
    } catch {
      setError("Connection error. Try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-4">
          <img
            src="/outdoorshare-logo.png"
            alt="OutdoorShare"
            className="w-20 h-20 object-contain mx-auto drop-shadow-lg"
          />
          <div>
            <h1 className="text-2xl font-black text-white tracking-wide">OutdoorShare</h1>
            <p className="text-slate-400 text-sm mt-1">Super Admin Console</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${OS_GREEN}, #29b4d4)` }} />
          <form
            className="p-6 space-y-5"
            onSubmit={e => { e.preventDefault(); handleLogin(); }}
            autoComplete="on"
          >
            <div className="space-y-1.5">
              <Label htmlFor="sa-email" className="text-slate-300 text-sm">Email</Label>
              <Input
                id="sa-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="owner@platform.com"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-11"
                style={{ ["--tw-ring-color" as string]: OS_GREEN }}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sa-password" className="text-slate-300 text-sm">Password</Label>
              <div className="relative">
                <Input
                  id="sa-password"
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10 h-11"
                />
                <button
                  type="button"
                  onClick={() => setShow(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-red-400 text-sm font-medium">{error}</p>}

            <Button
              type="submit"
              className="w-full h-11 text-white font-bold hover:opacity-90"
              style={{ backgroundColor: OS_GREEN }}
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign In to Platform"}
            </Button>

          </form>
        </div>
      </div>
    </div>
  );
}
