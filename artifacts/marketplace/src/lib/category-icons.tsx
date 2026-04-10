import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function icon(path: React.ReactNode, viewBox = "0 0 64 64") {
  return function CategorySvgIcon({ size = 24, width, height, className, style, ...rest }: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={viewBox}
        width={width ?? size}
        height={height ?? size}
        fill="currentColor"
        className={className}
        style={style}
        {...rest}
      >
        {path}
      </svg>
    );
  };
}

export const JetSkiIcon = icon(
  <>
    {/* Hull */}
    <path d="M5 42 C5 38 9 34 14 34 L46 34 C50 34 54 37 56 40 L59 40 C61 40 62 41 61 43 L55 43 C53 46 49 48 44 48 L16 48 C11 48 7 46 5 43 Z" />
    {/* Seat / body top */}
    <path d="M20 34 L24 28 L36 28 L40 34 Z" />
    {/* Rider torso */}
    <path d="M24 28 L22 20 L32 18 L36 28 Z" />
    {/* Rider head */}
    <circle cx="27" cy="16" r="5" />
    {/* Handlebars */}
    <rect x="30" y="24" width="2" height="8" rx="1" />
    <rect x="27" y="24" width="8" height="2" rx="1" />
    {/* Wake waves */}
    <path d="M2 50 C6 48 10 52 14 50 C18 48 22 52 26 50 C30 48 34 52 38 50" strokeWidth="2.5" stroke="currentColor" fill="none" strokeLinecap="round" />
  </>
);

export const RVIcon = icon(
  <>
    {/* Main body */}
    <path d="M4 16 C4 12 7 10 12 10 L52 10 C57 10 60 13 60 18 L60 44 L4 44 Z" />
    {/* Cab window */}
    <rect x="48" y="14" width="10" height="12" rx="2" fill="white" opacity="0.9" />
    {/* Side windows */}
    <rect x="10" y="16" width="10" height="8" rx="2" fill="white" opacity="0.9" />
    <rect x="24" y="16" width="10" height="8" rx="2" fill="white" opacity="0.9" />
    <rect x="38" y="16" width="7" height="8" rx="2" fill="white" opacity="0.9" />
    {/* Door */}
    <rect x="10" y="28" width="8" height="14" rx="1" fill="white" opacity="0.25" />
    {/* Undercarriage */}
    <rect x="4" y="42" width="56" height="4" rx="1" />
    {/* Wheels */}
    <circle cx="16" cy="50" r="8" />
    <circle cx="16" cy="50" r="3.5" fill="white" opacity="0.5" />
    <circle cx="50" cy="50" r="8" />
    <circle cx="50" cy="50" r="3.5" fill="white" opacity="0.5" />
    {/* Headlight */}
    <circle cx="59" cy="36" r="3" fill="white" opacity="0.8" />
    {/* Step */}
    <rect x="4" y="42" width="6" height="3" rx="1" />
  </>
);

export const ATVIcon = icon(
  <>
    {/* Body / frame */}
    <path d="M20 22 C18 20 16 18 16 16 L16 14 C16 12 18 10 22 10 L42 10 C46 10 48 12 48 14 L48 16 C48 18 46 20 44 22 L44 38 L20 38 Z" />
    {/* Seat */}
    <ellipse cx="32" cy="12" rx="10" ry="4" />
    {/* Front wheels (large knobby) */}
    <circle cx="14" cy="44" r="12" />
    <circle cx="14" cy="44" r="6" fill="white" opacity="0.3" />
    <circle cx="14" cy="44" r="2" />
    {/* Rear wheels */}
    <circle cx="50" cy="44" r="12" />
    <circle cx="50" cy="44" r="6" fill="white" opacity="0.3" />
    <circle cx="50" cy="44" r="2" />
    {/* Handlebars */}
    <rect x="30" y="8" width="2" height="8" rx="1" />
    <rect x="26" y="8" width="10" height="2" rx="1" />
    {/* Fenders */}
    <path d="M6 36 C8 28 14 26 20 28" strokeWidth="2.5" stroke="currentColor" fill="none" strokeLinecap="round" />
    <path d="M58 36 C56 28 50 26 44 28" strokeWidth="2.5" stroke="currentColor" fill="none" strokeLinecap="round" />
    {/* Exhaust / footrests */}
    <rect x="20" y="36" width="24" height="4" rx="2" />
  </>
);

export const UTVIcon = icon(
  <>
    {/* Lower body / chassis */}
    <path d="M8 36 L8 28 C8 24 10 22 14 22 L50 22 C54 22 56 24 56 28 L56 36 Z" />
    {/* Roll cage uprights */}
    <rect x="16" y="12" width="3" height="22" rx="1.5" />
    <rect x="45" y="12" width="3" height="22" rx="1.5" />
    {/* Roll cage top bar */}
    <rect x="16" y="12" width="32" height="3" rx="1.5" />
    {/* Diagonal cage braces */}
    <line x1="19" y1="34" x2="19" y2="14" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
    <line x1="45" y1="34" x2="45" y2="14" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
    {/* Seats (two side-by-side) */}
    <rect x="18" y="26" width="12" height="8" rx="2" fill="white" opacity="0.3" />
    <rect x="34" y="26" width="12" height="8" rx="2" fill="white" opacity="0.3" />
    {/* Undercarriage */}
    <rect x="6" y="34" width="52" height="5" rx="2" />
    {/* Front wheels */}
    <circle cx="14" cy="48" r="10" />
    <circle cx="14" cy="48" r="4.5" fill="white" opacity="0.3" />
    <circle cx="14" cy="48" r="2" />
    {/* Rear wheels */}
    <circle cx="50" cy="48" r="10" />
    <circle cx="50" cy="48" r="4.5" fill="white" opacity="0.3" />
    <circle cx="50" cy="48" r="2" />
    {/* Steering wheel */}
    <circle cx="24" cy="24" r="4" strokeWidth="2" stroke="currentColor" fill="none" />
    {/* Windshield */}
    <path d="M16 22 L18 14 L46 14 L48 22 Z" fill="white" opacity="0.15" />
  </>
);

export const BoatIcon = icon(
  <>
    {/* Hull */}
    <path d="M4 42 C4 42 8 36 20 34 L44 34 C54 34 60 38 62 42 L4 42 Z" />
    {/* Hull bottom / keel */}
    <path d="M8 42 C12 46 20 48 32 48 C44 48 52 46 56 42 Z" />
    {/* Cabin / windshield */}
    <path d="M24 34 L26 22 L44 22 L46 34 Z" fill="white" opacity="0.2" />
    <path d="M26 22 L30 16 L40 16 L44 22 Z" />
    {/* Windshield glass */}
    <path d="M28 32 L30 22 L42 22 L44 32 Z" fill="white" opacity="0.4" />
    {/* Motor at stern */}
    <rect x="54" y="36" width="4" height="8" rx="2" />
    <rect x="52" y="43" width="8" height="3" rx="1" />
    {/* Propeller */}
    <circle cx="56" cy="48" r="3" />
    {/* Antenna */}
    <line x1="38" y1="16" x2="38" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="38" cy="7" r="1.5" />
    {/* Wake */}
    <path d="M2 44 C6 43 10 46 14 44" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" />
  </>
);

export const DirtBikeIcon = icon(
  <>
    {/* Rear wheel */}
    <circle cx="16" cy="46" r="14" />
    <circle cx="16" cy="46" r="7" fill="white" opacity="0.25" />
    <circle cx="16" cy="46" r="2.5" />
    {/* Front wheel */}
    <circle cx="50" cy="46" r="12" />
    <circle cx="50" cy="46" r="6" fill="white" opacity="0.25" />
    <circle cx="50" cy="46" r="2.5" />
    {/* Seat / fuel tank */}
    <path d="M18 32 L22 24 L36 22 L40 28 L34 34 L18 34 Z" />
    {/* Frame down tube */}
    <path d="M22 32 L18 46" strokeWidth="4" stroke="currentColor" fill="none" strokeLinecap="round" />
    {/* Swing arm */}
    <path d="M20 38 L16 46" strokeWidth="3.5" stroke="currentColor" fill="none" strokeLinecap="round" />
    {/* Front fork */}
    <path d="M44 28 L50 46" strokeWidth="4" stroke="currentColor" fill="none" strokeLinecap="round" />
    <path d="M42 26 L48 44" strokeWidth="4" stroke="currentColor" fill="none" strokeLinecap="round" />
    {/* Handlebars */}
    <rect x="40" y="20" width="3" height="10" rx="1.5" />
    <rect x="36" y="20" width="12" height="3" rx="1.5" />
    {/* Exhaust */}
    <path d="M18 38 C14 38 10 40 10 44" strokeWidth="3" stroke="currentColor" fill="none" strokeLinecap="round" />
    {/* Rider position - seat */}
    <ellipse cx="26" cy="26" rx="8" ry="3" />
    {/* Front fender */}
    <path d="M46 30 C50 30 54 36 54 38" strokeWidth="3" stroke="currentColor" fill="none" strokeLinecap="round" />
  </>
);

export const EbikeIcon = icon(
  <>
    {/* Rear wheel */}
    <circle cx="14" cy="46" r="14" />
    <circle cx="14" cy="46" r="7" fill="white" opacity="0.25" />
    <circle cx="14" cy="46" r="2.5" />
    {/* Front wheel */}
    <circle cx="52" cy="46" r="14" />
    <circle cx="52" cy="46" r="7" fill="white" opacity="0.25" />
    <circle cx="52" cy="46" r="2.5" />
    {/* Frame - top tube */}
    <path d="M24 30 L44 24" strokeWidth="4" stroke="currentColor" fill="none" strokeLinecap="round" />
    {/* Frame - down tube */}
    <path d="M44 24 L28 44" strokeWidth="4" stroke="currentColor" fill="none" strokeLinecap="round" />
    {/* Seat tube */}
    <path d="M28 30 L28 46" strokeWidth="3.5" stroke="currentColor" fill="none" strokeLinecap="round" />
    {/* Seat stay */}
    <path d="M28 44 L14 46" strokeWidth="3.5" stroke="currentColor" fill="none" strokeLinecap="round" />
    {/* Fork */}
    <path d="M44 24 L52 46" strokeWidth="4" stroke="currentColor" fill="none" strokeLinecap="round" />
    {/* Battery on down tube */}
    <rect x="30" y="28" width="14" height="8" rx="3" />
    <rect x="32" y="30" width="3" height="4" rx="1" fill="white" opacity="0.5" />
    <rect x="37" y="30" width="3" height="4" rx="1" fill="white" opacity="0.5" />
    {/* Handlebars */}
    <rect x="40" y="18" width="3" height="8" rx="1.5" />
    <rect x="36" y="18" width="10" height="3" rx="1.5" />
    {/* Seat post */}
    <rect x="26" y="24" width="4" height="8" rx="2" />
    {/* Saddle */}
    <ellipse cx="28" cy="24" rx="8" ry="2.5" />
    {/* Pedals */}
    <circle cx="28" cy="44" r="5" />
    <rect x="22" y="43" width="12" height="2.5" rx="1.25" fill="white" opacity="0.4" />
    {/* Motor hub (rear) */}
    <circle cx="14" cy="46" r="5" fill="white" opacity="0.15" />
  </>
);

export const UtilityTrailerIcon = icon(
  <>
    {/* Tongue / hitch bar */}
    <path d="M4 36 L20 30 L20 38 L4 38 Z" />
    {/* Ball hitch */}
    <circle cx="4" cy="37" r="3" />
    {/* Main box body */}
    <rect x="20" y="20" width="40" height="24" rx="2" />
    {/* Rear door */}
    <rect x="52" y="22" width="6" height="20" rx="1" fill="white" opacity="0.25" />
    {/* Side vents / ribs */}
    <line x1="30" y1="22" x2="30" y2="44" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
    <line x1="40" y1="22" x2="40" y2="44" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
    {/* Undercarriage */}
    <rect x="20" y="42" width="40" height="5" rx="1" />
    {/* Wheels */}
    <circle cx="34" cy="52" r="9" />
    <circle cx="34" cy="52" r="4" fill="white" opacity="0.3" />
    <circle cx="34" cy="52" r="2" />
    <circle cx="52" cy="52" r="9" />
    <circle cx="52" cy="52" r="4" fill="white" opacity="0.3" />
    <circle cx="52" cy="52" r="2" />
    {/* Roof rail */}
    <rect x="22" y="18" width="36" height="3" rx="1.5" />
  </>
);

export const SnowmobileIcon = icon(
  <>
    {/* Track at bottom */}
    <path d="M14 46 C14 42 18 40 24 40 L50 40 C54 40 56 42 56 46 L56 50 C56 54 54 56 50 56 L20 56 C16 56 14 54 14 50 Z" />
    <rect x="16" y="44" width="38" height="3" rx="1" fill="white" opacity="0.2" />
    {/* Body / cowling */}
    <path d="M10 28 C8 26 6 22 8 18 C10 14 16 14 22 16 L50 18 C54 18 58 22 58 28 L58 40 L22 40 C16 40 12 36 10 28 Z" />
    {/* Windshield */}
    <path d="M40 18 L44 28 L58 28 L54 18 Z" fill="white" opacity="0.3" />
    {/* Ski (front runner) */}
    <path d="M4 36 C2 36 2 38 4 39 L22 40 L22 36 Z" />
    <path d="M4 36 C4 32 6 30 8 30 L16 30 L18 36 Z" />
    {/* Handlebars */}
    <rect x="34" y="16" width="3" height="8" rx="1.5" />
    <rect x="30" y="16" width="10" height="3" rx="1.5" />
    {/* Headlight */}
    <ellipse cx="56" cy="22" rx="4" ry="3" fill="white" opacity="0.6" />
    {/* Track detail */}
    <line x1="22" y1="44" x2="22" y2="52" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
    <line x1="30" y1="44" x2="30" y2="52" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
    <line x1="38" y1="44" x2="38" y2="52" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
    <line x1="46" y1="44" x2="46" y2="52" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
    {/* Seat */}
    <path d="M22 28 C22 26 28 24 36 24 C44 24 50 26 50 28 L50 30 C50 32 44 34 36 34 C28 34 22 32 22 30 Z" />
  </>
);

export const TowingVehicleIcon = icon(
  <>
    {/* Cab */}
    <path d="M30 14 C28 12 24 10 20 10 L10 10 C7 10 5 12 5 15 L5 40 L38 40 L38 20 C38 16 34 14 30 14 Z" />
    {/* Cab windows */}
    <path d="M9 13 L9 22 L24 22 L28 15 C26 13 22 13 18 13 Z" fill="white" opacity="0.4" />
    {/* Bed */}
    <rect x="38" y="18" width="24" height="22" rx="1" />
    {/* Bed rails */}
    <rect x="38" y="16" width="24" height="3" rx="1" />
    {/* Rear bumper */}
    <rect x="58" y="34" width="4" height="8" rx="1" />
    {/* Tow hitch */}
    <rect x="60" y="39" width="5" height="2.5" rx="1" />
    <circle cx="66" cy="40" r="2.5" />
    {/* Undercarriage */}
    <rect x="4" y="38" width="58" height="5" rx="1" />
    {/* Front wheel */}
    <circle cx="16" cy="48" r="10" />
    <circle cx="16" cy="48" r="4.5" fill="white" opacity="0.3" />
    <circle cx="16" cy="48" r="2" />
    {/* Rear wheel */}
    <circle cx="52" cy="48" r="10" />
    <circle cx="52" cy="48" r="4.5" fill="white" opacity="0.3" />
    <circle cx="52" cy="48" r="2" />
    {/* Headlight */}
    <rect x="5" y="28" width="5" height="6" rx="1" fill="white" opacity="0.6" />
    {/* Grill lines */}
    <line x1="5" y1="22" x2="5" y2="28" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
  </>
);

export const CATEGORY_SVG_ICONS: Record<string, React.ElementType> = {
  "jet-ski": JetSkiIcon,
  "rv": RVIcon,
  "atv": ATVIcon,
  "utv": UTVIcon,
  "boat": BoatIcon,
  "dirt-bike": DirtBikeIcon,
  "ebike": EbikeIcon,
  "utility-trailer": UtilityTrailerIcon,
  "snowmobile": SnowmobileIcon,
  "towing-vehicle": TowingVehicleIcon,
};

export function getCategoryIcon(slug: string): React.ElementType {
  return CATEGORY_SVG_ICONS[slug] || DefaultCategoryIcon;
}

export function DefaultCategoryIcon({ size = 24, width, height, className, style, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={width ?? size}
      height={height ?? size}
      fill="currentColor"
      className={className}
      style={style}
      {...rest}
    >
      <path d="M8 20 C8 16 11 12 16 12 L48 12 C53 12 56 16 56 20 L56 44 C56 48 53 52 48 52 L16 52 C11 52 8 48 8 44 Z" opacity="0.3" />
      <circle cx="22" cy="50" r="8" />
      <circle cx="22" cy="50" r="3.5" fill="white" opacity="0.3" />
      <circle cx="46" cy="50" r="8" />
      <circle cx="46" cy="50" r="3.5" fill="white" opacity="0.3" />
    </svg>
  );
}
