import { 
  useGetAnalyticsSummary, 
  useGetTopListings,
  useGetBookings,
  getGetAnalyticsSummaryQueryKey,
  getGetTopListingsQueryKey,
  getGetBookingsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, CalendarDays, Package, TrendingUp, Tent } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

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

  if (isLoadingSummary || isLoadingTop || isLoadingBookings) {
    return <div className="p-8">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground mt-1">Overview of your rental business</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary?.totalRevenue.toFixed(2) || '0.00'}</div>
            <p className="text-xs text-muted-foreground">
              +${summary?.revenueThisMonth.toFixed(2) || '0.00'} this month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Bookings</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.activeBookings || 0}</div>
            <p className="text-xs text-muted-foreground">
              {summary?.pendingBookings || 0} pending confirmation
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilization Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{((summary?.utilization || 0) * 100).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Of {summary?.totalListings || 0} total listings
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Booking Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary?.averageBookingValue.toFixed(2) || '0.00'}</div>
            <p className="text-xs text-muted-foreground">
              Across {summary?.totalBookings || 0} all-time bookings
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Top Performing Listings</CardTitle>
            <CardDescription>Your most profitable listings this month.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topListings?.slice(0, 5).map(listing => (
                <div key={listing.id} className="flex items-center">
                  <div className="bg-primary/10 p-2 rounded-md mr-4">
                    <Tent className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <p className="text-sm font-medium leading-none">{listing.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {listing.totalBookings} bookings
                    </p>
                  </div>
                  <div className="font-medium">${listing.totalRevenue.toFixed(2)}</div>
                </div>
              ))}
              {(!topListings || topListings.length === 0) && (
                <div className="text-sm text-muted-foreground text-center py-4">No data available yet</div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Pending Action</CardTitle>
            <CardDescription>Recent bookings requiring your attention.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentBookings?.slice(0, 5).map(booking => (
                <div key={booking.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                  <div className="space-y-1">
                    <Link href={`/admin/bookings/${booking.id}`} className="text-sm font-medium leading-none hover:underline">
                      {booking.customerName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {booking.listingTitle}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(booking.startDate), 'MMM d')} - {format(new Date(booking.endDate), 'MMM d')}
                    </p>
                  </div>
                  <Badge variant="secondary">Pending</Badge>
                </div>
              ))}
              {(!recentBookings || recentBookings.length === 0) && (
                <div className="text-sm text-muted-foreground text-center py-4">No pending bookings</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
