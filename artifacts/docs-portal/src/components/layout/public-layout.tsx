import { Link, useLocation } from "wouter";
import { FolderTree, Layout, Star, Search, ShieldAlert, BookOpen, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navigation = [
    { name: "Home", href: "/", icon: BookOpen },
    { name: "Search", href: "/search", icon: Search },
    { name: "Categories", href: "/categories", icon: FolderTree },
    { name: "Projects", href: "/projects", icon: Layout },
    { name: "Features", href: "/features", icon: Star },
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
              <span className="text-xs font-medium" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.6 }}>Documentation</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <div className="text-xs font-semibold uppercase tracking-wider mb-3 px-3" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.45 }}>
            Browse
          </div>
          {navigation.map((item) => {
            const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "text-white"
                    : "hover:text-white transition-opacity"
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

          <div className="pt-6">
            <div className="text-xs font-semibold uppercase tracking-wider mb-3 px-3" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.45 }}>
              Internal
            </div>
            <Link
              href="/admin"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:text-white"
              style={{ color: "hsl(var(--sidebar-foreground))" }}
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              Admin Area
            </Link>
          </div>
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          <a
            href="https://myoutdoorshare.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs font-medium transition-colors hover:text-white"
            style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.6 }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            myoutdoorshare.com
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="h-14 border-b flex items-center px-4 md:hidden bg-background">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/outdoorshare-logo.png"
              alt="OutdoorShare"
              className="h-7 w-auto object-contain"
            />
            <span className="font-bold text-sm text-foreground">OutdoorShare Docs</span>
          </Link>
        </header>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
