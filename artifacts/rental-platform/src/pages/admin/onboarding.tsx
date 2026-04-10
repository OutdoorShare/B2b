import { adminPath, getAdminSession } from "@/lib/admin-nav";
import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import {
  CheckCircle2, ArrowRight, Package, Palette, Plus,
  Rocket, ChevronRight, Building2, MapPin, Mail, Phone,
  ImagePlus, X, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useGetBusinessProfile } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const STEPS = [
  { id: "branding", label: "Branding", icon: Palette, desc: "Your company name and contact info" },
  { id: "listing", label: "First Listing", icon: Package, desc: "Add your first rental item" },
  { id: "launch", label: "Go Live", icon: Rocket, desc: "Review and open your storefront" },
];

type StepId = "branding" | "listing" | "launch";

const PRESET_CATEGORIES = ["ATV / UTV", "Jet Ski", "Boat", "E-Bike", "Snowmobile", "Camper / RV", "Trailer", "Kayak / Paddleboard", "Other"];

export default function AdminOnboarding() {
  const [, setLocation] = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [step, setStep] = useState<StepId>("branding");
  const [saving, setSaving] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  const [categories, setCategories] = useState<string[]>([]);
  useEffect(() => {
    const token = getAdminSession()?.token;
    fetch(`${BASE}/api/categories`, { headers: token ? { "x-admin-token": token } : {} })
      .then(r => r.ok ? r.json() : [])
      .then((cats: { name: string }[]) => {
        const names = cats.map(c => c.name);
        setCategories(names.length > 0 ? names : PRESET_CATEGORIES);
      })
      .catch(() => setCategories(PRESET_CATEGORIES));
  }, []);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);

  const handlePhotoUpload = async (file: File) => {
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const token = getAdminSession()?.token;
      const res = await fetch(`${BASE}/api/upload/image`, {
        method: "POST",
        body: fd,
        headers: token ? { "x-admin-token": token } : {},
      });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      setPhotos(prev => [...prev, url]);
    } catch {
      toast({ title: "Photo upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setPhotoUploading(false);
    }
  };

  const [branding, setBranding] = useState({
    name: "",
    tagline: "",
    email: "",
    phone: "",
    location: "",
    primaryColor: "#2d6a4f",
    description: "",
  });

  const { data: profile } = useGetBusinessProfile({
    query: { queryKey: ["/api/business", slug] }
  });

  // Pre-fill branding from what was already saved at signup (runs once when profile loads)
  useEffect(() => {
    if (!profile || prefilled) return;
    setBranding(prev => ({
      ...prev,
      name:         (profile.name        ?? prev.name),
      email:        (profile.email       ?? prev.email),
      phone:        ((profile as any).phone       ?? prev.phone),
      location:     ((profile as any).location    ?? prev.location),
      tagline:      ((profile as any).tagline     ?? prev.tagline),
      description:  (profile.description ?? prev.description),
      primaryColor: (profile.primaryColor ?? prev.primaryColor),
    }));
    setPrefilled(true);
  }, [profile, prefilled]);

  const [listing, setListing] = useState({
    title: "",
    description: "",
    pricePerDay: "",
    quantity: "1",
    category: "",
  });

  const setBrand = (k: string, v: string) => setBranding(f => ({ ...f, [k]: v }));
  const setList = (k: string, v: string) => setListing(f => ({ ...f, [k]: v }));

  const saveBranding = async () => {
    if (!branding.name.trim()) { toast({ title: "Company name is required", variant: "destructive" }); return false; }
    setSaving(true);
    const token = getAdminSession()?.token;
    try {
      const res = await fetch(`${BASE}/api/business`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-admin-token": token } : {}),
        },
        body: JSON.stringify({
          name: branding.name.trim(),
          tagline: branding.tagline || undefined,
          email: branding.email || undefined,
          phone: branding.phone || undefined,
          location: branding.location || undefined,
          primaryColor: branding.primaryColor,
          description: branding.description || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Branding saved!" });
      return true;
    } catch {
      toast({ title: "Failed to save branding", variant: "destructive" });
      return false;
    } finally { setSaving(false); }
  };

  const saveListing = async () => {
    if (!listing.title.trim()) { toast({ title: "Item name is required", variant: "destructive" }); return false; }
    if (!listing.pricePerDay || isNaN(parseFloat(listing.pricePerDay))) {
      toast({ title: "Enter a valid daily rate", variant: "destructive" }); return false;
    }
    setSaving(true);
    const token = getAdminSession()?.token;
    try {
      const res = await fetch(`${BASE}/api/listings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-admin-token": token } : {}),
        },
        body: JSON.stringify({
          title: listing.title.trim(),
          description: listing.description || "",
          pricePerDay: parseFloat(listing.pricePerDay),
          quantity: parseInt(listing.quantity) || 1,
          category: listing.category || "General",
          imageUrls: photos,
          status: "active",
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Listing created!" });
      return true;
    } catch {
      toast({ title: "Failed to create listing", variant: "destructive" });
      return false;
    } finally { setSaving(false); }
  };

  const stepIndex = STEPS.findIndex(s => s.id === step);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Package className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">Setup Wizard</span>
          </div>
          <button
            onClick={() => setLocation(adminPath(""))}
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Skip setup →
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Progress steps */}
        <div className="flex items-start gap-4 mb-10">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const active = s.id === step;
            return (
              <div key={s.id} className="flex-1 flex flex-col items-center text-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors ${
                  done ? "bg-primary text-primary-foreground" :
                  active ? "border-2 border-primary bg-primary/10 text-primary" :
                  "border-2 border-gray-200 text-gray-400 bg-white"
                }`}>
                  {done ? <CheckCircle2 className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                </div>
                <p className={`text-xs font-semibold ${active ? "text-primary" : done ? "text-gray-700" : "text-gray-400"}`}>{s.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 hidden sm:block">{s.desc}</p>
                {i < STEPS.length - 1 && (
                  <div className="absolute" style={{ display: "none" }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: Branding */}
        {step === "branding" && (
          <div className="bg-white rounded-2xl border shadow-sm p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Your company branding</h2>
                <p className="text-sm text-muted-foreground">This shows on your customer-facing storefront.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="ob-name">Company Name <span className="text-destructive">*</span></Label>
                  <Input id="ob-name" value={branding.name} onChange={e => setBrand("name", e.target.value)} placeholder="Acme Rentals" className="h-11" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="ob-tagline">Tagline</Label>
                  <Input id="ob-tagline" value={branding.tagline} onChange={e => setBrand("tagline", e.target.value)} placeholder="Your next adventure starts here" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-email" className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Contact Email</Label>
                  <Input id="ob-email" type="email" value={branding.email} onChange={e => setBrand("email", e.target.value)} placeholder="hello@yourcompany.com" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-phone" className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Phone</Label>
                  <Input id="ob-phone" type="tel" value={branding.phone} onChange={e => setBrand("phone", e.target.value)} placeholder="(555) 000-0000" className="h-11" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="ob-location" className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Location</Label>
                  <Input id="ob-location" value={branding.location} onChange={e => setBrand("location", e.target.value)} placeholder="Denver, CO" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-color">Brand Color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      id="ob-color"
                      type="color"
                      value={branding.primaryColor}
                      onChange={e => setBrand("primaryColor", e.target.value)}
                      className="w-11 h-11 rounded-lg border cursor-pointer p-0.5"
                    />
                    <Input
                      value={branding.primaryColor}
                      onChange={e => setBrand("primaryColor", e.target.value)}
                      placeholder="#2d6a4f"
                      className="h-11 font-mono text-sm"
                    />
                  </div>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="ob-desc">Business Description</Label>
                  <Textarea
                    id="ob-desc"
                    value={branding.description}
                    onChange={e => setBrand("description", e.target.value)}
                    placeholder="Tell customers what you offer and what makes you special..."
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <Button
              className="w-full h-11 font-bold gap-2"
              onClick={async () => { if (await saveBranding()) setStep("listing"); }}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save & Continue"} <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Step 2: First Listing */}
        {step === "listing" && (
          <div className="bg-white rounded-2xl border shadow-sm p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Plus className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Add your first listing</h2>
                <p className="text-sm text-muted-foreground">Add a rental item that customers can book on your site.</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Photo upload */}
              <div className="space-y-2">
                <Label>Photos</Label>
                <div className="flex flex-wrap gap-3">
                  {photos.map((url, i) => (
                    <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border bg-gray-100 shrink-0">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={photoUploading}
                    className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-primary hover:text-primary transition-colors shrink-0"
                  >
                    {photoUploading
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <><ImagePlus className="w-5 h-5" /><span className="text-[11px] font-medium">Add photo</span></>
                    }
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ""; }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">JPG, PNG, WebP · up to 10 MB</p>
              </div>

              <div className="space-y-1.5">
                <Label>Item Name <span className="text-destructive">*</span></Label>
                <Input value={listing.title} onChange={e => setList("title", e.target.value)} placeholder='e.g. "2024 Yamaha WaveRunner FX" or "Polaris RZR 900"' className="h-11" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Daily Rate ($) <span className="text-destructive">*</span></Label>
                  <Input type="number" min="0" step="1" value={listing.pricePerDay} onChange={e => setList("pricePerDay", e.target.value)} placeholder="250" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label>Units Available</Label>
                  <Input type="number" min="1" value={listing.quantity} onChange={e => setList("quantity", e.target.value)} placeholder="1" className="h-11" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={listing.category} onValueChange={v => setList("category", v)}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories.length > 0 ? categories : PRESET_CATEGORIES).map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={listing.description} onChange={e => setList("description", e.target.value)} placeholder="Describe the item — model year, included accessories, fuel policy, condition..." rows={3} />
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-11" onClick={() => setStep("branding")}>Back</Button>
              <Button
                className="flex-1 h-11 font-bold gap-2"
                onClick={async () => { if (await saveListing()) setStep("launch"); }}
                disabled={saving}
              >
                {saving ? "Saving…" : "Add Listing & Continue"} <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            <button
              onClick={() => setStep("launch")}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Skip — I'll add listings later
            </button>
          </div>
        )}

        {/* Step 3: Launch */}
        {step === "launch" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border shadow-sm p-8 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <Rocket className="w-10 h-10 text-green-600" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-gray-900">You're ready to launch! 🎉</h2>
                <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                  Your rental site is live. Share it with customers and start taking bookings.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              {[
                {
                  icon: Package, label: "Manage your listings",
                  desc: "Add more items, set pricing, upload photos, and configure add-ons.",
                  action: () => setLocation(adminPath("/listings")),
                  cta: "Go to Listings"
                },
                {
                  icon: Palette, label: "Finish your branding",
                  desc: "Upload a logo, set your cover image, and customize colors in Settings.",
                  action: () => setLocation(adminPath("/settings")),
                  cta: "Open Settings"
                },
                {
                  icon: ChevronRight, label: "Go to your admin dashboard",
                  desc: "View bookings, analytics, and manage your entire operation.",
                  action: () => setLocation(adminPath("")),
                  cta: "Open Dashboard"
                },
              ].map(item => (
                <div key={item.label} className="bg-white border rounded-2xl p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={item.action} className="shrink-0">{item.cta}</Button>
                </div>
              ))}
            </div>

            <Button
              size="lg"
              className="w-full h-13 font-bold gap-2"
              onClick={() => setLocation(adminPath(""))}
            >
              Go to My Dashboard <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
