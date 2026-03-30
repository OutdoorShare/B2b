import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { 
  useGetBooking, 
  useUpdateBooking,
  getGetBookingQueryKey,
  getGetBookingsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, Phone, Mail, Calendar, MapPin, Package, StickyNote } from "lucide-react";
import { format, differenceInDays } from "date-fns";

export default function AdminBookingDetail() {
  const [, params] = useRoute("/admin/bookings/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: booking, isLoading } = useGetBooking(id, {
    query: { enabled: !!id, queryKey: getGetBookingQueryKey(id) }
  });

  const updateBooking = useUpdateBooking();
  const [adminNotes, setAdminNotes] = useState("");

  useEffect(() => {
    if (booking?.adminNotes) {
      setAdminNotes(booking.adminNotes);
    }
  }, [booking]);

  if (isLoading) return <div className="p-8">Loading booking details...</div>;
  if (!booking) return <div className="p-8">Booking not found</div>;

  const handleStatusChange = (newStatus: any) => {
    updateBooking.mutate(
      { id, data: { status: newStatus } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetBookingQueryKey(id), data);
          queryClient.invalidateQueries({ queryKey: getGetBookingsQueryKey() });
          toast({ title: `Booking marked as ${newStatus}` });
        }
      }
    );
  };

  const saveNotes = () => {
    updateBooking.mutate(
      { id, data: { adminNotes } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetBookingQueryKey(id), data);
          toast({ title: "Notes saved successfully" });
        }
      }
    );
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'pending': return <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-sm px-3 py-1">Pending Confirmation</Badge>;
      case 'confirmed': return <Badge variant="default" className="bg-blue-100 text-blue-800 text-sm px-3 py-1">Confirmed</Badge>;
      case 'active': return <Badge variant="default" className="bg-green-100 text-green-800 text-sm px-3 py-1">Active (Picked Up)</Badge>;
      case 'completed': return <Badge variant="outline" className="text-muted-foreground text-sm px-3 py-1">Completed</Badge>;
      case 'cancelled': return <Badge variant="destructive" className="text-sm px-3 py-1">Cancelled</Badge>;
      default: return <Badge className="text-sm px-3 py-1">{status}</Badge>;
    }
  };

  const days = differenceInDays(new Date(booking.endDate), new Date(booking.startDate)) || 1;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Booking #{booking.id}</h2>
            <p className="text-muted-foreground mt-1">
              Placed on {format(new Date(booking.createdAt), 'MMM d, yyyy h:mm a')} via {booking.source}
            </p>
          </div>
          {getStatusBadge(booking.status)}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button 
          variant={booking.status === 'confirmed' ? "default" : "outline"}
          onClick={() => handleStatusChange('confirmed')}
          disabled={booking.status === 'confirmed'}
        >
          Confirm Booking
        </Button>
        <Button 
          variant={booking.status === 'active' ? "default" : "outline"}
          onClick={() => handleStatusChange('active')}
          disabled={booking.status === 'active'}
          className={booking.status === 'active' ? "bg-green-600 hover:bg-green-700" : ""}
        >
          Mark as Picked Up
        </Button>
        <Button 
          variant={booking.status === 'completed' ? "default" : "outline"}
          onClick={() => handleStatusChange('completed')}
          disabled={booking.status === 'completed'}
        >
          Mark as Returned
        </Button>
        <Button 
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive ml-auto"
          onClick={() => handleStatusChange('cancelled')}
          disabled={booking.status === 'cancelled'}
        >
          Cancel Booking
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-y-6">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Name</div>
                  <div className="font-medium text-lg">{booking.customerName}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Email</div>
                  <div className="font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a href={`mailto:${booking.customerEmail}`} className="hover:underline">{booking.customerEmail}</a>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Phone</div>
                  <div className="font-medium flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    {booking.customerPhone ? (
                      <a href={`tel:${booking.customerPhone}`} className="hover:underline">{booking.customerPhone}</a>
                    ) : (
                      <span className="text-muted-foreground italic">Not provided</span>
                    )}
                  </div>
                </div>
              </div>

              {booking.notes && (
                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm font-semibold flex items-center gap-2 mb-2">
                    <StickyNote className="w-4 h-4" /> Customer Notes
                  </div>
                  <p className="text-sm text-muted-foreground">{booking.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rental Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Rental Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between border-b pb-4 mb-4">
                <div>
                  <div className="font-bold text-lg">{booking.listingTitle}</div>
                  <div className="text-sm text-muted-foreground">Listing ID: #{booking.listingId}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">Qty: {booking.quantity}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-6">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Pickup Date
                  </div>
                  <div className="font-medium text-lg">{format(new Date(booking.startDate), 'EEEE, MMM d, yyyy')}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Return Date
                  </div>
                  <div className="font-medium text-lg">{format(new Date(booking.endDate), 'EEEE, MMM d, yyyy')}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Admin Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-primary" />
                Internal Notes
              </CardTitle>
              <CardDescription>Only visible to staff. Used for internal tracking.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                value={adminNotes} 
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add condition notes, deposit tracking, or other internal info here..."
                rows={4}
              />
              <div className="flex justify-end">
                <Button variant="secondary" onClick={saveNotes}>Save Notes</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Payment */}
        <div className="lg:col-span-1 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{days} day{days > 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Rental Fee</span>
                <span className="font-medium">${(booking.totalPrice - (booking.depositPaid || 0)).toFixed(2)}</span>
              </div>
              
              {booking.depositPaid !== null && booking.depositPaid !== undefined && booking.depositPaid > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Security Deposit</span>
                  <span className="font-medium">${booking.depositPaid.toFixed(2)}</span>
                </div>
              )}
              
              <Separator />
              
              <div className="flex justify-between items-center">
                <span className="font-bold text-lg">Total</span>
                <span className="font-bold text-2xl">${booking.totalPrice.toFixed(2)}</span>
              </div>
              
              <div className="mt-6 p-4 bg-muted rounded-lg space-y-3">
                <div className="text-sm font-medium">Payment Status</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Balance Due</span>
                  <span className="font-semibold text-green-600">$0.00</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
