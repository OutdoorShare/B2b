import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarDays, Eye, MoreHorizontal, CheckCircle,
  List, ChevronLeft, ChevronRight, Plus
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay,
  isWithinInterval, parseISO, startOfDay, endOfDay
} from "date-fns";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

type ViewMode = "list" | "calendar";

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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [view, setView] = useState<ViewMode>("calendar");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: bookings, isLoading } = useGetBookings(
    statusFilter !== "all" ? { status: statusFilter as any } : {},
    { query: { queryKey: getGetBookingsQueryKey(statusFilter !== "all" ? { status: statusFilter as any } : {}) } }
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

  // ── Build calendar grid ──────────────────────────────────────────────
  const calendarDays = (() => {
    const start = startOfWeek(startOfMonth(calendarMonth));
    const end   = endOfWeek(endOfMonth(calendarMonth));
    const days: Date[] = [];
    let cur = start;
    while (cur <= end) { days.push(cur); cur = addDays(cur, 1); }
    return days;
  })();

  const bookingsForDay = (day: Date) =>
    (bookings || []).filter(b => {
      try {
        const s = startOfDay(parseISO(b.startDate));
        const e = endOfDay(parseISO(b.endDate));
        return isWithinInterval(day, { start: s, end: e });
      } catch { return false; }
    });

  // Whether this booking STARTS on this day (for label rendering)
  const isStart = (b: any, day: Date) => {
    try { return isSameDay(parseISO(b.startDate), day); } catch { return false; }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Bookings</h2>
          <p className="text-muted-foreground mt-1">Manage reservations and customer pickups</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setLocation("/admin/bookings/new")} className="gap-2">
            <Plus className="w-4 h-4" /> New Booking
          </Button>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bookings</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

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
                    {/* Date number */}
                    <span className={`self-end w-7 h-7 flex items-center justify-center rounded-full text-sm mb-1 font-medium ${
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : inMonth ? "text-foreground" : "text-muted-foreground"
                    }`}>
                      {format(day, "d")}
                    </span>

                    {/* Booking pills */}
                    <div className="space-y-0.5 flex-1 overflow-hidden">
                      {dayBookings.slice(0, 3).map(b => (
                        <button
                          key={b.id}
                          onClick={() => setLocation(`/admin/bookings/${b.id}`)}
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

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground">Loading bookings...</div>
            ) : bookings && bookings.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Listing</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map(booking => (
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
                      </TableCell>
                      <TableCell>{getStatusBadge(booking.status)}</TableCell>
                      <TableCell className="font-medium">${booking.totalPrice.toFixed(2)}</TableCell>
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
                                <Link href={`/admin/bookings/${booking.id}`} className="cursor-pointer flex items-center">
                                  <Eye className="w-4 h-4 mr-2" /> View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setLocation(`/admin/bookings/${booking.id}/edit`)}>
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
            ) : (
              <div className="py-24 text-center flex flex-col items-center">
                <CalendarDays className="w-12 h-12 text-muted mb-4" />
                <h3 className="text-lg font-medium mb-1">No bookings found</h3>
                <p className="text-muted-foreground">You don't have any bookings matching these filters.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
