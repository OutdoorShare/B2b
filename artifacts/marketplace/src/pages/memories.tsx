import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Camera,
  ImagePlus,
  Share2,
  Tag,
  Trash2,
  X,
  Search,
  Loader2,
  MapPin,
  Globe,
  Lock,
  Mountain,
  ChevronDown,
  Link2,
  Check,
  QrCode,
  Copy,
  Users,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = "/api";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Memory {
  id: number;
  customerId: number;
  customerName: string;
  photoUrls: string[];
  caption: string | null;
  taggedTenantId: number | null;
  taggedTenantName: string | null;
  taggedTenantSlug: string | null;
  isPublic: boolean;
  createdAt: string;
}

interface Tenant {
  id: number;
  name: string;
  slug: string;
  isHost: boolean;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function fetchMemories(tab: "all" | "my", customerId?: number): Promise<Memory[]> {
  const headers: Record<string, string> = {};
  if (customerId) headers["x-customer-id"] = String(customerId);
  const url = tab === "my" ? `${API}/memories/my` : `${API}/memories`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  return data.memories ?? [];
}

async function fetchTenants(q: string): Promise<Tenant[]> {
  const res = await fetch(`${API}/memories/tenants?q=${encodeURIComponent(q)}`);
  const data = await res.json();
  return data.tenants ?? [];
}

async function uploadImage(file: File, customerId: number): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}/upload/image`, {
    method: "POST",
    headers: { "x-customer-id": String(customerId) },
    body: form,
  });
  if (!res.ok) throw new Error("Upload failed");
  const { url } = await res.json();
  return url;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

function avatarColor(name: string) {
  const colors = [
    "bg-primary text-white",
    "bg-blue-500 text-white",
    "bg-amber-500 text-white",
    "bg-purple-500 text-white",
    "bg-rose-500 text-white",
    "bg-teal-500 text-white",
  ];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) % colors.length;
  return colors[Math.abs(hash)];
}

// ─── Memory Card ─────────────────────────────────────────────────────────────

export function MemoryCard({
  memory,
  isOwn,
  onDelete,
}: {
  memory: Memory;
  isOwn: boolean;
  onDelete: (id: number) => void;
}) {
  const [activePhoto, setActivePhoto] = useState(0);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleShare = async () => {
    const url = window.location.href;
    const text = memory.caption
      ? `"${memory.caption}" — ${memory.customerName} on OutdoorShare`
      : `Check out this adventure by ${memory.customerName} on OutdoorShare!`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "OutdoorShare Memory", text, url });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      toast({ title: "Link copied to clipboard!" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const photos = memory.photoUrls ?? [];

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      {/* Photos */}
      {photos.length > 0 && (
        <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
          <img
            src={photos[activePhoto]}
            alt="Memory"
            className="w-full h-full object-cover"
          />
          {/* Photo strip if multiple */}
          {photos.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActivePhoto(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    i === activePhoto ? "bg-white scale-125" : "bg-white/60"
                  }`}
                />
              ))}
            </div>
          )}
          {/* Multiple photos badge */}
          {photos.length > 1 && (
            <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
              {photos.length} photos
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div className="p-4">
        {/* Author row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor(memory.customerName)}`}>
              {initials(memory.customerName)}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-none">{memory.customerName}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(memory.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!memory.isPublic && (
              <Lock className="h-3.5 w-3.5 text-gray-300" title="Only visible to you" />
            )}
            {isOwn && (
              <button
                onClick={() => onDelete(memory.id)}
                className="p-1.5 text-gray-300 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50"
                title="Delete memory"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Caption */}
        {memory.caption && (
          <p className="text-sm text-gray-700 mb-3 leading-relaxed">{memory.caption}</p>
        )}

        {/* Tagged company/host chip */}
        {memory.taggedTenantName && (
          <div className="flex items-center gap-1.5 mb-3">
            <Tag className="h-3 w-3 text-primary" />
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {memory.taggedTenantName}
            </span>
          </div>
        )}

        {/* Share row */}
        <div className="flex items-center gap-2 pt-3 border-t border-gray-50">
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-primary transition-colors font-medium"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Share"}
          </button>

          {/* Quick share buttons */}
          <div className="ml-auto flex items-center gap-1.5">
            <button
              title="Share on X (Twitter)"
              onClick={() => {
                const text = memory.caption ?? `Adventure with ${memory.taggedTenantName ?? "OutdoorShare"}!`;
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`, "_blank");
              }}
              className="text-[10px] font-bold text-gray-300 hover:text-sky-400 transition-colors px-1.5 py-0.5 rounded border border-gray-100 hover:border-sky-200"
            >
              𝕏
            </button>
            <button
              title="Share on Facebook"
              onClick={() => {
                window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, "_blank");
              }}
              className="text-[10px] font-bold text-gray-300 hover:text-blue-500 transition-colors px-1.5 py-0.5 rounded border border-gray-100 hover:border-blue-200"
            >
              f
            </button>
            <button
              title="Copy link"
              onClick={async () => {
                await navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="text-gray-300 hover:text-gray-500 transition-colors p-0.5 rounded"
            >
              <Link2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Create Memory Modal ──────────────────────────────────────────────────────

export function CreateMemoryModal({
  customerId,
  customerName,
  onClose,
  onCreated,
}: {
  customerId: number;
  customerName: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  // Tenant tagging
  const [tagSearch, setTagSearch] = useState("");
  const [tagOpen, setTagOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const { data: tenants = [] } = useQuery({
    queryKey: ["memories-tenants", tagSearch],
    queryFn: () => fetchTenants(tagSearch),
    enabled: tagOpen,
  });

  const handleFiles = (selected: FileList | null) => {
    if (!selected) return;
    const allowed = Array.from(selected).slice(0, 5 - files.length);
    if (files.length + allowed.length > 5) {
      toast({ title: "Max 5 photos per memory", variant: "destructive" });
      return;
    }
    const newFiles = [...files, ...allowed].slice(0, 5);
    setFiles(newFiles);
    const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
    setPreviews(newPreviews);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [files]
  );

  const removePhoto = (idx: number) => {
    setFiles((f) => f.filter((_, i) => i !== idx));
    setPreviews((p) => p.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      toast({ title: "Add at least one photo!", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const photoUrls = await Promise.all(files.map((f) => uploadImage(f, customerId)));
      const res = await fetch(`${API}/memories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-customer-id": String(customerId) },
        body: JSON.stringify({
          photoUrls,
          caption: caption.trim() || null,
          taggedTenantId: selectedTenant?.id ?? null,
          isPublic,
        }),
      });
      if (!res.ok) throw new Error("Failed to post memory");
      toast({ title: "Memory posted! 🌲" });
      onCreated();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Share a Memory</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Photo upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Photos <span className="text-red-500">*</span>
              <span className="text-gray-400 font-normal ml-1">(up to 5)</span>
            </label>

            {previews.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden group bg-gray-100">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {previews.length < 5 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    <ImagePlus className="h-5 w-5 text-gray-300" />
                    <span className="text-[10px] text-gray-400">Add more</span>
                  </button>
                )}
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <Camera className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600">Drop photos here or click to upload</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP · Up to 5 photos</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {/* Caption */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Caption</label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Tell us about your adventure..."
              className="resize-none h-24 text-sm"
              maxLength={500}
            />
            <p className="text-[11px] text-gray-400 text-right mt-0.5">{caption.length}/500</p>
          </div>

          {/* Tag a company / host */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Tag className="h-3.5 w-3.5 inline mr-1 text-primary" />
              Tag a company or host
            </label>
            {selectedTenant ? (
              <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-lg">
                <Tag className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-sm font-medium flex-1">{selectedTenant.name}</span>
                <span className="text-[10px] text-primary/60 mr-1">{selectedTenant.isHost ? "Host" : "Company"}</span>
                <button onClick={() => setSelectedTenant(null)} className="text-primary/60 hover:text-primary">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    value={tagSearch}
                    onChange={(e) => { setTagSearch(e.target.value); setTagOpen(true); }}
                    onFocus={() => setTagOpen(true)}
                    placeholder="Search companies or hosts..."
                    className="pl-9 text-sm"
                  />
                </div>
                {tagOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {tenants.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-3">No results</p>
                    ) : (
                      tenants.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => { setSelectedTenant(t); setTagOpen(false); setTagSearch(""); }}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left"
                        >
                          <span className="text-sm text-gray-800">{t.name}</span>
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                            {t.isHost ? "Host" : "Company"}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Visibility */}
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2">
              {isPublic ? (
                <Globe className="h-4 w-4 text-primary" />
              ) : (
                <Lock className="h-4 w-4 text-gray-400" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {isPublic ? "Public" : "Only me"}
                </p>
                <p className="text-[11px] text-gray-400">
                  {isPublic ? "Everyone on the social wall can see this" : "Only visible in My Memories"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsPublic(!isPublic)}
              className={`relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0 ${isPublic ? "bg-primary" : "bg-gray-300"}`}
              style={{ height: "22px", width: "40px" }}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPublic ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </button>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={uploading}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 bg-primary hover:bg-primary/90 text-white"
              disabled={uploading || files.length === 0}
            >
              {uploading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Posting...</>
              ) : (
                "Post Memory"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function MemoriesPage({ onAuthOpen }: { onAuthOpen: () => void }) {
  const { customer } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<"all" | "my">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: memories = [], isLoading } = useQuery({
    queryKey: ["memories", tab, customer?.id],
    queryFn: () => fetchMemories(tab, customer?.id),
    refetchInterval: 30000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API}/memories/${id}`, {
        method: "DELETE",
        headers: { "x-customer-id": String(customer!.id) },
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memories"] });
      toast({ title: "Memory deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handlePostClick = () => {
    if (!customer) {
      onAuthOpen();
      return;
    }
    setShowCreate(true);
  };

  const handleTabChange = (next: "all" | "my") => {
    if (next === "my" && !customer) {
      onAuthOpen();
      return;
    }
    setTab(next);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Hero banner */}
      <div
        className="relative text-white overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1a4731 0%, hsl(127,55%,38%) 55%, hsl(197,78%,48%) 100%)" }}
      >
        {/* Decorative mountain silhouette */}
        <svg
          className="absolute inset-x-0 bottom-0 w-full opacity-10"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M0,80 L180,20 L360,70 L540,10 L720,60 L900,5 L1080,55 L1260,15 L1440,50 L1440,120 L0,120 Z" fill="white" />
        </svg>
        {/* Scattered dots texture */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "28px 28px"
        }} />

        <div className="relative max-w-5xl mx-auto px-4 py-14 text-center">
          {/* Logo + brand line */}
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <img
              src={`${BASE_URL}/outdoorshare-icon.png`}
              alt="OutdoorShare"
              className="h-10 w-10 object-contain drop-shadow-md"
            />
            <span className="text-xs font-bold tracking-[0.2em] uppercase text-white/70">OutdoorShare</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight mb-2 drop-shadow-sm">
            Adventure Wall
          </h1>
          <p className="text-white/75 text-sm max-w-md mx-auto mb-7 leading-relaxed">
            Share photos from your outdoor adventures, tag companies and hosts, and inspire the next great trip.
          </p>
          <Button
            onClick={handlePostClick}
            className="bg-white text-primary hover:bg-white/90 font-semibold shadow-lg px-6 py-2.5 h-auto text-sm"
          >
            <Camera className="h-4 w-4 mr-2" />
            Share a Memory
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit mb-6 shadow-sm">
          <button
            onClick={() => handleTabChange("all")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "all"
                ? "bg-primary text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            Social Wall
          </button>
          <button
            onClick={() => handleTabChange("my")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "my"
                ? "bg-primary text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            My Memories
          </button>
        </div>

        {/* Invite Friends Panel — only visible on My Memories tab when logged in */}
        {tab === "my" && customer && (() => {
          const shareUrl = `${window.location.origin}${BASE_URL}/memories/share/${customer.id}`;
          const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=1a4731&bgcolor=ffffff&data=${encodeURIComponent(shareUrl)}`;
          const copyLink = () => {
            navigator.clipboard.writeText(shareUrl).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            });
          };
          return (
            <div className="mb-6">
              <button
                onClick={() => setShowInvite(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3.5 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1a4731, hsl(127,55%,38%))" }}>
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-900">Invite Friends to Contribute</p>
                    <p className="text-xs text-gray-400">Share your personal QR code or link</p>
                  </div>
                </div>
                <QrCode className={`h-4 w-4 text-gray-400 transition-transform ${showInvite ? "rotate-180" : ""}`} />
              </button>

              {showInvite && (
                <div className="mt-2 bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                  <p className="text-sm text-gray-600 mb-5 text-center max-w-sm mx-auto">
                    Friends can scan the QR code or use the link below to add photos directly to your memory book — no account needed.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    {/* QR Code */}
                    <div className="flex-shrink-0 p-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
                      <img
                        src={qrSrc}
                        alt="QR code for friend uploads"
                        className="w-[160px] h-[160px] rounded-lg"
                      />
                    </div>
                    {/* URL + copy */}
                    <div className="flex-1 min-w-0 w-full space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Your personal upload link</p>
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                          <Link2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          <span className="text-xs text-gray-600 truncate flex-1">{shareUrl}</span>
                        </div>
                      </div>
                      <button
                        onClick={copyLink}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                          copied
                            ? "bg-green-500 text-white"
                            : "bg-primary text-white hover:bg-primary/90"
                        }`}
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? "Copied!" : "Copy Link"}
                      </button>
                      <p className="text-[11px] text-gray-400 text-center">
                        Photos from friends are saved privately to your memory book only.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : memories.length === 0 ? (
          <div className="text-center py-20">
            <Camera className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              {tab === "my" ? "No memories yet" : "Be the first to share!"}
            </h3>
            <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">
              {tab === "my"
                ? "Post a photo from your outdoor adventure and it'll show up here."
                : "The adventure wall is empty. Share your first memory!"}
            </p>
            <Button
              onClick={handlePostClick}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              <Camera className="h-4 w-4 mr-2" />
              Share a Memory
            </Button>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
            {memories.map((m) => (
              <div key={m.id} className="break-inside-avoid">
                <MemoryCard
                  memory={m}
                  isOwn={m.customerId === customer?.id}
                  onDelete={(id) => {
                    if (confirm("Delete this memory?")) deleteMutation.mutate(id);
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && customer && (
        <CreateMemoryModal
          customerId={customer.id}
          customerName={customer.name}
          onClose={() => setShowCreate(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["memories"] })}
        />
      )}
    </div>
  );
}
