import { adminPath } from "@/lib/admin-nav";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  useGetListings, 
  useDeleteListing,
  getGetListingsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, Package, ChevronRight, Upload, Link2, Check } from "lucide-react";
import { getAdminSlug } from "@/lib/admin-nav";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AdminListings() {
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const slug = getAdminSlug();

  const copyListingLink = (id: number) => {
    const url = `${window.location.origin}/${slug}/listings/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };
  const queryClient = useQueryClient();

  const { data: listings, isLoading } = useGetListings(
    { search: search || undefined },
    { query: { queryKey: getGetListingsQueryKey({ search: search || undefined }) } }
  );

  const deleteListing = useDeleteListing();

  const handleDelete = (id: number) => {
    deleteListing.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetListingsQueryKey() });
          toast({ title: "Listing deleted successfully" });
        },
        onError: () => {
          toast({ title: "Failed to delete listing", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Listings</h2>
          <p className="text-muted-foreground mt-1">Manage your rental inventory</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={adminPath("/listings/import")}>
            <Button variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
          </Link>
          <Link href={adminPath("/listings/new")}>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Listing
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4 border-b">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search listings..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading listings...</div>
          ) : listings && listings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Image</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price / Day</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listings.map((listing) => (
                  <TableRow
                    key={listing.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => setLocation(adminPath(`/listings/${listing.id}`))}
                  >
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="w-12 h-12 bg-muted rounded-lg overflow-hidden">
                        {listing.imageUrls?.[0] ? (
                          <img src={listing.imageUrls[0]} alt={listing.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold">{listing.title}</p>
                      <p className="text-xs text-muted-foreground">ID #{listing.id}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{listing.categoryName || '—'}</TableCell>
                    <TableCell className="font-semibold">${listing.pricePerDay.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={listing.status === 'active' ? 'default' : listing.status === 'draft' ? 'secondary' : 'outline'} className="capitalize">
                        {listing.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-1 items-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Copy listing link"
                          onClick={() => copyListingLink(listing.id)}
                          className={copiedId === listing.id ? "text-green-600" : ""}
                        >
                          {copiedId === listing.id ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                        </Button>
                        <Link href={adminPath(`/listings/${listing.id}/edit`)}>
                          <Button variant="ghost" size="icon" title="Edit">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </Link>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete "{listing.title}". This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDelete(listing.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-24 text-center flex flex-col items-center">
              <Package className="w-12 h-12 text-muted mb-4" />
              <h3 className="text-lg font-medium mb-1">No listings found</h3>
              <p className="text-muted-foreground mb-4">You haven't added any listings yet.</p>
              <Link href={adminPath("/listings/new")}>
                <Button variant="outline">Create your first listing</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
