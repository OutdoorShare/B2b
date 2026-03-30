import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Package, 
  CalendarDays, 
  FileText, 
  BarChart3, 
  Tags, 
  MonitorSmartphone, 
  Settings,
  ShieldAlert,
  Users,
  MessageSquare,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetBusinessProfile } from "@workspace/api-client-react";

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Listings", href: "/admin/listings", icon: Package },
  { name: "Bookings", href: "/admin/bookings", icon: CalendarDays },
  { name: "Quotes", href: "/admin/quotes", icon: FileText },
  { name: "Claims", href: "/admin/claims", icon: ShieldAlert },
  { name: "Communications", href: "/admin/communications", icon: MessageSquare },
  { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { name: "Categories", href: "/admin/categories", icon: Tags },
  { name: "Team", href: "/admin/team", icon: Users },
  { name: "Kiosk Mode", href: "/admin/kiosk", icon: MonitorSmartphone },
  { name: "Settings", href: "/admin/settings", icon: Settings },
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
  const { data: profile } = useGetBusinessProfile({
    query: { queryKey: ["/api/business", "admin-layout"] }
  });
  const siteSlug = (profile as any)?.siteSlug as string | null | undefined;
  const storefrontHref = siteSlug ? `/${siteSlug}` : "/";

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r border-border bg-sidebar flex-shrink-0 flex flex-col">
        <div className="h-16 flex items-center px-5 border-b border-border">
          <Link href="/admin" className="flex items-center gap-2.5">
            <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="w-9 h-9 object-contain" />
            <div className="leading-tight">
              <p className="text-sm font-black text-foreground tracking-wide leading-none">OutdoorShare</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Admin Dashboard</p>
            </div>
          </Link>
        </div>
        <nav className="p-4 flex-1 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/admin" && location.startsWith(item.href));
            return (
              <Link 
                key={item.name} 
                href={item.href}
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
        {/* Trial status banner */}
        <TrialStatusBanner />

        <header className="h-16 flex items-center justify-between px-8 border-b border-border bg-card">
          <h1 className="text-xl font-semibold text-foreground">
            {navigation.find(n => location === n.href || (n.href !== "/admin" && location.startsWith(n.href)))?.name || "Dashboard"}
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
