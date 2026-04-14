import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, RotateCcw, ChevronRight, AlertCircle, X } from "lucide-react";

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
export function ImageCropDialog({ files, onDone, uploadFn, onCancel, onUploadError, aspect = 4 / 3, outputWidth = 1200 }: Props) {
  const ASPECT   = aspect;
  const OUTPUT_W = outputWidth;
  const OUTPUT_H = Math.round(OUTPUT_W / ASPECT);

  const [queueIdx, setQueueIdx]     = useState(0);
  const [imgSrc, setImgSrc]         = useState<string>("");
  const [naturalW, setNaturalW]     = useState(0);
  const [naturalH, setNaturalH]     = useState(0);
  const [scale, setScale]           = useState(1);
  const [offset, setOffset]         = useState({ x: 0, y: 0 });
  const [dragging, setDragging]     = useState(false);
  const [collected, setCollected]   = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Actual rendered container dimensions (updated by ResizeObserver)
  const [frameW, setFrameW] = useState(0);
  const frameH = frameW > 0 ? Math.round(frameW / ASPECT) : 0;

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef      = useRef({ startX: 0, startY: 0, ox: 0, oy: 0 });

  // ── Measure actual container size ────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const { width } = el.getBoundingClientRect();
      if (width > 0) setFrameW(Math.round(width));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const currentFile = files[queueIdx];

  // ── Clamp helper (always uses latest frame / natural dims passed explicitly) ─
  const clampXY = useCallback((ox: number, oy: number, sc: number, nw: number, nh: number, fw: number, fh: number) => {
    const sw = nw * sc;
    const sh = nh * sc;
    return {
      x: Math.min(0, Math.max(fw - sw, ox)),
      y: Math.min(0, Math.max(fh - sh, oy)),
    };
  }, []);

  // ── Load new file into the cropper ───────────────────────────────────────────
  useEffect(() => {
    if (!currentFile) return;
    const url = URL.createObjectURL(currentFile);
    setImgSrc(url);
    setNaturalW(0);
    setNaturalH(0);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setUploadError(null);
    return () => URL.revokeObjectURL(url);
  }, [currentFile]);

  // ── Re-center when frameW becomes available (or changes) ─────────────────────
  // Also fires after naturalW/H are set by handleImgLoad
  const didCenterRef = useRef(false);
  useEffect(() => {
    if (!naturalW || !naturalH || !frameW || !frameH) return;
    const sc = Math.max(frameW / naturalW, frameH / naturalH);
    const ox = (frameW - naturalW * sc) / 2;
    const oy = (frameH - naturalH * sc) / 2;
    setScale(sc);
    setOffset(clampXY(ox, oy, sc, naturalW, naturalH, frameW, frameH));
    didCenterRef.current = true;
  }, [naturalW, naturalH, frameW, frameH, clampXY]);

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: nw, naturalHeight: nh } = e.currentTarget;
    setNaturalW(nw);
    setNaturalH(nh);
    // The useEffect above will fire once naturalW/H update and handle centering.
    // If frameW is already known, compute immediately with fresh values to avoid a flash.
    if (frameW && frameH) {
      const sc = Math.max(frameW / nw, frameH / nh);
      const ox = (frameW - nw * sc) / 2;
      const oy = (frameH - nh * sc) / 2;
      setScale(sc);
      setOffset(clampXY(ox, oy, sc, nw, nh, frameW, frameH));
    }
  };

  // ── Derived zoom bounds ───────────────────────────────────────────────────────
  const minScale = (naturalW && naturalH && frameW && frameH)
    ? Math.max(frameW / naturalW, frameH / naturalH)
    : 1;
  const maxScale = minScale * 3;

  // ── Drag (mouse) ─────────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(prev => clampXY(
      dragRef.current.ox + dx, dragRef.current.oy + dy,
      scale, naturalW, naturalH, frameW, frameH
    ));
  }, [dragging, scale, naturalW, naturalH, frameW, frameH, clampXY]);
  const onMouseUp = () => setDragging(false);

  // ── Drag (touch) ─────────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    setDragging(true);
    dragRef.current = { startX: t.clientX, startY: t.clientY, ox: offset.x, oy: offset.y };
  };
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging) return;
    const t = e.touches[0];
    const dx = t.clientX - dragRef.current.startX;
    const dy = t.clientY - dragRef.current.startY;
    setOffset(() => clampXY(
      dragRef.current.ox + dx, dragRef.current.oy + dy,
      scale, naturalW, naturalH, frameW, frameH
    ));
  }, [dragging, scale, naturalW, naturalH, frameW, frameH, clampXY]);
  const onTouchEnd = () => setDragging(false);

  // ── Zoom ─────────────────────────────────────────────────────────────────────
  const handleZoom = useCallback((newScale: number) => {
    const sc = Math.max(minScale, Math.min(maxScale, newScale));
    const cx = frameW / 2;
    const cy = frameH / 2;
    const ratio = sc / scale;
    const newOx = cx - ratio * (cx - offset.x);
    const newOy = cy - ratio * (cy - offset.y);
    setScale(sc);
    setOffset(clampXY(newOx, newOy, sc, naturalW, naturalH, frameW, frameH));
  }, [scale, offset, minScale, maxScale, naturalW, naturalH, frameW, frameH, clampXY]);

  const handleReset = () => {
    const sc = minScale;
    const ox = (frameW - naturalW * sc) / 2;
    const oy = (frameH - naturalH * sc) / 2;
    setScale(sc);
    setOffset(clampXY(ox, oy, sc, naturalW, naturalH, frameW, frameH));
  };

  // ── Wheel zoom ───────────────────────────────────────────────────────────────
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    handleZoom(scale * (e.deltaY < 0 ? 1.08 : 0.92));
  };

  // ── Crop & upload ─────────────────────────────────────────────────────────────
  const doCrop = useCallback(async () => {
    if (!naturalW || !naturalH || !imgSrc || !frameW || !frameH) return;
    setProcessing(true);
    setUploadError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width  = OUTPUT_W;
      canvas.height = OUTPUT_H;
      const ctx = canvas.getContext("2d")!;

      // Use createImageBitmap with imageOrientation:'from-image' so EXIF rotation
      // is baked in before drawing to canvas.
      let source: ImageBitmap | HTMLImageElement;
      try {
        source = await createImageBitmap(currentFile, { imageOrientation: "from-image" } as any);
      } catch {
        const img = new Image();
        await new Promise<void>(res => { img.onload = () => res(); img.src = imgSrc; });
        source = img;
      }

      // Convert CSS-pixel offset back to source-image pixel coordinates.
      const srcX = -offset.x / scale;
      const srcY = -offset.y / scale;
      const srcW = frameW / scale;
      const srcH = frameH / scale;

      ctx.drawImage(source as any, srcX, srcY, srcW, srcH, 0, 0, OUTPUT_W, OUTPUT_H);

      const isPng = currentFile.type === "image/png";
      const mimeType = isPng ? "image/png" : "image/jpeg";
      const ext = isPng ? ".png" : ".jpg";
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(b => b ? res(b) : rej(new Error("canvas toBlob failed")), mimeType, 0.95)
      );
      const url = await uploadFn(blob, currentFile.name.replace(/\.[^.]+$/, ext));
      advance([...collected, url]);
    } catch (err: any) {
      const msg = err?.message?.includes("413") ? "File too large (max 5 MB)"
        : err?.message?.includes("Upload failed") ? "Upload failed — check your connection and try again"
        : "Upload failed — please try again";
      setUploadError(msg);
      onUploadError?.(currentFile.name, msg);
    } finally {
      setProcessing(false);
    }
  }, [naturalW, naturalH, imgSrc, offset, scale, frameW, frameH, currentFile, collected, uploadFn, onUploadError]);

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

  const zoomPct = minScale >= maxScale
    ? 0
    : Math.round(((scale - minScale) / (maxScale - minScale)) * 100);

  return (
    <Dialog open onOpenChange={open => { if (!open) onCancel?.(); }}>
      <DialogContent className="max-w-[540px] p-0 overflow-hidden gap-0">
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
              <button type="button" onClick={onCancel} className="rounded-full p-1 hover:bg-muted transition-colors">
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
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onWheel={onWheel}
          >
            {imgSrc && frameW > 0 && (
              <img
                src={imgSrc}
                onLoad={handleImgLoad}
                draggable={false}
                className="absolute pointer-events-none"
                style={{
                  left: offset.x,
                  top: offset.y,
                  width: naturalW * scale,
                  height: naturalH * scale,
                  imageRendering: "auto",
                }}
              />
            )}
            {/* Rule-of-thirds overlay */}
            <svg className="absolute inset-0 pointer-events-none opacity-30" width="100%" height="100%">
              <line x1="33.33%" y1="0" x2="33.33%" y2="100%" stroke="white" strokeWidth="0.5" />
              <line x1="66.66%" y1="0" x2="66.66%" y2="100%" stroke="white" strokeWidth="0.5" />
              <line x1="0" y1="33.33%" x2="100%" y2="33.33%" stroke="white" strokeWidth="0.5" />
              <line x1="0" y1="66.66%" x2="100%" y2="66.66%" stroke="white" strokeWidth="0.5" />
            </svg>
          </div>
        </div>

        {/* ── Zoom controls ── */}
        <div className="px-5 py-3 flex items-center gap-3">
          <button type="button" onClick={() => handleZoom(scale * 0.9)} disabled={scale <= minScale + 0.001} className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
            <ZoomOut className="w-4 h-4" />
          </button>
          <Slider
            value={[zoomPct]}
            min={0}
            max={100}
            step={1}
            onValueChange={([v]) => handleZoom(minScale + (v / 100) * (maxScale - minScale))}
            className="flex-1"
          />
          <button type="button" onClick={() => handleZoom(scale * 1.1)} disabled={scale >= maxScale - 0.001} className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button type="button" onClick={handleReset} className="text-muted-foreground hover:text-foreground transition-colors ml-1" title="Reset">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {uploadError && (
          <div className="mx-5 mb-3 flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">{uploadError}</p>
              <p className="text-xs text-destructive/70 mt-0.5">Try again or skip this photo.</p>
            </div>
          </div>
        )}
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
            disabled={processing || !naturalW || !frameW}
            className="flex-1 gap-1.5"
          >
            {processing ? (
              <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
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
