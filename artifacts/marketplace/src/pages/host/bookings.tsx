import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth";
import { HostLayout } from "./layout";
import { api } from "@/lib/api";
import { CalendarDays, Package } from "lucide-react";
import { format, parseISO } from "date-fns";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  completed: "bg-blue-100 text-blue-700",
  active: "bg-purple-100 text-purple-700",
};

function formatDate(d: string) {
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

export function HostBookingsPage() {
  const { customer } = useAuth();

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["host-bookings", customer?.id],
    queryFn: () => api.host.bookings(customer!.id),
    enabled: !!customer,
  });

  return (
    <HostLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-500 text-sm mt-0.5">{bookings.length} booking{bookings.length !== 1 ? "s" : ""} for your listings</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 h-24 animate-pulse" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <CalendarDays className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-700 mb-2">No bookings yet</h2>
            <p className="text-gray-400 text-sm">When renters book your adventure, their bookings will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking) => (
              <div key={booking.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start gap-4">
                  {booking.listingImage ? (
                    <img
                      src={booking.listingImage}
                      alt={booking.listingTitle}
                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 text-gray-400" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">{booking.listingTitle}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 capitalize ${STATUS_STYLES[booking.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {booking.status}
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 space-y-0.5">
                      <p>
                        <span className="font-medium text-gray-700">{booking.customerName}</span>
                        {booking.customerEmail && <span> · {booking.customerEmail}</span>}
                        {booking.customerPhone && <span> · {booking.customerPhone}</span>}
                      </p>
                      <p>
                        {formatDate(booking.startDate)} → {formatDate(booking.endDate)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-900">${parseFloat(booking.totalPrice).toFixed(2)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Booked {formatDate(booking.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </HostLayout>
  );
}
