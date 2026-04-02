import { adminPath } from "@/lib/admin-nav";
import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetBookings,
  useUpdateBooking,
  getGetBookingsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarDays, Eye, MoreHorizontal, CheckCircle,
  List, ChevronLeft, ChevronRight, Plus, Search, X
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay,
  isWithinInterval, parseISO, startOfDay, endOfDay, differenceInDays
} from "date-fns";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

type ViewMode = "list" | "calendar";
type TabKey = "recent" | "upcoming" | "cancelled" | "all";

const SOURCE_CONFIG: Record<string, { label: string; className: string }> = {
  online:  { label: "Online",   className: "bg-blue-100   text-blue-800   border-blue-200"   },
  kiosk:   { label: "Kiosk",    className: "bg-purple-100 text-purple-800 border-purple-200" },
  walkin:  { label: "Walk-in",  className: "bg-amber-100  text-amber-800  border-amber-200"  },
  phone:   { label: "Phone",    className: "bg-gray-100   text-gray-700   border-gray-200"   },
};

function SourceBadge({ source }: { source?: string | null }) {
  if (!source) return null;
  const cfg = SOURCE_CONFIG[source] ?? { label: source, className: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-100  text-amber-900  border-amber-300",
  confirmed: "bg-blue-100   text-blue-900   border-blue-300",
  active:    "bg-green-100  text-green-900  border-green-300",
  completed: "bg-gray-100   text-gray-600   border-gray-300",
  cancelled: "bg-red-100    text-red-700    border-red-300",
};

function getRentalTimeStatus(startStr: string, endStr: string, status: string) {
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
  if (daysToStart > 1)  return { label: `Starts in ${daysToStart}d`, color: "text-blue-600 bg-blue-50 border-blue-200", pct: 0, bar: "bg-blue-400" };
  if (daysToStart === 1) return { label: "Starts tomorrow",          color: "text-blue-600 bg-blue-50 border-blue-200", pct: 0, bar: "bg-blue-400" };
  if (daysToStart === 0) return { label: "Pickup day!",              color: "text-green-700 bg-green-50 border-green-200", pct: 0, bar: "bg-green-500" };
  if (daysToEnd > 1)    return { label: `${daysToEnd}d remaining`,  color: "text-green-700 bg-green-50 border-green-200", pct, bar: "bg-green-500" };
  if (daysToEnd === 1)  return { label: "Returns tomorrow",          color: "text-amber-700 bg-amber-50 border-amber-200", pct, bar: "bg-amber-500" };
  if (daysToEnd === 0)  return { label: "Due back today",            color: "text-amber-700 bg-amber-50 border-amber-200", pct: 100, bar: "bg-amber-500" };
  return { label: `Overdue ${Math.abs(daysToEnd)}d`,                 color: "text-red-700 bg-red-50 border-red-300", pct: 100, bar: "bg-red-500" };
}

const STATUS_DOT: Record<string, string> = {
  pending:   "bg-amber-400",
  confirmed: "bg-blue-500",
  active:    "bg-green-500",
  completed: "bg-gray-400",
  cancelled: "bg-red-400",
};

function getStatusBadge(status: string) {
  switch (status) {
    case "pending":   return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>;
    case "confirmed": return <Badge variant="default"   className="bg-blue-100 text-blue-800 hover:bg-blue-100">Confirmed</Badge>;
    case "active":    return <Badge variant="default"   className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
    case "completed": return <Badge variant="outline"   className="text-muted-foreground">Completed</Badge>;
    case "cancelled": return <Badge variant="destructive">Cancelled</Badge>;
    default:          return <Badge variant="outline">{status}</Badge>;
  }
}

export default function AdminBookings() {
  const [tab, setTab] = useState<TabKey>("recent");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Always fetch all bookings — filter client-side
  const { data: allBookings = [], isLoading } = useGetBookings(
    {},
    { query: { queryKey: getGetBookingsQueryKey({}) } }
  );

  const updateBooking = useUpdateBooking();

  const handleStatusChange = (id: number, newStatus: any) => {
    updateBooking.mutate(
      { id, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBookingsQueryKey() });
          toast({ title: `Booking marked as ${newStatus}` });
        },
        onError: () => {
          toast({ title: "Failed to update booking status", variant: "destructive" });
        }
      }
    );
  };

  // ── Client-side filtering ─────────────────────────────────────────────
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
        return all
          .filter(b => b.status !== "cancelled" && startOfDay(parseISO(b.startDate)) >= today)
          .sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());
      case "cancelled":
        return all
          .filter(b => b.status === "cancelled")
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case "all":
        return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      default: // recent
        return all
          .filter(b => b.status !== "cancelled")
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

  // ── Calendar helpers ──────────────────────────────────────────────────
  const calendarDays = (() => {
    const start = startOfWeek(startOfMonth(calendarMonth));
    const end   = endOfWeek(endOfMonth(calendarMonth));
    const days: Date[] = [];
    let cur = start;
    while (cur <= end) { days.push(cur); cur = addDays(cur, 1); }
    return days;
  })();

  const bookingsForDay = (day: Date) =>
    allBookings.filter(b => {
      try {
        const s = startOfDay(parseISO(b.startDate));
        const e = endOfDay(parseISO(b.endDate));
        return isWithinInterval(day, { start: s, end: e });
      } catch { return false; }
    });

  const isStart = (b: any, day: Date) => {
    try { return isSameDay(parseISO(b.startDate), day); } catch { return false; }
  };

  const TABS: { key: TabKey; label: string }[] = [
    { key: "recent",    label: "Recent" },
    { key: "upcoming",  label: "Upcoming" },
    { key: "cancelled", label: "Cancelled" },
    { key: "all",       label: "All" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Bookings</h2>
          <p className="text-muted-foreground mt-1">Manage reservations and customer pickups</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setLocation(adminPath("/bookings/new"))} className="gap-2">
            <Plus className="w-4 h-4" /> New Booking
          </Button>
          {/* View toggle */}
          <div className="flex rounded-lg border bg-card overflow-hidden">
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="w-4 h-4" /> List
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                view === "calendar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarDays className="w-4 h-4" /> Calendar
            </button>
          </div>
        </div>
      </div>

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <Card className="overflow-hidden">
          {/* Tabs + Search bar */}
          <div className="px-4 py-3 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-1 flex-wrap">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    tab === t.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {t.label}
                  <span className={`text-[10px] px-1.5 py-px rounded-full ${tab === t.key ? "bg-primary-foreground/20 text-primary-foreground" : "bg-background text-muted-foreground"}`}>
                    {tabCounts[t.key]}
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative sm:ml-auto w-full sm:w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, listing, date, status…"
                className="w-full h-9 pl-8 pr-8 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground">Loading bookings…</div>
            ) : displayed.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Listing</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayed.map(booking => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">#{booking.id}</TableCell>
                        <TableCell>
                          <div className="font-medium">{booking.customerName}</div>
                          <div className="text-xs text-muted-foreground">{booking.customerEmail}</div>
                        </TableCell>
                        <TableCell className="font-medium">{booking.listingTitle}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(booking.startDate), "MMM d, yyyy")} –<br />
                            {format(new Date(booking.endDate), "MMM d, yyyy")}
                          </div>
                          {(() => {
                            const ts = getRentalTimeStatus(booking.startDate, booking.endDate, booking.status);
                            if (!ts) return null;
                            return (
                              <div className="mt-1.5 space-y-1">
                                <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border ${ts.color}`}>
                                  {ts.label}
                                </span>
                                {ts.pct > 0 && (
                                  <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${ts.bar}`} style={{ width: `${ts.pct}%` }} />
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell><SourceBadge source={(booking as any).source} /></TableCell>
                        <TableCell>{getStatusBadge(booking.status)}</TableCell>
                        <TableCell className="font-medium">
                          <div>${booking.totalPrice.toFixed(2)}</div>
                          {(booking as any).depositPaid && parseFloat((booking as any).depositPaid) > 0 && (() => {
                            const ds = (booking as any).depositHoldStatus as string | null | undefined;
                            const cfg: Record<string, { label: string; cls: string }> = {
                              authorized: { label: "Hold Active",  cls: "bg-amber-50 text-amber-700 border-amber-200" },
                              released:   { label: "Deposit Released", cls: "bg-green-50 text-green-700 border-green-200" },
                              captured:   { label: "Deposit Charged",  cls: "bg-red-50 text-red-700 border-red-200" },
                            };
                            const c = ds ? cfg[ds] : { label: "Deposit Pending", cls: "bg-gray-50 text-gray-500 border-gray-200" };
                            return (
                              <span className={`mt-1 inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border ${c.cls}`}>
                                ${parseFloat((booking as any).depositPaid).toFixed(0)} · {c.label}
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {booking.status === "pending" && (
                              <Button
                                size="sm" variant="outline"
                                className="text-green-600 border-green-200 hover:bg-green-50"
                                onClick={() => handleStatusChange(booking.id, "confirmed")}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" /> Confirm
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem asChild>
                                  <Link href={adminPath(`/bookings/${booking.id}`)} className="cursor-pointer flex items-center">
                                    <Eye className="w-4 h-4 mr-2" /> View Details
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setLocation(adminPath(`/bookings/${booking.id}/edit`))}>
                                  Edit Booking
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleStatusChange(booking.id, "pending")}>Mark Pending</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(booking.id, "confirmed")}>Mark Confirmed</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(booking.id, "active")}>Mark Active (Picked Up)</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(booking.id, "completed")}>Mark Completed (Returned)</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleStatusChange(booking.id, "cancelled")}
                                  className="text-destructive"
                                >
                                  Cancel Booking
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {/* Footer count */}
                <div className="px-4 py-2.5 border-t bg-muted/10 text-xs text-muted-foreground text-right">
                  {displayed.length} booking{displayed.length !== 1 ? "s" : ""}{search ? ` matching "${search}"` : ""}
                </div>
              </>
            ) : (
              <div className="py-24 text-center flex flex-col items-center">
                <CalendarDays className="w-12 h-12 text-muted mb-4" />
                <h3 className="text-lg font-medium mb-1">
                  {search ? "No bookings match your search" : "No bookings in this view"}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {search ? `Try a different keyword or clear the search.` : "Try a different tab or create a new booking."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── CALENDAR VIEW ── */}
      {view === "calendar" && (
        <Card>
          {/* Month navigation */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <button
              onClick={() => setCalendarMonth(m => subMonths(m, 1))}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold">{format(calendarMonth, "MMMM yyyy")}</h3>
            <button
              onClick={() => setCalendarMonth(m => addMonths(m, 1))}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          {isLoading ? (
            <div className="py-20 text-center text-muted-foreground">Loading...</div>
          ) : (
            <div className="grid grid-cols-7 divide-x divide-y">
              {calendarDays.map((day, i) => {
                const dayBookings = bookingsForDay(day);
                const isToday = isSameDay(day, new Date());
                const inMonth = isSameMonth(day, calendarMonth);

                return (
                  <div
                    key={i}
                    className={`min-h-[110px] p-1.5 flex flex-col ${inMonth ? "bg-background" : "bg-muted/30"}`}
                  >
                    <span className={`self-end w-7 h-7 flex items-center justify-center rounded-full text-sm mb-1 font-medium ${
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : inMonth ? "text-foreground" : "text-muted-foreground"
                    }`}>
                      {format(day, "d")}
                    </span>

                    <div className="space-y-0.5 flex-1 overflow-hidden">
                      {dayBookings.slice(0, 3).map(b => (
                        <button
                          key={b.id}
                          onClick={() => setLocation(adminPath(`/bookings/${b.id}`))}
                          title={`${b.listingTitle} — ${b.customerName}`}
                          className={`w-full text-left text-[11px] font-medium px-1.5 py-0.5 rounded border truncate leading-tight transition-opacity hover:opacity-80 ${STATUS_COLORS[b.status] || "bg-gray-100 text-gray-700 border-gray-300"}`}
                        >
                          {isStart(b, day) ? (
                            <span className="flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[b.status] || "bg-gray-400"}`} />
                              <span className="truncate">{b.listingTitle}</span>
                            </span>
                          ) : (
                            <span className="opacity-50 pl-2.5 truncate block">{b.listingTitle}</span>
                          )}
                        </button>
                      ))}
                      {dayBookings.length > 3 && (
                        <p className="text-[10px] text-muted-foreground font-medium px-1">
                          +{dayBookings.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 px-6 py-3 border-t bg-muted/20">
            {Object.entries(STATUS_COLORS).map(([status, cls]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-sm border ${cls}`} />
                <span className="text-xs text-muted-foreground capitalize">{status}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
