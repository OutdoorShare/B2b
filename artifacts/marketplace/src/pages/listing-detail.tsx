import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, MapPin, Building2, ExternalLink, ChevronLeft, ChevronRight, Calendar, Shield, Package, CheckCircle2 } from "lucide-react";

const API_UPLOAD_BASE = "/api/uploads/";

function resolveImage(url: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const filename = url.split("/").pop() ?? "";
  return `${API_UPLOAD_BASE}${filename}`;
}

export function ListingDetailPage() {
  const [, params] = useRoute("/listings/:id");
  const [, setLocation] = useLocation();
  const [imgIndex, setImgIndex] = useState(0);
  const id = parseInt(params?.id ?? "0");

  const { data: listing, isLoading, isError } = useQuery({
    queryKey: ["marketplace-listing", id],
    queryFn: () => api.marketplace.listing(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading listing…</p>
        </div>
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">😕</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Listing not found</h2>
          <Button variant="outline" onClick={() => setLocation("/")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Browse
          </Button>
        </div>
      </div>
    );
  }

  const images = (listing.imageUrls ?? []).filter(Boolean);
  const handleBook = () => {
    // Navigate to the tenant's booking page on the main rental platform
    const bookUrl = `/${listing.tenantSlug}/book?listingId=${listing.id}`;
    window.location.href = bookUrl;
  };

  const color = listing.business.primaryColor || "#2d6a4f";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back nav */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Browse
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left — images + details */}
          <div className="lg:col-span-3 space-y-6">
            {/* Image gallery */}
            <div className="relative bg-gray-100 rounded-2xl overflow-hidden" style={{ aspectRatio: "16/10" }}>
              {images.length > 0 ? (
                <>
                  <img
                    src={resolveImage(images[imgIndex])}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={() => setImgIndex(i => (i - 1 + images.length) % images.length)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur rounded-full p-2 shadow hover:bg-white transition"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setImgIndex(i => (i + 1) % images.length)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur rounded-full p-2 shadow hover:bg-white transition"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {images.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setImgIndex(i)}
                            className={`h-1.5 rounded-full transition-all ${i === imgIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl">
                  {listing.categoryIcon || "🏕️"}
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: color }} />
            </div>

            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIndex(i)}
                    className={`flex-shrink-0 h-16 w-20 rounded-lg overflow-hidden border-2 transition-all ${
                      i === imgIndex ? "border-green-600" : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={resolveImage(img)} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Category */}
            {listing.category && (
              <div>
                <Badge variant="secondary" className="gap-1">
                  {listing.category.icon && <span>{listing.category.icon}</span>}
                  {listing.category.name}
                </Badge>
              </div>
            )}

            {/* Title + description */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">{listing.title}</h1>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">{listing.description}</p>
            </div>

            {/* Specs */}
            {(listing.brand || listing.model || listing.condition || listing.dimensions || listing.weight) && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" /> Details
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {listing.brand && <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-400">Brand</p><p className="font-medium text-gray-800">{listing.brand}</p></div>}
                  {listing.model && <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-400">Model</p><p className="font-medium text-gray-800">{listing.model}</p></div>}
                  {listing.condition && <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-400">Condition</p><p className="font-medium text-gray-800 capitalize">{listing.condition}</p></div>}
                  {listing.quantity > 1 && <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-400">Available</p><p className="font-medium text-gray-800">{listing.quantity} units</p></div>}
                </div>
              </div>
            )}

            {/* Included items */}
            {listing.includedItems && listing.includedItems.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" /> What's Included
                </h3>
                <ul className="space-y-1.5">
                  {listing.includedItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Requirements */}
            {listing.requirements && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Requirements
                </h3>
                <p className="text-sm text-gray-600">{listing.requirements}</p>
              </div>
            )}
          </div>

          {/* Right — booking sidebar */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sticky top-20 shadow-sm">
              {/* Price */}
              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900">${parseFloat(listing.pricePerDay).toFixed(0)}</span>
                <span className="text-gray-400 ml-1">/ day</span>
                {listing.halfDayEnabled && listing.halfDayRate && (
                  <p className="text-sm text-gray-500 mt-1">Half day: ${parseFloat(listing.halfDayRate).toFixed(0)}</p>
                )}
                {listing.pricePerWeek && (
                  <p className="text-sm text-gray-500">Weekly: ${parseFloat(listing.pricePerWeek).toFixed(0)}</p>
                )}
              </div>

              <Button
                onClick={handleBook}
                size="lg"
                className="w-full text-white font-semibold h-12"
                style={{ backgroundColor: color }}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Book Now
              </Button>

              {listing.depositAmount && parseFloat(listing.depositAmount) > 0 && (
                <p className="text-xs text-gray-400 text-center mt-2">
                  ${parseFloat(listing.depositAmount).toFixed(0)} deposit required
                </p>
              )}

              <Separator className="my-5" />

              {/* Company info */}
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Listed by</p>
                <div className="flex items-center gap-3 mb-3">
                  {listing.business.logoUrl ? (
                    <img
                      src={resolveImage(listing.business.logoUrl)}
                      alt={listing.business.name}
                      className="h-10 w-10 rounded-full object-cover border border-gray-100"
                    />
                  ) : (
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: color }}
                    >
                      {listing.business.name[0]}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{listing.business.name}</p>
                    {listing.business.tagline && (
                      <p className="text-xs text-gray-500">{listing.business.tagline}</p>
                    )}
                  </div>
                </div>

                {(listing.business.city || listing.business.state) && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-2">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{[listing.business.city, listing.business.state].filter(Boolean).join(", ")}</span>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 mt-2"
                  onClick={() => window.open(`/${listing.tenantSlug}`, "_blank")}
                >
                  <Building2 className="h-4 w-4" />
                  View Company
                  <ExternalLink className="h-3 w-3 ml-auto text-gray-400" />
                </Button>
              </div>

              <Separator className="my-4" />
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Shield className="h-3.5 w-3.5 text-green-500" />
                <span>Secure booking through OutdoorShare</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
