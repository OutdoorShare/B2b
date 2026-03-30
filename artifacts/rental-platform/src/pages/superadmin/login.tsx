import { useState } from "react";
import { useLocation } from "wouter";
import { Shield, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SuperAdminLogin() {
  const [, setLocation] = useLocation();
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
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
      setLocation("/superadmin/dashboard");
    } catch {
      setError("Connection error. Try again.");
    } finally {
      setLoading(false);
    }
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Admin Key</Label>
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                value={key}
                onChange={e => setKey(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
                placeholder="Enter your super admin key"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10 h-11 focus:border-violet-500 focus:ring-violet-500/20"
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

          {error && (
            <p className="text-red-400 text-sm font-medium">{error}</p>
          )}

          <Button
            className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white font-bold"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? "Verifying…" : "Sign In to Platform"}
          </Button>

          <p className="text-xs text-slate-500 text-center">
            Default key: <code className="font-mono text-slate-400">superadmin</code>
          </p>
        </div>
      </div>
    </div>
  );
}
