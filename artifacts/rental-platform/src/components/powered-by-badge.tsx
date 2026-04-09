import { useState } from "react";

interface PoweredByBadgeProps {
  variant?: "footer" | "fixed";
}

export function PoweredByBadge({ variant = "footer" }: PoweredByBadgeProps) {
  const [hovered, setHovered] = useState(false);

  if (variant === "fixed") {
    return (
      <a
        href="/get-started"
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="fixed bottom-5 left-5 z-50 flex items-center gap-0 group"
        title="Powered by OutdoorShare"
        style={{ textDecoration: "none" }}
        aria-label="Powered by OutdoorShare"
      >
        {/* Label pill — slides in from the left of the bubble on hover */}
        <div
          className="flex items-center overflow-hidden transition-all duration-200"
          style={{
            maxWidth: hovered ? 180 : 0,
            opacity: hovered ? 1 : 0,
            marginRight: hovered ? 6 : 0,
          }}
        >
          <div className="bg-white border border-gray-200 shadow-md rounded-full pl-3 pr-3.5 py-1.5 whitespace-nowrap">
            <span className="text-[11px] font-semibold text-gray-500 leading-none">
              Powered by OutdoorShare
            </span>
          </div>
        </div>

        {/* The bubble itself */}
        <div
          className="w-11 h-11 rounded-full bg-white border border-gray-200 shadow-lg flex items-center justify-center transition-all duration-200 shrink-0"
          style={{
            boxShadow: hovered
              ? "0 6px 20px rgba(0,0,0,0.18)"
              : "0 2px 8px rgba(0,0,0,0.12)",
            transform: hovered ? "scale(1.08)" : "scale(1)",
          }}
        >
          <img
            src="/outdoorshare-logo.png"
            alt="OutdoorShare"
            className="w-6 h-6 object-contain"
          />
        </div>
      </a>
    );
  }

  return (
    <a
      href="/get-started"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full pl-1.5 pr-3 py-1 hover:border-gray-300 hover:shadow-sm transition-all group"
      title="Powered by OutdoorShare"
    >
      <img
        src="/outdoorshare-logo.png"
        alt="OutdoorShare"
        className="w-4 h-4 object-contain"
      />
      <span className="text-[11px] font-semibold text-gray-400 group-hover:text-gray-600 whitespace-nowrap leading-none">
        Powered by OutdoorShare
      </span>
    </a>
  );
}
