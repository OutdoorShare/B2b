import { useState } from "react";
import { Link } from "wouter";
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
import { Search, MapPin, Tent, Compass, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function StorefrontHome() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [priceRange, setPriceRange] = useState([0, 500]);

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
      maxPrice: priceRange[1]
    },
    { 
      query: { queryKey: getGetListingsQueryKey({ 
        status: "active", 
        search: search || undefined, 
        categoryId: activeCategory || undefined,
        minPrice: priceRange[0],
        maxPrice: priceRange[1]
      }) } 
    }
  );

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative w-full h-[60vh] min-h-[500px] flex items-center justify-center overflow-hidden">
        {profile?.coverImageUrl ? (
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-black/40 z-10" />
            <img src={profile.coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-primary" />
        )}
        
        <div className="relative z-20 text-center px-4 max-w-4xl mx-auto space-y-6">
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight text-balance">
            {profile?.tagline || "Your Next Adventure Starts Here"}
          </h1>
          <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto font-medium">
            {profile?.description || "Premium outdoor equipment rental for the modern explorer. Book online, pick up in store, and hit the trail."}
          </p>
          
          <div className="max-w-2xl mx-auto mt-8 bg-background/95 backdrop-blur-md p-2 rounded-full flex shadow-xl">
            <div className="flex-1 flex items-center px-4">
              <Search className="w-5 h-5 text-muted-foreground mr-3" />
              <Input 
                className="border-0 bg-transparent focus-visible:ring-0 text-base shadow-none p-0" 
                placeholder="What are you looking for?" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button size="lg" className="rounded-full px-8 text-base font-semibold">
              Search Gear
            </Button>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="container mx-auto px-4 py-16 flex flex-col md:flex-row gap-8">
        {/* Filters Sidebar */}
        <aside className="w-full md:w-64 shrink-0 space-y-8">
          <div>
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Compass className="w-5 h-5 text-primary" />
              Categories
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => setActiveCategory(null)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeCategory === null ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                All Equipment
              </button>
              {categories?.map(category => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeCategory === category.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'
                  }`}
                >
                  {category.name} <span className="float-right opacity-50">{category.listingCount}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-bold text-lg mb-4">Price Range</h3>
            <div className="px-2">
              <Slider
                defaultValue={[0, 500]}
                max={1000}
                step={10}
                value={priceRange}
                onValueChange={setPriceRange}
                className="mb-6"
              />
              <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                <span>${priceRange[0]}</span>
                <span>${priceRange[1]}+</span>
              </div>
            </div>
          </div>
          
          {profile?.location && (
            <div className="bg-muted/50 p-4 rounded-xl mt-8">
              <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Pickup Location
              </h3>
              <p className="text-sm text-muted-foreground">{profile.location}</p>
              {(profile.city || profile.state) && (
                <p className="text-sm text-muted-foreground">{profile.city}, {profile.state}</p>
              )}
            </div>
          )}
        </aside>

        {/* Listings Grid */}
        <div className="flex-1">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight">Available Gear</h2>
            <span className="text-sm text-muted-foreground">{listings?.length || 0} items found</span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="animate-pulse bg-muted rounded-xl aspect-[3/4]" />
              ))}
            </div>
          ) : listings && listings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((listing) => (
                <Link key={listing.id} href={`/gear/${listing.id}`}>
                  <div className="group flex flex-col h-full bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/50 transition-colors shadow-sm hover:shadow-md">
                    <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                      {listing.imageUrls?.[0] ? (
                        <img 
                          src={listing.imageUrls[0]} 
                          alt={listing.title} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Tent className="w-12 h-12 opacity-20" />
                        </div>
                      )}
                      {listing.condition === 'excellent' && (
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-white/90 text-black hover:bg-white border-0 shadow-sm backdrop-blur">
                            Like New
                          </Badge>
                        </div>
                      )}
                    </div>
                    
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                        {listing.categoryName}
                      </div>
                      <h3 className="font-bold text-lg mb-2 leading-tight group-hover:text-primary transition-colors">
                        {listing.title}
                      </h3>
                      
                      <div className="mt-auto pt-4 border-t border-border flex items-end justify-between">
                        <div>
                          <span className="text-2xl font-bold tracking-tight">${listing.pricePerDay}</span>
                          <span className="text-sm text-muted-foreground">/day</span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-24 text-center border-2 border-dashed rounded-2xl">
              <Tent className="w-16 h-16 mx-auto text-muted mb-4" />
              <h3 className="text-xl font-bold mb-2">No gear found</h3>
              <p className="text-muted-foreground mb-6">We couldn't find any equipment matching your criteria.</p>
              <Button variant="outline" onClick={() => { setSearch(""); setActiveCategory(null); }}>
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
