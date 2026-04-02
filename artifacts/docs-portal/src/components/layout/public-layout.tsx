import { Link, useLocation } from "wouter";
import { Book, FolderTree, Layout, Star, Search, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navigation = [
    { name: "Home", href: "/", icon: Book },
    { name: "Search", href: "/search", icon: Search },
    { name: "Categories", href: "/categories", icon: FolderTree },
    { name: "Projects", href: "/projects", icon: Layout },
    { name: "Features", href: "/features", icon: Star },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-sidebar hidden md:flex flex-col">
        <div className="p-4 border-b h-14 flex items-center">
          <Link href="/" className="font-bold text-lg text-primary flex items-center gap-2">
            <Book className="w-5 h-5" />
            OutdoorShare Docs
          </Link>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2 mt-4">
            Navigation
          </div>
          {navigation.map((item) => {
            const isActive = location === item.href;
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

          <div className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2 mt-8">
            Internal
          </div>
          <Link
            href="/admin"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors"
          >
            <ShieldAlert className="w-4 h-4" />
            Admin Area
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b flex items-center px-4 md:hidden bg-background">
          <Link href="/" className="font-bold text-lg text-primary flex items-center gap-2">
            <Book className="w-5 h-5" />
            OutdoorShare Docs
          </Link>
        </header>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
