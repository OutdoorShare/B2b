import { Link, useParams } from "wouter";
import { Tent } from "lucide-react";
import { useGetBusinessProfile } from "@workspace/api-client-react";
import { PoweredByBadge } from "@/components/powered-by-badge";

const OS_GREEN = "#3ab549";
const OS_BLUE = "#29b4d4";

export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const base = slug ? `/${slug}` : "";

  const { data: profile } = useGetBusinessProfile({
    query: { queryKey: ["/api/business"] }
  });

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* OutdoorShare platform bar */}
      <div className="w-full px-4 py-1.5 flex items-center justify-center gap-2 text-white text-xs font-semibold" style={{ background: `linear-gradient(90deg, #1a6b2e 0%, ${OS_GREEN} 60%, ${OS_BLUE} 100%)` }}>
        <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="w-4 h-4 object-contain brightness-200" />
        <span>Powered by OutdoorShare</span>
        <span className="opacity-50 mx-1">·</span>
        <a href="/" className="underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity">Learn more</a>
      </div>

      {/* Tenant header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href={base || "/"} className="flex items-center gap-2.5">
            {profile?.logoUrl ? (
              <img src={profile.logoUrl} alt={profile.name} className="h-8 object-contain" />
            ) : (
              <Tent className="w-6 h-6" style={{ color: OS_GREEN }} />
            )}
            <span className="font-bold text-lg tracking-tight">
              {profile?.name || "Outdoor Rentals"}
            </span>
          </Link>

          <nav className="flex items-center gap-6">
            <Link href={base || "/"} className="text-sm font-medium text-foreground/80 hover:text-foreground">
              Listings
            </Link>
            <Link
              href={`${base}/login`}
              className="text-sm font-semibold px-4 py-1.5 rounded-full text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: OS_GREEN }}
            >
              Login
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-gray-950 py-12 mt-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Tenant identity */}
            <div className="flex items-center gap-2.5">
              {profile?.logoUrl ? (
                <img src={profile.logoUrl} alt={profile.name} className="h-7 object-contain opacity-80" />
              ) : (
                <Tent className="w-5 h-5 text-white/60" />
              )}
              <span className="font-bold text-white/70 text-sm">{profile?.name || "Outdoor Rentals"}</span>
            </div>

            {/* OutdoorShare co-brand */}
            <div className="flex items-center gap-2">
              <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="w-5 h-5 object-contain" />
              <span className="text-sm font-black text-white tracking-tight">OutdoorShare</span>
              <span className="text-xs text-white/40 ml-1">platform</span>
            </div>

            <p className="text-xs text-white/30">
              &copy; {new Date().getFullYear()} {profile?.name || "Outdoor Rentals"}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Fixed corner badge — always visible */}
      <PoweredByBadge variant="fixed" />
    </div>
  );
}
