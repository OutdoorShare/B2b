import { useState, useEffect } from "react";
import { useParams } from "wouter";
import {
  useGetListing,
  useGetBusinessProfile,
  getGetListingQueryKey,
  getGetBusinessProfileQueryKey,
} from "@workspace/api-client-react";
import { MapPin, Clock, Tag, Star, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const CONDITION_LABEL: Record<string, string> = {
  excellent: "Excellent",
  good: "Good / Used",
  fair: "Fair",
};

/** Returns "City, State" from a full address. */
function cityState(location: string): string {
  const parts = location.split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length <= 2) return location;
  const nonZip = parts.filter(p => !/^\d{5}(-\d{4})?$/.test(p));
  return nonZip.length >= 2 ? nonZip.slice(-2).join(", ") : location;
}

export default function EmbedListing() {
  const { slug, id: idParam } = useParams<{ slug: string; id: string }>();
  const id = idParam ? parseInt(idParam) : 0;

  const [activeImage, setActiveImage] = useState(0);
  const [bookedRanges, setBookedRanges] = useState<{ start: Date; end: Date }[]>([]);

  const { data: listing, isLoading } = useGetListing(id, {
    query: { enabled: !!id, queryKey: getGetListingQueryKey(id) },
  });

  const { data: profile } = useGetBusinessProfile({
    query: { queryKey: getGetBusinessProfileQueryKey() },
  });

  useEffect(() => {
    if (!id) return;
    fetch(`${BASE}/api/listings/${id}/booked-dates`)
      .then(r => r.json())
      .then((data: { start: string; end: string }[]) => {
        if (Array.isArray(data)) {
          setBookedRanges(data
            .filter((b: any) => b.type !== "service")
            .map(b => ({ start: new Date(b.start), end: new Date(b.end) }))
          );
        }
      })
      .catch(() => {});
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">Listing not found.</p>
      </div>
    );
  }

  const l = listing as any;
  const images: string[] = Array.isArray(l.images) ? l.images : (l.imageUrl ? [l.imageUrl] : []);
  const heroImage = images[activeImage] || l.imageUrl || null;
  const pricePerDay = l.pricePerDay ? parseFloat(String(l.pricePerDay)) : null;
  const bp = profile as any;
  const primaryColor = bp?.primaryColor || "hsl(127,55%,38%)";

  // Full URL for the listing page (opens in parent/new tab)
  const listingUrl = `${window.location.origin}${BASE}/${slug}/listings/${id}`;
  const bookUrl = `${window.location.origin}${BASE}/${slug}/book?listingId=${id}`;

  return (
    <div className="font-sans text-gray-900 bg-white min-h-screen flex flex-col" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Photo section */}
      <div className="relative w-full bg-gray-100 aspect-[16/9] overflow-hidden">
        {heroImage ? (
          <img
            src={heroImage}
            alt={l.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
            <Tag className="w-12 h-12 opacity-30" />
          </div>
        )}

        {/* Prev/Next arrows if multiple images */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => setActiveImage(i => (i - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow hover:bg-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveImage(i => (i + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow hover:bg-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Dot indicators */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === activeImage ? "bg-white" : "bg-white/50"}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Category badge */}
        {l.categoryName && (
          <div className="absolute top-3 left-3">
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full text-white shadow"
              style={{ backgroundColor: primaryColor }}
            >
              {l.categoryName}
            </span>
          </div>
        )}

        {/* Image count */}
        {images.length > 1 && (
          <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
            {activeImage + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pt-4 pb-2 space-y-3">
        {/* Title + price */}
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-bold leading-snug text-gray-900 flex-1">{l.title}</h1>
          {pricePerDay != null && (
            <div className="text-right shrink-0">
              <span className="text-xl font-bold" style={{ color: primaryColor }}>
                ${pricePerDay.toFixed(2)}
              </span>
              <span className="text-xs text-gray-500">/day</span>
            </div>
          )}
        </div>

        {/* Key details row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
          {l.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              {cityState(l.location)}
            </span>
          )}
          {l.condition && CONDITION_LABEL[l.condition] && (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 shrink-0" />
              {CONDITION_LABEL[l.condition]}
            </span>
          )}
          {l.minRentalDays && l.minRentalDays > 1 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 shrink-0" />
              {l.minRentalDays}+ day min
            </span>
          )}
        </div>

        {/* Description */}
        {l.description && (
          <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">{l.description}</p>
        )}

        {/* Availability badge */}
        {bookedRanges.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600">
            <Clock className="w-3 h-3" />
            Check availability before booking
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="px-4 pb-3 pt-2 space-y-2">
        <a
          href={bookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center py-3 px-4 rounded-xl font-semibold text-white text-sm transition-opacity hover:opacity-90 active:opacity-80"
          style={{ backgroundColor: primaryColor }}
        >
          Book Now
        </a>
        <a
          href={listingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
        >
          <ExternalLink className="w-3 h-3" />
          View full details
        </a>
      </div>

      {/* Powered-by footer */}
      <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-center gap-1.5">
        {bp?.logoUrl ? (
          <img src={bp.logoUrl} alt={bp.name} className="h-4 object-contain opacity-60" />
        ) : null}
        <span className="text-[10px] text-gray-400">
          {bp?.name ? `Powered by ${bp.name}` : "Powered by OutdoorShare"}
        </span>
      </div>
    </div>
  );
}
