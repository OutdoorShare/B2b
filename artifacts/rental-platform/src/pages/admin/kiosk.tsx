import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { 
  useGetBusinessProfile, 
  useGetCategories,
  useGetListings,
  getGetBusinessProfileQueryKey,
  getGetCategoriesQueryKey,
  getGetListingsQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, Search, Car, Smartphone, Monitor, X, 
  Clock, ChevronRight
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type SelectedListing = {
  id: number;
  title: string;
  categoryName?: string | null;
  pricePerDay: number | string;
  imageUrls?: string[];
  depositAmount?: number | string | null;
  description?: string | null;
};

const IDLE_RESET_SECONDS = 90;

export default function AdminKiosk() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [selected, setSelected] = useState<SelectedListing | null>(null);
  const [idleSeconds, setIdleSeconds] = useState(IDLE_RESET_SECONDS);

  const { data: profile } = useGetBusinessProfile({
    query: { queryKey: getGetBusinessProfileQueryKey() }
  });

  const { data: categories } = useGetCategories({
    query: { queryKey: getGetCategoriesQueryKey() }
  });

  const { data: listings, isLoading } = useGetListings(
    { status: "active", search: search || undefined, categoryId: activeCategory || undefined },
    { query: { queryKey: getGetListingsQueryKey({ status: "active", search: search || undefined, categoryId: activeCategory || undefined }) } }
  );

  // Build the full booking URL — uses the tenant's slug so it routes correctly
  const tenantSlug = (profile as any)?.siteSlug ?? (profile as any)?.slug ?? "";
  const bookingUrl = selected && tenantSlug
    ? `${window.location.origin}${BASE}/${tenantSlug}/book?listingId=${selected.id}`
    : "";

  // Idle countdown — resets on any interaction
  const resetIdle = useCallback(() => setIdleSeconds(IDLE_RESET_SECONDS), []);

  useEffect(() => {
    if (!selected) return;
    const interval = setInterval(() => {
      setIdleSeconds(s => {
        if (s <= 1) { setSelected(null); return IDLE_RESET_SECONDS; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    window.addEventListener("pointerdown", resetIdle);
    window.addEventListener("keydown", resetIdle);
    return () => {
      window.removeEventListener("pointerdown", resetIdle);
      window.removeEventListener("keydown", resetIdle);
    };
  }, [selected, resetIdle]);

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* Top Bar */}
      <header className="h-20 border-b bg-card flex items-center px-8 justify-between shrink-0 shadow-sm">
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
                <Car className="w-6 h-6 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold">{profile?.name || "Vehicle Rental"}</h1>
              <p className="text-sm text-muted-foreground font-medium">Self-Service Kiosk</p>
            </div>
          </div>
        </div>

        <div className="w-96 relative">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="w-full h-12 pl-12 text-lg rounded-full bg-muted border-none focus-visible:ring-primary"
            placeholder="Search vehicles..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar Categories */}
        <aside className="w-64 border-r bg-card shrink-0 overflow-y-auto p-4 space-y-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`w-full text-left px-6 py-4 rounded-xl text-lg font-medium transition-all ${
              activeCategory === null ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-muted text-foreground"
            }`}
          >
            All Listings
          </button>
          {categories?.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`w-full text-left px-6 py-4 rounded-xl text-lg font-medium transition-all ${
                activeCategory === cat.id ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-muted text-foreground"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </aside>

        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto p-8 bg-muted/30">
          {isLoading ? (
            <div className="text-center py-20 text-muted-foreground text-xl">Loading vehicles...</div>
          ) : listings && listings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {listings.map(listing => (
                <div
                  key={listing.id}
                  onClick={() => { setSelected(listing as SelectedListing); resetIdle(); }}
                  className="bg-background rounded-2xl overflow-hidden border shadow-sm cursor-pointer group hover:border-primary/50 hover:shadow-lg transition-all active:scale-95"
                >
                  <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                    {listing.imageUrls?.[0] ? (
                      <img src={listing.imageUrls[0]} alt={listing.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Car className="w-12 h-12 opacity-20" />
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
                  <div className="p-5">
                    <h3 className="font-bold text-xl mb-3 line-clamp-1 group-hover:text-primary transition-colors">{listing.title}</h3>
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-2xl font-black">${listing.pricePerDay}</span>
                        <span className="text-sm text-muted-foreground font-medium">/day</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-semibold group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        Rent <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-32">
              <Car className="w-24 h-24 mx-auto text-muted mb-6" />
              <h2 className="text-2xl font-bold text-foreground">No listings found</h2>
              <p className="text-muted-foreground mt-2 text-lg">Try adjusting your search or category filters.</p>
              <Button size="lg" variant="outline" className="mt-8 rounded-full px-8" onClick={() => { setSearch(""); setActiveCategory(null); }}>
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* ── QR / Booking Modal ── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-8"
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div className="bg-background rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row" onClick={resetIdle}>
            {/* Left: Listing info */}
            <div className="md:w-2/5 bg-muted/30 flex flex-col">
              <div className="aspect-[4/3] relative overflow-hidden">
                {selected.imageUrls?.[0] ? (
                  <img src={selected.imageUrls[0]} alt={selected.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <Car className="w-16 h-16 opacity-20" />
                  </div>
                )}
              </div>
              <div className="p-6 flex-1">
                {selected.categoryName && (
                  <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">{selected.categoryName}</p>
                )}
                <h2 className="text-2xl font-black mb-2 leading-tight">{selected.title}</h2>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-3xl font-black">${selected.pricePerDay}</span>
                  <span className="text-muted-foreground">/day</span>
                </div>
                {selected.depositAmount && parseFloat(String(selected.depositAmount)) > 0 && (
                  <p className="text-sm text-muted-foreground">${selected.depositAmount} refundable deposit</p>
                )}
              </div>
            </div>

            {/* Right: QR + options */}
            <div className="md:w-3/5 p-8 flex flex-col items-center justify-center gap-6 relative">
              {/* Close + idle timer */}
              <div className="absolute top-4 right-4 flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Auto-close in {idleSeconds}s</span>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="w-9 h-9 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* QR Code section */}
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm font-medium mb-4">
                  <Smartphone className="w-4 h-4" />
                  <span>Scan with your phone to book</span>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-inner inline-block border-4 border-primary/20">
                  <QRCodeSVG
                    value={bookingUrl}
                    size={200}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  Point your phone camera at this code to open the booking form — complete your dates, payment, and rental agreement on your device.
                </p>
              </div>

              <div className="flex items-center gap-4 w-full">
                <div className="flex-1 h-px bg-border" />
                <span className="text-sm text-muted-foreground font-medium px-2">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Book on kiosk */}
              <div className="text-center space-y-3 w-full">
                <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm font-medium">
                  <Monitor className="w-4 h-4" />
                  <span>Book right here on the kiosk</span>
                </div>
                <Button
                  size="lg"
                  className="w-full h-14 text-lg font-bold rounded-xl"
                  disabled={!tenantSlug}
                  onClick={() => {
                    if (tenantSlug) setLocation(`/${tenantSlug}/book?listingId=${selected.id}`);
                  }}
                >
                  <Monitor className="w-5 h-5 mr-2" />
                  Book on This Kiosk
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full h-12 text-base font-semibold rounded-xl border-2"
                  onClick={() => setSelected(null)}
                >
                  <Smartphone className="w-4 h-4 mr-2" />
                  Done — Booked on My Phone
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
