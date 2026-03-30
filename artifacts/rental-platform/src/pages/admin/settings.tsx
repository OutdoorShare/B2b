import { useState, useEffect } from "react";
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
import { Copy, CheckCircle2 } from "lucide-react";

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
    if (profile) {
      setFormData(profile);
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData((prev: any) => ({ ...prev, [name]: checked }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate(
      { data: formData },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetBusinessProfileQueryKey(), data);
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

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Manage your business profile and preferences</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="integration">Integration</TabsTrigger>
        </TabsList>

        <form onSubmit={handleSave}>
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
                    <Input id="name" name="name" value={formData.name || ''} onChange={handleChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tagline">Tagline</Label>
                    <Input id="tagline" name="tagline" value={formData.tagline || ''} onChange={handleChange} required />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" value={formData.description || ''} onChange={handleChange} rows={4} required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Public Email</Label>
                    <Input id="email" name="email" type="email" value={formData.email || ''} onChange={handleChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Public Phone</Label>
                    <Input id="phone" name="phone" value={formData.phone || ''} onChange={handleChange} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Primary Location</Label>
                  <Input id="location" name="location" value={formData.location || ''} onChange={handleChange} required />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="branding" className="space-y-6 pt-6">
            <Card>
              <CardHeader>
                <CardTitle>Visual Identity</CardTitle>
                <CardDescription>Customize how your storefront looks.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="logoUrl">Logo URL</Label>
                    <Input id="logoUrl" name="logoUrl" value={formData.logoUrl || ''} onChange={handleChange} placeholder="https://..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coverImageUrl">Cover Image URL</Label>
                    <Input id="coverImageUrl" name="coverImageUrl" value={formData.coverImageUrl || ''} onChange={handleChange} placeholder="https://..." />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">Primary Color (Hex)</Label>
                    <div className="flex gap-2">
                      <Input id="primaryColor" name="primaryColor" value={formData.primaryColor || ''} onChange={handleChange} />
                      <div className="w-10 h-10 rounded border" style={{ backgroundColor: formData.primaryColor || '#000' }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accentColor">Accent Color (Hex)</Label>
                    <div className="flex gap-2">
                      <Input id="accentColor" name="accentColor" value={formData.accentColor || ''} onChange={handleChange} />
                      <div className="w-10 h-10 rounded border" style={{ backgroundColor: formData.accentColor || '#000' }} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border rounded-lg p-4 mt-6">
                  <div className="space-y-0.5">
                    <Label className="text-base">Kiosk Mode</Label>
                    <p className="text-sm text-muted-foreground">Enable simplified fullscreen view for in-store tablets.</p>
                  </div>
                  <Switch 
                    checked={formData.kioskModeEnabled || false} 
                    onCheckedChange={(checked) => handleSwitchChange('kioskModeEnabled', checked)} 
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

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
                    onCheckedChange={(checked) => handleSwitchChange('depositRequired', checked)} 
                  />
                </div>

                {formData.depositRequired && (
                  <div className="space-y-2">
                    <Label htmlFor="depositPercent">Deposit Percentage (%)</Label>
                    <Input 
                      id="depositPercent" 
                      name="depositPercent" 
                      type="number" 
                      value={formData.depositPercent || 0} 
                      onChange={handleChange} 
                      min="0" max="100" 
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="cancellationPolicy">Cancellation Policy</Label>
                  <Textarea 
                    id="cancellationPolicy" 
                    name="cancellationPolicy" 
                    value={formData.cancellationPolicy || ''} 
                    onChange={handleChange} 
                    rows={4} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rentalTerms">Rental Terms & Conditions</Label>
                  <Textarea 
                    id="rentalTerms" 
                    name="rentalTerms" 
                    value={formData.rentalTerms || ''} 
                    onChange={handleChange} 
                    rows={6} 
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

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
                    <Button type="button" variant="outline" onClick={() => window.open('/', '_blank')}>
                      Visit
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Embed Code</Label>
                  <p className="text-sm text-muted-foreground mb-2">Copy this HTML to embed the booking flow on your existing website.</p>
                  <div className="relative">
                    <pre className="p-4 rounded-md bg-slate-950 text-slate-50 text-sm font-mono overflow-x-auto">
                      {formData.embedCode || `<iframe src="${window.location.origin}/" width="100%" height="800px" frameborder="0"></iframe>`}
                    </pre>
                    <Button 
                      type="button" 
                      size="icon" 
                      variant="secondary" 
                      className="absolute top-2 right-2"
                      onClick={copyEmbedCode}
                    >
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
