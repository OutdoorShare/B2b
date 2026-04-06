import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/context/auth";
import { HostLayout } from "./layout";
import { api } from "@/lib/api";
import {
  Package,
  CalendarDays,
  DollarSign,
  TrendingUp,
  Plus,
  ArrowRight,
  Clock,
  Building2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function HostDashboardPage() {
  const { customer, hostInfo } = useAuth();
  const [, setLocation] = useLocation();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["host-stats", customer?.id],
    queryFn: () => api.host.stats(customer!.id),
    enabled: !!customer && !!hostInfo,
  });

  const { data: listings } = useQuery({
    queryKey: ["host-listings", customer?.id],
    queryFn: () => api.host.listings(customer!.id),
    enabled: !!customer && !!hostInfo,
  });

  const recentListings = listings?.slice(0, 3) ?? [];

  return (
    <HostLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {customer?.name?.split(" ")[0]}
          </h1>
          <p className="text-gray-500 mt-1">Here's how your adventure is performing on OutdoorShare.</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Package}
            label="Active Listings"
            value={isLoading ? "—" : String(stats?.listings.active ?? 0)}
            color="text-primary"
            bg="bg-primary/10"
          />
          <StatCard
            icon={CalendarDays}
            label="Total Bookings"
            value={isLoading ? "—" : String(stats?.bookings.total ?? 0)}
            color="text-blue-600"
            bg="bg-blue-50"
          />
          <StatCard
            icon={Clock}
            label="Pending"
            value={isLoading ? "—" : String(stats?.bookings.pending ?? 0)}
            color="text-amber-600"
            bg="bg-amber-50"
          />
          <StatCard
            icon={DollarSign}
            label="Total Revenue"
            value={isLoading ? "—" : `$${parseFloat(stats?.bookings.totalRevenue ?? "0").toFixed(0)}`}
            color="text-emerald-600"
            bg="bg-emerald-50"
          />
        </div>

        {/* Upgrade to Business banner */}
        <div className="mb-8 rounded-2xl overflow-hidden border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex items-center gap-6 px-6 py-5">
          <div className="bg-primary/15 rounded-xl p-3 flex-shrink-0 hidden sm:block">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">Ready to grow beyond a personal host?</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Register as a business to get your own branded storefront, custom domain, team management, and full analytics.
            </p>
          </div>
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); window.open("/", "_blank"); }}
            className="flex-shrink-0 flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            Register as a Business
            <ChevronRight className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Quick actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Recent Listings</h2>
              <button
                onClick={() => setLocation("/host/listings")}
                className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {recentListings.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400 mb-4">No listings yet</p>
                <Button
                  size="sm"
                  onClick={() => setLocation("/host/listings/new")}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add First Listing
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentListings.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => setLocation(`/host/listings/${l.id}/edit`)}
                  >
                    {l.imageUrls[0] ? (
                      <img src={l.imageUrls[0]} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Package className="h-4 w-4 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{l.title}</p>
                      <p className="text-xs text-gray-400">${l.pricePerDay}/day</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      l.status === "active" ? "bg-emerald-100 text-emerald-700" :
                      l.status === "draft" ? "bg-gray-100 text-gray-600" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {l.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <QuickAction
                label="Add a new listing"
                description="List your outdoor adventure on OutdoorShare"
                icon={Plus}
                onClick={() => setLocation("/host/listings/new")}
              />
              <QuickAction
                label="View bookings"
                description="See who's renting your adventure"
                icon={CalendarDays}
                onClick={() => setLocation("/host/bookings")}
              />
              <QuickAction
                label="Update your profile"
                description="Edit your host name and location"
                icon={TrendingUp}
                onClick={() => setLocation("/host/settings")}
              />
            </div>
          </div>
        </div>
      </div>
    </HostLayout>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function QuickAction({ label, description, icon: Icon, onClick }: {
  label: string;
  description: string;
  icon: React.ElementType;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-primary/30 hover:bg-primary/5 transition-colors text-left"
    >
      <div className="bg-primary/10 p-2 rounded-lg flex-shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-gray-300 ml-auto flex-shrink-0" />
    </button>
  );
}
