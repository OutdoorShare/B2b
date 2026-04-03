import { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert, Search, RefreshCcw, ChevronRight, X,
  CheckCircle2, Clock, XCircle, AlertCircle, DollarSign, RotateCcw, Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  chargedAmount: number | null;
  chargeStatus: string | null;
  stripeChargeRefs: string | null;
  refundAmount: number | null;
  refundStatus: string | null;
  stripeRefundId: string | null;
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

  // settlement / refund state (shown when resolving a claim with captured deposit)
  const [noRefund, setNoRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [showSettleConfirm, setShowSettleConfirm] = useState(false);

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
    setNoRefund(false);
    // If deposit was already captured, default refund = captured - settled (or full)
    const charged = c.chargedAmount ?? 0;
    const settled = c.settledAmount ?? 0;
    setRefundAmount(charged > 0 ? Math.max(0, charged - settled).toFixed(2) : "");
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

  // Whether to show the settlement/refund section
  const showSettlementSection =
    editStatus === "resolved" &&
    selected?.chargeStatus === "deposit_captured" &&
    (selected?.chargedAmount ?? 0) > 0 &&
    selected?.status !== "resolved"; // only show if not already resolved

  // Auto-update refund amount when settled amount changes (if not "no refund")
  useEffect(() => {
    if (!selected || noRefund) return;
    const charged = selected.chargedAmount ?? 0;
    const kept = parseFloat(editSettled) || 0;
    const computed = Math.max(0, charged - kept);
    setRefundAmount(computed.toFixed(2));
  }, [editSettled, selected?.chargedAmount, noRefund]);

  // When noRefund toggled, clear refundAmount
  useEffect(() => {
    if (noRefund) setRefundAmount("0.00");
    else if (selected) {
      const charged = selected.chargedAmount ?? 0;
      const kept = parseFloat(editSettled) || 0;
      setRefundAmount(Math.max(0, charged - kept).toFixed(2));
    }
  }, [noRefund]);

  async function saveClaim() {
    if (!selected) return;
    // If resolving with a deposit, use the settle flow
    if (showSettlementSection) {
      setShowSettleConfirm(true);
      return;
    }
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
      setSelected(prev => prev ? { ...prev, ...updated } : null);
    } catch {
      setSaveError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmSettle() {
    if (!selected) return;
    setShowSettleConfirm(false);
    setSaving(true);
    setSaveError("");
    try {
      const r = await apiFetch(`/superadmin/claims/${selected.id}/settle`, {
        method: "POST",
        body: JSON.stringify({
          settledAmount: editSettled !== "" ? parseFloat(editSettled) : null,
          refundAmount: parseFloat(refundAmount) || 0,
          noRefund,
          adminNotes: editNotes || null,
        }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error ?? "Failed to settle");
      }
      const updated = await r.json();
      setClaims(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
      setSelected(prev => prev ? { ...prev, ...updated } : null);
    } catch (e: any) {
      setSaveError(e.message ?? "Failed to settle claim. Please try again.");
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

  const openCount      = claims.filter(c => c.status === "open").length;
  const reviewingCount = claims.filter(c => c.status === "reviewing").length;
  const resolvedCount  = claims.filter(c => c.status === "resolved").length;

  const refundFloat = parseFloat(refundAmount) || 0;
  const chargedDisplay = selected?.chargedAmount ? `$${selected.chargedAmount.toFixed(2)}` : "$0.00";

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Settle Confirmation Dialog */}
      <AlertDialog open={showSettleConfirm} onOpenChange={setShowSettleConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Resolve & Settle Claim #{selected?.id}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-1">
                <p className="text-sm text-muted-foreground">
                  This will mark the claim as <strong>Resolved</strong> and process the following settlement:
                </p>
                <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deposit captured</span>
                    <span className="font-semibold">{chargedDisplay}</span>
                  </div>
                  {editSettled !== "" && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Damages settled (kept)</span>
                      <span className="font-semibold">${parseFloat(editSettled).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 mt-1">
                    <span className="font-semibold">Refund to renter</span>
                    <span className={`font-bold ${noRefund || refundFloat === 0 ? "text-red-500" : "text-green-500"}`}>
                      {noRefund || refundFloat === 0 ? "No refund" : `$${refundFloat.toFixed(2)}`}
                    </span>
                  </div>
                </div>
                {!noRefund && refundFloat > 0 && (
                  <p className="text-xs text-muted-foreground">
                    A Stripe refund of <strong>${refundFloat.toFixed(2)}</strong> will be issued to the renter's original payment method. A settlement email will be sent to <strong>{selected?.customerEmail}</strong>.
                  </p>
                )}
                {(noRefund || refundFloat === 0) && (
                  <p className="text-xs text-muted-foreground">
                    No refund will be issued. The renter will be notified via email that their claim has been resolved.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSettle}
              className={refundFloat > 0 && !noRefund ? "bg-green-600 hover:bg-green-700 text-white" : "bg-slate-600 hover:bg-slate-700 text-white"}
            >
              {refundFloat > 0 && !noRefund ? `Resolve & Refund $${refundFloat.toFixed(2)}` : "Resolve — No Refund"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                  {["#", "Company", "Customer", "Type", "Claimed", "Deposit", "Status", "Date", ""].map(h => (
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
                      <td className="py-3 px-3 border-b border-slate-800/60 text-xs">
                        {c.chargeStatus === "deposit_captured" ? (
                          <span className="text-amber-400 font-medium">${(c.chargedAmount ?? 0).toFixed(2)} held</span>
                        ) : c.refundStatus === "full" ? (
                          <span className="text-green-400 text-[10px]">Full refund</span>
                        ) : c.refundStatus === "partial" ? (
                          <span className="text-blue-400 text-[10px]">Partial refund</span>
                        ) : c.refundStatus === "none" && c.status === "resolved" ? (
                          <span className="text-slate-500 text-[10px]">No refund</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
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
          <div className="w-full lg:w-[420px] shrink-0 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 overflow-y-auto max-h-[calc(100vh-280px)]">
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
              {selected.chargeStatus === "deposit_captured" && selected.chargedAmount != null && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Deposit Captured</span>
                  <span className="text-amber-400 font-semibold">${selected.chargedAmount.toFixed(2)}</span>
                </div>
              )}
              {selected.refundStatus && selected.status === "resolved" && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Refund Issued</span>
                  <span className={`font-semibold ${selected.refundStatus === "none" ? "text-slate-400" : "text-green-400"}`}>
                    {selected.refundStatus === "none"
                      ? "No refund"
                      : selected.refundAmount != null
                        ? `$${selected.refundAmount.toFixed(2)} (${selected.refundStatus})`
                        : selected.refundStatus}
                  </span>
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
                <Label className="text-slate-400 text-xs mb-1.5 block">Settled Amount ($) — damages kept</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                  <Input
                    type="number" min="0" step="0.01"
                    value={editSettled}
                    onChange={e => setEditSettled(e.target.value)}
                    placeholder="0.00"
                    className="bg-slate-800 border-slate-700 text-white h-9 pl-7"
                  />
                </div>
              </div>

              {/* ── Settlement & Refund Section ── */}
              {showSettlementSection && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-amber-400" />
                    <p className="text-amber-300 font-semibold text-sm">Deposit Refund</p>
                  </div>
                  <p className="text-amber-200/70 text-xs leading-relaxed">
                    This claim has a captured security deposit of <strong className="text-amber-300">{chargedDisplay}</strong>.
                    Specify how much to refund to the renter — the remainder stays with the company.
                  </p>

                  {/* Deposit breakdown */}
                  <div className="bg-slate-800/60 rounded-lg p-3 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Deposit captured</span>
                      <span className="font-mono text-amber-400">{chargedDisplay}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Damages kept</span>
                      <span className="font-mono">${(parseFloat(editSettled) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-700 pt-2 font-semibold">
                      <span className={noRefund ? "text-slate-400" : "text-green-400"}>Refund to renter</span>
                      <span className={`font-mono ${noRefund ? "text-slate-500 line-through" : "text-green-400"}`}>
                        ${(parseFloat(refundAmount) || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* No refund toggle */}
                  <div className="flex items-center justify-between rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Ban className="w-4 h-4 text-red-400" />
                      <span className="text-sm text-slate-300">No refund applicable</span>
                    </div>
                    <Switch
                      checked={noRefund}
                      onCheckedChange={setNoRefund}
                      className="data-[state=checked]:bg-red-500"
                    />
                  </div>

                  {!noRefund && (
                    <div>
                      <Label className="text-slate-400 text-xs mb-1.5 block">Refund amount to renter ($)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                        <Input
                          type="number" min="0" step="0.01"
                          max={selected.chargedAmount ?? undefined}
                          value={refundAmount}
                          onChange={e => setRefundAmount(e.target.value)}
                          className="bg-slate-800 border-slate-700 text-white h-9 pl-7"
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Max: {chargedDisplay} (full deposit). A renter email will be sent automatically.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Already settled info for resolved claims */}
              {selected.status === "resolved" && selected.refundStatus && (
                <div className={`rounded-lg border px-3 py-2.5 text-xs flex items-start gap-2 ${
                  selected.refundStatus === "none"
                    ? "bg-slate-800/60 border-slate-700 text-slate-400"
                    : "bg-green-500/10 border-green-500/30 text-green-300"
                }`}>
                  {selected.refundStatus === "none"
                    ? <><Ban className="w-3.5 h-3.5 mt-0.5 shrink-0" /> No refund was issued for this claim.</>
                    : <><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-400" />
                        Refund of <strong className="mx-1">${(selected.refundAmount ?? 0).toFixed(2)}</strong>
                        ({selected.refundStatus}) was processed.
                        {selected.stripeRefundId && <span className="ml-1 font-mono text-[10px] text-slate-500">re_{selected.stripeRefundId?.slice(-6)}</span>}
                      </>
                  }
                </div>
              )}

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

              <Button
                onClick={saveClaim}
                disabled={saving}
                className={`w-full font-bold text-white ${
                  showSettlementSection
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-[#3ab549] hover:bg-[#2d9c3a]"
                }`}
              >
                {saving
                  ? "Processing…"
                  : showSettlementSection
                    ? noRefund || parseFloat(refundAmount) === 0
                      ? "Resolve — No Refund"
                      : `Resolve & Refund $${(parseFloat(refundAmount) || 0).toFixed(2)}`
                    : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
