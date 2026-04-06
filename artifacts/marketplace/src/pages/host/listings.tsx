import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/context/auth";
import { HostLayout } from "./layout";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Package,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";

export function HostListingsPage() {
  const { customer } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["host-listings", customer?.id],
    queryFn: () => api.host.listings(customer!.id),
    enabled: !!customer,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.host.deleteListing(customer!.id, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["host-listings"] });
      qc.invalidateQueries({ queryKey: ["host-stats"] });
      toast({ title: "Listing deleted" });
      setDeletingId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setDeletingId(null);
    },
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.host.updateListing(customer!.id, id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["host-listings"] });
      qc.invalidateQueries({ queryKey: ["host-stats"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <HostLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Listings</h1>
            <p className="text-gray-500 text-sm mt-0.5">{listings.length} listing{listings.length !== 1 ? "s" : ""} on OutdoorShare</p>
          </div>
          <Button
            onClick={() => setLocation("/host/listings/new")}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Listing
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 h-24 animate-pulse" />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-700 mb-2">No listings yet</h2>
            <p className="text-gray-400 text-sm mb-6">Add your first piece of gear and start earning on OutdoorShare.</p>
            <Button
              onClick={() => setLocation("/host/listings/new")}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add First Listing
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4"
              >
                {listing.imageUrls[0] ? (
                  <img
                    src={listing.imageUrls[0]}
                    alt={listing.title}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Package className="h-6 w-6 text-gray-400" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-semibold text-gray-900 truncate">{listing.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      listing.status === "active" ? "bg-emerald-100 text-emerald-700" :
                      listing.status === "draft" ? "bg-gray-100 text-gray-600" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {listing.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    ${parseFloat(listing.pricePerDay).toFixed(0)}/day
                    {listing.categoryName && <span className="ml-2">· {listing.categoryName}</span>}
                    {listing.location && <span className="ml-2">· {listing.location}</span>}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleStatus.mutate({
                      id: listing.id,
                      status: listing.status === "active" ? "inactive" : "active",
                    })}
                    className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                    title={listing.status === "active" ? "Deactivate" : "Activate"}
                  >
                    {listing.status === "active" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => setLocation(`/host/listings/${listing.id}/edit`)}
                    className="p-2 text-gray-400 hover:text-primary rounded-lg hover:bg-primary/10 transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {deletingId === listing.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => deleteMutation.mutate(listing.id)}
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeletingId(listing.id)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </HostLayout>
  );
}
