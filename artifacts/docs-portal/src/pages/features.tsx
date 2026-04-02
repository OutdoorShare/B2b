import { useGetDocFeatures } from "@workspace/api-client-react";
import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/public-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { FeatureStatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search } from "lucide-react";

export default function Features() {
  const { data: features, isLoading } = useGetDocFeatures();
  const [search, setSearch] = useState("");

  const filteredFeatures = features?.filter(f => 
    f.name.toLowerCase().includes(search.toLowerCase()) || 
    f.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Features Directory</h1>
            <p className="text-muted-foreground text-lg">Browse documentation by specific features.</p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Filter features..." 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="border rounded-xl bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Feature Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Docs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredFeatures && filteredFeatures.length > 0 ? (
                filteredFeatures.map((feature) => (
                  <TableRow key={feature.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      <Link href={`/features/${feature.slug}`} className="text-foreground hover:text-primary transition-colors">
                        {feature.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <FeatureStatusBadge status={feature.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {feature.projectName || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {feature.categoryName || "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {feature.articleCount}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No features found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </PublicLayout>
  );
}
