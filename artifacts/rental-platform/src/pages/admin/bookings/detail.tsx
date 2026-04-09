import { adminPath, getAdminSession } from "@/lib/admin-nav";
import { useState, useEffect, useCallback } from "react";
import { fireConfetti } from "@/hooks/use-confetti";
import { AdminBookingTimeline } from "@/components/RentalCountdown";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { ArrowLeft, User, Phone, Mail, Calendar, Package, StickyNote, ShieldAlert, Pencil, FileSignature, FileText, ChevronDown, ChevronUp, Download, Camera, CheckCircle2, Loader2, ExternalLink, ImageIcon, Clock, ShieldCheck, ShieldX, Shield, AlertCircle, Copy, Send, UserCheck, Lock, LockOpen, DollarSign, PackageCheck, ScanSearch, MailCheck, Link2, MailX, RefreshCw, CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, differenceInDays, startOfDay } from "date-fns";

const SOURCE_CONFIG: Record<string, { label: string; className: string }> = {
  online:  { label: "Online",  className: "bg-blue-100   text-blue-800   border-blue-200"   },
  kiosk:   { label: "Kiosk",   className: "bg-purple-100 text-purple-800 border-purple-200" },
  walkin:  { label: "Walk-in", className: "bg-amber-100  text-amber-800  border-amber-200"  },
  phone:   { label: "Phone",   className: "bg-gray-100   text-gray-700   border-gray-200"   },
};

function SourceBadge({ source }: { source?: string | null }) {
  if (!source) return null;
  const cfg = SOURCE_CONFIG[source] ?? { label: source, className: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

export default function AdminBookingDetail() {
  const params = useParams<{ slug: string; id: string }>();
  const id = params?.id ? parseInt(params.id) : 0;
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [booking, setBooking] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  const adminHeaders = useCallback((): Record<string, string> => {
    const session = getAdminSession();
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.token) h["x-admin-token"] = session.token;
    return h;
  }, []);

  const fetchBooking = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${BASE}/api/bookings/${id}`, { headers: adminHeaders() });
      if (res.ok) {
        setBooking(await res.json());
      } else {
        setBooking(null);
      }
    } catch {
      setBooking(null);
    } finally {
      setIsLoading(false);
    }
  }, [id, BASE, adminHeaders]);

  useEffect(() => { fetchBooking(); }, [fetchBooking]);

  // Mark booking as seen by admin when it loads
  useEffect(() => {
    if (!id || !(booking as any)?.id) return;
    const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
    const session = getAdminSession();
    if (!session?.token) return;
    fetch(`${base}/api/bookings/${id}/seen`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": session.token },
      body: JSON.stringify({ viewer: "admin" }),
    }).catch(() => {});
  }, [id, (booking as any)?.id]);

  const [adminNotes, setAdminNotes] = useState("");
  const [agreementExpanded, setAgreementExpanded] = useState(false);
  const [sendingPickupLink, setSendingPickupLink] = useState(false);
  const [pickupLinkSent, setPickupLinkSent] = useState(false);
  const [pickupUrl, setPickupUrl] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [depositLoading, setDepositLoading] = useState<"authorize" | "release" | "capture" | null>(null);
  const [depositHoldStatus, setDepositHoldStatus] = useState<string | null>(null);
  const [depositAutoAttemptedAt, setDepositAutoAttemptedAt] = useState<string | null>(null);
  const [sendingReturnLink, setSendingReturnLink] = useState(false);
  const [returnLinkSent, setReturnLinkSent] = useState(false);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const [copyReturnSuccess, setCopyReturnSuccess] = useState(false);
  const [fetchingPickupLink, setFetchingPickupLink] = useState(false);
  const [fetchingReturnLink, setFetchingReturnLink] = useState(false);
  const [revealedPickupUrl, setRevealedPickupUrl] = useState<string | null>(null);
  const [revealedReturnUrl, setRevealedReturnUrl] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<any | null>(null);
  const [sendingAgreement, setSendingAgreement] = useState(false);
  const [agreementSent, setAgreementSent] = useState(false);
  const [sendingIdentity, setSendingIdentity] = useState(false);
  const [identitySent, setIdentitySent] = useState(false);
  const [markingIdentity, setMarkingIdentity] = useState(false);
  const [identityMarkedVerified, setIdentityMarkedVerified] = useState(false);

  type VerifData = {
    found: boolean;
    identityVerificationStatus?: string;
    identityVerificationSessionId?: string | null;
    identityVerifiedAt?: string | null;
  };
  const [verifData, setVerifData] = useState<VerifData | null>(null);

  useEffect(() => {
    if (booking?.adminNotes) {
      setAdminNotes(booking.adminNotes);
    }
    if ((booking as any)?.depositHoldStatus) {
      setDepositHoldStatus((booking as any).depositHoldStatus);
    }
    if ((booking as any)?.depositAutoAttemptedAt) {
      setDepositAutoAttemptedAt((booking as any).depositAutoAttemptedAt);
    }
  }, [booking]);

  useEffect(() => {
    if (!booking?.customerEmail) return;
    fetch(`${BASE}/api/customers/lookup-by-email?email=${encodeURIComponent(booking.customerEmail)}`)
      .then(r => r.json())
      .then(data => setVerifData(data))
      .catch(() => {});
  }, [booking?.customerEmail]);

  if (isLoading) return <div className="p-8">Loading booking details...</div>;
  if (!booking) return <div className="p-8">Booking not found</div>;

  const sendPickupLink = async (asHostPickup = false) => {
    setSendingPickupLink(true);
    try {
      const r = await fetch(`${BASE}/api/bookings/${id}/send-pickup-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(getAdminSession()?.token ? { "x-admin-token": getAdminSession()!.token } : {}) },
        body: JSON.stringify({ hostPickup: asHostPickup }),
      });
      const data = await r.json();
      if (!r.ok || data.error) { toast({ title: "Error", description: data.error ?? "Failed to send link", variant: "destructive" }); return; }
      setPickupLinkSent(true);
      if (data.pickupUrl) setPickupUrl(data.pickupUrl);
      toast({
        title: asHostPickup ? "Photo upload link sent to renter!" : "Pickup link sent!",
        description: "The renter has been emailed a link to upload photos.",
      });
    } finally {
      setSendingPickupLink(false);
    }
  };

  const sendAgreementLink = async () => {
    setSendingAgreement(true);
    try {
      const r = await fetch(`${BASE}/api/bookings/${id}/send-agreement-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(getAdminSession()?.token ? { "x-admin-token": getAdminSession()!.token } : {}) },
      });
      const data = await r.json();
      if (!r.ok || data.error) { toast({ title: "Error", description: data.error ?? "Failed to send link", variant: "destructive" }); return; }
      setAgreementSent(true);
      toast({ title: "Agreement link sent!", description: `${booking!.customerEmail} has been emailed a link to sign the rental agreement.` });
    } finally { setSendingAgreement(false); }
  };

  const sendIdentityLink = async () => {
    setSendingIdentity(true);
    try {
      const r = await fetch(`${BASE}/api/bookings/${id}/send-identity-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(getAdminSession()?.token ? { "x-admin-token": getAdminSession()!.token } : {}) },
      });
      const data = await r.json();
      if (!r.ok || data.error) { toast({ title: "Error", description: data.error ?? "Failed to send identity link", variant: "destructive" }); return; }
      setIdentitySent(true);
      toast({ title: "Verification link sent!", description: `${booking!.customerEmail} has been emailed a Stripe Identity verification link.` });
    } finally { setSendingIdentity(false); }
  };

  const markIdentityVerified = async () => {
    setMarkingIdentity(true);
    try {
      const r = await fetch(`${BASE}/api/bookings/${id}/mark-identity-verified`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(getAdminSession()?.token ? { "x-admin-token": getAdminSession()!.token } : {}) },
      });
      const data = await r.json();
      if (!r.ok || data.error) { toast({ title: "Error", description: data.error ?? "Failed to mark ID verified", variant: "destructive" }); return; }
      setIdentityMarkedVerified(true);
      setVerifData(prev => prev ? { ...prev, identityVerificationStatus: "verified", identityVerifiedAt: new Date().toISOString() } : prev);
      toast({ title: "ID marked as verified", description: "The renter's identity has been manually confirmed." });
    } finally { setMarkingIdentity(false); }
  };

  const copyPickupLink = async () => {
    let url = pickupUrl ?? revealedPickupUrl;
    if (!url) {
      setFetchingPickupLink(true);
      try {
        const r = await fetch(`${BASE}/api/bookings/${id}/pickup-link`, {
          headers: getAdminSession()?.token ? { "x-admin-token": getAdminSession()!.token } : {},
        });
        const data = await r.json();
        if (data.pickupUrl) {
          url = data.pickupUrl;
          setPickupUrl(data.pickupUrl);
          setRevealedPickupUrl(data.pickupUrl);
        } else {
          toast({ title: "Could not retrieve link", description: data.error ?? "Server returned no URL — try refreshing the page.", variant: "destructive" });
          return;
        }
      } catch (err: any) {
        toast({ title: "Network error", description: "Could not reach the server. Check your connection.", variant: "destructive" });
        return;
      } finally {
        setFetchingPickupLink(false);
      }
    } else {
      setRevealedPickupUrl(url);
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      toast({ title: "Link copied!", description: "Paste it in a text message or email to the renter." });
      setTimeout(() => setCopySuccess(false), 3000);
    } catch {
      // Clipboard API unavailable (HTTP) — URL is shown inline so user can copy manually
      toast({ title: "Link ready below", description: "Select and copy the link from the box below." });
    }
  };

  const sendReturnLink = async () => {
    setSendingReturnLink(true);
    try {
      const r = await fetch(`${BASE}/api/bookings/${id}/send-return-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(getAdminSession()?.token ? { "x-admin-token": getAdminSession()!.token } : {}) },
      });
      const data = await r.json();
      if (!r.ok || data.error) { toast({ title: "Error", description: data.error ?? "Failed to send link", variant: "destructive" }); return; }
      setReturnLinkSent(true);
      if (data.returnUrl) setReturnUrl(data.returnUrl);
      toast({ title: "Return link sent!", description: "The renter has been emailed a link to upload return photos." });
    } finally {
      setSendingReturnLink(false);
    }
  };

  const copyReturnLink = async () => {
    let url = returnUrl ?? revealedReturnUrl;
    if (!url) {
      setFetchingReturnLink(true);
      try {
        const r = await fetch(`${BASE}/api/bookings/${id}/return-link`, {
          headers: getAdminSession()?.token ? { "x-admin-token": getAdminSession()!.token } : {},
        });
        const data = await r.json();
        if (data.returnUrl) {
          url = data.returnUrl;
          setReturnUrl(data.returnUrl);
          setRevealedReturnUrl(data.returnUrl);
        } else {
          toast({ title: "Could not retrieve link", description: data.error ?? "Server returned no URL — try refreshing the page.", variant: "destructive" });
          return;
        }
      } catch {
        toast({ title: "Network error", description: "Could not reach the server. Check your connection.", variant: "destructive" });
        return;
      } finally {
        setFetchingReturnLink(false);
      }
    } else {
      setRevealedReturnUrl(url);
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopyReturnSuccess(true);
      toast({ title: "Return link copied!", description: "Paste it in a text message or email to the renter." });
      setTimeout(() => setCopyReturnSuccess(false), 3000);
    } catch {
      toast({ title: "Link ready below", description: "Select and copy the link from the box below." });
    }
  };

  const runInspection = async () => {
    setInspecting(true);
    try {
      const r = await fetch(`${BASE}/api/bookings/${id}/inspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(getAdminSession()?.token ? { "x-admin-token": getAdminSession()!.token } : {}) },
      });
      const data = await r.json();
      if (!r.ok || data.error) { toast({ title: "Inspection failed", description: data.error ?? "AI could not analyze photos", variant: "destructive" }); return; }
      setInspectionResult(data.result);
      toast({ title: "Inspection complete", description: "AI has analyzed the before and after photos." });
    } finally {
      setInspecting(false);
    }
  };

  const handleDepositAction = async (action: "authorize" | "release" | "capture") => {
    setDepositLoading(action);
    try {
      const r = await fetch(`${BASE}/api/bookings/${id}/deposit/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(getAdminSession()?.token ? { "x-admin-token": getAdminSession()!.token } : {}) },
      });
      const data = await r.json();
      if (!r.ok) { toast({ title: "Error", description: data.error ?? "Action failed", variant: "destructive" }); return; }
      setDepositHoldStatus(data.depositHoldStatus);
      const labels = { authorize: "Deposit hold authorized", release: "Deposit hold released", capture: "Deposit captured" };
      toast({ title: labels[action], description: action === "capture" ? "The security deposit has been charged to the renter." : action === "release" ? "The hold has been removed from the renter's card." : "The renter's card has been authorized for the security deposit." });
    } catch {
      toast({ title: "Connection error", variant: "destructive" });
    } finally {
      setDepositLoading(null);
    }
  };

  const handleStatusChange = async (newStatus: any) => {
    try {
      const res = await fetch(`${BASE}/api/bookings/${id}`, {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setBooking(data);
        toast({ title: `Booking marked as ${newStatus}` });
        if (newStatus === "confirmed") fireConfetti();
      }
    } catch {}
  };

  const saveNotes = async () => {
    try {
      const res = await fetch(`${BASE}/api/bookings/${id}`, {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify({ adminNotes }),
      });
      if (res.ok) {
        const data = await res.json();
        setBooking(data);
        toast({ title: "Notes saved successfully" });
      }
    } catch {}
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'pending': return <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-sm px-3 py-1">Pending Confirmation</Badge>;
      case 'confirmed': return <Badge variant="default" className="bg-blue-100 text-blue-800 text-sm px-3 py-1">Confirmed</Badge>;
      case 'active': return <Badge variant="default" className="bg-green-100 text-green-800 text-sm px-3 py-1">Active (Picked Up)</Badge>;
      case 'completed': return <Badge variant="outline" className="text-muted-foreground text-sm px-3 py-1">Completed</Badge>;
      case 'cancelled': return <Badge variant="destructive" className="text-sm px-3 py-1">Cancelled</Badge>;
      default: return <Badge className="text-sm px-3 py-1">{status}</Badge>;
    }
  };

  const days = differenceInDays(new Date(booking.endDate), new Date(booking.startDate)) || 1;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Booking #{booking.id}</h2>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              Placed on {format(new Date(booking.createdAt), 'MMM d, yyyy h:mm a')}
              <SourceBadge source={booking.source} />
            </p>
          </div>
          {getStatusBadge(booking.status)}
        </div>
      </div>

      {/* Contextual action bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <Button variant="outline" className="gap-2" onClick={() => setLocation(adminPath(`/bookings/${id}/edit`))}>
          <Pencil className="w-4 h-4" /> Edit
        </Button>

        {booking.status === 'pending' && (
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleStatusChange('confirmed')}>
            <CheckCircle2 className="w-4 h-4" /> Confirm Booking
          </Button>
        )}

        {booking.status === 'confirmed' && (
          <Button
            className="gap-2 bg-green-600 hover:bg-green-700 text-white text-base px-5 py-2.5 h-auto"
            onClick={() => handleStatusChange('active')}
          >
            <CheckCircle2 className="w-5 h-5" /> Mark as Picked Up
          </Button>
        )}

        {booking.status === 'active' && (
          <Button
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => handleStatusChange('completed')}
          >
            <CheckCircle2 className="w-4 h-4" /> Mark as Returned
          </Button>
        )}

        {booking.status === 'completed' && (
          <Link href={adminPath(`/claims/new?bookingId=${booking.id}&listingId=${booking.listingId}&customerName=${encodeURIComponent(booking.customerName)}&customerEmail=${encodeURIComponent(booking.customerEmail)}`)}>
            <Button variant="outline" className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50">
              <ShieldAlert className="w-4 h-4" /> Submit Claim
            </Button>
          </Link>
        )}

        {/* Secondary status options (collapsed) */}
        {!['pending'].includes(booking.status) && booking.status !== 'confirmed' && (
          <Button variant="outline" onClick={() => handleStatusChange('confirmed')} disabled={booking.status === 'confirmed'} className="text-sm">
            ← Back to Confirmed
          </Button>
        )}

        <Button 
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive ml-auto"
          onClick={() => handleStatusChange('cancelled')}
          disabled={['cancelled', 'completed'].includes(booking.status)}
        >
          Cancel
        </Button>
      </div>

      {/* ── Rental Timeline / Countdown ── */}
      {!["cancelled"].includes(booking.status) && (
        <AdminBookingTimeline
          status={booking.status}
          startDate={booking.startDate}
          endDate={booking.endDate}
          listingTitle={booking.listingTitle}
          listingImage={(booking as any).listingImage ?? null}
        />
      )}

      {/* Pickup-day callout for confirmed bookings */}
      {booking.status === 'confirmed' && (() => {
        const today    = startOfDay(new Date());
        const start    = startOfDay(new Date(booking.startDate + "T00:00:00"));
        const daysAway = differenceInDays(start, today);
        if (daysAway > 2) return null;

        const isToday    = daysAway === 0;
        const isTomorrow = daysAway === 1;

        return (
          <div className={`rounded-xl border-2 p-4 flex items-start gap-4 ${isToday ? "border-green-400 bg-green-50" : "border-blue-300 bg-blue-50"}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isToday ? "bg-green-100" : "bg-blue-100"}`}>
              <CheckCircle2 className={`w-5 h-5 ${isToday ? "text-green-600" : "text-blue-600"}`} />
            </div>
            <div className="flex-1">
              <p className={`font-bold text-base ${isToday ? "text-green-800" : "text-blue-800"}`}>
                {isToday ? "Pickup day — customer arrives today!" : isTomorrow ? "Customer arrives tomorrow" : `Customer arrives in ${daysAway} days`}
              </p>
              <p className={`text-sm mt-0.5 ${isToday ? "text-green-700" : "text-blue-700"}`}>
                Complete the checklist below before marking as picked up.
              </p>
            </div>
            {isToday && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white shrink-0 gap-1.5"
                onClick={() => handleStatusChange('active')}
              >
                <CheckCircle2 className="w-4 h-4" /> Mark Picked Up
              </Button>
            )}
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-y-6">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Name</div>
                  <div className="font-medium text-lg">{booking.customerName}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Email</div>
                  <div className="font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a href={`mailto:${booking.customerEmail}`} className="hover:underline">{booking.customerEmail}</a>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Phone</div>
                  <div className="font-medium flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    {booking.customerPhone ? (
                      <a href={`tel:${booking.customerPhone}`} className="hover:underline">{booking.customerPhone}</a>
                    ) : (
                      <span className="text-muted-foreground italic">Not provided</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Identity Verification */}
              <div className="col-span-2">
                {(() => {
                  const status = verifData?.identityVerificationStatus ?? "unverified";
                  const sessionId = verifData?.identityVerificationSessionId;
                  const verifiedAt = verifData?.identityVerifiedAt;

                  const statusConfig: Record<string, { label: string; icon: React.ReactNode; bg: string; text: string; border: string }> = {
                    verified: {
                      label: "Identity Verified",
                      icon: <ShieldCheck className="w-4 h-4 text-green-600" />,
                      bg: "bg-green-50", text: "text-green-800", border: "border-green-200"
                    },
                    pending: {
                      label: "Verification Pending",
                      icon: <Shield className="w-4 h-4 text-amber-600" />,
                      bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200"
                    },
                    failed: {
                      label: "Verification Failed",
                      icon: <ShieldX className="w-4 h-4 text-red-600" />,
                      bg: "bg-red-50", text: "text-red-800", border: "border-red-200"
                    },
                    unverified: {
                      label: "Not Verified",
                      icon: <AlertCircle className="w-4 h-4 text-muted-foreground" />,
                      bg: "bg-muted/40", text: "text-muted-foreground", border: "border-border"
                    },
                  };

                  const cfg = statusConfig[status] ?? statusConfig.unverified;

                  return (
                    <div className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
                      <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Identity Verification</div>
                      <div className="flex items-center gap-2 mb-2">
                        {cfg.icon}
                        <span className={`font-semibold text-sm ${cfg.text}`}>{cfg.label}</span>
                      </div>
                      {verifiedAt && (
                        <p className="text-xs text-green-700 mb-1">
                          Verified {format(new Date(verifiedAt), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      )}
                      {sessionId && (
                        <p className="text-xs text-muted-foreground font-mono mt-1 break-all">
                          Session: {sessionId}
                        </p>
                      )}
                      {!verifData && (
                        <p className="text-xs text-muted-foreground italic">No customer account found for this email.</p>
                      )}
                    </div>
                  );
                })()}
              </div>

            {booking.notes && (
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <div className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <StickyNote className="w-4 h-4" /> Customer Notes
                </div>
                <p className="text-sm text-muted-foreground">{booking.notes}</p>
              </div>
            )}
            </CardContent>
          </Card>

          {/* Rental Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Rental Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between border-b pb-4 mb-4">
                <div>
                  <div className="font-bold text-lg">{booking.listingTitle}</div>
                  <div className="text-sm text-muted-foreground">Listing ID: #{booking.listingId}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">Qty: {booking.quantity}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-6">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Pickup Date
                  </div>
                  <div className="font-medium text-lg">{format(new Date(booking.startDate), 'EEEE, MMM d, yyyy')}</div>
                  {(booking as any).pickupTime && (
                    <div className="text-sm text-primary font-semibold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> {(booking as any).pickupTime}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Return Date
                  </div>
                  <div className="font-medium text-lg">{format(new Date(booking.endDate), 'EEEE, MMM d, yyyy')}</div>
                  {(booking as any).dropoffTime && (
                    <div className="text-sm text-primary font-semibold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> {(booking as any).dropoffTime}
                    </div>
                  )}
                </div>
              </div>

              {/* Time remaining */}
              {(() => {
                const skip = ["cancelled", "completed", "no_show"];
                if (skip.includes(booking.status)) return null;
                const today  = startOfDay(new Date());
                const start  = startOfDay(new Date(booking.startDate + "T00:00:00"));
                const end    = startOfDay(new Date(booking.endDate   + "T00:00:00"));
                const daysToStart = differenceInDays(start, today);
                const daysToEnd   = differenceInDays(end,   today);
                const totalDays   = Math.max(1, differenceInDays(end, start));
                const elapsed     = Math.max(0, differenceInDays(today, start));
                const pct         = Math.min(100, Math.round((elapsed / totalDays) * 100));

                let label = "";
                let sub = "";
                let barColor = "bg-primary";
                let textColor = "text-primary";
                let bgColor = "bg-primary/5 border-primary/20";

                if (daysToStart > 1)   { label = `Starts in ${daysToStart} days`;   sub = `Pickup: ${format(start, "EEEE, MMM d")}`; barColor = "bg-blue-500"; textColor = "text-blue-700"; bgColor = "bg-blue-50 border-blue-200"; }
                else if (daysToStart === 1) { label = "Starts tomorrow";             sub = `Pickup: ${format(start, "EEEE, MMM d")}`; barColor = "bg-blue-500"; textColor = "text-blue-700"; bgColor = "bg-blue-50 border-blue-200"; }
                else if (daysToStart === 0){ label = "Pickup day!";                  sub = "Equipment should be picked up today"; barColor = "bg-green-500"; textColor = "text-green-700"; bgColor = "bg-green-50 border-green-200"; }
                else if (daysToEnd > 1)  { label = `${daysToEnd} days remaining`;   sub = `Due back: ${format(end, "EEEE, MMM d")}`; barColor = "bg-green-500"; textColor = "text-green-700"; bgColor = "bg-green-50 border-green-200"; }
                else if (daysToEnd === 1){ label = "Returns tomorrow";               sub = `Due back: ${format(end, "EEEE, MMM d")}`; barColor = "bg-amber-500"; textColor = "text-amber-700"; bgColor = "bg-amber-50 border-amber-200"; }
                else if (daysToEnd === 0){ label = "Due back today";                 sub = "Equipment should be returned by end of day"; barColor = "bg-amber-500"; textColor = "text-amber-700"; bgColor = "bg-amber-50 border-amber-200"; }
                else                     { label = `Overdue by ${Math.abs(daysToEnd)} day${Math.abs(daysToEnd) !== 1 ? "s" : ""}`; sub = `Was due ${format(end, "EEEE, MMM d")}`; barColor = "bg-red-500"; textColor = "text-red-700"; bgColor = "bg-red-50 border-red-200"; }

                return (
                  <div className={`rounded-xl border p-4 space-y-2 ${bgColor}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className={`w-4 h-4 ${textColor}`} />
                        <span className={`font-bold text-sm ${textColor}`}>{label}</span>
                      </div>
                      {daysToStart < 0 && <span className="text-xs text-muted-foreground">{pct}% elapsed</span>}
                    </div>
                    {daysToStart < 0 && (
                      <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Admin Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-primary" />
                Internal Notes
              </CardTitle>
              <CardDescription>Only visible to staff. Used for internal tracking.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                value={adminNotes} 
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add condition notes, deposit tracking, or other internal info here..."
                rows={4}
              />
              <div className="flex justify-end">
                <Button variant="secondary" onClick={saveNotes}>Save Notes</Button>
              </div>
            </CardContent>
          </Card>

          {/* Signed Agreement */}
          {(booking as any).agreementSignerName && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileSignature className="w-5 h-5 text-green-600" />
                    Signed Rental Agreement
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {(booking as any).agreementPdfPath && (
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/bookings/${id}/agreement-pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <FileText className="w-3.5 h-3.5" />
                            View PDF
                          </Button>
                        </a>
                        <a
                          href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/bookings/${id}/agreement-pdf?download=1`}
                          download={`rental-agreement-${id}.pdf`}
                        >
                          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </Button>
                        </a>
                      </div>
                    )}
                    <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
                      Signed
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground mb-0.5">Signed by</div>
                    <div className="font-semibold">{(booking as any).agreementSignerName}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-0.5">Signed on</div>
                    <div className="font-semibold">
                      {(booking as any).agreementSignedAt
                        ? format(new Date((booking as any).agreementSignedAt), "MMM d, yyyy h:mm a")
                        : "—"}
                    </div>
                  </div>
                </div>

                {/* Signature preview */}
                {(booking as any).agreementSignature && (
                  <>
                    <Separator />
                    <div>
                      <div className="text-xs text-muted-foreground mb-1.5">Signature</div>
                      <div className="border rounded-lg bg-white p-2 inline-block max-w-xs">
                        <img
                          src={(booking as any).agreementSignature}
                          alt="Customer signature"
                          className="max-h-16 w-auto"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Initialed rules */}
                {(booking as any).ruleInitials && (() => {
                  try {
                    const rules = JSON.parse((booking as any).ruleInitials) as Array<{ ruleId: number; title: string; fee: number; initials: string }>;
                    if (!rules.length) return null;
                    return (
                      <>
                        <Separator />
                        <div>
                          <div className="text-xs text-muted-foreground mb-2">Initialed Rules</div>
                          <div className="space-y-1.5">
                            {rules.map(r => (
                              <div key={r.ruleId} className="flex items-center justify-between gap-2 bg-muted/40 rounded-lg px-3 py-2">
                                <div className="text-xs font-medium">{r.title}</div>
                                <span className="font-bold text-sm bg-white border rounded px-2 py-0.5 tabular-nums shrink-0">{r.initials}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    );
                  } catch { return null; }
                })()}

                {(booking as any).agreementText && (
                  <>
                    <Separator />
                    <button
                      onClick={() => setAgreementExpanded(v => !v)}
                      className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      {agreementExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {agreementExpanded ? "Hide agreement text" : "View full agreement text"}
                    </button>
                    {agreementExpanded && (
                      <div className="text-xs text-muted-foreground leading-relaxed space-y-2 border rounded-lg p-4 bg-muted/40 max-h-80 overflow-y-auto">
                        {(booking as any).agreementText.split("\n\n").filter(Boolean).map((p: string, i: number) => (
                          <p key={i}>{p}</p>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Payment + Pickup Photos */}
        <div className="lg:col-span-1 space-y-8">

          {/* ── Unified Rental Task Card — confirmed / active / completed ── */}
          {['confirmed', 'active', 'completed'].includes(booking.status) && (() => {
            const isConfirmed  = booking.status === 'confirmed';
            const isActive     = booking.status === 'active';
            const isCompleted  = booking.status === 'completed';

            const signed           = !!(booking as any).agreementSignerName;
            const identStatus      = verifData?.identityVerificationStatus ?? "unverified";
            const identVerified    = identStatus === "verified";
            const identPending     = identStatus === "pending";
            const identNeedsAction = identStatus === "unverified" || identStatus === "failed";

            const pickupPhotos   = (booking as any).pickupPhotos ?? [];
            const pickupDone     = pickupPhotos.length > 0;
            const pickupSentFlag = (booking as any).pickupLinkSent || pickupLinkSent;

            const returnPhotos   = (booking as any).returnPhotos ?? [];
            const returnDone     = returnPhotos.length > 0;
            const returnSentFlag = !!(booking as any).returnToken || returnLinkSent;

            const requiredMissing: string[] = [];
            if (!signed) requiredMissing.push("Rental Agreement");
            if (identNeedsAction) requiredMissing.push("Identity Verification");

            const hasBlockers     = isConfirmed && requiredMissing.length > 0;
            const today           = startOfDay(new Date());
            const pickupDay       = startOfDay(new Date(booking.startDate + "T00:00:00"));
            const daysUntil       = differenceInDays(pickupDay, today);
            const isPickupOverdue = isConfirmed && daysUntil < 0;
            const isPickupUrgent  = isConfirmed && daysUntil <= 1;

            const cardBorder = isCompleted
              ? "border-green-200"
              : isActive
                ? "border-blue-200"
                : hasBlockers
                  ? isPickupOverdue ? "border-red-300" : "border-amber-200"
                  : "border-green-200";

            const titleColor = isCompleted
              ? "text-green-800"
              : isActive
                ? "text-blue-800"
                : hasBlockers
                  ? isPickupOverdue ? "text-red-800" : "text-amber-800"
                  : "text-green-800";

            const titleIcon = isCompleted
              ? <CheckCircle2 className="w-5 h-5 text-green-600" />
              : isActive
                ? <PackageCheck className="w-5 h-5 text-blue-600" />
                : hasBlockers
                  ? <AlertCircle className={`w-5 h-5 ${isPickupOverdue ? "text-red-600" : "text-amber-500"}`} />
                  : <CheckCircle2 className="w-5 h-5 text-green-600" />;

            const descText = isCompleted
              ? "Rental is complete. All steps finished."
              : isActive
                ? "Rental is active — send the return link when the renter is ready to return."
                : hasBlockers
                  ? "Required steps must be completed before this rental can start."
                  : "All required steps done — ready to mark as picked up.";

            // Inline photo grid helper
            const renderPhotos = (photos: string[], completedAt?: string) => (
              <div className="px-3 pb-3 space-y-2 border-t border-inherit mt-0 pt-3">
                <div className="grid grid-cols-3 gap-1.5">
                  {photos.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="relative group">
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                        <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors">
                        <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </a>
                  ))}
                </div>
                {completedAt && (
                  <p className="text-xs text-muted-foreground">
                    Submitted {format(new Date(completedAt), "MMM d, yyyy h:mm a")}
                  </p>
                )}
              </div>
            );

            // Step row helper
            const renderStep = (opts: {
              done: boolean; pending?: boolean;
              label: string; sub: string;
              actions?: React.ReactNode;
              children?: React.ReactNode;
            }) => {
              const rowBg      = opts.done ? "bg-green-50 border-green-200" : opts.pending ? "bg-amber-50 border-amber-200" : "bg-muted/30 border-border";
              const dotBg      = opts.done ? "bg-green-500" : opts.pending ? "bg-amber-400" : "bg-muted-foreground/20";
              const labelColor = opts.done ? "text-green-800" : opts.pending ? "text-amber-800" : "text-foreground";
              return (
                <div className={`rounded-xl border ${rowBg}`}>
                  <div className="flex items-center gap-3 p-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${dotBg}`}>
                      {opts.done
                        ? <CheckCircle2 className="w-4 h-4 text-white" />
                        : opts.pending
                          ? <Clock className="w-3.5 h-3.5 text-white" />
                          : <span className="w-2 h-2 rounded-full bg-muted-foreground/30 block" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${labelColor}`}>{opts.label}</p>
                      <p className="text-xs text-muted-foreground">{opts.sub}</p>
                    </div>
                    {opts.actions}
                  </div>
                  {opts.children}
                </div>
              );
            };

            return (
              <Card className={cardBorder}>
                <CardHeader className="pb-3">
                  <CardTitle className={`flex items-center gap-2 text-base ${titleColor}`}>
                    {titleIcon}
                    {isCompleted ? "Rental Summary" : isActive ? "Rental In Progress" : "Pickup Checklist"}
                  </CardTitle>
                  <CardDescription className="text-xs">{descText}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">

                  {/* ── Blocker banner ── */}
                  {hasBlockers && (
                    <div className={`rounded-xl border-2 p-4 ${isPickupOverdue ? "bg-red-50 border-red-300" : "bg-amber-50 border-amber-300"}`}>
                      <div className="flex items-start gap-3">
                        <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${isPickupOverdue ? "text-red-600" : "text-amber-600"}`} />
                        <div>
                          <p className={`text-sm font-bold mb-1 ${isPickupOverdue ? "text-red-800" : "text-amber-800"}`}>
                            {isPickupOverdue
                              ? "🚫 Do not start this rental — required steps are overdue"
                              : isPickupUrgent
                                ? "⚠️ Pickup is today or tomorrow — required steps not done"
                                : "⚠️ Required steps must be completed before pickup"}
                          </p>
                          <p className={`text-xs leading-relaxed ${isPickupOverdue ? "text-red-700" : "text-amber-700"}`}>
                            {isPickupOverdue
                              ? "The pickup date has passed. Do not release the equipment until all required steps are resolved."
                              : "The renter cannot take the equipment until these steps are done. Use the Send buttons below or contact them directly."}
                          </p>
                          <ul className={`mt-2 space-y-0.5 ${isPickupOverdue ? "text-red-700" : "text-amber-700"}`}>
                            {requiredMissing.map(s => (
                              <li key={s} className="text-xs font-semibold flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                                {s} — not completed
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── CONFIRMED phase: Steps 1–3 + CTA ── */}
                  {isConfirmed && (
                    <>
                      {/* Step 1: Rental Agreement */}
                      {renderStep({
                        done: signed,
                        label: "Rental Agreement",
                        sub: signed
                          ? `Signed by ${(booking as any).agreementSignerName}`
                          : "Not yet signed by renter",
                        actions: !signed ? (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 shrink-0" onClick={sendAgreementLink} disabled={sendingAgreement}>
                            {sendingAgreement ? <Loader2 className="w-3 h-3 animate-spin" /> : agreementSent ? <MailCheck className="w-3 h-3 text-green-600" /> : <Send className="w-3 h-3" />}
                            {agreementSent ? "Sent!" : "Send"}
                          </Button>
                        ) : undefined,
                      })}

                      {/* Step 2: Identity Verification */}
                      {renderStep({
                        done: identVerified || identityMarkedVerified,
                        pending: identPending,
                        label: "Identity Verified",
                        sub: (identVerified || identityMarkedVerified)
                          ? identityMarkedVerified && !identVerified
                            ? "Manually confirmed by staff"
                            : "Verified via Stripe Identity"
                          : identPending
                            ? "Verification link sent — awaiting completion"
                            : identStatus === "failed"
                              ? "Verification failed — resend link or check ID at pickup"
                              : "Not yet verified — send a link or check ID at pickup",
                        actions: (!identVerified && !identityMarkedVerified) ? (
                          <div className="flex gap-1.5 shrink-0">
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 shrink-0" onClick={sendIdentityLink} disabled={sendingIdentity || markingIdentity}>
                              {sendingIdentity ? <Loader2 className="w-3 h-3 animate-spin" /> : identitySent ? <MailCheck className="w-3 h-3 text-green-600" /> : <Send className="w-3 h-3" />}
                              {identitySent ? "Sent!" : identStatus === "failed" ? "Retry" : "Send"}
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2 shrink-0 border-green-300 text-green-700 hover:bg-green-50" onClick={markIdentityVerified} disabled={markingIdentity || sendingIdentity}>
                              {markingIdentity ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                              {markingIdentity ? "" : "Mark Verified"}
                            </Button>
                          </div>
                        ) : undefined,
                      })}

                      {/* Step 3: Pickup Photos */}
                      {!pickupDone && isPickupUrgent && (
                        <div className="rounded-xl border border-orange-300 bg-orange-50 p-3 flex items-start gap-2.5">
                          <Camera className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-orange-800">Before photos not yet submitted</p>
                            <p className="text-xs text-orange-700 mt-0.5">
                              Remind the renter to photograph the equipment condition before leaving. Send the photo link below or verbally confirm photos were taken at pickup.
                            </p>
                          </div>
                        </div>
                      )}
                      {renderStep({
                        done: pickupDone,
                        pending: !pickupDone && pickupSentFlag,
                        label: "Before Photos",
                        sub: pickupDone
                          ? `${pickupPhotos.length} photo${pickupPhotos.length !== 1 ? "s" : ""} submitted`
                          : pickupSentFlag
                            ? "Link sent — renter hasn't submitted yet"
                            : "Not submitted — send the photo link to the renter",
                        actions: (
                          <div className="flex gap-1.5 shrink-0">
                            {!pickupDone && (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2" onClick={() => sendPickupLink(false)} disabled={sendingPickupLink}>
                                {sendingPickupLink ? <Loader2 className="w-3 h-3 animate-spin" /> : pickupLinkSent ? <MailCheck className="w-3 h-3 text-green-600" /> : <Send className="w-3 h-3" />}
                                {pickupLinkSent ? "Sent!" : "Send"}
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2" onClick={copyPickupLink} disabled={fetchingPickupLink}>
                              {fetchingPickupLink ? <Loader2 className="w-3 h-3 animate-spin" /> : copySuccess ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                              {copySuccess ? "Copied!" : "Copy"}
                            </Button>
                          </div>
                        ),
                        children: pickupDone
                          ? renderPhotos(pickupPhotos, (booking as any).pickupCompletedAt)
                          : undefined,
                      })}

                      {/* Inline URL reveal */}
                      {revealedPickupUrl && (
                        <div className="space-y-1.5 px-1">
                          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                            <Link2 className="w-3.5 h-3.5" /> Photo upload link — share via text or chat
                          </p>
                          <div className="flex gap-2">
                            <Input readOnly value={revealedPickupUrl} className="font-mono text-xs h-8 bg-muted" onFocus={e => e.target.select()} />
                            <button
                              className="shrink-0 px-3 h-8 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                              onClick={async () => { try { await navigator.clipboard.writeText(revealedPickupUrl); toast({ title: "Copied!" }); } catch {} }}
                            >Copy</button>
                          </div>
                        </div>
                      )}

                      {/* Mark as Picked Up */}
                      <Button className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white mt-1" onClick={() => handleStatusChange('active')}>
                        <CheckCircle2 className="w-4 h-4" />
                        Mark as Picked Up
                      </Button>
                    </>
                  )}

                  {/* ── ACTIVE phase: Return Photos + CTA ── */}
                  {isActive && (
                    <>
                      {/* Step 4: Return Photos */}
                      {renderStep({
                        done: returnDone,
                        pending: !returnDone && returnSentFlag,
                        label: "Return Photos",
                        sub: returnDone
                          ? `${returnPhotos.length} photo${returnPhotos.length !== 1 ? "s" : ""} submitted`
                          : returnSentFlag
                            ? "Return link sent — awaiting photos"
                            : "Send a return link when the renter is ready to return",
                        actions: (
                          <div className="flex gap-1.5 shrink-0">
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2" onClick={sendReturnLink} disabled={sendingReturnLink}>
                              {sendingReturnLink ? <Loader2 className="w-3 h-3 animate-spin" /> : returnLinkSent ? <MailCheck className="w-3 h-3 text-green-600" /> : <Send className="w-3 h-3" />}
                              {returnLinkSent ? "Sent!" : returnSentFlag ? "Resend" : "Send"}
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2" onClick={copyReturnLink} disabled={fetchingReturnLink}>
                              {fetchingReturnLink ? <Loader2 className="w-3 h-3 animate-spin" /> : copyReturnSuccess ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                              {copyReturnSuccess ? "Copied!" : "Copy"}
                            </Button>
                          </div>
                        ),
                        children: returnDone
                          ? renderPhotos(returnPhotos, (booking as any).returnCompletedAt)
                          : undefined,
                      })}

                      {/* Inline URL reveal */}
                      {revealedReturnUrl && (
                        <div className="space-y-1.5 px-1">
                          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                            <Link2 className="w-3.5 h-3.5" /> Return photo link — share via text or chat
                          </p>
                          <div className="flex gap-2">
                            <Input readOnly value={revealedReturnUrl} className="font-mono text-xs h-8 bg-muted" onFocus={e => e.target.select()} />
                            <button
                              className="shrink-0 px-3 h-8 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                              onClick={async () => { try { await navigator.clipboard.writeText(revealedReturnUrl); toast({ title: "Copied!" }); } catch {} }}
                            >Copy</button>
                          </div>
                        </div>
                      )}

                      {/* Mark as Returned */}
                      <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white mt-1" onClick={() => handleStatusChange('completed')}>
                        <PackageCheck className="w-4 h-4" />
                        Mark as Returned
                      </Button>
                    </>
                  )}

                  {/* ── COMPLETED phase: compact 4-step summary + photos ── */}
                  {isCompleted && (
                    <div className="space-y-2">
                      {[
                        { label: "Rental Agreement",  done: signed,       sub: signed      ? `Signed by ${(booking as any).agreementSignerName}` : "Not signed" },
                        { label: "Identity Verified",  done: identVerified, sub: identVerified ? "Verified via Stripe Identity"             : "Not verified" },
                        { label: "Pickup Photos",      done: pickupDone,   sub: pickupDone  ? `${pickupPhotos.length} photo${pickupPhotos.length !== 1 ? "s" : ""}` : "Not submitted" },
                        { label: "Return Photos",      done: returnDone,   sub: returnDone  ? `${returnPhotos.length} photo${returnPhotos.length !== 1 ? "s" : ""}` : "Not submitted" },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2.5 text-sm py-1">
                          {item.done
                            ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                            : <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
                          <span className={item.done ? "text-foreground font-medium" : "text-muted-foreground"}>{item.label}</span>
                          <span className="ml-auto text-xs text-muted-foreground">{item.sub}</span>
                        </div>
                      ))}
                      {/* Photo grids for completed photos */}
                      {pickupDone && (
                        <div className="pt-2">
                          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                            <Camera className="w-3.5 h-3.5" /> Pickup Photos
                          </p>
                          <div className="grid grid-cols-3 gap-1.5">
                            {pickupPhotos.map((url: string, i: number) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="relative group">
                                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                                  <img src={url} alt={`Pickup ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors">
                                  <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {returnDone && (
                        <div className="pt-2">
                          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                            <PackageCheck className="w-3.5 h-3.5" /> Return Photos
                          </p>
                          <div className="grid grid-cols-3 gap-1.5">
                            {returnPhotos.map((url: string, i: number) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="relative group">
                                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                                  <img src={url} alt={`Return ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors">
                                  <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </CardContent>
              </Card>
            );
          })()}

          {/* ── AI Return Inspection Card ── */}
          {['active', 'completed'].includes(booking.status) && (() => {
            const beforePhotos: string[] = (booking as any).pickupPhotos ?? [];
            const afterPhotos: string[] = (booking as any).returnPhotos ?? [];
            const storedResult: any = (booking as any).inspectionResult
              ? (() => { try { return JSON.parse((booking as any).inspectionResult); } catch { return null; } })()
              : null;
            const result = inspectionResult ?? storedResult;
            const canInspect = beforePhotos.length > 0 || afterPhotos.length > 0;

            const statusColor = (s: string) => {
              if (s === "no_issues") return "bg-green-100 text-green-800 border-green-300";
              if (s === "minor_issues") return "bg-yellow-100 text-yellow-800 border-yellow-300";
              if (s === "major_issues") return "bg-red-100 text-red-800 border-red-300";
              return "bg-muted text-muted-foreground";
            };
            const severityColor = (s: string) => {
              if (s === "minor") return "bg-yellow-100 text-yellow-800";
              if (s === "moderate") return "bg-orange-100 text-orange-800";
              if (s === "severe") return "bg-red-100 text-red-800";
              return "bg-muted text-muted-foreground";
            };
            const typeIcon: Record<string, string> = { damage: "💥", cleanliness: "🧹", missing_part: "🔩", mechanical: "⚙️" };

            return (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ScanSearch className="w-5 h-5 text-violet-600" />
                    AI Return Inspection
                    {result && (
                      <Badge className={`ml-auto text-xs ${statusColor(result.status)}`}>
                        {result.status === "no_issues" ? "No Issues" : result.status === "minor_issues" ? "Minor Issues" : "Major Issues"}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    AI compares pickup (before) and return (after) photos to detect new damage, missing parts, or cleanliness issues.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!canInspect && (
                    <div className="flex items-center gap-3 bg-muted/40 rounded-xl p-3 border">
                      <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        No photos available. Add pickup and/or return photos to run an inspection.
                      </p>
                    </div>
                  )}

                  {result && (
                    <div className="space-y-3">
                      {/* Summary */}
                      <div className={`rounded-xl border p-3 text-sm ${result.claim_recommended ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                        <div className="flex items-start gap-2">
                          <span className="text-base shrink-0">{result.claim_recommended ? "⚠️" : "✅"}</span>
                          <div>
                            <p className={`font-semibold text-sm mb-1 ${result.claim_recommended ? "text-red-800" : "text-green-800"}`}>
                              {result.claim_recommended ? "Claim Recommended" : "No Claim Needed"}
                            </p>
                            <p className={`text-xs leading-relaxed ${result.claim_recommended ? "text-red-700" : "text-green-700"}`}>{result.admin_summary}</p>
                          </div>
                        </div>
                      </div>

                      {/* Confidence */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Confidence:</span>
                        <div className="flex-1 bg-muted rounded-full h-1.5">
                          <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${result.confidence_score ?? 0}%` }} />
                        </div>
                        <span className="font-medium">{result.confidence_score ?? 0}%</span>
                      </div>

                      {/* Issues list */}
                      {result.issues?.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Issues Found</p>
                          {result.issues.map((issue: any, i: number) => (
                            <div key={i} className="rounded-xl border bg-muted/20 p-3 space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm">{typeIcon[issue.type] ?? "🔍"}</span>
                                <span className="text-sm font-semibold capitalize">{issue.type?.replace("_", " ")}</span>
                                <Badge className={`text-xs px-1.5 py-0 ${severityColor(issue.severity)}`}>{issue.severity}</Badge>
                                {issue.claim_recommended && <Badge className="text-xs px-1.5 py-0 bg-red-100 text-red-800">Claim</Badge>}
                                <span className="ml-auto text-xs text-muted-foreground">{issue.confidence}% conf.</span>
                              </div>
                              <p className="text-xs text-foreground">{issue.description}</p>
                              {issue.location && <p className="text-xs text-muted-foreground">📍 {issue.location}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {canInspect && (
                    <Button
                      className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                      onClick={runInspection}
                      disabled={inspecting}
                    >
                      {inspecting ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Analyzing photos…</>
                      ) : (
                        <><ScanSearch className="w-4 h-4" />{result ? "Re-run Inspection" : "Run AI Inspection"}</>
                      )}
                    </Button>
                  )}

                  <p className="text-xs text-muted-foreground text-center">
                    Uses {beforePhotos.length} before photo{beforePhotos.length !== 1 ? "s" : ""} · {afterPhotos.length} return photo{afterPhotos.length !== 1 ? "s" : ""}
                  </p>
                </CardContent>
              </Card>
            );
          })()}

          {/* ── Security Deposit Card ── */}
          {(booking as any).depositPaid && parseFloat((booking as any).depositPaid) > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lock className="w-5 h-5 text-amber-600" />
                  Security Deposit
                  <span className="ml-auto">
                    {depositHoldStatus === "authorized" && <Badge className="bg-amber-100 text-amber-800 border-amber-300">Hold Active</Badge>}
                    {depositHoldStatus === "released" && <Badge variant="outline" className="border-green-300 text-green-700">Released</Badge>}
                    {depositHoldStatus === "captured" && <Badge variant="destructive">Captured</Badge>}
                    {depositHoldStatus === "charged" && <Badge className="bg-red-100 text-red-800 border-red-300">Fully Charged</Badge>}
                    {!depositHoldStatus && <Badge variant="outline" className="text-muted-foreground">Not yet authorized</Badge>}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  {depositHoldStatus === "charged"
                    ? `$${parseFloat((booking as any).depositPaid).toFixed(2)} fully charged to renter's card (5+ day booking).`
                    : `$${parseFloat((booking as any).depositPaid).toFixed(2)} hold on renter's card — authorize at pickup, release at return.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!depositHoldStatus && (() => {
                  const startPassed = booking?.startDate ? new Date(booking.startDate) <= new Date() : false;
                  const autoFailed = !!depositAutoAttemptedAt && !depositHoldStatus;
                  const showFallback = startPassed || autoFailed;
                  return showFallback ? (
                    <div className="space-y-2">
                      {autoFailed && (
                        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                          <span className="shrink-0 mt-0.5">⚠️</span>
                          <span>Auto-authorization failed (card may not be on file). Use the button below to authorize manually.</span>
                        </div>
                      )}
                      <Button
                        className="w-full gap-2"
                        onClick={() => handleDepositAction("authorize")}
                        disabled={depositLoading !== null}
                      >
                        {depositLoading === "authorize" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        Authorize Hold Manually
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
                      <Lock className="w-4 h-4 shrink-0 text-blue-500" />
                      <span>Hold will be authorized automatically before pickup — no action needed.</span>
                    </div>
                  );
                })()}
                {depositHoldStatus === "authorized" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                      <Lock className="w-4 h-4 shrink-0" />
                      <span>Hold is active on renter's card. Release at return or capture if there's damage.</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
                        onClick={() => handleDepositAction("release")}
                        disabled={depositLoading !== null}
                      >
                        {depositLoading === "release" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LockOpen className="w-3.5 h-3.5" />}
                        Release at Return
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                        onClick={() => handleDepositAction("capture")}
                        disabled={depositLoading !== null}
                      >
                        {depositLoading === "capture" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
                        Capture for Damage
                      </Button>
                    </div>
                  </div>
                )}
                {depositHoldStatus === "released" && (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
                    <LockOpen className="w-4 h-4 shrink-0" />
                    <span>Hold released — funds returned to renter's card.</span>
                  </div>
                )}
                {depositHoldStatus === "captured" && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
                    <DollarSign className="w-4 h-4 shrink-0" />
                    <span>Deposit charged to renter for damage claim.</span>
                  </div>
                )}
                {depositHoldStatus === "charged" && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
                    <DollarSign className="w-4 h-4 shrink-0" />
                    <span>Full deposit charged upfront (5+ day rental). No further action needed — funds will be returned manually if no damage.</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Email Activity Log ── */}
          {(() => {
            const events: { type: string; sentAt: string; toEmail?: string }[] =
              (() => { try { return JSON.parse((booking as any).emailEvents ?? "[]"); } catch { return []; } })();

            const EVENT_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
              confirmation:     { label: "Booking confirmation", icon: <MailCheck className="w-3.5 h-3.5 text-blue-600" />, color: "text-blue-700" },
              kiosk_setup:      { label: "Kiosk account setup", icon: <MailCheck className="w-3.5 h-3.5 text-purple-600" />, color: "text-purple-700" },
              pickup_link:      { label: "Pickup photo link", icon: <MailCheck className="w-3.5 h-3.5 text-green-600" />, color: "text-green-700" },
              return_link:      { label: "Return photo link", icon: <MailCheck className="w-3.5 h-3.5 text-teal-600" />, color: "text-teal-700" },
              pickup_reminder:  { label: "Pickup reminder", icon: <MailCheck className="w-3.5 h-3.5 text-amber-600" />, color: "text-amber-700" },
              return_reminder:  { label: "Return reminder", icon: <MailCheck className="w-3.5 h-3.5 text-orange-600" />, color: "text-orange-700" },
              ready_to_adventure:{ label: "Ready to adventure", icon: <MailCheck className="w-3.5 h-3.5 text-emerald-600" />, color: "text-emerald-700" },
              contact_card:     { label: "Contact card shared", icon: <MailCheck className="w-3.5 h-3.5 text-indigo-600" />, color: "text-indigo-700" },
            };

            const hasEmail = !!booking.customerEmail;

            return (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Mail className="w-4 h-4 text-primary" />
                    Email Activity
                    {events.length > 0 && (
                      <span className="ml-auto text-xs text-muted-foreground font-normal">{events.length} sent</span>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    All emails sent to <strong>{booking.customerEmail || "—"}</strong>
                    {!hasEmail && <span className="text-destructive ml-1">(no email on file)</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {events.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg p-3 border">
                      <MailX className="w-4 h-4 shrink-0" />
                      {hasEmail
                        ? "No emails sent yet. Create booking confirmation or send photo links above."
                        : "No email address on file — edit the booking to add one."}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {events.map((ev, i) => {
                        const cfg = EVENT_CONFIG[ev.type] ?? { label: ev.type, icon: <MailCheck className="w-3.5 h-3.5" />, color: "text-foreground" };
                        return (
                          <div key={i} className="flex items-center gap-2.5 py-1.5 border-b last:border-0">
                            <div className="shrink-0">{cfg.icon}</div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</p>
                              {ev.toEmail && <p className="text-[10px] text-muted-foreground truncate">{ev.toEmail}</p>}
                            </div>
                            <div className="text-[10px] text-muted-foreground shrink-0">
                              {format(new Date(ev.sentAt), "MMM d, h:mm a")}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          <Card>
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                let parsedAddons: Array<{ id?: number; name: string; price: number; subtotal?: number }> = [];
                try { parsedAddons = (booking as any).addonsData ? JSON.parse((booking as any).addonsData) : []; } catch {}
                const platformProtectionFee = Number((booking as any).protectionPlanFee ?? 0);
                const addonsTotal = parsedAddons.reduce((s, a) => s + (a.subtotal ?? a.price ?? 0), 0);
                // Rental fee = total minus addons minus platform protection fee (shown separately below)
                const rentalFee = booking.totalPrice - addonsTotal - platformProtectionFee;
                // Listing-level protection addons (shown with shield icon)
                const protectionAddons = parsedAddons.filter(a => a.name.toLowerCase().includes("protection"));
                const otherAddons = parsedAddons.filter(a => !a.name.toLowerCase().includes("protection"));
                return (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-medium">{days} day{days > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Rental Fee</span>
                      <span className="font-medium">${rentalFee.toFixed(2)}</span>
                    </div>
                    {/* Platform-level protection plan — stored in protectionPlanFee field */}
                    {platformProtectionFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Shield className="w-3.5 h-3.5 text-emerald-600" />
                          Protection Plan
                        </span>
                        <span className="font-medium text-emerald-700">+${platformProtectionFee.toFixed(2)}</span>
                      </div>
                    )}
                    {/* Listing-level protection addons (legacy / no platform plan) */}
                    {protectionAddons.map((addon, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="h-3.5 object-contain opacity-75" />
                          {addon.name}
                        </span>
                        <span className="font-medium text-emerald-700">+${(addon.subtotal ?? addon.price ?? 0).toFixed(2)}</span>
                      </div>
                    ))}
                    {otherAddons.map((addon, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{addon.name}</span>
                        <span className="font-medium">+${(addon.subtotal ?? addon.price ?? 0).toFixed(2)}</span>
                      </div>
                    ))}
                    {booking.depositPaid !== null && booking.depositPaid !== undefined && booking.depositPaid > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Lock className="w-3.5 h-3.5 text-amber-500" />
                          Security deposit (hold)
                        </span>
                        <span className="font-medium text-amber-700">${booking.depositPaid.toFixed(2)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-lg">Total charged</span>
                      <span className="font-bold text-2xl">${booking.totalPrice.toFixed(2)}</span>
                    </div>

                    {/* ── Earnings breakdown ── */}
                    {(() => {
                      const feePercent: number = (booking as any).platformFeePercent ?? 5;
                      const total = booking.totalPrice;
                      const ppFee = platformProtectionFee; // already defined above

                      // If Stripe stored the exact application fee, use it
                      const exactFee = (booking as any).stripePlatformFee != null
                        ? parseFloat(String((booking as any).stripePlatformFee))
                        : null;

                      // Estimated fee = service fee on (total - protection plan) + protection plan
                      const rentalBase = total - ppFee;
                      const estimatedServiceFee = Math.round(rentalBase * (feePercent / 100) * 100) / 100;
                      const estimatedPlatformTotal = estimatedServiceFee + ppFee;

                      const platformTake = exactFee ?? estimatedPlatformTotal;
                      const yourEarnings = total - platformTake;

                      return (
                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-2.5 mt-1">
                          <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5" /> Your Earnings
                          </p>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between text-muted-foreground">
                              <span>Gross booking total</span>
                              <span className="font-medium text-foreground">${total.toFixed(2)}</span>
                            </div>
                            {ppFee > 0 && (
                              <div className="flex justify-between text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Shield className="w-3 h-3 text-emerald-500" />
                                  Protection plan (platform)
                                </span>
                                <span className="font-medium text-red-500">−${ppFee.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-muted-foreground">
                              <span>
                                OutdoorShare service fee{exactFee == null ? ` (est. ${feePercent}%)` : ""}
                              </span>
                              <span className="font-medium text-red-500">
                                −${exactFee != null ? (exactFee - ppFee).toFixed(2) : estimatedServiceFee.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <Separator className="border-emerald-200" />
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-sm text-emerald-900">
                              {exactFee != null ? "Your net payout" : "Estimated payout"}
                            </span>
                            <span className="font-extrabold text-xl text-emerald-700">
                              ${yourEarnings.toFixed(2)}
                            </span>
                          </div>
                          {exactFee == null && (
                            <p className="text-[10px] text-muted-foreground leading-tight">
                              Estimate based on your {feePercent}% service fee rate. Exact amount confirmed after Stripe payment settles.
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
              
              {/* ── Split Payment Plan Status ── */}
              {(booking as any).paymentPlanEnabled && (
                <div className="mt-4 space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-800">Payment Plan</span>
                    {(booking as any).splitRemainingStatus === "charged" && (
                      <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Fully Paid</span>
                    )}
                    {(booking as any).splitRemainingStatus === "pending" && (
                      <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Remaining Pending</span>
                    )}
                    {(booking as any).splitRemainingStatus === "failed" && (
                      <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Charge Failed</span>
                    )}
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Deposit charged</span>
                      <span className="font-semibold text-blue-900">${parseFloat(String((booking as any).splitDepositAmount ?? 0)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Remaining balance</span>
                      <span className="font-semibold text-blue-900">${parseFloat(String((booking as any).splitRemainingAmount ?? 0)).toFixed(2)}</span>
                    </div>
                    {(booking as any).splitRemainingDueDate && (
                      <div className="flex justify-between">
                        <span className="text-blue-700">Due date</span>
                        <span className="font-medium text-blue-900">{(booking as any).splitRemainingDueDate}</span>
                      </div>
                    )}
                    {(booking as any).splitRemainingChargedAt && (
                      <div className="flex justify-between">
                        <span className="text-blue-700">Charged on</span>
                        <span className="font-medium text-blue-900">{format(new Date((booking as any).splitRemainingChargedAt), "MMM d, yyyy")}</span>
                      </div>
                    )}
                  </div>
                  {(booking as any).splitRemainingStatus !== "charged" && (
                    <Button
                      size="sm"
                      variant="default"
                      className="w-full mt-2"
                      onClick={async () => {
                        if (!confirm(`Charge the remaining $${parseFloat(String((booking as any).splitRemainingAmount ?? 0)).toFixed(2)} to the customer's saved card now?`)) return;
                        try {
                          const r = await fetch(`${BASE}/api/stripe/charge-remaining/${booking.id}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                          });
                          const d = await r.json();
                          if (!r.ok) { alert(d.error || "Charge failed."); return; }
                          toast({ title: "Remaining balance charged!", description: `$${parseFloat(String((booking as any).splitRemainingAmount ?? 0)).toFixed(2)} successfully charged.` });
                          fetchBooking();
                        } catch { alert("Connection error. Please try again."); }
                      }}
                    >
                      <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                      Charge Remaining ${parseFloat(String((booking as any).splitRemainingAmount ?? 0)).toFixed(2)} Now
                    </Button>
                  )}
                </div>
              )}

              {!(booking as any).paymentPlanEnabled && (
                <div className="mt-6 p-4 bg-muted rounded-lg space-y-3">
                  <div className="text-sm font-medium">Payment Status</div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Balance Due</span>
                    <span className="font-semibold text-green-600">$0.00</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
