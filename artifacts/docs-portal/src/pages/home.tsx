import { useGetDocsStats, useGetTrendingDocs } from "@workspace/api-client-react";
import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/public-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Search, Book, FolderTree, Layout, Star, ArrowRight } from "lucide-react";
import { ArticleTypeBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const [_, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: stats, isLoading: statsLoading } = useGetDocsStats();
  const { data: trending, isLoading: trendingLoading } = useGetTrendingDocs();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-12 md:py-20">
        
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-6">
            How can we help you today?
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Search our knowledge base for guides, API references, troubleshooting, and more.
          </p>
          
          <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input 
              className="h-14 pl-12 pr-4 rounded-full text-lg shadow-sm border-muted-foreground/20 focus-visible:ring-primary"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full">
              Search
            </Button>
          </form>
        </div>

        {/* Quick Links / Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {statsLoading ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : stats ? (
            <>
              <Link href="/articles" className="block">
                <Card className="hover:border-primary/50 transition-colors h-full cursor-pointer">
                  <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
                    <Book className="w-6 h-6 text-primary mb-2" />
                    <div className="text-2xl font-bold">{stats.totalArticles}</div>
                    <div className="text-sm text-muted-foreground">Articles</div>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/categories" className="block">
                <Card className="hover:border-primary/50 transition-colors h-full cursor-pointer">
                  <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
                    <FolderTree className="w-6 h-6 text-primary mb-2" />
                    <div className="text-2xl font-bold">{stats.totalCategories}</div>
                    <div className="text-sm text-muted-foreground">Categories</div>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/projects" className="block">
                <Card className="hover:border-primary/50 transition-colors h-full cursor-pointer">
                  <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
                    <Layout className="w-6 h-6 text-primary mb-2" />
                    <div className="text-2xl font-bold">{stats.totalProjects}</div>
                    <div className="text-sm text-muted-foreground">Projects</div>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/features" className="block">
                <Card className="hover:border-primary/50 transition-colors h-full cursor-pointer">
                  <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
                    <Star className="w-6 h-6 text-primary mb-2" />
                    <div className="text-2xl font-bold">{stats.totalFeatures}</div>
                    <div className="text-sm text-muted-foreground">Features</div>
                  </CardContent>
                </Card>
              </Link>
            </>
          ) : null}
        </div>

        {/* Trending Articles */}
        <div className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold tracking-tight">Trending Articles</h2>
            <Link href="/search" className="text-sm font-medium text-primary flex items-center hover:underline">
              View all <ArrowRight className="ml-1 w-4 h-4" />
            </Link>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {trendingLoading ? (
              Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
            ) : trending && trending.length > 0 ? (
              trending.map((article) => (
                <Link key={article.id} href={`/articles/${article.slug}`}>
                  <Card className="hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer h-full">
                    <CardHeader className="p-5">
                      <div className="flex justify-between items-start mb-2 gap-4">
                        <CardTitle className="text-lg leading-tight line-clamp-2">{article.title}</CardTitle>
                        <ArticleTypeBadge type={article.type} />
                      </div>
                      <CardDescription className="line-clamp-2 text-sm">
                        {article.excerpt || "No description available."}
                      </CardDescription>
                      <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                        {article.categoryName && <span>{article.categoryName}</span>}
                        {article.categoryName && article.readingTime > 0 && <span>•</span>}
                        {article.readingTime > 0 && <span>{article.readingTime} min read</span>}
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))
            ) : (
              <div className="col-span-2 text-center py-12 text-muted-foreground border border-dashed rounded-xl">
                No trending articles found.
              </div>
            )}
          </div>
        </div>

      </div>
    </PublicLayout>
  );
}
