import { adminPath } from "@/lib/admin-nav";
import { useState, useEffect } from "react";
import { 
  useGetAnalyticsSummary, 
  useGetTopListings,
  useGetBookings,
  getGetAnalyticsSummaryQueryKey,
  getGetTopListingsQueryKey,
  getGetBookingsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, CalendarDays, Package, TrendingUp, Mountain, AlertTriangle, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function adminHeaders(): HeadersInit {
  try {
    const raw = localStorage.getItem("admin_session");
    if (raw) {
      const s = JSON.parse(raw);
      if (s?.token) return { "x-admin-token": s.token };
    }
  } catch { /* ignore */ }
  return {};
}

export default function AdminDashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetAnalyticsSummary({
    query: { queryKey: getGetAnalyticsSummaryQueryKey() }
  });

  const { data: topListings, isLoading: isLoadingTop } = useGetTopListings({
    query: { queryKey: getGetTopListingsQueryKey() }
  });

  const { data: recentBookings, isLoading: isLoadingBookings } = useGetBookings({ status: "pending" }, {
    query: { queryKey: getGetBookingsQueryKey({ status: "pending" }) }
  });

  const [connectStatus, setConnectStatus] = useState<{ connected: boolean; chargesEnabled: boolean } | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/stripe/connect/status`, { headers: adminHeaders() })
      .then(r => r.ok ? r.json() : { connected: false })
      .then(d => setConnectStatus(d))
      .catch(() => setConnectStatus({ connected: false, chargesEnabled: false }));
  }, []);

  const paymentsReady = connectStatus?.connected && connectStatus?.chargesEnabled;
  const showConnectBanner = connectStatus !== null && !paymentsReady;

  if (isLoadingSummary || isLoadingTop || isLoadingBookings) {
    return (
      <div className="space-y-6 animate-pulse">
        <div>
          <div className="h-3 bg-muted rounded w-40 mb-2" />
          <div className="h-7 bg-muted rounded w-32" />
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-muted/40 h-28 p-5 space-y-3">
              <div className="h-3 bg-muted rounded w-24" />
              <div className="h-8 bg-muted rounded w-20" />
              <div className="h-2.5 bg-muted rounded w-32" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-muted/40 h-56 p-5 space-y-3">
            <div className="h-4 bg-muted rounded w-36" />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded" />
            ))}
          </div>
          <div className="rounded-xl border bg-muted/40 h-56 p-5 space-y-3">
            <div className="h-4 bg-muted rounded w-28" />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-0.5">{today}</p>
        <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
      </div>

      {/* ── Stripe Connect required banner ── */}
      {showConnectBanner && (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="mt-0.5 shrink-0 w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-300">Action required: Set up payments to accept bookings</p>
              <p className="text-sm text-amber-800/80 dark:text-amber-400/80 mt-0.5">
                Customers cannot complete bookings until you connect your Stripe account. Payments are sent directly to you after each confirmed rental.
              </p>
            </div>
          </div>
          <Link href={adminPath("/settings?tab=payments")}>
            <Button size="sm" className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white gap-1.5 whitespace-nowrap">
              Connect Stripe <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {/* Revenue */}
        <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-background ring-1 ring-emerald-100 dark:ring-emerald-900/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-5">
            <CardTitle className="text-[12px] font-semibold text-emerald-700/80 dark:text-emerald-400/80 uppercase tracking-wide">Total Revenue</CardTitle>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="text-3xl font-extrabold text-emerald-800 dark:text-emerald-300 tracking-tight">${summary?.totalRevenue.toFixed(2) || '0.00'}</div>
            <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/60 mt-1 font-medium">
              +${summary?.revenueThisMonth.toFixed(2) || '0.00'} this month
            </p>
          </CardContent>
        </Card>

        {/* Active Bookings */}
        <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-background ring-1 ring-blue-100 dark:ring-blue-900/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-5">
            <CardTitle className="text-[12px] font-semibold text-blue-700/80 dark:text-blue-400/80 uppercase tracking-wide">Active Bookings</CardTitle>
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="text-3xl font-extrabold text-blue-800 dark:text-blue-300 tracking-tight">{summary?.activeBookings || 0}</div>
            <p className="text-[11px] text-blue-600/70 dark:text-blue-400/60 mt-1 font-medium">
              {summary?.pendingBookings || 0} pending confirmation
            </p>
          </CardContent>
        </Card>

        {/* Utilization */}
        <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/30 dark:to-background ring-1 ring-violet-100 dark:ring-violet-900/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-5">
            <CardTitle className="text-[12px] font-semibold text-violet-700/80 dark:text-violet-400/80 uppercase tracking-wide">Utilization Rate</CardTitle>
            <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="text-3xl font-extrabold text-violet-800 dark:text-violet-300 tracking-tight">{((summary?.utilization || 0) * 100).toFixed(1)}%</div>
            <p className="text-[11px] text-violet-600/70 dark:text-violet-400/60 mt-1 font-medium">
              Across {summary?.totalListings || 0} listings
            </p>
          </CardContent>
        </Card>

        {/* Avg booking value */}
        <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-background ring-1 ring-amber-100 dark:ring-amber-900/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-5">
            <CardTitle className="text-[12px] font-semibold text-amber-700/80 dark:text-amber-400/80 uppercase tracking-wide">Avg. Booking Value</CardTitle>
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="text-3xl font-extrabold text-amber-800 dark:text-amber-300 tracking-tight">${summary?.averageBookingValue.toFixed(2) || '0.00'}</div>
            <p className="text-[11px] text-amber-600/70 dark:text-amber-400/60 mt-1 font-medium">
              {summary?.totalBookings || 0} all-time bookings
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom panels ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Mountain className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-[15px]">Top Listings</CardTitle>
                <CardDescription className="text-xs">Most profitable this month</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topListings?.slice(0, 5).map((listing, i) => (
                <div key={listing.id} className="flex items-center gap-3 group">
                  <span className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-none truncate">{listing.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {listing.totalBookings} booking{listing.totalBookings !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">${listing.totalRevenue.toFixed(2)}</div>
                </div>
              ))}
              {(!topListings || topListings.length === 0) && (
                <div className="text-sm text-muted-foreground text-center py-6">No listing data yet</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-[15px]">Needs Attention</CardTitle>
                <CardDescription className="text-xs">Bookings awaiting confirmation</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentBookings?.slice(0, 5).map(booking => (
                <Link key={booking.id} href={adminPath(`/bookings/${booking.id}`)}>
                  <div className="flex items-start justify-between gap-2 p-2.5 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-none truncate group-hover:text-primary transition-colors">{booking.customerName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{booking.listingTitle}</p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        {format(new Date(booking.startDate), 'MMM d')} – {format(new Date(booking.endDate), 'MMM d')}
                      </p>
                    </div>
                    <Badge className="shrink-0 bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800 text-[10px] font-semibold px-2">
                      Pending
                    </Badge>
                  </div>
                </Link>
              ))}
              {(!recentBookings || recentBookings.length === 0) && (
                <div className="text-sm text-muted-foreground text-center py-6">All caught up!</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
