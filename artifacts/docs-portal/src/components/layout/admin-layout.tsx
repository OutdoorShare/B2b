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
      <aside className="w-64 border-r bg-sidebar hidden md:flex flex-col">
        <div className="p-4 border-b h-14 flex items-center justify-between">
          <span className="font-bold text-lg text-primary flex items-center gap-2">
            Docs Admin
          </span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Portal
          </Link>

          <div className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
            Management
          </div>
          {navigation.map((item) => {
            // Precise active state for admin routes
            const isActive = location === item.href || (location.startsWith(item.href + '/') && item.href !== '/admin');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
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
