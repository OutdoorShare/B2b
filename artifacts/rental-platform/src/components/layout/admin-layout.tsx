import { Link, useLocation } from "wouter";
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
  Clock,
  AlertTriangle,
  FileSignature,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetBusinessProfile } from "@workspace/api-client-react";
import { getAdminSlug } from "@/lib/admin-nav";

const NAV_ITEMS = [
  { name: "Dashboard", path: "", icon: LayoutDashboard },
  { name: "Listings", path: "/listings", icon: Package },
  { name: "Bookings", path: "/bookings", icon: CalendarDays },
  { name: "Quotes", path: "/quotes", icon: FileText },
  { name: "Claims", path: "/claims", icon: ShieldAlert },
  { name: "Communications", path: "/communications", icon: MessageSquare },
  { name: "Analytics", path: "/analytics", icon: BarChart3 },
  { name: "Team", path: "/team", icon: Users },
  { name: "Waivers", path: "/waivers", icon: FileSignature },
  { name: "Kiosk Mode", path: "/kiosk", icon: MonitorSmartphone },
  { name: "My Wallet", path: "/wallet", icon: Wallet },
  { name: "Settings", path: "/settings", icon: Settings },
];

function TrialStatusBanner() {
  const { data: profile } = useGetBusinessProfile({
    query: { queryKey: ["/api/business", "admin"] }
  });

  const trialActive = (profile as any)?.trialActive as boolean | undefined;
  const trialExpired = (profile as any)?.trialExpired as boolean | undefined;
  const trialEndsAt = (profile as any)?.trialEndsAt as string | null | undefined;
  const plan = (profile as any)?.plan as string | undefined;

  if (!trialActive && !trialExpired) return null;
  if (plan && plan !== "starter") return null;

  if (trialExpired) {
    return (
      <div className="w-full bg-red-600 text-white text-xs font-semibold px-4 py-2 flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Your free trial has expired. Upgrade to keep your storefront running.
        </span>
        <a
          href="/get-started"
          className="shrink-0 bg-white text-red-600 rounded px-2.5 py-0.5 text-xs font-bold hover:bg-red-50 transition-colors"
        >
          Upgrade Now
        </a>
      </div>
    );
  }

  if (trialActive && trialEndsAt) {
    const endsAt = new Date(trialEndsAt);
    const hoursLeft = Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60)));
    const label = hoursLeft <= 1 ? "less than 1 hour" : `${hoursLeft} hours`;
    return (
      <div className="w-full bg-amber-500 text-white text-xs font-semibold px-4 py-2 flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Free trial: {label} remaining. Upgrade to remove OutdoorShare branding and avoid disruption.
        </span>
        <a
          href="/get-started"
          className="shrink-0 bg-white text-amber-600 rounded px-2.5 py-0.5 text-xs font-bold hover:bg-amber-50 transition-colors"
        >
          Upgrade
        </a>
      </div>
    );
  }

  return null;
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const slug = getAdminSlug();
  const adminBase = `/${slug}/admin`;

  // Use URL slug (always present in admin routes /:slug/admin/...) as the reliable source
  const storefrontHref = slug ? `/${slug}` : "/";

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
          <Link href={adminBase} className="flex items-center gap-2.5">
            <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="w-9 h-9 object-contain" />
            <div className="leading-tight">
              <p className="text-sm font-black text-foreground tracking-wide leading-none">OutdoorShare</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Admin Dashboard</p>
            </div>
          </Link>
        </div>
        <nav className="p-4 flex-1 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
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
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TrialStatusBanner />

        <header className="h-16 flex items-center justify-between px-8 border-b border-border bg-card">
          <h1 className="text-xl font-semibold text-foreground">
            {activeItem?.name ?? "Dashboard"}
          </h1>
          <div className="flex items-center gap-4">
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
    </div>
  );
}
