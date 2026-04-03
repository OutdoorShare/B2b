import { adminPath } from "@/lib/admin-nav";
import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, ShieldAlert, User, CalendarDays,
  AlertTriangle, Clock, CheckCircle2, XCircle,
  DollarSign, Image as ImageIcon, Trash2, Plus, Package
} from "lucide-react";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ClaimStatus = "open" | "reviewing" | "resolved" | "denied";
type ClaimType = "damage" | "theft" | "overage" | "dispute" | "policy_violation" | "other";

interface Claim {
  id: number;
  bookingId: number | null;
  listingId: number | null;
  customerName: string;
  customerEmail: string;
  type: ClaimType;
  description: string;
  claimedAmount: number | null;
  settledAmount: number | null;
  chargeStatus: string | null;
  chargedAmount: number | null;
  stripeChargeRefs: string | null;
  status: ClaimStatus;
  adminNotes: string | null;
  evidenceUrls: string | null;
  createdAt: string;
  updatedAt: string;
  booking?: { id: number; startDate: string; endDate: string; totalPrice: string } | null;
  listing?: { id: number; title: string; imageUrls?: string[] } | null;
}

const STATUS_OPTIONS: { value: ClaimStatus; label: string; icon: any; color: string; badge: string }[] = [
  { value: "open",      label: "Open",      icon: AlertTriangle, color: "text-red-600",          badge: "bg-red-100 text-red-800" },
  { value: "reviewing", label: "Reviewing", icon: Clock,         color: "text-amber-600",         badge: "bg-amber-100 text-amber-800" },
  { value: "resolved",  label: "Resolved",  icon: CheckCircle2,  color: "text-green-600",         badge: "bg-green-100 text-green-800" },
  { value: "denied",    label: "Denied",    icon: XCircle,       color: "text-muted-foreground",  badge: "bg-muted text-muted-foreground" },
];

const TYPE_BADGE: Record<ClaimType, string> = {
  damage:           "bg-orange-100 text-orange-800",
  theft:            "bg-red-100 text-red-800",
  overage:          "bg-purple-100 text-purple-800",
  policy_violation: "bg-amber-100 text-amber-800",
  dispute:  "bg-blue-100 text-blue-800",
  other:    "bg-muted text-muted-foreground",
};

const STATUS_FLOW: ClaimStatus[] = ["open", "reviewing", "resolved", "denied"];

export default function AdminClaimDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ slug: string; id: string }>();
  const { toast } = useToast();
  const claimId = params?.id ? parseInt(params.id) : 0;

  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [status, setStatus] = useState<ClaimStatus>("open");
  const [adminNotes, setAdminNotes] = useState("");
  const [settledAmount, setSettledAmount] = useState("");
  const [claimedAmount, setClaimedAmount] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ClaimType>("damage");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [newEvidenceUrl, setNewEvidenceUrl] = useState("");

  const fetchClaim = async () => {
    try {
      const res = await fetch(`${BASE}/api/claims/${claimId}`);
      const data = await res.json();
      if (!res.ok) return;
      setClaim(data);
      setStatus(data.status);
      setAdminNotes(data.adminNotes ?? "");
      setSettledAmount(data.settledAmount != null ? String(data.settledAmount) : "");
      setClaimedAmount(data.claimedAmount != null ? String(data.claimedAmount) : "");
      setDescription(data.description ?? "");
      setType(data.type);
      try { setEvidenceUrls(data.evidenceUrls ? JSON.parse(data.evidenceUrls) : []); }
      catch { setEvidenceUrls([]); }
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { if (claimId) fetchClaim(); }, [claimId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/claims/${claimId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          adminNotes: adminNotes || null,
          settledAmount: settledAmount ? parseFloat(settledAmount) : null,
          claimedAmount: claimedAmount ? parseFloat(claimedAmount) : null,
          description,
          type,
          evidenceUrls: evidenceUrls.length > 0 ? evidenceUrls : null,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setClaim(prev => prev ? { ...prev, ...updated } : updated);
      toast({ title: "Claim updated" });
    } catch {
      toast({ title: "Failed to save changes", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm("Permanently delete this claim? This cannot be undone.")) return;
    try {
      await fetch(`${BASE}/api/claims/${claimId}`, { method: "DELETE" });
      toast({ title: "Claim deleted" });
      setLocation(adminPath("/claims"));
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const addEvidence = () => {
    const url = newEvidenceUrl.trim();
    if (!url) return;
    setEvidenceUrls(prev => [...prev, url]);
    setNewEvidenceUrl("");
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="h-64 bg-muted rounded-2xl" />
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center py-24 text-muted-foreground">
        <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-muted" />
        <p className="font-semibold">Claim not found</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation(adminPath("/claims"))}>
          Back to Claims
        </Button>
      </div>
    );
  }

  const currentStepIdx = STATUS_FLOW.indexOf(status);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation(adminPath("/claims"))} className="-ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">Claim #{claim.id}</h1>
              {STATUS_OPTIONS.find(s => s.value === claim.status) && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_OPTIONS.find(s => s.value === claim.status)!.badge}`}>
                  {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                </span>
              )}
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE[claim.type]}`}>
                {claim.type.charAt(0).toUpperCase() + claim.type.slice(1)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Filed {format(new Date(claim.createdAt), "MMMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive border-destructive/30 hover:bg-destructive/10">
          <Trash2 className="w-4 h-4 mr-1.5" /> Delete
        </Button>
      </div>

      {/* Status stepper */}
      <div className="bg-background rounded-2xl border p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Claim Progress</p>
        <div className="flex items-center gap-0">
          {STATUS_FLOW.map((s, i) => {
            const cfg = STATUS_OPTIONS.find(o => o.value === s)!;
            const done = i < currentStepIdx;
            const active = i === currentStepIdx;
            return (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <button
                  onClick={() => setStatus(s)}
                  className={`flex items-center gap-2 text-xs font-semibold transition-colors rounded-lg px-2 py-1
                    ${active ? "text-foreground" : done ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors
                    ${active ? "bg-foreground text-background" : done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : <cfg.icon className="w-4 h-4" />}
                  </div>
                  <span className="hidden sm:block">{cfg.label}</span>
                </button>
                {i < STATUS_FLOW.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 rounded transition-colors ${done ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* LEFT: Claim info */}
        <div className="lg:col-span-3 space-y-5">

          {/* Customer */}
          <div className="bg-background rounded-2xl border p-5 space-y-4">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-primary" /> Customer
            </h3>
            <div className="space-y-1">
              <p className="font-bold">{claim.customerName}</p>
              <p className="text-sm text-muted-foreground">{claim.customerEmail}</p>
            </div>
          </div>

          {/* Linked booking / listing */}
          {(claim.booking || claim.listing) && (
            <div className="bg-background rounded-2xl border p-5 space-y-3">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <CalendarDays className="w-4 h-4 text-primary" /> Rental Details
              </h3>
              {claim.listing && (
                <div className="flex items-center gap-3">
                  {claim.listing.imageUrls?.[0] ? (
                    <img src={claim.listing.imageUrls[0]} alt={claim.listing.title} className="w-14 h-10 object-cover rounded-lg" />
                  ) : (
                    <div className="w-14 h-10 bg-muted rounded-lg flex items-center justify-center">
                      <Package className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-sm">{claim.listing.title}</p>
                    <p className="text-xs text-muted-foreground">Listing #{claim.listing.id}</p>
                  </div>
                </div>
              )}
              {claim.booking && (
                <div className="text-sm space-y-1">
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-foreground">Booking #{claim.booking.id}</span>
                    {" · "}{claim.booking.startDate} → {claim.booking.endDate}
                  </p>
                  <p className="text-muted-foreground">
                    Booking total: <span className="font-semibold text-foreground">${parseFloat(claim.booking.totalPrice).toFixed(2)}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div className="bg-background rounded-2xl border p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <ShieldAlert className="w-4 h-4 text-primary" /> Claim Details
            </h3>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="damage">Damage</SelectItem>
                  <SelectItem value="theft">Theft</SelectItem>
                  <SelectItem value="overage">Overage</SelectItem>
                  <SelectItem value="dispute">Dispute</SelectItem>
                  <SelectItem value="policy_violation">Policy Violation</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe the incident…"
              />
            </div>
          </div>

          {/* Evidence URLs */}
          <div className="bg-background rounded-2xl border p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <ImageIcon className="w-4 h-4 text-primary" /> Evidence Photos
            </h3>
            {evidenceUrls.length === 0 ? (
              <p className="text-sm text-muted-foreground">No photos attached.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {evidenceUrls.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt={`Evidence ${i + 1}`} className="w-full h-24 object-cover rounded-lg border" onError={e => (e.currentTarget.style.display = "none")} />
                    <button
                      type="button"
                      onClick={() => setEvidenceUrls(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={newEvidenceUrl}
                onChange={e => setNewEvidenceUrl(e.target.value)}
                placeholder="Paste image URL…"
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addEvidence())}
              />
              <Button type="button" variant="outline" size="icon" onClick={addEvidence}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* RIGHT: Management panel */}
        <div className="lg:col-span-2 space-y-5">

          {/* Status + Amounts */}
          <div className="bg-background rounded-2xl border p-5 space-y-4">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-primary" /> Resolution
            </h3>

            {/* Deposit auto-capture notice */}
            {claim.chargeStatus === "deposit_captured" && (
              <div className="flex items-start gap-2.5 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-green-800">Security deposit captured</p>
                  <p className="text-green-700 text-xs mt-0.5">
                    ${claim.chargedAmount != null ? Number(claim.chargedAmount).toFixed(2) : "—"} sent to OutdoorShare upon claim submission.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      <div className="flex items-center gap-2">
                        <s.icon className={`w-4 h-4 ${s.color}`} />
                        {s.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Claimed Amount ($)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={claimedAmount}
                  onChange={e => setClaimedAmount(e.target.value)}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Settled Amount ($)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settledAmount}
                  onChange={e => setSettledAmount(e.target.value)}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-muted-foreground">Amount agreed for resolution.</p>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label>Admin Notes</Label>
              <Textarea
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                rows={5}
                placeholder="Internal notes about this claim…"
              />
            </div>

            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>

          {/* Quick info */}
          <div className="bg-muted/30 rounded-2xl border p-4 text-xs space-y-2 text-muted-foreground">
            <p><span className="font-semibold text-foreground">Created:</span> {format(new Date(claim.createdAt), "PPp")}</p>
            <p><span className="font-semibold text-foreground">Last updated:</span> {format(new Date(claim.updatedAt), "PPp")}</p>
            {claim.bookingId && <p><span className="font-semibold text-foreground">Booking ref:</span> #{claim.bookingId}</p>}
            {claim.listingId && <p><span className="font-semibold text-foreground">Listing ref:</span> #{claim.listingId}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
