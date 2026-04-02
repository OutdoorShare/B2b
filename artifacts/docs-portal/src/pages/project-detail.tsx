import { useGetDocProject, getGetDocProjectQueryKey } from "@workspace/api-client-react";
import { Link, useRoute } from "wouter";
import { PublicLayout } from "@/components/layout/public-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectStatusBadge, FeatureStatusBadge, ArticleTypeBadge } from "@/components/status-badge";
import { ArrowLeft, Layout, Star, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:slug");
  const slug = params?.slug || "";

  const { data: project, isLoading } = useGetDocProject(slug, {
    query: { enabled: !!slug, queryKey: getGetDocProjectQueryKey(slug) }
  });

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <Link href="/projects" className="text-sm font-medium text-muted-foreground flex items-center hover:text-foreground mb-6 transition-colors w-fit">
          <ArrowLeft className="mr-1 w-4 h-4" />
          Back to Projects
        </Link>

        {isLoading ? (
          <div className="space-y-8">
            <Skeleton className="h-12 w-1/3 mb-4" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : project ? (
          <>
            <div className="mb-8 border-b pb-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Layout className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
                    <ProjectStatusBadge status={project.status} />
                  </div>
                </div>
              </div>
              <p className="text-xl text-muted-foreground max-w-3xl">
                {project.description}
              </p>
              
              {project.tags && project.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {project.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-xs font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <Tabs defaultValue="articles" className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="articles" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Documentation ({project.articleCount})
                </TabsTrigger>
                <TabsTrigger value="features" className="flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  Features ({project.featureCount})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="articles">
                {project.articles && project.articles.length > 0 ? (
                  <div className="grid gap-4">
                    {project.articles.map(article => (
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
                              {article.categoryName && <span>{article.categoryName}</span>}
                            </div>
                          </CardHeader>
                        </Card>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl bg-muted/20">
                    No articles found for this project.
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="features">
                {project.features && project.features.length > 0 ? (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {project.features.map(feature => (
                      <Link key={feature.id} href={`/features/${feature.slug}`}>
                        <Card className="hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer h-full">
                          <CardHeader className="p-5">
                            <div className="flex justify-between items-start mb-2 gap-4">
                              <CardTitle className="text-lg leading-tight flex items-center gap-2">
                                <Star className="w-4 h-4 text-primary" />
                                {feature.name}
                              </CardTitle>
                              <FeatureStatusBadge status={feature.status} />
                            </div>
                            <CardDescription className="line-clamp-2 text-sm text-muted-foreground">
                              {feature.description || "No description available."}
                            </CardDescription>
                            <div className="mt-4 text-xs text-muted-foreground font-medium">
                              {feature.articleCount} associated docs
                            </div>
                          </CardHeader>
                        </Card>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl bg-muted/20">
                    No features defined for this project yet.
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            Project not found.
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
