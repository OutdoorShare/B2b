import { useGetDocFeature, getGetDocFeatureQueryKey } from "@workspace/api-client-react";
import { Link, useRoute } from "wouter";
import { PublicLayout } from "@/components/layout/public-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FeatureStatusBadge, ArticleTypeBadge } from "@/components/status-badge";
import { ArrowLeft, Star, FileText } from "lucide-react";

export default function FeatureDetail() {
  const [, params] = useRoute("/features/:slug");
  const slug = params?.slug || "";

  const { data: feature, isLoading } = useGetDocFeature(slug, {
    query: { enabled: !!slug, queryKey: getGetDocFeatureQueryKey(slug) }
  });

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <Link href="/features" className="text-sm font-medium text-muted-foreground flex items-center hover:text-foreground mb-6 transition-colors w-fit">
          <ArrowLeft className="mr-1 w-4 h-4" />
          Back to Features
        </Link>

        {isLoading ? (
          <div className="space-y-8">
            <Skeleton className="h-12 w-1/3 mb-4" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : feature ? (
          <>
            <div className="mb-8 border-b pb-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Star className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold tracking-tight">{feature.name}</h1>
                    <FeatureStatusBadge status={feature.status} />
                  </div>
                </div>
              </div>
              <p className="text-xl text-muted-foreground max-w-3xl mb-4">
                {feature.description}
              </p>
              
              <div className="flex items-center gap-4 text-sm font-medium">
                {feature.projectName && (
                  <span className="text-muted-foreground">
                    Project: <Link href={`/projects/${feature.projectId || ''}`} className="text-primary hover:underline">{feature.projectName}</Link>
                  </span>
                )}
                {feature.categoryName && (
                  <span className="text-muted-foreground">
                    Category: <Link href={`/category/${feature.categoryId || ''}`} className="text-primary hover:underline">{feature.categoryName}</Link>
                  </span>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5 text-muted-foreground" />
                Feature Documentation ({feature.articleCount})
              </h2>
              
              {feature.articles && feature.articles.length > 0 ? (
                <div className="grid gap-4">
                  {feature.articles.map(article => (
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
                        </CardHeader>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl bg-muted/20">
                  No articles linked to this feature yet.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            Feature not found.
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
