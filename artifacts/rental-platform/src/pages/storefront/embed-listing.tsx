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
const API_URL = import.meta.env.VITE_API_URL ?? "";

function resolveImage(url: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) return url;
  return `${API_URL}/api/uploads/${url.split("/").pop()}`;
}

const CONDITION_LABEL: Record<string, string> = {
  excellent: "Excellent",
  good: "Good / Used",
  fair: "Fair",
};

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
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">Listing not found.</p>
      </div>
    );
  }

  const l = listing as any;
  const rawImages: string[] = Array.isArray(l.imageUrls) && l.imageUrls.length > 0
    ? l.imageUrls
    : (l.imageUrl ? [l.imageUrl] : []);
  const images = rawImages.map(resolveImage).filter(Boolean);
  const heroImage = images[activeImage] || null;
  const pricePerDay = l.pricePerDay ? parseFloat(String(l.pricePerDay)) : null;
  const bp = profile as any;
  const primaryColor = bp?.primaryColor || "hsl(127,55%,38%)";

  const listingUrl = `${window.location.origin}${BASE}/${slug}/listings/${id}`;
  const bookUrl = `${window.location.origin}${BASE}/${slug}/book?listingId=${id}`;

  return (
    <div
      className="font-sans text-gray-900 bg-white overflow-hidden flex flex-col"
      style={{ fontFamily: "system-ui, sans-serif", height: "100%", minHeight: 0 }}
    >
      {/* ── Side-by-side layout ── */}
      <div className="flex flex-1 min-h-0">

        {/* LEFT — Photo (fixed ~40% width) */}
        <div className="relative shrink-0 bg-gray-100 overflow-hidden" style={{ width: "42%" }}>
          {heroImage ? (
            <img
              src={heroImage}
              alt={l.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <Tag className="w-10 h-10 opacity-40" />
            </div>
          )}

          {/* Prev/Next arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={() => setActiveImage(i => (i - 1 + images.length) % images.length)}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow hover:bg-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveImage(i => (i + 1) % images.length)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow hover:bg-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
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
            <div className="absolute top-2.5 left-2.5">
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white shadow"
                style={{ backgroundColor: primaryColor }}
              >
                {l.categoryName}
              </span>
            </div>
          )}
        </div>

        {/* RIGHT — Info + CTA */}
        <div className="flex-1 flex flex-col min-w-0 px-4 py-3 overflow-hidden">

          {/* Title + price */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <h1 className="text-base font-bold leading-snug text-gray-900 flex-1 line-clamp-2">{l.title}</h1>
            {pricePerDay != null && (
              <div className="text-right shrink-0">
                <span className="text-lg font-bold" style={{ color: primaryColor }}>
                  ${pricePerDay.toFixed(2)}
                </span>
                <span className="text-xs text-gray-500">/day</span>
              </div>
            )}
          </div>

          {/* Key details */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mb-2">
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

          {/* Description — fills available space */}
          {l.description && (
            <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 flex-1 mb-2">{l.description}</p>
          )}

          {/* Availability note */}
          {bookedRanges.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-amber-600 mb-2">
              <Clock className="w-3 h-3" />
              Check availability before booking
            </div>
          )}

          {/* CTA — always at bottom */}
          <div className="mt-auto space-y-1.5">
            <a
              href={bookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center py-2.5 px-4 rounded-xl font-semibold text-white text-sm transition-opacity hover:opacity-90 active:opacity-80"
              style={{ backgroundColor: primaryColor }}
            >
              Book Now
            </a>
            <a
              href={listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 transition-colors py-0.5"
            >
              <ExternalLink className="w-3 h-3" />
              View full details
            </a>
          </div>
        </div>
      </div>

      {/* Powered-by footer */}
      <div className="border-t border-gray-100 px-4 py-1.5 flex items-center justify-center gap-1.5 shrink-0">
        {bp?.logoUrl && (
          <img src={resolveImage(bp.logoUrl)} alt={bp.name} className="h-3.5 object-contain opacity-60" />
        )}
        <span className="text-[10px] text-gray-400">
          {bp?.name ? `Powered by ${bp.name}` : "Powered by OutdoorShare"}
        </span>
      </div>
    </div>
  );
}
