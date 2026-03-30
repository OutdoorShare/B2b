import { useState } from "react";
import { Link } from "wouter";
import { 
  useGetBookings, 
  useUpdateBooking,
  getGetBookingsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Search, Eye, MoreHorizontal, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AdminBookings() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'pending': return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>;
      case 'confirmed': return <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Confirmed</Badge>;
      case 'active': return <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
      case 'completed': return <Badge variant="outline" className="text-muted-foreground">Completed</Badge>;
      case 'cancelled': return <Badge variant="destructive">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Bookings</h2>
          <p className="text-muted-foreground mt-1">Manage reservations and customer pickups</p>
        </div>
        <div className="flex items-center gap-4">
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
        </div>
      </div>

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
                {bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">#{booking.id}</TableCell>
                    <TableCell>
                      <div className="font-medium">{booking.customerName}</div>
                      <div className="text-xs text-muted-foreground">{booking.customerEmail}</div>
                    </TableCell>
                    <TableCell className="font-medium">{booking.listingTitle}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(booking.startDate), 'MMM d, yyyy')} - <br/>
                        {format(new Date(booking.endDate), 'MMM d, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(booking.status)}</TableCell>
                    <TableCell className="font-medium">${booking.totalPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {booking.status === 'pending' && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => handleStatusChange(booking.id, 'confirmed')}
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
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleStatusChange(booking.id, 'pending')}>Mark Pending</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(booking.id, 'confirmed')}>Mark Confirmed</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(booking.id, 'active')}>Mark Active (Picked Up)</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(booking.id, 'completed')}>Mark Completed (Returned)</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleStatusChange(booking.id, 'cancelled')} className="text-destructive">
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
    </div>
  );
}
