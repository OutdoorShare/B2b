// ─────────────────────────────────────────────────────────────────────────────
// Central branding resolver
//
// Two contexts:
//   Platform / admin  → OutdoorShare brand (favicon, title, OG, meta)
//   Storefront / renter → Tenant brand (favicon, title, OG, meta)
//
// Usage:
//   import { applyPlatformBrand, applyStorefrontBrand, OS_* } from "@/lib/branding";
// ─────────────────────────────────────────────────────────────────────────────

// ── OutdoorShare platform constants ──────────────────────────────────────────
export const OS_NAME        = "OutdoorShare";
export const OS_LOGO_URL    = "/outdoorshare-logo.png";
export const OS_FAVICON_URL = "/favicon-32.png?v=3";
export const OS_APPLE_ICON  = "/favicon-180.png?v=3";
export const OS_GREEN       = "#3ab549";
export const OS_DARK        = "#1a2332";
export const OS_OG_IMAGE    = "https://myoutdoorshare.com/opengraph.jpg";
export const OS_SITE_URL    = "https://myoutdoorshare.com/";
export const OS_DESCRIPTION = "Launch your outdoor rental business online in minutes. OutdoorShare gives you a white-label branded storefront, online booking engine, analytics dashboard, and more.";
export const OS_TITLE       = "OutdoorShare — Rental Management Software for Outdoor Equipment Businesses";

// ── DOM helpers ───────────────────────────────────────────────────────────────
function setFavicon(href: string): void {
  let link = document.querySelector<HTMLLinkElement>("link#favicon");
  if (!link) {
    link = document.createElement("link");
    link.id  = "favicon";
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = href.endsWith(".svg") ? "image/svg+xml" : "image/png";
  link.href = href;
}

function setLink(selector: string, href: string): void {
  const el = document.querySelector<HTMLLinkElement>(selector);
  if (el) el.href = href;
}

function setMeta(selector: string, value: string): void {
  const el = document.querySelector<HTMLMetaElement>(selector);
  if (el) el.content = value;
}

// ── Apply OutdoorShare (platform/admin) branding to document head ─────────────
// Pass an optional pageTitle to customize the tab title while keeping OS brand.
// Returns nothing — call restoreDefaultBrand() in cleanup if needed.
export function applyPlatformBrand(pageTitle?: string): void {
  document.title = pageTitle ?? OS_TITLE;

  setFavicon(OS_FAVICON_URL);
  setLink('link[rel="shortcut icon"]',    OS_FAVICON_URL);
  setLink('link[rel="apple-touch-icon"]', OS_APPLE_ICON);

  setMeta('meta[name="theme-color"]',                OS_GREEN);
  setMeta('meta[name="msapplication-TileColor"]',    OS_DARK);
  setMeta('meta[name="msapplication-TileImage"]',    OS_LOGO_URL);
  setMeta('meta[name="apple-mobile-web-app-title"]', OS_NAME);

  setMeta('meta[property="og:title"]',               pageTitle ?? OS_TITLE);
  setMeta('meta[property="og:description"]',         OS_DESCRIPTION);
  setMeta('meta[property="og:url"]',                 OS_SITE_URL);
  setMeta('meta[property="og:image"]',               OS_OG_IMAGE);
  setMeta('meta[property="og:image:secure_url"]',    OS_OG_IMAGE);
  setMeta('meta[property="og:site_name"]',           OS_NAME);
  setMeta('meta[property="og:image:alt"]',           `${OS_NAME} rental management platform`);

  setMeta('meta[name="twitter:title"]',              pageTitle ?? OS_TITLE);
  setMeta('meta[name="twitter:description"]',        OS_DESCRIPTION);
  setMeta('meta[name="twitter:image"]',              OS_OG_IMAGE);
  setMeta('meta[name="twitter:image:alt"]',          `${OS_NAME} rental management platform`);
}

// Alias: explicitly restore OutdoorShare defaults (same as applyPlatformBrand with default title)
export const restoreDefaultBrand = () => applyPlatformBrand();

// ── Storefront brand descriptor ───────────────────────────────────────────────
export interface StorefrontBrandOptions {
  companyName: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  description?: string | null;
  tagline?: string | null;
}

// ── Apply tenant / storefront branding to document head ───────────────────────
// Returns a cleanup function that restores OutdoorShare defaults on unmount.
export function applyStorefrontBrand(opts: StorefrontBrandOptions): () => void {
  const { companyName, logoUrl, primaryColor, description, tagline } = opts;

  const title   = `${companyName} — Rental Booking`;
  const desc    = description || tagline || `Book rentals from ${companyName} online.`;
  const color   = primaryColor || OS_GREEN;
  const abs     = (u: string) =>
    u.startsWith("http") ? u : `${window.location.origin}${u.startsWith("/") ? "" : "/"}${u}`;
  const fallback = abs(OS_APPLE_ICON);
  const image    = logoUrl ? abs(logoUrl) : fallback;

  document.title = title;

  const applyIcons = (iconUrl: string) => {
    setFavicon(iconUrl);
    setLink('link[rel="shortcut icon"]',    iconUrl);
    setLink('link[rel="apple-touch-icon"]', iconUrl);
  };

  if (logoUrl) {
    const testImg     = new Image();
    testImg.onload  = () => applyIcons(abs(logoUrl));
    testImg.onerror = () => {
      console.warn(`[branding] Could not load tenant logo: ${logoUrl} — falling back to platform icon`);
      applyIcons(fallback);
    };
    testImg.src = abs(logoUrl);
  } else {
    applyIcons(fallback);
  }

  setMeta('meta[name="description"]',                desc);
  setMeta('meta[name="theme-color"]',                color);
  setMeta('meta[name="msapplication-TileColor"]',    color);
  setMeta('meta[name="msapplication-TileImage"]',    image);
  setMeta('meta[name="apple-mobile-web-app-title"]', companyName);

  setMeta('meta[property="og:title"]',               title);
  setMeta('meta[property="og:description"]',         desc);
  setMeta('meta[property="og:url"]',                 window.location.href);
  setMeta('meta[property="og:image"]',               image);
  setMeta('meta[property="og:image:secure_url"]',    image);
  setMeta('meta[property="og:site_name"]',           companyName);
  setMeta('meta[property="og:image:alt"]',           `${companyName} logo`);

  setMeta('meta[name="twitter:title"]',              title);
  setMeta('meta[name="twitter:description"]',        desc);
  setMeta('meta[name="twitter:image"]',              image);
  setMeta('meta[name="twitter:image:alt"]',          `${companyName} logo`);

  return restoreDefaultBrand;
}
