import { useState, useEffect } from "react";
import { useLocation, useParams, Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Calendar, Package, User, Phone, Mail,
  Clock, CheckCircle2, XCircle, AlertCircle, FileSignature,
  StickyNote, ShieldCheck, MessageSquare
} from "lucide-react";
import { format, differenceInDays } from "date-fns";

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

type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";

function statusConfig(status: BookingStatus) {
  switch (status) {
    case "confirmed":  return { label: "Confirmed",  color: "border-green-300 text-green-700 bg-green-50",   icon: <CheckCircle2 className="w-4 h-4 text-green-600" /> };
    case "pending":    return { label: "Pending Review", color: "border-yellow-300 text-yellow-700 bg-yellow-50", icon: <Clock className="w-4 h-4 text-yellow-600" /> };
    case "cancelled":  return { label: "Cancelled",  color: "border-red-300 text-red-700 bg-red-50",         icon: <XCircle className="w-4 h-4 text-red-500" /> };
    case "completed":  return { label: "Completed",  color: "border-blue-300 text-blue-700 bg-blue-50",       icon: <CheckCircle2 className="w-4 h-4 text-blue-600" /> };
    case "no_show":    return { label: "No Show",    color: "border-gray-300 text-gray-600 bg-gray-50",       icon: <AlertCircle className="w-4 h-4 text-gray-400" /> };
    default:           return { label: status,       color: "border-gray-300 text-gray-600 bg-gray-50",       icon: <AlertCircle className="w-4 h-4 text-gray-400" /> };
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
        // Verify it belongs to this customer
        if (data.customerEmail?.toLowerCase() !== s.email.toLowerCase()) {
          setError("You don't have permission to view this booking.");
          return;
        }
        setBooking(data);
      })
      .catch(() => setError("Failed to load booking."))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (!session) return null;

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="h-8 w-32 rounded bg-muted animate-pulse" />
        <div className="h-40 rounded-2xl bg-muted/40 animate-pulse" />
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

  const addons: Array<{ id: number; name: string; price: number; priceType: string; subtotal: number }> =
    booking.addonsData ? JSON.parse(booking.addonsData) : [];

  const basePrice  = Number(booking.totalPrice ?? 0) - addons.reduce((s: number, a: any) => s + Number(a.subtotal ?? 0), 0);
  const totalPrice = Number(booking.totalPrice ?? 0);

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
          <h1 className="text-2xl font-bold">{booking.listingTitle ?? "Rental"}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Booking #{booking.id}</p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium ${color}`}>
          {icon}
          {label}
        </div>
      </div>

      {/* Dates card */}
      <div className="rounded-2xl border bg-background p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          Rental Dates
        </h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground text-xs mb-0.5 uppercase tracking-wide">Pick-up</div>
            <div className="font-semibold">{format(startDate, "EEE, MMM d, yyyy")}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs mb-0.5 uppercase tracking-wide">Return</div>
            <div className="font-semibold">{format(endDate, "EEE, MMM d, yyyy")}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs mb-0.5 uppercase tracking-wide">Duration</div>
            <div className="font-semibold">{days} day{days !== 1 ? "s" : ""}</div>
          </div>
        </div>
      </div>

      {/* Price card */}
      <div className="rounded-2xl border bg-background p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          Price Breakdown
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{booking.listingTitle} × {days} day{days !== 1 ? "s" : ""}</span>
            <span className="font-medium">${basePrice.toFixed(2)}</span>
          </div>
          {addons.map((a, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-muted-foreground">
                {a.name}
                {a.priceType === "per_day" && <span className="text-xs ml-1">× {days}d</span>}
              </span>
              <span className="font-medium">+${Number(a.subtotal ?? 0).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <Separator />
        <div className="flex justify-between font-bold text-base">
          <span>Total</span>
          <span>${totalPrice.toFixed(2)}</span>
        </div>
        {booking.depositPaid != null && (
          <p className="text-xs text-muted-foreground">
            Deposit paid: ${Number(booking.depositPaid).toFixed(2)}
          </p>
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

      {/* Notes */}
      {booking.notes && (
        <div className="rounded-2xl border bg-background p-5 space-y-2">
          <h2 className="font-semibold flex items-center gap-2 text-sm">
            <MessageSquare className="w-4 h-4 text-primary" />
            Your Notes
          </h2>
          <p className="text-sm text-muted-foreground">{booking.notes}</p>
        </div>
      )}

      {/* Admin notes (if any and booking is confirmed/completed) */}
      {booking.adminNotes && ["confirmed", "completed"].includes(booking.status) && (
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
          <h2 className="font-semibold flex items-center gap-2 text-sm text-green-700">
            <FileSignature className="w-4 h-4" />
            Rental Agreement Signed
          </h2>
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

      {/* Status-specific message */}
      {booking.status === "pending" && (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 flex items-start gap-2">
          <Clock className="w-4 h-4 mt-0.5 shrink-0 text-yellow-600" />
          <span>Your booking is waiting for confirmation from the rental company. You'll hear back shortly.</span>
        </div>
      )}
      {booking.status === "cancelled" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-2">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
          <span>This booking has been cancelled. Contact the rental company if you have questions.</span>
        </div>
      )}

      {/* Footer CTA */}
      <div className="pt-2 flex gap-3">
        <Link href={`${base}/my-bookings`} className="flex-1">
          <Button variant="outline" className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            All Bookings
          </Button>
        </Link>
        <Link href={base || "/"} className="flex-1">
          <Button className="w-full">
            Browse More Rentals
          </Button>
        </Link>
      </div>
    </div>
  );
}
