import { useState, useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  useGetListing,
  useGetBusinessProfile,
  getGetListingQueryKey,
  getGetBusinessProfileQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Check, Shield, MapPin, AlertTriangle,
  Tag, ChevronRight, Package
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Addon = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  priceType: "flat" | "per_day";
  isRequired: boolean;
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
  }, [id]);

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

            {/* Booking card */}
            <div className="bg-muted/30 rounded-2xl border p-5 space-y-4">
              {(profile?.location || (listing.depositAmount && Number(listing.depositAmount) > 0)) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {profile?.location && (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-foreground">Pickup</p>
                        <p className="text-muted-foreground">{profile.location}</p>
                      </div>
                    </div>
                  )}
                  {listing.depositAmount && Number(listing.depositAmount) > 0 && (
                    <div className="flex items-start gap-2.5">
                      <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-foreground">Security Deposit</p>
                        <p className="text-muted-foreground">${parseFloat(String(listing.depositAmount)).toFixed(2)} refundable</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button
                size="lg"
                className="w-full h-13 text-base font-bold rounded-xl"
                onClick={() => setLocation(`${sfBase}/book?listingId=${listing.id}`)}
                disabled={!isAvailable}
              >
                {isAvailable ? (
                  <>Book This <ChevronRight className="w-5 h-5 ml-1" /></>
                ) : "Currently Unavailable"}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                No charge until your booking is confirmed.
              </p>
            </div>

            {/* Add-ons */}
            {addons.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold">Available Add-ons</h3>
                </div>
                <div className="space-y-2">
                  {addons.map(addon => {
                    const unitLabel = addon.priceType === "per_day" ? "/day" : "flat";
                    return (
                      <div key={addon.id} className="flex items-start justify-between gap-3 bg-muted/30 rounded-xl border px-4 py-3">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm">{addon.name}</span>
                            {addon.isRequired && (
                              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">Required</span>
                            )}
                          </div>
                          {addon.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{addon.description}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm text-primary">+${addon.price.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">{unitLabel}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
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

            {/* Requirements */}
            {(listing.requirements || listing.ageRestriction) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-semibold text-sm text-amber-800">Requirements</span>
                </div>
                {listing.ageRestriction && (
                  <p className="text-sm text-amber-700">Must be <strong>{listing.ageRestriction}+</strong> years old to rent.</p>
                )}
                {listing.requirements && (
                  <p className="text-sm text-amber-700/90">{listing.requirements}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
