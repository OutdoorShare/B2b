import { useState, useEffect, useCallback } from "react";
import {
  Shield, ShieldCheck, ShieldOff, Save, Loader2,
  DollarSign, AlertTriangle, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function getToken() { return localStorage.getItem("superadmin_token") ?? ""; }
async function sa(path: string, opts?: RequestInit) {
  return fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-superadmin-token": getToken(), ...opts?.headers },
  });
}

type Plan = {
  id: number;
  categorySlug: string;
  categoryName: string;
  enabled: boolean;
  feeAmount: string;
  updatedAt: string;
};

const CATEGORY_ICONS: Record<string, string> = {
  atv: "🏎️", boat: "⛵", camper: "🏕️", "dirt-bike": "🏍️",
  ebike: "🚲", "jet-ski": "🚤", rv: "🚌", snowmobile: "🛷",
  "towing-vehicle": "🚛", utv: "🏁", "utility-trailer": "📦",
};

export default function ProtectionPlansPage() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [localFees, setLocalFees] = useState<Record<string, string>>({});
  const [localEnabled, setLocalEnabled] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await sa("/superadmin/protection-plans");
      const data: Plan[] = await r.json();
      setPlans(data);
      const fees: Record<string, string> = {};
      const enabled: Record<string, boolean> = {};
      data.forEach(p => {
        fees[p.categorySlug] = p.feeAmount;
        enabled[p.categorySlug] = p.enabled;
      });
      setLocalFees(fees);
      setLocalEnabled(enabled);
      setDirty(new Set());
    } catch {
      toast({ title: "Failed to load protection plans", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const markDirty = (slug: string) => {
    setDirty(prev => new Set([...prev, slug]));
  };

  const handleToggle = (slug: string, value: boolean) => {
    setLocalEnabled(prev => ({ ...prev, [slug]: value }));
    markDirty(slug);
  };

  const handleFee = (slug: string, value: string) => {
    setLocalFees(prev => ({ ...prev, [slug]: value }));
    markDirty(slug);
  };

  const save = async (slug: string) => {
    setSaving(slug);
    try {
      const r = await sa(`/superadmin/protection-plans/${slug}`, {
        method: "PUT",
        body: JSON.stringify({
          enabled: localEnabled[slug],
          feeAmount: parseFloat(localFees[slug] || "0"),
        }),
      });
      if (!r.ok) throw new Error("Save failed");
      const updated: Plan = await r.json();
      setPlans(prev => prev.map(p => p.categorySlug === slug ? updated : p));
      setDirty(prev => { const next = new Set(prev); next.delete(slug); return next; });
      toast({ title: `${updated.categoryName} protection plan saved` });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const enabledCount = plans.filter(p => localEnabled[p.categorySlug]).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(58,181,73,0.15)" }}>
              <Shield className="w-5 h-5" style={{ color: "#3ab549" }} />
            </div>
            Protection Plans
          </h1>
          <p className="text-slate-400 mt-1.5 text-sm">
            Define which rental categories include the OutdoorShare Protection Plan and set the platform-wide flat fee.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-center min-w-[80px]">
            <p className="text-2xl font-black text-white">{enabledCount}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Active</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-center min-w-[80px]">
            <p className="text-2xl font-black text-slate-400">{plans.length - enabledCount}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Off</p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-sm">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-slate-400 leading-relaxed">
          When enabled for a category, the Protection Plan appears as a required add-on on every listing in that category across all tenants. The flat fee is charged once per booking regardless of rental duration.
        </p>
      </div>

      {/* Plans grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading protection plans…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map(plan => {
            const slug = plan.categorySlug;
            const isEnabled = localEnabled[slug] ?? plan.enabled;
            const fee = localFees[slug] ?? plan.feeAmount;
            const isDirty = dirty.has(slug);
            const isSaving = saving === slug;

            return (
              <div
                key={slug}
                className={`rounded-2xl border transition-all ${
                  isEnabled
                    ? "bg-slate-800 border-green-700/50 shadow-[0_0_0_1px_rgba(58,181,73,0.15)]"
                    : "bg-slate-800/60 border-slate-700"
                }`}
              >
                {/* Card header */}
                <div className="flex items-center justify-between p-4 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{CATEGORY_ICONS[slug] ?? "📦"}</span>
                    <div>
                      <p className="font-semibold text-white leading-tight">{plan.categoryName}</p>
                      {isEnabled ? (
                        <Badge className="mt-0.5 text-[10px] px-1.5 py-0 h-4 rounded-full font-semibold"
                          style={{ background: "rgba(58,181,73,0.2)", color: "#3ab549", border: "1px solid rgba(58,181,73,0.3)" }}>
                          <ShieldCheck className="w-2.5 h-2.5 mr-0.5" /> Active
                        </Badge>
                      ) : (
                        <Badge className="mt-0.5 text-[10px] px-1.5 py-0 h-4 rounded-full font-semibold bg-slate-700 text-slate-400 border-slate-600">
                          <ShieldOff className="w-2.5 h-2.5 mr-0.5" /> Inactive
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={v => handleToggle(slug, v)}
                    className="data-[state=checked]:bg-green-600"
                  />
                </div>

                <div className="px-4 pb-4 space-y-3">
                  {/* Fee input */}
                  <div>
                    <label className="text-xs text-slate-400 font-medium mb-1.5 block">
                      Flat Fee (per booking)
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={fee}
                        onChange={e => handleFee(slug, e.target.value)}
                        disabled={!isEnabled}
                        className="pl-8 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 h-9 text-sm disabled:opacity-40"
                        placeholder="0"
                      />
                    </div>
                    {isEnabled && parseFloat(fee) === 0 && (
                      <p className="text-[11px] text-amber-500 flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3" /> Fee is $0 — set an amount before enabling
                      </p>
                    )}
                  </div>

                  {/* Save button */}
                  {isDirty && (
                    <Button
                      size="sm"
                      className="w-full h-8 text-xs font-semibold gap-1.5 text-white"
                      style={{ background: "#3ab549" }}
                      onClick={() => save(slug)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                      ) : (
                        <><Save className="w-3.5 h-3.5" /> Save Changes</>
                      )}
                    </Button>
                  )}

                  {!isDirty && isEnabled && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <ShieldCheck className="w-3 h-3 text-green-600" />
                      <span>Fee: <span className="text-white font-semibold">${parseFloat(plan.feeAmount).toFixed(2)}</span> per booking</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
