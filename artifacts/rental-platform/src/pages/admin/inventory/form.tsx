import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { adminPath, getAdminSession } from "@/lib/admin-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Loader2, Upload, X, Package } from "lucide-react";
import { Link } from "wouter";

type Category = { id: number; name: string };

const STATUS_OPTIONS = [
  { value: "available",      label: "Available" },
  { value: "maintenance",    label: "In Maintenance" },
  { value: "damaged",        label: "Damaged" },
  { value: "reserved",       label: "Reserved" },
  { value: "out_of_service", label: "Out of Service" },
];

export default function AdminInventoryForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== "new";
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
  const fileRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    categoryId: "",
    description: "",
    status: "available",
    quantity: 1,
    imageUrls: [] as string[],
    brand: "",
    model: "",
    specs: "",
    notes: "",
    nextMaintenanceDate: "",
  });

  const adminHeaders = (): Record<string, string> => {
    const s = getAdminSession();
    return s?.token ? { "x-admin-token": s.token } : {};
  };

  useEffect(() => {
    // Load categories
    fetch(`${BASE}/api/categories`, { headers: adminHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(setCategories)
      .catch(() => {});

    // Load existing product if editing
    if (isEdit) {
      fetch(`${BASE}/api/products/${id}`, { headers: adminHeaders() })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            setForm({
              name: data.name ?? "",
              sku: data.sku ?? "",
              categoryId: data.categoryId ? String(data.categoryId) : "",
              description: data.description ?? "",
              status: data.status ?? "available",
              quantity: data.quantity ?? 1,
              imageUrls: data.imageUrls ?? [],
              brand: data.brand ?? "",
              model: data.model ?? "",
              specs: data.specs ?? "",
              notes: data.notes ?? "",
              nextMaintenanceDate: data.nextMaintenanceDate ?? "",
            });
          }
        })
        .catch(() => toast({ title: "Failed to load product", variant: "destructive" }));
    }
  }, [id]);

  const handleChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${BASE}/api/upload/image`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      setForm(prev => ({ ...prev, imageUrls: [...prev.imageUrls, url] }));
    } catch {
      toast({ title: "Image upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx: number) => {
    setForm(prev => ({ ...prev, imageUrls: prev.imageUrls.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "Product name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        description: form.description.trim() || null,
        status: form.status,
        quantity: Number(form.quantity),
        imageUrls: form.imageUrls,
        brand: form.brand.trim() || null,
        model: form.model.trim() || null,
        specs: form.specs.trim() || null,
        notes: form.notes.trim() || null,
        nextMaintenanceDate: form.nextMaintenanceDate || null,
      };
      const url = isEdit ? `${BASE}/api/products/${id}` : `${BASE}/api/products`;
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Save failed");
      const saved = await res.json();
      toast({ title: isEdit ? "Product updated" : "Product added to inventory" });
      navigate(adminPath(`/inventory/${saved.id}`));
    } catch {
      toast({ title: "Failed to save product", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={adminPath(isEdit ? `/inventory/${id}` : "/inventory")}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold">{isEdit ? "Edit Product" : "Add Product"}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEdit ? "Update product details and availability" : "Add a new product to your inventory"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <div className="bg-background rounded-2xl border p-5 space-y-4">
          <h3 className="font-semibold flex items-center gap-2 text-sm">
            <Package className="w-4 h-4 text-primary" /> Product Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={e => handleChange("name", e.target.value)}
                placeholder="e.g. 4-Person Tent, Kayak, Mountain Bike…"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sku">SKU / Serial Number</Label>
              <Input
                id="sku"
                value={form.sku}
                onChange={e => handleChange("sku", e.target.value)}
                placeholder="e.g. TENT-001"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.categoryId} onValueChange={v => handleChange("categoryId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={form.brand}
                onChange={e => handleChange("brand", e.target.value)}
                placeholder="e.g. REI, Yakima, Trek…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={form.model}
                onChange={e => handleChange("model", e.target.value)}
                placeholder="e.g. Passage 4, Pro-V…"
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={e => handleChange("description", e.target.value)}
                placeholder="Describe the product, what's included, any key features…"
                rows={3}
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="specs">Specs / Technical Details</Label>
              <Textarea
                id="specs"
                value={form.specs}
                onChange={e => handleChange("specs", e.target.value)}
                placeholder="Dimensions, weight, capacity, materials…"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Availability & Quantity */}
        <div className="bg-background rounded-2xl border p-5 space-y-4">
          <h3 className="font-semibold text-sm">Availability & Quantity</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => handleChange("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                value={form.quantity}
                onChange={e => handleChange("quantity", Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Maintenance */}
        <div className="bg-background rounded-2xl border p-5 space-y-4">
          <h3 className="font-semibold text-sm">Maintenance Scheduling</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="nextMaintenanceDate">Next Maintenance Due</Label>
              <Input
                id="nextMaintenanceDate"
                type="date"
                value={form.nextMaintenanceDate}
                onChange={e => handleChange("nextMaintenanceDate", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5 sm:hidden lg:block" />
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="notes">Internal Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={e => handleChange("notes", e.target.value)}
                placeholder="Storage location, handling notes, known issues…"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Photos */}
        <div className="bg-background rounded-2xl border p-5 space-y-4">
          <h3 className="font-semibold text-sm">Photos</h3>
          <div className="flex flex-wrap gap-3">
            {form.imageUrls.map((url, i) => (
              <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border group">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-20 h-20 rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              <span className="text-[10px]">{uploading ? "Uploading" : "Add Photo"}</span>
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add to Inventory"}
          </Button>
          <Link href={adminPath(isEdit ? `/inventory/${id}` : "/inventory")}>
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
