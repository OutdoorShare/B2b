import { adminPath } from "@/lib/admin-nav";
import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import type { DateRange } from "react-day-picker";
import {
  useGetListing,
  useGetBookings,
  getGetListingQueryKey,
  getGetBookingsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Edit, ExternalLink, Package, Tag, DollarSign,
  CalendarDays, TrendingUp, Wrench,
  Check, ChevronRight, Ban, Trash2, CalendarOff,
  ShieldCheck, Users, Search, X, Clock,
} from "lucide-react";
import { format, addDays, startOfDay, isAfter } from "date-fns";
import { UnitIdentifiersManager } from "@/components/unit-identifiers-manager";
import { ListingRulesManager } from "@/components/listing-rules-manager";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Addon = {
  id: number;
  name: string;
  price: number;
  priceType: "flat" | "per_day";
  isRequired: boolean;
  isActive: boolean;
};

const STATUS_COLORS: Record<string, string> = {
  active:   "bg-green-100 text-green-800",
  draft:    "bg-muted text-muted-foreground",
  inactive: "bg-red-100 text-red-800",
};

const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  active:    "bg-green-100 text-green-800",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-red-100 text-red-800",
};

export default function AdminListingDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ slug: string; id: string }>();
  const id = params?.id ? parseInt(params.id) : 0;

  const { toast } = useToast();
  const [activeImage, setActiveImage] = useState(0);
  const [addons, setAddons] = useState<Addon[]>([]);

  // Bookings filter state
  type BookingTab = "all" | "upcoming" | "recent" | "cancelled";
  const [bookingTab, setBookingTab] = useState<BookingTab>("recent");
  const [bookingSearch, setBookingSearch] = useState("");

  // Blocked dates state
  type BlockedDate = { id: number; startDate: string; endDate: string; reason: string | null };
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [blockRange, setBlockRange] = useState<DateRange | undefined>(undefined);
  const [blockReason, setBlockReason] = useState("");
  const [blockSaving, setBlockSaving] = useState(false);

  const { data: listing, isLoading } = useGetListing(id, {
    query: { enabled: !!id, queryKey: getGetListingQueryKey(id) },
  });

  const { data: allBookings } = useGetBookings(
    { listingId: id },
    { query: { enabled: !!id, queryKey: getGetBookingsQueryKey({ listingId: id }) } }
  );

  useEffect(() => {
    if (!id) return;
    fetch(`${BASE}/api/listings/${id}/addons`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setAddons(d); })
      .catch(() => {});
  }, [id]);

  const fetchBlockedDates = () => {
    if (!id) return;
    fetch(`${BASE}/api/listings/${id}/blocked-dates`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setBlockedDates(d); })
      .catch(() => {});
  };
  useEffect(fetchBlockedDates, [id]);

  const handleBlockSave = async () => {
    if (!blockRange?.from || !blockRange?.to) {
      toast({ title: "Select a date range to block", variant: "destructive" }); return;
    }
    setBlockSaving(true);
    try {
      const res = await fetch(`${BASE}/api/listings/${id}/blocked-dates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: format(blockRange.from, "yyyy-MM-dd"),
          endDate: format(blockRange.to, "yyyy-MM-dd"),
          reason: blockReason || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Dates blocked successfully" });
      setBlockRange(undefined);
      setBlockReason("");
      fetchBlockedDates();
    } catch {
      toast({ title: "Failed to block dates", variant: "destructive" });
    } finally {
      setBlockSaving(false);
    }
  };

  const handleBlockDelete = async (blockId: number) => {
    try {
      const res = await fetch(`${BASE}/api/listings/blocked-dates/${blockId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast({ title: "Block removed" });
      setBlockedDates(prev => prev.filter(b => b.id !== blockId));
    } catch {
      toast({ title: "Failed to remove block", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-64" />
        <div className="h-80 bg-muted rounded-2xl" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="p-6 max-w-6xl mx-auto py-24 text-center text-muted-foreground">
        <Package className="w-10 h-10 mx-auto mb-3 text-muted" />
        <p className="font-semibold">Listing not found</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation(adminPath("/listings"))}>Back to Listings</Button>
      </div>
    );
  }

  const bookings = allBookings ?? [];
  const completedBookings = bookings.filter(b => b.status === "completed" || b.status === "active");
  const revenue = bookings
    .filter(b => b.status !== "cancelled")
    .reduce((s, b) => s + (typeof b.totalPrice === "number" ? b.totalPrice : parseFloat(String(b.totalPrice ?? "0"))), 0);
  const recentBookings = [...bookings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  const activeAddonCount = addons.filter(a => a.isActive).length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation(adminPath("/listings"))} className="-ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold leading-tight">{listing.title}</h1>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[listing.status ?? "draft"] ?? "bg-muted text-muted-foreground"}`}>
                {listing.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {listing.categoryName || "Uncategorized"} · ID #{listing.id}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/listings/${listing.id}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <ExternalLink className="w-4 h-4" /> View on Storefront
            </Button>
          </Link>
          <Link href={adminPath(`/listings/${listing.id}/edit`)}>
            <Button size="sm" className="gap-1.5">
              <Edit className="w-4 h-4" /> Edit Listing
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Bookings", value: bookings.length, icon: CalendarDays, color: "text-blue-600" },
          { label: "Revenue",        value: `$${revenue.toFixed(2)}`, icon: DollarSign, color: "text-green-600" },
          { label: "Completed",      value: completedBookings.length, icon: TrendingUp, color: "text-primary" },
          { label: "Add-ons",        value: activeAddonCount, icon: Tag, color: "text-purple-600" },
        ].map(m => (
          <div key={m.label} className="bg-background rounded-xl border p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <m.icon className={`w-3.5 h-3.5 ${m.color}`} />
              {m.label}
            </div>
            <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Main content: 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* LEFT: Photos + Details */}
        <div className="lg:col-span-3 space-y-5">

          {/* Photo gallery */}
          <div className="bg-background rounded-2xl border overflow-hidden">
            <div className="aspect-[16/9] w-full bg-muted relative">
              {listing.imageUrls?.[activeImage] ? (
                <img src={listing.imageUrls[activeImage]} alt={listing.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Package className="w-12 h-12 text-muted" />
                </div>
              )}
            </div>
            {listing.imageUrls && listing.imageUrls.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto">
                {listing.imageUrls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`shrink-0 w-16 aspect-square rounded-lg overflow-hidden border-2 transition-all
                      ${i === activeImage ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          {listing.description && (
            <div className="bg-background rounded-2xl border p-5 space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" /> Description
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{listing.description}</p>
            </div>
          )}

          {/* Specifications */}
          <div className="bg-background rounded-2xl border p-5 space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Wrench className="w-4 h-4 text-primary" /> Specifications
            </h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ["Brand", listing.brand],
                ["Model", listing.model],
                ["Condition", listing.condition],
                ["Weight", listing.weight],
                ["Dimensions", listing.dimensions],
                ["Category", listing.categoryName],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label as string} className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</dt>
                  <dd className="font-semibold capitalize">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Included items */}
          {listing.includedItems && listing.includedItems.length > 0 && (
            <div className="bg-background rounded-2xl border p-5 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" /> Included Items
              </h3>
              <ul className="grid grid-cols-2 gap-1.5">
                {listing.includedItems.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* RIGHT: Business info + bookings */}
        <div className="lg:col-span-2 space-y-5">

          {/* Pricing */}
          <div className="bg-background rounded-2xl border p-5 space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" /> Pricing & Inventory
            </h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Per day</span>
                <span className="font-bold text-base">${parseFloat(String(listing.pricePerDay)).toFixed(2)}</span>
              </div>
              {listing.pricePerWeek && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Per week</span>
                  <span className="font-semibold">${parseFloat(String(listing.pricePerWeek)).toFixed(2)}</span>
                </div>
              )}
              {listing.depositAmount && Number(listing.depositAmount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Security deposit</span>
                  <span className="font-semibold">${parseFloat(String(listing.depositAmount)).toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total quantity</span>
                <span className="font-semibold">{listing.totalQuantity ?? 1}</span>
              </div>
              {listing.availableQuantity !== undefined && listing.availableQuantity !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available now</span>
                  <span className={`font-semibold ${(listing.availableQuantity ?? 0) === 0 ? "text-destructive" : "text-green-600"}`}>
                    {listing.availableQuantity}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Requirements */}
          <div className="bg-background rounded-2xl border p-5 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" /> Requirements
            </h3>
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Minimum age: <strong>21+</strong> <span className="text-xs text-muted-foreground ml-1">(Platform Policy)</span></span>
            </div>
            {listing.requirements && (
              <p className="text-sm text-muted-foreground">{listing.requirements}</p>
            )}
          </div>

          {/* Rules & Violations */}
          <ListingRulesManager listingId={listing.id} />

          {/* Unit Identifiers */}
          <UnitIdentifiersManager listingId={listing.id} quantity={listing.quantity} />

          {/* Add-ons */}
          <div className="bg-background rounded-2xl border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" /> Add-ons
              </h3>
              <Link href={adminPath(`/listings/${listing.id}/edit`)}>
                <button className="text-xs text-primary hover:underline">Manage</button>
              </Link>
            </div>
            {addons.length === 0 ? (
              <p className="text-sm text-muted-foreground">No add-ons configured.</p>
            ) : (
              <div className="space-y-2">
                {addons.map(a => (
                  <div key={a.id} className={`flex items-center justify-between text-sm ${!a.isActive ? "opacity-40" : ""}`}>
                    <div className="flex items-center gap-1.5">
                      <span>{a.name}</span>
                      {a.isRequired && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 rounded-full font-semibold">Required</span>}
                      {!a.isActive && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 rounded-full">Hidden</span>}
                    </div>
                    <span className="font-semibold text-primary">
                      ${a.price.toFixed(2)}{a.priceType === "per_day" ? "/day" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bookings quick link */}
          <div className="bg-background rounded-2xl border p-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Bookings</span>
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-semibold">{bookings.length}</span>
            </div>
            <Link href={adminPath(`/bookings?listingId=${listing.id}`)}>
              <button className="text-xs text-primary hover:underline flex items-center gap-1">View all <ChevronRight className="w-3 h-3" /></button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Bookings Panel ──────────────────────────────────────────────────── */}
      {(() => {
        const today = startOfDay(new Date());

        const tabFiltered = (() => {
          const all = [...bookings];
          if (bookingTab === "upcoming") {
            return all
              .filter(b => b.status !== "cancelled" && isAfter(startOfDay(new Date(b.startDate)), today) || startOfDay(new Date(b.startDate)).getTime() === today.getTime() && b.status !== "cancelled")
              .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
          }
          if (bookingTab === "recent") {
            return all
              .filter(b => b.status !== "cancelled")
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          }
          if (bookingTab === "cancelled") {
            return all
              .filter(b => b.status === "cancelled")
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          }
          // all
          return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        })();

        const q = bookingSearch.trim().toLowerCase();
        const displayed = q
          ? tabFiltered.filter(b =>
              (b.customerName ?? "").toLowerCase().includes(q) ||
              (b.customerEmail ?? "").toLowerCase().includes(q) ||
              (b.startDate ?? "").includes(q) ||
              (b.endDate ?? "").includes(q) ||
              (b.status ?? "").includes(q) ||
              String(b.id).includes(q)
            )
          : tabFiltered;

        const TABS: { key: BookingTab; label: string; count: number }[] = [
          { key: "recent",    label: "Recent",    count: bookings.filter(b => b.status !== "cancelled").length },
          { key: "upcoming",  label: "Upcoming",  count: bookings.filter(b => b.status !== "cancelled" && !isAfter(today, startOfDay(new Date(b.startDate))) ).length },
          { key: "cancelled", label: "Cancelled", count: bookings.filter(b => b.status === "cancelled").length },
          { key: "all",       label: "All",       count: bookings.length },
        ];

        return (
          <div className="bg-background rounded-2xl border overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <CalendarDays className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">Bookings</h3>
              </div>
              {/* Tabs */}
              <div className="flex items-center gap-1 flex-wrap">
                {TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setBookingTab(t.key)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                      bookingTab === t.key
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {t.label}
                    <span className={`text-[10px] px-1.5 py-px rounded-full ${bookingTab === t.key ? "bg-primary-foreground/20 text-primary-foreground" : "bg-background text-muted-foreground"}`}>
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>
              {/* Search */}
              <div className="relative sm:ml-auto w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                  value={bookingSearch}
                  onChange={e => setBookingSearch(e.target.value)}
                  placeholder="Search by name, date, status…"
                  className="w-full h-8 pl-8 pr-8 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {bookingSearch && (
                  <button
                    onClick={() => setBookingSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Booking rows */}
            <div className="divide-y">
              {displayed.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <CalendarDays className="w-8 h-8 mx-auto mb-2 text-muted" />
                  <p className="text-sm font-medium">
                    {bookingSearch ? "No bookings match your search" : "No bookings in this view"}
                  </p>
                </div>
              ) : (
                displayed.map(b => {
                  const price = typeof b.totalPrice === "number" ? b.totalPrice : parseFloat(String(b.totalPrice ?? "0"));
                  const isUpcoming = !isAfter(today, startOfDay(new Date(b.startDate)));
                  return (
                    <Link key={b.id} href={adminPath(`/bookings/${b.id}`)}>
                      <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors cursor-pointer group">
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4 text-primary" />
                        </div>
                        {/* Customer + dates */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{b.customerName || "—"}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 shrink-0" />
                            {b.startDate} → {b.endDate}
                          </p>
                        </div>
                        {/* Upcoming badge */}
                        {isUpcoming && b.status !== "cancelled" && (
                          <span className="hidden sm:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                            Upcoming
                          </span>
                        )}
                        {/* Status */}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0 ${BOOKING_STATUS_COLORS[b.status] ?? "bg-muted text-muted-foreground"}`}>
                          {b.status}
                        </span>
                        {/* Price */}
                        <span className="text-sm font-bold shrink-0 w-20 text-right">${price.toFixed(2)}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                      </div>
                    </Link>
                  );
                })
              )}
            </div>

            {/* Footer count */}
            {displayed.length > 0 && (
              <div className="px-5 py-2.5 border-t bg-muted/10 text-xs text-muted-foreground text-right">
                {displayed.length} booking{displayed.length !== 1 ? "s" : ""}{bookingSearch ? ` matching "${bookingSearch}"` : ""}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Availability Management ─────────────────────────────────────────── */}
      {(() => {
        // Build disabled sets for the calendar preview
        const bookedDays: Date[] = [];
        const allBookings2 = allBookings ?? [];
        allBookings2.filter(b => b.status !== "cancelled" && b.status !== "rejected").forEach(b => {
          let cur = startOfDay(new Date(b.startDate));
          const last = startOfDay(new Date(b.endDate));
          while (!isAfter(cur, last)) { bookedDays.push(new Date(cur)); cur = addDays(cur, 1); }
        });

        const blockedDays: Date[] = [];
        blockedDates.forEach(b => {
          let cur = startOfDay(new Date(b.startDate));
          const last = startOfDay(new Date(b.endDate));
          while (!isAfter(cur, last)) { blockedDays.push(new Date(cur)); cur = addDays(cur, 1); }
        });

        const blockDays = blockRange?.from && blockRange?.to ? (() => {
          const days: Date[] = [];
          let cur = startOfDay(blockRange.from);
          const last = startOfDay(blockRange.to);
          while (!isAfter(cur, last)) { days.push(new Date(cur)); cur = addDays(cur, 1); }
          return days;
        })() : [];

        return (
          <div className="bg-background rounded-2xl border overflow-hidden">
            {/* Section header */}
            <div className="px-5 py-4 border-b flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2">
                <CalendarOff className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">Availability Management</h3>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-300 inline-block" /> Customer bookings</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300 inline-block" /> Blocked by you</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-200 border border-amber-400 inline-block" /> Selecting</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x">

              {/* Left: Calendar overview + selector */}
              <div className="p-5 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Select a date range below to block it. Blocked dates will appear as unavailable to renters.
                </p>
                <div className="flex justify-center">
                  <Calendar
                    mode="range"
                    selected={blockRange}
                    onSelect={setBlockRange}
                    numberOfMonths={2}
                    disabled={[{ before: new Date() }]}
                    modifiers={{
                      booked: bookedDays,
                      blocked: blockedDays,
                      selecting: blockDays,
                    }}
                    modifiersClassNames={{
                      booked: "!bg-blue-100 !text-blue-700 rounded",
                      blocked: "!bg-red-100 !text-red-600 !line-through rounded",
                      selecting: "!bg-amber-100 !text-amber-800 rounded",
                    }}
                    className="rounded-xl"
                  />
                </div>

                {/* Block form */}
                {blockRange?.from && (
                  <div className="border rounded-xl p-4 space-y-3 bg-muted/20">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <Ban className="w-4 h-4 text-red-500" />
                      Block {blockRange.to
                        ? `${format(blockRange.from, "MMM d")} – ${format(blockRange.to, "MMM d, yyyy")}`
                        : format(blockRange.from, "MMM d, yyyy")}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="block-reason" className="text-xs">Reason (optional)</Label>
                      <Input
                        id="block-reason"
                        value={blockReason}
                        onChange={e => setBlockReason(e.target.value)}
                        placeholder="e.g. Maintenance, personal use…"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1.5"
                        disabled={!blockRange?.to || blockSaving}
                        onClick={handleBlockSave}
                      >
                        <Ban className="w-3.5 h-3.5" /> {blockSaving ? "Saving…" : "Block These Dates"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setBlockRange(undefined); setBlockReason(""); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Current blocked dates list */}
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Ban className="w-4 h-4 text-red-500" /> Blocked Periods
                    {blockedDates.length > 0 && (
                      <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{blockedDates.length}</span>
                    )}
                  </h4>
                </div>

                {blockedDates.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground space-y-2">
                    <CalendarDays className="w-8 h-8 mx-auto text-muted" />
                    <p className="text-sm">No dates blocked.</p>
                    <p className="text-xs">Select a range on the calendar to block dates for this listing.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...blockedDates].sort((a, b) => a.startDate.localeCompare(b.startDate)).map(block => (
                      <div key={block.id} className="flex items-start justify-between gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Ban className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            <p className="font-semibold text-sm">
                              {format(new Date(block.startDate), "MMM d, yyyy")}
                              {block.startDate !== block.endDate && (
                                <> → {format(new Date(block.endDate), "MMM d, yyyy")}</>
                              )}
                            </p>
                          </div>
                          {block.reason && (
                            <p className="text-xs text-muted-foreground mt-0.5 pl-5">{block.reason}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-100 shrink-0"
                          onClick={() => handleBlockDelete(block.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upcoming confirmed bookings summary */}
                {allBookings2.filter(b => b.status === "confirmed" || b.status === "pending").length > 0 && (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Bookings on Calendar</h4>
                    {allBookings2
                      .filter(b => b.status === "confirmed" || b.status === "pending" || b.status === "active")
                      .slice(0, 4)
                      .map(b => (
                        <div key={b.id} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                          <div className="flex items-center gap-2 text-xs">
                            <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
                            <span className="font-medium">{b.customerName}</span>
                            <span className="text-muted-foreground">{b.startDate} → {b.endDate}</span>
                          </div>
                          <Link href={adminPath(`/bookings/${b.id}`)}>
                            <span className="text-[10px] font-bold text-blue-600 hover:underline capitalize">{b.status}</span>
                          </Link>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
