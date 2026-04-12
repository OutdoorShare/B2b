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
    {/* Rear wheel — large knobby off-road tire */}
    <circle cx="49" cy="47" r="13" />
    <circle cx="49" cy="47" r="5.5" fill="white" opacity="0.28" />
    {/* Rear wheel spokes */}
    <rect x="48" y="36" width="2" height="7" rx="1" fill="white" opacity="0.25" />
    <rect x="48" y="51" width="2" height="7" rx="1" fill="white" opacity="0.25" />
    <rect x="38" y="46" width="7" height="2" rx="1" fill="white" opacity="0.25" />
    <rect x="53" y="46" width="7" height="2" rx="1" fill="white" opacity="0.25" />

    {/* Front wheel — same size */}
    <circle cx="15" cy="47" r="13" />
    <circle cx="15" cy="47" r="5.5" fill="white" opacity="0.28" />
    {/* Front wheel spokes */}
    <rect x="14" y="36" width="2" height="7" rx="1" fill="white" opacity="0.25" />
    <rect x="14" y="51" width="2" height="7" rx="1" fill="white" opacity="0.25" />
    <rect x="4" y="46" width="7" height="2" rx="1" fill="white" opacity="0.25" />
    <rect x="19" y="46" width="7" height="2" rx="1" fill="white" opacity="0.25" />

    {/* Chassis / frame rail connecting the two wheels */}
    <rect x="11" y="40" width="42" height="5" rx="2" />

    {/* Low flat body cab area */}
    <rect x="13" y="30" width="38" height="12" rx="2" />

    {/* Front nose / grille — angled forward */}
    <path d="M13 30 L7 40 L13 40 Z" />

    {/* Rear cargo bed bump */}
    <rect x="44" y="22" width="7" height="9" rx="1.5" />

    {/* Roll cage — THIN front upright (clearly open frame) */}
    <rect x="15" y="13" width="3" height="19" rx="1.5" />

    {/* Roll cage — THIN rear upright */}
    <rect x="46" y="13" width="3" height="19" rx="1.5" />

    {/* Roll cage — top rail */}
    <rect x="15" y="13" width="34" height="3" rx="1.5" />

    {/* Windshield (small angled element at front) */}
    <path d="M19 30 L22 17 L26 17 L23 30 Z" fill="white" opacity="0.22" />

    {/* Two side-by-side seats visible inside cab */}
    <rect x="26" y="26" width="8" height="5" rx="1" fill="white" opacity="0.28" />
    <rect x="36" y="26" width="8" height="5" rx="1" fill="white" opacity="0.28" />
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
