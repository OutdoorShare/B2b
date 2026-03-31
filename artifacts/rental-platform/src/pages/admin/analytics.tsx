import { useState, useEffect } from "react";
import {
  useGetRevenueAnalytics,
  useGetBookingStatusBreakdown,
  getGetRevenueAnalyticsQueryKey,
  getGetBookingStatusBreakdownQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Area, AreaChart, Bar, BarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, Legend,
  CartesianGrid
} from "recharts";
import { MapPin, Tag, TrendingUp, Users } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const PIE_COLORS  = ["#0f5132", "#3b82f6", "#f59e0b", "#ef4444", "#64748b"];
const BAR_COLOR   = "#0f5132";
const LOC_COLORS  = ["#0f5132","#166534","#15803d","#16a34a","#22c55e","#4ade80","#86efac","#bbf7d0"];

type LocationMode = "city" | "state";

export default function AdminAnalytics() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "12m">("30d");
  const [locationMode, setLocationMode] = useState<LocationMode>("state");

  // ── Existing data ──────────────────────────────────────────────────────
  const { data: revenueData,   isLoading: isLoadingRevenue } = useGetRevenueAnalytics(
    { period },
    { query: { queryKey: getGetRevenueAnalyticsQueryKey({ period }) } }
  );
  const { data: statusBreakdown, isLoading: isLoadingStatus } = useGetBookingStatusBreakdown({
    query: { queryKey: getGetBookingStatusBreakdownQueryKey() }
  });

  // ── Booking Volume (custom endpoint) ──────────────────────────────────
  const [volumeData, setVolumeData]     = useState<{ date: string; bookings: number }[]>([]);
  const [volumeLoading, setVolumeLoading] = useState(true);

  useEffect(() => {
    setVolumeLoading(true);
    fetch(`${BASE}/api/analytics/booking-volume?period=${period}`)
      .then(r => r.json())
      .then(d => { setVolumeData(d); setVolumeLoading(false); })
      .catch(() => setVolumeLoading(false));
  }, [period]);

  // ── Renter Locations (custom endpoint) ────────────────────────────────
  const [locationData, setLocationData]   = useState<{ byState: any[]; byCity: any[] }>({ byState: [], byCity: [] });
  const [locationLoading, setLocationLoading] = useState(true);

  useEffect(() => {
    setLocationLoading(true);
    fetch(`${BASE}/api/analytics/renter-locations`)
      .then(r => r.json())
      .then(d => { setLocationData(d); setLocationLoading(false); })
      .catch(() => setLocationLoading(false));
  }, []);

  // ── Category Breakdown (custom endpoint) ──────────────────────────────────
  type CategoryStat = { name: string; slug: string; listings: number; bookings: number; revenue: number };
  const [categoryData, setCategoryData] = useState<CategoryStat[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(true);

  useEffect(() => {
    setCategoryLoading(true);
    fetch(`${BASE}/api/analytics/category-breakdown`)
      .then(r => r.json())
      .then(d => { setCategoryData(Array.isArray(d) ? d : []); setCategoryLoading(false); })
      .catch(() => setCategoryLoading(false));
  }, []);

  const activeLocationData = (locationMode === "state" ? locationData.byState : locationData.byCity).slice(0, 10);
  const hasLocationData = activeLocationData.length > 0;

  // Tick formatter for volume x-axis
  const volumeTick = (val: string) =>
    period === "12m" ? val.substring(5) : val.substring(5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground mt-1">Deep dive into your rental performance</p>
        </div>
        <div className="w-48">
          <Select value={period} onValueChange={(val: any) => setPeriod(val)}>
            <SelectTrigger data-testid="select-period">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="12m">Last 12 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 1: Revenue + Status */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-5">
          <CardHeader>
            <CardTitle>Revenue Over Time</CardTitle>
            <CardDescription>Daily revenue generated across all listings.</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {isLoadingRevenue ? (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">Loading chart...</div>
            ) : (
              <div className="h-[350px] mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#0f5132" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0f5132" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => v.substring(5)} />
                    <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]} labelFormatter={l => `Date: ${l}`} />
                    <Area type="monotone" dataKey="revenue" stroke="#0f5132" fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Booking Status</CardTitle>
            <CardDescription>Breakdown of all-time bookings.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingStatus ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">Loading chart...</div>
            ) : (
              <div className="h-[250px] mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusBreakdown || []} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="count" nameKey="status">
                      {(statusBreakdown || []).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number, n: string) => [v, n.charAt(0).toUpperCase() + n.slice(1)]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-4 space-y-2">
              {statusBreakdown?.map((stat, idx) => (
                <div key={stat.status} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                    <span className="capitalize">{stat.status}</span>
                  </div>
                  <span className="font-medium">{stat.count} ({stat.percentage.toFixed(1)}%)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Booking Volume + Renter Locations */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Booking Volume */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Booking Volume
              </CardTitle>
              <CardDescription className="mt-1">Number of bookings started per {period === "12m" ? "month" : "day"}.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pl-2">
            {volumeLoading ? (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">Loading chart...</div>
            ) : volumeData.length === 0 ? (
              <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                <TrendingUp className="w-10 h-10 opacity-20" />
                <p>No booking data for this period</p>
              </div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="date" stroke="#888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={volumeTick} interval="preserveStartEnd" />
                    <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      formatter={(v: number) => [v, "Bookings"]}
                      labelFormatter={l => `Date: ${l}`}
                      cursor={{ fill: "rgba(15,81,50,0.06)" }}
                    />
                    <Bar dataKey="bookings" fill={BAR_COLOR} radius={[3, 3, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Renter Locations */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Renter Locations
              </CardTitle>
              <CardDescription className="mt-1">Where your customers are booking from.</CardDescription>
            </div>
            {/* City / State toggle */}
            <div className="flex rounded-md border overflow-hidden shrink-0">
              <button
                onClick={() => setLocationMode("state")}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  locationMode === "state" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                By State
              </button>
              <button
                onClick={() => setLocationMode("city")}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  locationMode === "city" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                By City
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {locationLoading ? (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">Loading chart...</div>
            ) : !hasLocationData ? (
              <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Users className="w-10 h-10 opacity-20" />
                <div className="text-center">
                  <p className="font-medium text-sm">No location data yet</p>
                  <p className="text-xs mt-1">Location data is collected when customers add a billing address during checkout.</p>
                </div>
              </div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={activeLocationData}
                    layout="vertical"
                    margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis type="number" stroke="#888" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="location"
                      stroke="#888"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={locationMode === "city" ? 110 : 80}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(v: number) => [v, "Bookings"]}
                      cursor={{ fill: "rgba(15,81,50,0.06)" }}
                    />
                    <Bar dataKey="count" radius={[0, 3, 3, 0]} maxBarSize={24}>
                      {activeLocationData.map((_, i) => (
                        <Cell key={i} fill={LOC_COLORS[i % LOC_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Category Breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Category bar chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              Bookings by Category
            </CardTitle>
            <CardDescription>Total bookings across each equipment type.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {categoryLoading ? (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">Loading chart...</div>
            ) : categoryData.length === 0 ? (
              <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Tag className="w-10 h-10 opacity-20" />
                <p>No category data yet</p>
              </div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis type="number" stroke="#888" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" stroke="#888" fontSize={11} tickLine={false} axisLine={false} width={100} />
                    <Tooltip
                      formatter={(v: number) => [v, "Bookings"]}
                      cursor={{ fill: "rgba(15,81,50,0.06)" }}
                    />
                    <Bar dataKey="bookings" fill={BAR_COLOR} radius={[0, 3, 3, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category summary table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              Category Summary
            </CardTitle>
            <CardDescription>Listings, bookings, and revenue per category.</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryLoading ? (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">Loading...</div>
            ) : categoryData.length === 0 ? (
              <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Tag className="w-10 h-10 opacity-20" />
                <p>No category data yet</p>
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-left py-2 font-medium">Category</th>
                      <th className="text-right py-2 font-medium">Listings</th>
                      <th className="text-right py-2 font-medium">Bookings</th>
                      <th className="text-right py-2 font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryData.map((cat) => (
                      <tr key={cat.slug} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 font-medium">{cat.name}</td>
                        <td className="py-2.5 text-right text-muted-foreground">{cat.listings}</td>
                        <td className="py-2.5 text-right text-muted-foreground">{cat.bookings}</td>
                        <td className="py-2.5 text-right font-medium">${cat.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
