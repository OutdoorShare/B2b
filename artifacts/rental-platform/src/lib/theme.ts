export function hexToHsl(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "155 42% 18%";
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Determine if a color is light (for choosing foreground color)
export function isLight(hex: string): boolean {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55;
}

// ── Per-slug brand color cache (localStorage) ──────────────────────────────
// Persists the tenant's brand colors so they can be applied before the first
// network response, eliminating the flash of default colors on back-navigation.

export function saveBrandColors(slug: string, primary: string, accent: string) {
  try { localStorage.setItem(`brand_colors_${slug}`, JSON.stringify({ primary, accent })); } catch {}
}

export function loadBrandColors(slug: string): { primary: string; accent: string } | null {
  try {
    const raw = localStorage.getItem(`brand_colors_${slug}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function applyBrandColors(primaryColor?: string | null, accentColor?: string | null) {
  const root = document.documentElement;

  if (primaryColor && primaryColor.startsWith("#") && primaryColor.length === 7) {
    const hsl = hexToHsl(primaryColor);
    const light = isLight(primaryColor);
    const fgHsl = light ? "0 0% 10%" : "0 0% 100%";
    root.style.setProperty("--primary", hsl);
    root.style.setProperty("--primary-foreground", fgHsl);
    root.style.setProperty("--sidebar-primary", hsl);
    root.style.setProperty("--sidebar-primary-foreground", fgHsl);
    root.style.setProperty("--ring", hsl);
  }

  if (accentColor && accentColor.startsWith("#") && accentColor.length === 7) {
    const hsl = hexToHsl(accentColor);
    root.style.setProperty("--accent", hsl);
  }
}

// Curated preset themes for white-label use
export const PRESET_THEMES = [
  { name: "Forest Green", primary: "#1b4332", accent: "#52b788" },
  { name: "Ocean Blue",   primary: "#1e3a5f", accent: "#3b82f6" },
  { name: "Sunset Red",   primary: "#7f1d1d", accent: "#f97316" },
  { name: "Desert Sand",  primary: "#78350f", accent: "#d97706" },
  { name: "Midnight",     primary: "#1e1b4b", accent: "#818cf8" },
  { name: "Rose Garden",  primary: "#881337", accent: "#f43f5e" },
  { name: "Slate",        primary: "#1e293b", accent: "#64748b" },
  { name: "Teal",         primary: "#134e4a", accent: "#14b8a6" },
];
