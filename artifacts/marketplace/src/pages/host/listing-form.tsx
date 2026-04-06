import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/context/auth";
import { HostLayout } from "./layout";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, X, Loader2 } from "lucide-react";

const CONDITIONS = [
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
];

const STATUSES = [
  { value: "active", label: "Active — visible on marketplace" },
  { value: "draft", label: "Draft — hidden from marketplace" },
  { value: "inactive", label: "Inactive" },
];

export function HostListingFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const { customer } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    categoryId: "",
    pricePerDay: "",
    weekendPrice: "",
    pricePerWeek: "",
    depositAmount: "",
    halfDayEnabled: false,
    halfDayRate: "",
    quantity: "1",
    imageUrls: [] as string[],
    location: "",
    condition: "",
    brand: "",
    model: "",
    requirements: "",
    status: "active",
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["host-categories"],
    queryFn: () => api.host.categories(),
  });

  const { data: existingListings = [] } = useQuery({
    queryKey: ["host-listings", customer?.id],
    queryFn: () => api.host.listings(customer!.id),
    enabled: !!customer && isEdit,
  });

  useEffect(() => {
    if (isEdit && existingListings.length) {
      const listing = existingListings.find(l => String(l.id) === id);
      if (listing) {
        setForm({
          title: listing.title,
          description: listing.description,
          categoryId: listing.categoryId ? String(listing.categoryId) : "",
          pricePerDay: listing.pricePerDay,
          weekendPrice: "",
          pricePerWeek: "",
          depositAmount: "",
          halfDayEnabled: false,
          halfDayRate: "",
          quantity: String(listing.quantity),
          imageUrls: listing.imageUrls,
          location: listing.location ?? "",
          condition: listing.condition ?? "",
          brand: listing.brand ?? "",
          model: listing.model ?? "",
          requirements: "",
          status: listing.status,
        });
      }
    }
  }, [isEdit, id, existingListings]);

  const set = (key: string, value: unknown) =>
    setForm(f => ({ ...f, [key]: value }));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of files.slice(0, 5)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload/image", { method: "POST", body: fd });
        if (res.ok) {
          const data = await res.json();
          uploadedUrls.push(data.url);
        }
      }
      setForm(f => ({ ...f, imageUrls: [...f.imageUrls, ...uploadedUrls].slice(0, 5) }));
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        pricePerDay: parseFloat(form.pricePerDay),
        weekendPrice: form.weekendPrice ? parseFloat(form.weekendPrice) : null,
        pricePerWeek: form.pricePerWeek ? parseFloat(form.pricePerWeek) : null,
        depositAmount: form.depositAmount ? parseFloat(form.depositAmount) : null,
        halfDayRate: form.halfDayRate ? parseFloat(form.halfDayRate) : null,
        quantity: parseInt(form.quantity) || 1,
        condition: form.condition || null,
      };
      if (isEdit) {
        return api.host.updateListing(customer!.id, parseInt(id!), body);
      } else {
        return api.host.createListing(customer!.id, body);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["host-listings"] });
      qc.invalidateQueries({ queryKey: ["host-stats"] });
      toast({ title: isEdit ? "Listing updated" : "Listing created" });
      setLocation("/host/listings");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.description || !form.pricePerDay) {
      toast({ title: "Please fill in the required fields", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <HostLayout>
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => setLocation("/host/listings")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Listings
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {isEdit ? "Edit Listing" : "New Listing"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Basic Info</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <Input
                  value={form.title}
                  onChange={e => set("title", e.target.value)}
                  placeholder="e.g. 2023 Yamaha Jet Ski"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={e => set("description", e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Describe your adventure — condition, features, what's included..."
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={form.categoryId}
                    onChange={e => set("categoryId", e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                  <select
                    value={form.condition}
                    onChange={e => set("condition", e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select condition</option>
                    {CONDITIONS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                  <Input value={form.brand} onChange={e => set("brand", e.target.value)} placeholder="e.g. Yamaha" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <Input value={form.model} onChange={e => set("model", e.target.value)} placeholder="e.g. WaveRunner FX" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Location</label>
                <Input
                  value={form.location}
                  onChange={e => set("location", e.target.value)}
                  placeholder="e.g. Boulder, CO"
                />
              </div>
            </div>
          </section>

          {/* Pricing */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Pricing</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price per Day <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <Input
                      value={form.pricePerDay}
                      onChange={e => set("pricePerDay", e.target.value)}
                      className="pl-7"
                      placeholder="150"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weekend Rate</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <Input
                      value={form.weekendPrice}
                      onChange={e => set("weekendPrice", e.target.value)}
                      className="pl-7"
                      placeholder="175"
                      type="number"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weekly Rate</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <Input
                      value={form.pricePerWeek}
                      onChange={e => set("pricePerWeek", e.target.value)}
                      className="pl-7"
                      placeholder="900"
                      type="number"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Security Deposit</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <Input
                      value={form.depositAmount}
                      onChange={e => set("depositAmount", e.target.value)}
                      className="pl-7"
                      placeholder="500"
                      type="number"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                <input
                  type="checkbox"
                  id="halfDay"
                  checked={form.halfDayEnabled}
                  onChange={e => set("halfDayEnabled", e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-primary"
                />
                <div className="flex-1">
                  <label htmlFor="halfDay" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Enable half-day rate
                  </label>
                  {form.halfDayEnabled && (
                    <div className="mt-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <Input
                          value={form.halfDayRate}
                          onChange={e => set("halfDayRate", e.target.value)}
                          className="pl-7 max-w-[150px]"
                          placeholder="85"
                          type="number"
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Photos */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Photos</h2>
            <div className="space-y-3">
              {form.imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {form.imageUrls.map((url, i) => (
                    <div key={i} className="relative group">
                      <img src={url} alt="" className="w-20 h-20 rounded-lg object-cover border border-gray-200" />
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, imageUrls: f.imageUrls.filter((_, j) => j !== i) }))}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {form.imageUrls.length < 5 && (
                <label className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-200 rounded-lg p-6 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  ) : (
                    <Upload className="h-6 w-6 text-gray-400" />
                  )}
                  <span className="text-sm text-gray-500">
                    {uploading ? "Uploading..." : `Click to upload photos (${form.imageUrls.length}/5)`}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
          </section>

          {/* Details */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Available</label>
                  <Input
                    value={form.quantity}
                    onChange={e => set("quantity", e.target.value)}
                    type="number"
                    min="1"
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => set("status", e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {STATUSES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Special Requirements</label>
                <textarea
                  value={form.requirements}
                  onChange={e => set("requirements", e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="e.g. Valid driver's license required, minimum age 21..."
                />
              </div>
            </div>
          </section>

          <div className="flex items-center justify-end gap-3 pb-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/host/listings")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-white"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{isEdit ? "Saving..." : "Creating..."}</>
              ) : (
                isEdit ? "Save Changes" : "Create Listing"
              )}
            </Button>
          </div>
        </form>
      </div>
    </HostLayout>
  );
}
