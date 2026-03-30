import { useState } from "react";
import { useLocation } from "wouter";
import { Shield, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SuperAdminLogin() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"key" | "staff">("key");

  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");

  const handleKeyLogin = async () => {
    setError("");
    if (!key.trim()) { setError("Enter your super admin key."); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/superadmin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Invalid key."); return; }
      localStorage.setItem("superadmin_key", key);
      localStorage.removeItem("superadmin_token");
      localStorage.removeItem("superadmin_user");
      setLocation("/superadmin/dashboard");
    } catch {
      setError("Connection error. Try again.");
    } finally { setLoading(false); }
  };

  const handleStaffLogin = async () => {
    setError("");
    if (!staffEmail || !staffPassword) { setError("Email and password are required."); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/superadmin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: staffEmail, password: staffPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Invalid credentials."); return; }
      localStorage.removeItem("superadmin_key");
      localStorage.setItem("superadmin_token", data.token);
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
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-violet-600 flex items-center justify-center mx-auto shadow-lg shadow-violet-900/50">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Platform Admin</h1>
            <p className="text-slate-400 text-sm mt-1">Super administrator console</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Tabs */}
          <div className="flex border-b border-slate-800">
            {(["key", "staff"] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); }}
                className={`flex-1 py-3 text-xs font-semibold transition-colors border-b-2 -mb-px
                  ${tab === t ? "border-violet-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"}`}
              >
                {t === "key" ? "Master Key" : "Sub-admin Login"}
              </button>
            ))}
          </div>

          <div className="p-6 space-y-5">
            {tab === "key" ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-sm">Admin Key</Label>
                  <div className="relative">
                    <Input
                      type={show ? "text" : "password"}
                      value={key}
                      onChange={e => setKey(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleKeyLogin(); }}
                      placeholder="Enter your super admin key"
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10 h-11 focus:border-violet-500"
                    />
                    <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {error && <p className="text-red-400 text-sm font-medium">{error}</p>}
                <Button className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white font-bold" onClick={handleKeyLogin} disabled={loading}>
                  {loading ? "Verifying…" : "Sign In to Platform"}
                </Button>
                <p className="text-xs text-slate-500 text-center">Default key: <code className="font-mono text-slate-400">superadmin</code></p>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-sm">Email</Label>
                  <Input
                    type="email"
                    value={staffEmail}
                    onChange={e => setStaffEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-11 focus:border-violet-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-sm">Password</Label>
                  <div className="relative">
                    <Input
                      type={show ? "text" : "password"}
                      value={staffPassword}
                      onChange={e => setStaffPassword(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleStaffLogin(); }}
                      placeholder="Your password"
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10 h-11 focus:border-violet-500"
                    />
                    <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {error && <p className="text-red-400 text-sm font-medium">{error}</p>}
                <Button className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white font-bold" onClick={handleStaffLogin} disabled={loading}>
                  {loading ? "Signing in…" : "Sign In"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
