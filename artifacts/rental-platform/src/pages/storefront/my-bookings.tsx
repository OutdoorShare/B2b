import { useState, useEffect } from "react";
import { useLocation, useParams, Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Calendar, ChevronRight, Package, Clock, CheckCircle2,
  XCircle, AlertCircle, User, LogOut, ArrowRight, RotateCcw,
  MessageSquarePlus, Star
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

      {/* Feedback */}
      {!isLoading && session && (
        <>
          <Separator />
          <RenterFeedbackForm session={session} slug={slug ?? ""} />
        </>
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

  const hasUpdate = (booking as any).seenByRenter === false;

  return (
    <Link href={`${base}/my-bookings/${booking.id}`}>
      <div className={`group rounded-2xl border hover:shadow-sm transition-all cursor-pointer p-5 ${hasUpdate ? "bg-blue-50/40 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800" : "bg-background hover:border-primary/40"}`}>
        {hasUpdate && (
          <div className="flex items-center gap-1.5 mb-2.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">New update on your booking</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusIcon status={booking.status} />
              <span className={`truncate ${hasUpdate ? "font-bold" : "font-semibold"}`}>{booking.listingTitle ?? "Rental"}</span>
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

function RenterFeedbackForm({ session, slug }: { session: { name: string; email: string }; slug: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!message.trim()) { setError("Please enter a message."); return; }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": slug },
        body: JSON.stringify({
          submitterType: "renter",
          submitterName: session.name,
          submitterEmail: session.email,
          subject: subject.trim() || undefined,
          message: message.trim(),
          rating: rating ?? undefined,
          tenantSlug: slug,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to submit."); return; }
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 p-6 text-center space-y-2">
        <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto" />
        <p className="font-semibold text-green-800 dark:text-green-300">Thanks for your feedback!</p>
        <p className="text-sm text-green-700 dark:text-green-400">We appreciate you taking the time to share your thoughts.</p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-dashed border-muted-foreground/25 p-5 text-center hover:border-primary/40 hover:bg-primary/5 transition-all group"
      >
        <MessageSquarePlus className="w-5 h-5 text-muted-foreground/50 group-hover:text-primary mx-auto mb-1.5 transition-colors" />
        <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Share feedback about your experience</p>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border bg-background shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <MessageSquarePlus className="w-4 h-4 text-primary" />
          Share Feedback
        </h3>
        <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
      </div>

      {/* Identity chip */}
      <div className="flex items-center gap-2 rounded-lg bg-muted/60 border px-2.5 py-2">
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="w-3 h-3 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium truncate">{session.name}</p>
          <p className="text-xs text-muted-foreground truncate">{session.email} · Renter</p>
        </div>
      </div>

      {/* Star rating */}
      <div className="space-y-1.5">
        <Label className="text-xs">Overall Experience <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map(i => (
            <button
              key={i}
              type="button"
              onClick={() => setRating(i === rating ? null : i)}
              onMouseEnter={() => setHoverRating(i)}
              onMouseLeave={() => setHoverRating(null)}
              className="p-0.5 transition-transform hover:scale-110"
            >
              <Star className={`w-6 h-6 transition-colors ${
                i <= (hoverRating ?? rating ?? 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
              }`} />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs" htmlFor="rf-subject">Subject <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <input
          id="rf-subject"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="e.g. Great experience, Suggestion…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs" htmlFor="rf-message">Message</Label>
        <Textarea
          id="rf-message"
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Tell us about your rental experience…"
          rows={3}
        />
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}

      <Button className="w-full h-10" onClick={handleSubmit} disabled={submitting}>
        {submitting ? "Sending…" : "Send Feedback"}
      </Button>
    </div>
  );
}
