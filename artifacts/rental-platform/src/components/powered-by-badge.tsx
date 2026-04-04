import { Link } from "wouter";

interface PoweredByBadgeProps {
  variant?: "footer" | "fixed";
}

export function PoweredByBadge({ variant = "footer" }: PoweredByBadgeProps) {
  if (variant === "fixed") {
    return (
      <a
        href="/get-started"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 left-4 z-50 flex items-center gap-1.5 bg-white border border-gray-200 shadow-md rounded-full pl-1.5 pr-3 py-1 hover:shadow-lg hover:border-gray-300 transition-all group"
        title="Powered by OutdoorShare"
      >
        <img
          src="/outdoorshare-logo.png"
          alt="OutdoorShare"
          className="w-5 h-5 object-contain"
        />
        <span className="text-[11px] font-semibold text-gray-500 group-hover:text-gray-700 whitespace-nowrap leading-none">
          Powered by OutdoorShare
        </span>
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
