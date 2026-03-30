import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { 
  useGetListing,
  useGetBusinessProfile,
  getGetListingQueryKey,
  getGetBusinessProfileQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Shield, Info, MapPin } from "lucide-react";
import { format } from "date-fns";

export default function StorefrontGearDetail() {
  const [, params] = useRoute("/gear/:id");
  const [, setLocation] = useLocation();
  const id = params?.id ? parseInt(params.id) : 0;

  const [activeImage, setActiveImage] = useState(0);

  const { data: listing, isLoading: isLoadingListing } = useGetListing(id, {
    query: { 
      enabled: !!id, 
      queryKey: getGetListingQueryKey(id) 
    }
  });

  const { data: profile } = useGetBusinessProfile({
    query: { queryKey: getGetBusinessProfileQueryKey() }
  });

  if (isLoadingListing) {
    return <div className="min-h-screen pt-24 text-center">Loading gear details...</div>;
  }

  if (!listing) {
    return <div className="min-h-screen pt-24 text-center">Gear not found</div>;
  }

  const handleBookNow = () => {
    // Navigate to booking page with pre-selected listing
    setLocation(`/book?listingId=${listing.id}`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/">
        <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent hover:underline text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to gear
        </Button>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Column: Photos */}
        <div className="lg:col-span-7 space-y-4">
          <div className="aspect-[4/3] w-full bg-muted rounded-2xl overflow-hidden border">
            {listing.imageUrls && listing.imageUrls.length > 0 ? (
              <img 
                src={listing.imageUrls[activeImage]} 
                alt={listing.title} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-muted/50">
                No image available
              </div>
            )}
          </div>
          
          {listing.imageUrls && listing.imageUrls.length > 1 && (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {listing.imageUrls.map((url, idx) => (
                <button 
                  key={idx}
                  onClick={() => setActiveImage(idx)}
                  className={`relative w-24 aspect-[4/3] rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                    activeImage === idx ? 'border-primary ring-2 ring-primary/20' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Details & Booking */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className="uppercase tracking-wider font-semibold text-xs">
                {listing.categoryName}
              </Badge>
              {listing.condition && (
                <Badge variant="outline" className="capitalize text-xs">
                  Condition: {listing.condition}
                </Badge>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">{listing.title}</h1>
            
            <div className="flex items-end gap-2 mb-6">
              <span className="text-4xl font-black">${listing.pricePerDay}</span>
              <span className="text-muted-foreground font-medium mb-1">/ day</span>
            </div>
            
            <div className="prose prose-sm md:prose-base text-muted-foreground mb-8">
              <p>{listing.description}</p>
            </div>
          </div>

          <div className="bg-muted/30 p-6 rounded-2xl border border-border mb-8 space-y-6">
            <h3 className="font-semibold text-lg">Booking Details</h3>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              {profile?.location && (
                <div className="flex gap-3">
                  <MapPin className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <span className="block font-medium text-foreground">Pickup Location</span>
                    <span className="text-muted-foreground">{profile.location}</span>
                  </div>
                </div>
              )}
              {listing.depositAmount && listing.depositAmount > 0 && (
                <div className="flex gap-3">
                  <Shield className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <span className="block font-medium text-foreground">Security Deposit</span>
                    <span className="text-muted-foreground">${listing.depositAmount} refundable</span>
                  </div>
                </div>
              )}
            </div>

            <Button 
              size="lg" 
              className="w-full h-14 text-lg font-bold rounded-xl"
              onClick={handleBookNow}
              disabled={listing.status !== 'active'}
            >
              {listing.status === 'active' ? 'Book This Gear' : 'Currently Unavailable'}
            </Button>
          </div>

          {/* Specifications */}
          <div className="space-y-6">
            <h3 className="font-semibold text-lg border-b pb-2">Specifications</h3>
            
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 text-sm">
              {listing.brand && (
                <div className="flex justify-between sm:block">
                  <dt className="text-muted-foreground">Brand</dt>
                  <dd className="font-medium text-foreground">{listing.brand}</dd>
                </div>
              )}
              {listing.model && (
                <div className="flex justify-between sm:block">
                  <dt className="text-muted-foreground">Model</dt>
                  <dd className="font-medium text-foreground">{listing.model}</dd>
                </div>
              )}
              {listing.weight && (
                <div className="flex justify-between sm:block">
                  <dt className="text-muted-foreground">Weight</dt>
                  <dd className="font-medium text-foreground">{listing.weight}</dd>
                </div>
              )}
              {listing.dimensions && (
                <div className="flex justify-between sm:block">
                  <dt className="text-muted-foreground">Dimensions</dt>
                  <dd className="font-medium text-foreground">{listing.dimensions}</dd>
                </div>
              )}
            </dl>
          </div>

          {listing.includedItems && listing.includedItems.length > 0 && (
            <div className="mt-8 space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">What's Included</h3>
              <ul className="space-y-2">
                {listing.includedItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {listing.requirements && (
            <div className="mt-8 bg-amber-50 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 flex gap-3">
              <Info className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0" />
              <div className="text-sm">
                <span className="block font-semibold text-amber-800 dark:text-amber-400 mb-1">Requirements</span>
                <span className="text-amber-700/80 dark:text-amber-500/80">{listing.requirements}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
