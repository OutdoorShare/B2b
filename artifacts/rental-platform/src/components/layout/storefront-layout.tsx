import { useState, useEffect, useLayoutEffect, useReducer } from "react";
import { AIAssistant } from "@/components/ai-assistant";
import { StorefrontChat } from "@/components/storefront-chat";
import { Link, useParams, useLocation } from "wouter";
import { Tent, Clock, Lock, User, LogOut, BookOpen, UserCircle, Eye, EyeOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGetBusinessProfile } from "@workspace/api-client-react";
import { PoweredByBadge } from "@/components/powered-by-badge";
import { NotificationBell } from "@/components/notification-bell";
import { applyBrandColors, saveBrandColors, loadBrandColors } from "@/lib/theme";

// ── Demo Gate ────────────────────────────────────────────────────────────────
// Slugs whose storefronts require the same credentials as their admin panel.
const PROTECTED_DEMO_SLUGS = new Set(["demo-outdoorshare"]);
const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

function hasDemoSession(slug: string): boolean {
  try {
    const raw = localStorage.getItem("admin_session");
    if (!raw) return false;
    const s = JSON.parse(raw);
    return !!(s?.token && s?.tenantSlug === slug);
  } catch { return false; }
}

function DemoLoginOverlay({ slug, onAuth }: { slug: string; onAuth: () => void }) {
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const handleLogin = async () => {
    setError("");
    if (!email || !password) { setError("Email and password are required."); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/admin/auth/owner-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, slug }),
      });
      const data = await res.json();
      if (!res.ok || data.tenantSlug !== slug) {
        setError(data.error || "Invalid credentials for this demo site.");
        return;
      }
      localStorage.setItem("admin_session", JSON.stringify({
        type: "owner",
        token: data.token,
        tenantId: data.tenantId,
        tenantName: data.tenantName,
        tenantSlug: data.tenantSlug,
        email: data.email,
      }));
      onAuth();
    } catch {
      setError("Connection error — please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0f1923]">
      <div className="w-full max-w-sm px-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#3ab549]/10 border border-[#3ab549]/30 flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-[#3ab549]" />
          </div>
          <h1 className="text-white text-xl font-bold">Demo Access Required</h1>
          <p className="text-white/50 text-sm mt-1 text-center">
            This is a private demo. Enter your credentials to continue.
          </p>
        </div>

        {/* Form */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-white/60 text-xs font-medium uppercase tracking-wide">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="demo@example.com"
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#3ab549]/60 focus:ring-1 focus:ring-[#3ab549]/40 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-white/60 text-xs font-medium uppercase tracking-wide">Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 pr-10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#3ab549]/60 focus:ring-1 focus:ring-[#3ab549]/40 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-white text-sm font-semibold bg-[#3ab549] hover:bg-[#2ea040] disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-1"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </div>

        <p className="text-center text-white/20 text-xs mt-6">
          Powered by OutdoorShare
        </p>
      </div>
    </div>
  );
}

function DemoGate({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  if (!PROTECTED_DEMO_SLUGS.has(slug)) return <>{children}</>;
  if (hasDemoSession(slug)) return <>{children}</>;
  return <DemoLoginOverlay slug={slug} onAuth={bump} />;
}

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
  const msLeft = Math.max(0, endsAt.getTime() - Date.now());
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
  const label = daysLeft > 1 ? `${daysLeft} days` : hoursLeft <= 1 ? "less than 1 hour" : `${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}`;

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

function GraceBanner({ graceEndsAt }: { graceEndsAt: string }) {
  const endsAt = new Date(graceEndsAt);
  const msLeft = Math.max(0, endsAt.getTime() - Date.now());
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
  const label = daysLeft > 1 ? `${daysLeft} days` : hoursLeft <= 1 ? "less than 1 hour" : `${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}`;

  return (
    <div className="w-full px-4 py-2 flex items-center justify-center gap-2 bg-amber-950 border-b border-amber-800/40">
      <Clock className="w-3 h-3 text-amber-400 shrink-0" />
      <span className="text-[11px] text-amber-300 tracking-wide font-medium">
        Your free trial has ended &mdash; grace period expires in {label}. Your storefront will go offline after that.
      </span>
      <span className="text-amber-700">·</span>
      <a
        href="/get-started"
        className="text-[11px] text-amber-400 hover:text-amber-200 transition-colors underline underline-offset-2 font-semibold"
      >
        Upgrade now
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

  // Brand colors — seeded from localStorage cache so they're correct on first render,
  // then updated when the API responds (no flash on back-navigation or hard reload).
  const DEFAULT_PRIMARY = "#1b4332";
  const DEFAULT_ACCENT  = "#52b788";
  const cached = slug ? loadBrandColors(slug) : null;
  const primaryColor = profile?.primaryColor || cached?.primary || DEFAULT_PRIMARY;
  const accentColor  = profile?.accentColor  || cached?.accent  || DEFAULT_ACCENT;

  // Apply CSS custom properties before first paint (useLayoutEffect is synchronous).
  useLayoutEffect(() => {
    applyBrandColors(primaryColor, accentColor);
  }, [primaryColor, accentColor]);

  // When the real API data arrives, persist it to cache so future visits skip the flash.
  useEffect(() => {
    if (!slug || !profile) return;
    saveBrandColors(slug, primaryColor, accentColor);
    return () => {
      // Reset to defaults when leaving storefront (e.g. navigating to admin)
      applyBrandColors(DEFAULT_PRIMARY, DEFAULT_ACCENT);
    };
  }, [slug, primaryColor, accentColor, profile]);

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

    // All favicon / app-icon links
    setFavicon(image);
    setLink('link[rel="shortcut icon"]',    image);
    setLink('link[rel="apple-touch-icon"]', image);

    // Primary SEO meta
    setMeta('meta[name="description"]',                  "content", description);
    setMeta('meta[name="theme-color"]',                  "content", primaryColor);
    setMeta('meta[name="msapplication-TileColor"]',      "content", primaryColor);
    setMeta('meta[name="msapplication-TileImage"]',      "content", image);
    setMeta('meta[name="apple-mobile-web-app-title"]',   "content", companyName);

    // Open Graph
    setMeta('meta[property="og:title"]',                 "content", title);
    setMeta('meta[property="og:description"]',           "content", description);
    setMeta('meta[property="og:url"]',                   "content", url);
    setMeta('meta[property="og:image"]',                 "content", image);
    setMeta('meta[property="og:image:secure_url"]',      "content", image);
    setMeta('meta[property="og:site_name"]',             "content", companyName);
    setMeta('meta[property="og:image:alt"]',             "content", `${companyName} logo`);

    // Twitter / X
    setMeta('meta[name="twitter:title"]',                "content", title);
    setMeta('meta[name="twitter:description"]',          "content", description);
    setMeta('meta[name="twitter:image"]',                "content", image);
    setMeta('meta[name="twitter:image:alt"]',            "content", `${companyName} logo`);

    // ── restore OutdoorShare defaults on unmount ──────────────────────
    return () => {
      document.title = origTitle;
      setFavicon("/outdoorshare-logo.png");
      setLink('link[rel="shortcut icon"]',    "/outdoorshare-logo.png");
      setLink('link[rel="apple-touch-icon"]', "/outdoorshare-logo.png");

      setMeta('meta[name="description"]',                "content", "Launch your outdoor rental business online in minutes. OutdoorShare gives you a white-label branded storefront, online booking engine, analytics dashboard, and more.");
      setMeta('meta[name="theme-color"]',                "content", "#3ab549");
      setMeta('meta[name="msapplication-TileColor"]',    "content", "#1a2332");
      setMeta('meta[name="msapplication-TileImage"]',    "content", "/outdoorshare-logo.png");
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
    <DemoGate slug={slug ?? ""}>
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Blocked paywall: trial expired AND 3-day grace period has passed */}
      {isBlocked && (
        <TrialExpiredPaywall
          companyName={profile?.name || "This company"}
          companyEmail={companyEmail}
        />
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

            {customer && (
              <NotificationBell
                mode="renter"
                slug={slug}
                customerEmail={customer.email}
                navBase={base}
                iconColor={headerTextMuted}
              />
            )}

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

      {/* Renter Chat Widget — available to all visitors, guests included */}
      {slug && (
        <StorefrontChat
          slug={(profile as any)?.siteSlug ?? slug}
          companyName={profile?.name ?? "Support"}
          customerEmail={customer?.email}
          customerName={customer?.name}
          primaryColor={primaryColor}
          accentColor={accentColor}
        />
      )}

      {/* AI Renter Assistant */}
      {slug && (
        <AIAssistant
          role="renter"
          tenantSlug={(profile as any)?.siteSlug ?? slug}
          companyName={profile?.name ?? undefined}
        />
      )}
    </div>
    </DemoGate>
  );
}
