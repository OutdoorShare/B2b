import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { 
  useGetListing,
  useCreateBooking,
  getGetListingQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, ArrowLeft, CheckCircle2 } from "lucide-react";
import { differenceInDays, format, addDays } from "date-fns";

export default function StorefrontBook() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Parse listingId from URL params (e.g. ?listingId=1)
  const searchParams = new URLSearchParams(window.location.search);
  const listingIdStr = searchParams.get("listingId");
  const listingId = listingIdStr ? parseInt(listingIdStr) : 0;

  const { data: listing, isLoading } = useGetListing(listingId, {
    query: { enabled: !!listingId, queryKey: getGetListingQueryKey(listingId) }
  });

  const createBooking = useCreateBooking();

  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 3), 'yyyy-MM-dd'),
    quantity: 1,
    notes: ''
  });

  const [isSuccess, setIsSuccess] = useState(false);

  const days = useMemo(() => {
    try {
      const diff = differenceInDays(new Date(formData.endDate), new Date(formData.startDate));
      return diff > 0 ? diff : 1;
    } catch {
      return 1;
    }
  }, [formData.startDate, formData.endDate]);

  const subtotal = (listing?.pricePerDay || 0) * days * formData.quantity;
  const deposit = listing?.depositAmount || 0;
  const total = subtotal + deposit;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!listingId) return;

    createBooking.mutate(
      { 
        data: {
          listingId,
          ...formData,
          source: 'online'
        } 
      },
      {
        onSuccess: () => {
          setIsSuccess(true);
          window.scrollTo(0, 0);
        },
        onError: () => {
          toast({ title: "Booking failed", description: "Please try again later.", variant: "destructive" });
        }
      }
    );
  };

  if (!listingIdStr) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">No gear selected</h2>
        <Button onClick={() => setLocation("/")}>Browse Gear</Button>
      </div>
    );
  }

  if (isLoading) return <div className="container mx-auto px-4 py-16 text-center">Loading booking details...</div>;
  if (!listing) return <div className="container mx-auto px-4 py-16 text-center">Gear not found</div>;

  if (isSuccess) {
    return (
      <div className="container mx-auto px-4 py-24 max-w-xl text-center space-y-6">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-4xl font-black tracking-tight">Booking Requested!</h1>
        <p className="text-xl text-muted-foreground">
          We've received your request for the {listing.title}. We'll review it and email you a confirmation shortly.
        </p>
        <div className="bg-muted/50 rounded-2xl p-6 text-left my-8">
          <p className="font-semibold mb-2">Next steps:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Check your email for the confirmation</li>
            <li>Review the pickup instructions</li>
            <li>Bring a valid ID to pickup</li>
          </ul>
        </div>
        <Button size="lg" className="rounded-full" onClick={() => setLocation("/")}>
          Return to Store
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <Button variant="ghost" className="mb-8 pl-0 hover:bg-transparent" onClick={() => window.history.back()}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>

      <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-8">Complete Your Booking</h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Form Column */}
        <div className="lg:col-span-7">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-6">
              <h2 className="text-xl font-bold border-b pb-2">1. Your Information</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Full Name</Label>
                  <Input 
                    id="customerName" 
                    value={formData.customerName} 
                    onChange={e => setFormData({...formData, customerName: e.target.value})} 
                    required 
                    className="h-12"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customerEmail">Email Address</Label>
                    <Input 
                      id="customerEmail" 
                      type="email" 
                      value={formData.customerEmail} 
                      onChange={e => setFormData({...formData, customerEmail: e.target.value})} 
                      required 
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customerPhone">Phone Number</Label>
                    <Input 
                      id="customerPhone" 
                      type="tel" 
                      value={formData.customerPhone} 
                      onChange={e => setFormData({...formData, customerPhone: e.target.value})} 
                      required 
                      className="h-12"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-xl font-bold border-b pb-2">2. Rental Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Pickup Date</Label>
                  <Input 
                    id="startDate" 
                    type="date" 
                    value={formData.startDate} 
                    onChange={e => setFormData({...formData, startDate: e.target.value})} 
                    min={format(new Date(), 'yyyy-MM-dd')}
                    required 
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Return Date</Label>
                  <Input 
                    id="endDate" 
                    type="date" 
                    value={formData.endDate} 
                    onChange={e => setFormData({...formData, endDate: e.target.value})} 
                    min={formData.startDate}
                    required 
                    className="h-12"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes (Optional)</Label>
                <Textarea 
                  id="notes" 
                  placeholder="Any special requests or questions?" 
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})} 
                  rows={3}
                />
              </div>
            </div>

            <Button 
              type="submit" 
              size="lg" 
              className="w-full h-14 text-lg font-bold rounded-xl"
              disabled={createBooking.isPending}
            >
              {createBooking.isPending ? "Processing..." : "Request Booking"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              No charge will be made until your booking is confirmed by our team.
            </p>
          </form>
        </div>

        {/* Summary Column */}
        <div className="lg:col-span-5">
          <div className="sticky top-24">
            <Card className="overflow-hidden border-2">
              <div className="aspect-[2/1] bg-muted relative">
                {listing.imageUrls?.[0] && (
                  <img src={listing.imageUrls[0]} alt={listing.title} className="w-full h-full object-cover" />
                )}
              </div>
              <CardContent className="p-6 space-y-6">
                <div>
                  <h3 className="font-bold text-xl mb-1">{listing.title}</h3>
                  <p className="text-muted-foreground">${listing.pricePerDay}/day</p>
                </div>

                <Separator />

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dates</span>
                    <span className="font-medium">
                      {format(new Date(formData.startDate), 'MMM d')} - {format(new Date(formData.endDate), 'MMM d')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium">{days} day{days > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rental Fee</span>
                    <span className="font-medium">${subtotal.toFixed(2)}</span>
                  </div>
                  {deposit > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center">
                        Refundable Deposit
                      </span>
                      <span className="font-medium">${deposit.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total Due Today</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
