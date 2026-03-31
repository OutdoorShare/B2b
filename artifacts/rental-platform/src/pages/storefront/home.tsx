import { useState } from "react";
import { Link, useParams } from "wouter";
import { 
  useGetBusinessProfile, 
  useGetListings,
  useGetCategories,
  getGetBusinessProfileQueryKey,
  getGetListingsQueryKey,
  getGetCategoriesQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { 
  Search, MapPin, ArrowRight, Car,
  Waves, Bus, Truck, Anchor, Bike, Zap,
  Package, Snowflake, CarFront, Gauge, SlidersHorizontal
} from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "jet-ski": Waves,
  "rv": Bus,
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

export default function StorefrontHome() {
  const { slug } = useParams<{ slug: string }>();
  const sfBase = slug ? `/${slug}` : "";
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [activeCategorySlug, setActiveCategorySlug] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState([0, 500]);
  const [showFilters, setShowFilters] = useState(false);

  const { data: profile } = useGetBusinessProfile({
    query: { queryKey: getGetBusinessProfileQueryKey() }
  });

  const { data: categories } = useGetCategories({
    query: { queryKey: getGetCategoriesQueryKey() }
  });

  const { data: listings, isLoading } = useGetListings(
    { 
      status: "active",
      search: search || undefined,
      categoryId: activeCategory || undefined,
      minPrice: priceRange[0],
      maxPrice: priceRange[1] >= 500 ? undefined : priceRange[1],
    },
    { 
      query: { queryKey: getGetListingsQueryKey({ 
        status: "active", 
        search: search || undefined, 
        categoryId: activeCategory || undefined,
        minPrice: priceRange[0],
        maxPrice: priceRange[1] >= 500 ? undefined : priceRange[1],
      }) } 
    }
  );

  const handleCategoryClick = (id: number | null, slug: string | null) => {
    setActiveCategory(id);
    setActiveCategorySlug(slug);
  };

  return (
    <div className="w-full min-h-screen bg-background">
      {/* Hero Section — OutdoorShare style */}
      <section className="relative w-full flex flex-col items-center justify-center overflow-hidden"
        style={{ minHeight: "520px" }}>
        
        {/* Background */}
        {profile?.coverImageUrl ? (
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-black/50 z-10" />
            <img src={profile.coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" />
        )}

        <div className="relative z-20 w-full max-w-5xl mx-auto px-4 py-16 text-center">
          {/* Headline */}
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-3">
            {profile?.tagline || "Adventure Starts Here."}
          </h1>
          <p className="text-base md:text-lg text-white/80 mb-10 font-medium">
            {profile?.description || "Find your perfect outdoor experience today!"}
          </p>

          {/* Category Icon Pills — OutdoorShare style */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            <button
              data-testid="category-all"
              onClick={() => handleCategoryClick(null, null)}
              className={`flex flex-col items-center gap-1.5 group transition-all`}
            >
              <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all
                ${activeCategory === null 
                  ? "bg-primary shadow-lg shadow-primary/40 scale-110" 
                  : "bg-black/60 backdrop-blur border border-white/10 hover:bg-black/80 hover:scale-105"}`}>
                <Gauge className="w-6 h-6 text-white" />
              </div>
              <span className="text-white text-xs font-semibold drop-shadow">All</span>
            </button>

            {categories?.filter(cat => (cat.listingCount ?? 0) > 0).map(cat => {
              const Icon = getCategoryIcon(cat.slug);
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  data-testid={`category-${cat.slug}`}
                  onClick={() => handleCategoryClick(cat.id, cat.slug)}
                  className="flex flex-col items-center gap-1.5 group transition-all"
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all
                    ${isActive 
                      ? "bg-primary shadow-lg shadow-primary/40 scale-110" 
                      : "bg-black/60 backdrop-blur border border-white/10 hover:bg-black/80 hover:scale-105"}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-white text-xs font-semibold drop-shadow whitespace-nowrap">{cat.name}</span>
                </button>
              );
            })}
          </div>

          {/* Search bar */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-white/95 backdrop-blur-md rounded-full flex items-center shadow-2xl overflow-hidden pr-2 py-2 pl-5 gap-3">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <Input
                data-testid="search-input"
                className="border-0 bg-transparent focus-visible:ring-0 text-base shadow-none p-0 flex-1 text-slate-800 placeholder:text-slate-400"
                placeholder={`Search ${activeCategorySlug ? categories?.find(c => c.slug === activeCategorySlug)?.name ?? "vehicles" : "all vehicles"}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                onClick={() => setShowFilters(v => !v)}
                className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500"
                data-testid="toggle-filters"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
              <Button
                data-testid="search-button"
                size="sm"
                className="rounded-full px-6 text-sm font-semibold shrink-0"
              >
                Search
              </Button>
            </div>

            {/* Expandable price filter */}
            {showFilters && (
              <div className="mt-3 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl text-left">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-slate-700">Price per day</span>
                  <span className="text-sm text-slate-500">${priceRange[0]} — {priceRange[1] >= 500 ? "Any" : `$${priceRange[1]}`}</span>
                </div>
                <Slider
                  defaultValue={[0, 500]}
                  max={500}
                  step={10}
                  value={priceRange}
                  onValueChange={setPriceRange}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Active category label */}
      {(activeCategory || search) && (
        <div className="bg-muted/50 border-b border-border py-3 px-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {listings?.length ?? 0} {activeCategorySlug ? categories?.find(c => c.slug === activeCategorySlug)?.name : "vehicle"}
              {(listings?.length ?? 0) !== 1 ? "s" : ""} available
              {search ? ` matching "${search}"` : ""}
            </span>
            <button
              className="text-sm text-primary font-medium hover:underline"
              onClick={() => { setActiveCategory(null); setActiveCategorySlug(null); setSearch(""); }}
            >
              Clear filters
            </button>
          </div>
        </div>
      )}

      {/* Listings Section */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">
            {activeCategory 
              ? categories?.find(c => c.id === activeCategory)?.name 
              : "Most Popular Listings"}
          </h2>
          <span className="text-sm text-muted-foreground">
            {listings?.length || 0} available
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="animate-pulse rounded-2xl overflow-hidden">
                <div className="bg-muted aspect-[4/3]" />
                <div className="p-4 space-y-2">
                  <div className="bg-muted h-4 rounded w-2/3" />
                  <div className="bg-muted h-5 rounded w-full" />
                  <div className="bg-muted h-4 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : listings && listings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {listings.map((listing) => (
              <Link key={listing.id} href={`${sfBase}/listings/${listing.id}`}>
                <div
                  data-testid={`listing-card-${listing.id}`}
                  className="group flex flex-col h-full bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/50 transition-all shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                >
                  <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                    {listing.imageUrls?.[0] ? (
                      <img 
                        src={listing.imageUrls[0]} 
                        alt={listing.title} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <Car className="w-12 h-12 opacity-20 text-muted-foreground" />
                      </div>
                    )}
                    {listing.condition === "excellent" && (
                      <div className="absolute top-3 right-3">
                        <Badge className="bg-white/90 text-black hover:bg-white border-0 shadow-sm text-xs font-semibold">
                          Like New
                        </Badge>
                      </div>
                    )}
                    {listing.categoryName && (
                      <div className="absolute top-3 left-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-black/60 text-white px-2 py-1 rounded-full backdrop-blur">
                          {listing.categoryName}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-bold text-base leading-snug mb-1 group-hover:text-primary transition-colors line-clamp-2">
                      {listing.title}
                    </h3>
                    {listing.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-3">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {listing.location}
                      </p>
                    )}
                    <div className="mt-auto pt-3 border-t border-border flex items-end justify-between">
                      <div>
                        <span className="text-xl font-bold tracking-tight">${listing.pricePerDay}</span>
                        <span className="text-xs text-muted-foreground">/day</span>
                      </div>
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-24 text-center border-2 border-dashed rounded-2xl">
            <Car className="w-16 h-16 mx-auto text-muted mb-4" />
            <h3 className="text-xl font-bold mb-2">No vehicles found</h3>
            <p className="text-muted-foreground mb-6">Try adjusting your filters or search terms.</p>
            <Button variant="outline" onClick={() => { setSearch(""); setActiveCategory(null); setActiveCategorySlug(null); }}>
              Clear Filters
            </Button>
          </div>
        )}
      </section>

      {/* Footer info strip */}
      {profile && (
        <footer className="border-t border-border bg-muted/30 py-8 mt-8">
          <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              {profile.name}
            </div>
            <div className="flex items-center gap-6">
              {profile.phone && <a href={`tel:${profile.phone}`} className="hover:text-foreground transition-colors">{profile.phone}</a>}
              {profile.email && <a href={`mailto:${profile.email}`} className="hover:text-foreground transition-colors">{profile.email}</a>}
              {profile.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {profile.location}
                </span>
              )}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
