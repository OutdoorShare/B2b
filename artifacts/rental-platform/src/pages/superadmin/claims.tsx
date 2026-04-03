import { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert, Search, RefreshCcw, ChevronRight, X,
  CheckCircle2, Clock, XCircle, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function getToken() { return localStorage.getItem("superadmin_token") ?? ""; }
async function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-superadmin-token": getToken(), ...opts?.headers },
  });
}

type Claim = {
  id: number;
  tenantId: number | null;
  bookingId: number | null;
  listingId: number | null;
  customerName: string;
  customerEmail: string;
  type: string;
  description: string;
  claimedAmount: number | null;
  settledAmount: number | null;
  status: string;
  adminNotes: string | null;
  evidenceUrls: string | null;
  companyName: string | null;
  companySlug: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  open:       { label: "Open",       color: "bg-red-500/20 text-red-400 border-red-500/30",     icon: AlertCircle },
  reviewing:  { label: "Reviewing",  color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
  resolved:   { label: "Resolved",   color: "bg-green-500/20 text-green-400 border-green-500/30",   icon: CheckCircle2 },
  denied:     { label: "Denied",     color: "bg-slate-500/20 text-slate-400 border-slate-500/30",   icon: XCircle },
};

const TYPE_LABELS: Record<string, string> = {
  damage: "Damage", theft: "Theft", overage: "Overage", dispute: "Dispute",
  policy_violation: "Policy Violation", other: "Other",
};

const STATUSES = ["all", "open", "reviewing", "resolved", "denied"];
const TYPES    = ["all", "damage", "theft", "overage", "dispute", "policy_violation", "other"];

export default function SuperAdminClaims() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<Claim | null>(null);

  // cancellation policy fetched for the selected claim's tenant
  const [claimPolicy, setClaimPolicy] = useState<{ cancellationPolicy?: string; rentalTerms?: string } | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);

  // edit state for detail panel
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSettled, setEditSettled] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      const r = await apiFetch(`/superadmin/claims?${params}`);
      const data = await r.json();
      setClaims(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  function openDetail(c: Claim) {
    setSelected(c);
    setEditStatus(c.status);
    setEditNotes(c.adminNotes ?? "");
    setEditSettled(c.settledAmount != null ? String(c.settledAmount) : "");
    setSaveError("");
    setClaimPolicy(null);
    if (c.tenantId) {
      setPolicyLoading(true);
      apiFetch(`/superadmin/tenants/${c.tenantId}/business`)
        .then(r => r.json())
        .then(d => setClaimPolicy({ cancellationPolicy: d.cancellationPolicy, rentalTerms: d.rentalTerms }))
        .catch(() => setClaimPolicy(null))
        .finally(() => setPolicyLoading(false));
    }
  }

  async function saveClaim() {
    if (!selected) return;
    setSaving(true);
    setSaveError("");
    try {
      const r = await apiFetch(`/superadmin/claims/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: editStatus,
          adminNotes: editNotes || null,
          settledAmount: editSettled !== "" ? parseFloat(editSettled) : null,
        }),
      });
      if (!r.ok) throw new Error("Failed to save");
      const updated = await r.json();
      setClaims(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
      setSelected({ ...selected, ...updated });
    } catch {
      setSaveError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const filtered = claims.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.customerName.toLowerCase().includes(q) ||
      c.customerEmail.toLowerCase().includes(q) ||
      (c.companyName ?? "").toLowerCase().includes(q) ||
      String(c.id).includes(q)
    );
  });

  // Summary counts
  const openCount      = claims.filter(c => c.status === "open").length;
  const reviewingCount = claims.filter(c => c.status === "reviewing").length;
  const resolvedCount  = claims.filter(c => c.status === "resolved").length;

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Claims</h1>
            <p className="text-slate-400 text-sm">All claims across every company</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={load} className="text-slate-400 hover:text-white gap-1.5">
          <RefreshCcw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Open",      count: openCount,      color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20" },
          { label: "Reviewing", count: reviewingCount, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
          { label: "Resolved",  count: resolvedCount,  color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
            <p className="text-slate-400 text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, company…"
            className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 h-9"
          />
        </div>
        <div className="flex gap-1 bg-slate-900 border border-slate-700 rounded-lg p-1 flex-wrap">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize
                ${statusFilter === s ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"}`}
            >
              {s === "all" ? "All Status" : s}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-slate-900 border border-slate-700 rounded-lg p-1 flex-wrap">
          {TYPES.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors
                ${typeFilter === t ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"}`}
            >
              {t === "all" ? "All Types" : TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Table + Detail panel split */}
      <div className="flex gap-6 min-h-[400px]">
        {/* Claims Table */}
        <div className={`flex-1 overflow-x-auto ${selected ? "hidden lg:block" : ""}`}>
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-500">Loading claims…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-2">
              <ShieldAlert className="w-10 h-10 opacity-20" />
              <p>No claims found</p>
            </div>
          ) : (
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  {["#", "Company", "Customer", "Type", "Claimed", "Status", "Date", ""].map(h => (
                    <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 border-b border-slate-800 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const sc = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.open;
                  const Icon = sc.icon;
                  const isActive = selected?.id === c.id;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => openDetail(c)}
                      className={`cursor-pointer transition-colors group ${isActive ? "bg-slate-800" : "hover:bg-slate-900"}`}
                    >
                      <td className="py-3 px-3 text-slate-400 font-mono text-xs border-b border-slate-800/60">#{c.id}</td>
                      <td className="py-3 px-3 border-b border-slate-800/60">
                        <p className="text-white font-medium text-xs">{c.companyName ?? "—"}</p>
                        {c.companySlug && <p className="text-slate-500 text-[10px] font-mono">/{c.companySlug}</p>}
                      </td>
                      <td className="py-3 px-3 border-b border-slate-800/60">
                        <p className="text-slate-200 text-xs">{c.customerName}</p>
                        <p className="text-slate-500 text-[10px]">{c.customerEmail}</p>
                      </td>
                      <td className="py-3 px-3 border-b border-slate-800/60">
                        <span className="text-slate-300 text-xs capitalize">{TYPE_LABELS[c.type] ?? c.type}</span>
                      </td>
                      <td className="py-3 px-3 border-b border-slate-800/60 text-slate-300 text-xs">
                        {c.claimedAmount != null ? `$${c.claimedAmount.toFixed(2)}` : "—"}
                      </td>
                      <td className="py-3 px-3 border-b border-slate-800/60">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sc.color}`}>
                          <Icon className="w-3 h-3" />{sc.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 border-b border-slate-800/60 text-slate-500 text-xs whitespace-nowrap">
                        {format(new Date(c.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="py-3 px-3 border-b border-slate-800/60">
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="w-full lg:w-96 shrink-0 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 overflow-y-auto max-h-[calc(100vh-280px)]">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold">Claim #{selected.id}</h2>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Meta */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Company</span>
                <span className="text-slate-200 font-medium">{selected.companyName ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer</span>
                <span className="text-slate-200">{selected.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email</span>
                <span className="text-slate-200 text-xs">{selected.customerEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Type</span>
                <span className="text-slate-200 capitalize">{TYPE_LABELS[selected.type] ?? selected.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Claimed</span>
                <span className="text-slate-200">{selected.claimedAmount != null ? `$${selected.claimedAmount.toFixed(2)}` : "—"}</span>
              </div>
              {selected.bookingId && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Booking</span>
                  <span className="text-slate-400 font-mono text-xs">#{selected.bookingId}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Filed</span>
                <span className="text-slate-400 text-xs">{format(new Date(selected.createdAt), "MMM d, yyyy h:mm a")}</span>
              </div>
            </div>

            {/* Description */}
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-1.5">Description</p>
              <p className="text-slate-300 text-sm leading-relaxed bg-slate-800 rounded-lg p-3">{selected.description}</p>
            </div>

            {/* Cancellation Policy */}
            {(policyLoading || claimPolicy?.cancellationPolicy) && (
              <div>
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-1.5">
                  Cancellation Policy
                  {selected.companyName && <span className="normal-case font-normal ml-1 text-slate-600">— {selected.companyName}</span>}
                </p>
                {policyLoading ? (
                  <p className="text-slate-500 text-xs italic">Loading…</p>
                ) : claimPolicy?.cancellationPolicy ? (
                  <div className="bg-amber-950/40 border border-amber-700/50 rounded-lg p-3">
                    <p className="text-amber-200 text-xs leading-relaxed whitespace-pre-wrap">{claimPolicy.cancellationPolicy}</p>
                  </div>
                ) : null}
                {!policyLoading && claimPolicy?.rentalTerms && (
                  <details className="mt-2">
                    <summary className="text-slate-500 text-xs cursor-pointer hover:text-slate-400 select-none">
                      View rental terms ›
                    </summary>
                    <div className="mt-2 bg-slate-800/60 border border-slate-700 rounded-lg p-3">
                      <p className="text-slate-400 text-xs leading-relaxed whitespace-pre-wrap">{claimPolicy.rentalTerms}</p>
                    </div>
                  </details>
                )}
              </div>
            )}
            {!policyLoading && claimPolicy && !claimPolicy.cancellationPolicy && (
              <div>
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-1.5">Cancellation Policy</p>
                <p className="text-slate-600 text-xs italic">No cancellation policy set by this company.</p>
              </div>
            )}

            {/* Evidence */}
            {selected.evidenceUrls && (() => {
              try {
                const urls: string[] = JSON.parse(selected.evidenceUrls);
                if (urls.length > 0) return (
                  <div>
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-1.5">Evidence ({urls.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 underline">File {i + 1}</a>
                      ))}
                    </div>
                  </div>
                );
              } catch { return null; }
            })()}

            <div className="border-t border-slate-800" />

            {/* Edit fields */}
            <div className="space-y-4">
              <div>
                <Label className="text-slate-400 text-xs mb-1.5 block">Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="reviewing">Reviewing</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="denied">Denied</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-slate-400 text-xs mb-1.5 block">Settled Amount ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editSettled}
                  onChange={e => setEditSettled(e.target.value)}
                  placeholder="0.00"
                  className="bg-slate-800 border-slate-700 text-white h-9"
                />
              </div>

              <div>
                <Label className="text-slate-400 text-xs mb-1.5 block">Admin Notes</Label>
                <Textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Internal notes about this claim…"
                  rows={3}
                  className="bg-slate-800 border-slate-700 text-white text-sm resize-none"
                />
              </div>

              {saveError && <p className="text-red-400 text-xs">{saveError}</p>}

              <Button onClick={saveClaim} disabled={saving} className="w-full bg-[#3ab549] hover:bg-[#2d9c3a] text-white font-bold">
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
