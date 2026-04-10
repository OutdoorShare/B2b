import { useState, useCallback, useRef } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Upload, ZoomIn, Check, X } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function createImageBitmap(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function cropImageToBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImageBitmap(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0,
    pixelCrop.width, pixelCrop.height
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas crop failed"));
    }, "image/jpeg", 0.92);
  });
}

interface Props {
  onUploaded: (url: string) => void;
  token?: string;
  accept?: string;
  label?: string;
  className?: string;
}

export function ImageUploadCrop({ onUploaded, token, label = "Upload Photo", className = "" }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleCancel() {
    setOpen(false);
    setImageSrc(null);
  }

  async function handleApply() {
    if (!imageSrc || !croppedAreaPixels) return;
    setUploading(true);
    try {
      const blob = await cropImageToBlob(imageSrc, croppedAreaPixels);
      const formData = new FormData();
      formData.append("file", blob, "evidence.jpg");
      const headers: Record<string, string> = {};
      if (token) headers["x-admin-token"] = token;
      const res = await fetch(`${BASE}/api/upload/image`, { method: "POST", headers, body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      onUploaded(data.url);
      setOpen(false);
      setImageSrc(null);
    } catch {
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`gap-1.5 ${className}`}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-3.5 h-3.5" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={v => { if (!v) handleCancel(); }}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden" aria-describedby="crop-description">
          <DialogHeader className="px-5 pt-5 pb-4 border-b">
            <DialogTitle>Crop Photo</DialogTitle>
            <p id="crop-description" className="text-sm text-muted-foreground">
              Drag to reposition · Scroll or use the slider to zoom
            </p>
          </DialogHeader>

          {/* Crop canvas */}
          <div className="relative w-full bg-black" style={{ height: 340 }}>
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={4 / 3}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                style={{
                  containerStyle: { background: "#000" },
                }}
              />
            )}
          </div>

          {/* Zoom slider */}
          <div className="px-5 py-4 border-t bg-muted/40">
            <div className="flex items-center gap-3">
              <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
              <Slider
                min={1}
                max={3}
                step={0.05}
                value={[zoom]}
                onValueChange={([v]) => setZoom(v)}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-10 text-right">{zoom.toFixed(1)}×</span>
            </div>
          </div>

          <DialogFooter className="px-5 py-4 border-t gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleCancel} className="gap-1.5">
              <X className="w-3.5 h-3.5" /> Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleApply} disabled={uploading} className="gap-1.5">
              {uploading ? (
                <>Uploading…</>
              ) : (
                <><Check className="w-3.5 h-3.5" /> Apply & Upload</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
