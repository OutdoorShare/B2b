import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, RotateCcw, ChevronRight, X } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const DISPLAY_W = 480;  // crop frame display width (px)

// ── Types ─────────────────────────────────────────────────────────────────────
interface Props {
  /** Queue of File objects to crop one by one */
  files: File[];
  onDone: (uploaded: string[]) => void;
  /** Called with each blob to perform the actual upload — returns the URL */
  uploadFn: (blob: Blob, filename: string) => Promise<string>;
  onCancel?: () => void;
  /** Crop aspect ratio width/height. Default 4/3. Use 1 for square logos. */
  aspect?: number;
  /** Output pixel width of the saved image. Default 1200. */
  outputWidth?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ImageCropDialog({ files, onDone, uploadFn, onCancel, aspect = 4 / 3, outputWidth = 1200 }: Props) {
  const ASPECT    = aspect;
  const DISPLAY_H = Math.round(DISPLAY_W / ASPECT);
  const OUTPUT_W  = outputWidth;
  const OUTPUT_H  = Math.round(OUTPUT_W / ASPECT);
  const [queueIdx, setQueueIdx]     = useState(0);
  const [imgSrc, setImgSrc]         = useState<string>("");
  const [naturalW, setNaturalW]     = useState(0);
  const [naturalH, setNaturalH]     = useState(0);
  const [scale, setScale]           = useState(1);
  const [offset, setOffset]         = useState({ x: 0, y: 0 });
  const [dragging, setDragging]     = useState(false);
  const [collected, setCollected]   = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  const dragRef = useRef({ startX: 0, startY: 0, ox: 0, oy: 0 });

  const currentFile = files[queueIdx];

  // Min scale = image must cover the full crop frame (object-cover behaviour)
  const minScale = useMemo(() => {
    if (!naturalW || !naturalH) return 1;
    return Math.max(DISPLAY_W / naturalW, DISPLAY_H / naturalH);
  }, [naturalW, naturalH]);

  const maxScale = useMemo(() => minScale * 3, [minScale]);

  // Clamp offset so image always fills the frame
  const clamp = useCallback((ox: number, oy: number, sc: number) => {
    const sw = naturalW * sc;
    const sh = naturalH * sc;
    return {
      x: Math.min(0, Math.max(DISPLAY_W - sw, ox)),
      y: Math.min(0, Math.max(DISPLAY_H - sh, oy)),
    };
  }, [naturalW, naturalH]);

  // Load new file into the cropper
  useEffect(() => {
    if (!currentFile) return;
    const url = URL.createObjectURL(currentFile);
    setImgSrc(url);
    setNaturalW(0);
    setNaturalH(0);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [currentFile]);

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: nw, naturalHeight: nh } = e.currentTarget;
    setNaturalW(nw);
    setNaturalH(nh);
    const sc = Math.max(DISPLAY_W / nw, DISPLAY_H / nh);
    setScale(sc);
    setOffset(clamp((DISPLAY_W - nw * sc) / 2, (DISPLAY_H - nh * sc) / 2, sc));
  };

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
    setOffset(clamp(dragRef.current.ox + dx, dragRef.current.oy + dy, scale));
  }, [dragging, scale, clamp]);
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
    setOffset(clamp(dragRef.current.ox + dx, dragRef.current.oy + dy, scale));
  }, [dragging, scale, clamp]);
  const onTouchEnd = () => setDragging(false);

  // ── Zoom ─────────────────────────────────────────────────────────────────────
  const handleZoom = (newScale: number) => {
    const sc = Math.max(minScale, Math.min(maxScale, newScale));
    // Zoom toward center of frame
    const cx = DISPLAY_W / 2;
    const cy = DISPLAY_H / 2;
    const ratio = sc / scale;
    const newOx = cx - ratio * (cx - offset.x);
    const newOy = cy - ratio * (cy - offset.y);
    setScale(sc);
    setOffset(clamp(newOx, newOy, sc));
  };

  const handleReset = () => {
    const sc = minScale;
    setScale(sc);
    setOffset(clamp((DISPLAY_W - naturalW * sc) / 2, (DISPLAY_H - naturalH * sc) / 2, sc));
  };

  // ── Wheel zoom ───────────────────────────────────────────────────────────────
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    handleZoom(scale * (e.deltaY < 0 ? 1.08 : 0.92));
  };

  // ── Crop & upload ────────────────────────────────────────────────────────────
  const doCrop = useCallback(async () => {
    if (!naturalW || !naturalH || !imgSrc) return;
    setProcessing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width  = OUTPUT_W;
      canvas.height = OUTPUT_H;
      const ctx = canvas.getContext("2d")!;
      const img = new Image();
      await new Promise<void>(res => { img.onload = () => res(); img.src = imgSrc; });
      const srcX = -offset.x / scale;
      const srcY = -offset.y / scale;
      const srcW = DISPLAY_W / scale;
      const srcH = DISPLAY_H / scale;
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, OUTPUT_W, OUTPUT_H);
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(b => b ? res(b) : rej(new Error("canvas toBlob failed")), "image/jpeg", 0.92)
      );
      const url = await uploadFn(blob, currentFile.name.replace(/\.[^.]+$/, ".jpg"));
      advance([...collected, url]);
    } catch {
      advance(collected);
    } finally {
      setProcessing(false);
    }
  }, [naturalW, naturalH, imgSrc, offset, scale, currentFile, collected, uploadFn]);

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

  const zoomPct = Math.round(((scale - minScale) / Math.max(0.0001, maxScale - minScale)) * 100);

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
        <div className="relative bg-black select-none mx-auto" style={{ width: DISPLAY_W, maxWidth: "100%", aspectRatio: `${ASPECT}` }}>
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
            {imgSrc && (
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

        <DialogFooter className="px-5 pb-5 flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={skipFile}
            disabled={processing}
            className="text-muted-foreground"
          >
            Skip
          </Button>
          <Button
            type="button"
            onClick={doCrop}
            disabled={processing || !naturalW}
            className="flex-1 gap-1.5"
          >
            {processing ? (
              <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
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
