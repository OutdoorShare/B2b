import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Calendar, Package, User, Phone, Mail,
  Clock, CheckCircle2, XCircle, AlertCircle, FileSignature, FileText, ExternalLink,
  StickyNote, ShieldCheck, MessageSquare, CreditCard,
  MapPin, Monitor, Smartphone, Phone as PhoneIcon, Users,
  Receipt, Tag, Camera, ImagePlus, Upload, X as XIcon, Loader2, RotateCcw,
  IdCard
} from "lucide-react";
import { format, differenceInDays, startOfDay, parseISO, subHours } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CustomerSession {
  id: number;
  email: string;
  name: string;
  phone?: string;
}

function loadSession(): CustomerSession | null {
  try {
    const raw = localStorage.getItem("rental_customer");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

type BookingStatus = "pending" | "confirmed" | "active" | "completed" | "cancelled" | "no_show";

function statusConfig(status: BookingStatus) {
  switch (status) {
    case "confirmed":  return { label: "Confirmed",  color: "border-green-300 text-green-700 bg-green-50",   icon: <CheckCircle2 className="w-4 h-4 text-green-600" /> };
    case "active":     return { label: "Active",     color: "border-green-300 text-green-700 bg-green-50",   icon: <CheckCircle2 className="w-4 h-4 text-green-600" /> };
    case "pending":    return { label: "Pending Review", color: "border-yellow-300 text-yellow-700 bg-yellow-50", icon: <Clock className="w-4 h-4 text-yellow-600" /> };
    case "cancelled":  return { label: "Cancelled",  color: "border-red-300 text-red-700 bg-red-50",         icon: <XCircle className="w-4 h-4 text-red-500" /> };
    case "completed":  return { label: "Completed",  color: "border-blue-300 text-blue-700 bg-blue-50",       icon: <CheckCircle2 className="w-4 h-4 text-blue-600" /> };
    case "no_show":    return { label: "No Show",    color: "border-gray-300 text-gray-600 bg-gray-50",       icon: <AlertCircle className="w-4 h-4 text-gray-400" /> };
    default:           return { label: status,       color: "border-gray-300 text-gray-600 bg-gray-50",       icon: <AlertCircle className="w-4 h-4 text-gray-400" /> };
  }
}

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  switch (source) {
    case "kiosk":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
          <Monitor className="w-3 h-3" /> Kiosk
        </span>
      );
    case "online":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
          <Smartphone className="w-3 h-3" /> Online
        </span>
      );
    case "phone":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
          <PhoneIcon className="w-3 h-3" /> Phone
        </span>
      );
    case "walkin":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
          <Users className="w-3 h-3" /> Walk-in
        </span>
      );
    default:
      return null;
  }
}

export default function MyBookingDetail() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const [, setLocation] = useLocation();
  const base = slug ? `/${slug}` : "";

  const [session, setSession] = useState<CustomerSession | null>(null);
  const [booking, setBooking] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Pickup photo upload state
  const [staged, setStaged] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [photoDone, setPhotoDone] = useState(false);
  const [savedPhotos, setSavedPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      setLocation(`${base}/login?redirect=${encodeURIComponent(`${base}/my-bookings/${id}`)}`);
      return;
    }
    setSession(s);

    fetch(`${BASE}/api/bookings/${id}`, {
      headers: { "x-tenant-slug": slug ?? "" }
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError("Booking not found."); return; }
        // Verify it belongs to this customer (trim + lowercase for safety)
        if ((data.customerEmail ?? "").toLowerCase().trim() !== s.email.toLowerCase().trim()) {
          setError("You don't have permission to view this booking.");
          return;
        }
        setBooking(data);
        // Initialize photo state from existing booking data
        if (Array.isArray(data.pickupPhotos) && data.pickupPhotos.length > 0) {
          setSavedPhotos(data.pickupPhotos);
          setPhotoDone(true);
        }
      })
      .catch(() => setError("Failed to load booking."))
      .finally(() => setIsLoading(false));
  }, [id]);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!valid.length) return;
    setStaged(prev => [...prev, ...valid]);
    valid.forEach(f => {
      const reader = new FileReader();
      reader.onload = e => setPreviews(prev => [...prev, e.target?.result as string]);
      reader.readAsDataURL(f);
    });
  }, []);

  const removeStaged = (i: number) => {
    setStaged(prev => prev.filter((_, idx) => idx !== i));
    setPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const submitPhotos = async () => {
    if (staged.length === 0 || !id) return;
    setUploading(true);
    try {
      const fd = new FormData();
      staged.forEach(f => fd.append("photos", f));
      const r = await fetch(`${BASE}/api/bookings/${id}/before-photos`, { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok || data.error) return;
      setSavedPhotos(data.photos ?? []);
      setPhotoDone(true);
      setStaged([]);
      setPreviews([]);
    } finally {
      setUploading(false);
    }
  };

  if (!session) return null;

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="h-8 w-32 rounded bg-muted animate-pulse" />
        <div className="h-40 rounded-2xl bg-muted/40 animate-pulse" />
        <div className="h-32 rounded-2xl bg-muted/40 animate-pulse" />
        <div className="h-32 rounded-2xl bg-muted/40 animate-pulse" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <Link href={`${base}/my-bookings`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> My Bookings
          </Button>
        </Link>
        <div className="rounded-2xl border bg-background p-10 text-center text-muted-foreground">
          {error || "Booking not found."}
        </div>
      </div>
    );
  }

  const { label, color, icon } = statusConfig(booking.status);
  const startDate = new Date(booking.startDate + "T00:00:00");
  const endDate   = new Date(booking.endDate + "T00:00:00");
  const days = Math.max(1, differenceInDays(endDate, startDate));

  // ── Pickup photo window: opens 12 hours before rental start ──────────────
  // Parse the pickup datetime from the date + optional "10:00 AM" style time
  const pickupDatetime = (() => {
    const base = parseISO(booking.startDate);
    const t = booking.pickupTime;
    if (t) {
      const m = t.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (m) {
        let h = parseInt(m[1]);
        const min = parseInt(m[2]);
        const ampm = m[3]?.toUpperCase();
        if (ampm === "PM" && h !== 12) h += 12;
        if (ampm === "AM" && h === 12) h = 0;
        base.setHours(h, min, 0, 0);
      } else {
        base.setHours(0, 0, 0, 0);
      }
    }
    return base;
  })();
  const photoWindowOpensAt = subHours(pickupDatetime, 12);
  const now = new Date();
  const photoWindowOpen = now >= photoWindowOpensAt;
  const hoursUntilWindow = Math.ceil((photoWindowOpensAt.getTime() - now.getTime()) / (1000 * 60 * 60));
  const canShowPhotoUpload = (booking.status === "confirmed" || booking.status === "active") && photoWindowOpen;
  const photoWindowPending = booking.status === "confirmed" && !photoWindowOpen;

  let addons: Array<{ id: number; name: string; price: number; priceType: string; subtotal: number }> = [];
  try {
    addons = booking.addonsData ? JSON.parse(booking.addonsData) : [];
  } catch { addons = []; }

  const addonsTotal = addons.reduce((s: number, a: any) => s + Number(a.subtotal ?? 0), 0);
  const protectionPlanFee = Number((booking as any).protectionPlanFee ?? 0);
  const basePrice   = Number(booking.totalPrice ?? 0) - addonsTotal - protectionPlanFee;
  const totalPrice  = Number(booking.totalPrice ?? 0);

  const hasPayment = booking.stripePaymentIntentId || booking.stripePaymentStatus;
  const paymentPaid = booking.stripePaymentStatus === "succeeded" || booking.stripePaymentStatus === "paid";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Back link */}
      <Link href={`${base}/my-bookings`}>
        <Button variant="ghost" size="sm" className="text-muted-foreground -ml-2">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> My Bookings
        </Button>
      </Link>

      {/* Title + Status */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-2xl font-bold">{booking.listingTitle ?? "Rental"}</h1>
            <SourceBadge source={booking.source} />
          </div>
          <p className="text-muted-foreground text-sm">Booking #{booking.id} · Booked {format(new Date(booking.createdAt), "MMM d, yyyy")}</p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium ${color}`}>
          {icon}
          {label}
        </div>
      </div>

      {/* Status-specific banners */}
      {booking.status === "pending" && (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 flex items-start gap-2">
          <Clock className="w-4 h-4 mt-0.5 shrink-0 text-yellow-600" />
          <span>Your booking is awaiting confirmation. You'll receive an email once it's reviewed.</span>
        </div>
      )}
      {booking.status === "confirmed" && (() => {
        const today    = startOfDay(new Date());
        const start    = startOfDay(startDate);
        const daysAway = differenceInDays(start, today);
        const isToday  = daysAway === 0;

        return (
          <div className={`rounded-2xl border-2 overflow-hidden ${isToday ? "border-green-400" : "border-green-200"}`}>
            {/* Header */}
            <div className={`px-5 py-4 flex items-center gap-3 ${isToday ? "bg-green-600" : "bg-green-50"}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isToday ? "bg-white/20" : "bg-green-100"}`}>
                <CheckCircle2 className={`w-6 h-6 ${isToday ? "text-white" : "text-green-600"}`} />
              </div>
              <div>
                <p className={`font-bold text-base ${isToday ? "text-white" : "text-green-800"}`}>
                  {isToday ? "Today is your pickup day!" : daysAway === 1 ? "Your pickup is tomorrow" : `Your booking is confirmed`}
                </p>
                <p className={`text-sm mt-0.5 ${isToday ? "text-green-100" : "text-green-700"}`}>
                  {isToday
                    ? `Head over to pick up your ${booking.listingTitle ?? "rental"}`
                    : `Pickup on ${format(startDate, "EEEE, MMMM d")}`
                  }
                </p>
              </div>
            </div>

            {/* Bring with you */}
            <div className="px-5 pt-4 pb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">What to bring</p>
              <div className="space-y-2">
                {[
                  { icon: <User className="w-4 h-4 text-green-600" />, text: "Valid government-issued photo ID" },
                  { icon: <FileSignature className="w-4 h-4 text-green-600" />, text: "Your signed rental agreement (already completed)" },
                  { icon: <CreditCard className="w-4 h-4 text-green-600" />, text: "Payment method on file" },
                ].map(({ icon, text }, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
                      {icon}
                    </div>
                    <span className="text-sm text-foreground">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* What will happen */}
            <div className="px-5 pt-3 pb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">What to expect</p>
              <ol className="space-y-2">
                {[
                  "Staff will check your ID and look up your booking",
                  "You'll photograph the equipment condition — this protects you from any damage disputes",
                  "Pick up your gear and enjoy!",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        );
      })()}
      {booking.status === "cancelled" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-2">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
          <span>This booking has been cancelled. Contact the rental company if you have questions.</span>
        </div>
      )}

      {/* Time remaining */}
      {(() => {
        const skip = ["cancelled", "completed", "no_show"];
        if (skip.includes(booking.status)) return null;
        const today     = startOfDay(new Date());
        const start     = startOfDay(startDate);
        const end       = startOfDay(endDate);
        const daysToStart = differenceInDays(start, today);
        const daysToEnd   = differenceInDays(end,   today);
        const totalDays   = Math.max(1, differenceInDays(end, start));
        const elapsed     = Math.max(0, differenceInDays(today, start));
        const pct         = Math.min(100, Math.round((elapsed / totalDays) * 100));

        let label = "", sub = "", icon = <Clock className="w-4 h-4" />;
        let border = "border-primary/20", bg = "bg-primary/5", text = "text-primary", bar = "bg-primary";

        if (daysToStart > 1)    { label = `Starts in ${daysToStart} days`;   sub = `Pickup on ${format(start, "EEEE, MMMM d")}`; border="border-blue-200"; bg="bg-blue-50"; text="text-blue-700"; bar="bg-blue-500"; }
        else if (daysToStart===1){ label = "Starts tomorrow";                 sub = `Pickup on ${format(start, "EEEE, MMMM d")}`; border="border-blue-200"; bg="bg-blue-50"; text="text-blue-700"; bar="bg-blue-500"; }
        else if (daysToStart===0){ label = "Today is your pickup day!";       sub = "Check in with the rental company when you arrive"; border="border-green-200"; bg="bg-green-50"; text="text-green-700"; bar="bg-green-500"; }
        else if (daysToEnd > 1) { label = `${daysToEnd} days remaining`;     sub = `Return by ${format(end, "EEEE, MMMM d")}`; border="border-green-200"; bg="bg-green-50"; text="text-green-700"; bar="bg-green-500"; }
        else if (daysToEnd===1) { label = "Return tomorrow";                  sub = `Due back ${format(end, "EEEE, MMMM d")}`; border="border-amber-200"; bg="bg-amber-50"; text="text-amber-700"; bar="bg-amber-500"; }
        else if (daysToEnd===0) { label = "Return due today";                 sub = "Please return the equipment by end of day"; border="border-amber-200"; bg="bg-amber-50"; text="text-amber-700"; bar="bg-amber-500"; }
        else                    { label = `Overdue by ${Math.abs(daysToEnd)} day${Math.abs(daysToEnd)!==1?"s":""}`; sub = `Was due back ${format(end, "EEEE, MMMM d")}`; border="border-red-200"; bg="bg-red-50"; text="text-red-700"; bar="bg-red-500"; }

        return (
          <div className={`rounded-2xl border ${border} ${bg} p-4 space-y-2.5`}>
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 font-semibold text-sm ${text}`}>
                <Clock className="w-4 h-4" />
                {label}
              </div>
              {daysToStart < 0 && (
                <span className="text-xs text-muted-foreground">{pct}% of rental used</span>
              )}
            </div>
            {daysToStart < 0 && (
              <div className="h-2.5 bg-black/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${bar} transition-all`} style={{ width: `${pct}%` }} />
              </div>
            )}
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        );
      })()}

      {/* ── Pickup photo window not yet open ── */}
      {photoWindowPending && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
          <Camera className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-800 text-sm">Pickup photo upload opens soon</p>
            <p className="text-xs text-blue-600 mt-0.5">
              You'll be able to document the equipment condition starting{" "}
              <strong>{format(photoWindowOpensAt, "EEEE, MMM d 'at' h:mm a")}</strong>
              {hoursUntilWindow > 1 ? ` — ${hoursUntilWindow} hours from now` : " — less than an hour away"}.
            </p>
            <p className="text-xs text-blue-500 mt-1">Photos protect you from any damage claims after your rental.</p>
          </div>
        </div>
      )}

      {/* ── Pickup Photos Section (confirmed within 12 hrs + active bookings) ── */}
      {canShowPhotoUpload && (
        <div className={`rounded-2xl border overflow-hidden ${photoDone ? "border-green-200" : "border-primary/30"}`}>
          {/* Header */}
          <div className={`px-5 py-4 border-b flex items-center gap-3 ${photoDone ? "bg-green-50" : "bg-primary/5"}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${photoDone ? "bg-green-100" : "bg-primary/10"}`}>
              <Camera className={`w-5 h-5 ${photoDone ? "text-green-600" : "text-primary"}`} />
            </div>
            <div className="flex-1">
              <p className={`font-semibold text-sm ${photoDone ? "text-green-800" : "text-foreground"}`}>
                {photoDone ? "Pickup Photos Submitted" : "Upload Pickup Photos"}
              </p>
              <p className={`text-xs mt-0.5 ${photoDone ? "text-green-600" : "text-muted-foreground"}`}>
                {photoDone
                  ? `${savedPhotos.length} photo${savedPhotos.length !== 1 ? "s" : ""} saved — you're all set for pickup!`
                  : "Document the equipment condition before you leave to protect yourself from damage claims."}
              </p>
            </div>
            {photoDone && <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />}
          </div>

          <div className="p-5 space-y-4">
            {photoDone ? (
              /* Submitted photos grid */
              savedPhotos.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {savedPhotos.map((url, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden bg-muted">
                      <img src={url} alt={`Pickup photo ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">Photos saved to your booking.</p>
              )
            ) : (
              <>
                {/* Drop zone */}
                <div
                  className="rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5 transition-colors p-6 text-center cursor-pointer"
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">Tap to add photos</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">All sides, existing scratches, serial numbers</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => addFiles(e.target.files)}
                    capture="environment"
                  />
                </div>

                {/* Staged preview grid */}
                {previews.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {previews.map((src, i) => (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-muted group">
                        <img src={src} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={e => { e.stopPropagation(); removeStaged(i); }}
                          className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <XIcon className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-muted-foreground/25 flex items-center justify-center hover:border-primary/50 transition-colors"
                    >
                      <ImagePlus className="w-5 h-5 text-muted-foreground/40" />
                    </button>
                  </div>
                )}

                <Button
                  onClick={submitPhotos}
                  disabled={staged.length === 0 || uploading}
                  className="w-full gap-2"
                >
                  {uploading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Uploading…</>
                  ) : (
                    <><Upload className="w-4 h-4" />Submit {staged.length > 0 ? `${staged.length} Photo${staged.length !== 1 ? "s" : ""}` : "Photos"}</>
                  )}
                </Button>
                {staged.length === 0 && (
                  <p className="text-xs text-center text-muted-foreground">Add at least one photo to submit</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Contact Card — shown for confirmed/active/completed bookings with a card */}
      {booking.contactCard && ["confirmed", "active", "completed"].includes(booking.status) && (() => {
        const card = booking.contactCard as { name?: string; address?: string; phone?: string; email?: string; instructions?: string };
        return (
          <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 overflow-hidden">
            <div className="px-5 py-4 border-b border-primary/15 flex items-center gap-3 bg-primary/10">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <IdCard className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">Pickup Contact</p>
                <p className="text-xs text-muted-foreground mt-0.5">Contact your host using the details below</p>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              {card.name && <p className="font-semibold text-base">{card.name}</p>}
              {card.address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-foreground">{card.address}</span>
                </div>
              )}
              {card.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-primary shrink-0" />
                  <a href={`tel:${card.phone}`} className="text-foreground hover:text-primary transition-colors font-medium">{card.phone}</a>
                </div>
              )}
              {card.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-primary shrink-0" />
                  <a href={`mailto:${card.email}`} className="text-foreground hover:text-primary transition-colors font-medium">{card.email}</a>
                </div>
              )}
              {card.instructions && (
                <div className="rounded-xl bg-background border border-primary/15 p-3 text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground text-xs uppercase tracking-wide mb-1">Special Instructions</p>
                  <p className="whitespace-pre-wrap">{card.instructions}</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Dates & Times card */}
      <div className="rounded-2xl border bg-background p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          Rental Dates
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground text-xs mb-1 uppercase tracking-wide font-medium">Pick-up</div>
            <div className="font-semibold">{format(startDate, "EEE, MMM d, yyyy")}</div>
            {booking.pickupTime && (
              <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                <Clock className="w-3 h-3" />
                <span>{booking.pickupTime}</span>
              </div>
            )}
          </div>
          <div>
            <div className="text-muted-foreground text-xs mb-1 uppercase tracking-wide font-medium">Return</div>
            <div className="font-semibold">{format(endDate, "EEE, MMM d, yyyy")}</div>
            {booking.dropoffTime && (
              <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                <Clock className="w-3 h-3" />
                <span>{booking.dropoffTime}</span>
              </div>
            )}
          </div>
        </div>
        <div className="pt-1 border-t">
          <span className="text-sm text-muted-foreground">
            Duration: <span className="font-semibold text-foreground">{days} day{days !== 1 ? "s" : ""}</span>
          </span>
        </div>
      </div>

      {/* Price / Receipt card */}
      <div className="rounded-2xl border bg-background p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" />
          Receipt
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {booking.listingTitle} × {days} day{days !== 1 ? "s" : ""}
            </span>
            <span className="font-medium">${basePrice.toFixed(2)}</span>
          </div>
          {addons.map((a, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Tag className="w-3 h-3 text-green-500" />
                {a.name}
                {a.priceType === "per_day" && <span className="text-xs ml-0.5">× {days}d</span>}
              </span>
              <span className="font-medium text-green-700">+${Number(a.subtotal ?? 0).toFixed(2)}</span>
            </div>
          ))}
          {protectionPlanFee > 0 && (
            <div className="flex justify-between">
              <span className="text-blue-700 flex items-center gap-1.5">
                <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="h-3.5 object-contain opacity-80" />
                <a href="https://myoutdoorshare.com/protection-plan" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-900">
                  Protection Plan
                </a>
              </span>
              <span className="font-medium text-blue-700">+${protectionPlanFee.toFixed(2)}</span>
            </div>
          )}
        </div>
        <Separator />
        <div className="flex justify-between font-bold text-base">
          <span>Total</span>
          <span>${totalPrice.toFixed(2)}</span>
        </div>
        {booking.depositPaid != null && Number(booking.depositPaid) > 0 && (() => {
          const holdStatus = (booking as any).depositHoldStatus as string | null | undefined;
          const amount = Number(booking.depositPaid);
          const statusMap: Record<string, { label: string; color: string; note: string }> = {
            authorized: {
              label: "Hold Active",
              color: "bg-amber-100 text-amber-800 border-amber-300",
              note: "A hold has been placed on your card. It will be released when you return the rental in good condition.",
            },
            released: {
              label: "Released",
              color: "bg-green-100 text-green-800 border-green-300",
              note: "Your security deposit hold has been released back to your card.",
            },
            captured: {
              label: "Charged",
              color: "bg-red-100 text-red-800 border-red-300",
              note: "Your security deposit was charged. Please contact the rental company for details.",
            },
          };
          const cfg = holdStatus ? statusMap[holdStatus] : null;
          return (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Security Deposit
                  </span>
                  <span className="font-medium text-sm">${amount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Status</span>
                  {cfg ? (
                    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border border-gray-300 text-gray-600 bg-gray-50">
                      Pending Authorization
                    </span>
                  )}
                </div>
                {cfg?.note && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{cfg.note}</p>
                )}
                {!cfg && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A hold for this amount will be placed on your card at pickup and released when you return the rental in good condition.
                  </p>
                )}
              </div>
            </>
          );
        })()}

        {/* Payment status */}
        {hasPayment && (
          <>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CreditCard className="w-3.5 h-3.5" />
                Payment
              </span>
              {paymentPaid ? (
                <span className="flex items-center gap-1 text-green-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                </span>
              ) : (
                <span className="flex items-center gap-1 text-yellow-700 font-medium">
                  <Clock className="w-3.5 h-3.5" /> {booking.stripePaymentStatus ?? "Pending"}
                </span>
              )}
            </div>
          </>
        )}
        {!hasPayment && (
          <>
            <Separator />
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" />
              Payment will be collected upon confirmation.
            </p>
          </>
        )}
      </div>

      {/* Contact Info */}
      <div className="rounded-2xl border bg-background p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          Your Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="w-3.5 h-3.5 shrink-0" />
            <span>{booking.customerName}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{booking.customerEmail}</span>
          </div>
          {booking.customerPhone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-3.5 h-3.5 shrink-0" />
              <span>{booking.customerPhone}</span>
            </div>
          )}
        </div>
      </div>

      {/* Customer notes */}
      {booking.notes && (
        <div className="rounded-2xl border bg-background p-5 space-y-2">
          <h2 className="font-semibold flex items-center gap-2 text-sm">
            <MessageSquare className="w-4 h-4 text-primary" />
            Your Notes
          </h2>
          <p className="text-sm text-muted-foreground">{booking.notes}</p>
        </div>
      )}

      {/* Admin note */}
      {booking.adminNotes && ["confirmed", "completed", "active"].includes(booking.status) && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 space-y-2">
          <h2 className="font-semibold flex items-center gap-2 text-sm text-blue-700">
            <StickyNote className="w-4 h-4" />
            Note from the rental company
          </h2>
          <p className="text-sm text-blue-800">{booking.adminNotes}</p>
        </div>
      )}

      {/* Signed Agreement */}
      {booking.agreementSignerName && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold flex items-center gap-2 text-sm text-green-700">
              <FileSignature className="w-4 h-4" />
              Rental Agreement Signed
            </h2>
            {(booking as any).agreementPdfPath && (
              <div className="flex items-center gap-1.5">
                <a
                  href={`${BASE}/api/bookings/${booking.id}/agreement-pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-900 bg-white border border-green-200 rounded-md px-2.5 py-1.5 transition-colors hover:bg-green-50"
                >
                  <FileText className="w-3.5 h-3.5" />
                  View PDF
                  <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
                </a>
                <a
                  href={`${BASE}/api/bookings/${booking.id}/agreement-pdf?download=1`}
                  download={`rental-agreement-${booking.id}.pdf`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-green-600/70 hover:text-green-800 transition-colors px-1"
                  title="Download PDF"
                >
                  ↓
                </a>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-green-600/70 text-xs mb-0.5">Signed by</div>
              <div className="font-medium text-green-800">{booking.agreementSignerName}</div>
            </div>
            <div>
              <div className="text-green-600/70 text-xs mb-0.5">Date</div>
              <div className="font-medium text-green-800">
                {booking.agreementSignedAt
                  ? format(new Date(booking.agreementSignedAt), "MMM d, yyyy h:mm a")
                  : "—"}
              </div>
            </div>
          </div>
          {booking.agreementSignature && (
            <div>
              <div className="text-green-600/70 text-xs mb-1.5">Your signature</div>
              <div className="bg-white border border-green-200 rounded-lg p-2 inline-block">
                <img
                  src={booking.agreementSignature}
                  alt="Your signature"
                  className="max-h-12 w-auto"
                />
              </div>
            </div>
          )}
          <div className="flex items-start gap-1.5 text-xs text-green-600/80">
            <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>You have agreed to the rental terms &amp; conditions for this booking.</span>
          </div>
        </div>
      )}

      {/* Footer CTAs */}
      <div className="pt-2 flex gap-3">
        <Link href={`${base}/my-bookings`} className="flex-1">
          <Button variant="outline" className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            All Bookings
          </Button>
        </Link>
        {["completed", "cancelled", "no_show"].includes(booking.status) && booking.listingId ? (
          <Button
            className="flex-1"
            onClick={() => setLocation(`${base}/book?listingId=${booking.listingId}`)}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Rebook This
          </Button>
        ) : (
          <Link href={base || "/"} className="flex-1">
            <Button className="w-full">
              Browse More Rentals
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
