import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { adminPath, getAdminSession } from "@/lib/admin-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, X, Upload, Loader2, Package, Search, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

function adminFetch(path: string, opts?: RequestInit) {
  const session = getAdminSession();
  return fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
}

const CATEGORIES = [
  { value: "adventure", label: "Adventure" },
  { value: "water-sport", label: "Water Sport" },
  { value: "guided-tour", label: "Guided Tour" },
  { value: "lesson", label: "Lesson" },
  { value: "wildlife-tour", label: "Wildlife Tour" },
  { value: "off-road", label: "Off-Road" },
  { value: "camping", label: "Camping" },
  { value: "climbing", label: "Climbing" },
  { value: "snow-sport", label: "Snow Sport" },
  { value: "fishing", label: "Fishing" },
  { value: "other", label: "Other" },
];

type FormState = {
  title: string;
  description: string;
  category: string;
  pricePerPerson: string;
  durationMinutes: string;
  maxCapacity: string;
  location: string;
  imageUrls: string[];
  highlights: string[];
  whatToBring: string;
  minAge: string;
  isActive: boolean;
  listingId: number | null;
  requiresRental: boolean;
};

type ListingOption = {
  id: number;
  title: string;
  pricePerDay: number;
  imageUrls: string[];
  description: string;
};

const DEFAULTS: FormState = {
  title: "",
  description: "",
  category: "adventure",
  pricePerPerson: "",
  durationMinutes: "60",
  maxCapacity: "10",
  location: "",
  imageUrls: [],
  highlights: [],
  whatToBring: "",
  minAge: "",
  isActive: true,
  listingId: null,
  requiresRental: false,
};

export default function ActivityForm() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newHighlight, setNewHighlight] = useState("");
  const [listings, setListings] = useState<ListingOption[]>([]);
  const [listingSearch, setListingSearch] = useState("");
  const [showListingPicker, setShowListingPicker] = useState(false);

  const set = (k: keyof FormState, v: any) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    adminFetch("/listings?limit=200")
      .then(r => r.ok ? r.json() : [])
      .then(d => setListings(Array.isArray(d) ? d.filter((l: any) => l.status === "active") : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    adminFetch(`/activities/${id}`)
      .then(r => r.json())
      .then(d => {
        setForm({
          title: d.title ?? "",
          description: d.description ?? "",
          category: d.category ?? "adventure",
          pricePerPerson: d.pricePerPerson?.toString() ?? "",
          durationMinutes: d.durationMinutes?.toString() ?? "60",
          maxCapacity: d.maxCapacity?.toString() ?? "10",
          location: d.location ?? "",
          imageUrls: d.imageUrls ?? [],
          highlights: d.highlights ?? [],
          whatToBring: d.whatToBring ?? "",
          minAge: d.minAge?.toString() ?? "",
          isActive: d.isActive ?? true,
          listingId: d.listingId ?? null,
          requiresRental: d.requiresRental ?? false,
        });
      })
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const session = getAdminSession();
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`${BASE}/api/upload/image`, {
        method: "POST",
        headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      set("imageUrls", [...form.imageUrls, url]);
    } catch {
      toast({ title: "Image upload failed", variant: "destructive" });
    } finally { setUploading(false); e.target.value = ""; }
  }

  function addHighlight() {
    const h = newHighlight.trim();
    if (!h) return;
    set("highlights", [...form.highlights, h]);
    setNewHighlight("");
  }

  async function save() {
    if (!form.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const body = {
        ...form,
        pricePerPerson: parseFloat(form.pricePerPerson) || 0,
        durationMinutes: parseInt(form.durationMinutes) || 60,
        maxCapacity: parseInt(form.maxCapacity) || 10,
        minAge: form.minAge ? parseInt(form.minAge) : null,
      };
      const res = await adminFetch(isEdit ? `/activities/${id}` : "/activities", {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        toast({ title: d.error ?? "Save failed", variant: "destructive" });
        return;
      }
      toast({ title: isEdit ? "Activity updated" : "Activity created" });
      navigate(adminPath("/activities"));
    } finally { setSaving(false); }
  }

  if (loading) {
    return <div className="py-16 text-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href={adminPath("/activities")}>
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold">{isEdit ? "Edit Activity" : "New Activity"}</h2>
          <p className="text-sm text-muted-foreground">
            {isEdit ? "Update this experience listing" : "Create a guided experience or tour for customers"}
          </p>
        </div>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Basic Info</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Activity Title <span className="text-red-500">*</span></Label>
            <Input
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="e.g. Sunset Kayak Tour"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <div className="flex items-center gap-3 h-10">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={v => set("isActive", v)}
                  className="data-[state=checked]:bg-green-600"
                />
                <span className="text-sm text-muted-foreground">
                  {form.isActive ? "Active — visible on marketplace" : "Hidden from marketplace"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="Describe what customers will experience…"
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input
              value={form.location}
              onChange={e => set("location", e.target.value)}
              placeholder="e.g. Lake Tahoe, CA or Meeting point address"
            />
          </div>
        </CardContent>
      </Card>

      {/* Pricing & Logistics */}
      <Card>
        <CardHeader><CardTitle className="text-base">Pricing & Logistics</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Price per Person ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.pricePerPerson}
                onChange={e => set("pricePerPerson", e.target.value)}
                placeholder="75.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (minutes)</Label>
              <Input
                type="number"
                min="15"
                step="15"
                value={form.durationMinutes}
                onChange={e => set("durationMinutes", e.target.value)}
                placeholder="60"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max Capacity</Label>
              <Input
                type="number"
                min="1"
                value={form.maxCapacity}
                onChange={e => set("maxCapacity", e.target.value)}
                placeholder="10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Minimum Age <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              type="number"
              min="1"
              value={form.minAge}
              onChange={e => set("minAge", e.target.value)}
              placeholder="No minimum"
              className="w-32"
            />
          </div>
        </CardContent>
      </Card>

      {/* Highlights */}
      <Card>
        <CardHeader><CardTitle className="text-base">Highlights</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Bullet points shown on the marketplace — what makes this experience special?</p>
          <div className="space-y-2">
            {form.highlights.map((h, i) => (
              <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <span className="text-sm flex-1">{h}</span>
                <button onClick={() => set("highlights", form.highlights.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-500 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newHighlight}
              onChange={e => setNewHighlight(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addHighlight(); } }}
              placeholder="e.g. Professional certified guides"
            />
            <Button type="button" variant="outline" onClick={addHighlight}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* What to Bring */}
      <Card>
        <CardHeader><CardTitle className="text-base">What to Bring</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            value={form.whatToBring}
            onChange={e => set("whatToBring", e.target.value)}
            placeholder="e.g. Sunscreen, water bottle, comfortable shoes…"
            rows={2}
            className="resize-none"
          />
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardHeader><CardTitle className="text-base">Photos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {form.imageUrls.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {form.imageUrls.map((url, i) => (
                <div key={i} className="relative group aspect-video rounded-lg overflow-hidden">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => set("imageUrls", form.imageUrls.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer w-fit">
            <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
              <span>
                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {uploading ? "Uploading…" : "Upload Photo"}
              </span>
            </Button>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
        </CardContent>
      </Card>

      {/* Linked Rental */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Linked Rental</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Attach a rental listing so customers book equipment and the activity together.
              </p>
            </div>
            <Switch
              checked={!!form.listingId || showListingPicker}
              onCheckedChange={v => {
                if (!v) { set("listingId", null); set("requiresRental", false); setShowListingPicker(false); setListingSearch(""); }
                else setShowListingPicker(true);
              }}
              className="data-[state=checked]:bg-green-600"
            />
          </div>
        </CardHeader>

        {(form.listingId || showListingPicker) && (
          <CardContent className="space-y-4">
            {/* Selected listing preview */}
            {form.listingId && (() => {
              const sel = listings.find(l => l.id === form.listingId);
              if (!sel) return null;
              return (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-green-50/50 border-green-100">
                  {sel.imageUrls?.[0] ? (
                    <img src={sel.imageUrls[0]} alt={sel.title} className="w-14 h-14 rounded-md object-cover shrink-0 border" />
                  ) : (
                    <div className="w-14 h-14 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                      <Package className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{sel.title}</p>
                    <p className="text-xs text-muted-foreground">${sel.pricePerDay}/day rental</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <button
                      type="button"
                      onClick={() => { set("listingId", null); setListingSearch(""); }}
                      className="text-muted-foreground hover:text-red-500 transition-colors ml-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Listing search picker */}
            {!form.listingId && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search your listings…"
                    value={listingSearch}
                    onChange={e => setListingSearch(e.target.value)}
                  />
                </div>
                <div className="rounded-lg border divide-y max-h-52 overflow-y-auto">
                  {listings
                    .filter(l => l.title.toLowerCase().includes(listingSearch.toLowerCase()))
                    .slice(0, 20)
                    .map(l => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => { set("listingId", l.id); setShowListingPicker(false); }}
                        className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
                      >
                        {l.imageUrls?.[0] ? (
                          <img src={l.imageUrls[0]} alt={l.title} className="w-10 h-10 rounded object-cover shrink-0 border" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{l.title}</p>
                          <p className="text-xs text-muted-foreground">${l.pricePerDay}/day</p>
                        </div>
                      </button>
                    ))}
                  {listings.filter(l => l.title.toLowerCase().includes(listingSearch.toLowerCase())).length === 0 && (
                    <p className="text-sm text-muted-foreground p-4 text-center">No active listings found</p>
                  )}
                </div>
              </div>
            )}

            {/* Requires rental toggle */}
            {form.listingId && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border">
                <div>
                  <p className="text-sm font-medium">Rental is required</p>
                  <p className="text-xs text-muted-foreground">If off, customers can book the activity without renting this equipment.</p>
                </div>
                <Switch
                  checked={form.requiresRental}
                  onCheckedChange={v => set("requiresRental", v)}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            )}

            {form.listingId && (() => {
              const sel = listings.find(l => l.id === form.listingId);
              const actPrice = parseFloat(form.pricePerPerson) || 0;
              const rentalPrice = sel?.pricePerDay || 0;
              if (!sel) return null;
              return (
                <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                  <p className="text-xs font-semibold text-blue-800 mb-1.5">Combined pricing</p>
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <span>${actPrice.toFixed(2)} activity fee</span>
                    <span className="text-blue-400">+</span>
                    <span>${rentalPrice.toFixed(2)}/day rental</span>
                    <span className="text-blue-400">=</span>
                    <span className="font-bold">${(actPrice + rentalPrice).toFixed(2)} total</span>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        )}
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={save} disabled={saving} style={{ backgroundColor: "#3ab549" }} className="text-white">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Activity"}
        </Button>
        <Link href={adminPath("/activities")}>
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>
    </div>
  );
}
