import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth";
import { HostLayout } from "./layout";
import { api, type HostBooking } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  CalendarDays, List, ChevronLeft, ChevronRight,
  Search, X, Package, CheckCircle, MoreHorizontal,
  Mail, Phone, StickyNote, ExternalLink,
} from "lucide-react";
import {
  format, startOfDay, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addDays, addMonths, subMonths,
  isSameMonth, isSameDay, parseISO, differenceInDays,
} from "date-fns";

// ─── Constants ────────────────────────────────────────────────────────────────

type ViewMode = "list" | "calendar";
type TabKey   = "recent" | "upcoming" | "cancelled" | "all";

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-100  text-amber-900  border-amber-300",
  confirmed: "bg-blue-100   text-blue-900   border-blue-300",
  active:    "bg-green-100  text-green-900  border-green-300",
  completed: "bg-gray-100   text-gray-600   border-gray-300",
  cancelled: "bg-red-100    text-red-700    border-red-300",
};

const STATUS_DOT: Record<string, string> = {
  pending:   "bg-amber-400",
  confirmed: "bg-blue-500",
  active:    "bg-green-500",
  completed: "bg-gray-400",
  cancelled: "bg-red-400",
};

const STATUS_BADGE: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  active:    "bg-green-100 text-green-800 border-green-200",
  completed: "bg-gray-100 text-gray-700 border-gray-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "recent",    label: "Recent" },
  { key: "upcoming",  label: "Upcoming" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all",       label: "All" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: string) {
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

function getRentalStatus(startStr: string, endStr: string, status: string) {
  const skipped = ["cancelled", "completed", "no_show"];
  if (skipped.includes(status)) return null;
  const today = startOfDay(new Date());
  const start = startOfDay(new Date(startStr + "T00:00:00"));
  const end   = startOfDay(new Date(endStr   + "T00:00:00"));
  const daysToStart = differenceInDays(start, today);
  const daysToEnd   = differenceInDays(end,   today);
  const totalDays   = Math.max(1, differenceInDays(end, start));
  const elapsed     = Math.max(0, differenceInDays(today, start));
  const pct         = Math.min(100, Math.round((elapsed / totalDays) * 100));
  if (daysToStart > 1)  return { label: `Starts in ${daysToStart}d`,  color: "text-blue-600 bg-blue-50 border-blue-200",    pct: 0,   bar: "bg-blue-400" };
  if (daysToStart === 1) return { label: "Starts tomorrow",            color: "text-blue-600 bg-blue-50 border-blue-200",    pct: 0,   bar: "bg-blue-400" };
  if (daysToStart === 0) return { label: "Pickup day!",                color: "text-green-700 bg-green-50 border-green-200", pct: 0,   bar: "bg-green-500" };
  if (daysToEnd > 1)    return { label: `${daysToEnd}d remaining`,    color: "text-green-700 bg-green-50 border-green-200", pct,      bar: "bg-green-500" };
  if (daysToEnd === 1)  return { label: "Returns tomorrow",            color: "text-amber-700 bg-amber-50 border-amber-200", pct,      bar: "bg-amber-500" };
  if (daysToEnd === 0)  return { label: "Due back today",              color: "text-amber-700 bg-amber-50 border-amber-200", pct: 100, bar: "bg-amber-500" };
  return                       { label: `Overdue ${Math.abs(daysToEnd)}d`, color: "text-red-700 bg-red-50 border-red-300",    pct: 100, bar: "bg-red-500" };
}

// ─── Booking Detail Card ──────────────────────────────────────────────────────

function BookingDetailCard({
  booking,
  onClose,
  onStatusChange,
}: {
  booking: HostBooking;
  onClose: () => void;
  onStatusChange: (id: number, status: string) => void;
}) {
  const ts = getRentalStatus(booking.startDate, booking.endDate, booking.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header image + status */}
        <div className="relative">
          {booking.listingImage ? (
            <img src={booking.listingImage} alt={booking.listingTitle} className="w-full h-32 object-cover" />
          ) : (
            <div className="w-full h-32 bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
              <Package className="h-10 w-10 text-green-400" />
            </div>
          )}
          <button onClick={onClose} className="absolute top-2 right-2 bg-black/40 text-white rounded-full p-1 hover:bg-black/60">
            <X className="h-4 w-4" />
          </button>
          <span className={`absolute bottom-2 left-3 text-xs font-semibold px-2.5 py-0.5 rounded-full border capitalize ${STATUS_BADGE[booking.status] ?? "bg-gray-100 text-gray-700"}`}>
            {booking.status}
          </span>
        </div>

        <div className="p-5 space-y-4">
          {/* Listing + ID */}
          <div>
            <h3 className="font-bold text-gray-900 text-lg leading-tight">{booking.listingTitle}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Booking #{booking.id}</p>
          </div>

          {/* Dates */}
          <div className="flex items-center gap-3 text-sm bg-gray-50 rounded-xl p-3">
            <CalendarDays className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="font-medium text-gray-900">{fmt(booking.startDate)} → {fmt(booking.endDate)}</p>
              {ts && (
                <div className="mt-1.5 space-y-1">
                  <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border ${ts.color}`}>{ts.label}</span>
                  {ts.pct > 0 && (
                    <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${ts.bar}`} style={{ width: `${ts.pct}%` }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Customer */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</p>
            <p className="font-medium text-gray-900">{booking.customerName}</p>
            {booking.customerEmail && (
              <a href={`mailto:${booking.customerEmail}`} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                <Mail className="h-3.5 w-3.5" />{booking.customerEmail}
              </a>
            )}
            {booking.customerPhone && (
              <a href={`tel:${booking.customerPhone}`} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                <Phone className="h-3.5 w-3.5" />{booking.customerPhone}
              </a>
            )}
          </div>

          {/* Notes */}
          {booking.notes && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1"><StickyNote className="h-3 w-3" />Notes</p>
              <p className="text-sm text-gray-700 bg-amber-50 rounded-lg p-2.5">{booking.notes}</p>
            </div>
          )}

          {/* Total */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <span className="text-sm text-gray-500">Total</span>
            <span className="text-xl font-bold text-gray-900">${parseFloat(booking.totalPrice).toFixed(2)}</span>
          </div>

          {/* Status actions */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Update Status</p>
            <div className="flex flex-wrap gap-2">
              {[
                { s: "confirmed", label: "Confirm",    cls: "bg-blue-500 hover:bg-blue-600 text-white" },
                { s: "active",    label: "Mark Active", cls: "bg-green-500 hover:bg-green-600 text-white" },
                { s: "completed", label: "Complete",    cls: "bg-gray-600 hover:bg-gray-700 text-white" },
                { s: "cancelled", label: "Cancel",      cls: "bg-red-500 hover:bg-red-600 text-white" },
              ]
                .filter(a => a.s !== booking.status)
                .map(({ s, label, cls }) => (
                  <button
                    key={s}
                    onClick={() => { onStatusChange(booking.id, s); onClose(); }}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${cls}`}
                  >
                    {label}
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function HostBookingsPage() {
  const { customer } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState<TabKey>("recent");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState<HostBooking | null>(null);

  const { data: allBookings = [], isLoading } = useQuery({
    queryKey: ["host-bookings", customer?.id],
    queryFn: () => api.host.bookings(customer!.id),
    enabled: !!customer,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.host.updateBookingStatus(id, status, customer!.id),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["host-bookings", customer?.id] });
      toast({ title: `Booking marked as ${vars.status}` });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
    },
  });

  const handleStatusChange = (id: number, status: string) => statusMutation.mutate({ id, status });

  // ─── Filtering ─────────────────────────────────────────────────────────────

  const today = startOfDay(new Date());

  const tabCounts = useMemo(() => ({
    recent:    allBookings.filter(b => b.status !== "cancelled").length,
    upcoming:  allBookings.filter(b => b.status !== "cancelled" && startOfDay(parseISO(b.startDate)) >= today).length,
    cancelled: allBookings.filter(b => b.status === "cancelled").length,
    all:       allBookings.length,
  }), [allBookings]);

  const tabFiltered = useMemo(() => {
    const all = [...allBookings];
    switch (tab) {
      case "upcoming":
        return all.filter(b => b.status !== "cancelled" && startOfDay(parseISO(b.startDate)) >= today)
          .sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());
      case "cancelled":
        return all.filter(b => b.status === "cancelled")
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case "all":
        return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      default:
        return all.filter(b => b.status !== "cancelled")
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }, [allBookings, tab]);

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tabFiltered;
    return tabFiltered.filter(b =>
      (b.customerName ?? "").toLowerCase().includes(q) ||
      (b.customerEmail ?? "").toLowerCase().includes(q) ||
      (b.listingTitle ?? "").toLowerCase().includes(q) ||
      (b.status ?? "").toLowerCase().includes(q) ||
      String(b.id).includes(q) ||
      (b.startDate ?? "").includes(q) ||
      (b.endDate ?? "").includes(q)
    );
  }, [tabFiltered, search]);

  // ─── Calendar helpers ──────────────────────────────────────────────────────

  const calendarDays = (() => {
    const start = startOfWeek(startOfMonth(calendarMonth));
    const end   = endOfWeek(endOfMonth(calendarMonth));
    const days: Date[] = [];
    let cur = start;
    while (cur <= end) { days.push(cur); cur = addDays(cur, 1); }
    return days;
  })();

  const calendarWeeks: Date[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    calendarWeeks.push(calendarDays.slice(i, i + 7));
  }

  type BookingBar = { booking: HostBooking; startCol: number; endCol: number; isStart: boolean; isEnd: boolean };
  type Lane = BookingBar[];

  function computeLanes(week: Date[]): Lane[] {
    const weekStart = startOfDay(week[0]);
    const weekEnd   = startOfDay(week[6]);

    const weekBookings = allBookings
      .filter(b => b.status !== "cancelled")
      .filter(b => {
        try {
          const s = startOfDay(parseISO(b.startDate));
          const e = startOfDay(parseISO(b.endDate));
          return s <= weekEnd && e >= weekStart;
        } catch { return false; }
      })
      .sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());

    const lanes: Lane[] = [];
    for (const b of weekBookings) {
      const bStart  = startOfDay(parseISO(b.startDate));
      const bEnd    = startOfDay(parseISO(b.endDate));
      const startCol = Math.max(0, differenceInDays(bStart, weekStart)) + 1;
      const endCol   = Math.min(6, differenceInDays(bEnd, weekStart)) + 2;
      const isStart  = bStart >= weekStart;
      const isEnd    = bEnd <= weekEnd;
      const entry: BookingBar = { booking: b, startCol, endCol, isStart, isEnd };

      let placed = false;
      for (const lane of lanes) {
        const last = lane[lane.length - 1];
        if (last.endCol <= startCol) { lane.push(entry); placed = true; break; }
      }
      if (!placed) lanes.push([entry]);
    }
    return lanes;
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <HostLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {allBookings.length} booking{allBookings.length !== 1 ? "s" : ""} for your listings
            </p>
          </div>
          {/* View toggle */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                view === "list" ? "bg-primary text-white" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <List className="w-4 h-4" /> List
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                view === "calendar" ? "bg-primary text-white" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <CalendarDays className="w-4 h-4" /> Calendar
            </button>
          </div>
        </div>

        {/* ── LIST VIEW ── */}
        {view === "list" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Tabs + Search */}
            <div className="px-4 py-3 border-b bg-gray-50 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Tabs */}
                <div className="flex items-center gap-1 flex-wrap">
                  {TABS.map(t => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                        tab === t.key
                          ? "bg-primary text-white"
                          : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {t.label}
                      <span className={`text-[10px] px-1.5 py-px rounded-full ${
                        tab === t.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                      }`}>
                        {tabCounts[t.key]}
                      </span>
                    </button>
                  ))}
                </div>
                {/* Search */}
                <div className="relative sm:ml-auto w-full sm:w-72">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search name, listing, date…"
                    className="w-full h-9 pl-8 pr-8 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  {search && (
                    <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* List body */}
            {isLoading ? (
              <div className="space-y-px">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-gray-50 animate-pulse border-b last:border-b-0" />
                ))}
              </div>
            ) : displayed.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center">
                <CalendarDays className="h-12 w-12 text-gray-200 mb-4" />
                <h3 className="text-base font-semibold text-gray-700">
                  {search ? "No bookings match your search" : "No bookings in this view"}
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  {search ? "Try different keywords." : "Try a different tab."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {displayed.map(booking => {
                  const ts = getRentalStatus(booking.startDate, booking.endDate, booking.status);
                  return (
                    <div
                      key={booking.id}
                      className="flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer group"
                      onClick={() => setSelectedBooking(booking)}
                    >
                      {/* Listing image */}
                      {booking.listingImage ? (
                        <img src={booking.listingImage} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Package className="h-5 w-5 text-gray-300" />
                        </div>
                      )}

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-sm text-gray-900 truncate">{booking.listingTitle}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize flex-shrink-0 ${STATUS_BADGE[booking.status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                            {booking.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">{booking.customerName}</span>
                          {booking.customerEmail && <span className="text-gray-400"> · {booking.customerEmail}</span>}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {fmt(booking.startDate)} → {fmt(booking.endDate)}
                          <span className="text-gray-300 mx-1.5">·</span>
                          <span className="font-mono text-gray-300">#{booking.id}</span>
                        </p>
                        {ts && (
                          <div className="mt-1.5 space-y-1">
                            <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border ${ts.color}`}>{ts.label}</span>
                            {ts.pct > 0 && (
                              <div className="h-1 w-32 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${ts.bar}`} style={{ width: `${ts.pct}%` }} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right side: total + actions */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <p className="font-bold text-gray-900">${parseFloat(booking.totalPrice).toFixed(2)}</p>
                        <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                          {booking.status === "pending" && (
                            <button
                              onClick={() => handleStatusChange(booking.id, "confirmed")}
                              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                            >
                              <CheckCircle className="h-3 w-3" /> Confirm
                            </button>
                          )}
                          <div className="relative group/menu">
                            <button
                              className="text-gray-300 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                              onClick={e => {
                                e.stopPropagation();
                                setSelectedBooking(booking);
                              }}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* Footer */}
                <div className="px-4 py-2 bg-gray-50 text-xs text-gray-400 text-right">
                  {displayed.length} booking{displayed.length !== 1 ? "s" : ""}{search ? ` matching "${search}"` : ""}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CALENDAR VIEW ── */}
        {view === "calendar" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Month nav */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <button
                onClick={() => setCalendarMonth(m => subMonths(m, 1))}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h3 className="text-base font-bold text-gray-900">{format(calendarMonth, "MMMM yyyy")}</h3>
              <button
                onClick={() => setCalendarMonth(m => addMonths(m, 1))}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 border-b bg-gray-50">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                <div key={d} className="py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar weeks */}
            {isLoading ? (
              <div className="py-20 text-center text-gray-400">Loading bookings…</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {calendarWeeks.map((week, wi) => {
                  const lanes = computeLanes(week);
                  return (
                    <div key={wi}>
                      {/* Day numbers */}
                      <div className="grid grid-cols-7 divide-x divide-gray-100 border-b border-gray-50">
                        {week.map((day, di) => {
                          const isToday = isSameDay(day, new Date());
                          const inMonth = isSameMonth(day, calendarMonth);
                          return (
                            <div key={di} className={`py-1.5 px-2 flex justify-end ${inMonth ? "bg-white" : "bg-gray-50"}`}>
                              <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${
                                isToday
                                  ? "bg-primary text-white"
                                  : inMonth ? "text-gray-700" : "text-gray-300"
                              }`}>
                                {format(day, "d")}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Booking bars */}
                      <div
                        className={`pb-1.5 pt-1 ${isSameMonth(week[3], calendarMonth) ? "bg-white" : "bg-gray-50/60"}`}
                        style={{ minHeight: `${Math.max(32, lanes.length * 24 + 8)}px` }}
                      >
                        {lanes.length === 0 && <div className="h-5" />}
                        {lanes.map((lane, li) => (
                          <div
                            key={li}
                            className="relative grid mb-0.5"
                            style={{ gridTemplateColumns: "repeat(7, 1fr)", height: "22px" }}
                          >
                            {lane.map(({ booking: b, startCol, endCol, isStart: bIsStart, isEnd: bIsEnd }) => {
                              const colorCls = STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-700 border-gray-200";
                              const roundL = bIsStart ? "rounded-l-full pl-2" : "rounded-l-none pl-1";
                              const roundR = bIsEnd   ? "rounded-r-full pr-2" : "rounded-r-none pr-1";
                              return (
                                <button
                                  key={b.id}
                                  onClick={() => setSelectedBooking(b)}
                                  title={`${b.listingTitle} — ${b.customerName} (${b.startDate} → ${b.endDate})`}
                                  style={{ gridColumn: `${startCol} / ${endCol}` }}
                                  className={`h-full flex items-center gap-1 text-[11px] font-semibold border truncate transition-opacity hover:opacity-75 ${colorCls} ${roundL} ${roundR} ${!bIsStart ? "border-l-0" : ""} ${!bIsEnd ? "border-r-0" : ""}`}
                                >
                                  {bIsStart && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[b.status] ?? "bg-gray-400"}`} />}
                                  <span className="truncate min-w-0">{bIsStart ? b.listingTitle : ""}</span>
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 px-6 py-3 border-t bg-gray-50">
              {Object.entries(STATUS_COLORS).map(([status, cls]) => (
                <div key={status} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-sm border ${cls}`} />
                  <span className="text-xs text-gray-500 capitalize">{status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Booking detail modal */}
      {selectedBooking && (
        <BookingDetailCard
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </HostLayout>
  );
}
