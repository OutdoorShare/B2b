import { useState, useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft, ShieldAlert, ShieldCheck, ShieldX, Clock,
  Calendar, Package, AlertCircle, CheckCircle2, XCircle,
  DollarSign, FileText, ExternalLink, Building2, MessageSquarePlus,
  AlertTriangle, Loader2, CheckCircle,
} from "lucide-react";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CustomerSession { id: number; email: string; name: string; }

function loadSession(): CustomerSession | null {
  try { const raw = localStorage.getItem("rental_customer"); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

type ClaimStatus = "open" | "reviewing" | "resolved" | "denied";
type ClaimType = "damage" | "theft" | "overage" | "dispute" | "policy_violation" | "other";
type DisputeStatus = "submitted" | "under_review" | "upheld" | "rejected" | null;

interface RenterClaim {
  id: number;
  type: ClaimType;
  description: string;
  claimedAmount: number | null;
  settledAmount: number | null;
  chargedAmount: number | null;
  refundAmount: number | null;
  refundStatus: string | null;
  status: ClaimStatus;
  evidenceUrls: string[];
  disputeStatus: DisputeStatus;
  disputeNote: string | null;
  disputedAt: string | null;
  createdAt: string;
  updatedAt: string;
  bookingId: number | null;
  listingTitle: string | null;
  listingImage: string | null;
  startDate: string | null;
  endDate: string | null;
  tenantSlug: string | null;
  businessName: string | null;
  businessLogo: string | null;
}

function statusConfig(status: ClaimStatus) {
  switch (status) {
    case "open":       return { label: "Open",       color: "bg-yellow-100 text-yellow-800 border-yellow-300",  icon: <Clock className="w-3.5 h-3.5" />, dot: "bg-yellow-400" };
    case "reviewing":  return { label: "Reviewing",  color: "bg-blue-100 text-blue-800 border-blue-300",        icon: <AlertCircle className="w-3.5 h-3.5" />, dot: "bg-blue-400" };
    case "resolved":   return { label: "Resolved",   color: "bg-green-100 text-green-800 border-green-300",     icon: <CheckCircle2 className="w-3.5 h-3.5" />, dot: "bg-green-500" };
    case "denied":     return { label: "Denied",     color: "bg-gray-100 text-gray-700 border-gray-300",        icon: <XCircle className="w-3.5 h-3.5" />, dot: "bg-gray-400" };
  }
}

function typeLabel(type: ClaimType) {
  switch (type) {
    case "damage":           return "Damage";
    case "theft":            return "Theft";
    case "overage":          return "Overage";
    case "dispute":          return "Dispute";
    case "policy_violation": return "Policy Violation";
    case "other":            return "Other";
  }
}

function disputeStatusConfig(ds: DisputeStatus) {
  switch (ds) {
    case "submitted":    return { label: "Dispute Submitted",   color: "bg-amber-100 text-amber-800 border-amber-300",  icon: <Clock className="w-3 h-3" /> };
    case "under_review": return { label: "Under Review",        color: "bg-blue-100 text-blue-800 border-blue-300",     icon: <AlertCircle className="w-3 h-3" /> };
    case "upheld":       return { label: "Dispute Upheld",      color: "bg-green-100 text-green-800 border-green-300",  icon: <CheckCircle className="w-3 h-3" /> };
    case "rejected":     return { label: "Dispute Rejected",    color: "bg-gray-100 text-gray-600 border-gray-300",     icon: <XCircle className="w-3 h-3" /> };
    default:             return null;
  }
}

export default function MyClaimsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const base = slug ? `/${slug}` : "";

  const [session, setSession] = useState<CustomerSession | null>(null);
  const [claims, setClaims] = useState<RenterClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Dispute dialog state
  const [disputeClaimId, setDisputeClaimId] = useState<number | null>(null);
  const [disputeNote, setDisputeNote] = useState("");
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeSuccess, setDisputeSuccess] = useState<number | null>(null); // claimId of success

  useEffect(() => {
    const s = loadSession();
    if (!s) { setLocation(`${base}/login?redirect=${encodeURIComponent(`${base}/my-claims`)}`); return; }
    setSession(s);

    fetch(`${BASE}/api/marketplace/renter/claims?customerId=${s.id}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setClaims(data);
        else setError("Failed to load claims.");
      })
      .catch(() => setError("Failed to load claims."))
      .finally(() => setIsLoading(false));
  }, []);

  async function submitDispute() {
    if (!disputeClaimId || !disputeNote.trim()) return;
    setDisputeSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/public/claims/${disputeClaimId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: disputeNote.trim(), email: session?.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Update local claim state
      setClaims(prev => prev.map(c =>
        c.id === disputeClaimId
          ? { ...c, disputeStatus: "submitted", disputeNote: disputeNote.trim(), disputedAt: new Date().toISOString() }
          : c
      ));
      setDisputeSuccess(disputeClaimId);
      setDisputeClaimId(null);
      setDisputeNote("");
    } catch (err: any) {
      alert(err?.message || "Failed to submit dispute. Please try again.");
    } finally {
      setDisputeSubmitting(false);
    }
  }

  if (!session) return null;

  const activeClaim = disputeClaimId ? claims.find(c => c.id === disputeClaimId) : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* Dispute dialog */}
      <Dialog open={disputeClaimId !== null} onOpenChange={v => { if (!v) { setDisputeClaimId(null); setDisputeNote(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="w-5 h-5 text-amber-500" />
              Dispute Policy Violation Charge
            </DialogTitle>
            <DialogDescription>
              Explain why you believe this charge was applied incorrectly. OutdoorShare — not the rental company — will review your dispute impartially.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {activeClaim?.chargedAmount != null && activeClaim.chargedAmount > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-muted/50 border px-4 py-3 text-sm">
                <span className="text-muted-foreground">Charge being disputed</span>
                <span className="font-bold text-red-700">${activeClaim.chargedAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Your Reason <span className="text-destructive">*</span></label>
              <Textarea
                rows={5}
                value={disputeNote}
                onChange={e => setDisputeNote(e.target.value)}
                placeholder="Explain why you believe this charge is incorrect. Include any relevant details about the rental, the policy cited, or any agreements made with the company…"
              />
              <p className="text-xs text-muted-foreground">{disputeNote.length}/1000 characters</p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-amber-800">What happens next?</p>
              <ul className="text-xs text-amber-700 space-y-1 list-disc pl-3">
                <li>OutdoorShare reviews your dispute within 2–3 business days</li>
                <li>If upheld, a refund will be issued to your original payment method</li>
                <li>You'll be notified by email of the outcome</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDisputeClaimId(null); setDisputeNote(""); }}>Cancel</Button>
            <Button
              onClick={submitDispute}
              disabled={!disputeNote.trim() || disputeSubmitting}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {disputeSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting…</> : "Submit Dispute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Back link */}
      <Link href={`${base}/my-bookings`}>
        <Button variant="ghost" size="sm" className="text-muted-foreground -ml-2">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> My Bookings
        </Button>
      </Link>

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold flex items-center gap-2.5">
          <ShieldAlert className="w-6 h-6 text-amber-500" />
          My Claims
        </h1>
        <p className="text-muted-foreground text-sm">
          Claims filed against your rentals by the equipment owner.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="rounded-2xl border bg-muted/40 animate-pulse h-32" />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700 text-sm">
          {error}
        </div>
      )}

      {!isLoading && !error && claims.length === 0 && (
        <div className="rounded-2xl border bg-background p-10 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-7 h-7 text-green-500" />
          </div>
          <p className="font-semibold text-foreground">No claims on your account</p>
          <p className="text-sm text-muted-foreground">
            You have no outstanding claims. Keep your rentals in great condition to stay claim-free!
          </p>
        </div>
      )}

      {!isLoading && !error && claims.length > 0 && (
        <div className="space-y-4">
          {/* Active claims banner */}
          {claims.some(c => c.status === "open" || c.status === "reviewing") && (
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">You have active claims requiring attention</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Review the details below. If you disagree with a policy violation charge, you can dispute it directly with OutdoorShare.
                </p>
              </div>
            </div>
          )}

          {/* Dispute success banner */}
          {disputeSuccess !== null && (
            <div className="rounded-2xl border-2 border-green-300 bg-green-50 p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-800">Dispute submitted successfully</p>
                <p className="text-xs text-green-700 mt-0.5">
                  The OutdoorShare team will review Claim #{disputeSuccess} and contact you within 2–3 business days.
                </p>
              </div>
            </div>
          )}

          {claims.map(claim => {
            const sc = statusConfig(claim.status);
            const dsc = disputeStatusConfig(claim.disputeStatus ?? null);
            const canDispute = claim.type === "policy_violation"
              && claim.status === "resolved"
              && !claim.disputeStatus
              && claim.chargedAmount != null && claim.chargedAmount > 0;

            return (
              <div key={claim.id} className="rounded-2xl border bg-background overflow-hidden shadow-sm">
                {/* Accent strip by status */}
                <div className={`h-1 w-full ${
                  claim.status === "open" ? "bg-yellow-400"
                  : claim.status === "reviewing" ? "bg-blue-400"
                  : claim.status === "resolved" ? "bg-green-500"
                  : "bg-gray-300"
                }`} />

                <div className="p-5 space-y-4">
                  {/* Row 1: company + status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {claim.businessLogo ? (
                        <img src={claim.businessLogo} alt={claim.businessName ?? ""} className="w-8 h-8 rounded-full object-contain border shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground truncate">{claim.businessName ?? "Rental Company"}</p>
                        <p className="font-semibold text-sm truncate">{claim.listingTitle ?? "Rental Equipment"}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0 ${sc.color}`}>
                      {sc.icon}
                      {sc.label}
                    </span>
                  </div>

                  {/* Row 2: type badge + dates */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted font-medium">
                      <ShieldAlert className="w-3 h-3" /> {typeLabel(claim.type)}
                    </span>
                    {claim.startDate && claim.endDate && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(claim.startDate + "T00:00:00"), "MMM d")} – {format(new Date(claim.endDate + "T00:00:00"), "MMM d, yyyy")}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Filed {format(new Date(claim.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>

                  {/* Description */}
                  <div className="rounded-xl bg-muted/30 border p-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                      <FileText className="w-3 h-3" /> Claim Description
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">{claim.description}</p>
                  </div>

                  {/* Amounts */}
                  {(claim.claimedAmount != null || claim.chargedAmount != null || claim.settledAmount != null) && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {claim.claimedAmount != null && (
                        <div className="rounded-xl border bg-muted/20 p-3 text-center">
                          <p className="text-xs text-muted-foreground mb-0.5">Claimed</p>
                          <p className="font-bold text-base">${claim.claimedAmount.toFixed(2)}</p>
                        </div>
                      )}
                      {claim.chargedAmount != null && (
                        <div className={`rounded-xl border p-3 text-center ${claim.chargedAmount > 0 ? "border-red-200 bg-red-50" : "border-gray-200 bg-muted/20"}`}>
                          <p className="text-xs text-muted-foreground mb-0.5">Charged to You</p>
                          <p className={`font-bold text-base ${claim.chargedAmount > 0 ? "text-red-700" : "text-foreground"}`}>
                            ${claim.chargedAmount.toFixed(2)}
                          </p>
                        </div>
                      )}
                      {claim.refundAmount != null && claim.refundAmount > 0 && (
                        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center">
                          <p className="text-xs text-muted-foreground mb-0.5">Refunded</p>
                          <p className="font-bold text-base text-green-700">${claim.refundAmount.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Evidence photos */}
                  {claim.evidenceUrls.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Evidence Photos</p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                        {claim.evidenceUrls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="group relative aspect-square rounded-xl overflow-hidden bg-muted border hover:border-primary/50 transition-colors">
                            <img src={url} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 rounded-xl transition-colors">
                              <ExternalLink className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Policy violation auto-resolved notice */}
                  {claim.type === "policy_violation" && claim.status === "resolved" && !claim.disputeStatus && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-amber-900">Policy Violation — Charge Applied</p>
                          <p className="text-xs text-amber-800 mt-0.5">
                            {claim.chargedAmount != null && claim.chargedAmount > 0
                              ? `$${claim.chargedAmount.toFixed(2)} was automatically charged to your payment method for this policy violation.`
                              : "This policy violation has been resolved."}
                            {" "}If you believe this charge is incorrect, you can dispute it and OutdoorShare will review it independently.
                          </p>
                        </div>
                      </div>
                      {canDispute && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-1.5 border-amber-400 text-amber-800 hover:bg-amber-100"
                          onClick={() => { setDisputeClaimId(claim.id); setDisputeNote(""); }}
                        >
                          <MessageSquarePlus className="w-3.5 h-3.5" />
                          Dispute This Charge with OutdoorShare
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Dispute status (after submission) */}
                  {dsc && claim.disputeStatus && (
                    <div className={`rounded-xl border p-3 space-y-2 ${dsc.color}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold`}>
                          {dsc.icon} {dsc.label}
                        </span>
                        {claim.disputedAt && (
                          <span className="text-xs opacity-70">
                            {format(new Date(claim.disputedAt), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                      {claim.disputeStatus === "submitted" && (
                        <p className="text-xs">Your dispute has been received. The OutdoorShare team will review it within 2–3 business days and contact you by email.</p>
                      )}
                      {claim.disputeStatus === "under_review" && (
                        <p className="text-xs">OutdoorShare is actively reviewing your dispute. You'll be notified of the outcome by email.</p>
                      )}
                      {claim.disputeStatus === "upheld" && (
                        <p className="text-xs">Your dispute was upheld. A refund will be — or has been — issued to your original payment method within 5–10 business days.</p>
                      )}
                      {claim.disputeStatus === "rejected" && (
                        <p className="text-xs">After review, OutdoorShare determined that the policy violation charge was valid. The charge stands.</p>
                      )}
                      {claim.disputeNote && (
                        <details className="text-xs">
                          <summary className="cursor-pointer opacity-70">Your submitted reason</summary>
                          <p className="mt-1 italic">"{claim.disputeNote}"</p>
                        </details>
                      )}
                    </div>
                  )}

                  {/* Resolution outcome for non-policy-violation claims */}
                  {claim.status === "resolved" && claim.type !== "policy_violation" && (
                    <div className="rounded-xl border border-green-200 bg-green-50 p-3 flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-green-800">Claim Resolved</p>
                        <p className="text-xs text-green-700 mt-0.5">
                          {claim.chargedAmount != null && claim.chargedAmount > 0
                            ? `$${claim.chargedAmount.toFixed(2)} was charged to your payment method on file.`
                            : "No charge was made. This claim has been closed."}
                          {claim.refundAmount != null && claim.refundAmount > 0
                            ? ` A refund of $${claim.refundAmount.toFixed(2)} was issued.`
                            : ""}
                        </p>
                      </div>
                    </div>
                  )}

                  {claim.status === "denied" && (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 flex items-start gap-2.5">
                      <XCircle className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-gray-600">This claim was reviewed and denied. No charges were made to your account.</p>
                    </div>
                  )}

                  {/* Footer */}
                  {claim.bookingId && claim.tenantSlug && (
                    <div className="pt-1 border-t flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Claim #{claim.id}</span>
                      <Link href={`/${claim.tenantSlug}/my-bookings/${claim.bookingId}`}>
                        <button className="text-xs text-primary hover:underline flex items-center gap-1">
                          <Package className="w-3 h-3" /> View Booking
                        </button>
                      </Link>
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
