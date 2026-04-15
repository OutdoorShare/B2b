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
  Tag, ChevronRight, Package, ShieldCheck, Umbrella, Zap, Lock, Clock,
  CalendarDays, ChevronRight as ArrowRight, ClipboardList, Link2, Plus
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

/** Returns "City, State" from a full address — hides street & zip for privacy. */
function cityState(location: string): string {
  const parts = location.split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length <= 2) return location;
  const nonZip = parts.filter(p => !/^\d{5}(-\d{4})?$/.test(p));
  return nonZip.length >= 2 ? nonZip.slice(-2).join(", ") : location;
}

export default function StorefrontProductDetail() {
  const { slug, id: idParam } = useParams<{ slug: string; id: string }>();
  const [, setLocation] = useLocation();
  const sfBase = slug ? `/${slug}` : "";
  const id = idParam ? parseInt(idParam) : 0;

  const [activeImage, setActiveImage] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [platformProtectionPlan, setPlatformProtectionPlan] = useState<{
    enabled: boolean; feeAmount: string; feePer: string;
  } | null>(null);
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<number>>(new Set());
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
        if (Array.isArray(data)) {
          const active = data.filter(a => (a as any).isActive !== false);
          setAddons(active);
          // Auto-select required add-ons
          setSelectedAddonIds(new Set(active.filter(a => a.isRequired).map(a => a.id)));
        }
      })
      .catch(() => {});
    fetch(`${BASE}/api/listings/${id}/rules`)
      .then(r => r.json())
      .then((data: ListingRule[]) => { if (Array.isArray(data)) setListingRules(data); })
      .catch(() => {});
  }, [id]);

  // Fetch platform-level protection plan for this listing's category
  useEffect(() => {
    const catSlug = (listing as any)?.categorySlug;
    if (!catSlug) return;
    fetch(`${BASE}/api/protection-plan/${encodeURIComponent(catSlug)}`)
      .then(r => r.json())
      .then(d => setPlatformProtectionPlan(d))
      .catch(() => {});
  }, [(listing as any)?.categorySlug]);

  const [serviceDates, setServiceDates] = useState<Date[]>([]);

  useEffect(() => {
    if (!id) return;
    fetch(`${BASE}/api/listings/${id}/booked-dates`)
      .then(r => r.json())
      .then((resp: any) => {
        const data: { start: string; end: string; type?: string; quantity?: number }[] =
          Array.isArray(resp) ? resp : Array.isArray(resp?.ranges) ? resp.ranges : [];
        const serviceRanges = data.filter(b => b.type === "service");
        const otherRanges = data.filter(b => b.type !== "service");
        setBookedRanges(otherRanges.map(b => ({ start: new Date(b.start), end: new Date(b.end) })));
        const svcDates: Date[] = [];
        serviceRanges.forEach(b => {
          let cur = startOfDay(new Date(b.start));
          const last = startOfDay(new Date(b.end));
          while (!isAfter(cur, last)) {
            svcDates.push(new Date(cur));
            cur = addDays(cur, 1);
          }
        });
        setServiceDates(svcDates);
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

  const allDisabledDates = useMemo(() => [...disabledDates, ...serviceDates], [disabledDates, serviceDates]);

  // Check if a selected range overlaps any booked/service range
  const rangeHasConflict = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return false;
    return allDisabledDates.some(d => isWithinInterval(d, { start: dateRange.from!, end: dateRange.to! }));
  }, [dateRange, allDisabledDates]);

  const days = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 0;
    return Math.max(1, differenceInDays(dateRange.to, dateRange.from));
  }, [dateRange]);

  const pricePerDay = listing ? parseFloat(String(listing.pricePerDay)) : 0;

  // Sub-day pricing options
  const isOneDay = days === 1;
  const subDayOptions = useMemo(() => {
    if (!listing) return [];
    const opts: { type: string; label: string; price?: number; hours?: number; pricePerHour?: number; minHours?: number }[] = [];
    if ((listing as any).halfDayEnabled && (listing as any).halfDayRate) {
      opts.push({
        type: "half_day",
        label: `Half Day (${(listing as any).halfDayDurationHours || 4} hrs)`,
        price: parseFloat(String((listing as any).halfDayRate)),
        hours: (listing as any).halfDayDurationHours || 4,
      });
    }
    if ((listing as any).hourlyEnabled) {
      ((listing as any).hourlySlots ?? []).forEach((slot: { label: string; hours: number; price: number }, idx: number) => {
        opts.push({ type: `slot_${idx}`, label: slot.label, price: slot.price, hours: slot.hours });
      });
      if ((listing as any).hourlyPerHourEnabled && listing.pricePerHour) {
        opts.push({
          type: "per_hour",
          label: "Per Hour",
          pricePerHour: parseFloat(String(listing.pricePerHour)),
          minHours: (listing as any).hourlyMinimumHours ?? 1,
        });
      }
    }
    return opts;
  }, [listing]);

  const [selectedPricingType, setSelectedPricingType] = useState<string | null>(null);
  const [selectedHours, setSelectedHours] = useState<number>(1);

  useEffect(() => { if (!isOneDay) setSelectedPricingType(null); }, [isOneDay]);
  useEffect(() => {
    if (listing) setSelectedHours((listing as any).hourlyMinimumHours ?? 1);
  }, [listing]);

  const selectedOpt = subDayOptions.find(o => o.type === selectedPricingType) ?? null;

  const subtotal = useMemo(() => {
    if (!isOneDay || !selectedOpt) return pricePerDay * days;
    if (selectedOpt.type === "half_day" || selectedOpt.type.startsWith("slot_")) return selectedOpt.price ?? 0;
    if (selectedOpt.type === "per_hour") return (selectedOpt.pricePerHour ?? 0) * selectedHours;
    return pricePerDay * days;
  }, [isOneDay, selectedOpt, pricePerDay, days, selectedHours]);

  const protectionAddon = addons.find(a => a.name.toLowerCase().includes("protection"));
  const protectionPrice = protectionAddon
    ? (protectionAddon.priceType === "per_day" ? protectionAddon.price * days : protectionAddon.price)
    : 0;

  const toggleAddon = (addon: Addon) => {
    if (addon.isRequired || addon.name.toLowerCase().includes("protection")) return;
    setSelectedAddonIds(prev => {
      const next = new Set(prev);
      if (next.has(addon.id)) next.delete(addon.id); else next.add(addon.id);
      return next;
    });
  };

  const selectedAddonsSubtotal = useMemo(() => {
    return addons
      .filter(a => !a.name.toLowerCase().includes("protection") && selectedAddonIds.has(a.id))
      .reduce((sum, a) => sum + (a.priceType === "per_day" ? a.price * days : a.price), 0);
  }, [addons, selectedAddonIds, days]);

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
        <Button variant="outline" onClick={() => setLocation(sfBase || "/")}>Browse all products</Button>
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
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
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

              <div className="flex items-start justify-between gap-3">
                <h1 className="text-3xl font-black tracking-tight mb-2 leading-tight">{listing.title}</h1>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href).then(() => {
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2000);
                    });
                  }}
                  className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors mt-1"
                  title="Copy listing link"
                >
                  {linkCopied ? (
                    <><Check className="w-3.5 h-3.5 text-green-600" /><span className="text-green-600">Copied!</span></>
                  ) : (
                    <><Link2 className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-muted-foreground">Copy Link</span></>
                  )}
                </button>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black text-primary">${parseFloat(String(listing.pricePerDay)).toFixed(0)}</span>
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
              <div className="bg-gradient-to-r from-primary/8 to-primary/4 px-5 py-3.5 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
                    <CalendarDays className="w-3.5 h-3.5 text-primary" />
                  </div>
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
                    ...allDisabledDates,
                  ]}
                  numberOfMonths={calendarMonths}
                  className="[--cell-size:2rem] sm:[--cell-size:2.5rem] w-full"
                  classNames={{
                    root: "w-full",
                    day: "group/day relative h-[--cell-size] w-full select-none p-0 flex items-center justify-center [&>button]:!w-full [&>button]:!h-full [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md",
                  }}
                  modifiers={{ booked: disabledDates, service: serviceDates }}
                  modifiersClassNames={{
                    booked: "bg-red-50 text-red-400 line-through opacity-60",
                    service: "bg-orange-50 text-orange-400 line-through opacity-60",
                  }}
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

                  {/* Sub-day pricing selector — shown when 1 day is selected and options exist */}
                  {days > 0 && !rangeHasConflict && isOneDay && subDayOptions.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rental Type</p>
                      <div className="grid gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedPricingType(null)}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                            selectedPricingType === null
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <span className="font-medium">Full Day</span>
                          <span className="font-bold">${pricePerDay.toFixed(2)}</span>
                        </button>
                        {subDayOptions.map(opt => (
                          <button
                            key={opt.type}
                            type="button"
                            onClick={() => {
                              setSelectedPricingType(opt.type);
                              if (opt.type === "per_hour") setSelectedHours(opt.minHours ?? 1);
                            }}
                            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                              selectedPricingType === opt.type
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "hover:bg-muted/50"
                            }`}
                          >
                            <div>
                              <span className="font-medium">{opt.label}</span>
                              {opt.hours && opt.type !== "per_hour" && (
                                <span className="text-xs text-muted-foreground ml-2">{opt.hours} hr{opt.hours !== 1 ? "s" : ""}</span>
                              )}
                            </div>
                            <span className="font-bold">
                              {opt.type === "per_hour" ? `$${opt.pricePerHour?.toFixed(2)}/hr` : `$${opt.price?.toFixed(2)}`}
                            </span>
                          </button>
                        ))}
                      </div>
                      {/* Per-hour hour count */}
                      {selectedPricingType === "per_hour" && selectedOpt && (() => {
                        const snapSlots = subDayOptions.filter(
                          o => (o.type.startsWith("slot_") || o.type === "half_day") && typeof (o as any).hours === "number"
                        ) as Array<{ type: string; label: string; hours: number; price: number }>;
                        const snapTarget = snapSlots.find(s => s.hours === selectedHours + 1);
                        return (
                          <div className="flex flex-col gap-1 pt-1">
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => setSelectedHours(h => Math.max(selectedOpt.minHours ?? 1, h - 1))}
                                className="w-7 h-7 rounded-full border flex items-center justify-center font-bold hover:bg-muted text-sm"
                                disabled={selectedHours <= (selectedOpt.minHours ?? 1)}>−</button>
                              <span className="font-bold text-base w-8 text-center">{selectedHours}</span>
                              <button type="button"
                                onClick={() => {
                                  const next = selectedHours + 1;
                                  const snap = snapSlots.find(s => s.hours === next);
                                  if (snap) {
                                    setSelectedPricingType(snap.type);
                                  } else {
                                    setSelectedHours(next);
                                  }
                                }}
                                className="w-7 h-7 rounded-full border flex items-center justify-center font-bold hover:bg-muted text-sm">+</button>
                              <span className="text-xs text-muted-foreground">hrs × ${selectedOpt.pricePerHour?.toFixed(2)} = <span className="font-bold text-foreground">${((selectedOpt.pricePerHour ?? 0) * selectedHours).toFixed(2)}</span></span>
                            </div>
                            {snapTarget && (
                              <p className="text-[11px] text-primary/80 flex items-center gap-1">
                                <span className="inline-block w-1 h-1 rounded-full bg-primary/60" />
                                +1 more switches to <span className="font-semibold">{snapTarget.label}</span> (${snapTarget.price.toFixed(2)} flat)
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* ── Available Time Slots (info display, not picker — picker is in book.tsx) ── */}
                  {days > 0 && !rangeHasConflict && (() => {
                    const slots: Array<{ label: string; startTime: string; endTime: string; rate: "full_day" | "half_day" }> =
                      Array.isArray((listing as any).timeSlots) ? (listing as any).timeSlots : [];
                    if (!slots.length) return null;
                    return (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Available Time Slots
                        </p>
                        <div className="grid gap-1.5">
                          {slots.map((slot, idx) => (
                            <div key={idx} className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2">
                              <div className="flex-1">
                                <p className="text-xs font-semibold">{slot.label}</p>
                                <p className="text-[11px] text-muted-foreground">{slot.startTime} – {slot.endTime}</p>
                              </div>
                              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                                slot.rate === "half_day"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                              }`}>
                                {slot.rate === "half_day" ? "Half Day" : "Full Day"}
                              </span>
                            </div>
                          ))}
                          <p className="text-[10px] text-muted-foreground text-center">Select your slot during checkout</p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Price breakdown */}
                  {days > 0 && !rangeHasConflict && (
                    <div className="bg-muted/30 rounded-xl px-4 py-3 space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        {selectedOpt && isOneDay ? (
                          <span className="text-muted-foreground">
                            {selectedOpt.type === "per_hour"
                              ? `${selectedHours} hr${selectedHours !== 1 ? "s" : ""} × $${selectedOpt.pricePerHour?.toFixed(2)}/hr`
                              : selectedOpt.label}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">${pricePerDay.toFixed(0)} × {days} day{days !== 1 ? "s" : ""}</span>
                        )}
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
                      {selectedAddonsSubtotal > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Add-ons</span>
                          <span>+${selectedAddonsSubtotal.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-base pt-1 border-t mt-1">
                        <span>Estimated Total</span>
                        <span>${(subtotal + protectionPrice + selectedAddonsSubtotal).toFixed(2)}</span>
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
                    const addonParam = selectedAddonIds.size > 0 ? `&addons=${[...selectedAddonIds].join(",")}` : "";
                    const pricingParam = selectedPricingType ? `&pricingType=${encodeURIComponent(selectedPricingType)}${selectedPricingType === "per_hour" ? `&hours=${selectedHours}` : ""}` : "";
                    setLocation(`${sfBase}/book?listingId=${listing.id}&startDate=${start}&endDate=${end}${addonParam}${pricingParam}`);
                  }}
                >
                  {!isAvailable ? "Currently Unavailable"
                    : !dateRange?.from ? <>Select Dates <CalendarDays className="w-5 h-5 ml-1.5" /></>
                    : !dateRange?.to ? "Select Return Date"
                    : rangeHasConflict ? "Dates Unavailable"
                    : <>Book Now — {days} day{days !== 1 ? "s" : ""} <ChevronRight className="w-5 h-5 ml-1" /></>}
                </Button>
                {profile?.location && (
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3 shrink-0" /> Pickup: {cityState(profile.location)}
                    </div>
                    {(profile as any).locationDetail && (
                      <p className="text-xs text-muted-foreground/70 text-center">{(profile as any).locationDetail}</p>
                    )}
                  </div>
                )}
                <p className="text-xs text-center text-muted-foreground">No charge until your booking is confirmed.</p>
              </div>
            </div>

            {/* Protection Plan — always shown if addon plan or platform plan is enabled */}
            {(() => {
              const addonPlan = addons.find(a => a.name.toLowerCase().includes("protection"));
              const hasPlatformPlan = platformProtectionPlan?.enabled && parseFloat(platformProtectionPlan.feeAmount || "0") > 0;
              if (!addonPlan && !hasPlatformPlan) return null;

              const priceLabel = addonPlan
                ? `$${addonPlan.price.toFixed(0)}${addonPlan.priceType === "per_day" ? "/day" : " flat"}`
                : hasPlatformPlan
                  ? `$${parseFloat(platformProtectionPlan!.feeAmount).toFixed(0)}/${platformProtectionPlan!.feePer ?? "day"}`
                  : null;

              return (
                <div className="rounded-2xl overflow-hidden shadow-md" style={{ border: "2px solid #3ab549" }}>
                  {/* Header */}
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
                  {/* Body */}
                  <div className="px-4 py-3 flex items-start justify-between gap-4" style={{ background: "#f0faf1" }}>
                    <div className="flex-1">
                      <p className="text-xs text-gray-700 mb-2">
                        A contractual protection offering (not insurance) covering accidental equipment damage, liability protection, and partial loss from accidents. Renters are responsible for deductibles and excluded situations.{" "}
                        <a href="https://myoutdoorshare.com/protection-plan" target="_blank" rel="noopener noreferrer" className="font-semibold underline" style={{ color: "#3ab549" }}>Learn more →</a>
                      </p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        {[
                          { icon: AlertTriangle, text: "Accidental equipment damage" },
                          { icon: ShieldCheck, text: "Liability protection" },
                          { icon: Package, text: "Partial loss from accidents" },
                          { icon: Lock, text: "Theft w/ forcible entry" },
                        ].map(({ icon: Icon, text }) => (
                          <div key={text} className="flex items-center gap-1">
                            <Icon className="w-3 h-3 shrink-0" style={{ color: "#3ab549" }} />
                            <span className="text-[11px] text-gray-600">{text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {priceLabel && (
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-black" style={{ color: "#1a2332" }}>{priceLabel}</p>
                        <p className="text-[10px] font-semibold mt-1" style={{ color: "#3ab549" }}>Added at checkout</p>
                        <img src="/outdoorshare-logo-transparent.png" alt="OutdoorShare" className="mt-2 h-6 object-contain mx-auto" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Other Add-ons */}
            {addons.length > 0 && (
              <div className="space-y-3">
                {/* Regular add-ons — selectable */}
                {addons.filter(a => !a.name.toLowerCase().includes("protection")).length > 0 && (
                  <div className="rounded-2xl overflow-hidden border-2 border-primary/20 shadow-md">
                    {/* Section header */}
                    <div className="bg-primary/10 px-4 py-3 flex items-center justify-between border-b border-primary/20">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                          <Plus className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-foreground">Enhance Your Rental</h3>
                          <p className="text-[11px] text-muted-foreground leading-none mt-0.5">Optional add-ons — tap to include</p>
                        </div>
                      </div>
                      {addons.filter(a => !a.name.toLowerCase().includes("protection") && selectedAddonIds.has(a.id)).length > 0 && (
                        <span className="text-[11px] font-bold bg-primary text-primary-foreground px-2.5 py-1 rounded-full">
                          {addons.filter(a => !a.name.toLowerCase().includes("protection") && selectedAddonIds.has(a.id)).length} added
                        </span>
                      )}
                    </div>

                    {/* Add-on rows */}
                    <div className="bg-background divide-y divide-border">
                      {addons.filter(a => !a.name.toLowerCase().includes("protection")).map(addon => {
                        const selected = selectedAddonIds.has(addon.id);
                        const addonPrice = addon.priceType === "per_day" ? addon.price * days : addon.price;
                        const isClickable = !addon.isRequired;
                        return (
                          <button
                            key={addon.id}
                            type="button"
                            onClick={() => toggleAddon(addon)}
                            disabled={!isClickable}
                            className={`w-full flex items-center gap-4 px-4 py-3.5 text-left transition-all duration-150
                              ${selected ? "bg-primary/5" : "hover:bg-muted/40"}
                              ${!isClickable ? "cursor-default" : "cursor-pointer"}`}
                          >
                            {/* Toggle switch */}
                            <div className={`w-11 h-6 rounded-full shrink-0 relative transition-all duration-200 border-2
                              ${selected ? "bg-primary border-primary" : "bg-muted border-border"}`}>
                              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200
                                ${selected ? "left-[calc(100%-18px)]" : "left-0.5"}`} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`font-semibold text-sm ${selected ? "text-primary" : "text-foreground"}`}>{addon.name}</span>
                                {addon.isRequired && <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">Required</span>}
                              </div>
                              {addon.description && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{addon.description}</p>}
                            </div>

                            <div className="shrink-0 text-right">
                              <p className={`font-black text-base ${selected ? "text-primary" : "text-foreground"}`}>
                                +${addonPrice % 1 === 0 ? addonPrice.toFixed(0) : addonPrice.toFixed(2)}
                              </p>
                              <p className="text-[11px] text-muted-foreground leading-tight">
                                {addon.priceType === "per_day" ? `$${addon.price}/day` : "flat fee"}
                              </p>
                              <span className={`inline-block mt-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full transition-colors
                                ${selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                                {selected ? "✓ Added" : "+ Add"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>
        </div>

        {/* ── Below-the-fold Details: 2-column layout ── */}
        {(hasSpecs || (listing.includedItems && listing.includedItems.length > 0) || listingRules.length > 0) && (
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* Left column: Specs + What's Included */}
            <div className="space-y-8">
              {hasSpecs && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-base border-b pb-2">Specifications</h3>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
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

              {listing.includedItems && listing.includedItems.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-base border-b pb-2">What's Included</h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-2">
                    {listing.includedItems.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Right column: Rental Rules + Requirements */}
            <div className="space-y-8">
              {listingRules.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-base border-b pb-2 flex items-center gap-2">
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
        )}

        {/* Requirements only (no other details) */}
        {!hasSpecs && !(listing.includedItems && listing.includedItems.length > 0) && listingRules.length === 0 && (
          <div className="mt-8 max-w-2xl">
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
        )}

      </div>
    </div>
  );
}
