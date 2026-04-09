import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { MarketplaceActivity } from "@/lib/api";

function stableOffset(seed: number): number {
  let s = (Math.abs(Math.round(seed * 1e5)) | 0) + 1;
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
  s = s ^ (s >>> 16);
  return ((s >>> 0) / 0xffffffff - 0.5) * 0.028;
}

const OS_GREEN = "hsl(127,55%,38%)";
const OS_GREEN_MID = "hsl(127,55%,30%)";
const OS_BLUE = "hsl(197,78%,58%)";
const OS_BLUE_DARK = "hsl(197,78%,44%)";

const CATEGORY_ICONS: Record<string, string> = {
  adventure: "🏔️",
  "water-sport": "🌊",
  "guided-tour": "🧭",
  lesson: "📚",
  "wildlife-tour": "🦁",
  "off-road": "🚙",
  camping: "⛺",
  climbing: "🧗",
  "snow-sport": "🎿",
  fishing: "🎣",
  other: "🌿",
};

type ExperienceMapViewProps = {
  activities: MarketplaceActivity[];
};

export function ExperienceMapView({ activities }: ExperienceMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const mappable = activities.filter(a => a.businessLat != null && a.businessLng != null);
  const unmapped = activities.length - mappable.length;

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    import("leaflet").then(L => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;

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

      const grouped = new Map<string, MarketplaceActivity[]>();
      for (const a of mappable) {
        const key = `${a.businessLat},${a.businessLng}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(a);
      }

      const bounds: [number, number][] = [];

      grouped.forEach((group, key) => {
        const [lat, lng] = key.split(",").map(Number);
        const approxLat = lat + stableOffset(lat);
        const approxLng = lng + stableOffset(lng + 0.5);

        bounds.push([approxLat, approxLng]);

        const count = group.length;
        const first = group[0];

        const icon = L.divIcon({
          className: "",
          html: `
            <div style="position:relative;width:42px;height:42px;">
              <div style="position:absolute;inset:0;border-radius:50%;background:${OS_BLUE};opacity:0.22;"></div>
              <div style="
                position:absolute;inset:3px;
                background:linear-gradient(135deg, ${OS_GREEN_MID} 0%, ${OS_GREEN} 100%);
                border-radius:50%;border:2px solid white;
                box-shadow:0 2px 10px rgba(0,0,0,0.35);
                display:flex;align-items:center;justify-content:center;
                font-size:13px;font-weight:700;color:white;font-family:system-ui,sans-serif;
              ">${count}</div>
              <div style="
                position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);
                width:8px;height:8px;background:${OS_BLUE};border-radius:50%;
                border:1.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);
              "></div>
            </div>
          `,
          iconSize: [42, 46],
          iconAnchor: [21, 46],
        });

        const marker = L.marker([approxLat, approxLng], { icon }).addTo(map);

        const location = [first.businessCity, first.businessState].filter(Boolean).join(", ");

        const actRows = group.slice(0, 3).map(a => `
          <a
            href="/${a.tenantSlug}"
            class="exp-map-item"
            style="
              display:flex;align-items:center;gap:8px;
              cursor:pointer;padding:7px 9px;border-radius:8px;
              background:#f7faf8;border:1.5px solid #d4e9df;
              text-decoration:none;transition:border-color 0.15s;
            "
          >
            <div style="flex:1;min-width:0;">
              <div style="font-size:12px;font-weight:600;color:#1a3d22;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${CATEGORY_ICONS[a.category] ?? "🌿"} ${a.title}
              </div>
              <div style="font-size:11px;color:${OS_BLUE_DARK};font-weight:700;margin-top:2px;">
                $${a.pricePerPerson}/person
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${OS_BLUE}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </a>
        `).join("");

        const moreRow = count > 3
          ? `<div style="font-size:11px;color:${OS_GREEN};text-align:center;font-weight:600;padding-top:2px;">+${count - 3} more experiences</div>`
          : "";

        const popupContent = `
          <div style="min-width:210px;max-width:270px;font-family:system-ui,sans-serif;">
            <div style="
              margin:-12px -12px 10px -12px;padding:10px 12px 8px;
              background:linear-gradient(135deg, ${OS_GREEN} 0%, ${OS_GREEN_MID} 100%);
              border-radius:8px 8px 0 0;
            ">
              <div style="font-weight:700;font-size:13px;color:white;margin-bottom:2px;">
                📍 ${location || first.tenantName}
              </div>
              <div style="font-size:11px;color:rgba(255,255,255,0.75);">
                ${count} experience${count !== 1 ? "s" : ""} available
              </div>
              <div style="margin-top:6px;height:2px;background:linear-gradient(90deg, ${OS_BLUE} 0%, transparent 100%);border-radius:1px;opacity:0.8;"></div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${actRows}
              ${moreRow}
            </div>
          </div>
        `;

        const popup = L.popup({
          maxWidth: 290,
          closeButton: true,
          className: "os-popup",
        }).setContent(popupContent);

        marker.bindPopup(popup);

        marker.on("popupopen", () => {
          setTimeout(() => {
            document.querySelectorAll<HTMLElement>(".exp-map-item").forEach(el => {
              el.onmouseenter = () => {
                el.style.borderColor = OS_BLUE;
                el.style.background = "#eef7fb";
              };
              el.onmouseleave = () => {
                el.style.borderColor = "#d4e9df";
                el.style.background = "#f7faf8";
              };
            });
          }, 80);
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

  return (
    <div className="relative w-full" style={{ height: "calc(100vh - 320px)", minHeight: "500px" }}>
      <div
        className="w-full h-full rounded-xl overflow-hidden shadow-md"
        style={{ border: `2px solid hsl(127,55%,38%)` }}
      >
        <div ref={mapRef} className="w-full h-full" />
      </div>

      {unmapped > 0 && (
        <div
          className="absolute bottom-4 left-4 text-xs px-3 py-1.5 rounded-full shadow-md font-medium"
          style={{ background: "white", color: OS_GREEN, border: `1.5px solid hsl(127,55%,70%)` }}
        >
          {mappable.length} of {activities.length} experiences on map
        </div>
      )}

      {mappable.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/85">
          <div className="text-center">
            <div className="text-5xl mb-3">📍</div>
            <p className="font-semibold" style={{ color: OS_GREEN }}>No mapped experiences</p>
            <p className="text-sm text-gray-400 mt-1">Switch to grid view to browse all experiences</p>
          </div>
        </div>
      )}

      <style>{`
        .os-popup .leaflet-popup-content-wrapper {
          border-radius: 10px;padding: 0;overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.18);
          border: 1.5px solid hsl(127,55%,82%);
        }
        .os-popup .leaflet-popup-content { margin: 12px; }
        .os-popup .leaflet-popup-tip { background: ${OS_GREEN}; }
        .os-popup .leaflet-popup-close-button {
          color: white !important;font-size: 18px !important;
          top: 6px !important;right: 8px !important;
        }
      `}</style>
    </div>
  );
}
