import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "wouter";
import { Camera, Upload, CheckCircle2, ImagePlus, X, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type PickupInfo = {
  bookingId: number;
  customerName: string;
  startDate: string;
  endDate: string;
  listingTitle: string;
  listingImage: string | null;
  companyName: string;
  logoUrl: string | null;
  pickupCompleted: boolean;
  pickupPhotos: string[];
};

export default function PickupPage() {
  const params = useParams<{ slug: string; token: string }>();
  const { slug, token } = params;

  const [info, setInfo] = useState<PickupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [staged, setStaged] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [savedPhotos, setSavedPhotos] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${BASE}/api/pickup/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); }
        else {
          setInfo(data);
          if (data.pickupCompleted) {
            setDone(true);
            setSavedPhotos(data.pickupPhotos);
          }
        }
        setLoading(false);
      })
      .catch(() => { setError("Failed to load pickup info"); setLoading(false); });
  }, [token]);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (valid.length === 0) return;
    setStaged(prev => [...prev, ...valid]);
    valid.forEach(f => {
      const reader = new FileReader();
      reader.onload = e => setPreviews(prev => [...prev, e.target?.result as string]);
      reader.readAsDataURL(f);
    });
  }, []);

  const removeStaged = (idx: number) => {
    setStaged(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  const submit = async () => {
    if (staged.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      staged.forEach(f => formData.append("photos", f));
      const r = await fetch(`${BASE}/api/pickup/${token}/photos`, { method: "POST", body: formData });
      const data = await r.json();
      if (!r.ok || data.error) { alert(data.error ?? "Upload failed"); return; }
      setSavedPhotos(data.photos);
      setDone(true);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin mx-auto mb-3" />
        <p className="text-gray-600">Loading pickup info…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow p-8 max-w-md w-full text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Link Not Found</h2>
        <p className="text-gray-500">{error}</p>
      </div>
    </div>
  );

  if (!info) return null;

  const brandColor = "#3ab549";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          {info.logoUrl ? (
            <img src={info.logoUrl} alt={info.companyName} className="h-8 object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: brandColor }}>
              {info.companyName.charAt(0)}
            </div>
          )}
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">{info.companyName}</p>
            <p className="text-xs text-gray-500">Pickup Photo Check</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* Booking info card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {info.listingImage && (
            <div className="h-40 bg-gray-100 overflow-hidden">
              <img src={info.listingImage} alt={info.listingTitle} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-4">
            <h2 className="font-bold text-gray-900 text-lg">{info.listingTitle}</h2>
            <p className="text-gray-600 text-sm mt-0.5">Hi {info.customerName}</p>
            <div className="flex gap-4 mt-3">
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Pickup</p>
                <p className="text-sm font-semibold text-gray-800">{info.startDate}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Return</p>
                <p className="text-sm font-semibold text-gray-800">{info.endDate}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Done / Success state */}
        {done ? (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-6 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: brandColor }} />
              <h3 className="text-xl font-bold text-gray-900 mb-1">Photos Submitted!</h3>
              <p className="text-gray-500 text-sm">
                Your {savedPhotos.length} photo{savedPhotos.length !== 1 ? "s" : ""} have been saved and linked to your booking. You're all set for pickup!
              </p>
            </div>
            {savedPhotos.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Your submitted photos</p>
                <div className="grid grid-cols-3 gap-2">
                  {savedPhotos.map((url, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                      <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-center text-xs text-gray-400">
              Powered by OutdoorShare — photos protect both you and the equipment owner.
            </p>
          </div>
        ) : (
          <>
            {/* Instructions */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start gap-3">
                <Camera className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: brandColor }} />
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Document the equipment condition</p>
                  <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">
                    These photos protect you in case of any damage claims. Photograph all sides and any existing damage.
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {["All sides — front, back, left, right", "Any pre-existing scratches or dents", "Serial numbers or identifying marks"].map(tip => (
                      <li key={tip} className="text-xs text-gray-500 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full inline-block flex-shrink-0" style={{ background: brandColor }} />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Upload area */}
            <div
              className="bg-white rounded-2xl shadow-sm border-2 border-dashed border-gray-200 p-8 text-center cursor-pointer transition-colors hover:border-green-400 hover:bg-green-50/30"
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="font-semibold text-gray-700">Tap to add photos</p>
              <p className="text-xs text-gray-400 mt-1">or drag and drop — JPG, PNG, HEIC supported</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => addFiles(e.target.files)}
                capture="environment"
              />
            </div>

            {/* Staged preview grid */}
            {previews.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">{previews.length} photo{previews.length !== 1 ? "s" : ""} ready to upload</p>
                <div className="grid grid-cols-3 gap-2">
                  {previews.map((src, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 group">
                      <img src={src} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={e => { e.stopPropagation(); removeStaged(i); }}
                        className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center hover:border-green-400 transition-colors"
                  >
                    <ImagePlus className="w-6 h-6 text-gray-300" />
                  </button>
                </div>
              </div>
            )}

            {/* Submit button */}
            <Button
              onClick={submit}
              disabled={staged.length === 0 || uploading}
              className="w-full py-6 text-base font-bold rounded-2xl"
              style={{ background: staged.length > 0 ? brandColor : undefined }}
            >
              {uploading ? (
                <><Loader2 className="w-5 h-5 animate-spin mr-2" />Uploading…</>
              ) : (
                <><Upload className="w-5 h-5 mr-2" />Submit {staged.length > 0 ? `${staged.length} Photo${staged.length !== 1 ? "s" : ""}` : "Photos"}</>
              )}
            </Button>

            {staged.length === 0 && (
              <p className="text-center text-xs text-gray-400">At least 1 photo required to proceed</p>
            )}

            <p className="text-center text-xs text-gray-400">
              Powered by OutdoorShare — your photos are securely stored and linked to Booking #{info.bookingId}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
