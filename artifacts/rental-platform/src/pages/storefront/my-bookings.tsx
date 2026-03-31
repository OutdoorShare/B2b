import { useState, useEffect } from "react";
import { useLocation, useParams, Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Calendar, ChevronRight, Package, Clock, CheckCircle2,
  XCircle, AlertCircle, User, LogOut, ArrowRight, RotateCcw
} from "lucide-react";
import { format, differenceInDays, startOfDay } from "date-fns";

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
    case "confirmed":  return { label: "Confirmed",  color: "bg-green-100 text-green-700 border-green-200" };
    case "pending":    return { label: "Pending",    color: "bg-yellow-100 text-yellow-700 border-yellow-200" };
    case "cancelled":  return { label: "Cancelled",  color: "bg-red-100 text-red-700 border-red-200" };
    case "completed":  return { label: "Completed",  color: "bg-blue-100 text-blue-700 border-blue-200" };
    case "no_show":    return { label: "No Show",    color: "bg-gray-100 text-gray-600 border-gray-200" };
    default:           return { label: status,       color: "bg-gray-100 text-gray-600 border-gray-200" };
  }
}

function StatusIcon({ status }: { status: BookingStatus }) {
  switch (status) {
    case "confirmed":  return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    case "pending":    return <Clock className="w-4 h-4 text-yellow-600" />;
    case "cancelled":  return <XCircle className="w-4 h-4 text-red-500" />;
    case "completed":  return <CheckCircle2 className="w-4 h-4 text-blue-600" />;
    default:           return <AlertCircle className="w-4 h-4 text-gray-400" />;
  }
}

export default function MyBookings() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const base = slug ? `/${slug}` : "";

  const [session, setSession] = useState<CustomerSession | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      setLocation(`${base}/login?redirect=${encodeURIComponent(`${base}/my-bookings`)}`);
      return;
    }
    setSession(s);

    fetch(`${BASE}/api/bookings?customerEmail=${encodeURIComponent(s.email)}`, {
      headers: { "x-tenant-slug": slug ?? "" }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setBookings(data.sort((a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ));
        } else {
          setError("Failed to load bookings.");
        }
      })
      .catch(() => setError("Failed to load bookings."))
      .finally(() => setIsLoading(false));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("rental_customer");
    setLocation(`${base}/login`);
  };

  if (!session) return null;

  const upcomingBookings = bookings.filter(b =>
    ["confirmed", "pending"].includes(b.status) && new Date(b.endDate) >= new Date()
  );
  const pastBookings = bookings.filter(b =>
    !["confirmed", "pending"].includes(b.status) ||
    new Date(b.endDate) < new Date()
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Bookings</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{session.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={base || "/"}>
            <Button variant="outline" size="sm">
              <Package className="w-3.5 h-3.5 mr-1.5" />
              Browse
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Sign out
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-2xl border bg-muted/30 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {error}
        </div>
      )}

      {!isLoading && !error && bookings.length === 0 && (
        <div className="rounded-2xl border bg-background p-12 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <Calendar className="w-7 h-7 text-muted-foreground/50" />
          </div>
          <div>
            <p className="font-semibold text-lg">No bookings yet</p>
            <p className="text-muted-foreground text-sm mt-1">
              When you book a rental it will appear here.
            </p>
          </div>
          <Link href={base || "/"}>
            <Button className="mt-2">
              Browse Rentals
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      )}

      {/* Upcoming / Active */}
      {!isLoading && upcomingBookings.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Upcoming &amp; Active
          </h2>
          {upcomingBookings.map(booking => (
            <BookingCard key={booking.id} booking={booking} base={base} showRebook={false} />
          ))}
        </section>
      )}

      {/* Divider */}
      {!isLoading && upcomingBookings.length > 0 && pastBookings.length > 0 && (
        <Separator />
      )}

      {/* Past */}
      {!isLoading && pastBookings.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Past &amp; Cancelled
          </h2>
          {pastBookings.map(booking => (
            <BookingCard key={booking.id} booking={booking} base={base} showRebook={true} />
          ))}
        </section>
      )}
    </div>
  );
}

function getRentalTimeChip(startDate: Date, endDate: Date, status: string) {
  const skip = ["cancelled", "completed", "no_show"];
  if (skip.includes(status)) return null;
  const today     = startOfDay(new Date());
  const start     = startOfDay(startDate);
  const end       = startOfDay(endDate);
  const daysToStart = differenceInDays(start, today);
  const daysToEnd   = differenceInDays(end,   today);
  const totalDays   = Math.max(1, differenceInDays(end, start));
  const elapsed     = Math.max(0, differenceInDays(today, start));
  const pct         = Math.min(100, Math.round((elapsed / totalDays) * 100));

  if (daysToStart > 1)    return { label: `Starts in ${daysToStart} days`, pct: null, color: "text-blue-700 bg-blue-50 border-blue-200", bar: "bg-blue-500" };
  if (daysToStart === 1)  return { label: "Starts tomorrow",                pct: null, color: "text-blue-700 bg-blue-50 border-blue-200", bar: "bg-blue-500" };
  if (daysToStart === 0)  return { label: "Pickup day!",                    pct: null, color: "text-green-700 bg-green-50 border-green-200", bar: "bg-green-500" };
  if (daysToEnd > 1)      return { label: `${daysToEnd} days remaining`,    pct, color: "text-green-700 bg-green-50 border-green-200", bar: "bg-green-500" };
  if (daysToEnd === 1)    return { label: "Returns tomorrow",               pct, color: "text-amber-700 bg-amber-50 border-amber-200", bar: "bg-amber-500" };
  if (daysToEnd === 0)    return { label: "Due back today",                 pct: 100, color: "text-amber-700 bg-amber-50 border-amber-200", bar: "bg-amber-500" };
  return { label: `Overdue ${Math.abs(daysToEnd)}d`, pct: 100, color: "text-red-700 bg-red-50 border-red-300", bar: "bg-red-500" };
}

function BookingCard({ booking, base, showRebook }: { booking: any; base: string; showRebook: boolean }) {
  const [, setLocation] = useLocation();
  const { label, color } = statusConfig(booking.status);
  const startDate = new Date(booking.startDate + "T00:00:00");
  const endDate = new Date(booking.endDate + "T00:00:00");
  const nights = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const timeChip = getRentalTimeChip(startDate, endDate, booking.status);

  const handleRebook = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLocation(`${base}/book?listingId=${booking.listingId}`);
  };

  return (
    <Link href={`${base}/my-bookings/${booking.id}`}>
      <div className="group rounded-2xl border bg-background hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusIcon status={booking.status} />
              <span className="font-semibold truncate">{booking.listingTitle ?? "Rental"}</span>
              <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${color}`}>
                {label}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {format(startDate, "MMM d")} – {format(endDate, "MMM d, yyyy")}
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span>{nights} day{nights > 1 ? "s" : ""}</span>
            </div>
            {timeChip && (
              <div className="mt-2 space-y-1">
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${timeChip.color}`}>
                  <Clock className="w-3 h-3" />
                  {timeChip.label}
                </span>
                {timeChip.pct !== null && timeChip.pct > 0 && (
                  <div className="h-1 w-full max-w-[180px] bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${timeChip.bar}`} style={{ width: `${timeChip.pct}%` }} />
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {showRebook && booking.listingId ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-8 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
                onClick={handleRebook}
              >
                <RotateCcw className="w-3 h-3" />
                Rebook
              </Button>
            ) : (
              <div className="text-right">
                <div className="font-bold">${Number(booking.totalPrice ?? 0).toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">#{booking.id}</div>
              </div>
            )}
            <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </div>
        </div>
        {showRebook && booking.listingId && (
          <div className="mt-3 pt-3 border-t flex items-center justify-between">
            <div className="text-right">
              <div className="font-semibold text-sm">${Number(booking.totalPrice ?? 0).toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">Booking #{booking.id}</div>
            </div>
            <p className="text-xs text-muted-foreground">Enjoyed it? Book the same gear again with fresh dates.</p>
          </div>
        )}
      </div>
    </Link>
  );
}
