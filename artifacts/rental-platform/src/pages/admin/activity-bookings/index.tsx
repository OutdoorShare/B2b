import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { adminPath, getAdminSession } from "@/lib/admin-nav";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Calendar, Clock, Users, Search, ChevronRight, Inbox,
} from "lucide-react";
import { format, parseISO } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

function adminHeaders(): Record<string, string> {
  const session = getAdminSession();
  const slug = session?.tenantSlug ?? "";
  const headers: Record<string, string> = {};
  if (session?.token) headers["x-admin-token"] = session.token;
  if (slug) headers["x-tenant-slug"] = slug;
  return headers;
}

async function fetchBookings() {
  const res = await fetch(`${BASE}/api/activities/bookings`, {
    headers: adminHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load");
  return res.json() as Promise<Array<{
    id: number;
    activityTitle: string;
    customerName: string;
    customerEmail: string;
    selectedDate: string | null;
    selectedTime: string | null;
    guestCount: number;
    totalAmount: number;
    status: string;
    seenByAdmin: boolean;
    createdAt: string;
  }>>;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; dot: string }> = {
  pending: { label: "Pending", variant: "outline", dot: "bg-amber-500" },
  confirmed: { label: "Confirmed", variant: "default", dot: "bg-green-500" },
  active: { label: "Active", variant: "default", dot: "bg-blue-500" },
  completed: { label: "Completed", variant: "secondary", dot: "bg-gray-400" },
  cancelled: { label: "Cancelled", variant: "destructive", dot: "bg-red-500" },
};

const STATUS_TABS = ["all", "pending", "confirmed", "active", "completed", "cancelled"] as const;

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export default function AdminActivityBookings() {
  const [tab, setTab] = useState<typeof STATUS_TABS[number]>("all");
  const [search, setSearch] = useState("");

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["admin-activity-bookings"],
    queryFn: fetchBookings,
    refetchInterval: 30000,
  });

  const filtered = bookings.filter(b => {
    if (tab !== "all" && b.status !== tab) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        b.customerName.toLowerCase().includes(q) ||
        b.customerEmail.toLowerCase().includes(q) ||
        b.activityTitle.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingCount = bookings.filter(b => b.status === "pending" && !b.seenByAdmin).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            Experience Bookings
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold">
                {pendingCount}
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">Manage customer experience booking requests</p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {STATUS_TABS.map(s => {
          const count = s === "all" ? bookings.length : bookings.filter(b => b.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={[
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all capitalize",
                tab === s ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700",
              ].join(" ")}
            >
              {s === "all" ? "All" : STATUS_CONFIG[s]?.label ?? s}
              {count > 0 && (
                <span className={`ml-1.5 text-xs ${tab === s ? "text-gray-600" : "text-gray-400"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, email, or activity…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Inbox className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No bookings found</p>
          <p className="text-gray-400 text-sm mt-1">
            {tab === "all" && !search ? "Bookings from customers will appear here" : "Try adjusting your filters"}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Guest</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Activity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Date & Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Guests</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(b => {
                const sc = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.pending;
                const isNew = b.status === "pending" && !b.seenByAdmin;
                return (
                  <Link key={b.id} href={adminPath(`/activity-bookings/${b.id}`)}>
                    <tr className={`hover:bg-gray-50 transition-colors cursor-pointer ${isNew ? "bg-amber-50/40" : ""}`}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          {isNew && <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />}
                          <div>
                            <p className="font-medium text-sm text-gray-900">{b.customerName}</p>
                            <p className="text-xs text-gray-400">{b.customerEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm text-gray-700 font-medium line-clamp-1">{b.activityTitle}</p>
                        <p className="text-xs text-gray-400">#{b.id}</p>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        {b.selectedDate ? (
                          <div>
                            <div className="flex items-center gap-1 text-sm text-gray-700">
                              <Calendar className="h-3.5 w-3.5 text-gray-400" />
                              {format(parseISO(b.selectedDate), "MMM d, yyyy")}
                            </div>
                            {b.selectedTime && (
                              <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                                <Clock className="h-3 w-3" />
                                {fmtTime(b.selectedTime)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 italic">Open request</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <div className="flex items-center gap-1 text-sm text-gray-700">
                          <Users className="h-3.5 w-3.5 text-gray-400" />
                          {b.guestCount}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <span className="text-sm font-semibold text-gray-900">${b.totalAmount.toFixed(0)}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border ${
                          b.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          b.status === "confirmed" ? "bg-green-50 text-green-700 border-green-200" :
                          b.status === "active" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          b.status === "completed" ? "bg-gray-50 text-gray-600 border-gray-200" :
                          "bg-red-50 text-red-700 border-red-200"
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <ChevronRight className="h-4 w-4 text-gray-300" />
                      </td>
                    </tr>
                  </Link>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
