import { useLocation } from "wouter";
import type { MarketplaceListing } from "@/lib/api";
import { MapPin, Building2 } from "lucide-react";

const API_UPLOAD_BASE = "/api/uploads/";

function resolveImage(url: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const filename = url.split("/").pop() ?? "";
  return `${API_UPLOAD_BASE}${filename}`;
}

interface ListingCardProps {
  listing: MarketplaceListing;
}

export function ListingCard({ listing }: ListingCardProps) {
  const [, setLocation] = useLocation();
  const image = listing.imageUrls?.[0] ? resolveImage(listing.imageUrls[0]) : null;
  const color = listing.businessPrimaryColor || "#2d6a4f";

  return (
    <button
      onClick={() => setLocation(`/listings/${listing.id}`)}
      className="group text-left bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Image */}
      <div className="relative h-48 bg-gray-100 overflow-hidden">
        {image ? (
          <img src={image} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">
            {listing.categoryIcon || "🏕️"}
          </div>
        )}
        {listing.categoryName && (
          <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-xs font-medium px-2 py-1 rounded-full text-gray-700">
            {listing.categoryIcon && <span className="mr-1">{listing.categoryIcon}</span>}
            {listing.categoryName}
          </span>
        )}
        <div
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{ backgroundColor: color }}
        />
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-1 line-clamp-2 group-hover:text-green-800 transition-colors">
          {listing.title}
        </h3>

        {/* Company badge */}
        <div className="flex items-center gap-1.5 mb-3">
          {listing.businessLogoUrl ? (
            <img
              src={resolveImage(listing.businessLogoUrl)}
              alt={listing.businessName}
              className="h-4 w-4 rounded-full object-cover"
            />
          ) : (
            <Building2 className="h-3.5 w-3.5 text-gray-400" />
          )}
          <span className="text-xs text-gray-500 truncate">{listing.businessName}</span>
        </div>

        {/* Location */}
        {(listing.businessCity || listing.location) && (
          <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              {listing.location || [listing.businessCity, listing.businessState].filter(Boolean).join(", ")}
            </span>
          </div>
        )}

        {/* Price */}
        <div className="flex items-end justify-between">
          <div>
            <span className="text-lg font-bold text-gray-900">${parseFloat(listing.pricePerDay).toFixed(0)}</span>
            <span className="text-xs text-gray-400 ml-1">/ day</span>
          </div>
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full text-white"
            style={{ backgroundColor: color }}
          >
            Book Now
          </span>
        </div>
      </div>
    </button>
  );
}
