import { useState } from "react";
import { 
  useGetRevenueAnalytics, 
  useGetBookingStatusBreakdown,
  getGetRevenueAnalyticsQueryKey,
  getGetBookingStatusBreakdownQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Area, 
  AreaChart, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from "recharts";

const PIE_COLORS = ['#0f5132', '#3b82f6', '#f59e0b', '#ef4444', '#64748b'];

export default function AdminAnalytics() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "12m">("30d");

  const { data: revenueData, isLoading: isLoadingRevenue } = useGetRevenueAnalytics(
    { period },
    { query: { queryKey: getGetRevenueAnalyticsQueryKey({ period }) } }
  );

  const { data: statusBreakdown, isLoading: isLoadingStatus } = useGetBookingStatusBreakdown({
    query: { queryKey: getGetBookingStatusBreakdownQueryKey() }
  });

  return (
    <div className="space-y-8">
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-5">
          <CardHeader>
            <CardTitle>Revenue Over Time</CardTitle>
            <CardDescription>Daily revenue generated across all listings.</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {isLoadingRevenue ? (
              <div className="h-[350px] w-full flex items-center justify-center text-muted-foreground">Loading chart...</div>
            ) : (
              <div className="h-[350px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0f5132" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#0f5132" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="date" 
                      stroke="#888888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(val) => val.substring(5, 10)} 
                    />
                    <YAxis 
                      stroke="#888888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(value) => `$${value}`} 
                    />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#0f5132" 
                      fillOpacity={1} 
                      fill="url(#colorRevenue)" 
                    />
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
              <div className="h-[250px] w-full flex items-center justify-center text-muted-foreground">Loading chart...</div>
            ) : (
              <div className="h-[250px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusBreakdown || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="status"
                    >
                      {(statusBreakdown || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [value, name.charAt(0).toUpperCase() + name.slice(1)]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            
            <div className="mt-4 space-y-2">
              {statusBreakdown?.map((stat, idx) => (
                <div key={stat.status} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                    <span className="capitalize">{stat.status}</span>
                  </div>
                  <div className="font-medium">{stat.count} ({stat.percentage.toFixed(1)}%)</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
