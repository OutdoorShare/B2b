import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useParams } from "wouter";
import type { DateRange } from "react-day-picker";
import {
  useGetListing,
  useGetBusinessProfile,
  getGetListingQueryKey,
  getGetBusinessProfileQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  ArrowLeft, Check, Shield, MapPin, AlertTriangle,
  Tag, ChevronRight, Package, ShieldCheck, Umbrella, Zap, Lock,
  CalendarDays, ChevronRight as ArrowRight, ClipboardList
} from "lucide-react";
import { differenceInDays, format, isWithinInterval, startOfDay, addDays, isBefore, isAfter, isSameDay } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Addon = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  priceType: "flat" | "per_day";
  isRequired: boolean;
};

type ListingRule = {
  id: number;
  title: string;
  description: string | null;
  fee: number;
};

const CONDITION_LABEL: Record<string, string> = {
  excellent: "Excellent",
  good: "Good / Used",
  fair: "Fair",
};

export default function StorefrontGearDetail() {
  const { slug, id: idParam } = useParams<{ slug: string; id: string }>();
  const [, setLocation] = useLocation();
  const sfBase = slug ? `/${slug}` : "";
  const id = idParam ? parseInt(idParam) : 0;

  const [activeImage, setActiveImage] = useState(0);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [listingRules, setListingRules] = useState<ListingRule[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [bookedRanges, setBookedRanges] = useState<{ start: Date; end: Date }[]>([]);
  const [calendarMonths, setCalendarMonths] = useState(() => window.innerWidth >= 640 ? 2 : 1);

  useEffect(() => {
    const handler = () => setCalendarMonths(window.innerWidth >= 640 ? 2 : 1);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const { data: listing, isLoading } = useGetListing(id, {
    query: { enabled: !!id, queryKey: getGetListingQueryKey(id) },
  });

  const { data: profile } = useGetBusinessProfile({
    query: { queryKey: getGetBusinessProfileQueryKey() },
  });

  useEffect(() => {
    if (!id) return;
    fetch(`${BASE}/api/listings/${id}/addons`)
      .then(r => r.json())
      .then((data: Addon[]) => {
        if (Array.isArray(data)) setAddons(data.filter(a => (a as any).isActive !== false));
      })
      .catch(() => {});
    fetch(`${BASE}/api/listings/${id}/rules`)
      .then(r => r.json())
      .then((data: ListingRule[]) => { if (Array.isArray(data)) setListingRules(data); })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetch(`${BASE}/api/listings/${id}/booked-dates`)
      .then(r => r.json())
      .then((data: { start: string; end: string }[]) => {
        if (Array.isArray(data)) {
          setBookedRanges(data.map(b => ({ start: new Date(b.start), end: new Date(b.end) })));
        }
      })
      .catch(() => {});
  }, [id]);

  // Build a set of disabled dates from booked ranges
  const disabledDates = useMemo(() => {
    const disabled: Date[] = [];
    bookedRanges.forEach(({ start, end }) => {
      let cur = startOfDay(start);
      const last = startOfDay(end);
      while (!isAfter(cur, last)) {
        disabled.push(new Date(cur));
        cur = addDays(cur, 1);
      }
    });
    return disabled;
  }, [bookedRanges]);

  // Check if a selected range overlaps any booked range
  const rangeHasConflict = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return false;
    return disabledDates.some(d => isWithinInterval(d, { start: dateRange.from!, end: dateRange.to! }));
  }, [dateRange, disabledDates]);

  const days = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 0;
    return Math.max(1, differenceInDays(dateRange.to, dateRange.from));
  }, [dateRange]);

  const pricePerDay = listing ? parseFloat(String(listing.pricePerDay)) : 0;
  const subtotal = pricePerDay * days;

  const protectionAddon = addons.find(a => a.name.toLowerCase().includes("protection"));
  const protectionPrice = protectionAddon
    ? (protectionAddon.priceType === "per_day" ? protectionAddon.price * days : protectionAddon.price)
    : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto px-4 py-10 space-y-6 animate-pulse">
          <div className="h-6 bg-muted rounded w-32" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-7 aspect-[4/3] bg-muted rounded-2xl" />
            <div className="lg:col-span-5 space-y-4">
              <div className="h-8 bg-muted rounded w-3/4" />
              <div className="h-10 bg-muted rounded w-1/3" />
              <div className="h-24 bg-muted rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4 text-muted-foreground">
        <Package className="w-12 h-12 text-muted" />
        <p className="font-semibold text-lg">Listing not found</p>
        <Button variant="outline" onClick={() => setLocation(sfBase || "/")}>Browse all gear</Button>
      </div>
    );
  }

  const isAvailable = listing.status === "active";
  const hasSpecs = listing.brand || listing.model || listing.weight || listing.dimensions || listing.condition;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Back */}
        <Link href={sfBase || "/"}>
          <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent text-muted-foreground hover:text-foreground gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to listings
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

          {/* ── LEFT: Photos ── */}
          <div className="lg:col-span-7 space-y-3">
            <div className="aspect-[4/3] w-full bg-muted rounded-2xl overflow-hidden border shadow-sm">
              {listing.imageUrls?.[activeImage] ? (
                <img
                  src={listing.imageUrls[activeImage]}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Package className="w-16 h-16 text-muted" />
                </div>
              )}
            </div>

            {listing.imageUrls && listing.imageUrls.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {listing.imageUrls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`shrink-0 w-20 aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all
                      ${i === activeImage ? "border-primary ring-2 ring-primary/20" : "border-transparent opacity-60 hover:opacity-100"}`}
                  >
                    <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Description — visible on all screens, below photos on desktop */}
            {listing.description && (
              <div className="hidden lg:block pt-2">
                <h3 className="font-semibold text-base mb-2">About this rental</h3>
                <p className="text-muted-foreground leading-relaxed">{listing.description}</p>
              </div>
            )}
          </div>

          {/* ── RIGHT: Details + Booking ── */}
          <div className="lg:col-span-5 flex flex-col gap-6">

            {/* Title + price */}
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {listing.categoryName && (
                  <Badge variant="secondary" className="uppercase tracking-wider font-semibold text-xs">
                    {listing.categoryName}
                  </Badge>
                )}
                {listing.condition && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {CONDITION_LABEL[listing.condition] ?? listing.condition}
                  </Badge>
                )}
                {!isAvailable && (
                  <Badge variant="destructive" className="text-xs">Unavailable</Badge>
                )}
              </div>

              <h1 className="text-3xl font-black tracking-tight mb-3 leading-tight">{listing.title}</h1>

              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black">${parseFloat(String(listing.pricePerDay)).toFixed(0)}</span>
                <span className="text-muted-foreground font-medium text-lg">/ day</span>
              </div>
            </div>

            {/* Description on mobile */}
            {listing.description && (
              <p className="lg:hidden text-muted-foreground leading-relaxed">{listing.description}</p>
            )}

            {/* ── Availability Calendar + Booking Card ── */}
            <div className="rounded-2xl border bg-background shadow-sm overflow-hidden">

              {/* Calendar header */}
              <div className="bg-muted/40 px-5 py-3.5 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">Check Availability</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300 inline-block" /> Booked
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-primary inline-block" /> Selected
                  </span>
                </div>
              </div>

              {/* Calendar */}
              <div className="px-1">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  disabled={[
                    { before: new Date() },
                    ...disabledDates,
                  ]}
                  numberOfMonths={calendarMonths}
                  className="[--cell-size:2rem] sm:[--cell-size:2.5rem] w-full"
                  classNames={{
                    root: "w-full",
                    day: "group/day relative aspect-square w-full select-none p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md",
                  }}
                  modifiers={{ booked: disabledDates }}
                  modifiersClassNames={{ booked: "bg-red-50 text-red-400 line-through opacity-60" }}
                />
              </div>

              {/* Selected range summary + price preview */}
              {dateRange?.from && (
                <div className="border-t px-5 py-4 space-y-3">
                  {/* Date row */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-center flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Pickup</p>
                      <p className="font-bold text-foreground">{format(dateRange.from, "MMM d, yyyy")}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground mx-2 shrink-0" />
                    <div className="text-center flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Return</p>
                      <p className="font-bold text-foreground">{dateRange.to ? format(dateRange.to, "MMM d, yyyy") : "—"}</p>
                    </div>
                    {days > 0 && (
                      <div className="text-center ml-2 pl-3 border-l flex-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Duration</p>
                        <p className="font-bold text-foreground">{days} day{days !== 1 ? "s" : ""}</p>
                      </div>
                    )}
                  </div>

                  {/* Price breakdown */}
                  {days > 0 && !rangeHasConflict && (
                    <div className="bg-muted/30 rounded-xl px-4 py-3 space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">${pricePerDay.toFixed(0)} × {days} day{days !== 1 ? "s" : ""}</span>
                        <span className="font-semibold">${subtotal.toFixed(2)}</span>
                      </div>
                      {protectionPrice > 0 && protectionAddon && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            {protectionAddon.priceType === "per_day"
                              ? `Protection ($${protectionAddon.price.toFixed(0)}/day × ${days})`
                              : "Protection Plan"}
                          </span>
                          <span className="font-semibold">+${protectionPrice.toFixed(2)}</span>
                        </div>
                      )}
                      {listing.depositAmount && Number(listing.depositAmount) > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Security deposit (refundable)</span>
                          <span>${parseFloat(String(listing.depositAmount)).toFixed(0)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-base pt-1 border-t mt-1">
                        <span>Estimated Total</span>
                        <span>${(subtotal + protectionPrice).toFixed(2)}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center pt-0.5">Deposit collected separately at pickup</p>
                    </div>
                  )}

                  {rangeHasConflict && (
                    <p className="text-sm text-red-600 font-medium text-center">
                      Those dates overlap a booking — please pick different dates.
                    </p>
                  )}
                </div>
              )}

              {/* Book button */}
              <div className="px-5 pb-5 space-y-2">
                {!dateRange?.from && isAvailable && (
                  <p className="text-xs text-center text-muted-foreground mb-2">Select your pickup and return dates above.</p>
                )}
                <Button
                  size="lg"
                  className="w-full h-12 text-base font-bold rounded-xl"
                  disabled={!isAvailable || !dateRange?.from || !dateRange?.to || rangeHasConflict}
                  onClick={() => {
                    if (!dateRange?.from || !dateRange?.to) return;
                    const start = format(dateRange.from, "yyyy-MM-dd");
                    const end = format(dateRange.to, "yyyy-MM-dd");
                    setLocation(`${sfBase}/book?listingId=${listing.id}&startDate=${start}&endDate=${end}`);
                  }}
                >
                  {!isAvailable ? "Currently Unavailable"
                    : !dateRange?.from ? <>Select Dates <CalendarDays className="w-5 h-5 ml-1.5" /></>
                    : !dateRange?.to ? "Select Return Date"
                    : rangeHasConflict ? "Dates Unavailable"
                    : <>Book Now — {days} day{days !== 1 ? "s" : ""} <ChevronRight className="w-5 h-5 ml-1" /></>}
                </Button>
                {profile?.location && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" /> Pickup: {profile.location}
                  </div>
                )}
                <p className="text-xs text-center text-muted-foreground">No charge until your booking is confirmed.</p>
              </div>
            </div>

            {/* Add-ons */}
            {addons.length > 0 && (
              <div className="space-y-3">
                {/* Protection Plan — required card */}
                {addons.filter(a => a.name.toLowerCase().includes("protection")).map(addon => (
                  <div key={addon.id} className="rounded-2xl overflow-hidden shadow-md" style={{ border: "2px solid #3ab549" }}>
                    {/* Header — OutdoorShare brand */}
                    <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: "#1a2332" }}>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" style={{ color: "#3ab549" }} />
                        <div className="flex flex-col leading-tight">
                          <span className="font-black text-white text-xs tracking-wide">Protection Plan</span>
                          <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: "#3ab549" }}>by OutdoorShare</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border" style={{ background: "rgba(58,181,73,0.15)", borderColor: "#3ab549", color: "#3ab549" }}>
                        <Lock className="w-2.5 h-2.5" /> Required
                      </span>
                    </div>
                    <div className="px-4 py-3 flex items-start justify-between gap-4" style={{ background: "#f0faf1" }}>
                      <div className="flex-1">
                        <p className="text-xs text-gray-700 mb-2">Included with every rental. Covers accidents, weather events, and disasters so you can adventure with confidence.</p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                          {[
                            { icon: AlertTriangle, text: "Accident & collision" },
                            { icon: Umbrella, text: "Weather & water" },
                            { icon: Zap, text: "Mechanical breakdown" },
                            { icon: ShieldCheck, text: "Disaster & fire" },
                          ].map(({ icon: Icon, text }) => (
                            <div key={text} className="flex items-center gap-1">
                              <Icon className="w-3 h-3 shrink-0" style={{ color: "#3ab549" }} />
                              <span className="text-[11px] text-gray-600">{text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-black" style={{ color: "#1a2332" }}>${addon.price.toFixed(0)}</p>
                        <p className="text-[10px] text-gray-500">flat fee</p>
                        <p className="text-[10px] font-semibold mt-1" style={{ color: "#3ab549" }}>Included at checkout</p>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Regular add-ons */}
                {addons.filter(a => !a.name.toLowerCase().includes("protection")).length > 0 && (
                  <>
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold">Available Add-ons</h3>
                    </div>
                    <div className="space-y-2">
                      {addons.filter(a => !a.name.toLowerCase().includes("protection")).map(addon => {
                        const unitLabel = addon.priceType === "per_day" ? "/day" : "flat";
                        return (
                          <div key={addon.id} className="flex items-start justify-between gap-3 bg-muted/30 rounded-xl border px-4 py-3">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-sm">{addon.name}</span>
                                {addon.isRequired && <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">Required</span>}
                              </div>
                              {addon.description && <p className="text-xs text-muted-foreground mt-0.5">{addon.description}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-sm text-primary">+${addon.price.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">{unitLabel}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                <p className="text-xs text-muted-foreground">Select add-ons during checkout.</p>
              </div>
            )}

            {/* Specs */}
            {hasSpecs && (
              <div className="space-y-3">
                <h3 className="font-semibold border-b pb-2">Specifications</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {listing.brand && (
                    <div>
                      <dt className="text-muted-foreground text-xs uppercase tracking-wider font-medium">Brand</dt>
                      <dd className="font-semibold mt-0.5">{listing.brand}</dd>
                    </div>
                  )}
                  {listing.model && (
                    <div>
                      <dt className="text-muted-foreground text-xs uppercase tracking-wider font-medium">Model</dt>
                      <dd className="font-semibold mt-0.5">{listing.model}</dd>
                    </div>
                  )}
                  {listing.condition && (
                    <div>
                      <dt className="text-muted-foreground text-xs uppercase tracking-wider font-medium">Condition</dt>
                      <dd className="font-semibold mt-0.5 capitalize">{CONDITION_LABEL[listing.condition] ?? listing.condition}</dd>
                    </div>
                  )}
                  {listing.weight && (
                    <div>
                      <dt className="text-muted-foreground text-xs uppercase tracking-wider font-medium">Weight</dt>
                      <dd className="font-semibold mt-0.5">{listing.weight}</dd>
                    </div>
                  )}
                  {listing.dimensions && (
                    <div className="col-span-2">
                      <dt className="text-muted-foreground text-xs uppercase tracking-wider font-medium">Dimensions</dt>
                      <dd className="font-semibold mt-0.5">{listing.dimensions}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* What's included */}
            {listing.includedItems && listing.includedItems.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold border-b pb-2">What's Included</h3>
                <ul className="space-y-2">
                  {listing.includedItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Listing Rules */}
            {listingRules.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold border-b pb-2 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-primary" />
                  Rental Rules
                </h3>
                <ul className="space-y-2.5">
                  {listingRules.map((rule) => (
                    <li key={rule.id} className="flex items-start gap-3 bg-muted/30 rounded-xl border px-4 py-3">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black">!</span>
                      <div>
                        <p className="text-sm font-semibold leading-snug">{rule.title}</p>
                        {rule.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{rule.description}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">You'll be asked to initial each rule during checkout.</p>
              </div>
            )}

            {/* Requirements */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-semibold text-sm text-amber-800">Requirements</span>
              </div>
              <p className="text-sm text-amber-700">Must be <strong>21+</strong> years old to rent.</p>
              {listing.requirements && (
                <p className="text-sm text-amber-700/90">{listing.requirements}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
