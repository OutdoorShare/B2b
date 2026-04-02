import { useGetDocProjects } from "@workspace/api-client-react";
import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/public-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Layout } from "lucide-react";
import { ProjectStatusBadge } from "@/components/status-badge";

export default function Projects() {
  const { data: projects, isLoading } = useGetDocProjects();

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Projects</h1>
          <p className="text-muted-foreground text-lg">Browse documentation by product or project.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)
          ) : projects && projects.length > 0 ? (
            projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.slug}`}>
                <Card className="hover:border-primary/50 transition-all cursor-pointer h-full group flex flex-col">
                  <CardHeader className="flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Layout className="w-5 h-5" />
                      </div>
                      <ProjectStatusBadge status={project.status} />
                    </div>
                    <CardTitle className="mb-2">{project.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {project.description || "No description available"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="border-t pt-4 mt-auto">
                    <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
                      <div><span className="text-foreground">{project.articleCount}</span> docs</div>
                      <div><span className="text-foreground">{project.featureCount}</span> features</div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-center py-20 text-muted-foreground border border-dashed rounded-xl bg-muted/20">
              No projects found.
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
