import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import {
  useGetBusinessProfile,
  getGetBusinessProfileQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Copy, CheckCircle2, Paintbrush, RefreshCw, Upload, Eye, EyeOff, ImageIcon, X, KeyRound } from "lucide-react";
import { applyBrandColors, PRESET_THEMES, isLight } from "@/lib/theme";

function slugifyPreview(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

export default function AdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const { slug: urlSlug } = useParams<{ slug: string }>();

  // Kiosk exit PIN — stored in localStorage, never sent to server
  const pinKey = `kiosk_exit_pin_${urlSlug}`;
  const [kioskPin, setKioskPin] = useState(() => localStorage.getItem(`kiosk_exit_pin_${urlSlug}`) || "1234");
  const [showPin, setShowPin] = useState(false);
  const [pinSaved, setPinSaved] = useState(false);

  function saveKioskPin() {
    const clean = kioskPin.replace(/\D/g, "").slice(0, 8);
    if (clean.length < 4) {
      toast({ title: "PIN too short", description: "Your exit code must be at least 4 digits.", variant: "destructive" });
      return;
    }
    localStorage.setItem(pinKey, clean);
    setKioskPin(clean);
    setPinSaved(true);
    setTimeout(() => setPinSaved(false), 2000);
    toast({ title: "Kiosk exit code saved", description: `Code set to ${clean.replace(/./g, "●")}` });
  }

  // Use the slug-scoped query key so this cache entry is shared with the
  // storefront layout (which also uses ["/api/business", slug]). This ensures
  // that when the admin saves settings, the storefront immediately reflects
  // the new logo and colors without a stale-cache lag.
  const { data: profile, isLoading } = useGetBusinessProfile({
    query: { queryKey: ["/api/business", urlSlug] }
  });

  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (profile) setFormData(profile);
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value
    }));
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData((prev: any) => ({ ...prev, [name]: checked }));
  };

  // ── Color helpers ────────────────────────────────────────────────────
  const handleColorChange = (name: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [name]: value }));
    // Live preview
    if (name === "primaryColor") applyBrandColors(value, formData.accentColor);
    if (name === "accentColor")  applyBrandColors(formData.primaryColor, value);
  };

  const applyPreset = (preset: typeof PRESET_THEMES[0]) => {
    setFormData((prev: any) => ({
      ...prev,
      primaryColor: preset.primary,
      accentColor:  preset.accent
    }));
    applyBrandColors(preset.primary, preset.accent);
  };

  const doSave = async (retrying = false) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/business`, {
        method: "PUT",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.status === 401) {
        redirectToLogin("Your session has expired. Redirecting you to log in…");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          res.status === 403 ? "You don't have permission to save settings." :
          res.status >= 500 ? "Server error — please try again." :
          (data as any)?.error || "Could not save settings.";
        toast({ title: "Save failed", description: msg, variant: "destructive" });
        return;
      }
      const data = await res.json();
      queryClient.setQueryData(["/api/business", urlSlug], data);
      queryClient.setQueryData(getGetBusinessProfileQueryKey(), data);
      applyBrandColors(data.primaryColor, data.accentColor);
      toast({ title: "Settings saved" });
    } catch {
      if (!retrying) {
        toast({ title: "Saving…", description: "Connection blip — retrying in a moment." });
        setTimeout(() => doSave(true), 1500);
      } else {
        toast({ title: "Save failed", description: "Connection error — please try again.", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    doSave();
  };

  const getStorefrontUrl = () => {
    // Most reliable source: extract slug directly from the current pathname.
    // Admin URLs are always /<slug>/admin/... so the first path segment IS the slug.
    const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
    const stripped = window.location.pathname.replace(base, "").replace(/^\/+/, "");
    const slugFromPath = stripped.split("/")[0] ?? "";
    const slug = slugFromPath || urlSlug || (profile as any)?.siteSlug || "";
    return slug ? `${window.location.origin}${base}/${slug}` : window.location.origin;
  };

  const getEmbedCode = () => {
    const src = getStorefrontUrl();
    return `<iframe\n  src="${src}"\n  style="width:100%;height:800px;border:none;"\n  allow="payment"\n  title="Book your rental"\n  loading="lazy"\n></iframe>`;
  };

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(getEmbedCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Embed code copied to clipboard" });
  };

  const logoFileRef  = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const [logoUploading,  setLogoUploading]  = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  // ── Stripe Connect state ──────────────────────────────────────────────────
  const [connectStatus, setConnectStatus] = useState<{ connected: boolean; chargesEnabled: boolean; payoutsEnabled: boolean; email?: string } | null>(null);
  const [onboardLoading, setOnboardLoading] = useState(false);

  const adminHeaders = (): HeadersInit => {
    try {
      const raw = localStorage.getItem("admin_session");
      if (raw) {
        const s = JSON.parse(raw);
        if (s?.token) return { "x-admin-token": s.token };
      }
    } catch { /* ignore */ }
    return {};
  };

  const hasAdminToken = (): boolean => {
    try {
      const raw = localStorage.getItem("admin_session");
      if (!raw) return false;
      const s = JSON.parse(raw);
      return !!s?.token;
    } catch { return false; }
  };

  const redirectToLogin = (reason: string) => {
    localStorage.removeItem("admin_session");
    toast({ title: "Session expired", description: reason, variant: "destructive" });
    const slug = urlSlug || "";
    setTimeout(() => {
      window.location.href = `${BASE}/${slug}/admin`;
    }, 1200);
  };

  useEffect(() => {
    fetch(`${BASE}/api/stripe/connect/status`, { headers: adminHeaders() })
      .then(r => r.ok ? r.json() : { connected: false })
      .then(d => setConnectStatus(d))
      .catch(() => setConnectStatus({ connected: false, chargesEnabled: false, payoutsEnabled: false }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [BASE]);

  const handleConnectOnboard = async () => {
    if (!hasAdminToken()) {
      redirectToLogin("No active session found. Please log in to connect Stripe.");
      return;
    }
    setOnboardLoading(true);
    try {
      const res = await fetch(`${BASE}/api/stripe/connect/onboard`, { method: "POST", headers: adminHeaders() });
      const data = await res.json();
      if (res.status === 401) {
        redirectToLogin("Your session has expired. Redirecting you to log in…");
        return;
      }
      if (res.status === 403) {
        toast({ title: "Permission denied", description: "Your account doesn't have permission to manage Stripe.", variant: "destructive" });
        return;
      }
      if (data.url) { window.location.href = data.url; }
      else {
        const msg = data.error || "Could not start Stripe onboarding";
        toast({ title: "Stripe setup failed", description: msg.length > 120 ? msg.slice(0, 120) + "…" : msg, variant: "destructive" });
      }
    } catch {
      toast({ title: "Connection error", description: "Could not reach the server. Please check your internet connection and try again.", variant: "destructive" });
    } finally {
      setOnboardLoading(false);
    }
  };

  if (isLoading) return <div className="p-8">Loading settings...</div>;

  const primary = formData.primaryColor || "#1b4332";
  const accent  = formData.accentColor  || "#52b788";
  const logoUrl = formData.logoUrl || "";
  const coverUrl = formData.coverImageUrl || "";

  const uploadImageFile = async (
    file: File,
    setUploading: (v: boolean) => void,
    field: string
  ) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${BASE}/api/upload/image`, { method: "POST", body: fd });
      if (!res.ok) { toast({ title: "Upload failed", variant: "destructive" }); return; }
      const data = await res.json();
      setFormData((prev: any) => ({ ...prev, [field]: data.url }));
    } catch {
      toast({ title: "Upload error", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Manage your business profile and preferences</p>
      </div>

      <Tabs defaultValue={new URLSearchParams(window.location.search).get("tab") ?? "branding"} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="integration">Integration</TabsTrigger>
        </TabsList>

        <form onSubmit={handleSave}>

          {/* ── GENERAL ── */}
          <TabsContent value="general" className="space-y-6 pt-6">
            {/* Storefront URL banner */}
            {(() => {
              const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
              const stripped = window.location.pathname.replace(base, "").replace(/^\/+/, "");
              const slug = stripped.split("/")[0] || urlSlug || (profile as any)?.siteSlug || "";
              const liveSlug = slugifyPreview(formData.name || "");
              const currentUrl = slug ? `${window.location.origin}${base}/${slug}` : "";
              const previewUrl = liveSlug ? `${window.location.origin}${base}/${liveSlug}` : "";
              const willChange = slug && liveSlug && liveSlug !== slug;
              return (
                <div className="rounded-xl border bg-primary/5 border-primary/20 px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide">Your Storefront URL</p>
                    <p className="text-sm font-mono font-semibold text-foreground truncate">{currentUrl || "—"}</p>
                    {willChange && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Will become <span className="font-mono font-medium text-foreground">{previewUrl}</span> when you save
                      </p>
                    )}
                    {!willChange && (
                      <p className="text-xs text-muted-foreground">Updates automatically when you change your Business Name.</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button type="button" size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(currentUrl); toast({ title: "Copied!" }); }}>
                      <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => window.open(currentUrl, "_blank")}>
                      <Eye className="w-3.5 h-3.5 mr-1.5" /> Preview
                    </Button>
                  </div>
                </div>
              );
            })()}

            <Card>
              <CardHeader>
                <CardTitle>Business Details</CardTitle>
                <CardDescription>Your public business information.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Business Name</Label>
                    <Input id="name" name="name" value={formData.name || ""} onChange={handleChange} required />
                    <p className="text-xs text-muted-foreground">This also sets your storefront URL.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tagline">Tagline</Label>
                    <Input id="tagline" name="tagline" value={formData.tagline || ""} onChange={handleChange} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" value={formData.description || ""} onChange={handleChange} rows={4} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Public Email</Label>
                    <Input id="email" name="email" type="email" value={formData.email || ""} onChange={handleChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Public Phone</Label>
                    <Input id="phone" name="phone" value={formData.phone || ""} onChange={handleChange} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="outboundEmail">Outbound Email (Reply-To)</Label>
                  <Input id="outboundEmail" name="outboundEmail" type="email" value={formData.outboundEmail || ""} onChange={handleChange} placeholder="e.g. rentals@yourcompany.com" />
                  <p className="text-xs text-muted-foreground">All emails sent to renters will have this as the reply-to address. Leave blank to use your Public Email.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Primary Location</Label>
                  <Input id="location" name="location" value={formData.location || ""} onChange={handleChange} required />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── BRANDING ── */}
          <TabsContent value="branding" className="space-y-6 pt-6">

            {/* Live Preview */}
            <Card className="overflow-hidden border-2" style={{ borderColor: primary }}>
              <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: primary }}>
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo preview" className="h-9 object-contain rounded" onError={e => (e.currentTarget.style.display = "none")} />
                  ) : (
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg font-black" style={{ backgroundColor: accent, color: isLight(accent) ? "#111" : "#fff" }}>
                      {(formData.name || "B").charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-base leading-none" style={{ color: isLight(primary) ? "#111" : "#fff" }}>
                      {formData.name || "Your Business"}
                    </p>
                    <p className="text-xs mt-0.5 opacity-70" style={{ color: isLight(primary) ? "#111" : "#fff" }}>
                      {formData.tagline || "Your tagline here"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium opacity-70 mr-1" style={{ color: isLight(primary) ? "#111" : "#fff" }}>Listings</span>
                  <button
                    type="button"
                    className="px-4 py-1.5 rounded-full text-sm font-semibold"
                    style={{ backgroundColor: accent, color: isLight(accent) ? "#111" : "#fff" }}
                  >
                    Book Now
                  </button>
                </div>
              </div>
              <CardContent className="p-4 bg-muted/20">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-medium">Live preview — updates as you edit</span>
                </div>
                <div className="flex gap-3">
                  <button type="button" className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: primary }}>
                    Primary button
                  </button>
                  <button type="button" className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: accent, color: isLight(accent) ? "#111" : "#fff" }}>
                    Accent button
                  </button>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: primary }} />
                    <span className="text-xs text-muted-foreground">{primary}</span>
                    <div className="w-4 h-4 rounded-full ml-2" style={{ backgroundColor: accent }} />
                    <span className="text-xs text-muted-foreground">{accent}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Logo */}
            <Card>
              <CardHeader>
                <CardTitle>Logo</CardTitle>
                <CardDescription>Your logo appears in the storefront header, kiosk, and emails.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Logo upload */}
                <div className="flex items-start gap-6">
                  <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted shrink-0 overflow-hidden">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-2" onError={e => (e.currentTarget.style.display = "none")} />
                    ) : (
                      <div className="text-center">
                        <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center text-xl font-black text-white mb-1" style={{ backgroundColor: primary }}>
                          {(formData.name || "B").charAt(0)}
                        </div>
                        <p className="text-[10px] text-muted-foreground">No logo</p>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label>Logo</Label>
                    <input
                      ref={logoFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadImageFile(f, setLogoUploading, "logoUrl"); }}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={logoUploading}
                        onClick={() => logoFileRef.current?.click()}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {logoUploading ? "Uploading…" : logoUrl ? "Replace Logo" : "Upload Logo"}
                      </Button>
                      {logoUrl && (
                        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => handleColorChange("logoUrl", "")}>
                          <X className="w-3.5 h-3.5" /> Remove
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">PNG, SVG, JPG or WebP · max 5 MB</p>
                  </div>
                </div>

                {/* Cover / Hero image upload */}
                <div className="space-y-2 pt-2">
                  <Label>Cover / Hero Image</Label>
                  <p className="text-xs text-muted-foreground">Displayed as the full-width background behind your storefront search bar. Recommended: 1440 × 600 px.</p>
                  <input
                    ref={coverFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadImageFile(f, setCoverUploading, "coverImageUrl"); }}
                  />
                  {coverUrl ? (
                    <div className="relative rounded-xl overflow-hidden border group">
                      <img src={coverUrl} alt="Cover" className="w-full h-36 object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="gap-2"
                          disabled={coverUploading}
                          onClick={() => coverFileRef.current?.click()}
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {coverUploading ? "Uploading…" : "Replace"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="gap-2"
                          onClick={() => setFormData((prev: any) => ({ ...prev, coverImageUrl: "" }))}
                        >
                          <X className="w-3.5 h-3.5" /> Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => coverFileRef.current?.click()}
                      disabled={coverUploading}
                      className="w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-gray-400 hover:text-gray-600 transition-colors bg-gray-50 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <ImageIcon className="w-6 h-6" />
                      <span className="text-sm font-medium">{coverUploading ? "Uploading…" : "Upload cover photo"}</span>
                      <span className="text-xs">PNG, JPG or WebP · max 5 MB</span>
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Colors */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Paintbrush className="w-4 h-4" /> Brand Colors</CardTitle>
                    <CardDescription className="mt-1">These colors are applied across the entire storefront in real time.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">

                {/* Color pickers */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label>Primary Color</Label>
                    <p className="text-xs text-muted-foreground -mt-1">Used for buttons, links, nav bar background, and key UI elements.</p>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <input
                          type="color"
                          value={primary}
                          onChange={e => handleColorChange("primaryColor", e.target.value)}
                          className="w-14 h-14 rounded-xl border-2 border-border cursor-pointer"
                          style={{ padding: "2px" }}
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          name="primaryColor"
                          value={formData.primaryColor || ""}
                          onChange={e => handleColorChange("primaryColor", e.target.value)}
                          placeholder="#1b4332"
                          className="font-mono"
                          maxLength={7}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Hex code e.g. #1b4332</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Accent Color</Label>
                    <p className="text-xs text-muted-foreground -mt-1">Used for highlights, badges, and secondary interactive elements.</p>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <input
                          type="color"
                          value={accent}
                          onChange={e => handleColorChange("accentColor", e.target.value)}
                          className="w-14 h-14 rounded-xl border-2 border-border cursor-pointer"
                          style={{ padding: "2px" }}
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          name="accentColor"
                          value={formData.accentColor || ""}
                          onChange={e => handleColorChange("accentColor", e.target.value)}
                          placeholder="#52b788"
                          className="font-mono"
                          maxLength={7}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Hex code e.g. #52b788</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preset themes */}
                <div className="space-y-3">
                  <Label>Quick Presets</Label>
                  <p className="text-xs text-muted-foreground">Click a preset to instantly apply it — you can still fine-tune the colors above.</p>
                  <div className="grid grid-cols-4 gap-3">
                    {PRESET_THEMES.map(preset => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="group relative rounded-xl overflow-hidden border-2 border-transparent hover:border-foreground/30 transition-all focus:outline-none focus:ring-2 focus:ring-ring"
                        title={preset.name}
                      >
                        <div className="h-10 flex" style={{ backgroundColor: preset.primary }}>
                          <div className="w-1/3 h-full" style={{ backgroundColor: preset.accent }} />
                        </div>
                        <div className="px-2 py-1.5 bg-card text-left">
                          <p className="text-xs font-medium truncate">{preset.name}</p>
                        </div>
                        {formData.primaryColor === preset.primary && (
                          <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow">
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Kiosk */}
            <Card>
              <CardHeader>
                <CardTitle>Kiosk Mode</CardTitle>
                <CardDescription>Configure the self-service kiosk for in-store tablets.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between border rounded-lg p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable Kiosk Mode</Label>
                    <p className="text-sm text-muted-foreground">Simplified fullscreen view customers can browse without admin access.</p>
                  </div>
                  <Switch
                    checked={formData.kioskModeEnabled || false}
                    onCheckedChange={checked => handleSwitchChange("kioskModeEnabled", checked)}
                  />
                </div>

                {/* Exit PIN */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-primary" />
                    <Label className="text-base">Kiosk Exit Code</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Customers must enter this code to leave kiosk mode. Keep this private — only share with staff.
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-[200px]">
                      <Input
                        type={showPin ? "text" : "password"}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={8}
                        value={kioskPin}
                        onChange={e => setKioskPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                        className="pr-10 font-mono text-lg tracking-widest"
                        placeholder="1234"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant={pinSaved ? "outline" : "secondary"}
                      onClick={saveKioskPin}
                      className="shrink-0"
                    >
                      {pinSaved ? <><CheckCircle2 className="w-4 h-4 mr-1.5 text-green-600" />Saved</> : "Save Code"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">4–8 digits. Default is <span className="font-mono font-semibold">1234</span> — change it before going live.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── POLICIES ── */}
          <TabsContent value="policies" className="space-y-6 pt-6">
            <Card>
              <CardHeader>
                <CardTitle>Rental Policies</CardTitle>
                <CardDescription>Rules and terms for your customers.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between border rounded-lg p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Instant Booking</Label>
                    <p className="text-sm text-muted-foreground">
                      When on, new bookings are automatically confirmed. When off, each booking requires your manual approval.
                    </p>
                  </div>
                  <Switch
                    checked={formData.instantBooking || false}
                    onCheckedChange={checked => handleSwitchChange("instantBooking", checked)}
                  />
                </div>
                <div className="flex items-center justify-between border rounded-lg p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Require Security Deposit</Label>
                    <p className="text-sm text-muted-foreground">Hold a deposit on customer cards during rentals.</p>
                  </div>
                  <Switch
                    checked={formData.depositRequired || false}
                    onCheckedChange={checked => handleSwitchChange("depositRequired", checked)}
                  />
                </div>
                {formData.depositRequired && (
                  <div className="space-y-2">
                    <Label htmlFor="depositPercent">Deposit Percentage (%)</Label>
                    <Input id="depositPercent" name="depositPercent" type="number" value={formData.depositPercent || 0} onChange={handleChange} min="0" max="100" />
                  </div>
                )}
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="cancellationPolicy">Cancellation Policy</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      This text is shown to renters on the booking page before they sign and also read by your AI assistant so it can answer cancellation questions accurately.
                    </p>
                  </div>
                  <Textarea
                    id="cancellationPolicy"
                    name="cancellationPolicy"
                    value={formData.cancellationPolicy || ""}
                    onChange={handleChange}
                    rows={5}
                    placeholder="Example: Full refund if cancelled more than 48 hours before the rental start date. Cancellations within 48 hours are non-refundable. No-shows forfeit the full amount."
                  />
                  {formData.cancellationPolicy && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
                        <span>👁</span> Renter preview — shown on booking page
                      </p>
                      <p className="text-sm text-amber-900 dark:text-amber-200 whitespace-pre-wrap leading-relaxed">
                        {formData.cancellationPolicy}
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rentalTerms">Rental Terms & Conditions</Label>
                  <p className="text-xs text-muted-foreground">Full terms shown in the rental agreement. Also available to your AI assistant for answering detailed renter questions.</p>
                  <Textarea id="rentalTerms" name="rentalTerms" value={formData.rentalTerms || ""} onChange={handleChange} rows={6} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── PAYMENTS ── */}
          <TabsContent value="payments" className="space-y-6 pt-6">
            <Card>
              <CardHeader>
                <CardTitle>Stripe Connect — Receive Payouts</CardTitle>
                <CardDescription>
                  Connect your Stripe account so customers can pay you directly. We collect a small platform fee on each transaction.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {!connectStatus ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Checking connection status…
                  </div>
                ) : connectStatus.connected && connectStatus.chargesEnabled ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold text-green-800">Stripe Connected</p>
                        {connectStatus.email && <p className="text-sm text-green-700">{connectStatus.email}</p>}
                        <div className="flex gap-3 mt-2 text-xs text-green-700">
                          <span>Charges: {connectStatus.chargesEnabled ? "✓ Enabled" : "✗ Disabled"}</span>
                          <span>Payouts: {connectStatus.payoutsEnabled ? "✓ Enabled" : "✗ Disabled"}</span>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleConnectOnboard} disabled={onboardLoading}>
                      {onboardLoading ? <><RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />Loading…</> : "Update Stripe Account"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <Upload className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold text-amber-800">Stripe account not connected</p>
                        <p className="text-sm text-amber-700 mt-1">
                          Connect your Stripe account to start accepting payments from renters. You'll be redirected to Stripe to complete setup.
                        </p>
                      </div>
                    </div>
                    <Button onClick={handleConnectOnboard} disabled={onboardLoading} className="gap-2">
                      {onboardLoading ? <><RefreshCw className="w-4 h-4 animate-spin" />Redirecting…</> : "Connect with Stripe"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      You'll be redirected to Stripe to securely set up your payout account. This is required before you can accept bookings.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            {/* Bundle Discount */}
            <Card>
              <CardHeader>
                <CardTitle>Bundle Discount</CardTitle>
                <CardDescription>
                  Offer a percentage discount when renters add multiple items to their order.
                  Set to 0 to disable bundle discounts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bundleDiscountPercent">Bundle Discount (%)</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="bundleDiscountPercent"
                      name="bundleDiscountPercent"
                      type="number"
                      min="0"
                      max="50"
                      step="1"
                      value={formData.bundleDiscountPercent ?? 0}
                      onChange={handleChange}
                      className="max-w-[120px]"
                    />
                    <span className="text-sm text-muted-foreground">
                      {formData.bundleDiscountPercent > 0
                        ? `${formData.bundleDiscountPercent}% off when renter bundles multiple items`
                        : "No bundle discount currently active"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Applied to the entire order (primary item + bundle items) when the renter adds extra gear.
                  </p>
                </div>
                <Button onClick={doSave} disabled={saving} size="sm">
                  {saving ? <><RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />Saving…</> : "Save Bundle Settings"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── INTEGRATION ── */}
          <TabsContent value="integration" className="space-y-6 pt-6">
            {/* Booking Link */}
            <Card>
              <CardHeader>
                <CardTitle>Your Booking Site Link</CardTitle>
                <CardDescription>Share this with customers so they can browse and book your rentals.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 p-4 rounded-xl bg-muted border">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">Customer booking link</p>
                    <p className="text-sm font-mono font-semibold text-foreground truncate">{getStorefrontUrl()}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        navigator.clipboard.writeText(getStorefrontUrl());
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                        toast({ title: "Link copied!" });
                      }}
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Copied!" : "Copy"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => window.open(getStorefrontUrl(), "_blank")}
                    >
                      <Eye className="w-4 h-4" /> Preview
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Send this link to your customers. They'll see your branded storefront where they can browse gear and make bookings.
                </p>
              </CardContent>
            </Card>

            {/* Embed Code */}
            <Card>
              <CardHeader>
                <CardTitle>Embed on Your Website</CardTitle>
                <CardDescription>
                  Paste this snippet into any page on your website to embed the full booking experience inline.
                  Includes <code className="text-xs bg-muted px-1 py-0.5 rounded">allow="payment"</code> so Stripe works inside the frame.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <pre className="p-4 rounded-md bg-slate-950 text-slate-100 text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed">
                    {getEmbedCode()}
                  </pre>
                  <Button type="button" size="icon" variant="secondary" className="absolute top-2 right-2" onClick={copyEmbedCode}>
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>

                {/* Live preview */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Live Preview</p>
                  <div className="rounded-xl border overflow-hidden bg-muted" style={{ height: 480 }}>
                    <iframe
                      src={getStorefrontUrl()}
                      style={{ width: "100%", height: "100%", border: "none" }}
                      allow="payment"
                      title="Storefront preview"
                      loading="lazy"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">This is exactly what your customers will see when the embed is placed on your site.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <div className="mt-8 flex justify-end">
            <Button type="submit" size="lg" disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </Tabs>
    </div>
  );
}
