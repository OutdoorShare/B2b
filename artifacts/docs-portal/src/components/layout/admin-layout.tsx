import { Link, useLocation } from "wouter";
import { LayoutDashboard, FileText, FolderTree, Layout, Star, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navigation = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Articles", href: "/admin/articles", icon: FileText },
    { name: "Categories", href: "/admin/categories", icon: FolderTree },
    { name: "Projects", href: "/admin/projects", icon: Layout },
    { name: "Features", href: "/admin/features", icon: Star },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 hidden md:flex flex-col" style={{ background: "hsl(var(--sidebar))", borderRight: "1px solid hsl(var(--sidebar-border))" }}>
        {/* Logo area */}
        <div className="h-16 flex items-center px-5 border-b" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/outdoorshare-logo.png"
              alt="OutdoorShare"
              className="h-8 w-auto object-contain"
            />
            <div className="flex flex-col leading-none">
              <span className="font-bold text-white text-sm tracking-wide">OutdoorShare</span>
              <span className="text-xs font-medium" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.6 }}>Docs Admin</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors mb-4 hover:text-white"
            style={{ color: "hsl(var(--sidebar-foreground))" }}
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            Back to Portal
          </Link>

          <div className="text-xs font-semibold uppercase tracking-wider mb-3 px-3" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.45 }}>
            Management
          </div>

          {navigation.map((item) => {
            const isActive = location === item.href || (location.startsWith(item.href + '/') && item.href !== '/admin');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive ? "text-white" : "hover:text-white"
                )}
                style={isActive
                  ? { background: "hsl(var(--primary))", color: "#fff" }
                  : { color: "hsl(var(--sidebar-foreground))" }
                }
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-muted/20">
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
