import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, ExternalLink, Package } from "lucide-react";

const API_UPLOAD_BASE = "/api/uploads/";
function resolveImage(url: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_UPLOAD_BASE}${url.split("/").pop()}`;
}

export function CompaniesPage() {
  const [, setLocation] = useLocation();

  const { data: companies, isLoading } = useQuery({
    queryKey: ["marketplace-companies"],
    queryFn: api.marketplace.companies,
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Browse
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Rental Companies</h1>
          <p className="text-gray-500">Browse all outdoor rental companies on the OutdoorShare marketplace</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-12 w-12 bg-gray-200 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : companies && companies.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {companies.map(company => {
              return (
                <div
                  key={company.tenantId}
                  className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="flex items-start gap-3 mb-4">
                    {company.logoUrl ? (
                      <div className="h-14 w-14 rounded-xl border border-gray-100 bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                        <img
                          src={resolveImage(company.logoUrl)}
                          alt={company.businessName ?? company.slug}
                          className="max-h-12 max-w-12 object-contain"
                        />
                      </div>
                    ) : (
                      <div className="h-14 w-14 rounded-xl flex items-center justify-center text-primary-foreground font-bold text-lg flex-shrink-0 bg-primary">
                        {(company.businessName ?? company.slug)[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm leading-snug">
                        {company.businessName ?? company.slug}
                      </h3>
                      {company.tagline && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{company.tagline}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    {(company.city || company.state) && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{[company.city, company.state].filter(Boolean).join(", ")}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Package className="h-3.5 w-3.5" />
                      <span>{company.listingCount} active listing{company.listingCount !== 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                      onClick={() => setLocation(`/?tenantSlug=${company.slug}`)}
                    >
                      Browse Listings
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => window.open(`/${company.slug}`, "_blank")}
                    >
                      Store <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">🏢</div>
            <h3 className="font-semibold text-gray-700 mb-1">No companies yet</h3>
            <p className="text-sm text-gray-400">Companies will appear here once they join the platform</p>
          </div>
        )}
      </div>
    </div>
  );
}
