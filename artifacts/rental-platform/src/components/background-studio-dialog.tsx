import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wand2, CheckCircle2, AlertCircle, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { BACKGROUND_CATEGORIES, BackgroundImage } from "@/lib/background-library";
import { getAdminSession } from "@/lib/admin-nav";

interface Props {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  onApply: (newUrl: string) => void;
}

type Stage = "idle" | "removing" | "ready" | "applying" | "error";

export function BackgroundStudioDialog({ open, onClose, imageUrl, onApply }: Props) {
  const [activeCat, setActiveCat] = useState(BACKGROUND_CATEGORIES[0].id);
  const [selectedBg, setSelectedBg] = useState<BackgroundImage | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const subjectBlobRef = useRef<Blob | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const resetState = useCallback(() => {
    setStage("idle");
    setSelectedBg(null);
    setPreviewUrl(null);
    setErrorMsg("");
    subjectBlobRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) resetState();
  }, [open, resetState]);

  const removeBackground = useCallback(async (): Promise<Blob | null> => {
    if (subjectBlobRef.current) return subjectBlobRef.current;
    setStage("removing");
    try {
      const { removeBackground: removeBg } = await import("@imgly/background-removal");

      // The library requires an ABSOLUTE URL for both the image and publicPath.
      // Relative paths (e.g. "/api/uploads/…") cause `new URL(x, base)` to throw
      // "Failed to construct 'URL': Invalid base URL". Make them absolute here.
      const absoluteImage = imageUrl.startsWith("http")
        ? imageUrl
        : `${window.location.origin}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;

      const result = await removeBg(absoluteImage, {
        // Point to jsDelivr CDN for WASM/model files (1.7.0 matches installed version).
        // This avoids having to host the ~100 MB model files ourselves.
        publicPath: "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/dist/",
        output: { format: "image/png", quality: 0.9 },
      });
      subjectBlobRef.current = result;
      return result;
    } catch (err) {
      console.error("Background removal failed:", err);
      setStage("error");
      setErrorMsg("Could not remove the background. Try a photo with a clear subject.");
      return null;
    }
  }, [imageUrl]);

  const composite = useCallback(async (bg: BackgroundImage, subjectBlob: Blob): Promise<string> => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const W = 1200;
    const H = 900;
    canvas.width = W;
    canvas.height = H;

    const loadImg = (src: string): Promise<HTMLImageElement> =>
      new Promise((res, rej) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = src;
      });

    const [bgImg, subjectImg] = await Promise.all([
      loadImg(bg.url),
      loadImg(URL.createObjectURL(subjectBlob)),
    ]);

    const bgAspect = bgImg.width / bgImg.height;
    const canvasAspect = W / H;
    let sx = 0, sy = 0, sw = bgImg.width, sh = bgImg.height;
    if (bgAspect > canvasAspect) {
      sw = bgImg.height * canvasAspect;
      sx = (bgImg.width - sw) / 2;
    } else {
      sh = bgImg.width / canvasAspect;
      sy = (bgImg.height - sh) / 2;
    }
    ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, W, H);

    const scale = Math.min(W / subjectImg.width, H / subjectImg.height) * 0.85;
    const dw = subjectImg.width * scale;
    const dh = subjectImg.height * scale;
    const dx = (W - dw) / 2;
    const dy = H - dh;
    ctx.drawImage(subjectImg, dx, dy, dw, dh);

    return canvas.toDataURL("image/jpeg", 0.9);
  }, []);

  const handleSelectBg = useCallback(async (bg: BackgroundImage) => {
    setSelectedBg(bg);
    setPreviewUrl(null);
    const subjectBlob = await removeBackground();
    if (!subjectBlob) return;
    setStage("ready");
    try {
      const dataUrl = await composite(bg, subjectBlob);
      setPreviewUrl(dataUrl);
    } catch {
      setStage("error");
      setErrorMsg("Could not generate preview. Please try again.");
    }
  }, [removeBackground, composite]);

  const handleApply = useCallback(async () => {
    if (!previewUrl || !selectedBg) return;
    setStage("applying");
    try {
      const res = await fetch(previewUrl);
      const blob = await res.blob();
      const fd = new FormData();
      fd.append("file", blob, "bg-studio.jpg");
      const session = getAdminSession();
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const up = await fetch(`${base}/api/upload/image`, {
        method: "POST",
        headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
        body: fd,
      });
      if (!up.ok) throw new Error("Upload failed");
      const data = await up.json();
      onApply(data.url);
      onClose();
    } catch {
      setStage("error");
      setErrorMsg("Failed to save the image. Please try again.");
    }
  }, [previewUrl, selectedBg, onApply, onClose]);

  const currentCategory = BACKGROUND_CATEGORIES.find(c => c.id === activeCat)!;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-5xl w-full p-0 overflow-hidden">
        <canvas ref={canvasRef} className="hidden" />

        <div className="flex flex-col h-[90vh]">
          <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wand2 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base">Background Studio</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Pick an OutdoorShare background — we'll cut out your subject and place it in the scene.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-1 overflow-hidden">
            {/* ── Left: Preview ── */}
            <div className="w-[44%] shrink-0 bg-gray-950 flex flex-col items-center justify-center p-5 gap-4">
              {stage === "error" ? (
                <div className="flex flex-col items-center gap-3 text-center px-4">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  </div>
                  <p className="text-sm text-red-300 font-medium">{errorMsg}</p>
                  <Button size="sm" variant="outline" className="border-gray-600 text-gray-300" onClick={resetState}>
                    Try Again
                  </Button>
                </div>
              ) : previewUrl ? (
                <div className="w-full rounded-xl overflow-hidden shadow-2xl border border-white/10 relative">
                  <img src={previewUrl} alt="Preview" className="w-full object-cover" />
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-primary/90 text-white text-[10px] font-bold px-2 py-0.5">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Preview
                    </Badge>
                  </div>
                </div>
              ) : stage === "removing" ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Loader2 className="w-7 h-7 text-primary animate-spin" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">Removing background…</p>
                    <p className="text-xs text-gray-500 mt-1">AI is processing your photo</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 w-full">
                  <div className="w-full rounded-xl overflow-hidden shadow-xl border border-white/10">
                    <img src={imageUrl} alt="Original" className="w-full object-cover" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <p className="text-xs text-gray-400">Select a background to see preview</p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Right: Background library ── */}
            <div className="flex-1 flex flex-col overflow-hidden border-l">
              {/* Category tabs */}
              <div className="flex gap-0 overflow-x-auto shrink-0 border-b bg-gray-50">
                {BACKGROUND_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCat(cat.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors",
                      activeCat === cat.id
                        ? "border-primary text-primary bg-white"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-gray-100"
                    )}
                  >
                    <span>{cat.emoji}</span>
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Background grid */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-3 gap-2.5">
                  {currentCategory.images.map(bg => {
                    const isSelected = selectedBg?.id === bg.id;
                    return (
                      <button
                        key={bg.id}
                        type="button"
                        disabled={stage === "removing" || stage === "applying"}
                        onClick={() => handleSelectBg(bg)}
                        className={cn(
                          "relative rounded-lg overflow-hidden aspect-[4/3] border-2 transition-all focus:outline-none",
                          isSelected
                            ? "border-primary ring-2 ring-primary/30 scale-[0.97]"
                            : "border-transparent hover:border-primary/40 hover:scale-[0.97]"
                        )}
                      >
                        <img
                          src={bg.thumb}
                          alt={bg.label}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
                              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                          <p className="text-[10px] text-white font-medium truncate">{bg.label}</p>
                        </div>
                        {stage === "removing" && isSelected && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 text-white animate-spin" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-100">
                  <div className="flex items-start gap-2">
                    <ImagePlus className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-blue-700 leading-relaxed">
                      Background removal works best with clear, well-lit photos against a contrasting background. The original photo is never modified.
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer actions */}
              <div className="shrink-0 border-t bg-white px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  {selectedBg && previewUrl
                    ? <span className="text-primary font-medium">✓ Preview ready — click Apply to save</span>
                    : selectedBg
                    ? <span>Generating preview…</span>
                    : <span>Choose a background from the library</span>
                  }
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!previewUrl || stage === "applying"}
                    onClick={handleApply}
                    className="bg-primary hover:bg-primary/90 text-white"
                  >
                    {stage === "applying" ? (
                      <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving…</>
                    ) : (
                      <><Wand2 className="w-3.5 h-3.5 mr-1.5" /> Apply Background</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
