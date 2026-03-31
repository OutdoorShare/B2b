import { adminPath, getAdminSession } from "@/lib/admin-nav";
import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { 
  useGetBooking, 
  useUpdateBooking,
  getGetBookingQueryKey,
  getGetBookingsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { ArrowLeft, User, Phone, Mail, Calendar, Package, StickyNote, ShieldAlert, Pencil, FileSignature, FileText, ChevronDown, ChevronUp, Download, Camera, CheckCircle2, Loader2, ExternalLink, ImageIcon, Clock, ShieldCheck, ShieldX, Shield, AlertCircle, Copy, Send, UserCheck, Lock, LockOpen, DollarSign } from "lucide-react";
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
  const queryClient = useQueryClient();

  const { data: booking, isLoading } = useGetBooking(id, {
    query: { enabled: !!id, queryKey: getGetBookingQueryKey(id) }
  });

  const updateBooking = useUpdateBooking();
  const [adminNotes, setAdminNotes] = useState("");
  const [agreementExpanded, setAgreementExpanded] = useState(false);
  const [sendingPickupLink, setSendingPickupLink] = useState(false);
  const [pickupLinkSent, setPickupLinkSent] = useState(false);
  const [pickupUrl, setPickupUrl] = useState<string | null>(null);
  const [hostPickupMode, setHostPickupMode] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [depositLoading, setDepositLoading] = useState<"authorize" | "release" | "capture" | null>(null);
  const [depositHoldStatus, setDepositHoldStatus] = useState<string | null>(null);

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
  }, [booking]);

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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

  const copyPickupLink = async () => {
    let url = pickupUrl;
    if (!url) {
      // Fetch the link without sending an email
      try {
        const r = await fetch(`${BASE}/api/bookings/${id}/pickup-link`, {
          headers: getAdminSession()?.token ? { "x-admin-token": getAdminSession()!.token } : {},
        });
        const data = await r.json();
        if (data.pickupUrl) { url = data.pickupUrl; setPickupUrl(data.pickupUrl); }
      } catch {}
    }
    if (!url) { toast({ title: "Could not retrieve link", variant: "destructive" }); return; }
    await navigator.clipboard.writeText(url);
    setCopySuccess(true);
    toast({ title: "Link copied!", description: "Paste it in a text message or email to the renter." });
    setTimeout(() => setCopySuccess(false), 3000);
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

  const handleStatusChange = (newStatus: any) => {
    updateBooking.mutate(
      { id, data: { status: newStatus } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetBookingQueryKey(id), data);
          queryClient.invalidateQueries({ queryKey: getGetBookingsQueryKey() });
          toast({ title: `Booking marked as ${newStatus}` });
        }
      }
    );
  };

  const saveNotes = () => {
    updateBooking.mutate(
      { id, data: { adminNotes } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetBookingQueryKey(id), data);
          toast({ title: "Notes saved successfully" });
        }
      }
    );
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

      <div className="flex flex-wrap gap-3 items-center">
        <Button variant="outline" className="gap-2" onClick={() => setLocation(adminPath(`/bookings/${id}/edit`))}>
          <Pencil className="w-4 h-4" /> Edit Booking
        </Button>
        <Button 
          variant={booking.status === 'confirmed' ? "default" : "outline"}
          onClick={() => handleStatusChange('confirmed')}
          disabled={booking.status === 'confirmed'}
        >
          Confirm Booking
        </Button>
        <Button 
          variant={booking.status === 'active' ? "default" : "outline"}
          onClick={() => handleStatusChange('active')}
          disabled={booking.status === 'active'}
          className={booking.status === 'active' ? "bg-green-600 hover:bg-green-700" : ""}
        >
          Mark as Picked Up
        </Button>
        <Button 
          variant={booking.status === 'completed' ? "default" : "outline"}
          onClick={() => handleStatusChange('completed')}
          disabled={booking.status === 'completed'}
        >
          Mark as Returned
        </Button>

        {booking.status === 'completed' && (
          <Link href={adminPath(`/claims/new?bookingId=${booking.id}&listingId=${booking.listingId}&customerName=${encodeURIComponent(booking.customerName)}&customerEmail=${encodeURIComponent(booking.customerEmail)}`)}>
            <Button variant="outline" className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400">
              <ShieldAlert className="w-4 h-4" />
              Submit Claim
            </Button>
          </Link>
        )}


        <Button 
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive ml-auto"
          onClick={() => handleStatusChange('cancelled')}
          disabled={booking.status === 'cancelled'}
        >
          Cancel Booking
        </Button>
      </div>

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

          {/* ── Pickup Documentation Card — always visible for confirmed/active ── */}
          {['confirmed', 'active'].includes(booking.status) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Camera className="w-5 h-5 text-primary" />
                  Pickup Documentation
                  {(booking as any).pickupCompletedAt && (
                    <span className="ml-auto">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    </span>
                  )}
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Ask the renter to photograph equipment condition. Protects both parties against damage disputes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* ── STATE 1: Photos received ── */}
                {(booking as any).pickupPhotos?.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {(booking as any).pickupPhotos.map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="relative group">
                          <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                            <img src={url} alt={`Pickup photo ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors">
                            <ExternalLink className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </a>
                      ))}
                    </div>
                    {(booking as any).pickupCompletedAt && (
                      <p className="text-xs text-muted-foreground">
                        Submitted {format(new Date((booking as any).pickupCompletedAt), "MMM d, yyyy h:mm a")}
                      </p>
                    )}
                    {/* Allow resending even when photos received */}
                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground gap-1.5" onClick={copyPickupLink}>
                      {copySuccess ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copySuccess ? "Copied!" : "Copy upload link"}
                    </Button>
                  </>
                ) : (booking as any).pickupLinkSent || pickupLinkSent ? (
                  /* ── STATE 2: Link sent, awaiting photos ── */
                  <>
                    <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                      <div className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-blue-800">Link sent — awaiting photos</p>
                        <p className="text-xs text-blue-700">The renter will receive an email with an upload link.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
                        onClick={copyPickupLink}
                        disabled={copySuccess}
                      >
                        {copySuccess ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copySuccess ? "Copied!" : "Copy Link"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => sendPickupLink(hostPickupMode)}
                        disabled={sendingPickupLink}
                      >
                        {sendingPickupLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Resend Email
                      </Button>
                    </div>
                  </>
                ) : (
                  /* ── STATE 3: Not sent yet ── */
                  <>
                    {/* Host pickup toggle */}
                    <div className="flex items-start gap-3 p-3 rounded-xl border bg-muted/40">
                      <button
                        onClick={() => setHostPickupMode(v => !v)}
                        className={`relative shrink-0 w-9 h-5 rounded-full transition-colors mt-0.5 ${hostPickupMode ? "bg-primary" : "bg-muted-foreground/30"}`}
                        role="switch"
                        aria-checked={hostPickupMode}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${hostPickupMode ? "translate-x-4" : ""}`} />
                      </button>
                      <div>
                        <p className="text-sm font-semibold flex items-center gap-1.5">
                          <UserCheck className="w-4 h-4 text-muted-foreground" />
                          Host did the pickup
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                          {hostPickupMode
                            ? "Email will say the host completed the handoff and ask the renter to document the condition."
                            : "Email will ask the renter to photograph the equipment before pickup."}
                        </p>
                      </div>
                    </div>

                    <Button
                      className="w-full gap-2"
                      onClick={() => sendPickupLink(hostPickupMode)}
                      disabled={sendingPickupLink}
                    >
                      {sendingPickupLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Email Upload Link to Renter
                    </Button>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 border-t" />
                      <span className="text-xs text-muted-foreground">or</span>
                      <div className="flex-1 border-t" />
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={copyPickupLink}
                    >
                      {copySuccess ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      {copySuccess ? "Copied to clipboard!" : "Copy link to share manually"}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center -mt-1">
                      Paste in a text message, WhatsApp, or chat
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )}
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
                {!depositHoldStatus && (
                  <Button
                    className="w-full gap-2"
                    onClick={() => handleDepositAction("authorize")}
                    disabled={depositLoading !== null}
                  >
                    {depositLoading === "authorize" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    Authorize Hold at Pickup
                  </Button>
                )}
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

          <Card>
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                let parsedAddons: Array<{ id?: number; name: string; price: number; subtotal?: number }> = [];
                try { parsedAddons = (booking as any).addonsData ? JSON.parse((booking as any).addonsData) : []; } catch {}
                const addonsTotal = parsedAddons.reduce((s, a) => s + (a.subtotal ?? a.price ?? 0), 0);
                const rentalFee = booking.totalPrice - addonsTotal;
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
                    {protectionAddons.map((addon, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Shield className="w-3.5 h-3.5 text-emerald-600" />
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
                      <span className="font-bold text-lg">Total</span>
                      <span className="font-bold text-2xl">${booking.totalPrice.toFixed(2)}</span>
                    </div>
                  </>
                );
              })()}
              
              <div className="mt-6 p-4 bg-muted rounded-lg space-y-3">
                <div className="text-sm font-medium">Payment Status</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Balance Due</span>
                  <span className="font-semibold text-green-600">$0.00</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
