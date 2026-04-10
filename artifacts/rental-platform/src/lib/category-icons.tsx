import type { SVGProps } from "react";
import {
  FaBicycle, FaMotorcycle, FaShip, FaCaravan, FaTruckPickup,
} from "react-icons/fa6";
import { GiSpeedBoat, GiJeep } from "react-icons/gi";

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

export const JetSkiIcon = wrapLibIcon(GiSpeedBoat);
export const ATVIcon = wrapLibIcon(GiJeep);

export const SnowmobileIcon = svgIcon(
  <>
    <path d="M8 40 C8 36 14 30 26 28 L52 26 C58 28 60 32 58 38 L20 40 Z" />
    <path d="M6 38 C4 38 2 40 4 42 L20 42 L20 38 Z" />
    <path d="M6 34 C8 30 12 28 16 30 L18 38 L8 38 Z" />
    <path d="M24 26 L26 18 C28 14 34 12 40 14 L52 18 L52 26 Z" />
    <rect x="16" y="40" width="44" height="8" rx="4" />
  </>
);

export const UTVIcon = svgIcon(
  <>
    <circle cx="13" cy="48" r="12" />
    <circle cx="13" cy="48" r="5" fill="white" opacity="0.25" />
    <circle cx="51" cy="48" r="12" />
    <circle cx="51" cy="48" r="5" fill="white" opacity="0.25" />
    <rect x="11" y="36" width="42" height="8" rx="2" />
    <rect x="14" y="14" width="4" height="24" rx="2" />
    <rect x="46" y="14" width="4" height="24" rx="2" />
    <rect x="14" y="14" width="36" height="4" rx="2" />
    <rect x="18" y="28" width="12" height="8" rx="2" fill="white" opacity="0.2" />
    <rect x="34" y="28" width="12" height="8" rx="2" fill="white" opacity="0.2" />
  </>
);

export const RVIcon = wrapLibIcon(FaCaravan);
export const EbikeIcon = wrapLibIcon(FaBicycle);
export const DirtBikeIcon = wrapLibIcon(FaMotorcycle);
export const BoatIcon = wrapLibIcon(FaShip);
export const TowingVehicleIcon = wrapLibIcon(FaTruckPickup);

export const UtilityTrailerIcon = svgIcon(
  <>
    <path d="M4 34 L20 28 L20 38 L4 38 Z" />
    <circle cx="4" cy="36" r="3" />
    <rect x="20" y="18" width="42" height="26" rx="3" />
    <circle cx="32" cy="50" r="9" />
    <circle cx="32" cy="50" r="4" fill="white" opacity="0.3" />
    <circle cx="54" cy="50" r="9" />
    <circle cx="54" cy="50" r="4" fill="white" opacity="0.3" />
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
