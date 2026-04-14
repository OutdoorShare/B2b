import { useState, useEffect, useLayoutEffect, useReducer } from "react";
import { AIAssistant } from "@/components/ai-assistant";
import { StorefrontChat } from "@/components/storefront-chat";
import { Link, useParams, useLocation } from "wouter";
import { Mountain, Lock, User, LogOut, BookOpen, UserCircle, Eye, EyeOff, ShieldAlert, Search, CalendarDays } from "lucide-react";
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
import { applyStorefrontBrand, applyPlatformBrand } from "@/lib/branding";
import { cn } from "@/lib/utils";

// ── Demo Gate ────────────────────────────────────────────────────────────────
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
        credentials: "include",
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
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#3ab549]/10 border border-[#3ab549]/30 flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-[#3ab549]" />
          </div>
          <h1 className="text-white text-xl font-bold">Demo Access Required</h1>
          <p className="text-white/50 text-sm mt-1 text-center">
            This is a private demo. Enter your credentials to continue.
          </p>
        </div>

        <form
          onSubmit={e => { e.preventDefault(); handleLogin(); }}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-white/60 text-xs font-medium uppercase tracking-wide">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="demo@example.com"
              autoComplete="email"
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
                placeholder="••••••••"
                autoComplete="current-password"
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
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-white text-sm font-semibold bg-[#3ab549] hover:bg-[#2ea040] disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-1"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

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

function isLight(hex: string): boolean {
  const c = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 145;
}

function darken(hex: string, amt = 20): string {
  const c = hex.replace("#", "").padEnd(6, "0");
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp(parseInt(c.slice(0, 2), 16) - amt).toString(16).padStart(2, "0");
  const g = clamp(parseInt(c.slice(2, 4), 16) - amt).toString(16).padStart(2, "0");
  const b = clamp(parseInt(c.slice(4, 6), 16) - amt).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}



interface CustomerSession { id: number; email: string; name: string; }

function loadCustomerSession(): CustomerSession | null {
  try { const r = localStorage.getItem("rental_customer"); return r ? JSON.parse(r) : null; }
  catch { return null; }
}

export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const [location, setLocation] = useLocation();
  const base = slug ? `/${slug}` : "";

  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => { setCustomer(loadCustomerSession()); }, []);

  const handleLogout = () => {
    localStorage.removeItem("rental_customer");
    setCustomer(null);
    setLocation(`${base}/login`);
  };

  const initials = customer?.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "";

  const { data: profile, isError: businessNotFound, isLoading: businessLoading } = useGetBusinessProfile({
    query: { queryKey: ["/api/business", slug] }
  });

  const plan = (profile as any)?.plan as string | undefined;
  const isPaid = plan && plan !== "starter";
  const companyEmail = (profile as any)?.email as string | null | undefined;

  const DEFAULT_PRIMARY = "#1b4332";
  const DEFAULT_ACCENT  = "#52b788";
  const cached = slug ? loadBrandColors(slug) : null;
  const primaryColor = profile?.primaryColor || cached?.primary || DEFAULT_PRIMARY;
  const accentColor  = profile?.accentColor  || cached?.accent  || DEFAULT_ACCENT;

  useLayoutEffect(() => {
    applyBrandColors(primaryColor, accentColor);
  }, [primaryColor, accentColor]);

  useEffect(() => {
    if (!slug || !profile) return;
    saveBrandColors(slug, primaryColor, accentColor);
    return () => {
      applyBrandColors(DEFAULT_PRIMARY, DEFAULT_ACCENT);
    };
  }, [slug, primaryColor, accentColor, profile]);

  const logoUrl   = (profile as any)?.logoUrl   as string | undefined;
  const tagline   = (profile as any)?.tagline   as string | undefined;
  const desc      = (profile as any)?.description as string | undefined;
  const companyName = profile?.name;

  useEffect(() => {
    if (!companyName) return;
    const cleanup = applyStorefrontBrand({
      companyName,
      logoUrl,
      primaryColor,
      description: desc,
      tagline,
    });
    return cleanup;
  }, [companyName, tagline, desc, logoUrl, primaryColor]);

  const headerText     = isLight(primaryColor) ? "#111111" : "#ffffff";
  const headerTextMuted = isLight(primaryColor) ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)";
  const headerBorder   = isLight(primaryColor) ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.10)";
  const btnText        = isLight(accentColor)  ? "#111111" : "#ffffff";
  const btnHoverBg     = darken(accentColor, 18);

  const isTabActive = (path: string, exact?: boolean) => {
    const full = `${base}${path}`;
    if (exact) return location === full || location === `${full}/`;
    return location === full || location.startsWith(`${full}/`);
  };

  const bottomTabs = [
    { name: "Browse", path: "", icon: Search, exact: true },
    { name: "Bookings", path: "/my-bookings", icon: CalendarDays },
    ...(customer ? [{ name: "Account", path: "/profile", icon: UserCircle }] : [{ name: "Sign In", path: "/login", icon: User, exact: true }]),
  ];

  if (businessLoading) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (businessNotFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-6">
          <Mountain className="w-8 h-8 text-gray-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Page not found</h1>
        <p className="text-gray-500 max-w-sm">
          No rental company was found at this address. Double-check the URL or contact the company directly.
        </p>
      </div>
    );
  }

  return (
    <DemoGate slug={slug ?? ""}>
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* ── Tenant header ── */}
      <header
        className="sticky top-0 z-50 w-full border-b"
        style={{
          backgroundColor: primaryColor,
          borderBottomColor: headerBorder,
        }}
      >
        <div className="container mx-auto px-3 md:px-4 h-14 md:h-16 flex items-center justify-between">
          <Link href={base || "/"} className="flex items-center gap-2 md:gap-2.5 min-w-0 active:opacity-80 transition-opacity">
            {profile?.logoUrl && !logoFailed ? (
              <img
                src={profile.logoUrl}
                alt={profile.name}
                className="h-7 md:h-8 object-contain shrink-0"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <Mountain className="w-5 h-5 md:w-6 md:h-6 shrink-0" style={{ color: accentColor }} />
            )}
            <span
              className="font-bold text-base md:text-lg tracking-tight truncate"
              style={{ color: headerText }}
            >
              {profile?.name || "Outdoor Rentals"}
            </span>
          </Link>

          <nav className="flex items-center gap-2 md:gap-4 shrink-0">
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-2 rounded-full focus:outline-none active:scale-95 transition-transform"
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
                  <DropdownMenuItem asChild>
                    <Link href={`${base}/my-claims`} className="flex items-center gap-2 cursor-pointer">
                      <ShieldAlert className="w-4 h-4" /> My Claims
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
              <Link
                href={`${base}/login`}
                className="text-sm font-semibold px-4 py-1.5 rounded-full transition-colors hidden md:inline-block active:scale-95"
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

      <main className="flex-1 pb-[calc(env(safe-area-inset-bottom,0px)+3.5rem)] md:pb-0">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-gray-950 py-8 md:py-12 mt-10 md:mt-16 mb-14 md:mb-0">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
            <div className="flex items-center gap-2.5">
              {profile?.logoUrl && !logoFailed ? (
                <img src={profile.logoUrl} alt={profile.name} className="h-7 object-contain opacity-80" onError={() => setLogoFailed(true)} />
              ) : (
                <Mountain className="w-5 h-5 text-white/60" />
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

      {/* ── Mobile Bottom Tab Bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[60] border-t bg-white/95 dark:bg-gray-950/95 backdrop-blur-lg border-gray-200 dark:border-gray-800 pb-[env(safe-area-inset-bottom,0px)]">
        <div className="flex items-stretch h-14">
          {bottomTabs.map((tab) => {
            const active = isTabActive(tab.path, (tab as any).exact);
            const href = `${base}${tab.path}`;
            return (
              <Link
                key={tab.name}
                href={href}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors duration-150 active:bg-gray-100 dark:active:bg-gray-800 relative",
                  active ? "text-[var(--brand-primary,#1b4332)]" : "text-gray-400 dark:text-gray-500"
                )}
                style={active ? { color: primaryColor } : undefined}
              >
                <tab.icon className={cn("w-[22px] h-[22px] transition-all", active && "scale-110")} strokeWidth={active ? 2.5 : 1.8} />
                <span className={cn("text-[10px] leading-none", active ? "font-semibold" : "font-medium")}>{tab.name}</span>
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full" style={{ backgroundColor: primaryColor }} />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {!isPaid && <PoweredByBadge variant="fixed" />}

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

      {slug && isPaid && (
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
