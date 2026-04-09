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
import { ArrowLeft, Plus, X, Upload, Loader2 } from "lucide-react";
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

  const set = (k: keyof FormState, v: any) => setForm(f => ({ ...f, [k]: v }));

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
