import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, RotateCcw, ChevronRight, AlertCircle, X, Loader2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Props {
  files: File[];
  onDone: (uploaded: string[]) => void;
  uploadFn: (blob: Blob, filename: string) => Promise<string>;
  onCancel?: () => void;
  onUploadError?: (filename: string, error: string) => void;
  /** Crop aspect ratio width/height. Default 4/3. Use 1 for square logos. */
  aspect?: number;
  /** Output pixel width of the saved image. Default 1200. */
  outputWidth?: number;
}

// Single object for zoom + position so they always update atomically in one
// setState call. Two separate setState calls (scale + offset) can produce a
// frame where scale is already updated but offset is still stale — causing the
// image to visually jump sideways before the second update paints.
type View = { scale: number; ox: number; oy: number };

// ── Component ─────────────────────────────────────────────────────────────────
export function ImageCropDialog({
  files,
  onDone,
  uploadFn,
  onCancel,
  onUploadError,
  aspect = 4 / 3,
  outputWidth = 1200,
}: Props) {
  const ASPECT   = aspect;
  const OUTPUT_W = outputWidth;
  const OUTPUT_H = Math.round(OUTPUT_W / ASPECT);

  const [queueIdx, setQueueIdx]         = useState(0);
  const [imgSrc, setImgSrc]             = useState<string>("");
  const [naturalW, setNaturalW]         = useState(0);
  const [naturalH, setNaturalH]         = useState(0);

  // ── SINGLE atomic view state ── scale + position always update together ──
  const [view, setView]                 = useState<View>({ scale: 1, ox: 0, oy: 0 });

  const [dragging, setDragging]         = useState(false);
  const [collected, setCollected]       = useState<string[]>([]);
  const [processing, setProcessing]     = useState(false);
  const [uploadError, setUploadError]   = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError]     = useState<string | null>(null);

  // Container pixel dimensions — driven by ResizeObserver
  const [frameW, setFrameW] = useState(0);
  const frameH = frameW > 0 ? Math.round(frameW / ASPECT) : 0;

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef      = useRef({ startX: 0, startY: 0, ox: 0, oy: 0 });
  const blobUrlRef   = useRef<string>("");

  // Mirror refs — event handlers read these to avoid stale closures.
  // viewRef always matches the latest committed view state.
  const viewRef      = useRef<View>({ scale: 1, ox: 0, oy: 0 });
  const frameWRef    = useRef(0);
  const naturalWRef  = useRef(0);
  const naturalHRef  = useRef(0);

  // ── Measure container ─────────────────────────────────────────────────────
  // offsetWidth is transform-immune (Radix Dialog's scale() animation cannot
  // distort it), so we always get the true layout width.
  const measureContainer = useCallback((): number => {
    const el = containerRef.current;
    return el ? el.offsetWidth : 0;
  }, []);

  // ── ResizeObserver ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (w > 0) { frameWRef.current = w; setFrameW(w); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Apply view atomically ─────────────────────────────────────────────────
  // ALL updates to zoom/position go through this one function so React always
  // receives a single setState call — no intermediate "scale updated, offset
  // not yet" renders.
  const applyView = useCallback((v: View) => {
    viewRef.current = v;
    setView(v);
  }, []);

  // ── Clamp helpers ─────────────────────────────────────────────────────────
  const clampOx = (ox: number, sc: number, nw: number, fw: number) =>
    Math.min(0, Math.max(fw - nw * sc, ox));
  const clampOy = (oy: number, sc: number, nh: number, fh: number) =>
    Math.min(0, Math.max(fh - nh * sc, oy));

  // ── Center helper ─────────────────────────────────────────────────────────
  const centerImage = useCallback(
    (nw: number, nh: number, fw: number, fh: number) => {
      if (!nw || !nh || !fw || !fh) return;
      const sc = Math.max(fw / nw, fh / nh);
      const ox = clampOx((fw - nw * sc) / 2, sc, nw, fw);
      const oy = clampOy((fh - nh * sc) / 2, sc, nh, fh);
      applyView({ scale: sc, ox, oy });
    },
    [applyView]
  );

  const currentFile = files[queueIdx];

  // ── Preload image off-DOM before mounting ─────────────────────────────────
  useEffect(() => {
    if (!currentFile) return;

    setImageLoading(true);
    setImageError(null);
    setImgSrc("");
    setNaturalW(0); naturalWRef.current = 0;
    setNaturalH(0); naturalHRef.current = 0;
    applyView({ scale: 1, ox: 0, oy: 0 });
    setUploadError(null);

    const url = URL.createObjectURL(currentFile);
    blobUrlRef.current = url;
    let cancelled = false;

    console.info("[crop] preloading image", {
      name: currentFile.name,
      type: currentFile.type,
      sizeBytes: currentFile.size,
    });

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      console.info("[crop] image preloaded", { nw, nh, name: currentFile.name });

      requestAnimationFrame(() => {
        if (cancelled) return;
        const fw = measureContainer();
        const fh = fw > 0 ? Math.round(fw / ASPECT) : 0;
        console.info("[crop] container measured (offsetWidth)", { fw, fh });
        naturalWRef.current = nw;
        naturalHRef.current = nh;
        setNaturalW(nw);
        setNaturalH(nh);
        setImgSrc(url);
        if (fw > 0 && fh > 0) {
          frameWRef.current = fw;
          setFrameW(fw);
          centerImage(nw, nh, fw, fh);
        }
        setImageLoading(false);
      });
    };

    img.onerror = (e) => {
      if (cancelled) return;
      console.error("[crop] image preload failed", {
        name: currentFile.name,
        type: currentFile.type,
        event: String(e),
      });
      const msg =
        currentFile.type === "image/heic" || currentFile.type === "image/heif"
          ? "HEIC photos are not supported. Please convert to JPG or PNG first."
          : "Could not load this image for cropping. Try a different file.";
      setImageError(msg);
      setImageLoading(false);
      URL.revokeObjectURL(url);
      blobUrlRef.current = "";
    };

    img.src = url;

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
      blobUrlRef.current = "";
    };
  }, [currentFile, ASPECT, measureContainer, centerImage, applyView]);

  // ── Re-center when frame resizes (window resize) ──────────────────────────
  useEffect(() => {
    if (!naturalW || !naturalH || !frameW || !frameH) return;
    centerImage(naturalW, naturalH, frameW, frameH);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameW, frameH]);

  // ── DOM img onLoad (safety net) ───────────────────────────────────────────
  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: nw, naturalHeight: nh } = e.currentTarget;
    console.info("[crop] DOM img onLoad", { nw, nh });
    if (nw > 0 && nh > 0 && !naturalW) {
      const fw = frameW > 0 ? frameW : measureContainer();
      const fh = fw > 0 ? Math.round(fw / ASPECT) : 0;
      if (fw > 0) {
        setFrameW(fw);
        setNaturalW(nw);
        setNaturalH(nh);
        centerImage(nw, nh, fw, fh);
      }
    }
  };

  const handleImgError = () => {
    console.error("[crop] DOM img onError", { imgSrc, name: currentFile?.name });
    setImageError("Could not display this image. Please try a different file.");
    setImageLoading(false);
  };

  // ── Derived zoom bounds ───────────────────────────────────────────────────
  const minScale = naturalW && naturalH && frameW && frameH
    ? Math.max(frameW / naturalW, frameH / naturalH)
    : 1;
  const maxScale = minScale * 3;

  // ── Zoom ──────────────────────────────────────────────────────────────────
  // Reads all values from refs (never stale). Updates scale AND offset in ONE
  // applyView() call so there is no intermediate render where only one changes.
  //
  // Center-zoom math:
  //   imgPixelAtFrameCenter = (frameCenter - offset) / prevScale
  //   newOffset             = frameCenter - imgPixelAtFrameCenter * newScale
  const handleZoom = useCallback(
    (newScale: number) => {
      const fw = frameWRef.current;
      const fh = fw > 0 ? Math.round(fw / ASPECT) : 0;
      const nw = naturalWRef.current;
      const nh = naturalHRef.current;
      const prev = viewRef.current;

      const mn = (nw && nh && fw && fh) ? Math.max(fw / nw, fh / nh) : 1;
      const mx = mn * 3;
      const sc = Math.max(mn, Math.min(mx, newScale));

      const cx = fw / 2;
      const cy = fh / 2;
      const imgCx = (cx - prev.ox) / prev.scale;
      const imgCy = (cy - prev.oy) / prev.scale;
      const ox = clampOx(cx - imgCx * sc, sc, nw, fw);
      const oy = clampOy(cy - imgCy * sc, sc, nh, fh);

      console.info("[crop] zoom", { prevScale: prev.scale, sc, cx, imgCx, ox, fw });

      // Single applyView call — scale + offset update in one setState, no split frames
      applyView({ scale: sc, ox, oy });
    },
    [ASPECT, applyView]
  );

  const handleReset = () => {
    centerImage(
      naturalWRef.current, naturalHRef.current,
      frameWRef.current,
      frameWRef.current > 0 ? Math.round(frameWRef.current / ASPECT) : 0
    );
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    handleZoom(viewRef.current.scale * (e.deltaY < 0 ? 1.08 : 0.92));
  };

  // ── Drag (mouse) ──────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      ox: viewRef.current.ox, oy: viewRef.current.oy,
    };
  };
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const fw = frameWRef.current;
    const fh = fw > 0 ? Math.round(fw / ASPECT) : 0;
    const nw = naturalWRef.current;
    const nh = naturalHRef.current;
    const sc = viewRef.current.scale;
    applyView({
      scale: sc,
      ox: clampOx(dragRef.current.ox + dx, sc, nw, fw),
      oy: clampOy(dragRef.current.oy + dy, sc, nh, fh),
    });
  }, [dragging, ASPECT, applyView]);
  const onMouseUp = () => setDragging(false);

  // ── Drag (touch) ──────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    setDragging(true);
    dragRef.current = {
      startX: t.clientX, startY: t.clientY,
      ox: viewRef.current.ox, oy: viewRef.current.oy,
    };
  };
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging) return;
    const t = e.touches[0];
    const dx = t.clientX - dragRef.current.startX;
    const dy = t.clientY - dragRef.current.startY;
    const fw = frameWRef.current;
    const fh = fw > 0 ? Math.round(fw / ASPECT) : 0;
    const nw = naturalWRef.current;
    const nh = naturalHRef.current;
    const sc = viewRef.current.scale;
    applyView({
      scale: sc,
      ox: clampOx(dragRef.current.ox + dx, sc, nw, fw),
      oy: clampOy(dragRef.current.oy + dy, sc, nh, fh),
    });
  }, [dragging, ASPECT, applyView]);
  const onTouchEnd = () => setDragging(false);

  // ── Crop & upload ─────────────────────────────────────────────────────────
  const doCrop = useCallback(async () => {
    if (!naturalW || !naturalH || !imgSrc || !frameW || !frameH) return;
    setProcessing(true);
    setUploadError(null);

    console.info("[crop] starting crop+upload", {
      name: currentFile?.name,
      frameW, frameH, naturalW, naturalH,
      scale: viewRef.current.scale,
    });

    try {
      const canvas = document.createElement("canvas");
      canvas.width  = OUTPUT_W;
      canvas.height = OUTPUT_H;
      const ctx = canvas.getContext("2d")!;

      let source: ImageBitmap | HTMLImageElement;
      try {
        source = await createImageBitmap(currentFile, { imageOrientation: "from-image" } as any);
      } catch {
        const img = new Image();
        await new Promise<void>(res => { img.onload = () => res(); img.src = imgSrc; });
        source = img;
      }

      const { scale: sc, ox, oy } = viewRef.current;
      const fw = frameWRef.current;
      const fh = fw > 0 ? Math.round(fw / ASPECT) : 0;
      const srcX = -ox / sc;
      const srcY = -oy / sc;
      const srcW = fw / sc;
      const srcH = fh / sc;

      ctx.drawImage(source as any, srcX, srcY, srcW, srcH, 0, 0, OUTPUT_W, OUTPUT_H);

      const isPng    = currentFile.type === "image/png";
      const mimeType = isPng ? "image/png" : "image/jpeg";
      const ext      = isPng ? ".png" : ".jpg";
      const blob     = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(b => (b ? res(b) : rej(new Error("canvas toBlob failed"))), mimeType, 0.95)
      );
      const url = await uploadFn(blob, currentFile.name.replace(/\.[^.]+$/, ext));

      console.info("[crop] upload succeeded", { url, name: currentFile?.name });
      advance([...collected, url]);
    } catch (err: any) {
      const msg = err?.message?.includes("413")
        ? "File too large (max 5 MB)"
        : err?.message?.includes("Upload failed")
        ? "Upload failed — check your connection and try again"
        : "Upload failed — please try again";
      console.error("[crop] crop+upload failed", { error: err?.message, name: currentFile?.name });
      setUploadError(msg);
      onUploadError?.(currentFile.name, msg);
    } finally {
      setProcessing(false);
    }
  }, [naturalW, naturalH, imgSrc, frameW, frameH, currentFile, collected, uploadFn, onUploadError, OUTPUT_W, OUTPUT_H, ASPECT]);

  const skipFile = () => advance(collected);

  const advance = (newCollected: string[]) => {
    const next = queueIdx + 1;
    if (next >= files.length) {
      onDone(newCollected);
    } else {
      setCollected(newCollected);
      setQueueIdx(next);
    }
  };

  if (!currentFile) return null;

  const isReady  = !imageLoading && !imageError && imgSrc && naturalW > 0 && frameW > 0;
  const zoomPct  = isReady && minScale < maxScale
    ? Math.round(((view.scale - minScale) / (maxScale - minScale)) * 100)
    : 0;

  return (
    <Dialog open onOpenChange={open => { if (!open) onCancel?.(); }}>
      <DialogContent className="max-w-[540px] p-0 overflow-hidden gap-0">

        {/* ── Header ── */}
        <DialogHeader className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base">Adjust Photo</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Drag to reposition · scroll or pinch to zoom
                {files.length > 1 && (
                  <span className="ml-2 font-semibold text-foreground">
                    {queueIdx + 1} of {files.length}
                  </span>
                )}
              </DialogDescription>
            </div>
            {onCancel && (
              <button
                type="button"
                aria-label="Close"
                onClick={onCancel}
                className="rounded-full p-1 hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </DialogHeader>

        {/* ── Crop canvas ── */}
        <div
          ref={containerRef}
          className="relative select-none w-full"
          style={{
            aspectRatio: `${ASPECT}`,
            background: "repeating-conic-gradient(#b0b0b0 0% 25%, #e8e8e8 0% 50%) 0 0 / 20px 20px",
          }}
        >
          {/* Loading state */}
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/60">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Image load error */}
          {imageError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
              <p className="text-sm font-medium text-destructive">{imageError}</p>
              <Button size="sm" variant="outline" onClick={skipFile}>
                Skip this photo
              </Button>
            </div>
          )}

          {/* Interactive drag area */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
            onMouseDown={isReady ? onMouseDown : undefined}
            onMouseMove={isReady ? onMouseMove : undefined}
            onMouseUp={isReady ? onMouseUp : undefined}
            onMouseLeave={isReady ? onMouseUp : undefined}
            onTouchStart={isReady ? onTouchStart : undefined}
            onTouchMove={isReady ? onTouchMove : undefined}
            onTouchEnd={isReady ? onTouchEnd : undefined}
            onWheel={isReady ? onWheel : undefined}
          >
            {imgSrc && (
              <img
                src={imgSrc}
                onLoad={handleImgLoad}
                onError={handleImgError}
                draggable={false}
                className="absolute pointer-events-none transition-opacity duration-150"
                style={{
                  left:           view.ox,
                  top:            view.oy,
                  width:          naturalW * view.scale || "auto",
                  height:         naturalH * view.scale || "auto",
                  opacity:        isReady ? 1 : 0,
                  imageRendering: "auto",
                }}
              />
            )}

            {/* Rule-of-thirds overlay */}
            {isReady && (
              <svg className="absolute inset-0 pointer-events-none opacity-30" width="100%" height="100%">
                <line x1="33.33%" y1="0" x2="33.33%" y2="100%" stroke="white" strokeWidth="0.5" />
                <line x1="66.66%" y1="0" x2="66.66%" y2="100%" stroke="white" strokeWidth="0.5" />
                <line x1="0" y1="33.33%" x2="100%" y2="33.33%" stroke="white" strokeWidth="0.5" />
                <line x1="0" y1="66.66%" x2="100%" y2="66.66%" stroke="white" strokeWidth="0.5" />
              </svg>
            )}
          </div>
        </div>

        {/* ── Zoom controls ── */}
        <div className="px-5 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleZoom(viewRef.current.scale * 0.9)}
            disabled={!isReady || view.scale <= minScale + 0.001}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <Slider
            value={[zoomPct]}
            min={0}
            max={100}
            step={1}
            disabled={!isReady}
            onValueChange={([v]) => handleZoom(minScale + (v / 100) * (maxScale - minScale))}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => handleZoom(viewRef.current.scale * 1.1)}
            disabled={!isReady || view.scale >= maxScale - 0.001}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={!isReady}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors ml-1"
            title="Reset zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── Upload error ── */}
        {uploadError && (
          <div className="mx-5 mb-3 flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">{uploadError}</p>
              <p className="text-xs text-destructive/70 mt-0.5">Try again or skip this photo.</p>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <DialogFooter className="px-5 pb-5 flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={skipFile}
            disabled={processing}
            className="text-muted-foreground"
          >
            {uploadError ? "Skip this photo" : "Skip"}
          </Button>
          <Button
            type="button"
            onClick={doCrop}
            disabled={processing || !isReady}
            className="flex-1 gap-1.5"
          >
            {processing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : uploadError ? (
              "Try again"
            ) : files.length > 1 && queueIdx < files.length - 1 ? (
              <>Use this crop <ChevronRight className="w-3.5 h-3.5" /></>
            ) : (
              "Use this crop"
            )}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
