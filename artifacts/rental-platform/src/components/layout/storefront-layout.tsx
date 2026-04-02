import { useState, useEffect } from "react";
import { AIAssistant } from "@/components/ai-assistant";
import { Link, useParams, useLocation } from "wouter";
import { Tent, Clock, Lock, User, LogOut, BookOpen, UserCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGetBusinessProfile } from "@workspace/api-client-react";
import { PoweredByBadge } from "@/components/powered-by-badge";
import { applyBrandColors } from "@/lib/theme";

const OS_GREEN = "#3ab549";

/** Returns true if a hex color is perceptually light */
function isLight(hex: string): boolean {
  const c = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 145;
}

/** Darken a hex color by a given amount (0–255) */
function darken(hex: string, amt = 20): string {
  const c = hex.replace("#", "").padEnd(6, "0");
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp(parseInt(c.slice(0, 2), 16) - amt).toString(16).padStart(2, "0");
  const g = clamp(parseInt(c.slice(2, 4), 16) - amt).toString(16).padStart(2, "0");
  const b = clamp(parseInt(c.slice(4, 6), 16) - amt).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

function TrialExpiredPaywall({ companyName, companyEmail }: { companyName: string; companyEmail?: string | null }) {
  const mailtoHref = companyEmail
    ? `mailto:${companyEmail}?subject=Booking%20Inquiry&body=Hi%2C%20I%27d%20like%20to%20make%20a%20booking%20through%20${encodeURIComponent(companyName)}.`
    : undefined;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7 text-orange-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground mb-2">Website temporarily unavailable</h2>
          <p className="text-sm text-muted-foreground">
            <strong>{companyName}</strong>'s online storefront is currently unavailable. Please contact them directly to make a booking or get more information.
          </p>
        </div>
        {mailtoHref ? (
          <a
            href={mailtoHref}
            className="block w-full py-2.5 rounded-lg text-white text-sm font-bold transition-opacity hover:opacity-90"
            style={{ background: `linear-gradient(90deg, #1a6b2e, ${OS_GREEN})` }}
          >
            Contact {companyName}
          </a>
        ) : (
          <div
            className="block w-full py-2.5 rounded-lg text-white text-sm font-bold"
            style={{ background: `linear-gradient(90deg, #1a6b2e, ${OS_GREEN})` }}
          >
            Contact {companyName}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Is this your business?{" "}
          <button
            className="underline hover:text-foreground transition-colors"
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
        </p>
      </div>
    </div>
  );
}

function TrialBanner({ trialEndsAt }: { trialEndsAt: string }) {
  const endsAt = new Date(trialEndsAt);
  const hoursLeft = Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60)));
  const label = hoursLeft <= 1 ? "<1h" : `${hoursLeft}h`;

  return (
    <div className="w-full px-4 py-1 flex items-center justify-center gap-2 bg-gray-950 border-b border-white/5">
      <Clock className="w-2.5 h-2.5 text-white/25 shrink-0" />
      <span className="text-[11px] text-white/30 tracking-wide">
        Free trial &mdash; {label} remaining
      </span>
      <span className="text-white/10">·</span>
      <a
        href="/get-started"
        className="text-[11px] text-white/35 hover:text-white/60 transition-colors underline underline-offset-2"
      >
        Upgrade
      </a>
    </div>
  );
}

interface CustomerSession { id: number; email: string; name: string; }

function loadCustomerSession(): CustomerSession | null {
  try { const r = localStorage.getItem("rental_customer"); return r ? JSON.parse(r) : null; }
  catch { return null; }
}

export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const base = slug ? `/${slug}` : "";

  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  useEffect(() => { setCustomer(loadCustomerSession()); }, []);

  const handleLogout = () => {
    localStorage.removeItem("rental_customer");
    setCustomer(null);
    setLocation(`${base}/login`);
  };

  // initials for avatar
  const initials = customer?.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "";

  const { data: profile } = useGetBusinessProfile({
    query: { queryKey: ["/api/business", slug] }
  });

  const trialActive = (profile as any)?.trialActive as boolean | undefined;
  const trialExpired = (profile as any)?.trialExpired as boolean | undefined;
  const isBlocked = (profile as any)?.isBlocked as boolean | undefined;
  const trialEndsAt = (profile as any)?.trialEndsAt as string | null | undefined;
  const graceEndsAt = (profile as any)?.graceEndsAt as string | null | undefined;
  const plan = (profile as any)?.plan as string | undefined;
  const isPaid = plan && plan !== "starter";
  const companyEmail = (profile as any)?.email as string | null | undefined;

  // Brand colors from admin settings
  const primaryColor = profile?.primaryColor || "#1b4332";
  const accentColor  = profile?.accentColor  || "#52b788";

  // Apply CSS custom properties so Tailwind utilities (bg-primary, text-primary, etc.)
  // pick up the tenant's brand colors across ALL storefront pages.
  useEffect(() => {
    applyBrandColors(primaryColor, accentColor);
    return () => {
      // Reset to defaults when leaving storefront (e.g. navigating to admin)
      applyBrandColors("#1b4332", "#52b788");
    };
  }, [primaryColor, accentColor]);

  // Dynamic meta: swap favicon, title, og:*, twitter:*, apple-touch-icon, and theme-color
  // to the tenant's branding while on their storefront. Restore OutdoorShare defaults on unmount.
  const logoUrl   = (profile as any)?.logoUrl   as string | undefined;
  const tagline   = (profile as any)?.tagline   as string | undefined;
  const desc      = (profile as any)?.description as string | undefined;
  const companyName = profile?.name;

  useEffect(() => {
    if (!companyName) return;

    const title       = `${companyName} — Rental Booking`;
    const description = desc || tagline || `Book rentals from ${companyName} online.`;
    const toAbsolute  = (u: string) => u.startsWith("http") ? u : `${window.location.origin}${u.startsWith("/") ? "" : "/"}${u}`;
    const image       = toAbsolute(logoUrl || "/outdoorshare-logo.png");
    const url         = window.location.href;

    // ── helpers ───────────────────────────────────────────────────────
    const setMeta = (selector: string, attr: string, value: string) => {
      const el = document.querySelector<HTMLMetaElement>(selector);
      if (el) (el as any)[attr] = value;
    };
    const setLink = (selector: string, href: string) => {
      const el = document.querySelector<HTMLLinkElement>(selector);
      if (el) el.href = href;
    };
    const setFavicon = (href: string) => {
      let link = document.querySelector<HTMLLinkElement>("link#favicon");
      if (!link) {
        link = document.createElement("link");
        link.id = "favicon"; link.rel = "icon"; link.type = "image/png";
        document.head.appendChild(link);
      }
      link.href = href;
    };

    // ── save originals for cleanup ────────────────────────────────────
    const origTitle = document.title;

    // ── apply tenant branding ─────────────────────────────────────────
    document.title = title;
    setFavicon(image);
    setLink('link[rel="apple-touch-icon"]', image);

    setMeta('meta[name="theme-color"]',                  "content", primaryColor);
    setMeta('meta[name="apple-mobile-web-app-title"]',   "content", companyName);

    setMeta('meta[property="og:title"]',                 "content", title);
    setMeta('meta[property="og:description"]',           "content", description);
    setMeta('meta[property="og:url"]',                   "content", url);
    setMeta('meta[property="og:image"]',                 "content", image);
    setMeta('meta[property="og:image:secure_url"]',      "content", image);
    setMeta('meta[property="og:site_name"]',             "content", companyName);
    setMeta('meta[property="og:image:alt"]',             "content", `${companyName} logo`);

    setMeta('meta[name="twitter:title"]',                "content", title);
    setMeta('meta[name="twitter:description"]',          "content", description);
    setMeta('meta[name="twitter:image"]',                "content", image);
    setMeta('meta[name="twitter:image:alt"]',            "content", `${companyName} logo`);

    // ── restore OutdoorShare defaults on unmount ──────────────────────
    return () => {
      document.title = origTitle;
      setFavicon("/outdoorshare-logo.png");
      setLink('link[rel="apple-touch-icon"]', "/outdoorshare-logo.png");

      setMeta('meta[name="theme-color"]',                "content", "#3ab549");
      setMeta('meta[name="apple-mobile-web-app-title"]', "content", "OutdoorShare");

      const OS_TITLE = "OutdoorShare — Rental Management Software for Outdoor Equipment Businesses";
      const OS_DESC  = "Launch your outdoor rental business online in minutes. White-label branded storefront, booking engine, analytics & admin dashboard. Free 14-day trial.";
      const OS_IMG   = "https://myoutdoorshare.com/opengraph.jpg";
      const OS_URL   = "https://myoutdoorshare.com/";

      setMeta('meta[property="og:title"]',               "content", OS_TITLE);
      setMeta('meta[property="og:description"]',         "content", OS_DESC);
      setMeta('meta[property="og:url"]',                 "content", OS_URL);
      setMeta('meta[property="og:image"]',               "content", OS_IMG);
      setMeta('meta[property="og:image:secure_url"]',    "content", OS_IMG);
      setMeta('meta[property="og:site_name"]',           "content", "OutdoorShare");
      setMeta('meta[property="og:image:alt"]',           "content", "OutdoorShare rental management platform");

      setMeta('meta[name="twitter:title"]',              "content", OS_TITLE);
      setMeta('meta[name="twitter:description"]',        "content", OS_DESC);
      setMeta('meta[name="twitter:image"]',              "content", OS_IMG);
      setMeta('meta[name="twitter:image:alt"]',          "content", "OutdoorShare rental management platform");
    };
  }, [companyName, tagline, desc, logoUrl, primaryColor]);

  // Auto-contrast text colors
  const headerText     = isLight(primaryColor) ? "#111111" : "#ffffff";
  const headerTextMuted = isLight(primaryColor) ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)";
  const headerBorder   = isLight(primaryColor) ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.10)";
  const btnText        = isLight(accentColor)  ? "#111111" : "#ffffff";
  const btnHoverBg     = darken(accentColor, 18);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Blocked paywall: trial expired AND 3-day grace period has passed */}
      {isBlocked && (
        <TrialExpiredPaywall
          companyName={profile?.name || "This company"}
          companyEmail={companyEmail}
        />
      )}

      {/* Subtle trial bar */}
      {trialActive && trialEndsAt && (
        <TrialBanner trialEndsAt={trialEndsAt} />
      )}

      {/* ── Tenant header ── */}
      <header
        className="sticky top-0 z-50 w-full border-b"
        style={{
          backgroundColor: primaryColor,
          borderBottomColor: headerBorder,
        }}
      >
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo / name */}
          <Link href={base || "/"} className="flex items-center gap-2.5 min-w-0">
            {profile?.logoUrl ? (
              <img
                src={profile.logoUrl}
                alt={profile.name}
                className="h-8 object-contain shrink-0"
              />
            ) : (
              <Tent className="w-6 h-6 shrink-0" style={{ color: accentColor }} />
            )}
            <span
              className="font-bold text-lg tracking-tight truncate"
              style={{ color: headerText }}
            >
              {profile?.name || "Outdoor Rentals"}
            </span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-4 shrink-0">
            <Link
              href={base || "/"}
              className="text-sm font-medium transition-opacity hover:opacity-100 hidden sm:block"
              style={{ color: headerTextMuted }}
            >
              Listings
            </Link>

            {customer ? (
              /* Logged-in state */
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-2 rounded-full focus:outline-none"
                    aria-label="Account menu"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-opacity hover:opacity-80"
                      style={{ backgroundColor: accentColor, color: btnText }}
                    >
                      {initials || <User className="w-3.5 h-3.5" />}
                    </div>
                    <span
                      className="text-sm font-medium hidden md:inline max-w-[100px] truncate"
                      style={{ color: headerText }}
                    >
                      {customer.name.split(" ")[0]}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-3 py-2">
                    <p className="text-xs font-semibold text-gray-900 truncate">{customer.name}</p>
                    <p className="text-xs text-gray-400 truncate">{customer.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`${base}/profile`} className="flex items-center gap-2 cursor-pointer">
                      <UserCircle className="w-4 h-4" /> My Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`${base}/my-bookings`} className="flex items-center gap-2 cursor-pointer">
                      <BookOpen className="w-4 h-4" /> My Bookings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-red-600 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              /* Logged-out state */
              <Link
                href={`${base}/login`}
                className="text-sm font-semibold px-4 py-1.5 rounded-full transition-colors"
                style={{ backgroundColor: accentColor, color: btnText }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = btnHoverBg)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = accentColor)}
              >
                Login
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-gray-950 py-12 mt-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              {profile?.logoUrl ? (
                <img src={profile.logoUrl} alt={profile.name} className="h-7 object-contain opacity-80" />
              ) : (
                <Tent className="w-5 h-5 text-white/60" />
              )}
              <span className="font-bold text-white/70 text-sm">{profile?.name || "Outdoor Rentals"}</span>
            </div>

            {!isPaid && (
              <div className="flex items-center gap-2">
                <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="w-5 h-5 object-contain" />
                <span className="text-sm font-black text-white tracking-tight">OutdoorShare</span>
                <span className="text-xs text-white/40 ml-1">platform</span>
              </div>
            )}

            <p className="text-xs text-white/30">
              &copy; {new Date().getFullYear()} {profile?.name || "Outdoor Rentals"}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Fixed corner badge — only shown during trial */}
      {trialActive && <PoweredByBadge variant="fixed" />}

      {/* AI Renter Assistant */}
      {slug && (
        <AIAssistant
          role="renter"
          tenantSlug={(profile as any)?.siteSlug ?? slug}
          companyName={profile?.name ?? undefined}
        />
      )}
    </div>
  );
}
