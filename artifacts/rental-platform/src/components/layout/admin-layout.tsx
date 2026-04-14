import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { applyPlatformBrand } from "@/lib/branding";
import { AIAssistant } from "@/components/ai-assistant";
import { getAdminSession } from "@/lib/admin-nav";
import { NotificationBell } from "@/components/notification-bell";
import { useTheme } from "@/components/theme-provider";
import { 
  LayoutDashboard, 
  Package, 
  CalendarDays, 
  FileText, 
  BarChart3, 
  MonitorSmartphone, 
  Settings,
  ShieldAlert,
  Users,
  MessageSquare,
  MessageCircle,
  FileSignature,
  Wallet,
  Tag,
  Plus,
  Rocket,
  CreditCard,
  MessageSquarePlus,
  IdCard,
  Warehouse,
  BookOpen,
  ExternalLink,
  Sun,
  Moon,
  Mountain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetBusinessProfile } from "@workspace/api-client-react";
import { getAdminSlug } from "@/lib/admin-nav";

type NavItem = { name: string; path: string; icon: React.ElementType; external?: boolean };
type NavGroup = { group: string | null; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    group: null,
    items: [
      { name: "Dashboard", path: "", icon: LayoutDashboard },
      { name: "Launchpad", path: "/launchpad", icon: Rocket },
    ],
  },
  {
    group: "Operations",
    items: [
      { name: "Bookings", path: "/bookings", icon: CalendarDays },
      { name: "Listings", path: "/listings", icon: Package },
      { name: "Activities", path: "/activities", icon: Mountain },
      { name: "Experience Bookings", path: "/activity-bookings", icon: CalendarDays },
      { name: "Inventory", path: "/inventory", icon: Warehouse },
      { name: "Quotes", path: "/quotes", icon: FileText },
      { name: "Claims", path: "/claims", icon: ShieldAlert },
    ],
  },
  {
    group: "Customers",
    items: [
      { name: "Contacts", path: "/contacts", icon: Users },
      { name: "Messages", path: "/messages", icon: MessageCircle },
      { name: "Communications", path: "/communications", icon: MessageSquare },
      { name: "Contact Cards", path: "/contact-cards", icon: IdCard },
      { name: "Waivers", path: "/waivers", icon: FileSignature },
      { name: "Contract", path: "/contract", icon: FileText },
    ],
  },
  {
    group: "Tools",
    items: [
      { name: "Analytics", path: "/analytics", icon: BarChart3 },
      { name: "Promo Codes", path: "/promo-codes", icon: Tag },
      { name: "Kiosk Mode", path: "/kiosk", icon: MonitorSmartphone },
    ],
  },
  {
    group: "Account",
    items: [
      { name: "Team", path: "/team", icon: Users },
      { name: "My Wallet", path: "/wallet", icon: Wallet },
      { name: "Billing", path: "/billing", icon: CreditCard },
      { name: "Settings", path: "/settings", icon: Settings },
      { name: "Feedback", path: "/feedback", icon: MessageSquarePlus },
      { name: "Documentation", path: "/docs/", icon: BookOpen, external: true },
    ],
  },
];

const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap(g => g.items);

function EmailVerificationBanner() {
  const session = getAdminSession();
  const dismissKey = session ? `ev-banner-dismissed-${session.tenantSlug ?? session.email}` : null;
  const [dismissed, setDismissed] = useState(() => {
    if (!dismissKey) return false;
    return localStorage.getItem(dismissKey) === "1";
  });
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const base = import.meta.env.BASE_URL.replace(/\/+$/, "");

  // Only show for owner accounts with unverified email
  if (dismissed || !session || session.type !== "owner" || session.emailVerified !== false) {
    return null;
  }

  const handleDismiss = () => {
    if (dismissKey) localStorage.setItem(dismissKey, "1");
    setDismissed(true);
  };

  const handleResend = async () => {
    if (!session.email) return;
    setResending(true);
    try {
      await fetch(`${base}/api/public/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: session.email }),
      });
      setResent(true);
    } catch {
      setResent(true);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-amber-600 shrink-0">⚠️</span>
        <p className="text-sm text-amber-800 font-medium">
          {resent
            ? "Verification email sent — check your inbox."
            : "Please verify your email address to fully activate your account."}
        </p>
      </div>
      {!resent && (
        <button
          onClick={handleResend}
          disabled={resending}
          className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline decoration-dotted shrink-0 disabled:opacity-50"
        >
          {resending ? "Sending…" : "Resend verification email"}
        </button>
      )}
      <button
        onClick={handleDismiss}
        className="text-xs text-amber-500 hover:text-amber-700 shrink-0 ml-1"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}


export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const slug = getAdminSlug();
  const adminBase = `/${slug}/admin`;
  const { theme, toggleTheme } = useTheme();

  const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
  const strippedPath = window.location.pathname.replace(base, "").replace(/^\/+/, "");
  const slugFromPath = strippedPath.split("/")[0] || slug;
  const storefrontHref = slugFromPath ? `${base}/${slugFromPath}` : base || "/";

  const { data: profile } = useGetBusinessProfile({
    query: { queryKey: ["/api/business", "admin-layout"] }
  });
  const companyLogoUrl = (profile as any)?.logoUrl as string | undefined;
  const companyName = (profile as any)?.name as string | undefined;
  const plan = (profile as any)?.plan as string | undefined;
  const isPaid = plan && plan !== "starter";

  useEffect(() => {
    const origTitle = document.title;
    // Admin always shows OutdoorShare branding in browser tab/favicon.
    // Company name is shown as context within the page title, not as the brand.
    const pageTitle = companyName
      ? `${companyName} — OutdoorShare Admin`
      : "OutdoorShare Admin";
    applyPlatformBrand(pageTitle);
    return () => {
      document.title = origTitle;
      applyPlatformBrand();
    };
  }, [companyName]);

  const activeItem = NAV_ITEMS.find(item => {
    const href = `${adminBase}${item.path}`;
    return item.path === ""
      ? location === href
      : location === href || location.startsWith(href + "/") || location.startsWith(href + "?");
  });

  // Live unread chat count for Messages badge
  const [chatUnread, setChatUnread] = useState(0);
  // Live unseen bookings count for Bookings red dot
  const [bookingsUnseen, setBookingsUnseen] = useState(0);
  useEffect(() => {
    const session = getAdminSession();
    if (!session?.token) return;
    const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
    const token = session.token;
    const fetchCounts = () => {
      fetch(`${base}/api/chat/unread-count`, { headers: { "x-admin-token": token } })
        .then(r => r.ok ? r.json() : { count: 0 })
        .then(d => setChatUnread(d.count ?? 0))
        .catch(() => {});
      fetch(`${base}/api/bookings/unseen-count`, { headers: { "x-admin-token": token } })
        .then(r => r.ok ? r.json() : { count: 0 })
        .then(d => setBookingsUnseen(d.count ?? 0))
        .catch(() => {});
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-[100dvh] flex flex-col md:flex-row bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-full md:w-60 md:h-full border-r border-border bg-sidebar flex-shrink-0 flex flex-col overflow-hidden">
        {/* Logo / brand header */}
        <div className="h-[60px] flex items-center px-4 border-b border-border/60 bg-gradient-to-b from-sidebar-accent/30 to-transparent shrink-0">
          <Link href={adminBase} className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 ring-1 ring-border/60 shadow-sm bg-[#1a2332] flex items-center justify-center">
              <img
                src="/outdoorshare-logo.png"
                alt="OutdoorShare"
                className="w-6 h-6 object-contain"
              />
            </div>
            <div className="leading-tight min-w-0">
              <p className="text-[13px] font-bold text-foreground leading-none">OutdoorShare</p>
              <p className="text-[10px] text-muted-foreground/60 font-medium mt-[3px] truncate">
                {companyName ? `${companyName} · Admin` : "Admin Portal"}
              </p>
            </div>
          </Link>
        </div>

        <nav className="px-2.5 py-3 flex-1 overflow-y-auto">
          <div className="space-y-5">
            {NAV_GROUPS.map((group, gi) => (
              <div key={gi}>
                {group.group && (
                  <div className="flex items-center gap-2 px-2 mb-1.5">
                    <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50 select-none whitespace-nowrap">
                      {group.group}
                    </p>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    if (item.external) {
                      return (
                        <a
                          key={item.name}
                          href={item.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-all duration-100 text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        >
                          <item.icon className="w-[15px] h-[15px] shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                          <span className="flex-1 text-[13px]">{item.name}</span>
                          <ExternalLink className="w-3 h-3 opacity-30 group-hover:opacity-60 transition-opacity" />
                        </a>
                      );
                    }
                    const href = `${adminBase}${item.path}`;
                    const isActive = item.path === ""
                      ? location === href
                      : location === href || location.startsWith(href + "/") || location.startsWith(href + "?");
                    return (
                      <Link
                        key={item.name}
                        href={href}
                        className={cn(
                          "relative flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] font-medium transition-all duration-100",
                          isActive
                            ? "bg-primary/10 text-primary shadow-sm"
                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                        )}
                        <item.icon className={cn("w-[15px] h-[15px] shrink-0 transition-opacity", isActive ? "opacity-100" : "opacity-60")} />
                        <span className="flex-1">{item.name}</span>
                        {item.name === "Messages" && chatUnread > 0 && (
                          <span className={cn(
                            "min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1",
                            isActive ? "bg-primary text-primary-foreground" : "bg-primary text-primary-foreground",
                          )}>
                            {chatUnread > 9 ? "9+" : chatUnread}
                          </span>
                        )}
                        {item.name === "Bookings" && bookingsUnseen > 0 && (
                          <span className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            "bg-red-500",
                          )} title={`${bookingsUnseen} new booking${bookingsUnseen > 1 ? "s" : ""}`} />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* Sidebar footer */}
        <div className="px-3 py-3 border-t border-border/60">
          <a
            href={storefrontHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12px] text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/70 transition-all group"
          >
            <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-80 shrink-0 transition-opacity" />
            <span>View Storefront</span>
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <EmailVerificationBanner />

        <header className="h-14 flex items-center justify-between px-6 border-b border-border/70 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            {activeItem && (
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <activeItem.icon className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <h1 className="text-[15px] font-semibold text-foreground">
              {activeItem?.name ?? "Dashboard"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/70 transition-all"
            >
              {theme === "dark"
                ? <Sun className="w-4 h-4" />
                : <Moon className="w-4 h-4" />
              }
            </button>
            <NotificationBell
              mode="admin"
              slug={slug}
              adminToken={getAdminSession()?.token}
              navBase={adminBase}
            />
            <Link
              href={`${adminBase}/bookings/new`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              New Booking
            </Link>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-6xl w-full">
            {children}
          </div>
        </div>
      </main>
      {isPaid && (
        <AIAssistant
          role="admin"
          tenantSlug={slug}
          companyName={companyName}
          adminToken={getAdminSession()?.token}
        />
      )}
    </div>
  );
}
