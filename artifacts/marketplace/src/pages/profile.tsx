import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  User, LogOut, Calendar, ExternalLink, ArrowLeft,
  Settings, CreditCard, Lock, MapPin, Trash2, CheckCircle2,
  Phone, Mail, Loader2, AlertCircle, CalendarDays, List,
  ChevronLeft, ChevronRight, Search, X, Mountain, Plus, Globe, Heart,
} from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import { useFavorites } from "@/context/favorites";
import { Memory, MemoryCard, CreateMemoryModal } from "@/pages/memories";
import {
  format, startOfDay, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addDays, addMonths, subMonths,
  isSameMonth, isSameDay, parseISO, differenceInDays,
} from "date-fns";

const API_UPLOAD_BASE = "/api/uploads/";
function resolveImage(url: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_UPLOAD_BASE}${url.split("/").pop()}`;
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
  const skipped = ["cancelled", "completed", "no_show"];
  if (skipped.includes(status)) return null;
  const today = startOfDay(new Date());
  const start = startOfDay(new Date(startStr + "T00:00:00"));
  const end   = startOfDay(new Date(endStr   + "T00:00:00"));
  const daysToStart = differenceInDays(start, today);
  const daysToEnd   = differenceInDays(end,   today);
  const totalDays   = Math.max(1, differenceInDays(end, start));
  const elapsed     = Math.max(0, differenceInDays(today, start));
  const pct         = Math.min(100, Math.round((elapsed / totalDays) * 100));
  if (daysToStart > 1)  return { label: `Starts in ${daysToStart}d`, color: "text-blue-600 bg-blue-50 border-blue-200", pct: 0, bar: "bg-blue-400" };
  if (daysToStart === 1) return { label: "Starts tomorrow",          color: "text-blue-600 bg-blue-50 border-blue-200", pct: 0, bar: "bg-blue-400" };
  if (daysToStart === 0) return { label: "Pickup day!",              color: "text-green-700 bg-green-50 border-green-200", pct: 0, bar: "bg-green-500" };
  if (daysToEnd > 1)    return { label: `${daysToEnd}d remaining`,  color: "text-green-700 bg-green-50 border-green-200", pct, bar: "bg-green-500" };
  if (daysToEnd === 1)  return { label: "Returns tomorrow",          color: "text-amber-700 bg-amber-50 border-amber-200", pct, bar: "bg-amber-500" };
  if (daysToEnd === 0)  return { label: "Due back today",            color: "text-amber-700 bg-amber-50 border-amber-200", pct: 100, bar: "bg-amber-500" };
  return { label: `Overdue ${Math.abs(daysToEnd)}d`,                 color: "text-red-700 bg-red-50 border-red-300", pct: 100, bar: "bg-red-500" };
}

type RenterBooking = {
  id: number;
  status: string;
  startDate: string;
  endDate: string;
  totalPrice: string;
  listingTitle: string;
  listingImage: string | null;
  tenantSlug: string | null;
  businessName: string | null;
  businessLogoUrl: string | null;
  businessPrimaryColor: string | null;
  createdAt: string;
};

type Tab = "bookings" | "favorites" | "memories" | "settings";

export function ProfilePage({ onAuthOpen }: { onAuthOpen: () => void }) {
  const { customer, updateCustomer, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "settings") return "settings";
    if (params.get("tab") === "favorites") return "favorites";
    return "bookings";
  });
  const { favoriteIds } = useFavorites();

  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["renter-bookings", customer?.id],
    queryFn: () => api.marketplace.renterBookings(customer!.id),
    enabled: !!customer,
  });

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <User className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Sign in to view your account</h2>
          <p className="text-gray-500 mb-6">Track bookings and manage your info across all OutdoorShare companies</p>
          <Button onClick={onAuthOpen} className="bg-brand-blue hover:bg-brand-blue/90 text-white">Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Browse
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
              {customer.name[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{customer.name}</h1>
              <p className="text-sm text-gray-500">{customer.email}</p>
              {customer.phone && <p className="text-xs text-gray-400 mt-0.5">{customer.phone}</p>}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={logout} className="gap-2 text-red-600 hover:text-red-700 hover:border-red-300 flex-shrink-0">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => setTab("bookings")}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-lg transition-all ${
              tab === "bookings" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Booked Adventures</span>
            <span className="sm:hidden">Bookings</span>
            {bookings && <span className="text-xs text-gray-400">({bookings.length})</span>}
          </button>
          <button
            onClick={() => setTab("favorites")}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-lg transition-all ${
              tab === "favorites" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Heart className={`h-4 w-4 ${tab === "favorites" ? "fill-red-500 text-red-500" : ""}`} />
            <span>Favorites</span>
            {favoriteIds.size > 0 && <span className="text-xs text-gray-400">({favoriteIds.size})</span>}
          </button>
          <button
            onClick={() => setTab("memories")}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-lg transition-all ${
              tab === "memories" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Mountain className="h-4 w-4" />
            <span className="hidden sm:inline">My Memories</span>
            <span className="sm:hidden">Memories</span>
          </button>
          <button
            onClick={() => setTab("settings")}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-lg transition-all ${
              tab === "settings" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>

        {tab === "bookings" && (
          <BookingsTab bookings={bookings} isLoading={bookingsLoading} onBrowse={() => setLocation("/")} />
        )}

        {tab === "favorites" && (
          <FavoritesTab customerId={customer.id} onBrowse={() => setLocation("/")} />
        )}

        {tab === "memories" && (
          <MemoriesTab customer={customer} />
        )}

        {tab === "settings" && (
          <SettingsTab customer={customer} updateCustomer={updateCustomer} toast={toast} />
        )}
      </div>
    </div>
  );
}

type BookingViewMode = "list" | "calendar";

// ─── Favorites Tab ────────────────────────────────────────────────────────────

function FavoritesTab({ customerId, onBrowse }: { customerId: number; onBrowse: () => void }) {
  const { data: listings = [], isLoading } = useQuery<import("@/lib/api").MarketplaceListing[]>({
    queryKey: ["favorite-listings", customerId],
    queryFn: () =>
      fetch(`/api/marketplace/favorites/listings?customerId=${customerId}`)
        .then(r => r.ok ? r.json() : []),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 h-64 animate-pulse" />
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
        <Heart className="h-12 w-12 text-gray-200 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">No favorites yet</h2>
        <p className="text-gray-400 text-sm mb-6">
          Tap the heart on any listing to save it here for later.
        </p>
        <Button onClick={onBrowse} className="bg-primary hover:bg-primary/90 text-white">
          Browse Listings
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">{listings.length} saved listing{listings.length !== 1 ? "s" : ""}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {listings.map(listing => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </div>
  );
}

// ─── Memories Tab ─────────────────────────────────────────────────────────────

function MemoriesTab({ customer }: { customer: NonNullable<ReturnType<typeof useAuth>["customer"]> }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);

  const { data: memories = [], isLoading } = useQuery<Memory[]>({
    queryKey: ["my-memories", customer.id],
    queryFn: async () => {
      const res = await fetch("/api/memories/my", {
        headers: { "x-customer-id": String(customer.id) },
      });
      const data = await res.json();
      return data.memories ?? [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/memories/${id}`, {
        method: "DELETE",
        headers: { "x-customer-id": String(customer.id) },
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-memories", customer.id] });
      qc.invalidateQueries({ queryKey: ["memories"] });
      toast({ title: "Memory deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const publicCount = memories.filter((m) => m.isPublic).length;
  const privateCount = memories.filter((m) => !m.isPublic).length;

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">My Memories</h2>
          {memories.length > 0 && (
            <p className="text-sm text-gray-400 mt-0.5">
              {memories.length} {memories.length === 1 ? "memory" : "memories"} · {publicCount} public · {privateCount} private
            </p>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreate(true)}
          className="gap-2 bg-primary hover:bg-primary/90 text-white"
        >
          <Plus className="h-4 w-4" />
          Add Memory
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && memories.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Mountain className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-gray-800 mb-1">No memories yet</h3>
          <p className="text-sm text-gray-500 mb-5 max-w-xs">
            Capture your outdoor adventures — photos, captions, and tags for the companies you rented from.
          </p>
          <Button onClick={() => setShowCreate(true)} className="gap-2 bg-primary hover:bg-primary/90 text-white">
            <Plus className="h-4 w-4" />
            Add your first memory
          </Button>
        </div>
      )}

      {/* Privacy legend */}
      {!isLoading && memories.length > 0 && (
        <div className="flex gap-4 text-xs text-gray-400 mb-4">
          <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Public — visible on the social wall</span>
          <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Private — only you can see</span>
        </div>
      )}

      {/* Grid */}
      {!isLoading && memories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {memories.map((m) => (
            <MemoryCard
              key={m.id}
              memory={m}
              isOwn={true}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateMemoryModal
          customerId={customer.id}
          customerName={customer.name}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["my-memories", customer.id] });
            qc.invalidateQueries({ queryKey: ["memories"] });
          }}
        />
      )}
    </div>
  );
}

// ─── Bookings Tab ─────────────────────────────────────────────────────────────

type BookingTabKey = "recent" | "upcoming" | "cancelled" | "all";

const BOOKING_TABS: { key: BookingTabKey; label: string }[] = [
  { key: "recent",    label: "Recent" },
  { key: "upcoming",  label: "Upcoming" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all",       label: "All" },
];

function BookingsTab({
  bookings: allBookings,
  isLoading,
  onBrowse,
}: {
  bookings: RenterBooking[] | undefined;
  isLoading: boolean;
  onBrowse: () => void;
}) {
  const [view, setView]               = useState<BookingViewMode>("list");
  const [activeTab, setActiveTab]     = useState<BookingTabKey>("recent");
  const [search, setSearch]           = useState("");
  const [calendarMonth, setCalMonth]  = useState(new Date());
  const [expandedId, setExpandedId]   = useState<number | null>(null);

  const today = startOfDay(new Date());

  const bookings = allBookings ?? [];

  const tabCounts = useMemo(() => ({
    recent:    bookings.filter(b => b.status !== "cancelled").length,
    upcoming:  bookings.filter(b => b.status !== "cancelled" && startOfDay(parseISO(b.startDate)) >= today).length,
    cancelled: bookings.filter(b => b.status === "cancelled").length,
    all:       bookings.length,
  }), [bookings]);

  const tabFiltered = useMemo(() => {
    const all = [...bookings];
    switch (activeTab) {
      case "upcoming":
        return all
          .filter(b => b.status !== "cancelled" && startOfDay(parseISO(b.startDate)) >= today)
          .sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());
      case "cancelled":
        return all
          .filter(b => b.status === "cancelled")
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case "all":
        return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      default:
        return all
          .filter(b => b.status !== "cancelled")
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }, [bookings, activeTab]);

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

  // ── Calendar helpers ──────────────────────────────────────────────────
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
    const weekBookings = bookings
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
      const bStart  = startOfDay(parseISO(b.startDate));
      const bEnd    = startOfDay(parseISO(b.endDate));
      const startCol = Math.max(0, differenceInDays(bStart, weekStart)) + 1;
      const endCol   = Math.min(6, differenceInDays(bEnd,   weekStart)) + 2;
      const isStart  = bStart >= weekStart;
      const isEnd    = bEnd <= weekEnd;
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
        {Array.from({ length: 3 }).map((_, i) => (
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

  if (bookings.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
        <div className="text-4xl mb-3">📋</div>
        <h3 className="font-semibold text-gray-700 mb-1">No bookings yet</h3>
        <p className="text-sm text-gray-400 mb-5">When you book a rental, it'll appear here</p>
        <Button onClick={onBrowse} className="bg-primary hover:bg-primary/90 text-white">Browse Listings</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{bookings.length} booking{bookings.length !== 1 ? "s" : ""}</p>
        <div className="flex rounded-lg border bg-white overflow-hidden shadow-sm">
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
              view === "list" ? "bg-primary text-white" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <List className="w-4 h-4" /> List
          </button>
          <button
            onClick={() => setView("calendar")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
              view === "calendar" ? "bg-primary text-white" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <CalendarDays className="w-4 h-4" /> Calendar
          </button>
        </div>
      </div>

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Tabs + Search */}
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

          {/* Booking cards */}
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
                return (
                  <div key={booking.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex gap-4 items-start">
                      <div className="h-20 w-24 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100">
                        {booking.listingImage ? (
                          <img src={resolveImage(booking.listingImage)} alt={booking.listingTitle} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">🏕️</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-800 text-sm line-clamp-1">{booking.listingTitle}</h3>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${badgeCls}`}>
                            {booking.status}
                          </span>
                        </div>
                        {booking.businessName && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                            {booking.businessLogoUrl && (
                              <img src={resolveImage(booking.businessLogoUrl)} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
                            )}
                            <span>{booking.businessName}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                          <Calendar className="h-3 w-3" />
                          <span>{format(parseISO(booking.startDate), "MMM d")} – {format(parseISO(booking.endDate), "MMM d, yyyy")}</span>
                        </div>
                        {ts && (
                          <div className="mt-1.5 space-y-1">
                            <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border ${ts.color}`}>
                              {ts.label}
                            </span>
                            {ts.pct > 0 && (
                              <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${ts.bar}`} style={{ width: `${ts.pct}%` }} />
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-semibold text-gray-800">${parseFloat(booking.totalPrice).toFixed(2)}</span>
                          {booking.tenantSlug && (
                            <button
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                              onClick={() => window.open(`/${booking.tenantSlug}`, "_blank")}
                            >
                              View company <ExternalLink className="h-3 w-3" />
                            </button>
                          )}
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

      {/* ── CALENDAR VIEW ── */}
      {view === "calendar" && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Month navigation */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <button
              onClick={() => setCalMonth(m => subMonths(m, 1))}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-gray-800">{format(calendarMonth, "MMMM yyyy")}</h3>
            <button
              onClick={() => setCalMonth(m => addMonths(m, 1))}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b bg-gray-50">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="divide-y divide-gray-100">
            {calendarWeeks.map((week, wi) => {
              const lanes = computeLanes(week);
              return (
                <div key={wi}>
                  <div className="grid grid-cols-7 divide-x divide-gray-100 border-b border-gray-100">
                    {week.map((day, di) => {
                      const isToday = isSameDay(day, new Date());
                      const inMonth = isSameMonth(day, calendarMonth);
                      return (
                        <div key={di} className={`py-1.5 px-2 flex items-center justify-end ${inMonth ? "" : "bg-gray-50/60"}`}>
                          <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${
                            isToday ? "bg-primary text-white" : inMonth ? "text-gray-700" : "text-gray-300"
                          }`}>
                            {format(day, "d")}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Event bars */}
                  <div
                    className={`pb-1.5 pt-1 ${isSameMonth(week[3], calendarMonth) ? "" : "bg-gray-50/40"}`}
                    style={{ minHeight: `${Math.max(32, lanes.length * 24 + 8)}px` }}
                  >
                    {lanes.length === 0 && <div className="h-5" />}
                    {lanes.map((lane, li) => (
                      <div
                        key={li}
                        className="relative grid mb-0.5"
                        style={{ gridTemplateColumns: "repeat(7, 1fr)", height: "22px" }}
                      >
                        {lane.map(({ booking: b, startCol, endCol, isStart, isEnd }) => {
                          const colorCls = STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-700 border-gray-200";
                          const roundL = isStart  ? "rounded-l-full pl-2" : "rounded-l-none pl-1";
                          const roundR = isEnd    ? "rounded-r-full pr-2" : "rounded-r-none pr-1";
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

                  {/* Expanded booking card (click on bar to open) */}
                  {lanes.some(lane => lane.some(bar => bar.booking.id === expandedId)) && (() => {
                    const b = bookings.find(x => x.id === expandedId)!;
                    const ts = getRentalTimeStatus(b.startDate, b.endDate, b.status);
                    const badgeCls = STATUS_BADGE[b.status] ?? "bg-gray-100 text-gray-700 border-gray-200";
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
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${badgeCls}`}>
                                {b.status}
                              </span>
                            </div>
                            {b.businessName && (
                              <p className="text-xs text-gray-500 mt-0.5">{b.businessName}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">
                              {format(parseISO(b.startDate), "MMM d")} – {format(parseISO(b.endDate), "MMM d, yyyy")}
                            </p>
                            {ts && (
                              <span className={`mt-1 inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border ${ts.color}`}>
                                {ts.label}
                              </span>
                            )}
                            <div className="flex items-center justify-between mt-1.5">
                              <span className="font-semibold text-gray-800">${parseFloat(b.totalPrice).toFixed(2)}</span>
                              <div className="flex items-center gap-2">
                                {b.tenantSlug && (
                                  <button
                                    className="text-xs text-primary hover:underline flex items-center gap-1"
                                    onClick={() => window.open(`/${b.tenantSlug}`, "_blank")}
                                  >
                                    View company <ExternalLink className="h-3 w-3" />
                                  </button>
                                )}
                                <button onClick={() => setExpandedId(null)} className="text-xs text-gray-400 hover:text-gray-600">
                                  <X className="h-3.5 w-3.5" />
                                </button>
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

          {/* Legend */}
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
    </div>
  );
}

function SettingsTab({
  customer,
  updateCustomer,
  toast,
}: {
  customer: NonNullable<ReturnType<typeof useAuth>["customer"]>;
  updateCustomer: (c: NonNullable<ReturnType<typeof useAuth>["customer"]>) => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  return (
    <div className="space-y-5">
      <PersonalInfoSection customer={customer} updateCustomer={updateCustomer} toast={toast} />
      <BillingAddressSection customer={customer} updateCustomer={updateCustomer} toast={toast} />
      <PaymentMethodSection customer={customer} updateCustomer={updateCustomer} toast={toast} />
      <PasswordSection customer={customer} toast={toast} />
    </div>
  );
}

function PersonalInfoSection({ customer, updateCustomer, toast }: {
  customer: NonNullable<ReturnType<typeof useAuth>["customer"]>;
  updateCustomer: (c: any) => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [saving, setSaving] = useState(false);

  const isDirty = name !== customer.name || phone !== (customer.phone ?? "");

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const updated = await api.customers.updateProfile(customer.id, {
        name: name.trim(),
        phone: phone.trim() || undefined,
      });
      updateCustomer(updated);
      toast({ title: "Personal info saved", description: "Your name and phone have been updated." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-1">
        <User className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-gray-900">Personal Information</h2>
      </div>
      <p className="text-xs text-gray-400 mb-5">Your name and contact details visible to rental companies.</p>

      <div className="space-y-4">
        {/* Email — read only */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Email address
          </label>
          <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-500 cursor-default">
            {customer.email}
            <span className="ml-auto text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Read-only</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Email is your login and cannot be changed.</p>
        </div>

        {/* Full name */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> Full name
          </label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your full name"
            className="h-10"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" /> Phone number
          </label>
          <Input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="(555) 000-0000"
            className="h-10"
          />
        </div>
      </div>

      {isDirty && (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-white gap-2"
            size="sm"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Save Changes
          </Button>
        </div>
      )}
    </section>
  );
}

function BillingAddressSection({ customer, updateCustomer, toast }: {
  customer: NonNullable<ReturnType<typeof useAuth>["customer"]>;
  updateCustomer: (c: any) => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [address, setAddress] = useState(customer.billingAddress ?? "");
  const [city, setCity] = useState(customer.billingCity ?? "");
  const [state, setState] = useState(customer.billingState ?? "");
  const [zip, setZip] = useState(customer.billingZip ?? "");
  const [saving, setSaving] = useState(false);

  const isDirty =
    address !== (customer.billingAddress ?? "") ||
    city !== (customer.billingCity ?? "") ||
    state !== (customer.billingState ?? "") ||
    zip !== (customer.billingZip ?? "");

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.customers.updateProfile(customer.id, {
        billingAddress: address.trim() || undefined,
        billingCity: city.trim() || undefined,
        billingState: state.trim() || undefined,
        billingZip: zip.trim() || undefined,
      });
      updateCustomer(updated);
      toast({ title: "Billing address saved" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
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

      {isDirty && (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-white gap-2"
            size="sm"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Save Address
          </Button>
        </div>
      )}
    </section>
  );
}

function PaymentMethodSection({ customer, updateCustomer, toast }: {
  customer: NonNullable<ReturnType<typeof useAuth>["customer"]>;
  updateCustomer: (c: any) => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [removing, setRemoving] = useState(false);

  const hasCard = !!(customer.cardLastFour && customer.cardBrand);
  const brandLabel = customer.cardBrand
    ? customer.cardBrand.charAt(0).toUpperCase() + customer.cardBrand.slice(1)
    : "Card";

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const updated = await api.customers.removeCard(customer.id);
      updateCustomer(updated);
      toast({ title: "Card removed", description: "Your saved card has been removed." });
    } catch (err: any) {
      toast({ title: "Failed to remove card", description: err.message, variant: "destructive" });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-1">
        <CreditCard className="h-4 w-4 text-brand-blue" />
        <h2 className="font-semibold text-gray-900">Payment Method</h2>
      </div>
      <p className="text-xs text-gray-400 mb-5">
        Your card is saved automatically after your first booking and used for faster checkout on future rentals.
      </p>

      {hasCard ? (
        <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-14 rounded-lg bg-gradient-to-br from-brand-blue to-blue-700 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{brandLabel} •••• {customer.cardLastFour}</p>
              <p className="text-xs text-gray-400">Saved payment method</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={removing}
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

function PasswordSection({
  customer,
  toast,
}: {
  customer: NonNullable<ReturnType<typeof useAuth>["customer"]>;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = current.length > 0 && next.length >= 6 && next === confirm;

  const handleSave = async () => {
    if (next !== confirm) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    if (next.length < 6) { toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await api.customers.changePassword(customer.id, current, next);
      toast({ title: "Password changed", description: "You'll use your new password on next sign-in." });
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err: any) {
      toast({ title: "Password change failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
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
          {next.length > 0 && next.length < 6 && (
            <p className="text-[11px] text-red-500 mt-1">At least 6 characters required</p>
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Confirm new password</label>
          <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" className="h-10" />
          {confirm.length > 0 && next !== confirm && (
            <p className="text-[11px] text-red-500 mt-1">Passwords don't match</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="bg-gray-800 hover:bg-gray-900 text-white gap-2"
          size="sm"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
          Update Password
        </Button>
      </div>
    </section>
  );
}
