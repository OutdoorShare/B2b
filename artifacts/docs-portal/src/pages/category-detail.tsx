import { useGetDocCategory } from "@workspace/api-client-react";
import { Link, useRoute } from "wouter";
import { PublicLayout } from "@/components/layout/public-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArticleTypeBadge } from "@/components/status-badge";
import { ArrowLeft, BookOpen, Clock } from "lucide-react";
import { getGetDocCategoryQueryKey } from "@workspace/api-client-react";

export default function CategoryDetail() {
  const [, params] = useRoute("/category/:slug");
  const slug = params?.slug || "";

  const { data: category, isLoading } = useGetDocCategory(slug, {
    query: { enabled: !!slug, queryKey: getGetDocCategoryQueryKey(slug) }
  });

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <Link href="/categories" className="text-sm font-medium text-muted-foreground flex items-center hover:text-foreground mb-6 transition-colors w-fit">
          <ArrowLeft className="mr-1 w-4 h-4" />
          Back to Categories
        </Link>

        {isLoading ? (
          <div className="space-y-8">
            <div>
              <Skeleton className="h-10 w-1/3 mb-4" />
              <Skeleton className="h-6 w-2/3" />
            </div>
            <div className="grid gap-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        ) : category ? (
          <>
            <div className="mb-10 pb-10 border-b">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">{category.name}</h1>
              </div>
              <p className="text-xl text-muted-foreground max-w-3xl">
                {category.description}
              </p>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-6">Articles in this category</h2>
              {category.articles && category.articles.length > 0 ? (
                <div className="grid gap-4">
                  {category.articles.map(article => (
                    <Link key={article.id} href={`/articles/${article.slug}`}>
                      <Card className="hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
                        <CardHeader className="p-5">
                          <div className="flex justify-between items-start mb-2 gap-4">
                            <CardTitle className="text-lg leading-tight">{article.title}</CardTitle>
                            <ArticleTypeBadge type={article.type} />
                          </div>
                          <CardDescription className="line-clamp-2 text-sm text-muted-foreground">
                            {article.excerpt || "No description available."}
                          </CardDescription>
                          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground font-medium">
                            {article.readingTime > 0 && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {article.readingTime} min read
                              </span>
                            )}
                            {article.projectName && <span>Project: {article.projectName}</span>}
                            {article.featureName && <span>Feature: {article.featureName}</span>}
                          </div>
                        </CardHeader>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl bg-muted/20">
                  No articles have been added to this category yet.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            Category not found.
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
