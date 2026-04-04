import { adminPath } from "@/lib/admin-nav";
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { 
  useGetListing, 
  useCreateListing, 
  useUpdateListing,
  getGetListingQueryKey,
  getGetListingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, X, CheckCircle2, AlertCircle, CircleDashed, ImagePlus, Loader2, IdCard, Sparkles, ChevronDown, ChevronUp, RefreshCw, Info, Plus, Trash2, Clock, Search, Package, Link2, Unlink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { AddonManager } from "@/components/addon-manager";
import { UnitIdentifiersManager } from "@/components/unit-identifiers-manager";
import { getAdminSession } from "@/lib/admin-nav";

interface ContactCard { id: number; name: string; address?: string | null; phone?: string | null; email?: string | null; }
interface Category { id: number; name: string; slug: string; icon?: string | null; }
type TimeSlotDef = { label: string; startTime: string; endTime: string; rate: "full_day" | "half_day" };

// 30-minute increments 6 AM – 10 PM
const SLOT_TIMES: string[] = (() => {
  const times: string[] = [];
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 30]) {
      if (h === 22 && m === 30) break;
      const ampm = h < 12 ? "AM" : "PM";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      times.push(`${h12}:${m === 0 ? "00" : "30"} ${ampm}`);
    }
  }
  return times;
})();

function useContactCards() {
  const [cards, setCards] = useState<ContactCard[]>([]);
  useEffect(() => {
    const s = getAdminSession();
    const headers: Record<string, string> = {};
    if (s?.token) headers["x-admin-token"] = s.token;
    fetch(`${BASE}/api/contact-cards`, { headers }).then(r => r.ok ? r.json() : []).then(setCards).catch(() => {});
  }, []);
  return cards;
}

function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    const s = getAdminSession();
    const headers: Record<string, string> = {};
    if (s?.token) headers["x-admin-token"] = s.token;
    fetch(`${BASE}/api/categories`, { headers }).then(r => r.ok ? r.json() : []).then(setCategories).catch(() => {});
  }, []);
  return categories;
}

interface PickupAddressData { usedAddresses: string[]; businessAddress: string | null; }
function usePickupAddresses() {
  const [data, setData] = useState<PickupAddressData>({ usedAddresses: [], businessAddress: null });
  useEffect(() => {
    const s = getAdminSession();
    const headers: Record<string, string> = {};
    if (s?.token) headers["x-admin-token"] = s.token;
    fetch(`${BASE}/api/listings/addresses`, { headers })
      .then(r => r.ok ? r.json() : { usedAddresses: [], businessAddress: null })
      .then(setData)
      .catch(() => {});
  }, []);
  return data;
}

interface Product { id: number; name: string; sku?: string | null; brand?: string | null; model?: string | null; quantity: number; status: string; description?: string | null; categoryId?: number | null; imageUrls?: string[] | null; }
function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    const s = getAdminSession();
    const headers: Record<string, string> = {};
    if (s?.token) headers["x-admin-token"] = s.token;
    fetch(`${BASE}/api/products`, { headers }).then(r => r.ok ? r.json() : []).then(setProducts).catch(() => {});
  }, []);
  return products;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const OPTIONAL_NUMERIC = new Set(['pricePerWeek', 'pricePerHour', 'ageRestriction']);

export default function AdminListingsForm() {
  const contactCards = useContactCards();
  const categories = useCategories();
  const pickupAddresses = usePickupAddresses();
  const [useBusinessAddress, setUseBusinessAddress] = useState(false);
  const params = useParams<{ slug: string; id?: string }>();
  const isEditing = !!params.id;
  const id = params?.id ? parseInt(params.id) : 0;
  
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: listing, isLoading: isLoadingListing } = useGetListing(id, {
    query: { enabled: isEditing && !!id, queryKey: getGetListingQueryKey(id) }
  });

  const createListing = useCreateListing();
  const updateListing = useUpdateListing();

  // Inventory search
  const allProducts = useProducts();
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [linkedProduct, setLinkedProduct] = useState<Product | null>(null);
  const inventorySearchRef = useRef<HTMLDivElement>(null);

  const filteredProducts = inventorySearch.trim().length > 0
    ? allProducts.filter(p => {
        const q = inventorySearch.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.brand ?? '').toLowerCase().includes(q) ||
          (p.model ?? '').toLowerCase().includes(q) ||
          (p.sku ?? '').toLowerCase().includes(q)
        );
      }).slice(0, 8)
    : allProducts.slice(0, 8);

  const linkProduct = (product: Product) => {
    setLinkedProduct(product);
    setInventorySearch('');
    setInventoryOpen(false);
    setFormData(prev => ({
      ...prev,
      title: prev.title || product.name,
      brand: product.brand || prev.brand,
      model: product.model || prev.model,
      quantity: product.quantity || prev.quantity,
      ...(product.description && !prev.description ? { description: product.description } : {}),
      ...(product.categoryId && !prev.categoryId ? { categoryId: product.categoryId } : {}),
      ...(product.imageUrls?.length && !(prev.photos?.length) ? { photos: product.imageUrls } : {}),
    }));
  };

  const unlinkProduct = () => {
    setLinkedProduct(null);
    setInventorySearch('');
  };

  type InlineUnit = { identifier: string; label: string; type: 'serial' | 'vin' | 'hin' };
  const [inlineUnits, setInlineUnits] = useState<InlineUnit[]>([
    { identifier: '', label: '', type: 'serial' },
  ]);

  const updateInlineUnit = (index: number, field: keyof InlineUnit, value: string) => {
    setInlineUnits(prev => prev.map((u, i) => i === index ? { ...u, [field]: value } : u));
  };

  const saveInlineUnits = async (listingId: number) => {
    const s = getAdminSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (s?.token) headers['x-admin-token'] = s.token;
    const toCreate = inlineUnits.filter(u => u.identifier.trim());
    await Promise.all(toCreate.map(unit =>
      fetch(`${BASE}/api/listings/${listingId}/units`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ unitIdentifier: unit.identifier.trim(), identifierType: unit.type, label: unit.label.trim() || null }),
      })
    ));
  };

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    categoryId: null as number | null,
    status: 'draft' as any,
    pricePerDay: 0,
    weekendPrice: null as number | null,
    holidayPrice: null as number | null,
    pricePerWeek: null as number | null,
    pricePerHour: null as number | null,
    depositAmount: null as number | null,
    halfDayEnabled: false,
    halfDayDurationHours: 4 as number | null,
    halfDayRate: null as number | null,
    hourlyEnabled: false,
    hourlySlots: [] as { label: string; hours: number; price: number }[],
    hourlyPerHourEnabled: false,
    hourlyMinimumHours: 1 as number | null,
    timeSlots: [] as TimeSlotDef[],
    quantity: 1,
    imageUrls: [] as string[],
    location: '',
    weight: '',
    dimensions: '',
    brand: '',
    model: '',
    condition: 'good' as any,
    includedItems: [] as string[],
    requirements: '',
    ageRestriction: 21 as number | null,
    contactCardId: null as number | null,
  });

  const [includedItemInput, setIncludedItemInput] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [slotDraft, setSlotDraft] = useState<{ label: string; hours: string; price: string }>({ label: '', hours: '', price: '' });

  const addHourlySlot = () => {
    const hours = parseFloat(slotDraft.hours);
    const price = parseFloat(slotDraft.price);
    if (!slotDraft.label.trim() || isNaN(hours) || hours <= 0 || isNaN(price) || price < 0) return;
    setFormData(prev => ({ ...prev, hourlySlots: [...prev.hourlySlots, { label: slotDraft.label.trim(), hours, price }] }));
    setSlotDraft({ label: '', hours: '', price: '' });
  };
  const removeHourlySlot = (idx: number) => {
    setFormData(prev => ({ ...prev, hourlySlots: prev.hourlySlots.filter((_, i) => i !== idx) }));
  };

  // Time slot (fixed start/end windows) draft + helpers
  const [tsD, setTsD] = useState<{ label: string; startTime: string; endTime: string; rate: "full_day" | "half_day" }>({
    label: '', startTime: SLOT_TIMES[4] ?? "8:00 AM", endTime: SLOT_TIMES[8] ?? "10:00 AM", rate: "full_day",
  });
  const [advancedPricingOpen, setAdvancedPricingOpen] = useState(false);
  const [timeSlotsOpen, setTimeSlotsOpen] = useState(false);
  const addTimeSlot = () => {
    if (!tsD.startTime || !tsD.endTime) return;
    const label = tsD.label.trim() || `${tsD.startTime} – ${tsD.endTime}`;
    setFormData(prev => ({ ...prev, timeSlots: [...prev.timeSlots, { label, startTime: tsD.startTime, endTime: tsD.endTime, rate: tsD.rate }] }));
    setTsD(prev => ({ ...prev, label: '' }));
  };
  const removeTimeSlot = (idx: number) => {
    setFormData(prev => ({ ...prev, timeSlots: prev.timeSlots.filter((_, i) => i !== idx) }));
  };

  // AI description generator state
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiHint, setAiHint] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPreview, setAiPreview] = useState('');

  const generateAiDescription = useCallback(async () => {
    setAiGenerating(true);
    setAiPreview('');
    try {
      const s = getAdminSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (s?.token) headers['x-admin-token'] = s.token;
      const categoryName = categories.find(c => c.id === formData.categoryId)?.name ?? '';
      const res = await fetch(`${BASE}/api/ai/generate-description`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: formData.title,
          category: categoryName,
          brand: formData.brand,
          model: formData.model,
          condition: formData.condition,
          location: formData.location,
          pricePerDay: formData.pricePerDay,
          pricePerWeek: formData.pricePerWeek,
          includedItems: formData.includedItems,
          requirements: formData.requirements,
          weight: formData.weight,
          dimensions: formData.dimensions,
          userHint: aiHint,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAiPreview(data.description ?? '');
    } catch (err: any) {
      toast({ title: "AI generation failed", description: err.message, variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  }, [formData, aiHint, categories, toast]);

  useEffect(() => {
    if (isEditing && listing) {
      setFormData({
        title: listing.title,
        description: listing.description,
        categoryId: listing.categoryId || null,
        status: listing.status,
        pricePerDay: listing.pricePerDay,
        weekendPrice: (listing as any).weekendPrice ?? null,
        holidayPrice: (listing as any).holidayPrice ?? null,
        pricePerWeek: listing.pricePerWeek ?? null,
        pricePerHour: listing.pricePerHour ?? null,
        depositAmount: listing.depositAmount ?? null,
        halfDayEnabled: (listing as any).halfDayEnabled ?? false,
        halfDayDurationHours: (listing as any).halfDayDurationHours ?? 4,
        halfDayRate: (listing as any).halfDayRate ?? null,
        hourlyEnabled: (listing as any).hourlyEnabled ?? false,
        hourlySlots: (listing as any).hourlySlots ?? [],
        hourlyPerHourEnabled: (listing as any).hourlyPerHourEnabled ?? false,
        hourlyMinimumHours: (listing as any).hourlyMinimumHours ?? 1,
        timeSlots: (listing as any).timeSlots ?? [],
        quantity: listing.quantity,
        imageUrls: listing.imageUrls || [],
        location: listing.location || '',
        weight: listing.weight || '',
        dimensions: listing.dimensions || '',
        brand: listing.brand || '',
        model: listing.model || '',
        condition: listing.condition || 'good',
        includedItems: listing.includedItems || [],
        requirements: listing.requirements || '',
        ageRestriction: 21,
        contactCardId: (listing as any).contactCardId ?? null,
      });
      if ((listing as any).halfDayEnabled || (listing as any).hourlyEnabled) setAdvancedPricingOpen(true);
      if (((listing as any).timeSlots ?? []).length > 0) setTimeSlotsOpen(true);
    }
  }, [isEditing, listing]);

  // When editing: auto-check "use business address" if the listing location matches the business address (run once)
  const didAutoSyncAddress = useRef(false);
  useEffect(() => {
    if (didAutoSyncAddress.current) return;
    if (!pickupAddresses.businessAddress || !formData.location) return;
    if (formData.location.trim() === pickupAddresses.businessAddress.trim()) {
      setUseBusinessAddress(true);
      didAutoSyncAddress.current = true;
    } else if (formData.location.trim()) {
      didAutoSyncAddress.current = true;
    }
  }, [pickupAddresses.businessAddress, formData.location]);

  // Resize inline unit rows when quantity changes (only when creating)
  useEffect(() => {
    if (isEditing) return;
    setInlineUnits(prev => {
      const qty = Math.max(1, Math.min(Number(formData.quantity) || 1, 50));
      if (prev.length === qty) return prev;
      if (qty > prev.length) {
        return [...prev, ...Array(qty - prev.length).fill(null).map(() => ({ identifier: '', label: '', type: 'serial' as const }))];
      }
      return prev.slice(0, qty);
    });
  }, [formData.quantity, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number'
        ? (value === '' ? (OPTIONAL_NUMERIC.has(name) ? null : 0) : Number(value))
        : value
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: name === 'categoryId' && value ? Number(value) : value
    }));
  };

  const addIncludedItem = () => {
    if (includedItemInput.trim() && !formData.includedItems.includes(includedItemInput.trim())) {
      setFormData(prev => ({ ...prev, includedItems: [...prev.includedItems, includedItemInput.trim()] }));
      setIncludedItemInput('');
    }
  };

  const removeIncludedItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      includedItems: prev.includedItems.filter((_, i) => i !== index)
    }));
  };

  const addImageUrl = () => {
    if (imageUrlInput.trim() && !formData.imageUrls.includes(imageUrlInput.trim())) {
      setFormData(prev => ({ ...prev, imageUrls: [...prev.imageUrls, imageUrlInput.trim()] }));
      setImageUrlInput('');
    }
  };

  const removeImageUrl = (index: number) => {
    setFormData(prev => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== index)
    }));
  };

  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of arr) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`${BASE}/api/upload/image`, { method: "POST", body: fd });
        if (!res.ok) { toast({ title: "Upload failed", description: file.name, variant: "destructive" }); continue; }
        const { url } = await res.json();
        uploaded.push(url);
      }
      if (uploaded.length) {
        setFormData(prev => ({ ...prev, imageUrls: [...prev.imageUrls, ...uploaded] }));
        toast({ title: `${uploaded.length} photo${uploaded.length > 1 ? "s" : ""} uploaded` });
      }
    } finally { setUploading(false); }
  }, [toast]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  }, [uploadFiles]);

  // Publish readiness checks — required when status is "active"
  const publishChecks = [
    { key: "title",       label: "Title",             done: formData.title.trim().length > 0 },
    { key: "description", label: "Description",        done: formData.description.trim().length > 0 },
    { key: "category",    label: "Category",           done: !!formData.categoryId },
    { key: "price",       label: "Price per day > $0", done: formData.pricePerDay > 0 },
    { key: "deposit",     label: "Security deposit > $0", done: (formData.depositAmount ?? 0) > 0 },
    { key: "location",    label: "Pickup address",     done: formData.location.trim().length > 0 },
    { key: "photos",      label: "At least one photo", done: formData.imageUrls.length > 0 },
  ];
  const publishBlocked = formData.status === "active" && publishChecks.some(c => !c.done);
  const [publishIntent, setPublishIntent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const statusToSave = publishIntent ? "active" : formData.status;

    // Deposit is always required regardless of draft/published state
    if (!formData.depositAmount || formData.depositAmount <= 0) {
      toast({
        title: "Security deposit required",
        description: "Please enter a deposit amount greater than $0.",
        variant: "destructive",
      });
      return;
    }

    // Validate before publishing
    if (statusToSave === "active" && publishChecks.some(c => !c.done)) {
      toast({
        title: "Cannot publish listing",
        description: "Please complete all required sections before publishing.",
        variant: "destructive",
      });
      setPublishIntent(false);
      return;
    }

    const payload = { ...formData, status: statusToSave };

    if (isEditing) {
      updateListing.mutate(
        { id, data: payload },
        {
          onSuccess: (data) => {
            queryClient.setQueryData(getGetListingQueryKey(id), data);
            queryClient.invalidateQueries({ queryKey: getGetListingsQueryKey() });
            toast({ title: statusToSave === "active" ? "Listing published!" : "Listing saved" });
            setLocation(adminPath("/listings"));
          },
          onError: () => {
            toast({ title: "Failed to update listing", variant: "destructive" });
            setPublishIntent(false);
          }
        }
      );
    } else {
      createListing.mutate(
        { data: payload },
        {
          onSuccess: async (data) => {
            if (data?.id) await saveInlineUnits(data.id);
            queryClient.invalidateQueries({ queryKey: getGetListingsQueryKey() });
            toast({ title: statusToSave === "active" ? "Listing published!" : "Listing saved as draft" });
            setLocation(adminPath("/listings"));
          },
          onError: () => {
            toast({ title: "Failed to create listing", variant: "destructive" });
            setPublishIntent(false);
          }
        }
      );
    }
  };

  if (isEditing && isLoadingListing) {
    return <div className="p-8">Loading listing details...</div>;
  }

  const isPending = createListing.isPending || updateListing.isPending;

  function StepBadge({ n }: { n: number }) {
    return (
      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center shrink-0 border border-primary/20">
        {n}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-12 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {isEditing ? 'Edit Listing' : 'Create Listing'}
          </h2>
          <p className="text-muted-foreground mt-1">
            {isEditing ? 'Update listing information and pricing.' : 'Fill in each section below to add a new rental listing.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
            {/* ── STEP 1: Basic Information ── */}
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <StepBadge n={1} />
                  <div>
                    <CardTitle>Basic Information</CardTitle>
                    <CardDescription>Name, category, and a description renters will see on the listing page.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* ── Link from Inventory ── */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Link from Inventory</Label>
                  <p className="text-xs text-muted-foreground">Pick an existing inventory item to auto-fill the title, brand, model, description, category, photos, and quantity.</p>
                  {linkedProduct ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/40">
                      <Link2 className="w-4 h-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{linkedProduct.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[linkedProduct.brand, linkedProduct.model].filter(Boolean).join(' · ')}
                          {linkedProduct.sku ? ` · SKU: ${linkedProduct.sku}` : ''}
                          {` · Qty: ${linkedProduct.quantity}`}
                        </p>
                      </div>
                      <button type="button" onClick={unlinkProduct} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                        <Unlink className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative" ref={inventorySearchRef}>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                          className="pl-9"
                          placeholder="Search by name, brand, model, or SKU…"
                          value={inventorySearch}
                          onChange={e => { setInventorySearch(e.target.value); setInventoryOpen(true); }}
                          onFocus={() => setInventoryOpen(true)}
                          onBlur={() => setTimeout(() => setInventoryOpen(false), 150)}
                        />
                      </div>
                      {inventoryOpen && filteredProducts.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 rounded-lg border bg-popover shadow-md max-h-72 overflow-y-auto">
                          {filteredProducts.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors flex items-center gap-3"
                              onMouseDown={() => linkProduct(p)}
                            >
                              <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{p.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {[p.brand, p.model].filter(Boolean).join(' · ')}
                                  {p.sku ? ` · SKU: ${p.sku}` : ''}
                                  {` · Qty: ${p.quantity}`}
                                </p>
                              </div>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {p.status}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {inventoryOpen && inventorySearch.trim().length > 0 && filteredProducts.length === 0 && (
                        <div className="absolute z-50 w-full mt-1 rounded-lg border bg-popover shadow-md px-4 py-3 text-sm text-muted-foreground">
                          No inventory products match "{inventorySearch}"
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t" />

                <div className="space-y-2">
                  <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
                  <Input id="title" name="title" value={formData.title} onChange={handleChange} required />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={formData.categoryId?.toString() || ""} onValueChange={(v) => handleSelectChange('categoryId', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map(c => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={(v) => handleSelectChange('status', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800"
                      onClick={() => { setAiPanelOpen(p => !p); setAiPreview(''); }}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      AI Suggest
                      {aiPanelOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
                  </div>

                  {aiPanelOpen && (
                    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-4 space-y-3">
                      <p className="text-xs text-violet-700 font-medium">
                        AI will use everything already filled in (title, brand, model, condition, location, included items, etc.) to craft an exciting description. Add any extra direction below.
                      </p>
                      <Textarea
                        placeholder='Optional: give the AI direction — e.g. "emphasize the audio system and the spacious deck area" or "keep it short and punchy, mention it seats 8"'
                        value={aiHint}
                        onChange={e => setAiHint(e.target.value)}
                        rows={2}
                        className="text-sm bg-white border-violet-200 focus-visible:ring-violet-400 resize-none"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={aiGenerating}
                        className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
                        onClick={generateAiDescription}
                      >
                        {aiGenerating
                          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating…</>
                          : <><Sparkles className="h-3.5 w-3.5" />Generate Description</>
                        }
                      </Button>

                      {aiPreview && (
                        <div className="space-y-2">
                          <div className="rounded-md border border-violet-200 bg-white p-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                            {aiPreview}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
                              onClick={() => {
                                setFormData(prev => ({ ...prev, description: aiPreview }));
                                setAiPanelOpen(false);
                                setAiPreview('');
                                toast({ title: "Description applied!", description: "The AI description has been added. Review and save when ready." });
                              }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Use this description
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={aiGenerating}
                              className="gap-1.5 border-violet-200 text-violet-700 hover:bg-violet-50"
                              onClick={generateAiDescription}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Try again
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <Textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={5} required />
                </div>
              </CardContent>
            </Card>

            {/* ── STEP 2: Photos ── */}
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <StepBadge n={2} />
                  <div>
                    <CardTitle>Photos <span className="text-destructive text-base">*</span></CardTitle>
                    <CardDescription>Upload at least one photo — the first image becomes the cover shown on the storefront.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={e => e.target.files && uploadFiles(e.target.files)}
                />
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 cursor-pointer transition-colors select-none ${
                    dragOver
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {uploading ? (
                    <><Loader2 className="w-8 h-8 animate-spin" /><p className="text-sm font-medium">Uploading…</p></>
                  ) : (
                    <><ImagePlus className="w-8 h-8" /><p className="text-sm font-medium">Drop photos here or click to browse</p><p className="text-xs">JPG, PNG, WebP, GIF — up to 5 MB each</p></>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="Or paste an image URL…"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addImageUrl())}
                  />
                  <Button type="button" variant="secondary" onClick={addImageUrl} title="Add URL">
                    <Upload className="w-4 h-4" />
                  </Button>
                </div>
                {formData.imageUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {formData.imageUrls.map((url, idx) => (
                      <div key={idx} className="relative group rounded-md overflow-hidden border aspect-[4/3]">
                        <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        <button
                          type="button"
                          onClick={() => removeImageUrl(idx)}
                          className="absolute top-1.5 right-1.5 w-7 h-7 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        {idx === 0 && (
                          <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded">
                            Cover
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── STEP 3: Pricing & Inventory ── */}
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <StepBadge n={3} />
                  <div>
                    <CardTitle>Pricing & Inventory</CardTitle>
                    <CardDescription>Set your daily rate, optional discount rates, security deposit, and how many units you have available.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pricePerDay">Price / Day ($) <span className="text-destructive">*</span></Label>
                    <Input id="pricePerDay" name="pricePerDay" type="number" min="0" step="0.01" value={formData.pricePerDay} onChange={handleChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pricePerWeek">Price / Week ($)</Label>
                    <Input id="pricePerWeek" name="pricePerWeek" type="number" min="0" step="0.01" value={formData.pricePerWeek || ''} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="depositAmount">Deposit ($) <span className="text-destructive">*</span></Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                            <Info className="h-3.5 w-3.5" />
                            <span className="sr-only">How deposits work</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent side="top" className="w-80 text-sm space-y-2 p-4">
                          <p className="font-semibold text-foreground">How Security Deposits Work</p>
                          <p className="text-muted-foreground leading-relaxed">
                            A security deposit is <strong>required on all rentals</strong>. The deposit is processed automatically at <strong>pickup time</strong> — when the renter submits their before-photos and completes the pickup process.
                          </p>
                          <ul className="text-muted-foreground space-y-1 list-disc list-inside leading-relaxed">
                            <li><strong>Rentals under 5 days</strong> — a hold is placed on the renter's card. The money is not charged unless there is damage.</li>
                            <li><strong>Rentals 5 days or longer</strong> — the deposit is <strong>fully charged</strong> at pickup and refunded manually at return if no damage.</li>
                          </ul>
                          <ul className="text-muted-foreground space-y-1 list-disc list-inside leading-relaxed">
                            <li>If the product is returned undamaged, release the hold (or issue a refund for long rentals) from the Booking detail page.</li>
                            <li>If there is damage, capture the hold or keep the charge from the Booking detail page.</li>
                          </ul>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Input id="depositAmount" name="depositAmount" type="number" min="0.01" step="0.01" placeholder="e.g. 200" value={formData.depositAmount || ''} onChange={handleChange} required />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── STEP 4: Pickup Location ── */}
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <StepBadge n={4} />
                  <div>
                    <CardTitle>Pickup Location <span className="text-destructive text-base">*</span></CardTitle>
                    <CardDescription>Where renters pick up and return this item.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {pickupAddresses.businessAddress && (
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="useBusinessAddress"
                      className="mt-0.5 h-4 w-4 accent-primary cursor-pointer"
                      checked={useBusinessAddress}
                      onChange={e => {
                        setUseBusinessAddress(e.target.checked);
                        if (e.target.checked) {
                          setFormData(prev => ({ ...prev, location: pickupAddresses.businessAddress! }));
                        } else {
                          setFormData(prev => ({ ...prev, location: '' }));
                        }
                      }}
                    />
                    <label htmlFor="useBusinessAddress" className="text-sm cursor-pointer leading-snug">
                      Use business address
                      <span className="block text-xs text-muted-foreground mt-0.5">{pickupAddresses.businessAddress}</span>
                    </label>
                  </div>
                )}
                <div className={useBusinessAddress ? "opacity-50 pointer-events-none" : ""}>
                  <Input
                    placeholder="e.g. 123 Main St, Denver, CO 80202"
                    value={formData.location}
                    onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  />
                </div>
                {pickupAddresses.usedAddresses.filter(a => a !== formData.location).length > 0 && !useBusinessAddress && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Previously used addresses — click to fill:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {pickupAddresses.usedAddresses
                        .filter(a => a !== formData.location)
                        .map(addr => (
                          <button
                            key={addr}
                            type="button"
                            onClick={() => { setFormData(prev => ({ ...prev, location: addr })); setUseBusinessAddress(false); }}
                            className="text-xs border rounded-full px-2.5 py-1 hover:bg-muted transition-colors truncate max-w-[220px]"
                            title={addr}
                          >
                            {addr}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── STEP 5: Equipment Details ── */}
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <StepBadge n={5} />
                  <div>
                    <CardTitle>Equipment Details</CardTitle>
                    <CardDescription>Optional specs and what's included — shown on the listing page to help renters know exactly what they're getting.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* ── Quantity + Unit Identifiers ── */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Total Quantity <span className="text-destructive">*</span></Label>
                    <p className="text-xs text-muted-foreground">How many identical units you have available to rent simultaneously.</p>
                    <Input id="quantity" name="quantity" type="number" min="1" value={formData.quantity} onChange={handleChange} required className="max-w-[140px]" />
                  </div>

                  {/* Inline unit identifiers — one row per unit, only when creating */}
                  {!isEditing && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Unit Identifiers</Label>
                        <span className="text-xs text-muted-foreground">(optional — VIN, HIN, or serial numbers)</span>
                      </div>
                      <div className="space-y-2">
                        {inlineUnits.map((unit, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-12 shrink-0 text-right">Unit {i + 1}</span>
                            <Select value={unit.type} onValueChange={v => updateInlineUnit(i, 'type', v as InlineUnit['type'])}>
                              <SelectTrigger className="w-28 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="serial">Serial #</SelectItem>
                                <SelectItem value="vin">VIN</SelectItem>
                                <SelectItem value="hin">HIN</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              className="h-8 text-xs font-mono flex-1"
                              placeholder={unit.type === 'vin' ? '1HGBH41JXMN109186' : unit.type === 'hin' ? 'ABC12345D202' : 'SN-00001'}
                              value={unit.identifier}
                              onChange={e => updateInlineUnit(i, 'identifier', e.target.value)}
                            />
                            <Input
                              className="h-8 text-xs w-36"
                              placeholder="Nickname (optional)"
                              value={unit.label}
                              onChange={e => updateInlineUnit(i, 'label', e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t" />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="brand">Brand</Label>
                    <Input id="brand" name="brand" value={formData.brand} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Input id="model" name="model" value={formData.model} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight</Label>
                    <Input id="weight" name="weight" placeholder="e.g. 5 lbs" value={formData.weight} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dimensions">Dimensions</Label>
                    <Input id="dimensions" name="dimensions" placeholder="L × W × H" value={formData.dimensions} onChange={handleChange} />
                  </div>
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label>Condition</Label>
                    <Select value={formData.condition} onValueChange={(v) => handleSelectChange('condition', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="excellent">Excellent / Like New</SelectItem>
                        <SelectItem value="good">Good / Used</SelectItem>
                        <SelectItem value="fair">Fair / Heavy Wear</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>What's Included</Label>
                  <p className="text-xs text-muted-foreground">List any items that come with the rental (e.g. paddles, carry bag, life jackets).</p>
                  <div className="flex gap-2">
                    <Input
                      value={includedItemInput}
                      onChange={(e) => setIncludedItemInput(e.target.value)}
                      placeholder="e.g. Carry bag, 2 paddles"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIncludedItem())}
                    />
                    <Button type="button" variant="secondary" onClick={addIncludedItem}>Add</Button>
                  </div>
                  {formData.includedItems.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.includedItems.map((item, idx) => (
                        <div key={idx} className="bg-muted px-3 py-1.5 rounded-full text-sm flex items-center gap-2">
                          {item}
                          <button type="button" onClick={() => removeIncludedItem(idx)} className="text-muted-foreground hover:text-foreground">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── STEP 6: Rental Settings ── */}
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <StepBadge n={6} />
                  <div>
                    <CardTitle>Rental Settings</CardTitle>
                    <CardDescription>Requirements, sub-day pricing, time slots, and contact card assignment.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">

                {/* Requirements */}
                <div className="space-y-2">
                  <Label htmlFor="requirements">Renter Requirements</Label>
                  <p className="text-xs text-muted-foreground">
                    Shown to renters on the listing page. The age requirement is always shown automatically — add any extra conditions (e.g. tow vehicle specs, license type).
                  </p>
                  <Textarea
                    id="requirements"
                    name="requirements"
                    placeholder="e.g. Valid driver's license and proof of insurance required. Must have a tow vehicle with a 2-5/16 inch ball hitch."
                    value={formData.requirements}
                    onChange={handleChange}
                    rows={3}
                  />
                </div>

                {/* Sub-Day & Hourly Pricing (collapsible) */}
                <div className="border rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setAdvancedPricingOpen(p => !p)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold">Sub-Day &amp; Hourly Pricing</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formData.halfDayEnabled || formData.hourlyEnabled
                          ? `Enabled: ${[formData.halfDayEnabled && "Half Day", formData.hourlyEnabled && "Hourly"].filter(Boolean).join(", ")}`
                          : "Full Day only (default)"}
                      </p>
                    </div>
                    {advancedPricingOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </button>
                  {advancedPricingOpen && (
                    <div className="px-4 pb-4 pt-1 space-y-4 border-t">
                      {/* Toggles */}
                      <div className="flex flex-wrap gap-5 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <Checkbox checked={true} disabled className="opacity-50" />
                          <span className="text-sm font-medium text-muted-foreground">Full Day (always on)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <Checkbox
                            checked={formData.halfDayEnabled}
                            onCheckedChange={v => setFormData(prev => ({ ...prev, halfDayEnabled: !!v }))}
                          />
                          <span className="text-sm font-medium">Half Day</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <Checkbox
                            checked={formData.hourlyEnabled}
                            onCheckedChange={v => setFormData(prev => ({ ...prev, hourlyEnabled: !!v }))}
                          />
                          <span className="text-sm font-medium">Hourly</span>
                        </label>
                      </div>

                      {/* Full Day — weekend & holiday rates */}
                      <div className="rounded-lg border p-3 space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full Day Rates</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Weekday ($) <span className="text-destructive">*</span></Label>
                            <Input type="number" min="0" step="0.01" value={formData.pricePerDay || ''} onChange={e => setFormData(prev => ({ ...prev, pricePerDay: parseFloat(e.target.value) || 0 }))} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Weekend ($)</Label>
                            <Input type="number" min="0" step="0.01" placeholder="Same as weekday" value={formData.weekendPrice ?? ''} onChange={e => setFormData(prev => ({ ...prev, weekendPrice: e.target.value ? parseFloat(e.target.value) : null }))} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Holiday ($)</Label>
                            <Input type="number" min="0" step="0.01" placeholder="Same as weekday" value={formData.holidayPrice ?? ''} onChange={e => setFormData(prev => ({ ...prev, holidayPrice: e.target.value ? parseFloat(e.target.value) : null }))} />
                          </div>
                        </div>
                      </div>

                      {/* Half Day section */}
                      {formData.halfDayEnabled && (
                        <div className="rounded-lg border p-3 space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Half Day Options</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Duration (hours)</Label>
                              <Input type="number" min="1" step="1" placeholder="4" value={formData.halfDayDurationHours ?? ''} onChange={e => setFormData(prev => ({ ...prev, halfDayDurationHours: e.target.value ? parseInt(e.target.value) : null }))} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Flat Rate ($)</Label>
                              <Input type="number" min="0" step="0.01" placeholder="0.00" value={formData.halfDayRate ?? ''} onChange={e => setFormData(prev => ({ ...prev, halfDayRate: e.target.value ? parseFloat(e.target.value) : null }))} />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Hourly section */}
                      {formData.hourlyEnabled && (
                        <div className="rounded-lg border p-3 space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hourly Options</p>
                          {formData.hourlySlots.length > 0 && (
                            <div className="space-y-1.5">
                              {formData.hourlySlots.map((slot, idx) => (
                                <div key={idx} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                                  <span className="flex-1 text-sm font-medium">{slot.label}</span>
                                  <span className="text-xs text-muted-foreground">{slot.hours} hr{slot.hours !== 1 ? "s" : ""}</span>
                                  <span className="text-xs font-semibold">${slot.price.toFixed(2)}</span>
                                  <button type="button" onClick={() => removeHourlySlot(idx)} className="text-muted-foreground hover:text-destructive transition-colors ml-1">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Input className="flex-1 h-8 text-xs" placeholder="Label (e.g. Morning 4hrs)" value={slotDraft.label} onChange={e => setSlotDraft(prev => ({ ...prev, label: e.target.value }))} />
                            <Input className="w-20 h-8 text-xs" placeholder="Hrs" type="number" min="0.5" step="0.5" value={slotDraft.hours} onChange={e => setSlotDraft(prev => ({ ...prev, hours: e.target.value }))} />
                            <Input className="w-20 h-8 text-xs" placeholder="$" type="number" min="0" step="0.01" value={slotDraft.price} onChange={e => setSlotDraft(prev => ({ ...prev, price: e.target.value }))} />
                            <Button type="button" variant="secondary" size="sm" className="h-8 px-2 shrink-0" onClick={addHourlySlot}><Plus className="w-3.5 h-3.5" /></Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox checked={formData.hourlyPerHourEnabled} onCheckedChange={v => setFormData(prev => ({ ...prev, hourlyPerHourEnabled: !!v }))} />
                            <span className="text-sm font-medium">Also offer per-hour pricing</span>
                          </div>
                          {formData.hourlyPerHourEnabled && (
                            <div className="grid grid-cols-2 gap-3 pt-1">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Price per Hour ($)</Label>
                                <Input type="number" min="0" step="0.01" placeholder="0.00" value={formData.pricePerHour ?? ''} onChange={e => setFormData(prev => ({ ...prev, pricePerHour: e.target.value ? parseFloat(e.target.value) : null }))} />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Minimum Hours</Label>
                                <Input type="number" min="1" step="1" placeholder="1" value={formData.hourlyMinimumHours ?? ''} onChange={e => setFormData(prev => ({ ...prev, hourlyMinimumHours: e.target.value ? parseInt(e.target.value) : null }))} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Available Time Slots (collapsible) */}
                <div className="border rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setTimeSlotsOpen(p => !p)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold">Available Time Slots</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formData.timeSlots.length > 0
                          ? `${formData.timeSlots.length} slot${formData.timeSlots.length !== 1 ? "s" : ""} configured`
                          : "Not configured — renters use the standard time picker"}
                      </p>
                    </div>
                    {timeSlotsOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </button>
                  {timeSlotsOpen && (
                    <div className="px-4 pb-4 pt-1 space-y-3 border-t">
                      <p className="text-xs text-muted-foreground pt-2">Define specific pickup/return windows. When slots are added, renters must select one when booking.</p>
                      {formData.timeSlots.length > 0 && (
                        <div className="space-y-2">
                          {formData.timeSlots.map((slot, idx) => (
                            <div key={idx} className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-2.5 border">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">{slot.label}</p>
                                <p className="text-xs text-muted-foreground">{slot.startTime} – {slot.endTime}</p>
                              </div>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${slot.rate === "half_day" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                                {slot.rate === "half_day" ? "Half Day Rate" : "Full Day Rate"}
                              </span>
                              <button type="button" onClick={() => removeTimeSlot(idx)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="rounded-lg border border-dashed p-3 space-y-3 bg-muted/10">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add a Slot</p>
                        <div className="space-y-1">
                          <Label className="text-xs">Label <span className="text-muted-foreground font-normal">(optional)</span></Label>
                          <Input className="h-8 text-sm" placeholder='e.g. "Morning Slot"' value={tsD.label} onChange={e => setTsD(prev => ({ ...prev, label: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Start Time <span className="text-destructive">*</span></Label>
                            <Select value={tsD.startTime} onValueChange={v => setTsD(prev => ({ ...prev, startTime: v }))}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>{SLOT_TIMES.map(t => <SelectItem key={t} value={t} className="text-sm">{t}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">End / Return <span className="text-destructive">*</span></Label>
                            <Select value={tsD.endTime} onValueChange={v => setTsD(prev => ({ ...prev, endTime: v }))}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>{SLOT_TIMES.map(t => <SelectItem key={t} value={t} className="text-sm">{t}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          {([["full_day", "Full Day Rate"], ["half_day", "Half Day Rate"]] as const).map(([val, lbl]) => (
                            <label key={val} className={`flex items-center gap-2 cursor-pointer border rounded-lg px-3 py-2 text-sm transition-colors ${tsD.rate === val ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted/50"}`}>
                              <input type="radio" name="tsRate" value={val} checked={tsD.rate === val} onChange={() => setTsD(prev => ({ ...prev, rate: val }))} className="accent-primary" />
                              {lbl}
                            </label>
                          ))}
                        </div>
                        {tsD.rate === "half_day" && !formData.halfDayEnabled && (
                          <p className="text-xs text-amber-600 flex items-center gap-1"><Info className="w-3 h-3" /> Enable Half Day Pricing above to use this rate.</p>
                        )}
                        <Button type="button" size="sm" variant="outline" onClick={addTimeSlot} className="w-full gap-1.5">
                          <Plus className="w-3.5 h-3.5" /> Add Time Slot
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Contact Card */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <IdCard className="w-4 h-4 text-primary" />
                    <Label className="text-sm font-semibold">Contact Card</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    When a booking is confirmed, the assigned contact card is automatically emailed to the renter with your pickup address, phone, and instructions.
                  </p>
                  {contactCards.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground text-center">
                      No contact cards yet.{" "}
                      <a href={adminPath("/contact-cards")} className="text-primary underline underline-offset-2">Create one</a>{" "}
                      to auto-send pickup details when bookings are confirmed.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Select
                        value={formData.contactCardId?.toString() ?? "none"}
                        onValueChange={v => setFormData(prev => ({ ...prev, contactCardId: v === "none" ? null : Number(v) }))}
                      >
                        <SelectTrigger><SelectValue placeholder="No contact card assigned" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {contactCards.map(c => (
                            <SelectItem key={c.id} value={c.id.toString()}>
                              {c.name}{c.address ? ` · ${c.address.split(",")[0]}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {formData.contactCardId && (() => {
                        const selected = contactCards.find(c => c.id === formData.contactCardId);
                        if (!selected) return null;
                        return (
                          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1 border">
                            <p className="font-semibold text-foreground">{selected.name}</p>
                            {selected.address && <p className="text-muted-foreground text-xs">{selected.address}</p>}
                            {selected.phone && <p className="text-muted-foreground text-xs">{selected.phone}</p>}
                            {selected.email && <p className="text-muted-foreground text-xs">{selected.email}</p>}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── Publish Checklist ── */}
            {(() => {
              const allDone = publishChecks.every(c => c.done);
              return (
                <Card className={publishBlocked ? "border-destructive/50 bg-destructive/5" : allDone ? "border-green-200 bg-green-50/40" : "border-border"}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {publishBlocked
                        ? <AlertCircle className="w-4 h-4 text-destructive" />
                        : allDone
                          ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                          : <CircleDashed className="w-4 h-4 text-muted-foreground" />}
                      {publishBlocked ? "Complete to Publish" : allDone ? "Ready to Publish" : "Publish Checklist"}
                    </CardTitle>
                    {!allDone && (
                      <CardDescription className="text-xs">
                        {publishBlocked ? "Fill in the missing fields before publishing." : "Complete all items to use Save & Publish."}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {publishChecks.map(c => (
                        <div key={c.key} className="flex items-center gap-2 text-sm">
                          {c.done
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                            : <CircleDashed className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                          <span className={c.done ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
                          {!c.done && formData.status === "active" && (
                            <span className="ml-auto text-[10px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">Required</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* ── Action Buttons ── */}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setLocation(adminPath("/listings"))}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="outline"
                disabled={isPending}
                onClick={() => setPublishIntent(false)}
              >
                {isPending && !publishIntent ? 'Saving...' : (isEditing ? 'Save Changes' : 'Save as Draft')}
              </Button>
              {formData.status !== "active" && (
                <Button
                  type="submit"
                  disabled={isPending || publishBlocked}
                  onClick={() => setPublishIntent(true)}
                >
                  {isPending && publishIntent ? 'Publishing...' : 'Save & Publish'}
                </Button>
              )}
            </div>
      </form>

      {/* Unit identifiers + add-ons — only available after listing is created */}
      {isEditing && id ? (
        <div className="mt-8 space-y-8">
          <UnitIdentifiersManager listingId={id} quantity={formData.quantity} />
          <AddonManager listingId={id} />
        </div>
      ) : (
        <div className="mt-6 p-4 border border-dashed rounded-xl text-sm text-muted-foreground text-center">
          Save the listing first, then you can register unit identifiers (VIN / HIN / serial #) and add optional add-ons.
        </div>
      )}
    </div>
  );
}
