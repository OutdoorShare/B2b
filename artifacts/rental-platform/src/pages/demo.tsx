import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  Tent, ExternalLink, RefreshCcw, Package, CalendarDays,
  User, ArrowRight, CheckCircle2, Clock, XCircle, Activity,
  Shield, LayoutDashboard, ShoppingBag, Play, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type BizProfile = { name: string; tagline?: string; logoUrl?: string; location?: string; primaryColor?: string };
type Listing = { id: number; title: string; pricePerDay: number; status: string; imageUrls?: string[]; categoryName?: string; condition?: string; quantity: number };
type Booking = { id: number; customerName: string; customerEmail: string; startDate: string; endDate: string; totalPrice: number; status: string; source: string; createdAt: string; listingId: number };
type Tenant = { id: number; name: string; slug: string; plan: string; status: string };

const STATUS_ICON: Record<string, React.ReactNode> = {
  confirmed: <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />,
  active: <Activity className="w-3.5 h-3.5 text-green-400" />,
  pending: <Clock className="w-3.5 h-3.5 text-amber-400" />,
  completed: <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />,
  cancelled: <XCircle className="w-3.5 h-3.5 text-red-400" />,
};

const STATUS_COLOR: Record<string, string> = {
  confirmed: "bg-blue-500/15 text-blue-300",
  active: "bg-green-500/15 text-green-300",
  pending: "bg-amber-500/15 text-amber-300",
  completed: "bg-slate-500/15 text-slate-300",
  cancelled: "bg-red-500/15 text-red-300",
};

export default function DemoPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [profile, setProfile] = useState<BizProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // ── Fetch business profile & listings (public) ─────────────────────────
  useEffect(() => {
    fetch(`${BASE}/api/business`).then(r => r.json()).then(setProfile).catch(() => {});
    fetch(`${BASE}/api/listings?status=active`).then(r => r.json()).then((data: Listing[]) => {
      setListings(Array.isArray(data) ? data.slice(0, 6) : []);
    }).catch(() => {});
  }, []);

  // ── Fetch tenants via super admin API (if token present) ───────────────
  useEffect(() => {
    const token = localStorage.getItem("superadmin_token");
    if (!token) return;
    fetch(`${BASE}/api/superadmin/tenants`, {
      headers: { "x-superadmin-token": token },
    }).then(r => r.json()).then((data) => {
      if (Array.isArray(data)) setTenants(data.filter((t: Tenant) => t.status === "active").slice(0, 8));
    }).catch(() => {});
  }, []);

  // ── Fetch bookings (admin API — no auth required in this build) ────────
  const loadBookings = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/bookings?limit=20`);
      const data = await r.json();
      if (Array.isArray(data)) setBookings(data);
    } catch { } finally { setLoadingBookings(false); }
  }, []);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(loadBookings, 5000);
    return () => clearInterval(t);
  }, [autoRefresh, loadBookings]);

  const getSlugForListing = (l: Listing) => {
    if (tenants.length > 0) return tenants[0].slug;
    if (profile?.name) return profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return "demo";
  };

  const primarySlug = tenants[0]?.slug || (profile?.name ? profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "demo");

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Top Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-amber-300 text-sm font-medium">
          <Play className="w-3.5 h-3.5 fill-amber-300" />
          Test Environment — changes here affect your live database
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-slate-800 gap-1.5 h-7">
            <Link href="/">← Back to Home</Link>
          </Button>
        </div>
      </div>

      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/60 px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
            <Tent className="w-5 h-5 text-[#3ab549]" />
          </div>
          <div>
            <h1 className="font-black text-lg text-white">OutdoorShare Demo</h1>
            <p className="text-slate-500 text-xs">Booking flow test environment</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-1.5">
            <a href="/admin" target="_blank" rel="noopener noreferrer">
              <LayoutDashboard className="w-3.5 h-3.5" /> Admin Panel <ExternalLink className="w-3 h-3 opacity-50" />
            </a>
          </Button>
          <Button asChild size="sm" className="bg-[#3ab549] hover:bg-[#2e9a3d] text-white gap-1.5">
            <Link href={`/${primarySlug}`}>
              <ShoppingBag className="w-3.5 h-3.5" /> Customer Storefront <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">

        {/* ── LEFT: Customer View ─────────────────────────────────────────── */}
        <div className="flex flex-col p-6 space-y-5 overflow-y-auto max-h-[calc(100vh-120px)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#29b4d4]" /> Customer View
              </h2>
              <p className="text-slate-500 text-xs mt-0.5">What renters see when they visit your storefront</p>
            </div>
          </div>

          {/* Company info card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
            {profile?.logoUrl ? (
              <img src={profile.logoUrl} alt={profile.name} className="w-12 h-12 rounded-lg object-contain bg-white p-1" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                <Tent className="w-6 h-6 text-[#3ab549]" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white truncate">{profile?.name || "Your Company"}</p>
              {profile?.tagline && <p className="text-slate-400 text-xs truncate">{profile.tagline}</p>}
              {profile?.location && <p className="text-slate-500 text-xs">{profile.location}</p>}
            </div>
            <Button asChild size="sm" className="bg-[#3ab549] hover:bg-[#2e9a3d] text-white shrink-0 gap-1.5">
              <Link href={`/${primarySlug}`}>Open Store <ArrowRight className="w-3.5 h-3.5" /></Link>
            </Button>
          </div>

          {/* Available slugs */}
          {tenants.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Active Storefronts</p>
              <div className="space-y-1.5">
                {tenants.map(t => (
                  <div key={t.id} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-white font-semibold text-sm">{t.name}</span>
                      <span className="ml-2 text-slate-500 font-mono text-xs">/{t.slug}</span>
                    </div>
                    <Button asChild size="sm" variant="ghost" className="text-slate-400 hover:text-white hover:bg-slate-800 gap-1 h-7 text-xs">
                      <Link href={`/${t.slug}`}>Visit <ChevronRight className="w-3 h-3" /></Link>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Listings preview */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Package className="w-3 h-3" />Available Products ({listings.length})</p>
              <Button asChild size="sm" variant="ghost" className="text-slate-400 hover:text-white hover:bg-slate-800 gap-1 h-6 text-xs">
                <Link href={`/${primarySlug}`}>See All <ArrowRight className="w-3 h-3" /></Link>
              </Button>
            </div>

            {listings.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 border-dashed rounded-xl p-8 text-center">
                <Package className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No active listings yet</p>
                <Button asChild size="sm" className="mt-3 bg-[#3ab549] hover:bg-[#2e9a3d] text-white gap-1.5">
                  <a href="/admin/listings/new" target="_blank" rel="noopener noreferrer">
                    <Package className="w-3.5 h-3.5" /> Create a Listing
                  </a>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {listings.map(l => (
                  <Link key={l.id} href={`/${primarySlug}/listings/${l.id}`}>
                    <div className="group bg-slate-900 border border-slate-800 hover:border-[#3ab549]/50 rounded-xl overflow-hidden transition-all cursor-pointer">
                      <div className="aspect-video bg-slate-800 relative overflow-hidden">
                        {l.imageUrls?.[0] ? (
                          <img src={l.imageUrls[0]} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 text-slate-700" />
                          </div>
                        )}
                        {l.categoryName && (
                          <span className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-widest bg-black/60 text-white px-1.5 py-0.5 rounded-full">
                            {l.categoryName}
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="font-semibold text-white text-sm leading-snug line-clamp-1">{l.title}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[#29b4d4] font-bold text-sm">${l.pricePerDay.toFixed(2)}<span className="text-slate-500 font-normal text-xs">/day</span></p>
                          <span className="text-xs text-slate-500">Qty: {l.quantity}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick access */}
          <div className="border border-slate-800 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Quick Test Links</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button asChild variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800 justify-start gap-2">
                <Link href={`/${primarySlug}`}><ShoppingBag className="w-3.5 h-3.5 text-[#29b4d4]" />Browse as Customer</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800 justify-start gap-2">
                <a href="/admin/bookings/new" target="_blank" rel="noopener noreferrer"><CalendarDays className="w-3.5 h-3.5 text-blue-400" />Admin: New Booking</a>
              </Button>
              <Button asChild variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800 justify-start gap-2">
                <a href="/admin/listings" target="_blank" rel="noopener noreferrer"><Package className="w-3.5 h-3.5 text-violet-400" />Admin: Listings</a>
              </Button>
              <Button asChild variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800 justify-start gap-2">
                <a href="/admin/analytics" target="_blank" rel="noopener noreferrer"><Activity className="w-3.5 h-3.5 text-amber-400" />Admin: Analytics</a>
              </Button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Admin Booking View ───────────────────────────────────── */}
        <div className="flex flex-col p-6 space-y-4 overflow-y-auto max-h-[calc(100vh-120px)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-violet-400" /> Admin View — Recent Bookings
              </h2>
              <p className="text-slate-500 text-xs mt-0.5">Live feed · auto-refreshes every 5 seconds</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoRefresh(v => !v)}
                className={`text-xs px-2 py-1 rounded font-medium transition-colors ${autoRefresh ? "bg-green-900/40 text-green-300 hover:bg-green-900/60" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
              >
                {autoRefresh ? "● Live" : "○ Paused"}
              </button>
              <button onClick={loadBookings} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800">
                <RefreshCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {(["pending","confirmed","active"] as const).map(status => {
              const count = bookings.filter(b => b.status === status).length;
              return (
                <div key={status} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-center">
                  <p className={`text-lg font-black ${status === "pending" ? "text-amber-300" : status === "confirmed" ? "text-blue-300" : "text-green-300"}`}>{count}</p>
                  <p className="text-slate-500 text-[11px] capitalize">{status}</p>
                </div>
              );
            })}
          </div>

          {/* Bookings list */}
          {loadingBookings ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-900 rounded-xl animate-pulse" />)}
            </div>
          ) : bookings.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 border-dashed rounded-xl p-10 text-center flex-1">
              <CalendarDays className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 font-semibold">No bookings yet</p>
              <p className="text-slate-600 text-sm mt-1">Make a booking as a customer to see it appear here</p>
              <Button asChild size="sm" className="mt-4 bg-[#3ab549] hover:bg-[#2e9a3d] text-white gap-1.5">
                <Link href={`/${primarySlug}`}>Try Booking as Customer <ArrowRight className="w-3.5 h-3.5" /></Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {bookings.map(b => (
                <a key={b.id} href={`/admin/bookings/${b.id}`} target="_blank" rel="noopener noreferrer" className="block">
                  <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl px-4 py-3 transition-colors group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-white text-sm truncate">{b.customerName}</p>
                          <p className="text-slate-500 text-xs truncate">{b.customerEmail}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize flex items-center gap-1 ${STATUS_COLOR[b.status] ?? "bg-slate-700 text-slate-300"}`}>
                          {STATUS_ICON[b.status]}{b.status}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />{b.startDate} → {b.endDate}
                      </span>
                      <span className="font-bold text-white">${b.totalPrice.toFixed(2)}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-600 flex items-center gap-2">
                      <span className="capitalize">via {b.source}</span>
                      <span>·</span>
                      <span>{format(new Date(b.createdAt), "MMM d, h:mma")}</span>
                    </div>
                  </div>
                </a>
              ))}
              <div className="pt-2 flex justify-center">
                <Button asChild variant="ghost" size="sm" className="text-slate-500 hover:text-white hover:bg-slate-800 gap-1.5">
                  <a href="/admin/bookings" target="_blank" rel="noopener noreferrer">
                    View All in Admin <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
