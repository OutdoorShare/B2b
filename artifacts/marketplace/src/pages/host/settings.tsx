import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/context/auth";
import { HostLayout } from "./layout";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Camera, Upload, X } from "lucide-react";

const API_BASE = "/api";

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/upload/image`, { method: "POST", body: fd });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.url as string;
}

function resolveImage(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const filename = url.split("/").pop() ?? "";
  return `${API_BASE}/uploads/${filename}`;
}

function AvatarUpload({
  currentUrl, name, onUploaded,
}: { currentUrl: string | null; name: string; onUploaded: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayUrl = resolveImage(currentUrl);
  const initials = name ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "H";

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onUploaded(url);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <div className="h-20 w-20 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center border-2 border-white shadow-md">
          {displayUrl ? (
            <img src={displayUrl} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xl font-bold text-primary">{initials}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center shadow-sm hover:bg-primary/90 transition-colors"
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
        </button>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-700">Profile photo</p>
        <p className="text-xs text-gray-400 mb-2">Shown next to your listings</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-xs text-primary font-medium hover:underline"
        >
          {displayUrl ? "Change photo" : "Upload photo"}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
    </div>
  );
}

function CoverUpload({
  currentUrl, onUploaded, onRemove,
}: { currentUrl: string | null; onUploaded: (url: string) => void; onRemove: () => void }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayUrl = resolveImage(currentUrl);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onUploaded(url);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">Cover photo</p>
      <div
        className="relative h-32 rounded-xl overflow-hidden border border-gray-200 bg-gradient-to-r from-primary/20 to-primary/10 cursor-pointer group"
        onClick={() => !displayUrl && inputRef.current?.click()}
      >
        {displayUrl ? (
          <img src={displayUrl} alt="Cover" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
            <Upload className="h-6 w-6" />
            <p className="text-xs font-medium">Upload a cover photo</p>
          </div>
        )}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
            className="px-3 py-1.5 bg-white text-gray-900 text-xs font-medium rounded-lg shadow hover:bg-gray-100"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : "Change"}
          </button>
          {displayUrl && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onRemove(); }}
              className="px-3 py-1.5 bg-white text-red-600 text-xs font-medium rounded-lg shadow hover:bg-red-50 flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Remove
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-1">Shown on your host profile. Recommended: 1200×400px.</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
    </div>
  );
}

export function HostSettingsPage() {
  const { customer } = useAuth();
  const { toast } = useToast();

  const { data: me } = useQuery({
    queryKey: ["host-me", customer?.id],
    queryFn: () => api.host.me(customer!.id),
    enabled: !!customer,
  });

  const [form, setForm] = useState({
    displayName: "",
    description: "",
    city: "",
    state: "",
    phone: "",
    website: "",
    logoUrl: null as string | null,
    coverImageUrl: null as string | null,
  });

  useEffect(() => {
    if (me?.business) {
      setForm({
        displayName: me.business.name ?? me.name ?? "",
        description: me.business.description ?? "",
        city: me.business.city ?? "",
        state: me.business.state ?? "",
        phone: me.business.phone ?? "",
        website: me.business.website ?? "",
        logoUrl: (me.business as any).logoUrl ?? null,
        coverImageUrl: (me.business as any).coverImageUrl ?? null,
      });
    } else if (me) {
      setForm(f => ({ ...f, displayName: me.name }));
    }
  }, [me]);

  const save = useMutation({
    mutationFn: () => api.host.updateSettings(customer!.id, form),
    onSuccess: () => {
      toast({ title: "Settings saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const set = (k: string, v: string | null) => setForm(f => ({ ...f, [k]: v }));

  return (
    <HostLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Host Profile</h1>
          <p className="text-gray-500 text-sm mt-0.5">Update your host profile visible to renters on OutdoorShare.</p>
        </div>

        <form
          onSubmit={e => { e.preventDefault(); save.mutate(); }}
          className="space-y-6"
        >
          {/* Photos */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <h2 className="font-semibold text-gray-900">Photos</h2>
            <AvatarUpload
              currentUrl={form.logoUrl}
              name={form.displayName}
              onUploaded={url => set("logoUrl", url)}
            />
            <CoverUpload
              currentUrl={form.coverImageUrl}
              onUploaded={url => set("coverImageUrl", url)}
              onRemove={() => set("coverImageUrl", null)}
            />
          </section>

          {/* Profile */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">About You</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                <Input
                  value={form.displayName}
                  onChange={e => set("displayName", e.target.value)}
                  placeholder="e.g. Jake's Outdoor Adventures"
                />
                <p className="text-xs text-gray-400 mt-1">This name appears on your listings on OutdoorShare.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">About</label>
                <textarea
                  value={form.description}
                  onChange={e => set("description", e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Tell renters a bit about yourself and your adventure..."
                />
              </div>
            </div>
          </section>

          {/* Location & Contact */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Location & Contact</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Denver" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <Input value={form.state} onChange={e => set("state", e.target.value)} placeholder="CO" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="(555) 555-5555" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <Input value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://example.com" />
              </div>
            </div>
          </section>

          {/* Account */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-2">Account Info</h2>
            <div className="text-sm text-gray-500 space-y-1">
              <p><span className="font-medium text-gray-700">Email:</span> {customer?.email}</p>
              <p><span className="font-medium text-gray-700">Name:</span> {customer?.name}</p>
              <p className="text-xs mt-2 text-gray-400">
                To change your account email or password, contact OutdoorShare support.
              </p>
            </div>
          </section>

          <div className="flex justify-end pb-8">
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-white"
              disabled={save.isPending}
            >
              {save.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
              ) : "Save Profile"}
            </Button>
          </div>
        </form>
      </div>
    </HostLayout>
  );
}
