import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import { AIAssistant } from "@/components/ai-assistant";
import { getAdminSession } from "@/lib/admin-nav";
import { NotificationBell } from "@/components/notification-bell";
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
  AlertTriangle,
  FileSignature,
  Wallet,
  Tag,
  Plus,
  Rocket,
  CreditCard,
  MessageSquarePlus,
  IdCard,
  Clock,
  Warehouse,
  BookOpen,
  ExternalLink,
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
      { name: "Listings", path: "/listings", icon: Package },
      { name: "Inventory", path: "/inventory", icon: Warehouse },
      { name: "Bookings", path: "/bookings", icon: CalendarDays },
      { name: "Quotes", path: "/quotes", icon: FileText },
      { name: "Claims", path: "/claims", icon: ShieldAlert },
    ],
  },
  {
    group: "Customers",
    items: [
      { name: "Communications", path: "/communications", icon: MessageSquare },
      { name: "Contact Cards", path: "/contact-cards", icon: IdCard },
      { name: "Waivers", path: "/waivers", icon: FileSignature },
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

function TrialStatusBanner() {
  const slug = getAdminSlug();
  const { data: profile } = useGetBusinessProfile({
    query: { queryKey: ["/api/business", "admin"] }
  });

  const trialActive  = (profile as any)?.trialActive  as boolean | undefined;
  const trialExpired = (profile as any)?.trialExpired as boolean | undefined;
  const isBlocked    = (profile as any)?.isBlocked    as boolean | undefined;
  const trialEndsAt  = (profile as any)?.trialEndsAt  as string | null | undefined;
  const graceEndsAt  = (profile as any)?.graceEndsAt  as string | null | undefined;

  if (!trialActive && !trialExpired) return null;

  const billingHref = `/${slug}/admin/billing`;

  // Hard blocked — grace period over, storefront is offline
  if (isBlocked) {
    return (
      <div className="w-full bg-red-600 text-white text-xs font-semibold px-4 py-2 flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Your storefront is offline — subscribe to restore customer access.
        </span>
        <Link
          href={billingHref}
          className="shrink-0 bg-white text-red-600 rounded px-2.5 py-0.5 text-xs font-bold hover:bg-red-50 transition-colors"
        >
          Subscribe Now
        </Link>
      </div>
    );
  }

  // Grace period — trial expired but storefront still online (3 days)
  if (trialExpired && graceEndsAt) {
    const endsAt   = new Date(graceEndsAt);
    const msLeft   = Math.max(0, endsAt.getTime() - Date.now());
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    const label    = daysLeft <= 1 ? "less than 1 day" : `${daysLeft} days`;
    return (
      <div className="w-full bg-orange-600 text-white text-xs font-semibold px-4 py-2 flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Your free trial has ended. Your storefront goes offline in {label} — subscribe now to keep it running.
        </span>
        <Link
          href={billingHref}
          className="shrink-0 bg-white text-orange-600 rounded px-2.5 py-0.5 text-xs font-bold hover:bg-orange-50 transition-colors"
        >
          Subscribe Now
        </Link>
      </div>
    );
  }

  // Active trial — show days remaining
  if (trialActive && trialEndsAt) {
    const endsAt   = new Date(trialEndsAt);
    const daysLeft = Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    const label    = daysLeft === 0 ? "less than 1 day" : daysLeft === 1 ? "1 day" : `${daysLeft} days`;
    return (
      <div className="w-full bg-amber-500 text-white text-xs font-semibold px-4 py-2 flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Free trial: {label} remaining. Subscribe to keep your storefront live after the trial ends.
        </span>
        <Link
          href={billingHref}
          className="shrink-0 bg-white text-amber-600 rounded px-2.5 py-0.5 text-xs font-bold hover:bg-amber-50 transition-colors"
        >
          Subscribe
        </Link>
      </div>
    );
  }

  return null;
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const slug = getAdminSlug();
  const adminBase = `/${slug}/admin`;

  const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
  const strippedPath = window.location.pathname.replace(base, "").replace(/^\/+/, "");
  const slugFromPath = strippedPath.split("/")[0] || slug;
  const storefrontHref = slugFromPath ? `${base}/${slugFromPath}` : base || "/";

  const { data: profile } = useGetBusinessProfile({
    query: { queryKey: ["/api/business", "admin-layout"] }
  });
  const companyLogoUrl = (profile as any)?.logoUrl as string | undefined;
  const companyName = (profile as any)?.name as string | undefined;

  useEffect(() => {
    const setFavicon = (href: string) => {
      let link = document.querySelector<HTMLLinkElement>("link#favicon");
      if (!link) {
        link = document.createElement("link");
        link.id = "favicon";
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.type = href.endsWith(".svg") ? "image/svg+xml" : "image/png";
      link.href = href;
    };

    if (companyLogoUrl) {
      setFavicon(companyLogoUrl);
    }

    return () => {
      setFavicon("/outdoorshare-logo.png");
    };
  }, [companyLogoUrl]);

  const activeItem = NAV_ITEMS.find(item => {
    const href = `${adminBase}${item.path}`;
    return item.path === ""
      ? location === href
      : location === href || location.startsWith(href + "/") || location.startsWith(href + "?");
  });

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r border-border bg-sidebar flex-shrink-0 flex flex-col">
        <div className="h-16 flex items-center px-5 border-b border-border">
          <Link href={adminBase} className="flex items-center gap-2.5 min-w-0">
            <img
              src={companyLogoUrl || "/outdoorshare-logo.png"}
              alt={companyName || "OutdoorShare"}
              className="w-9 h-9 object-contain rounded shrink-0"
            />
            <div className="leading-tight min-w-0">
              <p className="text-sm font-black text-foreground tracking-wide leading-none truncate">
                {companyName || "OutdoorShare"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Admin Dashboard</p>
            </div>
          </Link>
        </div>

        <nav className="px-3 py-3 flex-1 overflow-y-auto">
          <div className="space-y-4">
            {NAV_GROUPS.map((group, gi) => (
              <div key={gi}>
                {group.group && (
                  <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                    {group.group}
                  </p>
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
                          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group"
                        >
                          <item.icon className="w-4 h-4 shrink-0" />
                          <span className="flex-1">{item.name}</span>
                          <ExternalLink className="w-3 h-3 opacity-40 group-hover:opacity-70 transition-opacity" />
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
                          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TrialStatusBanner />

        <header className="h-16 flex items-center justify-between px-8 border-b border-border bg-card">
          <h1 className="text-xl font-semibold text-foreground">
            {activeItem?.name ?? "Dashboard"}
          </h1>
          <div className="flex items-center gap-3">
            <NotificationBell
              mode="admin"
              slug={slug}
              adminToken={getAdminSession()?.token}
              navBase={adminBase}
            />
            <Link
              href={`${adminBase}/bookings/new`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Booking
            </Link>
            <a
              href={storefrontHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              View Storefront ↗
            </a>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-6xl w-full">
            {children}
          </div>
        </div>
      </main>
      <AIAssistant
        role="admin"
        tenantSlug={slug}
        companyName={companyName}
        adminToken={getAdminSession()?.token}
      />
    </div>
  );
}
