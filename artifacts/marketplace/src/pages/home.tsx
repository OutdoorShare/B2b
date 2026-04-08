import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ListingCard } from "@/components/listing-card";
import { MapView } from "@/components/map-view";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  format, parseISO, differenceInCalendarDays,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, isSameDay, isBefore, isAfter, isToday,
  eachDayOfInterval, startOfDay,
} from "date-fns";
import {
  Search, SlidersHorizontal, X, LayoutGrid, Map,
  Waves, Bus, Truck, Car, Anchor, Bike, Zap,
  Package, Snowflake, CarFront, Gauge, Tent,
  CalendarDays, ChevronLeft, ChevronRight,
} from "lucide-react";

// ── Inline range-selection calendar ──────────────────────────────────────────
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function InlineRangePicker({
  startDate,
  endDate,
  onStart,
  onEnd,
}: {
  startDate: string;
  endDate: string;
  onStart: (d: string) => void;
  onEnd: (d: string) => void;
}) {
  const today = startOfDay(new Date());
  const [month, setMonth] = useState<Date>(() => {
    if (startDate) return startOfMonth(parseISO(startDate));
    return startOfMonth(today);
  });

  // Build the 6-week grid for the current month
  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd   = endOfWeek(endOfMonth(month));
  const days      = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const startD = startDate ? startOfDay(parseISO(startDate)) : null;
  const endD   = endDate   ? startOfDay(parseISO(endDate))   : null;

  function handleDayClick(day: Date) {
    if (isBefore(day, today)) return; // past dates disabled

    const dayStr = format(day, "yyyy-MM-dd");

    if (!startD) {
      // No start set yet → set start
      onStart(dayStr);
      onEnd("");
      return;
    }
    if (startD && !endD) {
      if (isSameDay(day, startD)) {
        // Clicking start again → clear
        onStart(""); onEnd(""); return;
      }
      if (isBefore(day, startD)) {
        // Picked before current start → new start
        onStart(dayStr); onEnd(""); return;
      }
      // Set end
      onEnd(dayStr);
      return;
    }
    // Both set → reset and start fresh
    onStart(dayStr);
    onEnd("");
  }

  function dayState(day: Date): "start" | "end" | "range" | "today" | "past" | "normal" {
    if (isBefore(day, today)) return "past";
    if (startD && isSameDay(day, startD)) return "start";
    if (endD   && isSameDay(day, endD))   return "end";
    if (startD && endD && isAfter(day, startD) && isBefore(day, endD)) return "range";
    if (isToday(day)) return "today";
    return "normal";
  }

  const headerLabel = format(month, "MMMM yyyy");

  return (
    <div className="select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setMonth(m => subMonths(m, 1))}
          className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-gray-500" />
        </button>
        <p className="text-sm font-semibold text-gray-800">{headerLabel}</p>
        <button
          onClick={() => setMonth(m => addMonths(m, 1))}
          className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-0.5">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day, i) => {
          const state  = dayState(day);
          const inMonth = day.getMonth() === month.getMonth();
          const isStart = state === "start";
          const isEnd   = state === "end";
          const isRange = state === "range";
          const isPast  = state === "past";

          return (
            <div
              key={i}
              className={`relative flex items-center justify-center ${
                isRange ? "bg-primary/10" : ""
              } ${
                isStart && endD ? "rounded-l-full" : ""
              } ${
                isEnd && startD ? "rounded-r-full" : ""
              } ${
                isRange && i % 7 === 0 ? "rounded-l-full" : ""
              } ${
                isRange && i % 7 === 6 ? "rounded-r-full" : ""
              }`}
            >
              <button
                disabled={isPast}
                onClick={() => handleDayClick(day)}
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium transition-all
                  ${isPast ? "text-gray-200 cursor-not-allowed" : ""}
                  ${!inMonth && !isPast ? "text-gray-300" : ""}
                  ${inMonth && !isPast && state === "normal" ? "text-gray-700 hover:bg-primary/15" : ""}
                  ${state === "today" ? "text-primary font-bold ring-1 ring-primary/40" : ""}
                  ${isStart || isEnd ? "bg-primary text-white shadow-sm" : ""}
                  ${isRange ? "hover:bg-primary/20 text-primary/80" : ""}
                `}
              >
                {format(day, "d")}
              </button>
            </div>
          );
        })}
      </div>

      {/* Range hint */}
      <p className="text-[10px] text-gray-400 text-center mt-2">
        {!startD
          ? "Click a date to set pick-up"
          : !endD
          ? "Now click a date to set drop-off"
          : `${format(startD, "MMM d")} → ${format(endD, "MMM d")} · ${differenceInCalendarDays(endD, startD)} night${differenceInCalendarDays(endD, startD) !== 1 ? "s" : ""}`}
      </p>
    </div>
  );
}

// Matches category slugs exactly as stored in the DB — same map as the storefront
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "jet-ski": Waves,
  "rv": Bus,
  "camper": Tent,
  "atv": Truck,
  "utv": Car,
  "boat": Anchor,
  "dirt-bike": Bike,
  "ebike": Zap,
  "utility-trailer": Package,
  "snowmobile": Snowflake,
  "towing-vehicle": CarFront,
};

function getCategoryIcon(slug: string): React.ElementType {
  return CATEGORY_ICONS[slug] || Gauge;
}

// Today's date as yyyy-MM-dd for the min attribute on date inputs
const todayStr = format(new Date(), "yyyy-MM-dd");

export function HomePage({ onAuthOpen }: { onAuthOpen: () => void }) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // When startDate changes, clear endDate if it's before startDate
  useEffect(() => {
    if (startDate && endDate && endDate <= startDate) setEndDate("");
  }, [startDate]);

  const params: Record<string, string> = {};
  if (debouncedSearch) params.search = debouncedSearch;
  if (selectedCategory) params.categoryId = selectedCategory;
  if (minPrice) params.minPrice = minPrice;
  if (maxPrice) params.maxPrice = maxPrice;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  const { data: listings, isLoading } = useQuery({
    queryKey: ["marketplace-listings", params],
    queryFn: () => api.marketplace.listings(params),
    staleTime: 30_000,
  });

  const { data: categories } = useQuery({
    queryKey: ["marketplace-categories"],
    queryFn: api.marketplace.categories,
    staleTime: 60_000,
  });

  const { data: stats } = useQuery({
    queryKey: ["marketplace-stats"],
    queryFn: api.marketplace.stats,
    staleTime: 60_000,
  });

  const activeCats = (categories ?? []).filter(cat => (cat as any).listingCount > 0);

  const handleCategoryClick = (id: string | null, name: string | null) => {
    setSelectedCategory(id);
    setSelectedCategoryName(name);
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedCategory(null);
    setSelectedCategoryName(null);
    setMinPrice("");
    setMaxPrice("");
    setStartDate("");
    setEndDate("");
  };

  const clearDates = () => {
    setStartDate("");
    setEndDate("");
  };

  const hasDateFilter = !!startDate;
  const hasFilters = !!debouncedSearch || !!selectedCategory || !!minPrice || !!maxPrice || hasDateFilter;

  // Human-readable date chip label
  const dateBtnLabel = (() => {
    if (!startDate) return null;
    const s = format(parseISO(startDate), "MMM d");
    if (!endDate) return s;
    const e = format(parseISO(endDate), "MMM d");
    const nights = differenceInCalendarDays(parseISO(endDate), parseISO(startDate));
    return `${s} → ${e} (${nights}n)`;
  })();

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div
        className="text-white relative"
        style={{
          backgroundImage: "url('/marketplace/hero-cover.png')",
          backgroundSize: "cover",
          backgroundPosition: "center 40%",
          marginTop: "-80px",
        }}
      >
        {/* Dark overlay for text legibility */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.60) 0%, rgba(0,0,0,0.38) 55%, rgba(0,0,0,0.55) 100%)" }} />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-[152px] pb-10">
          {/* Headline */}
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-3 leading-tight">
              Your adventure starts here.
            </h1>
            <p className="text-white/75 text-lg mb-8">
              Find the perfect outdoor experience today!
            </p>

            {/* ── SEARCH + FILTER ROW ── */}
            <div className="max-w-2xl mx-auto">
              <div className="flex gap-2 mb-3">
                {/* Search input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    placeholder={selectedCategoryName ? `Search ${selectedCategoryName}…` : "Search jet skis, ATVs, campers…"}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-11 h-12 text-base bg-white text-gray-900 border-0 shadow-xl rounded-xl"
                  />
                </div>

                {/* Filter toggle */}
                <Button
                  size="lg"
                  variant="outline"
                  className={`h-12 px-4 rounded-xl border-0 shadow-xl transition-all ${
                    showFilters
                      ? "bg-white text-primary"
                      : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                  }`}
                  onClick={() => setShowFilters(v => !v)}
                  title="Filters"
                >
                  <SlidersHorizontal className="h-5 w-5" />
                </Button>
              </div>

              {/* Combined filter panel — dates + price */}
              {showFilters && (
                <div className="bg-white/97 backdrop-blur-md rounded-2xl p-4 shadow-2xl text-left mb-3 border border-white/30 space-y-4">

                  {/* Date range */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <CalendarDays className="h-3.5 w-3.5 text-primary" />
                      <p className="text-xs font-semibold text-gray-700">Availability</p>
                      {hasDateFilter && (
                        <button onClick={clearDates} className="ml-auto text-xs text-gray-400 hover:text-red-500 flex items-center gap-0.5 transition-colors">
                          <X className="h-3 w-3" /> Clear dates
                        </button>
                      )}
                    </div>

                    {/* Visual calendar */}
                    <InlineRangePicker
                      startDate={startDate}
                      endDate={endDate}
                      onStart={setStartDate}
                      onEnd={setEndDate}
                    />

                    {/* Date text inputs */}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div>
                        <label className="block text-[10px] text-gray-400 font-medium mb-1 uppercase tracking-wide">Pick-up date</label>
                        <input
                          type="date"
                          value={startDate}
                          min={todayStr}
                          onChange={e => { setStartDate(e.target.value); if (endDate && e.target.value >= endDate) setEndDate(""); }}
                          className="w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-400 font-medium mb-1 uppercase tracking-wide">Drop-off date</label>
                        <input
                          type="date"
                          value={endDate}
                          min={startDate || todayStr}
                          onChange={e => setEndDate(e.target.value)}
                          disabled={!startDate}
                          className="w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-100" />

                  {/* Price range */}
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">Price per day</p>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        placeholder="Min $"
                        value={minPrice}
                        onChange={e => setMinPrice(e.target.value)}
                        className="w-28 h-9 text-gray-900"
                      />
                      <span className="text-gray-400 text-sm">–</span>
                      <Input
                        type="number"
                        placeholder="Max $"
                        value={maxPrice}
                        onChange={e => setMaxPrice(e.target.value)}
                        className="w-28 h-9 text-gray-900"
                      />
                      {(minPrice || maxPrice) && (
                        <button onClick={() => { setMinPrice(""); setMaxPrice(""); }} className="text-gray-400 hover:text-red-500 ml-1">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Stats */}
            {stats && (
              <div className="flex gap-6 justify-center mt-4 mb-10 text-white/65 text-sm">
                <span><strong className="text-white">{stats.listings.toLocaleString()}</strong> {stats.listings === 1 ? "listing" : "listings"}</span>
                <span><strong className="text-[hsl(197,100%,75%)]">{stats.companies.toLocaleString()}</strong> companies</span>
                <span><strong className="text-[hsl(197,100%,75%)]">{stats.customers.toLocaleString()}</strong> renters</span>
              </div>
            )}

            {/* ── CATEGORY CIRCLES ─────────────────────────────── */}
            {activeCats.length > 0 && (
              <div className="flex flex-wrap justify-center gap-4 pb-6">
                {/* All */}
                <button
                  onClick={() => handleCategoryClick(null, null)}
                  className="flex flex-col items-center gap-1.5 transition-all"
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                    !selectedCategory
                      ? "bg-white/25 ring-2 ring-white shadow-lg shadow-black/20 scale-110"
                      : "bg-black/40 backdrop-blur border border-white/15 hover:bg-black/55 hover:scale-105"
                  }`}>
                    <Gauge className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-white text-xs font-semibold drop-shadow-sm">All</span>
                </button>

                {activeCats.map(cat => {
                  const Icon = getCategoryIcon(cat.slug);
                  const isActive = selectedCategory === cat.id.toString();
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleCategoryClick(
                        isActive ? null : cat.id.toString(),
                        isActive ? null : cat.name
                      )}
                      className="flex flex-col items-center gap-1.5 transition-all"
                    >
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                        isActive
                          ? "bg-white/25 ring-2 ring-white shadow-lg shadow-black/20 scale-110"
                          : "bg-black/40 backdrop-blur border border-white/15 hover:bg-black/55 hover:scale-105"
                      }`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-white text-xs font-semibold drop-shadow-sm whitespace-nowrap">
                        {cat.name}
                        <span className="ml-1 opacity-60">({(cat as any).listingCount})</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── ACTIVE FILTER STRIP ──────────────────────────────── */}
      {hasFilters && (
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm text-gray-600">
                {isLoading ? "Searching…" : `${listings?.length ?? 0} ${selectedCategoryName ?? "listing"}${(listings?.length ?? 0) !== 1 ? "s" : ""}`}
                {debouncedSearch ? ` matching "${debouncedSearch}"` : ""}
              </p>
              {/* Active filter chips */}
              {hasDateFilter && (
                <span className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-semibold border border-primary/20">
                  <CalendarDays className="h-3 w-3" />
                  {dateBtnLabel}
                  <button onClick={clearDates} className="hover:text-red-500 transition-colors ml-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {(minPrice || maxPrice) && (
                <span className="flex items-center gap-1.5 bg-gray-100 text-gray-700 rounded-full px-2.5 py-0.5 text-xs font-semibold border border-gray-200">
                  {minPrice && maxPrice ? `$${minPrice}–$${maxPrice}/day` : minPrice ? `From $${minPrice}/day` : `Up to $${maxPrice}/day`}
                </span>
              )}
            </div>
            <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition-colors">
              <X className="h-3.5 w-3.5" /> Clear all
            </button>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Results header + Grid/Map toggle */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-gray-500">
            {isLoading ? "Loading…" : `${listings?.length ?? 0} ${(listings?.length ?? 0) === 1 ? "listing" : "listings"}`}
            {hasFilters && " matching your filters"}
          </p>
          <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5 shadow-sm">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === "grid" ? "bg-primary text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Grid
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === "map" ? "bg-primary text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Map className="h-4 w-4" />
              Map
            </button>
          </div>
        </div>

        {/* Map view */}
        {viewMode === "map" && !isLoading && listings && (
          <MapView listings={listings as any} />
        )}

        {/* Grid view */}
        {viewMode === "grid" && (
          isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
                  <div className="h-48 bg-gray-200" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                    <div className="h-6 bg-gray-200 rounded w-1/3 mt-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : listings && listings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {listings.map(listing => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              {hasDateFilter ? (
                <>
                  <CalendarDays className="h-12 w-12 text-gray-200 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No listings available for those dates</h3>
                  <p className="text-gray-400 mb-4">Try different dates or browse without a date filter.</p>
                  <Button variant="outline" onClick={clearDates}>Clear dates</Button>
                </>
              ) : (
                <>
                  <div className="text-5xl mb-4">🔍</div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No listings found</h3>
                  <p className="text-gray-400 mb-4">Try a different category or clear your filters</p>
                  {hasFilters && (
                    <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
                  )}
                </>
              )}
            </div>
          )
        )}

        {/* CTA */}
        <div
          className="mt-16 rounded-2xl p-8 text-center text-white"
          style={{ background: "linear-gradient(135deg, hsl(127,55%,20%) 0%, hsl(127,55%,30%) 100%)" }}
        >
          <h2 className="text-2xl font-bold mb-2">One account, every company</h2>
          <p className="text-white/80 mb-6">
            Create a free renter account to book across all OutdoorShare companies, track your rentals, and get receipts in one place.
          </p>
          <Button onClick={onAuthOpen} size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold">
            Create Free Account
          </Button>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-gray-400 pb-8">
          <span>Powered by </span>
          <a href="/" className="font-semibold hover:underline text-primary">OutdoorShare</a>
          <span> · </span>
          <a href="/docs/" className="hover:underline">Docs</a>
        </div>
      </div>
    </div>
  );
}
