import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import {
  useGetListing,
  useGetBookings,
  getGetListingQueryKey,
  getGetBookingsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Edit, ExternalLink, Package, Tag, DollarSign,
  CalendarDays, TrendingUp, Layers, Wrench, ShieldCheck,
  AlertTriangle, Check, Users, BarChart3, Clock, ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { UnitIdentifiersManager } from "@/components/unit-identifiers-manager";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Addon = {
  id: number;
  name: string;
  price: number;
  priceType: "flat" | "per_day";
  isRequired: boolean;
  isActive: boolean;
};

const STATUS_COLORS: Record<string, string> = {
  active:   "bg-green-100 text-green-800",
  draft:    "bg-muted text-muted-foreground",
  inactive: "bg-red-100 text-red-800",
};

const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  active:    "bg-green-100 text-green-800",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-red-100 text-red-800",
};

export default function AdminListingDetail() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/listings/:id");
  const id = params?.id ? parseInt(params.id) : 0;

  const [activeImage, setActiveImage] = useState(0);
  const [addons, setAddons] = useState<Addon[]>([]);

  const { data: listing, isLoading } = useGetListing(id, {
    query: { enabled: !!id, queryKey: getGetListingQueryKey(id) },
  });

  const { data: allBookings } = useGetBookings(
    { listingId: id },
    { query: { enabled: !!id, queryKey: getGetBookingsQueryKey({ listingId: id }) } }
  );

  useEffect(() => {
    if (!id) return;
    fetch(`${BASE}/api/listings/${id}/addons`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setAddons(d); })
      .catch(() => {});
  }, [id]);

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-64" />
        <div className="h-80 bg-muted rounded-2xl" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="p-6 max-w-6xl mx-auto py-24 text-center text-muted-foreground">
        <Package className="w-10 h-10 mx-auto mb-3 text-muted" />
        <p className="font-semibold">Listing not found</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/admin/listings")}>Back to Listings</Button>
      </div>
    );
  }

  const bookings = allBookings ?? [];
  const completedBookings = bookings.filter(b => b.status === "completed" || b.status === "active");
  const revenue = bookings
    .filter(b => b.status !== "cancelled")
    .reduce((s, b) => s + (typeof b.totalPrice === "number" ? b.totalPrice : parseFloat(String(b.totalPrice ?? "0"))), 0);
  const recentBookings = [...bookings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  const activeAddonCount = addons.filter(a => a.isActive).length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/listings")} className="-ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold leading-tight">{listing.title}</h1>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[listing.status ?? "draft"] ?? "bg-muted text-muted-foreground"}`}>
                {listing.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {listing.categoryName || "Uncategorized"} · ID #{listing.id}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/listings/${listing.id}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <ExternalLink className="w-4 h-4" /> View on Storefront
            </Button>
          </Link>
          <Link href={`/admin/listings/${listing.id}/edit`}>
            <Button size="sm" className="gap-1.5">
              <Edit className="w-4 h-4" /> Edit Listing
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Bookings", value: bookings.length, icon: CalendarDays, color: "text-blue-600" },
          { label: "Revenue",        value: `$${revenue.toFixed(2)}`, icon: DollarSign, color: "text-green-600" },
          { label: "Completed",      value: completedBookings.length, icon: TrendingUp, color: "text-primary" },
          { label: "Add-ons",        value: activeAddonCount, icon: Tag, color: "text-purple-600" },
        ].map(m => (
          <div key={m.label} className="bg-background rounded-xl border p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <m.icon className={`w-3.5 h-3.5 ${m.color}`} />
              {m.label}
            </div>
            <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Main content: 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* LEFT: Photos + Details */}
        <div className="lg:col-span-3 space-y-5">

          {/* Photo gallery */}
          <div className="bg-background rounded-2xl border overflow-hidden">
            <div className="aspect-[16/9] w-full bg-muted relative">
              {listing.imageUrls?.[activeImage] ? (
                <img src={listing.imageUrls[activeImage]} alt={listing.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Package className="w-12 h-12 text-muted" />
                </div>
              )}
            </div>
            {listing.imageUrls && listing.imageUrls.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto">
                {listing.imageUrls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`shrink-0 w-16 aspect-square rounded-lg overflow-hidden border-2 transition-all
                      ${i === activeImage ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          {listing.description && (
            <div className="bg-background rounded-2xl border p-5 space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" /> Description
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{listing.description}</p>
            </div>
          )}

          {/* Specifications */}
          <div className="bg-background rounded-2xl border p-5 space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Wrench className="w-4 h-4 text-primary" /> Specifications
            </h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ["Brand", listing.brand],
                ["Model", listing.model],
                ["Condition", listing.condition],
                ["Weight", listing.weight],
                ["Dimensions", listing.dimensions],
                ["Category", listing.categoryName],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label as string} className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</dt>
                  <dd className="font-semibold capitalize">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Included items */}
          {listing.includedItems && listing.includedItems.length > 0 && (
            <div className="bg-background rounded-2xl border p-5 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" /> Included Items
              </h3>
              <ul className="grid grid-cols-2 gap-1.5">
                {listing.includedItems.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* RIGHT: Business info + bookings */}
        <div className="lg:col-span-2 space-y-5">

          {/* Pricing */}
          <div className="bg-background rounded-2xl border p-5 space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" /> Pricing & Inventory
            </h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Per day</span>
                <span className="font-bold text-base">${parseFloat(String(listing.pricePerDay)).toFixed(2)}</span>
              </div>
              {listing.pricePerWeek && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Per week</span>
                  <span className="font-semibold">${parseFloat(String(listing.pricePerWeek)).toFixed(2)}</span>
                </div>
              )}
              {listing.depositAmount && Number(listing.depositAmount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Security deposit</span>
                  <span className="font-semibold">${parseFloat(String(listing.depositAmount)).toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total quantity</span>
                <span className="font-semibold">{listing.totalQuantity ?? 1}</span>
              </div>
              {listing.availableQuantity !== undefined && listing.availableQuantity !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available now</span>
                  <span className={`font-semibold ${(listing.availableQuantity ?? 0) === 0 ? "text-destructive" : "text-green-600"}`}>
                    {listing.availableQuantity}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Requirements */}
          {(listing.requirements || listing.ageRestriction) && (
            <div className="bg-background rounded-2xl border p-5 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" /> Requirements
              </h3>
              {listing.ageRestriction && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Minimum age: <strong>{listing.ageRestriction}+</strong></span>
                </div>
              )}
              {listing.requirements && (
                <p className="text-sm text-muted-foreground">{listing.requirements}</p>
              )}
            </div>
          )}

          {/* Unit Identifiers */}
          <UnitIdentifiersManager listingId={listing.id} quantity={listing.quantity} />

          {/* Add-ons */}
          <div className="bg-background rounded-2xl border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" /> Add-ons
              </h3>
              <Link href={`/admin/listings/${listing.id}/edit`}>
                <button className="text-xs text-primary hover:underline">Manage</button>
              </Link>
            </div>
            {addons.length === 0 ? (
              <p className="text-sm text-muted-foreground">No add-ons configured.</p>
            ) : (
              <div className="space-y-2">
                {addons.map(a => (
                  <div key={a.id} className={`flex items-center justify-between text-sm ${!a.isActive ? "opacity-40" : ""}`}>
                    <div className="flex items-center gap-1.5">
                      <span>{a.name}</span>
                      {a.isRequired && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 rounded-full font-semibold">Required</span>}
                      {!a.isActive && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 rounded-full">Hidden</span>}
                    </div>
                    <span className="font-semibold text-primary">
                      ${a.price.toFixed(2)}{a.priceType === "per_day" ? "/day" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent bookings */}
          <div className="bg-background rounded-2xl border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" /> Recent Bookings
              </h3>
              <Link href={`/admin/bookings?listingId=${listing.id}`}>
                <button className="text-xs text-primary hover:underline">View all</button>
              </Link>
            </div>
            {recentBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings yet.</p>
            ) : (
              <div className="space-y-2">
                {recentBookings.map(b => (
                  <Link key={b.id} href={`/admin/bookings/${b.id}`}>
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{b.customerName}</p>
                        <p className="text-xs text-muted-foreground">{b.startDate} → {b.endDate}</p>
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${BOOKING_STATUS_COLORS[b.status] ?? "bg-muted text-muted-foreground"}`}>
                          {b.status}
                        </span>
                        <p className="text-xs font-bold">${typeof b.totalPrice === "number" ? b.totalPrice.toFixed(2) : parseFloat(String(b.totalPrice ?? 0)).toFixed(2)}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
