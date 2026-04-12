import { Link, useLocation } from "wouter";
import { Search, ExternalLink, ChevronDown, ChevronRight, BookOpen, HelpCircle, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { DocsAIAssistant } from "@/components/docs-ai-assistant";
import { useGetDocCategories, useGetDocCategory, getGetDocCategoriesQueryKey, getGetDocCategoryQueryKey } from "@workspace/api-client-react";
import { useState, useEffect } from "react";

const ICON_MAP: Record<string, React.ReactNode> = {
  "rocket":       <span className="text-base">🚀</span>,
  "package":      <span className="text-base">📦</span>,
  "calendar":     <span className="text-base">📅</span>,
  "credit-card":  <span className="text-base">💳</span>,
  "settings":     <span className="text-base">⚙️</span>,
  "users":        <span className="text-base">👥</span>,
  "brain":        <span className="text-base">🤖</span>,
  "shield":       <span className="text-base">🛡️</span>,
  "help-circle":  <span className="text-base">❓</span>,
};

function CategorySection({ cat, currentPath }: { cat: any; currentPath: string }) {
  const catHref = `/category/${cat.slug}`;
  const isCatActive = currentPath.startsWith(catHref);

  // detect if we're on one of this category's articles
  const [open, setOpen] = useState(isCatActive);

  const { data: detail } = useGetDocCategory(cat.slug, {
    query: {
      enabled: open,
      queryKey: getGetDocCategoryQueryKey(cat.slug),
    },
  });

  useEffect(() => {
    if (isCatActive) setOpen(true);
  }, [isCatActive]);

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left",
          isCatActive ? "text-white" : "hover:bg-white/10",
        )}
        style={isCatActive ? { background: "hsl(var(--primary))" } : { color: "hsl(var(--sidebar-foreground))" }}
      >
        <span className="shrink-0 w-5 flex items-center justify-center leading-none">
          {ICON_MAP[cat.icon] ?? <BookOpen className="w-4 h-4" />}
        </span>
        <span className="flex-1 truncate">{cat.name}</span>
        <span className="text-xs opacity-50 shrink-0">{cat.articleCount}</span>
        {open
          ? <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 opacity-50 shrink-0" />}
      </button>

      {open && detail?.articles && (
        <div className="ml-5 mt-0.5 space-y-0.5 border-l pl-3" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          {detail.articles.map((art: any) => {
            const artHref = `/articles/${art.slug}`;
            const isArtActive = currentPath === artHref;
            return (
              <Link
                key={art.id}
                href={artHref}
                className={cn(
                  "block py-1.5 px-2 rounded text-xs transition-colors leading-snug",
                  isArtActive
                    ? "font-semibold text-white"
                    : "hover:text-white",
                )}
                style={isArtActive
                  ? { background: "hsl(var(--primary) / 0.7)" }
                  : { color: "hsl(var(--sidebar-foreground))", opacity: 0.75 }
                }
              >
                {art.title}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const { data: categories } = useGetDocCategories({
    query: { queryKey: getGetDocCategoriesQueryKey() },
  });

  const topNav = [
    { name: "Home", href: "/", icon: <Home className="w-4 h-4" /> },
    { name: "Search",   href: "/search",   icon: <Search className="w-4 h-4" /> },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 hidden md:flex flex-col" style={{ background: "hsl(var(--sidebar))", borderRight: "1px solid hsl(var(--sidebar-border))" }}>
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b shrink-0" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          <Link href="/" className="flex items-center gap-3">
            <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="h-8 w-auto object-contain" />
            <div className="flex flex-col leading-none">
              <span className="font-bold text-white text-sm tracking-wide">OutdoorShare</span>
              <span className="text-xs font-medium" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.6 }}>Documentation</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {/* Top links */}
          <div className="space-y-0.5 mb-4">
            {topNav.map(item => {
              const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive ? "text-white" : "hover:text-white hover:bg-white/10",
                  )}
                  style={isActive
                    ? { background: "hsl(var(--primary))", color: "#fff" }
                    : { color: "hsl(var(--sidebar-foreground))" }
                  }
                >
                  {item.icon}
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Category sections */}
          <div className="text-xs font-semibold uppercase tracking-wider mb-2 px-3" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.45 }}>
            Documentation
          </div>

          {categories && categories.length > 0 ? (
            <div className="space-y-0.5">
              {categories.map((cat: any) => (
                <CategorySection key={cat.id} cat={cat} currentPath={location} />
              ))}
            </div>
          ) : (
            <div className="space-y-2 px-3">
              {Array(6).fill(0).map((_, i) => (
                <div key={i} className="h-8 rounded-md bg-white/5 animate-pulse" />
              ))}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t shrink-0" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
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
        <header className="h-14 border-b flex items-center gap-4 px-4 md:hidden bg-background">
          <Link href="/" className="flex items-center gap-3">
            <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="h-7 w-auto object-contain" />
            <span className="font-bold text-sm text-foreground">OutdoorShare Docs</span>
          </Link>
          <Link href="/search" className="ml-auto text-muted-foreground">
            <Search className="w-5 h-5" />
          </Link>
        </header>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>

      {/* Roamio AI — floating docs assistant */}
      <DocsAIAssistant />
    </div>
  );
}
