import type { SVGProps } from "react";
import {
  FaBicycle, FaMotorcycle, FaShip, FaCaravan, FaTruckPickup,
} from "react-icons/fa6";
import { TbRvTruck } from "react-icons/tb";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function svgIcon(path: React.ReactNode, viewBox = "0 0 64 64") {
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

function wrapLibIcon(LibIcon: React.ElementType) {
  return function WrappedIcon({ size = 24, width, height, className, style }: IconProps) {
    return (
      <LibIcon
        size={width ?? height ?? size}
        className={className}
        style={style}
      />
    );
  };
}

export const JetSkiIcon = svgIcon(
  <>
    {/* Hull - elongated, pointed at front */}
    <path d="M4 44 C4 40 8 36 16 34 L54 34 C60 34 62 38 60 44 L58 50 L4 50 Z" />
    {/* Body hump (fairing where rider sits) */}
    <path d="M16 34 L20 24 L48 24 L54 34 Z" />
    {/* Handlebar vertical post */}
    <rect x="14" y="19" width="3" height="9" rx="1" />
    {/* Handlebars - wide T-bar */}
    <rect x="8" y="19" width="14" height="3" rx="1.5" />
    {/* Rider head */}
    <circle cx="33" cy="17" r="5" />
  </>
);

export const ATVIcon = svgIcon(
  <>
    {/* Rear wheel */}
    <circle cx="48" cy="46" r="14" />
    <circle cx="48" cy="46" r="6" fill="white" opacity="0.25" />
    {/* Front wheel */}
    <circle cx="14" cy="46" r="12" />
    <circle cx="14" cy="46" r="5" fill="white" opacity="0.25" />
    {/* Body/frame */}
    <rect x="18" y="30" width="28" height="10" rx="3" />
    {/* Seat */}
    <rect x="22" y="25" width="20" height="7" rx="3" />
    {/* Handlebar vertical fork */}
    <rect x="11" y="20" width="3" height="12" rx="1" />
    {/* Handlebars - wide T-bar */}
    <rect x="4" y="20" width="18" height="3" rx="1.5" />
  </>
);

export const UTVIcon = svgIcon(
  <>
    {/* Rear wheel */}
    <circle cx="50" cy="48" r="12" />
    <circle cx="50" cy="48" r="5" fill="white" opacity="0.25" />
    {/* Front wheel */}
    <circle cx="14" cy="48" r="12" />
    <circle cx="14" cy="48" r="5" fill="white" opacity="0.25" />
    {/* Body/cab floor */}
    <rect x="12" y="36" width="40" height="12" rx="2" />
    {/* Roll cage - front upright */}
    <rect x="14" y="12" width="5" height="26" rx="2" />
    {/* Roll cage - rear upright */}
    <rect x="45" y="12" width="5" height="26" rx="2" />
    {/* Roll cage - top crossbar */}
    <rect x="14" y="12" width="36" height="5" rx="2" />
    {/* Seats (visible through cage) */}
    <rect x="20" y="32" width="10" height="7" rx="1" fill="white" opacity="0.22" />
    <rect x="34" y="32" width="10" height="7" rx="1" fill="white" opacity="0.22" />
  </>
);

export const SnowmobileIcon = svgIcon(
  <>
    {/* Track (long flat bottom) */}
    <rect x="8" y="42" width="50" height="10" rx="5" />
    {/* Body/chassis */}
    <path d="M10 42 L16 28 C18 24 24 22 32 22 L52 22 L56 30 L56 42 Z" />
    {/* Windscreen */}
    <path d="M16 28 L22 20 L40 20 L44 28 Z" />
    {/* Front ski */}
    <path d="M6 36 C4 36 2 38 4 40 L18 40 L18 36 Z" />
    {/* Handlebar */}
    <rect x="10" y="22" width="12" height="3" rx="1.5" />
  </>
);

export const RVIcon = wrapLibIcon(TbRvTruck);
export const CamperIcon = wrapLibIcon(FaCaravan);
export const EbikeIcon = wrapLibIcon(FaBicycle);
export const DirtBikeIcon = wrapLibIcon(FaMotorcycle);
export const BoatIcon = wrapLibIcon(FaShip);
export const TowingVehicleIcon = wrapLibIcon(FaTruckPickup);

export const UtilityTrailerIcon = svgIcon(
  <>
    {/* Hitch ball / tongue */}
    <path d="M4 34 L20 28 L20 38 L4 38 Z" />
    <circle cx="4" cy="36" r="3" />
    {/* Box body */}
    <rect x="20" y="18" width="42" height="26" rx="3" />
    {/* Rear wheel */}
    <circle cx="32" cy="50" r="9" />
    <circle cx="32" cy="50" r="4" fill="white" opacity="0.3" />
    {/* Front wheel */}
    <circle cx="54" cy="50" r="9" />
    <circle cx="54" cy="50" r="4" fill="white" opacity="0.3" />
  </>
);

export const CATEGORY_SVG_ICONS: Record<string, React.ElementType> = {
  "jet-ski": JetSkiIcon,
  "rv": RVIcon,
  "camper": CamperIcon,
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

export function DefaultCategoryIcon({ size = 24, width, height, className, style }: IconProps) {
  const LibIcon = FaShip;
  return (
    <LibIcon
      size={width ?? height ?? size}
      className={className}
      style={style}
    />
  );
}
