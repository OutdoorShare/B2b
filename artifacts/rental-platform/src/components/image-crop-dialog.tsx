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
  const [scale, setScale]               = useState(1);
  const [offset, setOffset]             = useState({ x: 0, y: 0 });
  const [dragging, setDragging]         = useState(false);
  const [collected, setCollected]       = useState<string[]>([]);
  const [processing, setProcessing]     = useState(false);
  const [uploadError, setUploadError]   = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError]     = useState<string | null>(null);

  // Container pixel dimensions — driven by ResizeObserver + onLoad measurement
  const [frameW, setFrameW] = useState(0);
  const frameH = frameW > 0 ? Math.round(frameW / ASPECT) : 0;

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef      = useRef({ startX: 0, startY: 0, ox: 0, oy: 0 });
  const blobUrlRef   = useRef<string>("");   // tracks current blob URL for revoke

  // ── Measure container helper ──────────────────────────────────────────────
  const measureContainer = useCallback((): number => {
    const el = containerRef.current;
    if (!el) return 0;
    const { width } = el.getBoundingClientRect();
    return Math.round(width);
  }, []);

  // ── ResizeObserver for window/container resizes ───────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = measureContainer();
      if (w > 0) setFrameW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [measureContainer]);

  // ── Clamp helper ──────────────────────────────────────────────────────────
  const clampXY = useCallback(
    (ox: number, oy: number, sc: number, nw: number, nh: number, fw: number, fh: number) => ({
      x: Math.min(0, Math.max(fw - nw * sc, ox)),
      y: Math.min(0, Math.max(fh - nh * sc, oy)),
    }),
    []
  );

  // ── Center helper (called from multiple places) ───────────────────────────
  const centerImage = useCallback(
    (nw: number, nh: number, fw: number, fh: number) => {
      if (!nw || !nh || !fw || !fh) return;
      const sc = Math.max(fw / nw, fh / nh);
      const ox = (fw - nw * sc) / 2;
      const oy = (fh - nh * sc) / 2;
      setScale(sc);
      setOffset(clampXY(ox, oy, sc, nw, nh, fw, fh));
    },
    [clampXY]
  );

  const currentFile = files[queueIdx];

  // ── Preload image off-DOM before mounting it in the crop canvas ───────────
  // This eliminates the ResizeObserver race condition: by the time imgSrc is
  // set, we already know naturalW/H. And we measure the container at that
  // moment instead of relying on the observer having fired first.
  useEffect(() => {
    if (!currentFile) return;

    setImageLoading(true);
    setImageError(null);
    setImgSrc("");
    setNaturalW(0);
    setNaturalH(0);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setUploadError(null);

    const url = URL.createObjectURL(currentFile);
    blobUrlRef.current = url;
    let cancelled = false;

    console.info("[crop] preloading image", {
      name: currentFile.name,
      type: currentFile.type,
      sizeBytes: currentFile.size,
      blobUrl: url,
    });

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      console.info("[crop] image preloaded", { nw, nh, name: currentFile.name });

      // Use requestAnimationFrame so the Dialog finishes its opening animation
      // and the container has its final layout width before we measure.
      requestAnimationFrame(() => {
        if (cancelled) return;

        const fw = measureContainer();
        const fh = fw > 0 ? Math.round(fw / ASPECT) : 0;

        console.info("[crop] container measured", { fw, fh });

        setImgSrc(url);
        setNaturalW(nw);
        setNaturalH(nh);
        if (fw > 0 && fh > 0) {
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
  }, [currentFile, ASPECT, measureContainer, centerImage]);

  // ── Re-center when frameW changes (window resize) ─────────────────────────
  useEffect(() => {
    if (!naturalW || !naturalH || !frameW || !frameH) return;
    centerImage(naturalW, naturalH, frameW, frameH);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameW, frameH]); // intentionally only on frame changes, not every centerImage ref change

  // ── onLoad fired by the DOM <img> — re-measure as a safety net ───────────
  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: nw, naturalHeight: nh } = e.currentTarget;
    console.info("[crop] DOM img onLoad", { nw, nh });
    // If the preload already set dimensions, this is a no-op.
    // If somehow preload didn't fire, catch up here.
    if (nw > 0 && nh > 0) {
      const fw = frameW > 0 ? frameW : measureContainer();
      const fh = fw > 0 ? Math.round(fw / ASPECT) : 0;
      if (fw > 0 && !naturalW) {
        setFrameW(fw);
        setNaturalW(nw);
        setNaturalH(nh);
        centerImage(nw, nh, fw, fh);
      }
    }
  };

  // ── onError fired by the DOM <img> ───────────────────────────────────────
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

  // ── Drag (mouse) ──────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setOffset(() =>
        clampXY(dragRef.current.ox + dx, dragRef.current.oy + dy, scale, naturalW, naturalH, frameW, frameH)
      );
    },
    [dragging, scale, naturalW, naturalH, frameW, frameH, clampXY]
  );
  const onMouseUp = () => setDragging(false);

  // ── Drag (touch) ──────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    setDragging(true);
    dragRef.current = { startX: t.clientX, startY: t.clientY, ox: offset.x, oy: offset.y };
  };
  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!dragging) return;
      const t = e.touches[0];
      const dx = t.clientX - dragRef.current.startX;
      const dy = t.clientY - dragRef.current.startY;
      setOffset(() =>
        clampXY(dragRef.current.ox + dx, dragRef.current.oy + dy, scale, naturalW, naturalH, frameW, frameH)
      );
    },
    [dragging, scale, naturalW, naturalH, frameW, frameH, clampXY]
  );
  const onTouchEnd = () => setDragging(false);

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  const handleZoom = useCallback(
    (newScale: number) => {
      const sc = Math.max(minScale, Math.min(maxScale, newScale));
      const cx = frameW / 2;
      const cy = frameH / 2;
      const ratio = sc / scale;
      const newOx = cx - ratio * (cx - offset.x);
      const newOy = cy - ratio * (cy - offset.y);
      setScale(sc);
      setOffset(clampXY(newOx, newOy, sc, naturalW, naturalH, frameW, frameH));
    },
    [scale, offset, minScale, maxScale, naturalW, naturalH, frameW, frameH, clampXY]
  );

  const handleReset = () => {
    centerImage(naturalW, naturalH, frameW, frameH);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    handleZoom(scale * (e.deltaY < 0 ? 1.08 : 0.92));
  };

  // ── Crop & upload ─────────────────────────────────────────────────────────
  const doCrop = useCallback(async () => {
    if (!naturalW || !naturalH || !imgSrc || !frameW || !frameH) return;
    setProcessing(true);
    setUploadError(null);

    console.info("[crop] starting crop+upload", {
      name: currentFile?.name,
      frameW,
      frameH,
      naturalW,
      naturalH,
      scale,
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

      const srcX = -offset.x / scale;
      const srcY = -offset.y / scale;
      const srcW = frameW / scale;
      const srcH = frameH / scale;

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
  }, [naturalW, naturalH, imgSrc, offset, scale, frameW, frameH, currentFile, collected, uploadFn, onUploadError, OUTPUT_W, OUTPUT_H]);

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
    ? Math.round(((scale - minScale) / (maxScale - minScale)) * 100)
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

          {/* Interactive drag area — always mounted so ResizeObserver can measure */}
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
            {/* Image — always rendered when imgSrc is set (removing the frameW gate that caused the bug).
                Hidden with opacity until fully positioned to avoid a size flash. */}
            {imgSrc && (
              <img
                src={imgSrc}
                onLoad={handleImgLoad}
                onError={handleImgError}
                draggable={false}
                className="absolute pointer-events-none transition-opacity duration-150"
                style={{
                  left:            offset.x,
                  top:             offset.y,
                  width:           naturalW * scale || "auto",
                  height:          naturalH * scale || "auto",
                  opacity:         isReady ? 1 : 0,
                  imageRendering:  "auto",
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
            onClick={() => handleZoom(scale * 0.9)}
            disabled={!isReady || scale <= minScale + 0.001}
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
            onClick={() => handleZoom(scale * 1.1)}
            disabled={!isReady || scale >= maxScale - 0.001}
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
