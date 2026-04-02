import { useState, useEffect } from "react";
import { useSearchDocs } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { PublicLayout } from "@/components/layout/public-layout";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search as SearchIcon } from "lucide-react";
import { ArticleTypeBadge } from "@/components/status-badge";

export default function Search() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const initialQuery = searchParams.get("q") || "";
  
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading } = useSearchDocs(
    { q: debouncedQuery, limit: 50 },
    { query: { enabled: !!debouncedQuery } }
  );

  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              className="h-14 pl-12 pr-4 rounded-xl text-lg shadow-sm border-muted-foreground/20 focus-visible:ring-primary w-full"
              placeholder="Search documentation..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {debouncedQuery ? (
          <div>
            <h2 className="text-lg font-medium mb-4">
              Search results for "{debouncedQuery}"
            </h2>
            <div className="space-y-4">
              {isLoading ? (
                Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
              ) : results && results.length > 0 ? (
                results.map((result) => (
                  <Link key={result.id} href={`/articles/${result.slug}`}>
                    <Card className="hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
                      <CardHeader className="p-5">
                        <div className="flex justify-between items-start mb-2 gap-4">
                          <CardTitle className="text-lg leading-tight">{result.title}</CardTitle>
                          <ArticleTypeBadge type={result.type} />
                        </div>
                        <CardDescription className="line-clamp-2 text-sm text-muted-foreground">
                          {result.excerpt || "No excerpt available."}
                        </CardDescription>
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          {result.categoryName && <span>{result.categoryName}</span>}
                          {result.projectName && <span>{result.projectName}</span>}
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                ))
              ) : (
                <div className="text-center py-20 text-muted-foreground border border-dashed rounded-xl bg-muted/10">
                  No results found for "{debouncedQuery}". Try adjusting your search terms.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            Type something in the search bar to find documentation.
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
