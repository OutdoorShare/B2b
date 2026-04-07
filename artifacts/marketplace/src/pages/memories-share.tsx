import { useState, useRef } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Camera, ImagePlus, Loader2, CheckCircle, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = "/api";

async function fetchProfile(customerId: string) {
  const res = await fetch(`${API}/memories/profile/${customerId}`);
  if (!res.ok) throw new Error("Not found");
  return res.json() as Promise<{ id: number; name: string }>;
}

async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}/upload/image`, { method: "POST", body: form });
  if (!res.ok) throw new Error("Upload failed");
  const { url } = await res.json();
  return url;
}

export function MemoriesSharePage() {
  const { customerId } = useParams<{ customerId: string }>();

  const { data: profile, isLoading: profileLoading, isError } = useQuery({
    queryKey: ["memory-profile", customerId],
    queryFn: () => fetchProfile(customerId!),
    enabled: !!customerId,
  });

  const [yourName, setYourName] = useState("");
  const [caption, setCaption] = useState("");
  const [photos, setPhotos] = useState<{ file: File; preview: string; url?: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const added = Array.from(files).slice(0, 4 - photos.length);
    const newPhotos = added.map(f => ({ file: f, preview: URL.createObjectURL(f) }));
    setPhotos(p => [...p, ...newPhotos]);
  };

  const removePhoto = (i: number) => {
    setPhotos(p => {
      URL.revokeObjectURL(p[i].preview);
      return p.filter((_, idx) => idx !== i);
    });
  };

  const handleSubmit = async () => {
    if (!yourName.trim()) { setError("Please enter your name."); return; }
    if (photos.length === 0) { setError("Please add at least one photo."); return; }
    setError(null);
    setUploading(true);
    try {
      const photoUrls = await Promise.all(photos.map(p => uploadImage(p.file)));
      const res = await fetch(`${API}/memories/guest-upload/${customerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrls, caption: caption.trim() || null, contributorName: yourName.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to share");
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-center px-4">
        <div>
          <div className="text-4xl mb-3">🏔️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Link not found</h2>
          <p className="text-sm text-gray-500">This share link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg"
            style={{ background: "linear-gradient(135deg, #1a4731, hsl(127,55%,38%))" }}
          >
            <CheckCircle className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Memory shared!</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            Your photo has been added to <strong>{profile.name}</strong>'s memory book. They'll see it in their private memories.
          </p>
          <Button
            className="mt-6 bg-primary hover:bg-primary/90 text-white"
            onClick={() => { setDone(false); setPhotos([]); setCaption(""); setYourName(""); }}
          >
            Share another memory
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div
        className="relative text-white overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1a4731 0%, hsl(127,55%,38%) 60%, hsl(197,78%,48%) 100%)" }}
      >
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="relative max-w-lg mx-auto px-4 py-12 text-center">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <img src={`${BASE_URL}/outdoorshare-icon.png`} alt="OutdoorShare" className="h-9 w-9 object-contain drop-shadow-md" />
            <span className="text-xs font-bold tracking-[0.2em] uppercase text-white/70">OutdoorShare</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1">Add to {profile.name}'s</h1>
          <p className="text-lg font-semibold text-white/80">Adventure Memory Book</p>
          <p className="text-white/60 text-xs mt-2">Your photos will be added privately to their memory collection</p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
        {/* Your name */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Your name <span className="text-red-500">*</span></label>
          <Input
            value={yourName}
            onChange={e => setYourName(e.target.value)}
            placeholder="e.g. Jake"
            className="h-10"
          />
        </div>

        {/* Photos */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Photos <span className="text-red-500">*</span>
            <span className="text-xs font-normal text-gray-400 ml-1">({photos.length}/4)</span>
          </label>

          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {photos.map((p, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                  <img src={p.preview} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute top-1.5 right-1.5 bg-black/50 rounded-full p-0.5 hover:bg-black/70 transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              ))}
              {photos.length < 4 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-primary hover:text-primary transition-colors"
                >
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-xs">Add more</span>
                </button>
              )}
            </div>
          )}

          {photos.length === 0 && (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full h-36 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-primary hover:text-primary transition-colors"
            >
              <Camera className="h-8 w-8" />
              <span className="text-sm font-medium">Tap to add photos</span>
              <span className="text-xs">JPEG, PNG or WebP · up to 4</span>
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={e => addPhotos(e.target.files)}
          />
        </div>

        {/* Caption */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Caption <span className="text-gray-400 font-normal">(optional)</span></label>
          <Textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="What happened on this adventure?"
            className="resize-none h-20 text-sm"
            maxLength={300}
          />
          <p className="text-right text-xs text-gray-400 mt-1">{caption.length}/300</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={uploading || photos.length === 0 || !yourName.trim()}
          className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold text-base shadow-md"
        >
          {uploading ? (
            <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Uploading photos…</>
          ) : (
            <><Upload className="h-5 w-5 mr-2" /> Share Memory with {profile.name}</>
          )}
        </Button>
      </div>
    </div>
  );
}
