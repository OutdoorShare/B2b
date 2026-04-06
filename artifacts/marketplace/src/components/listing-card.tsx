import { useLocation } from "wouter";
import type { MarketplaceListing } from "@/lib/api";
import { MapPin, Building2, Heart } from "lucide-react";
import { useFavorites } from "@/context/favorites";
import { cn } from "@/lib/utils";

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
  const { isFavorite, toggleFavorite } = useFavorites();
  const image = listing.imageUrls?.[0] ? resolveImage(listing.imageUrls[0]) : null;
  const fav = isFavorite(listing.id);

  return (
    <div className="group relative text-left bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      {/* Image */}
      <button
        onClick={() => setLocation(`/listings/${listing.id}`)}
        className="block w-full relative h-48 bg-gray-100 overflow-hidden"
      >
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
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary" />
      </button>

      {/* Heart button */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleFavorite(listing.id); }}
        className={cn(
          "absolute top-2.5 right-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full shadow-md transition-all duration-150",
          fav
            ? "bg-red-500 text-white hover:bg-red-600 scale-110"
            : "bg-white/90 backdrop-blur-sm text-gray-400 hover:text-red-500 hover:scale-110",
        )}
        aria-label={fav ? "Remove from favorites" : "Add to favorites"}
      >
        <Heart className={cn("h-4 w-4", fav && "fill-current")} />
      </button>

      {/* Content */}
      <button
        onClick={() => setLocation(`/listings/${listing.id}`)}
        className="block w-full text-left p-4"
      >
        <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-1 line-clamp-2 group-hover:text-primary transition-colors">
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
          <span className="text-xs font-medium px-2.5 py-1 rounded-full text-primary-foreground bg-primary">
            Book Now
          </span>
        </div>
      </button>
    </div>
  );
}
