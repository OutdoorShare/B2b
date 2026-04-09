import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth";
import { HostLayout } from "./layout";
import { api, type HostBundle, type HostListing } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Plus, Package2, Pencil, Trash2, X, Upload, ChevronDown, ChevronUp,
  ImageIcon, ToggleLeft, ToggleRight,
} from "lucide-react";

const API_BASE = "/api";

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/upload/image`, { method: "POST", body: fd });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.url as string;
}

function resolveImage(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/")) return url;
  const filename = url.split("/").pop() ?? "";
  return `${API_BASE}/uploads/${filename}`;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  coverImageUrl: null as string | null,
  pricePerDay: "",
  listingIds: [] as number[],
  discountPercent: "0",
};

function BundleForm({
  listings,
  initial,
  onSave,
  onCancel,
  saving,
}: {
  listings: HostListing[];
  initial?: typeof EMPTY_FORM;
  onSave: (data: typeof EMPTY_FORM) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<typeof EMPTY_FORM>(initial ?? EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const toggleListing = (id: number) => {
    set("listingIds", form.listingIds.includes(id)
      ? form.listingIds.filter(x => x !== id)
      : [...form.listingIds, id]);
  };

  const handleImageFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImage(file);
      set("coverImageUrl", url);
    } catch {
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.pricePerDay) return;
    onSave(form);
  };

  const displayUrl = resolveImage(form.coverImageUrl);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Cover photo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Cover photo (optional)</label>
        <div
          className="h-32 rounded-xl border border-dashed border-gray-300 overflow-hidden bg-gray-50 relative cursor-pointer group hover:border-primary transition-colors"
          onClick={() => imgRef.current?.click()}
        >
          {displayUrl ? (
            <img src={displayUrl} alt="Cover" className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-1.5 text-gray-400">
              <ImageIcon className="h-6 w-6" />
              <span className="text-xs">Click to upload a cover photo</span>
            </div>
          )}
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {uploading
              ? <Loader2 className="h-6 w-6 text-white animate-spin" />
              : <Upload className="h-5 w-5 text-white" />}
          </div>
          {displayUrl && !uploading && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); set("coverImageUrl", null); }}
              className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <input
          ref={imgRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ""; }}
        />
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Bundle name *</label>
        <Input
          value={form.name}
          onChange={e => set("name", e.target.value)}
          placeholder="e.g. Weekend Adventure Bundle"
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={e => set("description", e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          placeholder="What's included and why it's great..."
        />
      </div>

      {/* Price + Discount row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price / day ($) *</label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.pricePerDay}
            onChange={e => set("pricePerDay", e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bundle discount (%)</label>
          <Input
            type="number"
            min="0"
            max="100"
            step="1"
            value={form.discountPercent}
            onChange={e => set("discountPercent", e.target.value)}
            placeholder="0"
          />
          <p className="text-xs text-gray-400 mt-0.5">Discount applied at checkout</p>
        </div>
      </div>

      {/* Included listings */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Included listings
          {form.listingIds.length > 0 && (
            <span className="ml-2 text-xs font-normal text-primary">({form.listingIds.length} selected)</span>
          )}
        </label>
        {listings.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No listings yet — create some first.</p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
            {listings.map(l => {
              const selected = form.listingIds.includes(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggleListing(l.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                    selected ? "bg-primary/10 border border-primary/30 text-primary" : "hover:bg-gray-50 border border-transparent text-gray-700"
                  }`}
                >
                  <div className={`h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selected ? "bg-primary border-primary" : "border-gray-300"}`}>
                    {selected && <div className="h-2 w-2 rounded-sm bg-white" />}
                  </div>
                  <span className="flex-1 truncate font-medium">{l.title}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">${parseFloat(l.pricePerDay).toFixed(0)}/day</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" className="bg-primary hover:bg-primary/90 text-white flex-1" disabled={saving || uploading}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Bundle"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </form>
  );
}

function BundleCard({
  bundle, listings, onEdit, onDelete, onToggle,
}: {
  bundle: HostBundle;
  listings: HostListing[];
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const displayUrl = resolveImage(bundle.coverImageUrl);
  const includedListings = listings.filter(l => bundle.listingIds?.includes(l.id));
  const discount = parseFloat(bundle.discountPercent);

  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden transition-opacity ${bundle.isActive ? "" : "opacity-60"}`}>
      {/* Cover */}
      <div className="h-36 bg-gradient-to-r from-primary/20 to-primary/10 relative overflow-hidden">
        {displayUrl && <img src={displayUrl} alt={bundle.name} className="h-full w-full object-cover" />}
        {!bundle.isActive && (
          <div className="absolute top-2 left-2">
            <span className="bg-gray-800/70 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">Inactive</span>
          </div>
        )}
        {discount > 0 && (
          <div className="absolute top-2 right-2">
            <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{discount}% OFF</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{bundle.name}</h3>
            {bundle.description && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{bundle.description}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold text-gray-900">${parseFloat(bundle.pricePerDay).toFixed(0)}</p>
            <p className="text-[10px] text-gray-400">/ day</p>
          </div>
        </div>

        {includedListings.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {includedListings.slice(0, 3).map(l => (
              <span key={l.id} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full truncate max-w-[120px]">
                {l.title}
              </span>
            ))}
            {includedListings.length > 3 && (
              <span className="text-[10px] text-gray-400">+{includedListings.length - 3} more</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
          <button
            onClick={onToggle}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors"
          >
            {bundle.isActive
              ? <ToggleRight className="h-4 w-4 text-primary" />
              : <ToggleLeft className="h-4 w-4" />}
            {bundle.isActive ? "Active" : "Inactive"}
          </button>
          <div className="flex-1" />
          <button
            onClick={onEdit}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary transition-colors px-2 py-1 rounded hover:bg-primary/5"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function HostBundlesPage() {
  const { customer } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<HostBundle | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const { data: bundles = [], isLoading } = useQuery({
    queryKey: ["host-bundles", customer?.id],
    queryFn: () => api.host.bundles(customer!.id),
    enabled: !!customer,
  });

  const { data: listings = [] } = useQuery({
    queryKey: ["host-listings", customer?.id],
    queryFn: () => api.host.listings(customer!.id),
    enabled: !!customer,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["host-bundles", customer?.id] });

  const createMutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) =>
      api.host.createBundle(customer!.id, { ...data, pricePerDay: parseFloat(data.pricePerDay) }),
    onSuccess: () => { invalidate(); setShowForm(false); toast({ title: "Bundle created" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof EMPTY_FORM }) =>
      api.host.updateBundle(customer!.id, id, { ...data, pricePerDay: parseFloat(data.pricePerDay) }),
    onSuccess: () => { invalidate(); setEditing(null); toast({ title: "Bundle updated" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.host.deleteBundle(customer!.id, id),
    onSuccess: () => { invalidate(); setConfirmDeleteId(null); toast({ title: "Bundle deleted" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api.host.updateBundle(customer!.id, id, { isActive }),
    onSuccess: () => invalidate(),
  });

  const toForm = (b: HostBundle): typeof EMPTY_FORM => ({
    name: b.name,
    description: b.description ?? "",
    coverImageUrl: b.coverImageUrl ?? null,
    pricePerDay: b.pricePerDay,
    listingIds: b.listingIds ?? [],
    discountPercent: b.discountPercent,
  });

  return (
    <HostLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bundles</h1>
            <p className="text-gray-500 text-sm mt-0.5">Create curated gear packages that renters can book together.</p>
          </div>
          {!showForm && !editing && (
            <Button
              className="bg-primary hover:bg-primary/90 text-white gap-2"
              onClick={() => setShowForm(true)}
            >
              <Plus className="h-4 w-4" /> New Bundle
            </Button>
          )}
        </div>

        {/* Create form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package2 className="h-4 w-4 text-primary" /> Create Bundle
            </h2>
            <BundleForm
              listings={listings}
              onSave={data => createMutation.mutate(data)}
              onCancel={() => setShowForm(false)}
              saving={createMutation.isPending}
            />
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div className="bg-white rounded-xl border border-primary/30 p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" /> Edit Bundle
            </h2>
            <BundleForm
              listings={listings}
              initial={toForm(editing)}
              onSave={data => updateMutation.mutate({ id: editing.id, data })}
              onCancel={() => setEditing(null)}
              saving={updateMutation.isPending}
            />
          </div>
        )}

        {/* Bundles grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : bundles.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-500">No bundles yet</p>
            <p className="text-sm mt-1">Create a bundle to offer curated gear packages to renters.</p>
            {!showForm && (
              <Button className="mt-4 bg-primary hover:bg-primary/90 text-white gap-2" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" /> Create your first bundle
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bundles.map(bundle => (
              <BundleCard
                key={bundle.id}
                bundle={bundle}
                listings={listings}
                onEdit={() => { setEditing(bundle); setShowForm(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                onDelete={() => setConfirmDeleteId(bundle.id)}
                onToggle={() => toggleMutation.mutate({ id: bundle.id, isActive: !bundle.isActive })}
              />
            ))}
          </div>
        )}

        {/* Delete confirm */}
        {confirmDeleteId !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Delete bundle?</h3>
              <p className="text-sm text-gray-500 mb-5">This action cannot be undone. The bundle will be permanently removed.</p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setConfirmDeleteId(null)}
                  disabled={deleteMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => deleteMutation.mutate(confirmDeleteId)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </HostLayout>
  );
}
