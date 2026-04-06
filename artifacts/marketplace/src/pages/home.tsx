import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ListingCard } from "@/components/listing-card";
import { MapView } from "@/components/map-view";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, SlidersHorizontal, X, LayoutGrid, Map,
  Waves, Bus, Truck, Car, Anchor, Bike, Zap,
  Package, Snowflake, CarFront, Gauge, Tent,
} from "lucide-react";

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

export function HomePage({ onAuthOpen }: { onAuthOpen: () => void }) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const params: Record<string, string> = {};
  if (debouncedSearch) params.search = debouncedSearch;
  if (selectedCategory) params.categoryId = selectedCategory;
  if (minPrice) params.minPrice = minPrice;
  if (maxPrice) params.maxPrice = maxPrice;

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
  };

  const hasFilters = !!debouncedSearch || !!selectedCategory || !!minPrice || !!maxPrice;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div
        className="text-white"
        style={{ background: "linear-gradient(135deg, hsl(127,55%,16%) 0%, hsl(127,55%,28%) 60%, hsl(127,55%,34%) 100%)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10">
          {/* Headline */}
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-3 leading-tight">
              Rent outdoor gear from local companies
            </h1>
            <p className="text-white/75 text-lg mb-8">
              Browse listings from verified outdoor rental companies — one account, every adventure.
            </p>

            {/* Search bar */}
            <div className="max-w-2xl mx-auto">
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    placeholder={selectedCategoryName ? `Search ${selectedCategoryName}…` : "Search jet skis, ATVs, campers…"}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-11 h-12 text-base bg-white text-gray-900 border-0 shadow-xl rounded-xl"
                  />
                </div>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-4 bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl"
                  onClick={() => setShowFilters(v => !v)}
                  title="Price filters"
                >
                  <SlidersHorizontal className="h-5 w-5" />
                </Button>
              </div>

              {/* Price filters */}
              {showFilters && (
                <div className="bg-white/95 backdrop-blur-md rounded-xl p-4 shadow-xl text-left mb-3 border border-white/20">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Price per day</p>
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
                      <button onClick={() => { setMinPrice(""); setMaxPrice(""); }} className="text-xs text-white/70 hover:text-white ml-1">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
            {stats && (
              <div className="flex gap-6 justify-center mt-4 mb-10 text-white/65 text-sm">
                <span><strong className="text-white">{stats.listings.toLocaleString()}</strong> listings</span>
                <span><strong className="text-white">{stats.companies.toLocaleString()}</strong> companies</span>
                <span><strong className="text-white">{stats.customers.toLocaleString()}</strong> renters</span>
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {isLoading ? "Loading…" : `${listings?.length ?? 0} ${selectedCategoryName ?? "listing"}${(listings?.length ?? 0) !== 1 ? "s" : ""}`}
              {debouncedSearch ? ` matching "${debouncedSearch}"` : ""}
            </p>
            <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition-colors">
              <X className="h-3.5 w-3.5" /> Clear filters
            </button>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Results header + Grid/Map toggle */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-gray-500">
            {isLoading ? "Loading…" : `${listings?.length ?? 0} listings`}
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
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No listings found</h3>
              <p className="text-gray-400 mb-4">Try a different category or clear your filters</p>
              {hasFilters && (
                <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
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
