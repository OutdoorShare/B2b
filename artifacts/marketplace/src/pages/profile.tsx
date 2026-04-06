import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, LogOut, Calendar, MapPin, ExternalLink, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

const API_UPLOAD_BASE = "/api/uploads/";
function resolveImage(url: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_UPLOAD_BASE}${url.split("/").pop()}`;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
};

export function ProfilePage({ onAuthOpen }: { onAuthOpen: () => void }) {
  const { customer, logout } = useAuth();
  const [, setLocation] = useLocation();

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["renter-bookings", customer?.id],
    queryFn: () => api.marketplace.renterBookings(customer!.id),
    enabled: !!customer,
  });

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-5xl mb-4">👤</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Sign in to view your profile</h2>
          <p className="text-gray-500 mb-6">Track bookings across all OutdoorShare companies</p>
          <Button onClick={onAuthOpen} className="bg-green-700 hover:bg-green-800 text-white">Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Browse
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Profile header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-green-700 flex items-center justify-center text-white font-bold text-xl">
                {customer.name[0]?.toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{customer.name}</h1>
                <p className="text-sm text-gray-500">{customer.email}</p>
                {customer.phone && <p className="text-sm text-gray-400">{customer.phone}</p>}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={logout} className="gap-2 text-red-600 hover:text-red-700 hover:border-red-300">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Bookings */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-600" />
            My Bookings
            {bookings && <span className="text-sm font-normal text-gray-400">({bookings.length})</span>}
          </h2>

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
                  <div className="flex gap-4">
                    <div className="h-20 w-24 bg-gray-200 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/2" />
                      <div className="h-3 bg-gray-200 rounded w-1/3" />
                      <div className="h-3 bg-gray-200 rounded w-1/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : bookings && bookings.length > 0 ? (
            <div className="space-y-4">
              {bookings.map(booking => (
                <div key={booking.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
                  <div className="flex gap-4 items-start">
                    <div className="h-20 w-24 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100">
                      {booking.listingImage ? (
                        <img src={resolveImage(booking.listingImage)} alt={booking.listingTitle} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">🏕️</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-800 text-sm line-clamp-1">{booking.listingTitle}</h3>
                        <Badge className={`text-xs ${statusColors[booking.status] || "bg-gray-100 text-gray-700"}`}>
                          {booking.status}
                        </Badge>
                      </div>
                      {booking.businessName && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                          {booking.businessLogoUrl && (
                            <img src={resolveImage(booking.businessLogoUrl)} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
                          )}
                          <span>{booking.businessName}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {format(new Date(booking.startDate), "MMM d")} – {format(new Date(booking.endDate), "MMM d, yyyy")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-semibold text-gray-800">${parseFloat(booking.totalPrice).toFixed(2)}</span>
                        {booking.tenantSlug && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-green-700 hover:text-green-800 gap-1 pr-0"
                            onClick={() => window.open(`/${booking.tenantSlug}`, "_blank")}
                          >
                            View company <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
              <div className="text-4xl mb-3">📋</div>
              <h3 className="font-semibold text-gray-700 mb-1">No bookings yet</h3>
              <p className="text-sm text-gray-400 mb-5">When you book a rental, it'll appear here</p>
              <Button onClick={() => setLocation("/")} className="bg-green-700 hover:bg-green-800 text-white">Browse Listings</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
