import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, Mountain, Clock, Users, MapPin, ArrowRight, X, LayoutGrid, Map,
} from "lucide-react";
import type { MarketplaceActivity } from "@/lib/api";
import { ExperienceMapView } from "@/components/experience-map-view";

function fmtDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const CATEGORY_LABELS: Record<string, string> = {
  adventure: "Adventure",
  "water-sport": "Water Sport",
  "guided-tour": "Guided Tour",
  lesson: "Lesson",
  "wildlife-tour": "Wildlife Tour",
  "off-road": "Off-Road",
  camping: "Camping",
  climbing: "Climbing",
  "snow-sport": "Snow Sport",
  fishing: "Fishing",
  other: "Other",
};

const CATEGORY_ICONS: Record<string, string> = {
  adventure: "🏔️",
  "water-sport": "🌊",
  "guided-tour": "🧭",
  lesson: "📚",
  "wildlife-tour": "🦁",
  "off-road": "🚙",
  camping: "⛺",
  climbing: "🧗",
  "snow-sport": "🎿",
  fishing: "🎣",
  other: "🌿",
};

function ActivityCard({ act }: { act: MarketplaceActivity }) {
  return (
    <a
      href={`/${act.tenantSlug}`}
      className="group bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col"
    >
      {act.imageUrls?.[0] ? (
        <div className="h-48 overflow-hidden">
          <img
            src={act.imageUrls[0]}
            alt={act.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      ) : (
        <div
          className="h-48 flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, hsl(127,55%,92%) 0%, hsl(197,78%,92%) 100%)" }}
        >
          <span className="text-5xl">{CATEGORY_ICONS[act.category] ?? "🌿"}</span>
        </div>
      )}

      <div className="p-4 flex flex-col flex-1 gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
          {CATEGORY_LABELS[act.category] ?? act.category}
        </span>

        <h3 className="font-semibold text-gray-900 leading-tight group-hover:text-primary transition-colors line-clamp-2">
          {act.title}
        </h3>

        <p className="text-xs text-gray-500">{act.tenantName}</p>

        {act.description && (
          <p className="text-xs text-gray-400 line-clamp-2">{act.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-auto pt-2 border-t border-gray-100">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {fmtDuration(act.durationMinutes)}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            Up to {act.maxCapacity}
          </span>
          {act.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{act.location}</span>
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-2">
          <div>
            <span className="font-bold text-gray-900">${act.pricePerPerson}</span>
            <span className="text-xs text-gray-400"> / person</span>
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all">
            Book now <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </a>
  );
}

export function ExperiencesPage(_: { onAuthOpen: () => void }) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["marketplace-activities"],
    queryFn: api.marketplace.activities,
    staleTime: 30_000,
  });

  const categories = useMemo(() => {
    const seen = new Set<string>();
    activities.forEach((a) => seen.add(a.category));
    return Array.from(seen).sort();
  }, [activities]);

  const filtered = useMemo(() => {
    let list = activities;
    if (activeCategory) list = list.filter((a) => a.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.description?.toLowerCase().includes(q) ||
          a.location?.toLowerCase().includes(q) ||
          a.tenantName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activities, activeCategory, search]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero banner */}
      <div
        className="relative h-56 flex items-center justify-center overflow-hidden"
        style={{
          background: "linear-gradient(135deg, hsl(127,55%,30%) 0%, hsl(197,78%,35%) 100%)",
        }}
      >
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 text-center px-4">
          <h1 className="text-4xl font-bold text-white mb-2">Experiences</h1>
          <p className="text-white/80 text-base max-w-md mx-auto">
            Guided tours, lessons, and adventures hosted by local companies
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search + filters row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search experiences, locations, companies..."
              className="pl-9 bg-white"
            />
            {search && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setSearch("")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Category pill filters */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <Button
              variant={activeCategory === null ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setActiveCategory(null)}
            >
              All
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={activeCategory === cat ? "default" : "outline"}
                size="sm"
                className="rounded-full gap-1"
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              >
                <span>{CATEGORY_ICONS[cat] ?? "🌿"}</span>
                {CATEGORY_LABELS[cat] ?? cat}
              </Button>
            ))}
          </div>
        )}

        {/* Results header + Grid/Map toggle */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-gray-500">
            {isLoading ? "Loading…" : `${filtered.length} experience${filtered.length !== 1 ? "s" : ""} available`}
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
        {viewMode === "map" && !isLoading && (
          <ExperienceMapView activities={filtered} />
        )}

        {/* Grid view */}
        {viewMode === "grid" && (
          isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 h-72 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Mountain className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-700 mb-1">No experiences found</h3>
              <p className="text-sm text-gray-400">
                {search || activeCategory
                  ? "Try adjusting your search or filters."
                  : "No experiences are available yet. Check back soon!"}
              </p>
              {(search || activeCategory) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => { setSearch(""); setActiveCategory(null); }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtered.map((act) => (
                <ActivityCard key={act.id} act={act} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
