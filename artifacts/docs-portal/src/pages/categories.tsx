import { useGetDocCategories } from "@workspace/api-client-react";
import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/public-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderTree } from "lucide-react";

export default function Categories() {
  const { data: categories, isLoading } = useGetDocCategories();

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Categories</h1>
          <p className="text-muted-foreground text-lg">Browse documentation by category.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)
          ) : categories && categories.length > 0 ? (
            categories.map((category) => (
              <Link key={category.id} href={`/category/${category.slug}`}>
                <Card className="hover:border-primary/50 transition-all cursor-pointer h-full group">
                  <CardHeader>
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      {/* Would render icon if we had a dynamic icon component, using fallback */}
                      <FolderTree className="w-5 h-5" />
                    </div>
                    <CardTitle>{category.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {category.description || "No description available"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <span>{category.articleCount}</span>
                      <span>articles</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-center py-20 text-muted-foreground border border-dashed rounded-xl">
              No categories found.
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
