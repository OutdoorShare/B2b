import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ListingCard } from "@/components/listing-card";
import { MapView } from "@/components/map-view";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal, X, LayoutGrid, Map } from "lucide-react";

export function HomePage({ onAuthOpen }: { onAuthOpen: () => void }) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
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

  const clearFilters = () => {
    setSearch("");
    setSelectedCategory(null);
    setMinPrice("");
    setMaxPrice("");
  };

  const hasFilters = !!debouncedSearch || !!selectedCategory || !!minPrice || !!maxPrice;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="text-white" style={{ background: "linear-gradient(135deg, hsl(155,42%,10%) 0%, hsl(155,42%,18%) 60%, hsl(155,42%,25%) 100%)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
              Rent outdoor gear from local companies
            </h1>
            <p className="text-white/80 text-lg mb-8">
              Browse thousands of listings from verified outdoor rental companies — one account, every adventure.
            </p>

            {/* Search bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search jet skis, ATVs, campers..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10 h-12 text-base bg-white text-gray-900 border-0 shadow-lg"
                />
              </div>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-4 bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={() => setShowFilters(v => !v)}
              >
                <SlidersHorizontal className="h-5 w-5" />
              </Button>
            </div>

            {/* Stats */}
            {stats && (
              <div className="flex gap-6 mt-6 text-white/70 text-sm">
                <span><strong className="text-white">{stats.listings.toLocaleString()}</strong> listings</span>
                <span><strong className="text-white">{stats.companies.toLocaleString()}</strong> companies</span>
                <span><strong className="text-white">{stats.customers.toLocaleString()}</strong> renters</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters row */}
      {showFilters && (
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Min price / day</label>
              <Input type="number" placeholder="$0" value={minPrice} onChange={e => setMinPrice(e.target.value)} className="w-28 h-9" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Max price / day</label>
              <Input type="number" placeholder="$500" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="w-28 h-9" />
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-gray-500 hover:text-red-600">
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category pills */}
        {categories && categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                !selectedCategory
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white text-gray-600 border-gray-200 hover:border-primary/40"
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id.toString() === selectedCategory ? null : cat.id.toString())}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  selectedCategory === cat.id.toString()
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white text-gray-600 border-gray-200 hover:border-primary/40"
                }`}
              >
                {cat.icon && <span>{cat.icon}</span>}
                {cat.name}
                <span className="text-xs opacity-70">({cat.listingCount})</span>
              </button>
            ))}
          </div>
        )}

        {/* Results header with view toggle */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {isLoading ? "Loading..." : `${listings?.length ?? 0} listings`}
            {hasFilters && " matching your filters"}
          </p>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <button onClick={clearFilters} className="text-sm text-primary hover:underline mr-2">
                Clear filters
              </button>
            )}
            {/* Grid / Map toggle */}
            <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5 shadow-sm">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === "grid"
                    ? "bg-primary text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                Grid
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === "map"
                    ? "bg-primary text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Map className="h-4 w-4" />
                Map
              </button>
            </div>
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
              <p className="text-gray-400 mb-4">Try adjusting your search or filters</p>
              {hasFilters && (
                <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
              )}
            </div>
          )
        )}

        {/* CTA for non-logged-in */}
        <div className="mt-16 rounded-2xl p-8 text-center text-white" style={{ background: "linear-gradient(135deg, hsl(155,42%,12%) 0%, hsl(155,42%,20%) 100%)" }}>
          <h2 className="text-2xl font-bold mb-2">One account, every company</h2>
          <p className="text-white/80 mb-6">Create a free renter account to book across all OutdoorShare companies, track your rentals, and get receipts in one place.</p>
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
