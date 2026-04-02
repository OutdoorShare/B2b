import { useGetDocArticle, getGetDocArticleQueryKey } from "@workspace/api-client-react";
import { Link, useRoute } from "wouter";
import { PublicLayout } from "@/components/layout/public-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { ArticleTypeBadge } from "@/components/status-badge";
import { Clock, Eye, Calendar, User, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

export default function ArticleDetail() {
  const [, params] = useRoute("/articles/:slug");
  const slug = params?.slug || "";

  const { data: article, isLoading } = useGetDocArticle(slug, {
    query: { enabled: !!slug, queryKey: getGetDocArticleQueryKey(slug) }
  });

  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-10 flex flex-col md:flex-row gap-8">
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="space-y-8">
              <Skeleton className="h-6 w-1/3 mb-4" />
              <Skeleton className="h-12 w-3/4 mb-4" />
              <div className="flex gap-4">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
              <div className="pt-8 space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
          ) : article ? (
            <>
              <div className="mb-6">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href="/">Home</BreadcrumbLink>
                    </BreadcrumbItem>
                    {article.categorySlug && (
                      <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <BreadcrumbLink href={`/category/${article.categorySlug}`}>
                            {article.categoryName}
                          </BreadcrumbLink>
                        </BreadcrumbItem>
                      </>
                    )}
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{article.title}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>

              <div className="mb-8 border-b pb-8">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <ArticleTypeBadge type={article.type} />
                  {article.projectName && (
                    <Link href={`/projects/${article.projectId}`} className="text-sm font-medium text-primary hover:underline">
                      Project: {article.projectName}
                    </Link>
                  )}
                  {article.featureName && (
                    <Link href={`/features/${article.featureId}`} className="text-sm font-medium text-primary hover:underline">
                      Feature: {article.featureName}
                    </Link>
                  )}
                </div>
                
                <h1 className="text-4xl font-extrabold tracking-tight mb-4 text-foreground">
                  {article.title}
                </h1>
                
                {article.excerpt && (
                  <p className="text-xl text-muted-foreground mb-6 leading-relaxed">
                    {article.excerpt}
                  </p>
                )}
                
                <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-sm text-muted-foreground">
                  {article.author && (
                    <div className="flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      {article.author}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {article.readingTime} min read
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Eye className="w-4 h-4" />
                    {article.viewCount} views
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    Last updated {format(new Date(article.updatedAt), "MMM d, yyyy")}
                  </div>
                </div>
              </div>

              <article className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:underline prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted prose-pre:text-muted-foreground prose-img:rounded-xl">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {article.content || ""}
                </ReactMarkdown>
              </article>

              {article.tags && article.tags.length > 0 && (
                <div className="mt-12 pt-6 border-t">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground mr-2">Tags:</span>
                    {article.tags.map(tag => (
                      <span key={tag} className="px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              Article not found.
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <aside className="w-full md:w-72 flex-shrink-0">
          {article?.relatedArticles && article.relatedArticles.length > 0 && (
            <div className="sticky top-6">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">
                Related Articles
              </h3>
              <div className="space-y-3">
                {article.relatedArticles.map(related => (
                  <Link key={related.id} href={`/articles/${related.slug}`}>
                    <Card className="hover:border-primary/40 transition-colors cursor-pointer bg-transparent border shadow-none">
                      <CardHeader className="p-3">
                        <div className="flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <CardTitle className="text-sm font-medium leading-tight mb-1 group-hover:text-primary">
                              {related.title}
                            </CardTitle>
                            <div className="text-[10px] text-muted-foreground">
                              {related.categoryName}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </PublicLayout>
  );
}
