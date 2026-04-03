import { useState } from "react";
import { Link, useParams } from "wouter";
import {
  useGetBusinessProfile,
  useGetListings,
  useGetCategories,
  getGetBusinessProfileQueryKey,
  getGetListingsQueryKey,
  getGetCategoriesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Search, MapPin, ArrowRight, Car,
  Waves, Bus, Truck, Anchor, Bike, Zap,
  Package, Snowflake, CarFront, Gauge, SlidersHorizontal, ShieldCheck,
  Phone, Mail, ChevronDown, ChevronUp,
  CheckCircle2, Umbrella, Users, AlertTriangle,
  Clock, Star, Layers, Gift,
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

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Browse & choose what you need",
    description: "Explore available rentals, check photos, pricing, and availability. Filter by type and dates to find exactly what fits your trip.",
    bullets: [
      "See real photos and detailed specs",
      "Check live availability",
      "Transparent pricing — no surprises",
      "Instant availability confirmation",
    ],
  },
  {
    step: "02",
    title: "Pick your dates and book",
    description: "Select your start and end dates, review the listing details and protection plan, then confirm your booking instantly — no waiting, no back-and-forth.",
    bullets: [
      "Real-time availability",
      "Protection plan included with every booking",
      "Instant booking confirmation",
      "Secure card payment through Stripe",
    ],
  },
  {
    step: "03",
    title: "Pick up and head out",
    description: "Show up at the scheduled time, complete a quick check-in, and you're on your way. Every booking includes the OutdoorShare Protection Plan.",
    bullets: [
      "Easy check-in at pickup",
      "OutdoorShare Protection Plan included",
      "Ride, drive, or float",
      "Return and you're done",
    ],
  },
];

const PROTECTION_PILLARS = [
  {
    icon: Car,
    title: "Accidental Equipment Damage",
    description: "Covers accidental damage to rented equipment during the rental period, including partial loss from accidents — subject to a deductible.",
  },
  {
    icon: ShieldCheck,
    title: "Liability Protection",
    description: "Provides liability protection for certain incidents that occur while using the rented equipment. Not an insurance policy — OutdoorShare is not an insurance provider.",
  },
  {
    icon: AlertTriangle,
    title: "Renter Responsibility",
    description: "Renters remain responsible for deductibles, intentional damage, theft without forcible entry, misuse, normal wear and tear, and incidents not reported within 24 hours.",
  },
];

const FAQ_ITEMS = [
  {
    question: "What kinds of equipment can I rent?",
    answer: "We offer a variety of outdoor equipment for every type of adventure. Check our listings for current availability — inventory varies based on the season.",
  },
  {
    question: "How does the protection plan work?",
    answer: "The OutdoorShare Protection Plan is a contractual protection offering — not an insurance policy — that covers accidental damage to rented equipment, liability protection for certain incidents, and partial loss from accidents. Renters remain responsible for deductibles, intentional damage, theft without documented forcible entry, misuse, and normal wear and tear. Learn more at myoutdoorshare.com/protection-plan.",
  },
  {
    question: "Is booking really instant, or do I need to wait for approval?",
    answer: "Bookings are confirmed instantly once payment is authorized. You will receive an email confirmation right away.",
  },
  {
    question: "What happens at pickup?",
    answer: "Show up at the scheduled pickup time. You will complete a quick identity check and sign the rental agreement digitally. Photos of the equipment are taken at pickup to protect both you and us.",
  },
  {
    question: "What is the cancellation policy?",
    answer: "Cancellation policies vary per listing. Review the terms on the listing page before booking. Contact us directly if you have special circumstances.",
  },
  {
    question: "How do I get in touch?",
    answer: null, // rendered dynamically with profile contact info
  },
];

function FAQItem({ question, answer, profile }: { question: string; answer: string | null; profile: any }) {
  const [open, setOpen] = useState(false);

  const resolvedAnswer = answer ?? (
    `Reach us by phone or email — we are happy to help. ${profile?.phone ? `Call us at ${profile.phone}. ` : ""}${profile?.email ? `Email us at ${profile.email}.` : ""}`
  );

  return (
    <div className="border-b border-border last:border-0">
      <button
        className="w-full flex items-center justify-between gap-4 py-5 text-left hover:text-primary transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <span className="font-semibold text-sm md:text-base">{question}</span>
        {open ? <ChevronUp className="w-4 h-4 shrink-0 text-primary" /> : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <p className="pb-5 text-sm text-muted-foreground leading-relaxed pr-8">{resolvedAnswer}</p>
      )}
    </div>
  );
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
    query: {
      queryKey: [...getGetCategoriesQueryKey(), slug],
      enabled: !!slug,
    }
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
      query: {
        queryKey: getGetListingsQueryKey({
          status: "active",
          search: search || undefined,
          categoryId: activeCategory || undefined,
          minPrice: priceRange[0],
          maxPrice: priceRange[1] >= 500 ? undefined : priceRange[1],
        })
      }
    }
  );

  const handleCategoryClick = (id: number | null, catSlug: string | null) => {
    setActiveCategory(id);
    setActiveCategorySlug(catSlug);
  };

  const businessName = (profile as any)?.name || "OutdoorShare";
  const primaryColor = "hsl(var(--primary))";

  return (
    <div className="w-full min-h-screen bg-background">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative w-full flex flex-col items-center justify-center overflow-hidden" style={{ minHeight: "520px" }}>
        {(profile as any)?.coverImageUrl ? (
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-black/55 z-10" />
            <img src={(profile as any).coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-900 via-primary/80 to-slate-900" />
        )}

        <div className="relative z-20 w-full max-w-5xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-3">
            {(profile as any)?.tagline || "Adventure Starts Here."}
          </h1>
          <p className="text-base md:text-lg text-white/80 mb-10 font-medium max-w-xl mx-auto">
            {(profile as any)?.description || "Find your perfect outdoor experience today."}
          </p>

          {/* Category pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {(categories?.length ?? 0) >= 2 && (
              <button
                data-testid="category-all"
                onClick={() => handleCategoryClick(null, null)}
                className="flex flex-col items-center gap-1.5 group transition-all"
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${activeCategory === null ? "bg-primary shadow-lg shadow-primary/40 scale-110" : "bg-black/60 backdrop-blur border border-white/10 hover:bg-black/80 hover:scale-105"}`}>
                  <Gauge className="w-6 h-6 text-white" />
                </div>
                <span className="text-white text-xs font-semibold drop-shadow">All</span>
              </button>
            )}

            {categories?.filter((cat, idx, arr) => arr.findIndex(c => c.slug === cat.slug) === idx).map(cat => {
              const Icon = getCategoryIcon(cat.slug);
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  data-testid={`category-${cat.slug}`}
                  onClick={() => handleCategoryClick(cat.id, cat.slug)}
                  className="flex flex-col items-center gap-1.5 group transition-all"
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isActive ? "bg-primary shadow-lg shadow-primary/40 scale-110" : "bg-black/60 backdrop-blur border border-white/10 hover:bg-black/80 hover:scale-105"}`}>
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
                placeholder={`Search ${activeCategorySlug ? categories?.find(c => c.slug === activeCategorySlug)?.name ?? "equipment" : "all equipment"}…`}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <button
                onClick={() => setShowFilters(v => !v)}
                className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500"
                data-testid="toggle-filters"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
              <Button data-testid="search-button" size="sm" className="rounded-full px-6 text-sm font-semibold shrink-0">
                Search
              </Button>
            </div>
            {showFilters && (
              <div className="mt-3 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl text-left">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-slate-700">Price per day</span>
                  <span className="text-sm text-slate-500">${priceRange[0]} — {priceRange[1] >= 500 ? "Any" : `$${priceRange[1]}`}</span>
                </div>
                <Slider defaultValue={[0, 500]} max={500} step={10} value={priceRange} onValueChange={setPriceRange} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Active filter bar */}
      {(activeCategory || search) && (
        <div className="bg-muted/50 border-b border-border py-3 px-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {listings?.length ?? 0} {activeCategorySlug ? categories?.find(c => c.slug === activeCategorySlug)?.name : "item"}
              {(listings?.length ?? 0) !== 1 ? "s" : ""} available
              {search ? ` matching "${search}"` : ""}
            </span>
            <button className="text-sm text-primary font-medium hover:underline" onClick={() => { setActiveCategory(null); setActiveCategorySlug(null); setSearch(""); }}>
              Clear filters
            </button>
          </div>
        </div>
      )}

      {/* ── LISTINGS ─────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">
              {activeCategory ? "Filtered results" : "Browse all"}
            </p>
            <h2 className="text-2xl font-bold tracking-tight">
              {activeCategory ? categories?.find(c => c.id === activeCategory)?.name : "Available Now"}
            </h2>
          </div>
          <span className="text-sm font-medium text-muted-foreground bg-muted/60 px-3 py-1 rounded-full">{listings?.length || 0} available</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="animate-pulse rounded-2xl overflow-hidden border border-border">
                <div className="bg-muted aspect-[4/3]" />
                <div className="p-4 space-y-2.5">
                  <div className="bg-muted h-4 rounded w-3/4" />
                  <div className="bg-muted h-3 rounded w-full" />
                  <div className="bg-muted h-3 rounded w-4/5" />
                  <div className="bg-muted h-3 rounded w-1/3" />
                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                    <div className="bg-muted h-6 rounded w-20" />
                    <div className="bg-muted h-8 w-8 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : listings && listings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {listings.map(listing => {
              const l = listing as any;
              const hasHalfDay = l.halfDayRate && l.halfDayRate > 0;
              const hasWeekly  = l.pricePerWeek && l.pricePerWeek > 0;
              const hasHourly  = l.pricePerHour && l.pricePerHour > 0;
              const hasSlots   = Array.isArray(l.timeSlots) && l.timeSlots.length > 0;
              const qty        = l.availableQuantity ?? l.quantity ?? 1;
              const included   = Array.isArray(l.includedItems) ? l.includedItems as string[] : [];

              return (
                <Link key={listing.id} href={`${sfBase}/listings/${listing.id}`}>
                  <div
                    data-testid={`listing-card-${listing.id}`}
                    className="group flex flex-col h-full bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/50 transition-all shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                  >
                    {/* ── Image ── */}
                    <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                      {listing.imageUrls?.[0] ? (
                        <img src={listing.imageUrls[0]} alt={listing.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <Car className="w-12 h-12 opacity-20 text-muted-foreground" />
                        </div>
                      )}

                      {/* Category pill — top left */}
                      {listing.categoryName && (
                        <div className="absolute top-3 left-3">
                          <span className="text-[10px] font-bold uppercase tracking-widest bg-primary/90 text-primary-foreground px-2.5 py-1 rounded-full shadow-sm">
                            {listing.categoryName}
                          </span>
                        </div>
                      )}

                      {/* Condition badge — top right */}
                      {listing.condition === "excellent" && (
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 border-0 shadow-sm text-xs font-semibold">Like New</Badge>
                        </div>
                      )}
                      {listing.condition === "good" && (
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-sky-500 text-white hover:bg-sky-600 border-0 shadow-sm text-xs font-semibold">Good</Badge>
                        </div>
                      )}

                      {/* Multi-unit badge — bottom left */}
                      {qty > 1 && (
                        <div className="absolute bottom-3 left-3">
                          <span className="flex items-center gap-1 text-[10px] font-bold bg-black/60 backdrop-blur text-white px-2 py-1 rounded-full border border-white/10">
                            <Layers className="w-3 h-3" />{qty} available
                          </span>
                        </div>
                      )}

                      {/* Time-slot badge — bottom right */}
                      {hasSlots && (
                        <div className="absolute bottom-3 right-3">
                          <span className="flex items-center gap-1 text-[10px] font-bold bg-black/60 backdrop-blur text-white px-2 py-1 rounded-full border border-white/10">
                            <Clock className="w-3 h-3" />{l.timeSlots.length} session{l.timeSlots.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* ── Card body ── */}
                    <div className="p-4 flex-1 flex flex-col gap-2">

                      {/* Title */}
                      <h3 className="font-bold text-base leading-snug group-hover:text-primary transition-colors line-clamp-1">{listing.title}</h3>

                      {/* Description snippet */}
                      {listing.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{listing.description}</p>
                      )}

                      {/* Location */}
                      {listing.location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0" />{listing.location}
                        </p>
                      )}

                      {/* Chips row — protection plan, included items */}
                      <div className="flex flex-wrap gap-1.5">
                        {(listing as any).hasProtectionPlan && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-full px-2 py-0.5">
                            <ShieldCheck className="w-3 h-3" />Protection Plan
                          </span>
                        )}
                        {included.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-700 rounded-full px-2 py-0.5">
                            <Gift className="w-3 h-3" />Includes {included.length} item{included.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {/* Price row */}
                      <div className="mt-auto pt-3 border-t border-border">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-baseline gap-0.5">
                              <span className="text-xl font-bold tracking-tight text-primary">${listing.pricePerDay}</span>
                              <span className="text-xs text-muted-foreground font-medium">/day</span>
                            </div>
                            {/* Secondary pricing hint */}
                            {(hasHalfDay || hasWeekly || hasHourly) && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                                {hasHalfDay && `Half-day $${l.halfDayRate}`}
                                {hasHalfDay && hasWeekly && " · "}
                                {hasWeekly && `Week $${l.pricePerWeek}`}
                                {!hasHalfDay && !hasWeekly && hasHourly && `Hourly $${l.pricePerHour}/hr`}
                              </p>
                            )}
                          </div>
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all group-hover:scale-110 group-hover:shadow-md shrink-0">
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="py-24 text-center border-2 border-dashed rounded-2xl">
            <Car className="w-16 h-16 mx-auto text-muted mb-4" />
            <h3 className="text-xl font-bold mb-2">No equipment found</h3>
            <p className="text-muted-foreground mb-6">Try adjusting your filters or search terms.</p>
            <Button variant="outline" onClick={() => { setSearch(""); setActiveCategory(null); setActiveCategorySlug(null); }}>Clear Filters</Button>
          </div>
        )}
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section className="bg-muted/30 border-t border-border py-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Simple process</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">How it works</h2>
            <p className="text-muted-foreground mt-3 text-base max-w-xl mx-auto">
              From finding your adventure to heading out — the whole process takes minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((item, i) => (
              <div key={i} className="relative bg-background rounded-2xl border border-border shadow-sm p-7 overflow-hidden">
                {/* Subtle colored top accent */}
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60 rounded-t-2xl" />
                {/* Step circle indicator */}
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
                  <span className="text-base font-black text-primary">{item.step}</span>
                </div>
                <h3 className="font-bold text-lg mb-2 leading-snug">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{item.description}</p>
                <ul className="space-y-1.5">
                  {item.bullets.map(b => (
                    <li key={b} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-primary/10 border border-primary/20 items-center justify-center shadow-sm">
                    <ArrowRight className="w-4 h-4 text-primary" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href={`${sfBase}`}>
              <Button size="lg" className="rounded-full px-8 font-bold">
                Browse Equipment
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── PROTECTION PLAN ──────────────────────────────────── */}
      <section className="bg-[#1a2332] py-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              <ShieldCheck className="w-6 h-6 text-[#3ab549]" />
              <span className="text-[#3ab549] font-bold text-sm uppercase tracking-widest">Every booking protected</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              The OutdoorShare Protection Plan — included with every booking.
            </h2>
            <p className="text-white/60 mt-3 text-base max-w-xl mx-auto leading-relaxed">
              Every booking includes a Protection Plan fee paid at checkout. A contractual protection offering — not insurance — designed to make rentals safer for everyone.{" "}
              <a href="https://myoutdoorshare.com/protection-plan" target="_blank" rel="noopener noreferrer" className="underline text-[#3ab549] hover:text-[#3ab549]/80">Learn more →</a>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {PROTECTION_PILLARS.map(({ icon: Icon, title, description }) => (
              <div key={title} className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#3ab549]/15 border border-[#3ab549]/30 flex items-center justify-center mx-auto">
                  <Icon className="w-6 h-6 text-[#3ab549]" />
                </div>
                <h3 className="font-bold text-white">{title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>

          {/* How it works — steps */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8">
            <h3 className="font-bold text-white text-center mb-6">How it works</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                "Renter books equipment — Protection Plan fee is included automatically at checkout",
                "Booking confirmed — equipment damage coverage is active from pickup to return",
                "If an incident occurs, report it promptly and file a claim through OutdoorShare",
                "Renters remain responsible for deductibles and any excluded situations",
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#3ab549] text-white text-xs font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                  <p className="text-sm text-white/70 leading-snug">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section className="py-20 border-t border-border">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Questions answered</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Frequently asked</h2>
            {((profile as any)?.phone || (profile as any)?.email) && (
              <p className="text-muted-foreground mt-3 text-sm">
                Still have questions?{" "}
                {(profile as any)?.phone && (
                  <a href={`tel:${(profile as any).phone}`} className="text-primary font-semibold hover:underline">
                    Call {(profile as any).phone}
                  </a>
                )}
                {(profile as any)?.phone && (profile as any)?.email && " or "}
                {(profile as any)?.email && (
                  <a href={`mailto:${(profile as any).email}`} className="text-primary font-semibold hover:underline">
                    email us
                  </a>
                )}
                .
              </p>
            )}
          </div>

          <div className="bg-background rounded-2xl border border-border shadow-sm px-6">
            {FAQ_ITEMS.map(item => (
              <FAQItem key={item.question} question={item.question} answer={item.answer} profile={profile} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────────── */}
      <section className="bg-primary py-16">
        <div className="max-w-3xl mx-auto px-4 text-center space-y-5">
          <h2 className="text-3xl md:text-4xl font-black text-primary-foreground tracking-tight">
            Ready to get started?
          </h2>
          <p className="text-primary-foreground/80 text-base max-w-lg mx-auto">
            Browse available equipment, pick your dates, and book in minutes. Every booking is protected.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href={`${sfBase}`}>
              <Button size="lg" variant="secondary" className="rounded-full px-8 font-bold">
                Browse Equipment
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="border-t border-border bg-muted/30 py-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              {(profile as any)?.logoUrl ? (
                <img src={(profile as any).logoUrl} alt={businessName} className="h-8 object-contain mb-2" />
              ) : (
                <p className="font-black text-lg tracking-tight">{businessName}</p>
              )}
              {(profile as any)?.location && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3" />{(profile as any).location}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-5 text-sm text-muted-foreground">
              {(profile as any)?.phone && (
                <a href={`tel:${(profile as any).phone}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <Phone className="w-3.5 h-3.5" />{(profile as any).phone}
                </a>
              )}
              {(profile as any)?.email && (
                <a href={`mailto:${(profile as any).email}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <Mail className="w-3.5 h-3.5" />{(profile as any).email}
                </a>
              )}
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} {businessName}. All rights reserved.</p>
            <p className="flex items-center gap-1.5">
              Powered by
              <span className="font-semibold text-foreground">OutdoorShare</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
