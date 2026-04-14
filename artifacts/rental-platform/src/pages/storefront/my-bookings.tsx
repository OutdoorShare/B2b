import { useState, useMemo, useEffect, useRef, Fragment, useCallback } from "react";
import { fetchWithRetry, BookingFetchError } from "@/lib/booking-fetch";
import { useLocation, useParams } from "wouter";
import {
  User, LogOut, Calendar, CalendarDays, List, Settings,
  CreditCard, Lock, MapPin, CheckCircle2, AlertCircle,
  Loader2, ChevronLeft, ChevronRight, Search, X, ExternalLink,
  Mail, Phone, Trash2, RotateCcw, MessageSquarePlus, Star,
  TrendingUp, Package, ArrowRight, Sparkles, Clock, Zap,
  Camera, Images, Building2, ChevronDown as ChevronDownIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  format, startOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO,
  differenceInDays,
} from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API  = import.meta.env.VITE_API_URL ?? "";

function resolveImage(url: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API}/api/uploads/${url.split("/").pop()}`;
}

const STATUS_ACCENT: Record<string, string> = {
  pending:   "bg-amber-400",
  confirmed: "bg-blue-500",
  active:    "bg-emerald-500",
  completed: "bg-gray-400",
  cancelled: "bg-red-400",
};
const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-100  text-amber-900  border-amber-300",
  confirmed: "bg-blue-100   text-blue-900   border-blue-300",
  active:    "bg-emerald-100 text-emerald-900 border-emerald-300",
  completed: "bg-gray-100   text-gray-600   border-gray-300",
  cancelled: "bg-red-100    text-red-700    border-red-300",
};
const STATUS_BADGE: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  active:    "bg-emerald-100 text-emerald-800 border-emerald-200",
  completed: "bg-gray-100 text-gray-600 border-gray-200",
  cancelled: "bg-red-100 text-red-600 border-red-200",
};
const STATUS_DOT: Record<string, string> = {
  pending:   "bg-amber-400",
  confirmed: "bg-blue-500",
  active:    "bg-emerald-500",
  completed: "bg-gray-400",
  cancelled: "bg-red-400",
};

const BOOKING_STEPS = [
  { key: "pending",   label: "Requested" },
  { key: "confirmed", label: "Confirmed" },
  { key: "active",    label: "Active"    },
  { key: "completed", label: "Returned"  },
];
const STATUS_STEP_IDX: Record<string, number> = {
  pending:   0,
  confirmed: 1,
  active:    2,
  completed: 3,
};

function getRentalTimeStatus(startStr: string, endStr: string, status: string) {
  if (["cancelled","completed","no_show"].includes(status)) return null;
  const today = startOfDay(new Date());
  const start = startOfDay(new Date(startStr + "T00:00:00"));
  const end   = startOfDay(new Date(endStr   + "T00:00:00"));
  const daysToStart = differenceInDays(start, today);
  const daysToEnd   = differenceInDays(end,   today);
  const totalDays   = Math.max(1, differenceInDays(end, start));
  const elapsed     = Math.max(0, differenceInDays(today, start));
  const pct         = Math.min(100, Math.round((elapsed / totalDays) * 100));
  if (daysToStart > 1)   return { label: `Starts in ${daysToStart}d`,     color: "text-blue-700 bg-blue-50 border-blue-200",     pct: 0,   bar: "bg-blue-400",    urgent: false };
  if (daysToStart === 1) return { label: "Starts tomorrow",                color: "text-blue-700 bg-blue-50 border-blue-200",     pct: 0,   bar: "bg-blue-400",    urgent: false };
  if (daysToStart === 0) return { label: "Pickup day!",                    color: "text-emerald-700 bg-emerald-50 border-emerald-200", pct: 0, bar: "bg-emerald-500", urgent: true  };
  if (daysToEnd > 1)     return { label: `${daysToEnd}d remaining`,        color: "text-emerald-700 bg-emerald-50 border-emerald-200", pct,  bar: "bg-emerald-500", urgent: false };
  if (daysToEnd === 1)   return { label: "Returns tomorrow",               color: "text-amber-700 bg-amber-50 border-amber-200",   pct,  bar: "bg-amber-400",   urgent: true  };
  if (daysToEnd === 0)   return { label: "Due back today",                 color: "text-amber-700 bg-amber-50 border-amber-200",   pct: 100, bar: "bg-amber-400", urgent: true  };
  return                         { label: `Overdue ${Math.abs(daysToEnd)}d`, color: "text-red-700 bg-red-50 border-red-300",      pct: 100, bar: "bg-red-400",   urgent: true  };
}

type RenterBooking = {
  id: number;
  status: string;
  startDate: string;
  endDate: string;
  totalPrice: string;
  listingId: number;
  listingTitle: string;
  listingImage: string | null;
  tenantSlug: string | null;
  businessName: string | null;
  businessLogoUrl: string | null;
  businessPrimaryColor: string | null;
  createdAt: string;
  seenByRenter?: boolean | null;
  lastAdminReminderSentAt?: string | null;
  pickupPhotos?: string[];
  returnPhotos?: string[];
  paymentPlanEnabled?: boolean | null;
  splitRemainingAmount?: string | null;
  splitRemainingStatus?: string | null;
  splitRemainingDueDate?: string | null;
};

type CustomerProfile = {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  billingAddress: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingZip: string | null;
  cardLastFour: string | null;
  cardBrand: string | null;
  avatarUrl: string | null;
  identityVerificationStatus: string | null;
  createdAt: string;
};

type Session = { id: number; email: string; name: string; phone?: string };
type Tab = "bookings" | "memories" | "profile" | "settings";

function loadSession(): Session | null {
  try { return JSON.parse(localStorage.getItem("rental_customer") ?? "null"); }
  catch { return null; }
}
function saveSession(s: Session) {
  localStorage.setItem("rental_customer", JSON.stringify(s));
}

export default function MyBookings() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const base = slug ? `/${slug}` : "";

  const [session, setSession]     = useState<Session | null>(null);
  const [profile, setProfile]     = useState<CustomerProfile | null>(null);
  const [bookings, setBookings]   = useState<RenterBooking[]>([]);
  const [bookingsLoading, setBL]  = useState(true);
  const [profileLoading, setPL]   = useState(true);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [bookingsRetry, setBookingsRetry] = useState(0);

  const [tab, setTab] = useState<Tab>(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("tab") === "profile")  return "profile";
    if (p.get("tab") === "settings") return "settings";
    return "bookings";
  });

  useEffect(() => {
    const s = loadSession();
    if (!s) { setLocation(`${base}/login?redirect=${encodeURIComponent(`${base}/my-bookings`)}`); return; }
    setSession(s);
    setBookingsError(null);
    setBL(true);

    // Profile load — non-critical, silently fails without blocking the page
    fetchWithRetry(`${API}/api/customers/${s.id}`, undefined, 2)
      .then(r => r.json())
      .then((d: CustomerProfile) => { setProfile(d); setPL(false); })
      .catch(() => setPL(false));

    // Bookings list — critical, retry up to 3 times for transient errors
    fetchWithRetry(`${API}/api/marketplace/renter/bookings?customerId=${s.id}`, undefined, 3)
      .then(r => r.json())
      .then((d: RenterBooking[]) => {
        if (Array.isArray(d)) setBookings(d);
        setBookingsError(null);
        setBL(false);
      })
      .catch((err: unknown) => {
        const msg = err instanceof BookingFetchError
          ? err.code === "ACCESS_DENIED"
            ? "Your session may have expired. Please sign in again."
            : "Unable to load your bookings right now — please try again."
          : "Unable to load your bookings right now — please try again.";
        setBookingsError(msg);
        setBL(false);
      });
  }, [bookingsRetry]);

  const handleLogout = () => {
    localStorage.removeItem("rental_customer");
    setLocation(`${base}/login`);
  };

  if (!session) return null;

  const initials = session.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "";
  const totalSpent = bookings.reduce((sum, b) => sum + parseFloat(b.totalPrice || "0"), 0);
  const activeBooking = bookings.find(b => b.status === "active");
  const upcomingCount = bookings.filter(b =>
    b.status !== "cancelled" && startOfDay(parseISO(b.startDate)) >= startOfDay(new Date())
  ).length;
  const unpaidBookings = bookings.filter(b =>
    b.paymentPlanEnabled &&
    b.splitRemainingStatus !== "charged" &&
    b.splitRemainingStatus !== "waived" &&
    b.status !== "cancelled"
  );

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg,#f0f4f0 0%,#f5f7fa 100%)" }}>
      {/* ── Hero ── */}
      <div className="relative bg-gradient-to-br from-[#0f1f12] via-[#1a3320] to-[#0d2116] text-white overflow-hidden">
        {/* Dot-grid overlay */}
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "24px 24px" }} />
        {/* Glow orbs */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/25 blur-3xl pointer-events-none" />
        <div className="absolute top-10 -left-16 w-48 h-48 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-6">
          {/* Top row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="relative">
                <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-emerald-700 flex items-center justify-center text-white font-black text-2xl shadow-xl ring-2 ring-white/10`}>
                  {initials || <User className="w-8 h-8" />}
                </div>
                {activeBooking && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-400 border-2 border-[#1a3320] shadow animate-pulse" title="Active rental" />
                )}
              </div>
              <div>
                <h1 className="text-xl font-black leading-tight tracking-tight">{session.name}</h1>
                <p className="text-white/50 text-sm mt-0.5 font-medium">{session.email}</p>
                {upcomingCount > 0 && (
                  <p className="text-emerald-300 text-xs mt-1 flex items-center gap-1 font-semibold">
                    <Sparkles className="h-3 w-3" />
                    {upcomingCount} upcoming rental{upcomingCount !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-white/40 hover:text-white/80 text-sm transition-colors px-3 py-2 rounded-xl hover:bg-white/5"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Sign out</span>
            </button>
          </div>

          {/* Stats strip */}
          {!bookingsLoading && bookings.length > 0 && (
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {[
                { label: "Rentals",  value: String(bookings.length),  icon: Package,    color: "text-primary" },
                { label: "Upcoming", value: String(upcomingCount),     icon: Calendar,   color: "text-sky-300" },
                { label: "Spent",    value: `$${totalSpent < 1000 ? totalSpent.toFixed(0) : (totalSpent / 1000).toFixed(1) + "k"}`, icon: TrendingUp, color: "text-amber-300" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-3 py-3 flex items-center gap-3 overflow-hidden">
                  <div className={`${color} shrink-0`}><Icon className="h-4 w-4" /></div>
                  <div>
                    <p className="text-xl font-black leading-none">{value}</p>
                    <p className="text-white/45 text-[11px] mt-0.5 font-medium">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active rental banner */}
          {activeBooking && (
            <button
              onClick={() => {
                const b = activeBooking.tenantSlug ? `/${activeBooking.tenantSlug}` : base;
                setLocation(`${b}/my-bookings/${activeBooking.id}`);
              }}
              className="mt-4 w-full group bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-2xl px-4 py-3 flex items-center gap-3 transition-all text-left"
            >
              <div className="h-9 w-9 rounded-xl bg-emerald-400/20 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-400/30 transition-colors">
                <Zap className="h-4 w-4 text-emerald-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Active Rental</p>
                <p className="text-white font-bold text-sm line-clamp-1 mt-0.5">{activeBooking.listingTitle}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-white/70 group-hover:translate-x-1 transition-all flex-shrink-0" />
            </button>
          )}

          {/* Outstanding balance banner — shown for every unpaid split-payment booking */}
          {unpaidBookings.length > 0 && (
            <div className="mt-4 rounded-2xl border border-red-400/50 bg-red-500/20 overflow-hidden">
              <div className="px-4 py-2.5 bg-red-500/30 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-300 shrink-0 animate-pulse" />
                <p className="text-[11px] font-black uppercase tracking-widest text-red-200">
                  {unpaidBookings.length === 1 ? "Balance Due" : `${unpaidBookings.length} Balances Due`}
                </p>
              </div>
              <div className="divide-y divide-red-400/20">
                {unpaidBookings.map(b => {
                  const slug = b.tenantSlug ? `/${b.tenantSlug}` : base;
                  const amt = parseFloat(String(b.splitRemainingAmount ?? "0"));
                  const isFailed = b.splitRemainingStatus === "failed";
                  return (
                    <button
                      key={b.id}
                      onClick={() => setLocation(`${slug}/my-bookings/${b.id}`)}
                      className="w-full group px-4 py-3 flex items-center gap-3 hover:bg-red-500/10 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm line-clamp-1">{b.listingTitle}</p>
                        <p className="text-red-300 text-xs mt-0.5 font-medium">
                          {isFailed ? "Payment failed — action required" : b.splitRemainingDueDate ? `Due ${b.splitRemainingDueDate}` : "Payment pending"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-white font-black text-base">${amt.toFixed(2)}</p>
                        <p className="text-red-300 text-[10px] font-semibold uppercase">owed</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-red-300/50 group-hover:text-red-200 group-hover:translate-x-1 transition-all shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex border-b border-white/10">
            {([
              { key: "bookings"  as Tab, label: "Bookings",  icon: Calendar },
              { key: "memories"  as Tab, label: "Memories",  icon: Camera   },
              { key: "profile"   as Tab, label: "Profile",   icon: User     },
              { key: "settings"  as Tab, label: "Settings",  icon: Settings },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`relative flex items-center gap-1.5 px-4 py-3.5 text-sm font-bold transition-all ${
                  tab === key ? "text-white" : "text-white/35 hover:text-white/65"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {tab === key && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-emerald-400 rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {tab === "profile" && (
          <ProfileTab
            session={session}
            profile={profile}
            bookingCount={bookings.length}
            totalSpent={totalSpent}
            upcomingCount={upcomingCount}
            onEditSettings={() => setTab("settings")}
          />
        )}

        {tab === "bookings" && (
          bookingsError ? (
            <div className="rounded-2xl border bg-background p-8 text-center space-y-4">
              <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto" />
              <div>
                <p className="font-semibold text-foreground text-sm">Unable to load bookings</p>
                <p className="text-xs text-muted-foreground mt-1">{bookingsError}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBookingsRetry(c => c + 1)}
              >
                Try again
              </Button>
            </div>
          ) : (
            <BookingsTab
              bookings={bookings}
              isLoading={bookingsLoading}
              slug={slug ?? ""}
              base={base}
              onBrowse={() => setLocation(base || "/")}
            />
          )
        )}

        {tab === "memories" && (
          <MemoriesTab bookings={bookings} isLoading={bookingsLoading} />
        )}

        {tab === "settings" && profile && (
          <SettingsTab
            profile={profile}
            onProfileUpdated={(updated) => {
              setProfile(updated);
              const newSession = { ...session, name: updated.name, phone: updated.phone ?? undefined };
              saveSession(newSession);
              setSession(newSession);
            }}
          />
        )}
        {tab === "settings" && !profile && profileLoading && (
          <div className="text-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        )}
      </div>
    </div>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────────────────────

function ProfileTab({
  session, profile, bookingCount, totalSpent, upcomingCount, onEditSettings,
}: {
  session: Session;
  profile: CustomerProfile | null;
  bookingCount: number;
  totalSpent: number;
  upcomingCount: number;
  onEditSettings: () => void;
}) {
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  return (
    <div className="space-y-4">
      {/* Identity card */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="h-16 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <div className="px-6 pb-6 -mt-8">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center text-white font-bold text-2xl shadow-md ring-4 ring-white">
            {session.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || <User className="w-7 h-7" />}
          </div>
          <div className="mt-3">
            <h2 className="text-xl font-bold text-gray-900">{session.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{session.email}</p>
            {session.phone && <p className="text-sm text-gray-400 mt-0.5">{session.phone}</p>}
            {memberSince && (
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Member since {memberSince}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={onEditSettings} className="mt-4 gap-2">
            <Settings className="h-3.5 w-3.5" /> Edit Profile &amp; Settings
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{bookingCount}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Rentals Booked</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center mx-auto mb-2">
            <Calendar className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{upcomingCount}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Upcoming</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center mx-auto mb-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">${totalSpent < 1000 ? totalSpent.toFixed(0) : (totalSpent / 1000).toFixed(1) + "k"}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Total Spent</p>
        </div>
      </div>

      {/* Billing summary */}
      {profile && (profile.cardLastFour || profile.billingAddress) && (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {profile.cardLastFour && (
            <div className="flex items-center gap-3 px-5 py-3.5">
              <div className="h-9 w-14 rounded-lg bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center flex-shrink-0">
                <CreditCard className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {profile.cardBrand ? profile.cardBrand.charAt(0).toUpperCase() + profile.cardBrand.slice(1) : "Card"} •••• {profile.cardLastFour}
                </p>
                <p className="text-xs text-gray-400">Saved payment method</p>
              </div>
            </div>
          )}
          {profile.billingAddress && (
            <div className="flex items-center gap-3 px-5 py-3.5">
              <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-4 w-4 text-gray-500" />
              </div>
              <p className="text-sm text-gray-600">
                {profile.billingAddress}{profile.billingCity ? `, ${profile.billingCity}` : ""}{profile.billingState ? ` ${profile.billingState}` : ""}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Bookings Tab ─────────────────────────────────────────────────────────────

type BookingTabKey = "recent" | "upcoming" | "cancelled" | "all";
const BOOKING_TABS: { key: BookingTabKey; label: string }[] = [
  { key: "recent",    label: "Recent"    },
  { key: "upcoming",  label: "Upcoming"  },
  { key: "cancelled", label: "Cancelled" },
  { key: "all",       label: "All"       },
];
type ViewMode = "list" | "calendar";

function BookingsTab({
  bookings: allBookings, isLoading, slug, base, onBrowse,
}: {
  bookings: RenterBooking[];
  isLoading: boolean;
  slug: string;
  base: string;
  onBrowse: () => void;
}) {
  const [view, setView]              = useState<ViewMode>("list");
  const [activeTab, setActiveTab]    = useState<BookingTabKey>("recent");
  const [search, setSearch]          = useState("");
  const [calendarMonth, setCalMonth] = useState(new Date());
  const [expandedId, setExpandedId]  = useState<number | null>(null);
  const [, setLocation]              = useLocation();

  const today = startOfDay(new Date());

  const tabCounts = useMemo(() => ({
    recent:    allBookings.filter(b => b.status !== "cancelled").length,
    upcoming:  allBookings.filter(b => b.status !== "cancelled" && startOfDay(parseISO(b.startDate)) >= today).length,
    cancelled: allBookings.filter(b => b.status === "cancelled").length,
    all:       allBookings.length,
  }), [allBookings]);

  const tabFiltered = useMemo(() => {
    const all = [...allBookings];
    switch (activeTab) {
      case "upcoming":
        return all.filter(b => b.status !== "cancelled" && startOfDay(parseISO(b.startDate)) >= today)
                  .sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());
      case "cancelled":
        return all.filter(b => b.status === "cancelled")
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case "all":
        return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      default:
        return all.filter(b => b.status !== "cancelled")
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }, [allBookings, activeTab]);

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tabFiltered;
    return tabFiltered.filter(b =>
      (b.listingTitle ?? "").toLowerCase().includes(q) ||
      (b.businessName ?? "").toLowerCase().includes(q) ||
      (b.status ?? "").toLowerCase().includes(q) ||
      String(b.id).includes(q) ||
      (b.startDate ?? "").includes(q) ||
      (b.endDate ?? "").includes(q)
    );
  }, [tabFiltered, search]);

  // Group bookings by month for visual breaks
  const grouped = useMemo(() => {
    if (search) return [{ label: null, items: displayed }];
    if (activeTab === "upcoming") {
      // Group upcoming by: This month, Next month, Later
      const groups: { label: string; items: RenterBooking[] }[] = [];
      const now = new Date();
      const thisMonthStart = startOfMonth(now);
      const nextMonthStart = startOfMonth(addMonths(now, 1));
      const nextMonthEnd   = endOfMonth(nextMonthStart);

      const thisMonth = displayed.filter(b => {
        const s = parseISO(b.startDate);
        return s >= thisMonthStart && s < nextMonthStart;
      });
      const nextMonth = displayed.filter(b => {
        const s = parseISO(b.startDate);
        return s >= nextMonthStart && s <= nextMonthEnd;
      });
      const later = displayed.filter(b => parseISO(b.startDate) > nextMonthEnd);

      if (thisMonth.length) groups.push({ label: "This Month", items: thisMonth });
      if (nextMonth.length) groups.push({ label: "Next Month", items: nextMonth });
      if (later.length)     groups.push({ label: "Coming Up", items: later });
      return groups.length ? groups : [{ label: null, items: displayed }];
    }
    // For recent/all/cancelled: group by month
    const byMonth = new Map<string, RenterBooking[]>();
    for (const b of displayed) {
      try {
        const key = format(parseISO(b.createdAt ?? b.startDate), "MMMM yyyy");
        if (!byMonth.has(key)) byMonth.set(key, []);
        byMonth.get(key)!.push(b);
      } catch { /* skip */ }
    }
    const groups = Array.from(byMonth.entries()).map(([label, items]) => ({ label, items }));
    return groups.length <= 1 ? [{ label: null, items: displayed }] : groups;
  }, [displayed, activeTab, search]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarMonth));
    const end   = endOfWeek(endOfMonth(calendarMonth));
    const days: Date[] = [];
    let cur = start;
    while (cur <= end) { days.push(cur); cur = addDays(cur, 1); }
    return days;
  }, [calendarMonth]);

  const calendarWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) weeks.push(calendarDays.slice(i, i + 7));
    return weeks;
  }, [calendarDays]);

  type Bar = { booking: RenterBooking; startCol: number; endCol: number; isStart: boolean; isEnd: boolean };
  type Lane = Bar[];

  function computeLanes(week: Date[]): Lane[] {
    const weekStart = startOfDay(week[0]);
    const weekEnd   = startOfDay(week[6]);
    const weekBookings = allBookings
      .filter(b => b.status !== "cancelled")
      .filter(b => {
        try {
          const s = startOfDay(parseISO(b.startDate));
          const e = startOfDay(parseISO(b.endDate));
          return s <= weekEnd && e >= weekStart;
        } catch { return false; }
      })
      .sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());
    const lanes: Lane[] = [];
    for (const b of weekBookings) {
      const bStart   = startOfDay(parseISO(b.startDate));
      const bEnd     = startOfDay(parseISO(b.endDate));
      const startCol = Math.max(0, differenceInDays(bStart, weekStart)) + 1;
      const endCol   = Math.min(6, differenceInDays(bEnd,   weekStart)) + 2;
      const isStart  = bStart >= weekStart;
      const isEnd    = bEnd   <= weekEnd;
      const entry: Bar = { booking: b, startCol, endCol, isStart, isEnd };
      let placed = false;
      for (const lane of lanes) {
        const last = lane[lane.length - 1];
        if (last.endCol <= startCol) { lane.push(entry); placed = true; break; }
      }
      if (!placed) lanes.push([entry]);
    }
    return lanes;
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-3xl border border-gray-100 overflow-hidden animate-pulse shadow-sm">
            <div className="h-1 bg-gray-200" />
            <div className="p-4 flex gap-3.5">
              <div className="h-28 w-28 bg-gray-200 rounded-2xl flex-shrink-0" />
              <div className="flex-1 space-y-2.5 pt-1">
                <div className="h-4 bg-gray-200 rounded-full w-3/5" />
                <div className="h-3 bg-gray-200 rounded-full w-2/5" />
                <div className="h-3 bg-gray-200 rounded-full w-1/3" />
                <div className="h-3 bg-gray-200 rounded-full w-1/4" />
              </div>
            </div>
            <div className="mx-4 pb-4 pt-3 border-t border-gray-100">
              <div className="h-3 bg-gray-200 rounded-full w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (allBookings.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Package className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-semibold text-gray-700 mb-1.5">No bookings yet</h3>
        <p className="text-sm text-gray-400 mb-5 max-w-xs mx-auto">When you book your first rental, it'll show up right here.</p>
        <Button onClick={onBrowse} className="bg-primary hover:bg-primary/90 text-white gap-2">
          Browse Rentals <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View toggle + filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Filter pills */}
        <div className="flex items-center gap-1 flex-wrap flex-1">
          {BOOKING_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === t.key
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === t.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                {tabCounts[t.key]}
              </span>
            </button>
          ))}
        </div>
        {/* View mode toggle */}
        <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm flex-shrink-0">
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${view === "list" ? "bg-primary text-white" : "text-gray-400 hover:text-gray-700"}`}
          >
            <List className="w-3.5 h-3.5" /> List
          </button>
          <button
            onClick={() => setView("calendar")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${view === "calendar" ? "bg-primary text-white" : "text-gray-400 hover:text-gray-700"}`}
          >
            <CalendarDays className="w-3.5 h-3.5" /> Cal
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by listing, company, or status…"
          className="w-full h-10 pl-9 pr-9 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* LIST VIEW */}
      {view === "list" && (
        <div className="space-y-5">
          {displayed.length === 0 ? (
            <div className="py-14 text-center bg-white rounded-2xl border border-gray-200">
              <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">{search ? "No bookings match your search" : "No bookings in this view"}</p>
              {search && <button onClick={() => setSearch("")} className="mt-2 text-xs text-primary underline">Clear search</button>}
            </div>
          ) : (
            grouped.map(({ label, items }) => (
              <div key={label ?? "all"}>
                {label && (
                  <div className="flex items-center gap-3 mb-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{label}</p>
                    <div className="flex-1 h-px bg-gray-200" />
                    <p className="text-[11px] text-gray-400 whitespace-nowrap">{items.length} booking{items.length !== 1 ? "s" : ""}</p>
                  </div>
                )}
                <div className="space-y-3">
                  {items.map(booking => <BookingCard key={booking.id} booking={booking} base={base} />)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* CALENDAR VIEW */}
      {view === "calendar" && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <button onClick={() => setCalMonth(m => subMonths(m, 1))} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-gray-800">{format(calendarMonth, "MMMM yyyy")}</h3>
            <button onClick={() => setCalMonth(m => addMonths(m, 1))} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 border-b bg-gray-50">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">{d}</div>
            ))}
          </div>
          <div className="divide-y divide-gray-100">
            {calendarWeeks.map((week, wi) => {
              const lanes = computeLanes(week);
              return (
                <div key={wi}>
                  <div className="grid grid-cols-7 divide-x divide-gray-100 border-b border-gray-100">
                    {week.map((day, di) => {
                      const isToday  = isSameDay(day, new Date());
                      const inMonth  = isSameMonth(day, calendarMonth);
                      return (
                        <div key={di} className={`py-1.5 px-2 flex items-center justify-end ${inMonth ? "" : "bg-gray-50/60"}`}>
                          <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${isToday ? "bg-primary text-white" : inMonth ? "text-gray-700" : "text-gray-300"}`}>
                            {format(day, "d")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className={`pb-1.5 pt-1 ${isSameMonth(week[3], calendarMonth) ? "" : "bg-gray-50/40"}`} style={{ minHeight: `${Math.max(32, lanes.length * 24 + 8)}px` }}>
                    {lanes.length === 0 && <div className="h-5" />}
                    {lanes.map((lane, li) => (
                      <div key={li} className="relative grid mb-0.5" style={{ gridTemplateColumns: "repeat(7, 1fr)", height: "22px" }}>
                        {lane.map(({ booking: b, startCol, endCol, isStart, isEnd }) => {
                          const colorCls = STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-700 border-gray-200";
                          const roundL = isStart ? "rounded-l-full pl-2" : "rounded-l-none pl-1";
                          const roundR = isEnd   ? "rounded-r-full pr-2" : "rounded-r-none pr-1";
                          return (
                            <button
                              key={b.id}
                              onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}
                              title={`${b.listingTitle} — ${b.startDate} → ${b.endDate}`}
                              style={{ gridColumn: `${startCol} / ${endCol}` }}
                              className={`h-full flex items-center gap-1 text-[11px] font-semibold border truncate transition-opacity hover:opacity-80 ${colorCls} ${roundL} ${roundR} ${!isStart ? "border-l-0" : ""} ${!isEnd ? "border-r-0" : ""}`}
                            >
                              {isStart && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[b.status] ?? "bg-gray-400"}`} />}
                              <span className="truncate min-w-0">{isStart ? b.listingTitle : ""}</span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  {lanes.some(lane => lane.some(bar => bar.booking.id === expandedId)) && (() => {
                    const b = allBookings.find(x => x.id === expandedId)!;
                    const ts = getRentalTimeStatus(b.startDate, b.endDate, b.status);
                    const badgeCls = STATUS_BADGE[b.status] ?? "bg-gray-100 text-gray-700 border-gray-200";
                    const bookingBase = b.tenantSlug ? `/${b.tenantSlug}` : base;
                    return (
                      <div className="mx-4 mb-3 p-3 border border-gray-200 rounded-xl bg-white shadow-sm text-sm">
                        <div className="flex items-start gap-3">
                          <div className="h-14 w-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                            {b.listingImage
                              ? <img src={resolveImage(b.listingImage)} alt={b.listingTitle} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-xl">🏕️</div>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <p className="font-semibold text-gray-800 text-sm line-clamp-1">{b.listingTitle}</p>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${badgeCls}`}>{b.status}</span>
                            </div>
                            {b.businessName && <p className="text-xs text-gray-500 mt-0.5">{b.businessName}</p>}
                            <p className="text-xs text-gray-400 mt-0.5">{format(parseISO(b.startDate), "MMM d")} – {format(parseISO(b.endDate), "MMM d, yyyy")}</p>
                            {ts && <span className={`mt-1 inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border ${ts.color}`}>{ts.label}</span>}
                            <div className="flex items-center justify-between mt-1.5">
                              <span className="font-semibold text-gray-800">${parseFloat(b.totalPrice || "0").toFixed(2)}</span>
                              <div className="flex items-center gap-2">
                                <button className="text-xs text-primary hover:underline font-medium" onClick={() => setLocation(`${bookingBase}/my-bookings/${b.id}`)}>
                                  View booking
                                </button>
                                <button onClick={() => setExpandedId(null)} className="text-gray-400 hover:text-gray-600"><X className="h-3.5 w-3.5" /></button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 px-5 py-3 border-t bg-gray-50 flex-wrap">
            {Object.entries(STATUS_COLORS).map(([status, cls]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-sm border ${cls}`} />
                <span className="text-xs text-gray-500 capitalize">{status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <RenterFeedbackForm slug={base.replace(/^\//, "")} />
    </div>
  );
}

// ─── Booking Card ─────────────────────────────────────────────────────────────

function BookingCard({ booking: b, base }: { booking: RenterBooking; base: string }) {
  const [, setLocation] = useLocation();
  const [reminding,    setReminding]    = useState(false);
  const [reminderSent, setReminderSent] = useState(false);
  const [reminderErr,  setReminderErr]  = useState<string | null>(null);

  const ts = getRentalTimeStatus(b.startDate, b.endDate, b.status);
  const badgeCls  = STATUS_BADGE[b.status]  ?? "bg-gray-100 text-gray-700 border-gray-200";
  const accentCls = STATUS_ACCENT[b.status] ?? "bg-gray-400";
  const bookingBase = b.tenantSlug ? `/${b.tenantSlug}` : base;
  const hasUpdate = b.seenByRenter === false;
  const nights = differenceInDays(parseISO(b.endDate), parseISO(b.startDate));

  // Show the "remind" button if: pending AND booking is > 3 hours old
  const THREE_HOURS = 3 * 60 * 60 * 1000;
  const bookingAgeMs = Date.now() - new Date(b.createdAt).getTime();
  const canRemind = b.status === "pending" && bookingAgeMs >= THREE_HOURS;

  // Check if a reminder was sent recently (< 3 hours ago) — prevents re-nudging
  const lastReminderAgeMs = b.lastAdminReminderSentAt
    ? Date.now() - new Date(b.lastAdminReminderSentAt).getTime()
    : null;
  const reminderOnCooldown = lastReminderAgeMs !== null && lastReminderAgeMs < THREE_HOURS;

  const session = loadSession();

  const handleRemind = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (reminding || reminderSent || reminderOnCooldown) return;
    setReminding(true);
    setReminderErr(null);
    try {
      const res = await fetch(`${API}/api/bookings/${b.id}/remind-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerEmail: session?.email ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReminderErr(data.error ?? "Could not send reminder.");
        setTimeout(() => setReminderErr(null), 5000);
      } else {
        setReminderSent(true);
        setTimeout(() => setReminderSent(false), 8000);
      }
    } catch {
      setReminderErr("Network error. Please try again.");
      setTimeout(() => setReminderErr(null), 5000);
    } finally {
      setReminding(false);
    }
  };

  const stepIdx = STATUS_STEP_IDX[b.status] ?? 0;

  return (
    <div
      className={`group bg-white rounded-3xl overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border ${hasUpdate ? "border-blue-300 shadow-blue-100 shadow-sm" : "border-gray-100 shadow-sm"}`}
      onClick={() => setLocation(`${bookingBase}/my-bookings/${b.id}`)}
    >
      {/* Top accent bar */}
      <div className={`h-1 ${accentCls}`} />

      <div className="p-4">
        <div className="flex gap-3.5">
          {/* Listing image */}
          <div className="h-28 w-28 flex-shrink-0 rounded-2xl overflow-hidden bg-gray-100 shadow-sm relative">
            {b.listingImage ? (
              <img src={resolveImage(b.listingImage)} alt={b.listingTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                <span className="text-3xl">🏕️</span>
              </div>
            )}
            {hasUpdate && (
              <span className="absolute top-1.5 left-1.5 h-2 w-2 rounded-full bg-blue-500 border border-white animate-pulse" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            {hasUpdate && (
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> New update
              </p>
            )}

            {/* Title + status */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-black text-gray-900 text-sm leading-snug line-clamp-2">{b.listingTitle}</h3>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border capitalize flex-shrink-0 ${badgeCls}`}>
                {b.status}
              </span>
            </div>

            {/* Company */}
            {b.businessName && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                {b.businessLogoUrl
                  ? <img src={resolveImage(b.businessLogoUrl)} alt="" className="h-3.5 w-3.5 rounded-full object-cover ring-1 ring-gray-200" />
                  : <Building2 className="h-3 w-3" />
                }
                <span>{b.businessName}</span>
              </div>
            )}

            {/* Dates */}
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>{format(parseISO(b.startDate), "MMM d")} – {format(parseISO(b.endDate), "MMM d, yyyy")}</span>
              {nights > 0 && <span className="text-[11px] text-gray-300 font-medium">· {nights}d</span>}
            </div>

            {/* Time status chip + progress bar */}
            {ts && (
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${ts.color} ${ts.urgent ? "animate-pulse" : ""}`}>
                  {ts.urgent && <Clock className="h-2.5 w-2.5 mr-1" />}
                  {ts.label}
                </span>
                {ts.pct > 0 && (
                  <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden min-w-[40px] max-w-[80px]">
                    <div className={`h-full rounded-full transition-all ${ts.bar}`} style={{ width: `${ts.pct}%` }} />
                  </div>
                )}
              </div>
            )}

            {/* Price + actions */}
            <div className="flex items-center justify-between mt-auto pt-0.5">
              <span className="text-base font-black text-gray-900">
                ${parseFloat(b.totalPrice || "0").toFixed(2)}
              </span>
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                {(b.status === "cancelled" || b.status === "completed") && (
                  <button
                    className="text-[11px] text-primary hover:text-primary/80 font-bold flex items-center gap-1 border border-primary/20 rounded-full px-2.5 py-0.5 hover:bg-primary/5 transition-colors"
                    onClick={() => setLocation(`${bookingBase}/book?listingId=${b.listingId}`)}
                  >
                    <RotateCcw className="h-2.5 w-2.5" /> Book Again
                  </button>
                )}
                <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Progress stepper ── */}
        {b.status !== "cancelled" ? (
          <div className="mt-4 pt-3.5 border-t border-gray-100">
            <div className="flex items-start">
              {BOOKING_STEPS.map((step, i) => (
                <Fragment key={step.key}>
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] transition-all ${
                      i < stepIdx
                        ? "bg-primary text-white"
                        : i === stepIdx
                        ? "bg-primary text-white ring-4 ring-primary/20"
                        : "bg-gray-100 text-gray-300"
                    }`}>
                      {i < stepIdx
                        ? <CheckCircle2 className="h-3.5 w-3.5" />
                        : i === stepIdx
                        ? <span className="block w-2 h-2 rounded-full bg-white" />
                        : <span>{i + 1}</span>
                      }
                    </div>
                    <span className={`text-[9px] font-bold whitespace-nowrap leading-none ${
                      i === stepIdx ? "text-primary" : i < stepIdx ? "text-gray-500" : "text-gray-300"
                    }`}>{step.label}</span>
                  </div>
                  {i < BOOKING_STEPS.length - 1 && (
                    <div className="flex-1 flex items-center mt-3 mx-1">
                      <div className="w-full h-0.5 rounded-full overflow-hidden bg-gray-100">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${i < stepIdx ? "bg-primary w-full" : "w-0"}`}
                        />
                      </div>
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-3 pt-3 border-t border-red-100 flex items-center gap-2">
            <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <X className="h-3 w-3 text-red-500" />
            </div>
            <span className="text-xs text-red-400 font-bold">Booking cancelled</span>
            <div className="flex-1 h-px bg-red-100" />
          </div>
        )}

        {/* Pending reminder notice */}
        {canRemind && (
          <div className="mt-2" onClick={e => e.stopPropagation()}>
            {reminderOnCooldown ? (
              <p className="text-[11px] text-amber-600 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="h-3 w-3" /> Reminder sent — available again in ~3 hrs
              </p>
            ) : reminderSent ? (
              <p className="text-[11px] text-emerald-600 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="h-3 w-3" /> Reminder sent to the company!
              </p>
            ) : (
              <button
                onClick={handleRemind}
                disabled={reminding}
                className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                {reminding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
                Remind company to review
              </button>
            )}
            {reminderErr && <p className="text-[11px] text-red-500 mt-1">{reminderErr}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Memories Tab ─────────────────────────────────────────────────────────────

function MemoriesTab({ bookings, isLoading }: { bookings: RenterBooking[]; isLoading: boolean }) {
  const [lightbox, setLightbox] = useState<{ photos: string[]; idx: number } | null>(null);

  const memories = bookings.filter(b => b.status === "completed");
  const withPhotos = memories.filter(b => (b.pickupPhotos?.length ?? 0) + (b.returnPhotos?.length ?? 0) > 0);
  const withoutPhotos = memories.filter(b => (b.pickupPhotos?.length ?? 0) + (b.returnPhotos?.length ?? 0) === 0);

  const closeLightbox = () => setLightbox(null);
  const advanceLightbox = (dir: 1 | -1) => {
    if (!lightbox) return;
    const next = (lightbox.idx + dir + lightbox.photos.length) % lightbox.photos.length;
    setLightbox({ ...lightbox, idx: next });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (memories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <Camera className="w-9 h-9 text-primary/50" />
        </div>
        <div>
          <p className="font-bold text-lg text-foreground">No memories yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Your adventure photos will appear here after your first completed rental.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md">
          <Camera className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-black text-xl">Your Adventures</h2>
          <p className="text-muted-foreground text-sm">{memories.length} adventure{memories.length !== 1 ? "s" : ""} completed</p>
        </div>
      </div>

      {/* Photo memory cards */}
      {withPhotos.map(b => {
        const allPhotos = [...(b.pickupPhotos ?? []), ...(b.returnPhotos ?? [])].map(resolveImage).filter(Boolean);
        const nights = differenceInDays(parseISO(b.endDate), parseISO(b.startDate));
        const accent = b.businessPrimaryColor ?? "hsl(127,55%,38%)";

        return (
          <div key={b.id} className="rounded-3xl overflow-hidden border border-gray-100 shadow-md bg-white">
            {/* Card header gradient */}
            <div
              className="relative p-4 pb-3 text-white"
              style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)` }}
            >
              <div className="absolute top-0 right-0 w-28 h-28 rounded-full bg-white/10 -translate-y-10 translate-x-10" />
              <div className="flex items-start gap-3 relative z-10">
                {b.listingImage ? (
                  <img src={resolveImage(b.listingImage)} alt={b.listingTitle} className="w-14 h-14 rounded-2xl object-cover shadow-lg shrink-0 border-2 border-white/30" />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    <Package className="w-6 h-6 text-white/60" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-base leading-tight truncate">{b.listingTitle}</p>
                  {b.businessName && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold mt-1 px-2 py-0.5 rounded-full bg-white/20">
                      <Building2 className="w-2.5 h-2.5" /> {b.businessName}
                    </span>
                  )}
                  <p className="text-white/75 text-xs mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(parseISO(b.startDate), "MMM d")} – {format(parseISO(b.endDate), "MMM d, yyyy")}
                    {nights > 0 && <span className="ml-1 text-white/60">· {nights} night{nights !== 1 ? "s" : ""}</span>}
                  </p>
                </div>
                <div className="shrink-0">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-white/20">
                    <Images className="w-3 h-3" /> {allPhotos.length} photo{allPhotos.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Photo grid */}
            <div className="p-3">
              {allPhotos.length === 1 ? (
                <img
                  src={allPhotos[0]}
                  alt="Adventure photo"
                  className="w-full h-56 object-cover rounded-2xl cursor-pointer hover:opacity-95 transition-opacity"
                  onClick={() => setLightbox({ photos: allPhotos, idx: 0 })}
                />
              ) : allPhotos.length === 2 ? (
                <div className="grid grid-cols-2 gap-2">
                  {allPhotos.map((p, i) => (
                    <img key={i} src={p} alt="Adventure photo" className="w-full h-44 object-cover rounded-2xl cursor-pointer hover:opacity-95 transition-opacity"
                      onClick={() => setLightbox({ photos: allPhotos, idx: i })} />
                  ))}
                </div>
              ) : allPhotos.length === 3 ? (
                <div className="grid grid-cols-3 gap-2">
                  {allPhotos.map((p, i) => (
                    <img key={i} src={p} alt="Adventure photo" className="w-full h-36 object-cover rounded-2xl cursor-pointer hover:opacity-95 transition-opacity"
                      onClick={() => setLightbox({ photos: allPhotos, idx: i })} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <img src={allPhotos[0]} alt="Adventure photo" className="w-full h-52 object-cover rounded-2xl cursor-pointer hover:opacity-95 transition-opacity row-span-2"
                    onClick={() => setLightbox({ photos: allPhotos, idx: 0 })} />
                  <div className="grid grid-rows-2 gap-2">
                    {allPhotos.slice(1, 3).map((p, i) => (
                      <img key={i} src={p} alt="Adventure photo" className="w-full h-24 object-cover rounded-2xl cursor-pointer hover:opacity-95 transition-opacity"
                        onClick={() => setLightbox({ photos: allPhotos, idx: i + 1 })} />
                    ))}
                  </div>
                  {allPhotos.length > 3 && (
                    <button
                      className="rounded-2xl bg-black/70 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-black/80 transition-colors"
                      onClick={() => setLightbox({ photos: allPhotos, idx: 3 })}
                      style={{ gridColumn: "2", height: "24px", marginTop: "-32px", position: "relative" }}
                    >
                      +{allPhotos.length - 3} more
                    </button>
                  )}
                </div>
              )}

              {/* "View all" button for 4+ photos */}
              {allPhotos.length > 3 && (
                <button
                  className="mt-2 w-full text-xs font-semibold text-muted-foreground hover:text-primary transition-colors py-1 flex items-center justify-center gap-1"
                  onClick={() => setLightbox({ photos: allPhotos, idx: 0 })}
                >
                  View all {allPhotos.length} photos <ChevronDownIcon className="w-3 h-3 rotate-[-90deg]" />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Simple completed trips without photos */}
      {withoutPhotos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">Past trips</p>
          <div className="space-y-2">
            {withoutPhotos.map(b => {
              const nights = differenceInDays(parseISO(b.endDate), parseISO(b.startDate));
              return (
                <div key={b.id} className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 bg-gray-50/50">
                  {b.listingImage ? (
                    <img src={resolveImage(b.listingImage)} alt={b.listingTitle} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{b.listingTitle}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" />
                      {format(parseISO(b.startDate), "MMM d")} – {format(parseISO(b.endDate), "MMM d, yyyy")}
                      {b.businessName && <span className="ml-1 text-muted-foreground/70">· {b.businessName}</span>}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">{nights > 0 ? `${nights}n` : "1d"}</p>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 ml-auto" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            onClick={closeLightbox}
          >
            <X className="w-5 h-5" />
          </button>
          {lightbox.photos.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                onClick={(e) => { e.stopPropagation(); advanceLightbox(-1); }}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                onClick={(e) => { e.stopPropagation(); advanceLightbox(1); }}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
          <img
            src={lightbox.photos[lightbox.idx]}
            alt="Memory photo"
            className="max-w-[92vw] max-h-[88vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {lightbox.photos.map((_, i) => (
              <button
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === lightbox.idx ? "bg-white w-4" : "bg-white/40"}`}
                onClick={(e) => { e.stopPropagation(); setLightbox({ ...lightbox, idx: i }); }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ profile, onProfileUpdated }: { profile: CustomerProfile; onProfileUpdated: (p: CustomerProfile) => void }) {
  return (
    <div className="space-y-5">
      <PersonalInfoSection  profile={profile} onUpdated={onProfileUpdated} />
      <BillingAddressSection profile={profile} onUpdated={onProfileUpdated} />
      <PaymentMethodSection  profile={profile} onUpdated={onProfileUpdated} />
      <PasswordSection       profile={profile} />
    </div>
  );
}

function PersonalInfoSection({ profile, onUpdated }: { profile: CustomerProfile; onUpdated: (p: CustomerProfile) => void }) {
  const [name,  setName]  = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatarUrl ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isDirty = name !== profile.name || phone !== (profile.phone ?? "");
  const initials = profile.name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch(`${API}/api/upload/image`, { method: "POST", body: fd });
      if (!up.ok) throw new Error("Upload failed");
      const { url } = await up.json();
      const fullUrl = url.startsWith("http") ? url : `${API}${url}`;
      const res = await fetch(`${API}/api/customers/${profile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: fullUrl }),
      });
      if (!res.ok) throw new Error("Save failed");
      const updated = await res.json();
      setAvatarUrl(fullUrl);
      onUpdated(updated);
      setMsg({ ok: true, text: "Profile photo updated." });
    } catch {
      setMsg({ ok: false, text: "Failed to upload photo. Please try again." });
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const res = await fetch(`${API}/api/customers/${profile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: null }),
      });
      if (!res.ok) throw new Error("Save failed");
      const updated = await res.json();
      setAvatarUrl(null);
      onUpdated(updated);
      setMsg({ ok: true, text: "Profile photo removed." });
    } catch {
      setMsg({ ok: false, text: "Failed to remove photo. Please try again." });
    } finally { setUploadingAvatar(false); }
  };

  const handleSave = async () => {
    if (!name.trim()) { setMsg({ ok: false, text: "Name is required." }); return; }
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`${API}/api/customers/${profile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null }),
      });
      if (!res.ok) throw new Error("Save failed");
      onUpdated(await res.json());
      setMsg({ ok: true, text: "Personal info saved." });
    } catch { setMsg({ ok: false, text: "Failed to save. Please try again." }); }
    finally { setSaving(false); }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <User className="h-3.5 w-3.5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900 text-sm">Personal Information</h2>
          <p className="text-[11px] text-gray-400">Visible to rental companies</p>
        </div>
      </div>

      {/* ── Profile Photo ── */}
      <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100">
        <div className="relative shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={profile.name}
              className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 shadow-sm"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
              <span className="text-xl font-bold text-primary">{initials}</span>
            </div>
          )}
          {uploadingAvatar && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 mb-1">Profile Photo</p>
          <p className="text-xs text-gray-400 mb-3">JPG, PNG or WebP · max 5 MB</p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarSelect}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
            >
              <Camera className="h-3.5 w-3.5" />
              {avatarUrl ? "Change Photo" : "Upload Photo"}
            </Button>
            {avatarUrl && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={handleRemoveAvatar}
                disabled={uploadingAvatar}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Email address
          </label>
          <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-500 cursor-default">
            {profile.email}
            <span className="ml-auto text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Read-only</span>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> Full name
          </label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" className="h-10" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" /> Phone number
          </label>
          <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" className="h-10" />
        </div>
      </div>
      {msg && (
        <p className={`mt-3 text-sm px-3 py-2 rounded-lg border flex items-center gap-2 ${msg.ok ? "text-green-700 bg-green-50 border-green-200" : "text-red-600 bg-red-50 border-red-200"}`}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {msg.text}
        </p>
      )}
      {isDirty && (
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-white gap-2" size="sm">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Save Changes
          </Button>
        </div>
      )}
    </section>
  );
}

function BillingAddressSection({ profile, onUpdated }: { profile: CustomerProfile; onUpdated: (p: CustomerProfile) => void }) {
  const [address, setAddress] = useState(profile.billingAddress ?? "");
  const [city,    setCity]    = useState(profile.billingCity    ?? "");
  const [state,   setState]   = useState(profile.billingState   ?? "");
  const [zip,     setZip]     = useState(profile.billingZip     ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const isDirty =
    address !== (profile.billingAddress ?? "") ||
    city    !== (profile.billingCity    ?? "") ||
    state   !== (profile.billingState   ?? "") ||
    zip     !== (profile.billingZip     ?? "");

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`${API}/api/customers/${profile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingAddress: address.trim() || null,
          billingCity:    city.trim()    || null,
          billingState:   state.trim()   || null,
          billingZip:     zip.trim()     || null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      onUpdated(await res.json());
      setMsg({ ok: true, text: "Billing address saved." });
    } catch { setMsg({ ok: false, text: "Failed to save. Please try again." }); }
    finally { setSaving(false); }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-lg bg-amber-50 flex items-center justify-center">
          <MapPin className="h-3.5 w-3.5 text-amber-500" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900 text-sm">Billing Address</h2>
          <p className="text-[11px] text-gray-400">Used for receipts and mailed documents</p>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Street address</label>
          <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main Street" className="h-10" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">City</label>
            <Input value={city} onChange={e => setCity(e.target.value)} placeholder="City" className="h-10" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">State</label>
            <Input value={state} onChange={e => setState(e.target.value)} placeholder="TX" maxLength={2} className="h-10 uppercase" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">ZIP</label>
            <Input value={zip} onChange={e => setZip(e.target.value)} placeholder="78701" className="h-10" />
          </div>
        </div>
      </div>
      {msg && (
        <p className={`mt-3 text-sm px-3 py-2 rounded-lg border flex items-center gap-2 ${msg.ok ? "text-green-700 bg-green-50 border-green-200" : "text-red-600 bg-red-50 border-red-200"}`}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {msg.text}
        </p>
      )}
      {isDirty && (
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-white gap-2" size="sm">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Save Address
          </Button>
        </div>
      )}
    </section>
  );
}

function PaymentMethodSection({ profile, onUpdated }: { profile: CustomerProfile; onUpdated: (p: CustomerProfile) => void }) {
  const [removing, setRemoving] = useState(false);
  const hasCard = !!(profile.cardLastFour && profile.cardBrand);
  const brand = profile.cardBrand ? profile.cardBrand.charAt(0).toUpperCase() + profile.cardBrand.slice(1) : "Card";

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const res = await fetch(`${API}/api/customers/${profile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardLastFour: null, cardBrand: null }),
      });
      if (!res.ok) throw new Error();
      onUpdated(await res.json());
    } catch { /* silent */ }
    finally { setRemoving(false); }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center">
          <CreditCard className="h-3.5 w-3.5 text-blue-500" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900 text-sm">Payment Method</h2>
          <p className="text-[11px] text-gray-400">Saved securely for faster checkout</p>
        </div>
      </div>
      {hasCard ? (
        <div className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-15 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center px-2.5 shadow-sm">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">{brand} •••• {profile.cardLastFour}</p>
              <p className="text-xs text-gray-400">Saved payment method</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRemove} disabled={removing}
            className="text-red-500 hover:text-red-600 hover:bg-red-50 gap-1.5 text-xs">
            {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Remove
          </Button>
        </div>
      ) : (
        <div className="flex items-start gap-3 bg-gray-50 border border-dashed border-gray-200 rounded-xl px-4 py-4">
          <AlertCircle className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-600">No saved payment method</p>
            <p className="text-xs text-gray-400 mt-0.5">Your card will be saved securely after your next booking for faster checkout.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function PasswordSection({ profile }: { profile: CustomerProfile }) {
  const [current, setCurrent]   = useState("");
  const [next,    setNext]      = useState("");
  const [confirm, setConfirm]   = useState("");
  const [saving,  setSaving]    = useState(false);
  const [msg, setMsg]           = useState<{ ok: boolean; text: string } | null>(null);

  const canSave = current.length > 0 && next.length >= 6 && next === confirm;

  const handleSave = async () => {
    if (next !== confirm) { setMsg({ ok: false, text: "Passwords don't match." }); return; }
    if (next.length < 6)  { setMsg({ ok: false, text: "Password must be at least 6 characters." }); return; }
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`${API}/api/customers/${profile.id}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to change password");
      setMsg({ ok: true, text: "Password changed successfully." });
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err: any) {
      setMsg({ ok: false, text: err.message ?? "Failed to change password." });
    } finally { setSaving(false); }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center">
          <Lock className="h-3.5 w-3.5 text-gray-500" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900 text-sm">Change Password</h2>
          <p className="text-[11px] text-gray-400">Use a strong password of at least 6 characters</p>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Current password</label>
          <Input type="password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="••••••••" className="h-10" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">New password</label>
          <Input type="password" value={next} onChange={e => setNext(e.target.value)} placeholder="••••••••" className="h-10" />
          {next.length > 0 && next.length < 6 && <p className="text-[11px] text-red-500 mt-1">At least 6 characters required</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Confirm new password</label>
          <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" className="h-10" />
          {confirm.length > 0 && next !== confirm && <p className="text-[11px] text-red-500 mt-1">Passwords don't match</p>}
        </div>
      </div>
      {msg && (
        <p className={`mt-3 text-sm px-3 py-2 rounded-lg border flex items-center gap-2 ${msg.ok ? "text-green-700 bg-green-50 border-green-200" : "text-red-600 bg-red-50 border-red-200"}`}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {msg.text}
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <Button onClick={handleSave} disabled={!canSave || saving} className="bg-gray-800 hover:bg-gray-900 text-white gap-2" size="sm">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
          Update Password
        </Button>
      </div>
    </section>
  );
}

// ─── Feedback form ────────────────────────────────────────────────────────────

function RenterFeedbackForm({ slug }: { slug: string }) {
  const [open, setOpen]         = useState(false);
  const [rating, setRating]     = useState<number | null>(null);
  const [hoverRating, setHR]    = useState<number | null>(null);
  const [subject, setSubject]   = useState("");
  const [message, setMessage]   = useState("");
  const [submitting, setSub]    = useState(false);
  const [submitted, setDone]    = useState(false);
  const [error, setError]       = useState("");

  const session = loadSession();

  const handleSubmit = async () => {
    if (!message.trim()) { setError("Please enter a message."); return; }
    setError(""); setSub(true);
    try {
      const res = await fetch(`${BASE}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": slug },
        body: JSON.stringify({
          submitterType: "renter",
          submitterName: session?.name ?? "",
          submitterEmail: session?.email ?? "",
          subject: subject.trim() || undefined,
          message: message.trim(),
          rating: rating ?? undefined,
          tenantSlug: slug,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to submit."); return; }
      setDone(true);
    } catch { setError("Something went wrong. Please try again."); }
    finally { setSub(false); }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border bg-green-50 border-green-200 p-6 text-center space-y-2">
        <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto" />
        <p className="font-semibold text-green-800">Thanks for your feedback!</p>
        <p className="text-sm text-green-700">We appreciate you taking the time to share your thoughts.</p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-dashed border-gray-300 p-5 text-center hover:border-primary/40 hover:bg-primary/5 transition-all group"
      >
        <MessageSquarePlus className="w-5 h-5 text-gray-400 group-hover:text-primary mx-auto mb-1.5 transition-colors" />
        <p className="text-sm font-medium text-gray-500 group-hover:text-foreground transition-colors">Share feedback about your experience</p>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border bg-white shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <MessageSquarePlus className="w-4 h-4 text-primary" /> Share Feedback
        </h3>
        <button onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Overall Experience <span className="text-gray-400 font-normal">(optional)</span></Label>
        <div className="flex items-center gap-1">
          {[1,2,3,4,5].map(i => (
            <button key={i} type="button" onClick={() => setRating(i === rating ? null : i)}
              onMouseEnter={() => setHR(i)} onMouseLeave={() => setHR(null)}
              className="p-0.5 transition-transform hover:scale-110">
              <Star className={`w-6 h-6 transition-colors ${i <= (hoverRating ?? rating ?? 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs" htmlFor="rf-subject">Subject <span className="text-gray-400 font-normal">(optional)</span></Label>
        <input id="rf-subject" value={subject} onChange={e => setSubject(e.target.value)}
          placeholder="e.g. Great experience, Suggestion…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs" htmlFor="rf-message">Message</Label>
        <Textarea id="rf-message" value={message} onChange={e => setMessage(e.target.value)}
          placeholder="Tell us about your rental experience…" rows={3} />
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
      <Button className="w-full h-10" onClick={handleSubmit} disabled={submitting}>
        {submitting ? "Sending…" : "Send Feedback"}
      </Button>
    </div>
  );
}
