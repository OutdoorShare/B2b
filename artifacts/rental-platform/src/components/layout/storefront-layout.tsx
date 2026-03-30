import { Link } from "wouter";
import { Tent } from "lucide-react";
import { useGetBusinessProfile } from "@workspace/api-client-react";

export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { data: profile } = useGetBusinessProfile({
    query: { queryKey: ["/api/business"] }
  });

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {profile?.logoUrl ? (
              <img src={profile.logoUrl} alt={profile.name} className="h-8 object-contain" />
            ) : (
              <Tent className="w-6 h-6 text-primary" />
            )}
            <span className="font-bold text-lg tracking-tight">
              {profile?.name || "Outdoor Rentals"}
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-sm font-medium text-foreground/80 hover:text-foreground">
              Listings
            </Link>
            <Link href="/admin" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Admin Login
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border bg-card py-12 mt-16">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p className="text-sm">
            &copy; {new Date().getFullYear()} {profile?.name || "Outdoor Rentals"}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
