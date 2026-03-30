import { useState, useEffect } from "react";
import { Link } from "wouter";
import { 
  useGetBusinessProfile, 
  useGetCategories,
  useGetListings,
  getGetBusinessProfileQueryKey,
  getGetCategoriesQueryKey,
  getGetListingsQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Tent } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AdminKiosk() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<number | null>(null);

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
      categoryId: activeCategory || undefined 
    },
    { 
      query: { 
        queryKey: getGetListingsQueryKey({ status: "active", search: search || undefined, categoryId: activeCategory || undefined }) 
      } 
    }
  );

  // Kiosk mode is designed for tablets, so we want large touch targets and simplified UI
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/20">
      {/* Top Bar */}
      <header className="h-20 border-b bg-card flex items-center px-8 justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon" className="w-12 h-12 rounded-full">
              <ArrowLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            {profile?.logoUrl ? (
              <img src={profile.logoUrl} alt={profile.name} className="h-10 object-contain" />
            ) : (
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Tent className="w-6 h-6 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold">{profile?.name || "Equipment Rental"}</h1>
              <p className="text-sm text-muted-foreground font-medium">Self-Service Kiosk</p>
            </div>
          </div>
        </div>
        
        <div className="w-96 relative">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input 
            className="w-full h-12 pl-12 text-lg rounded-full bg-muted border-none focus-visible:ring-primary" 
            placeholder="Search equipment..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar Categories */}
        <aside className="w-64 border-r bg-card shrink-0 overflow-y-auto p-4 space-y-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`w-full text-left px-6 py-4 rounded-xl text-lg font-medium transition-all ${
              activeCategory === null 
                ? 'bg-primary text-primary-foreground shadow-md' 
                : 'hover:bg-muted text-foreground'
            }`}
          >
            All Gear
          </button>
          {categories?.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`w-full text-left px-6 py-4 rounded-xl text-lg font-medium transition-all ${
                activeCategory === category.id 
                  ? 'bg-primary text-primary-foreground shadow-md' 
                  : 'hover:bg-muted text-foreground'
              }`}
            >
              {category.name}
            </button>
          ))}
        </aside>

        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto p-8 bg-muted/30">
          {isLoading ? (
            <div className="text-center py-20 text-muted-foreground text-xl">Loading equipment...</div>
          ) : listings && listings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {listings.map((listing) => (
                <Card key={listing.id} className="overflow-hidden hover-elevate transition-all border-none shadow-sm cursor-pointer group">
                  <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                    {listing.imageUrls?.[0] ? (
                      <img 
                        src={listing.imageUrls[0]} 
                        alt={listing.title} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Tent className="w-12 h-12 opacity-20" />
                      </div>
                    )}
                    {listing.condition && (
                      <div className="absolute top-3 left-3">
                        <Badge variant="secondary" className="bg-background/90 backdrop-blur font-medium text-xs px-2 py-1">
                          {listing.condition}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-5">
                    <div className="text-sm text-primary font-semibold mb-1 uppercase tracking-wider">
                      {listing.categoryName || 'General'}
                    </div>
                    <h3 className="font-bold text-xl mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                      {listing.title}
                    </h3>
                    <div className="flex items-end justify-between mt-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-muted-foreground font-medium">From</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black">${listing.pricePerDay}</span>
                          <span className="text-sm text-muted-foreground font-medium">/day</span>
                        </div>
                      </div>
                      <Button size="lg" className="rounded-full px-6 font-bold shadow-md">
                        Rent
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-32">
              <Tent className="w-24 h-24 mx-auto text-muted mb-6" />
              <h2 className="text-2xl font-bold text-foreground">No gear found</h2>
              <p className="text-muted-foreground mt-2 text-lg">Try adjusting your search or category filters.</p>
              <Button size="lg" variant="outline" className="mt-8 rounded-full px-8" onClick={() => { setSearch(""); setActiveCategory(null); }}>
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
