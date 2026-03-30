import { useState, useEffect, useRef } from "react";
import {
  useGetBusinessProfile,
  useUpdateBusinessProfile,
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
import { Copy, CheckCircle2, Paintbrush, RefreshCw, Upload, Eye } from "lucide-react";
import { applyBrandColors, PRESET_THEMES, isLight } from "@/lib/theme";

export default function AdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: profile, isLoading } = useGetBusinessProfile({
    query: { queryKey: getGetBusinessProfileQueryKey() }
  });

  const updateProfile = useUpdateBusinessProfile();
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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate(
      { data: formData },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetBusinessProfileQueryKey(), data);
          applyBrandColors(data.primaryColor, data.accentColor);
          toast({ title: "Settings saved successfully" });
        },
        onError: () => {
          toast({ title: "Failed to save settings", variant: "destructive" });
        }
      }
    );
  };

  const copyEmbedCode = () => {
    const code = formData.embedCode || `<iframe src="${window.location.origin}/" width="100%" height="800px" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Embed code copied to clipboard" });
  };

  if (isLoading) return <div className="p-8">Loading settings...</div>;

  const primary = formData.primaryColor || "#1b4332";
  const accent  = formData.accentColor  || "#52b788";
  const logoUrl = formData.logoUrl || "";

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Manage your business profile and preferences</p>
      </div>

      <Tabs defaultValue="branding" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="integration">Integration</TabsTrigger>
        </TabsList>

        <form onSubmit={handleSave}>

          {/* ── GENERAL ── */}
          <TabsContent value="general" className="space-y-6 pt-6">
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
                <div className="flex items-start gap-6">
                  {/* Current logo preview */}
                  <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted shrink-0">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo"
                        className="w-full h-full object-contain p-2 rounded-xl"
                        onError={e => (e.currentTarget.style.display = "none")}
                      />
                    ) : (
                      <div className="text-center">
                        <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center text-xl font-black text-white mb-1" style={{ backgroundColor: primary }}>
                          {(formData.name || "B").charAt(0)}
                        </div>
                        <p className="text-[10px] text-muted-foreground">No logo</p>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="logoUrl">Logo URL</Label>
                      <Input
                        id="logoUrl"
                        name="logoUrl"
                        value={formData.logoUrl || ""}
                        onChange={handleChange}
                        placeholder="https://your-cdn.com/logo.png"
                      />
                      <p className="text-xs text-muted-foreground">Paste a direct link to your logo image (PNG or SVG recommended). Use a CDN or image hosting service like Imgur or Cloudinary.</p>
                    </div>
                    {logoUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleColorChange("logoUrl", "")}
                      >
                        Remove logo
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="coverImageUrl">Cover / Hero Image URL</Label>
                  <Input
                    id="coverImageUrl"
                    name="coverImageUrl"
                    value={formData.coverImageUrl || ""}
                    onChange={handleChange}
                    placeholder="https://your-cdn.com/hero.jpg"
                  />
                  <p className="text-xs text-muted-foreground">Used as the background image on your storefront home page. Recommended size: 1440×600px.</p>
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
              <CardContent className="pt-6">
                <div className="flex items-center justify-between border rounded-lg p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Kiosk Mode</Label>
                    <p className="text-sm text-muted-foreground">Enable simplified fullscreen view for in-store tablets.</p>
                  </div>
                  <Switch
                    checked={formData.kioskModeEnabled || false}
                    onCheckedChange={checked => handleSwitchChange("kioskModeEnabled", checked)}
                  />
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
                <div className="space-y-2">
                  <Label htmlFor="cancellationPolicy">Cancellation Policy</Label>
                  <Textarea id="cancellationPolicy" name="cancellationPolicy" value={formData.cancellationPolicy || ""} onChange={handleChange} rows={4} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rentalTerms">Rental Terms & Conditions</Label>
                  <Textarea id="rentalTerms" name="rentalTerms" value={formData.rentalTerms || ""} onChange={handleChange} rows={6} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── INTEGRATION ── */}
          <TabsContent value="integration" className="space-y-6 pt-6">
            <Card>
              <CardHeader>
                <CardTitle>Storefront Integration</CardTitle>
                <CardDescription>Share or embed your booking page.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Public Storefront URL</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-3 rounded-md bg-muted text-sm font-mono overflow-x-auto">
                      {window.location.origin}/
                    </code>
                    <Button type="button" variant="outline" onClick={() => window.open("/", "_blank")}>Visit</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Embed Code</Label>
                  <p className="text-sm text-muted-foreground mb-2">Copy this HTML to embed the booking flow on your existing website.</p>
                  <div className="relative">
                    <pre className="p-4 rounded-md bg-slate-950 text-slate-50 text-sm font-mono overflow-x-auto">
                      {formData.embedCode || `<iframe src="${window.location.origin}/" width="100%" height="800px" frameborder="0"></iframe>`}
                    </pre>
                    <Button type="button" size="icon" variant="secondary" className="absolute top-2 right-2" onClick={copyEmbedCode}>
                      {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <div className="mt-8 flex justify-end">
            <Button type="submit" size="lg" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </Tabs>
    </div>
  );
}
