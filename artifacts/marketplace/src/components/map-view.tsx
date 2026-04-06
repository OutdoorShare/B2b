import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import "leaflet/dist/leaflet.css";

type Listing = {
  id: number;
  title: string;
  pricePerDay: string | null;
  images: string[];
  businessName: string;
  businessLogoUrl: string | null;
  businessCity: string | null;
  businessState: string | null;
  businessLat: number | null;
  businessLng: number | null;
  tenantSlug: string;
  categoryName: string | null;
  categoryIcon: string | null;
};

type MapViewProps = {
  listings: Listing[];
};

function priceLabel(price: string | null) {
  if (!price) return null;
  return `$${parseFloat(price).toFixed(0)}/day`;
}

export function MapView({ listings }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [, navigate] = useLocation();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Listings that have coordinates
  const mappable = listings.filter(l => l.businessLat != null && l.businessLng != null);

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    import("leaflet").then(L => {
      // Fix default icon paths for Vite/webpack bundling
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, {
        center: [39.5, -105.0],
        zoom: 5,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      leafletMapRef.current = map;

      // Group listings by lat/lng
      const grouped = new Map<string, Listing[]>();
      for (const l of mappable) {
        const key = `${l.businessLat},${l.businessLng}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(l);
      }

      const bounds: [number, number][] = [];

      grouped.forEach((group, key) => {
        const [lat, lng] = key.split(",").map(Number);
        bounds.push([lat, lng]);

        const count = group.length;
        const first = group[0];

        const icon = L.divIcon({
          className: "",
          html: `<div style="
            background: hsl(155,42%,18%);
            color: white;
            border: 2.5px solid white;
            border-radius: 50%;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 700;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
            transition: transform 0.15s;
          ">${count}</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker([lat, lng], { icon }).addTo(map);

        const location = [first.businessCity, first.businessState].filter(Boolean).join(", ");
        const popupContent = `
          <div style="min-width:200px;max-width:260px;font-family:sans-serif;">
            <div style="font-weight:700;font-size:13px;color:#1a1a1a;margin-bottom:4px;">
              ${location || first.businessName}
            </div>
            <div style="font-size:12px;color:#555;margin-bottom:10px;">
              ${count} listing${count !== 1 ? "s" : ""} available
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${group.slice(0, 3).map(l => `
                <div data-id="${l.id}" data-slug="${l.tenantSlug}" style="
                  display:flex;align-items:center;gap:8px;
                  cursor:pointer;padding:6px 8px;border-radius:8px;
                  background:#f8f9fa;border:1px solid #e9ecef;
                " class="map-listing-item">
                  <div style="flex:1;min-width:0;">
                    <div style="font-size:12px;font-weight:600;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                      ${l.categoryIcon ? l.categoryIcon + " " : ""}${l.title}
                    </div>
                    <div style="font-size:11px;color:hsl(155,42%,22%);font-weight:600;margin-top:1px;">
                      ${priceLabel(l.pricePerDay) ?? ""}
                    </div>
                  </div>
                </div>
              `).join("")}
              ${count > 3 ? `<div style="font-size:11px;color:#888;text-align:center;">+${count - 3} more</div>` : ""}
            </div>
          </div>
        `;

        const popup = L.popup({ maxWidth: 280, closeButton: true }).setContent(popupContent);
        marker.bindPopup(popup);

        marker.on("popupopen", () => {
          setTimeout(() => {
            document.querySelectorAll(".map-listing-item").forEach(el => {
              el.addEventListener("click", () => {
                const id = el.getAttribute("data-id");
                const slug = el.getAttribute("data-slug");
                if (id && slug) {
                  navigate(`/marketplace/listings/${id}`);
                }
              });
            });
          }, 100);
        });

        markersRef.current.push(marker);
      });

      if (bounds.length > 0) {
        if (bounds.length === 1) {
          map.setView(bounds[0], 10);
        } else {
          map.fitBounds(bounds as any, { padding: [60, 60] });
        }
      }
    });

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        markersRef.current = [];
      }
    };
  }, []);

  // Update markers when listings change
  useEffect(() => {
    if (!leafletMapRef.current || markersRef.current.length === 0) return;
  }, [listings]);

  const unmapped = listings.length - mappable.length;

  return (
    <div className="relative w-full" style={{ height: "calc(100vh - 340px)", minHeight: "480px" }}>
      <div ref={mapRef} className="w-full h-full rounded-xl overflow-hidden border border-gray-200 shadow-sm" />
      {unmapped > 0 && (
        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm text-xs text-gray-500 px-3 py-1.5 rounded-full shadow border border-gray-200">
          {mappable.length} of {listings.length} listings shown on map
        </div>
      )}
      {mappable.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
          <div className="text-center">
            <div className="text-4xl mb-3">📍</div>
            <p className="text-gray-600 font-medium">No listings with map locations</p>
            <p className="text-gray-400 text-sm mt-1">Switch to grid view to browse all listings</p>
          </div>
        </div>
      )}
    </div>
  );
}
