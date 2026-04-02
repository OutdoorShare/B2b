import { useGetDocsStats } from "@workspace/api-client-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, FolderTree, Layout, Star } from "lucide-react";
import { Link } from "wouter";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetDocsStats();

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Docs Portal Admin</h1>
        <p className="text-muted-foreground">Manage your knowledge base content.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {isLoading ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
        ) : stats ? (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Articles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalArticles}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stats.publishedArticles} published
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FolderTree className="w-4 h-4" /> Categories
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalCategories}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Layout className="w-4 h-4" /> Projects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalProjects}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Star className="w-4 h-4" /> Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalFeatures}</div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
      <div className="grid sm:grid-cols-3 gap-4">
        <Link href="/admin/articles/new">
          <Card className="hover:border-primary/50 cursor-pointer transition-colors bg-primary/5 border-primary/20">
            <CardContent className="p-6 flex flex-col items-center text-center">
              <FileText className="w-8 h-8 text-primary mb-3" />
              <div className="font-medium">Write new article</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/categories">
          <Card className="hover:border-primary/50 cursor-pointer transition-colors">
            <CardContent className="p-6 flex flex-col items-center text-center">
              <FolderTree className="w-8 h-8 text-muted-foreground mb-3" />
              <div className="font-medium">Manage categories</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/projects">
          <Card className="hover:border-primary/50 cursor-pointer transition-colors">
            <CardContent className="p-6 flex flex-col items-center text-center">
              <Layout className="w-8 h-8 text-muted-foreground mb-3" />
              <div className="font-medium">Manage projects</div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </AdminLayout>
  );
}
