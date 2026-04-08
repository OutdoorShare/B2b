import { useState, useMemo, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import {
  User, LogOut, Calendar, CalendarDays, List, Settings,
  CreditCard, Lock, MapPin, CheckCircle2, AlertCircle, Clock,
  Loader2, ChevronLeft, ChevronRight, Search, X, ExternalLink,
  Mail, Phone, Shield, Trash2, RotateCcw, Building2,
  MessageSquarePlus, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  format, startOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO, differenceInDays,
} from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API  = import.meta.env.VITE_API_URL ?? "";

function resolveImage(url: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API}/api/uploads/${url.split("/").pop()}`;
}

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-100  text-amber-900  border-amber-300",
  confirmed: "bg-blue-100   text-blue-900   border-blue-300",
  active:    "bg-green-100  text-green-900  border-green-300",
  completed: "bg-gray-100   text-gray-600   border-gray-300",
  cancelled: "bg-red-100    text-red-700    border-red-300",
};
const STATUS_DOT: Record<string, string> = {
  pending:   "bg-amber-400",
  confirmed: "bg-blue-500",
  active:    "bg-green-500",
  completed: "bg-gray-400",
  cancelled: "bg-red-400",
};
const STATUS_BADGE: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  active:    "bg-green-100 text-green-800 border-green-200",
  completed: "bg-gray-100 text-gray-700 border-gray-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
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
  if (daysToStart > 1)  return { label: `Starts in ${daysToStart}d`,  color: "text-blue-600 bg-blue-50 border-blue-200",   pct: 0,   bar: "bg-blue-400" };
  if (daysToStart === 1) return { label: "Starts tomorrow",            color: "text-blue-600 bg-blue-50 border-blue-200",   pct: 0,   bar: "bg-blue-400" };
  if (daysToStart === 0) return { label: "Pickup day!",                color: "text-green-700 bg-green-50 border-green-200",pct: 0,   bar: "bg-green-500" };
  if (daysToEnd > 1)    return { label: `${daysToEnd}d remaining`,    color: "text-green-700 bg-green-50 border-green-200",pct,      bar: "bg-green-500" };
  if (daysToEnd === 1)  return { label: "Returns tomorrow",            color: "text-amber-700 bg-amber-50 border-amber-200",pct,      bar: "bg-amber-500" };
  if (daysToEnd === 0)  return { label: "Due back today",              color: "text-amber-700 bg-amber-50 border-amber-200",pct: 100, bar: "bg-amber-500" };
  return                        { label: `Overdue ${Math.abs(daysToEnd)}d`, color: "text-red-700 bg-red-50 border-red-300", pct: 100, bar: "bg-red-500" };
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
  identityVerificationStatus: string | null;
  createdAt: string;
};

type Session = { id: number; email: string; name: string; phone?: string };
type Tab = "bookings" | "profile" | "settings";

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

    fetch(`${API}/api/customers/${s.id}`)
      .then(r => r.json())
      .then((d: CustomerProfile) => { setProfile(d); setPL(false); })
      .catch(() => setPL(false));

    fetch(`${API}/api/marketplace/renter/bookings?customerId=${s.id}`)
      .then(r => r.json())
      .then((d: RenterBooking[]) => { if (Array.isArray(d)) setBookings(d); setBL(false); })
      .catch(() => setBL(false));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("rental_customer");
    setLocation(`${base}/login`);
  };

  if (!session) return null;

  const initials = session.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "";
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;
  const totalSpent = bookings.reduce((sum, b) => sum + parseFloat(b.totalPrice || "0"), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
              {initials || <User className="w-6 h-6" />}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{session.name}</h1>
              <p className="text-sm text-gray-500">{session.email}</p>
              {session.phone && <p className="text-xs text-gray-400 mt-0.5">{session.phone}</p>}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 text-red-600 hover:text-red-700 hover:border-red-300 flex-shrink-0">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => setTab("bookings")}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-lg transition-all ${tab === "bookings" ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Calendar className={`h-4 w-4 ${tab === "bookings" ? "text-blue-600" : ""}`} />
            <span className="hidden sm:inline">My Bookings</span>
            <span className="sm:hidden">Bookings</span>
            {bookings.length > 0 && (
              <span className={`text-xs ${tab === "bookings" ? "text-blue-400" : "text-gray-400"}`}>({bookings.length})</span>
            )}
          </button>
          <button
            onClick={() => setTab("profile")}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-lg transition-all ${tab === "profile" ? "bg-white shadow text-primary" : "text-gray-500 hover:text-gray-700"}`}
          >
            <User className={`h-4 w-4 ${tab === "profile" ? "text-primary" : ""}`} />
            <span className="hidden sm:inline">My Profile</span>
            <span className="sm:hidden">Profile</span>
          </button>
          <button
            onClick={() => setTab("settings")}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-lg transition-all ${tab === "settings" ? "bg-white shadow text-violet-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Settings className={`h-4 w-4 ${tab === "settings" ? "text-violet-600" : ""}`} />
            Settings
          </button>
        </div>

        {tab === "profile" && (
          <ProfileTab
            session={session}
            memberSince={memberSince}
            bookingCount={bookings.length}
            totalSpent={totalSpent}
            onEditSettings={() => setTab("settings")}
          />
        )}

        {tab === "bookings" && (
          <BookingsTab
            bookings={bookings}
            isLoading={bookingsLoading}
            slug={slug ?? ""}
            base={base}
            onBrowse={() => setLocation(base || "/")}
          />
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
  session, memberSince, bookingCount, totalSpent, onEditSettings,
}: {
  session: Session;
  memberSince: string | null;
  bookingCount: number;
  totalSpent: number;
  onEditSettings: () => void;
}) {
  const initials = session.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "";
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col items-center text-center gap-3">
        <div className="h-24 w-24 rounded-full bg-primary flex items-center justify-center text-white font-bold text-4xl shadow-sm">
          {initials || <User className="w-10 h-10" />}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{session.name}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{session.email}</p>
          {session.phone && <p className="text-sm text-gray-400 mt-0.5">{session.phone}</p>}
          {memberSince && (
            <p className="text-xs text-gray-400 mt-2 flex items-center justify-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Member since {memberSince}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onEditSettings} className="mt-1 gap-2">
          <Settings className="h-4 w-4" />
          Edit Profile
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{bookingCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Rentals Booked</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">${totalSpent.toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Spent</p>
        </div>
      </div>
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
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
            <div className="flex gap-4">
              <div className="h-20 w-24 bg-gray-200 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-3 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-200 rounded w-1/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (allBookings.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
        <div className="text-4xl mb-3">📋</div>
        <h3 className="font-semibold text-gray-700 mb-1">No bookings yet</h3>
        <p className="text-sm text-gray-400 mb-5">When you book a rental, it'll appear here</p>
        <Button onClick={onBrowse} className="bg-primary hover:bg-primary/90 text-white">Browse Rentals</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{allBookings.length} booking{allBookings.length !== 1 ? "s" : ""}</p>
        <div className="flex rounded-lg border bg-white overflow-hidden shadow-sm">
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${view === "list" ? "bg-primary text-white" : "text-gray-500 hover:text-gray-700"}`}
          >
            <List className="w-4 h-4" /> List
          </button>
          <button
            onClick={() => setView("calendar")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${view === "calendar" ? "bg-primary text-white" : "text-gray-500 hover:text-gray-700"}`}
          >
            <CalendarDays className="w-4 h-4" /> Calendar
          </button>
        </div>
      </div>

      {/* LIST VIEW */}
      {view === "list" && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-1 flex-wrap">
                {BOOKING_TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                      activeTab === t.key
                        ? "bg-primary text-white"
                        : "bg-white border border-gray-200 text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {t.label}
                    <span className={`text-[10px] px-1.5 py-px rounded-full ${activeTab === t.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                      {tabCounts[t.key]}
                    </span>
                  </button>
                ))}
              </div>
              <div className="relative sm:ml-auto w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search listing, company, status…"
                  className="w-full h-9 pl-8 pr-8 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {displayed.length === 0 ? (
            <div className="py-16 text-center">
              <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">{search ? "No bookings match your search" : "No bookings in this view"}</p>
              {search && <button onClick={() => setSearch("")} className="mt-2 text-xs text-primary underline">Clear search</button>}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {displayed.map(booking => {
                const ts = getRentalTimeStatus(booking.startDate, booking.endDate, booking.status);
                const badgeCls = STATUS_BADGE[booking.status] ?? "bg-gray-100 text-gray-700 border-gray-200";
                const bookingBase = booking.tenantSlug ? `/${booking.tenantSlug}` : base;
                const hasUpdate = booking.seenByRenter === false;
                return (
                  <div
                    key={booking.id}
                    className={`p-5 sm:p-6 hover:bg-gray-50 transition-colors cursor-pointer ${hasUpdate ? "bg-blue-50/40" : ""}`}
                    onClick={() => setLocation(`${bookingBase}/my-bookings/${booking.id}`)}
                  >
                    <div className="flex gap-5 items-start">
                      <div className="h-24 w-28 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 shadow-sm">
                        {booking.listingImage ? (
                          <img src={resolveImage(booking.listingImage)} alt={booking.listingTitle} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl">🏕️</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {hasUpdate && (
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-xs font-semibold text-blue-600">New update on your booking</span>
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-800 text-base line-clamp-1">{booking.listingTitle}</h3>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border capitalize flex-shrink-0 ${badgeCls}`}>
                            {booking.status}
                          </span>
                        </div>
                        {booking.businessName && (
                          <div className="flex items-center gap-1.5 text-sm text-gray-500">
                            {booking.businessLogoUrl && (
                              <img src={resolveImage(booking.businessLogoUrl)} alt="" className="h-4 w-4 rounded-full object-cover" />
                            )}
                            <span>{booking.businessName}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-sm text-gray-400">
                          <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>{format(parseISO(booking.startDate), "MMM d")} – {format(parseISO(booking.endDate), "MMM d, yyyy")}</span>
                        </div>
                        {ts && (
                          <div className="space-y-1.5 pt-0.5">
                            <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded border ${ts.color}`}>
                              {ts.label}
                            </span>
                            {ts.pct > 0 && (
                              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${ts.bar}`} style={{ width: `${ts.pct}%` }} />
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-base font-bold text-gray-800">${parseFloat(booking.totalPrice || "0").toFixed(2)}</span>
                          <div className="flex items-center gap-3">
                            {booking.status === "cancelled" || booking.status === "completed" ? (
                              <button
                                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                                onClick={e => { e.stopPropagation(); setLocation(`${bookingBase}/book?listingId=${booking.listingId}`); }}
                              >
                                <RotateCcw className="h-3 w-3" /> Book Again
                              </button>
                            ) : null}
                            {booking.tenantSlug && (
                              <button
                                className="text-xs text-gray-400 hover:text-primary flex items-center gap-1"
                                onClick={e => { e.stopPropagation(); window.open(`/${booking.tenantSlug}`, "_blank"); }}
                              >
                                View company <ExternalLink className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="px-4 py-2 text-xs text-gray-400 text-right">
                {displayed.length} booking{displayed.length !== 1 ? "s" : ""}{search ? ` matching "${search}"` : ""}
              </div>
            </div>
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
                                <button
                                  className="text-xs text-primary hover:underline font-medium"
                                  onClick={() => setLocation(`${bookingBase}/my-bookings/${b.id}`)}
                                >View booking</button>
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

      {/* Feedback form */}
      <RenterFeedbackForm slug={base.replace(/^\//, "")} />
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ profile, onProfileUpdated }: { profile: CustomerProfile; onProfileUpdated: (p: CustomerProfile) => void }) {
  return (
    <div className="space-y-5">
      <PersonalInfoSection profile={profile} onUpdated={onProfileUpdated} />
      <BillingAddressSection profile={profile} onUpdated={onProfileUpdated} />
      <PaymentMethodSection profile={profile} onUpdated={onProfileUpdated} />
      <PasswordSection profile={profile} />
    </div>
  );
}

function PersonalInfoSection({ profile, onUpdated }: { profile: CustomerProfile; onUpdated: (p: CustomerProfile) => void }) {
  const [name, setName]   = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const isDirty = name !== profile.name || phone !== (profile.phone ?? "");

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
      const updated: CustomerProfile = await res.json();
      onUpdated(updated);
      setMsg({ ok: true, text: "Personal info saved." });
    } catch { setMsg({ ok: false, text: "Failed to save. Please try again." }); }
    finally { setSaving(false); }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-1">
        <User className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-gray-900">Personal Information</h2>
      </div>
      <p className="text-xs text-gray-400 mb-5">Your name and contact details visible to rental companies.</p>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Email address
          </label>
          <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-500 cursor-default">
            {profile.email}
            <span className="ml-auto text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Read-only</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Email is your login and cannot be changed.</p>
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
  const [city, setCity]       = useState(profile.billingCity ?? "");
  const [state, setState]     = useState(profile.billingState ?? "");
  const [zip, setZip]         = useState(profile.billingZip ?? "");
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null);

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
      const updated: CustomerProfile = await res.json();
      onUpdated(updated);
      setMsg({ ok: true, text: "Billing address saved." });
    } catch { setMsg({ ok: false, text: "Failed to save. Please try again." }); }
    finally { setSaving(false); }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-1">
        <MapPin className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-gray-900">Billing Address</h2>
      </div>
      <p className="text-xs text-gray-400 mb-5">Used for receipts and any mailed documents.</p>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Street address</label>
          <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main Street" className="h-10" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">City</label>
            <Input value={city} onChange={e => setCity(e.target.value)} placeholder="City" className="h-10" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">State</label>
            <Input value={state} onChange={e => setState(e.target.value)} placeholder="TX" maxLength={2} className="h-10 uppercase" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">ZIP code</label>
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
  const brandLabel = profile.cardBrand
    ? profile.cardBrand.charAt(0).toUpperCase() + profile.cardBrand.slice(1)
    : "Card";

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const res = await fetch(`${API}/api/customers/${profile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardLastFour: null, cardBrand: null }),
      });
      if (!res.ok) throw new Error("Failed to remove");
      const updated: CustomerProfile = await res.json();
      onUpdated(updated);
    } catch { /* silent */ }
    finally { setRemoving(false); }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-1">
        <CreditCard className="h-4 w-4 text-blue-600" />
        <h2 className="font-semibold text-gray-900">Payment Method</h2>
      </div>
      <p className="text-xs text-gray-400 mb-5">
        Your card is saved automatically after your first booking and used for faster checkout on future rentals.
      </p>
      {hasCard ? (
        <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-14 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{brandLabel} •••• {profile.cardLastFour}</p>
              <p className="text-xs text-gray-400">Saved payment method</p>
            </div>
          </div>
          <Button
            variant="ghost" size="sm" onClick={handleRemove} disabled={removing}
            className="text-red-500 hover:text-red-600 hover:bg-red-50 gap-1.5"
          >
            {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Remove
          </Button>
        </div>
      ) : (
        <div className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-4">
          <AlertCircle className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-600">No saved payment method</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Your card will be saved securely when you complete your next booking, enabling faster checkout in the future.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function PasswordSection({ profile }: { profile: CustomerProfile }) {
  const [current,  setCurrent]  = useState("");
  const [next,     setNext]     = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [saving,   setSaving]   = useState(false);
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
      <div className="flex items-center gap-2 mb-1">
        <Lock className="h-4 w-4 text-gray-500" />
        <h2 className="font-semibold text-gray-900">Change Password</h2>
      </div>
      <p className="text-xs text-gray-400 mb-5">Use a strong password of at least 6 characters.</p>
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
