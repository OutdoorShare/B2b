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
import { Copy, CheckCircle2, Paintbrush, RefreshCw, Upload, Eye, EyeOff, ImageIcon, X, KeyRound, Mail, ChevronDown, ChevronUp, ExternalLink, Wand2, Plus, FileText, BookOpen, AlertCircle, Rocket } from "lucide-react";
import { applyBrandColors, PRESET_THEMES, isLight } from "@/lib/theme";

function slugifyPreview(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

// ── Canvas-based logo color extractor ────────────────────────────────────────
function toHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(v => Math.min(255, v).toString(16).padStart(2, "0")).join("");
}

function colorDist(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

async function extractColorsFromImage(src: string): Promise<[string, string] | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const SIZE = 80;
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

        const buckets: Record<string, { r: number; g: number; b: number; count: number }> = {};

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 100) continue;                    // skip transparent
          if (r > 230 && g > 230 && b > 230) continue; // skip near-white
          if (r < 30  && g < 30  && b < 30)  continue; // skip near-black

          // Skip low-saturation (near-gray)
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          if (sat < 0.18) continue;

          // Quantize to 20-unit buckets
          const br = Math.round(r / 20) * 20;
          const bg = Math.round(g / 20) * 20;
          const bb = Math.round(b / 20) * 20;
          const key = `${br},${bg},${bb}`;
          if (!buckets[key]) buckets[key] = { r: br, g: bg, b: bb, count: 0 };
          buckets[key].count++;
        }

        const sorted = Object.values(buckets).sort((a, b) => b.count - a.count);
        if (sorted.length === 0) { resolve(null); return; }

        const top = sorted[0];
        const second = sorted.find(c => colorDist(c.r, c.g, c.b, top.r, top.g, top.b) > 55)
          ?? (sorted[1] ?? top);

        resolve([toHex(top.r, top.g, top.b), toHex(second.r, second.g, second.b)]);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
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
  const [activeTab, setActiveTab] = useState<string>(new URLSearchParams(window.location.search).get("tab") ?? "branding");
  const [formData, setFormData] = useState<any>({});
  const [senderPasswordInput, setSenderPasswordInput] = useState("");
  const [clearSenderCreds, setClearSenderCreds] = useState(false);
  const [showSenderSteps, setShowSenderSteps] = useState(false);
  const [showSenderPassword, setShowSenderPassword] = useState(false);

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

  // ── Rental Rules list ────────────────────────────────────────────────
  const [newRule, setNewRule] = useState("");

  const rentalRules: string[] = (formData.rentalTerms || "")
    .split("\n")
    .map((r: string) => r.trim())
    .filter(Boolean);

  const addRule = () => {
    const trimmed = newRule.trim();
    if (!trimmed) return;
    const updated = [...rentalRules, trimmed].join("\n");
    setFormData((prev: any) => ({ ...prev, rentalTerms: updated }));
    setNewRule("");
  };

  const removeRule = (idx: number) => {
    const updated = rentalRules.filter((_: string, i: number) => i !== idx).join("\n");
    setFormData((prev: any) => ({ ...prev, rentalTerms: updated }));
  };

  // ── Match Logo Colors ────────────────────────────────────────────────
  const [matchingColors, setMatchingColors] = useState(false);

  const handleMatchLogoColors = async () => {
    const url = formData.logoUrl;
    if (!url || matchingColors) return;
    setMatchingColors(true);
    try {
      const colors = await extractColorsFromImage(url);
      if (colors) {
        const [primary, secondary] = colors;
        setFormData((prev: any) => ({ ...prev, primaryColor: primary, accentColor: secondary }));
        applyBrandColors(primary, secondary);
        toast({ title: "Colors matched!", description: "Brand colors updated from your logo." });
      } else {
        toast({ title: "Couldn't extract colors", description: "Try a logo with bold, distinct colors.", variant: "destructive" });
      }
    } finally {
      setMatchingColors(false);
    }
  };

  // Tab → field allowlist mapping: each tab only sends its own fields so
  // unrelated validation (e.g. address check) never fires from the wrong tab.
  const TAB_FIELDS: Record<string, string[]> = {
    general:     ["name", "tagline", "description", "email", "outboundEmail", "senderEmail", "senderPassword", "phone", "website", "location", "address", "city", "state", "zipCode", "country", "socialInstagram", "socialFacebook", "socialTwitter"],
    branding:    ["logoUrl", "coverImageUrl", "primaryColor", "accentColor"],
    policies:    ["depositRequired", "depositPercent", "cancellationPolicy", "rentalTerms", "bundleDiscountPercent", "instantBooking", "paymentPlanEnabled", "paymentPlanDepositType", "paymentPlanDepositFixed", "paymentPlanDepositPercent", "paymentPlanDaysBeforePickup", "passPlatformFeeToCustomer"],
    payments:    [],
    integration: ["kioskModeEnabled", "embedCode"],
  };

  const doSave = async (retrying = false, pickFields?: string[]) => {
    if (saving) return;
    setSaving(true);
    try {
      // Build the payload: if pickFields supplied, only include those keys.
      let payload: Record<string, any> = pickFields
        ? Object.fromEntries(pickFields.filter(k => formData[k] !== undefined).map(k => [k, formData[k]]))
        : { ...formData };

      // Merge sender-credential overrides when they're in scope
      const includingSender = !pickFields || pickFields.includes("senderPassword");
      if (includingSender) {
        Object.assign(payload, clearSenderCreds ? { senderPassword: "", senderEmail: "" } : senderPasswordInput !== "" ? { senderPassword: senderPasswordInput } : {});
      }

      const res = await fetch(`${BASE}/api/business`, {
        method: "PUT",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      setSenderPasswordInput("");
      setClearSenderCreds(false);
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
    doSave(false, TAB_FIELDS[activeTab]);
  };

  const saveTab = (tab: string) => doSave(false, TAB_FIELDS[tab]);

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
      // Update local state first, then immediately persist so the checklist updates
      setFormData((prev: any) => {
        const updated = { ...prev, [field]: data.url };
        // Auto-save with the freshly merged object (avoid stale closure over formData)
        fetch(`${BASE}/api/business`, {
          method: "PUT",
          headers: { ...adminHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        })
          .then(r => r.ok ? r.json() : null)
          .then(saved => {
            if (saved) {
              queryClient.setQueryData(["/api/business", urlSlug], saved);
              queryClient.setQueryData(getGetBusinessProfileQueryKey(), saved);
              applyBrandColors(saved.primaryColor, saved.accentColor);
              toast({ title: field === "logoUrl" ? "Logo saved" : "Cover photo saved" });
            } else {
              toast({ title: "Upload saved locally — click Save Settings to persist", variant: "destructive" });
            }
          })
          .catch(() => toast({ title: "Upload saved locally — click Save Settings to persist", variant: "destructive" }));
        return updated;
      });
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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

            {/* ── Setup checklist status ─────────────────────────────────────── */}
            {(() => {
              const nameOk  = !!(formData.name && formData.name.trim() && formData.name.trim() !== "My Rental Company");
              const emailOk = !!(formData.email && formData.email.trim());
              const outboundOk = !!(formData.outboundEmail && formData.outboundEmail.trim());
              const logoOk  = !!(formData.logoUrl && formData.logoUrl.trim());
              const allOk   = nameOk && emailOk && outboundOk && logoOk;
              if (allOk) return (
                <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 px-5 py-4 flex items-center gap-3">
                  <Rocket className="w-5 h-5 text-green-600 shrink-0" />
                  <p className="text-sm font-semibold text-green-800 dark:text-green-300">Profile complete — you're all set to go live!</p>
                </div>
              );
              const steps = [
                { ok: nameOk,      label: "Business name set (not the default)",  anchor: "name" },
                { ok: emailOk,     label: "Public contact email added",            anchor: "email" },
                { ok: outboundOk,  label: "Outbound reply-to email added",         anchor: "outboundEmail" },
                { ok: logoOk,      label: "Logo uploaded (in the Branding tab)",   anchor: null },
              ];
              const remaining = steps.filter(s => !s.ok).length;
              return (
                <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-5 py-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                      {remaining} item{remaining !== 1 ? "s" : ""} left to complete your profile
                    </p>
                  </div>
                  <ul className="space-y-1.5">
                    {steps.map((s, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        {s.ok
                          ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                          : <div className="w-4 h-4 rounded-full border-2 border-amber-400 shrink-0" />
                        }
                        {s.anchor && !s.ok
                          ? <button type="button" className="text-amber-800 dark:text-amber-300 underline underline-offset-2 hover:no-underline text-left" onClick={() => { document.getElementById(s.anchor!)?.focus(); document.getElementById(s.anchor!)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>{s.label}</button>
                          : <span className={s.ok ? "text-muted-foreground line-through" : "text-amber-800 dark:text-amber-300"}>{s.label}</span>
                        }
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-amber-700 dark:text-amber-400">Fill in the fields below, then click <strong>Save Settings</strong> at the bottom of this page.</p>
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

                {/* Business Address */}
                <div className="space-y-2">
                  <Label htmlFor="address">
                    Street Address <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="address"
                    name="address"
                    value={formData.address || ""}
                    onChange={handleChange}
                    placeholder="123 Main St"
                    required
                    autoComplete="street-address"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">
                      City <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="city"
                      name="city"
                      value={formData.city || ""}
                      onChange={handleChange}
                      placeholder="Springfield"
                      required
                      autoComplete="address-level2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">
                      State <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="state"
                      name="state"
                      value={formData.state || ""}
                      onChange={handleChange}
                      placeholder="IL"
                      required
                      autoComplete="address-level1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">
                      ZIP Code <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="zipCode"
                      name="zipCode"
                      value={formData.zipCode || ""}
                      onChange={handleChange}
                      placeholder="62701"
                      required
                      autoComplete="postal-code"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="outboundEmail">Outbound Email (Reply-To)</Label>
                  <Input id="outboundEmail" name="outboundEmail" type="email" value={formData.outboundEmail || ""} onChange={handleChange} placeholder="e.g. rentals@yourcompany.com" />
                  <p className="text-xs text-muted-foreground">All emails sent to renters will have this as the reply-to address. Leave blank to use your Public Email.</p>
                </div>

                {/* Custom Email Sender */}
                <div className="rounded-lg border p-4 space-y-4">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-blue-50 p-2 mt-0.5 shrink-0">
                      <Mail className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Custom Email Sender</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Send all renter emails directly from your own Gmail. When set, renters see <em>your</em> email address — not the platform's.
                      </p>
                    </div>
                  </div>

                  {/* How-to accordion */}
                  <div className="rounded-md border border-amber-200 bg-amber-50 overflow-hidden">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
                      onClick={() => setShowSenderSteps(s => !s)}
                    >
                      <span className="flex items-center gap-1.5">
                        <KeyRound className="h-3.5 w-3.5" />
                        How to get a Gmail App Password (step-by-step)
                      </span>
                      {showSenderSteps ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    {showSenderSteps && (
                      <ol className="px-4 pb-3 pt-1 space-y-2.5 text-xs text-amber-800 list-none">
                        <li className="flex gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-[10px]">1</span>
                          <span>
                            Sign in to{" "}
                            <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="underline font-medium inline-flex items-center gap-0.5">
                              myaccount.google.com <ExternalLink className="h-2.5 w-2.5" />
                            </a>{" "}
                            with the Gmail address you want to send from.
                          </span>
                        </li>
                        <li className="flex gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-[10px]">2</span>
                          <span>
                            Go to <strong>Security</strong> and confirm <strong>2-Step Verification</strong> is turned on. (Required — App Passwords won't appear without it.)
                          </span>
                        </li>
                        <li className="flex gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-[10px]">3</span>
                          <span>
                            Search for{" "}
                            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline font-medium inline-flex items-center gap-0.5">
                              App Passwords <ExternalLink className="h-2.5 w-2.5" />
                            </a>{" "}
                            in your account, or go directly to that link.
                          </span>
                        </li>
                        <li className="flex gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-[10px]">4</span>
                          <span>
                            Click <strong>Create</strong>, name it <em>"OutdoorShare"</em>, and copy the <strong>16-character password</strong> Google gives you.
                          </span>
                        </li>
                        <li className="flex gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-[10px]">5</span>
                          <span>
                            Paste your Gmail address and that 16-character code into the fields below, then click <strong>Save Settings</strong>.
                          </span>
                        </li>
                      </ol>
                    )}
                  </div>

                  {/* Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="senderEmail">Your Gmail Address</Label>
                      <Input
                        id="senderEmail"
                        name="senderEmail"
                        type="email"
                        value={formData.senderEmail || ""}
                        onChange={handleChange}
                        placeholder="you@gmail.com"
                      />
                      <p className="text-xs text-muted-foreground">Gmail or Google Workspace address</p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="senderPassword">
                        App Password
                        {formData.senderPasswordSet && !clearSenderCreds && (
                          <span className="ml-2 text-xs font-normal text-emerald-600">● Saved</span>
                        )}
                      </Label>
                      <div className="relative">
                        <Input
                          id="senderPassword"
                          type={showSenderPassword ? "text" : "password"}
                          value={senderPasswordInput}
                          onChange={e => setSenderPasswordInput(e.target.value)}
                          placeholder={formData.senderPasswordSet && !clearSenderCreds ? "Enter new code to update" : "xxxx xxxx xxxx xxxx"}
                          autoComplete="new-password"
                          className="pr-9"
                        />
                        <button
                          type="button"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowSenderPassword(v => !v)}
                          tabIndex={-1}
                        >
                          {showSenderPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">16-character code from Google, not your login password</p>
                    </div>
                  </div>

                  {(formData.senderPasswordSet && !clearSenderCreds) && (
                    <button
                      type="button"
                      className="text-xs text-destructive underline hover:no-underline"
                      onClick={() => {
                        setFormData((prev: any) => ({ ...prev, senderEmail: "", senderPasswordSet: false }));
                        setSenderPasswordInput("");
                        setClearSenderCreds(true);
                      }}
                    >
                      Remove saved credentials
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Primary Location</Label>
                  <Input id="location" name="location" value={formData.location || ""} onChange={handleChange} required />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end pt-2">
              <Button type="submit" size="lg" disabled={saving} className="gap-2">
                {saving ? <><RefreshCw className="w-4 h-4 animate-spin" />Saving…</> : <><CheckCircle2 className="w-4 h-4" />Save General Settings</>}
              </Button>
            </div>
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
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Paintbrush className="w-4 h-4" /> Brand Colors</CardTitle>
                    <CardDescription className="mt-1">These colors are applied across the entire storefront in real time.</CardDescription>
                  </div>
                  {formData.logoUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2 shrink-0"
                      onClick={handleMatchLogoColors}
                      disabled={matchingColors}
                      title="Analyze your logo and automatically set matching brand colors"
                    >
                      <Wand2 className={`w-3.5 h-3.5 ${matchingColors ? "animate-spin" : ""}`} />
                      {matchingColors ? "Analyzing…" : "Match Logo Colors"}
                    </Button>
                  )}
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
                        <div className="flex gap-2">
                          <Input
                            name="primaryColor"
                            value={formData.primaryColor || ""}
                            onChange={e => handleColorChange("primaryColor", e.target.value)}
                            placeholder="#1b4332"
                            className="font-mono"
                            maxLength={7}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="shrink-0"
                            onClick={() => {
                              const v = (formData.primaryColor || "").trim();
                              if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                                setFormData((prev: any) => ({ ...prev, primaryColor: v }));
                                applyBrandColors(v, formData.accentColor);
                                toast({ title: "Primary color set", description: v });
                              }
                            }}
                          >
                            Set
                          </Button>
                        </div>
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
                        <div className="flex gap-2">
                          <Input
                            name="accentColor"
                            value={formData.accentColor || ""}
                            onChange={e => handleColorChange("accentColor", e.target.value)}
                            placeholder="#52b788"
                            className="font-mono"
                            maxLength={7}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="shrink-0"
                            onClick={() => {
                              const v = (formData.accentColor || "").trim();
                              if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                                setFormData((prev: any) => ({ ...prev, accentColor: v }));
                                applyBrandColors(formData.primaryColor, v);
                                toast({ title: "Accent color set", description: v });
                              }
                            }}
                          >
                            Set
                          </Button>
                        </div>
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

            <div className="flex justify-end pt-2">
              <Button type="submit" size="lg" disabled={saving} className="gap-2">
                {saving ? <><RefreshCw className="w-4 h-4 animate-spin" />Saving…</> : <><CheckCircle2 className="w-4 h-4" />Save Branding</>}
              </Button>
            </div>
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

                {/* ── Split / Delayed Payment Plan ── */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border rounded-lg p-4">
                    <div className="space-y-0.5">
                      <Label className="text-base">Split Payment Plans</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow customers to pay a deposit now and have the remaining balance automatically charged later.
                      </p>
                    </div>
                    <Switch
                      checked={!!formData.paymentPlanEnabled}
                      onCheckedChange={checked => handleSwitchChange("paymentPlanEnabled", checked)}
                    />
                  </div>

                  {formData.paymentPlanEnabled && (
                    <div className="ml-4 border-l-2 border-primary/20 pl-4 space-y-4">
                      {/* Deposit type */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Deposit Amount</Label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setFormData((f: any) => ({ ...f, paymentPlanDepositType: "percent" }))}
                            className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${formData.paymentPlanDepositType === "percent" ? "border-primary bg-primary/5 font-semibold text-primary" : "border-border hover:bg-muted/50"}`}
                          >
                            Percentage (%)
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData((f: any) => ({ ...f, paymentPlanDepositType: "fixed" }))}
                            className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${formData.paymentPlanDepositType === "fixed" ? "border-primary bg-primary/5 font-semibold text-primary" : "border-border hover:bg-muted/50"}`}
                          >
                            Fixed Amount ($)
                          </button>
                        </div>
                        {formData.paymentPlanDepositType === "percent" ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number" min="1" max="99" step="1"
                              value={formData.paymentPlanDepositPercent ?? 25}
                              onChange={e => setFormData((f: any) => ({ ...f, paymentPlanDepositPercent: parseFloat(e.target.value) || 25 }))}
                              className="w-28"
                            />
                            <span className="text-sm text-muted-foreground">% of total due at booking</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">$</span>
                            <Input
                              type="number" min="1" step="0.01"
                              value={formData.paymentPlanDepositFixed ?? 0}
                              onChange={e => setFormData((f: any) => ({ ...f, paymentPlanDepositFixed: parseFloat(e.target.value) || 0 }))}
                              className="w-28"
                            />
                            <span className="text-sm text-muted-foreground">due at booking</span>
                          </div>
                        )}
                      </div>

                      {/* When to charge remaining */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Charge Remaining Balance</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number" min="0" max="60" step="1"
                            value={formData.paymentPlanDaysBeforePickup ?? 0}
                            onChange={e => setFormData((f: any) => ({ ...f, paymentPlanDaysBeforePickup: parseInt(e.target.value) || 0 }))}
                            className="w-20"
                          />
                          <span className="text-sm text-muted-foreground">
                            {(formData.paymentPlanDaysBeforePickup ?? 0) === 0
                              ? "days before pickup (0 = day of pickup)"
                              : `day${(formData.paymentPlanDaysBeforePickup ?? 0) !== 1 ? "s" : ""} before pickup`}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          The remaining balance will be automatically charged to the card on file on the scheduled date.
                        </p>
                      </div>

                      {/* Preview */}
                      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                        <p className="text-xs font-semibold text-blue-700 mb-1">Example for a $300 rental</p>
                        <p className="text-xs text-blue-600">
                          {formData.paymentPlanDepositType === "percent"
                            ? `Deposit: $${(300 * (parseFloat(String(formData.paymentPlanDepositPercent ?? "25")) / 100)).toFixed(2)} due now · Remaining $${(300 - 300 * (parseFloat(String(formData.paymentPlanDepositPercent ?? "25")) / 100)).toFixed(2)} auto-charged ${(formData.paymentPlanDaysBeforePickup ?? 0) === 0 ? "on pickup day" : `${formData.paymentPlanDaysBeforePickup} day${(formData.paymentPlanDaysBeforePickup ?? 0) !== 1 ? "s" : ""} before pickup`}`
                            : `Deposit: $${parseFloat(String(formData.paymentPlanDepositFixed ?? "0")).toFixed(2)} due now · Remaining $${Math.max(0, 300 - parseFloat(String(formData.paymentPlanDepositFixed ?? "0"))).toFixed(2)} auto-charged ${(formData.paymentPlanDaysBeforePickup ?? 0) === 0 ? "on pickup day" : `${formData.paymentPlanDaysBeforePickup} day${(formData.paymentPlanDaysBeforePickup ?? 0) !== 1 ? "s" : ""} before pickup`}`
                          }
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Platform Service Fee Pass-Through ── */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border rounded-lg p-4">
                    <div className="space-y-0.5">
                      <Label className="text-base">Pass Service Fee to Customer</Label>
                      <p className="text-sm text-muted-foreground">
                        When enabled, the OutdoorShare service fee is added on top of your rental price and paid by the customer — your payout stays the same.
                      </p>
                    </div>
                    <Switch
                      checked={!!formData.passPlatformFeeToCustomer}
                      onCheckedChange={checked => handleSwitchChange("passPlatformFeeToCustomer", checked)}
                    />
                  </div>
                  {formData.passPlatformFeeToCustomer && (
                    <div className="ml-4 border-l-2 border-primary/20 pl-4">
                      <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                        <p className="text-xs font-semibold text-green-700 mb-1">Example for a $300 rental</p>
                        <p className="text-xs text-green-600">
                          Customer pays: ${(300 * (1 + (parseFloat(String(formData.platformFeePercent ?? "5")) / 100))).toFixed(2)} (rental + {formData.platformFeePercent ?? 5}% service fee of ${(300 * parseFloat(String(formData.platformFeePercent ?? "5")) / 100).toFixed(2)}) · You receive: $300.00
                        </p>
                      </div>
                    </div>
                  )}
                </div>

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
                {/* Rental Rules list */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-base font-semibold">Rental Rules & Policies</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add each rule as a separate item. Rules are displayed on every listing page and printed in the rental agreement renters sign before checkout.
                    </p>
                  </div>

                  {/* Where it shows up */}
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700">
                      <BookOpen className="w-3 h-3" /> Shown on each listing
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 border border-purple-200 px-3 py-1 text-xs font-medium text-purple-700">
                      <FileText className="w-3 h-3" /> Printed in rental agreement
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-medium text-green-700">
                      <CheckCircle2 className="w-3 h-3" /> Read by your AI assistant
                    </span>
                  </div>

                  {/* Existing rules */}
                  {rentalRules.length > 0 ? (
                    <ul className="divide-y rounded-lg border overflow-hidden">
                      {rentalRules.map((rule: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-3 px-4 py-3 bg-card hover:bg-muted/40 transition-colors group">
                          <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                            {idx + 1}
                          </span>
                          <span className="flex-1 text-sm leading-snug">{rule}</span>
                          <button
                            type="button"
                            onClick={() => removeRule(idx)}
                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            title="Remove rule"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="rounded-lg border-2 border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                      No rules added yet. Add your first rule below.
                    </div>
                  )}

                  {/* Add new rule */}
                  <div className="flex gap-2">
                    <Input
                      value={newRule}
                      onChange={e => setNewRule(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addRule(); } }}
                      placeholder="e.g. No smoking in or around equipment"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="gap-2 shrink-0"
                      onClick={addRule}
                      disabled={!newRule.trim()}
                    >
                      <Plus className="w-4 h-4" /> Add Rule
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Press Enter or click Add Rule. Hover a rule to delete it.</p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end pt-2">
              <Button type="submit" size="lg" disabled={saving} className="gap-2">
                {saving ? <><RefreshCw className="w-4 h-4 animate-spin" />Saving…</> : <><CheckCircle2 className="w-4 h-4" />Save Policies</>}
              </Button>
            </div>
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
                    Applied to the entire order (primary item + bundle items) when the renter adds extra products.
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
                  Send this link to your customers. They'll see your branded storefront where they can browse products and make bookings.
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

            <div className="flex justify-end pt-2">
              <Button type="submit" size="lg" disabled={saving} className="gap-2">
                {saving ? <><RefreshCw className="w-4 h-4 animate-spin" />Saving…</> : <><CheckCircle2 className="w-4 h-4" />Save Integration Settings</>}
              </Button>
            </div>
          </TabsContent>

        </form>
      </Tabs>
    </div>
  );
}
