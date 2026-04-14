import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wand2, CheckCircle2, AlertCircle, ImagePlus, RefreshCw, Image } from "lucide-react";
import { cn } from "@/lib/utils";
import { BACKGROUND_CATEGORIES, BackgroundImage } from "@/lib/background-library";
import { getAdminSession } from "@/lib/admin-nav";

// ── Pipeline stages ───────────────────────────────────────────────────────────
// Background Studio is an OPTIONAL ENHANCEMENT. Each stage is independently
// failable. If any stage fails the user can always fall back to the original photo.
type PipelineStage =
  | "idle"
  | "source_ready"
  | "preprocessing"
  | "removing_background"
  | "cutout_ready"
  | "compositing_preview"
  | "preview_ready"
  | "applying"
  | "failed";

// ── Diagnostics ───────────────────────────────────────────────────────────────
interface DiagInfo {
  imageUrl: string;
  attemptStartedAt: number;
  stageTimings: Record<string, number>;
  bgRemovalRequested: boolean;
  bgRemovalResponded: boolean;
  cutoutAvailable: boolean;
  previewComposed: boolean;
  failedAtStage: PipelineStage | null;
  lastErrorMsg: string;
  lastErrorStack: string;
  selectedBgId: string | null;
  selectedBgLabel: string | null;
}

const emptyDiag = (): DiagInfo => ({
  imageUrl: "",
  attemptStartedAt: Date.now(),
  stageTimings: {},
  bgRemovalRequested: false,
  bgRemovalResponded: false,
  cutoutAvailable: false,
  previewComposed: false,
  failedAtStage: null,
  lastErrorMsg: "",
  lastErrorStack: "",
  selectedBgId: null,
  selectedBgLabel: null,
});

// Only show diagnostics panel in dev/staging — never in production
const SHOW_DIAG_PANEL = import.meta.env.DEV;

interface Props {
  open: boolean;
  onClose: () => void;
  /** URL of the already-uploaded source image. Must be an absolute or root-relative URL. */
  imageUrl: string;
  /** Called with the final image URL (composite or original). Closes the dialog. */
  onApply: (newUrl: string) => void;
}

// ── Helper: log a pipeline event with full context ────────────────────────────
function logStage(stage: PipelineStage, detail: Record<string, unknown> = {}) {
  console.info(`[bg-studio] stage=${stage}`, {
    ts: new Date().toISOString(),
    ...detail,
  });
}

function logError(stage: PipelineStage, err: unknown, extra: Record<string, unknown> = {}) {
  const e = err as any;
  const msg = e?.message ?? e?.toString?.() ?? String(err) ?? "(no message)";
  const name = e?.name ?? (typeof err);
  const stack = e?.stack ?? "";
  console.error(`[bg-studio] FAILED at stage=${stage}`, {
    ts: new Date().toISOString(),
    name,
    msg,
    stack,
    ...extra,
  });
  return { msg, name, stack };
}

// ── Component ─────────────────────────────────────────────────────────────────
export function BackgroundStudioDialog({ open, onClose, imageUrl, onApply }: Props) {
  const [activeCat, setActiveCat]   = useState(BACKGROUND_CATEGORIES[0].id);
  const [selectedBg, setSelectedBg] = useState<BackgroundImage | null>(null);
  const [stage, setStage]           = useState<PipelineStage>("idle");
  const [failReason, setFailReason] = useState<string>("");
  const [failStage, setFailStage]   = useState<PipelineStage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [diag, setDiag]             = useState<DiagInfo>(emptyDiag);

  const subjectBlobRef = useRef<Blob | null>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const stageStartRef  = useRef<number>(Date.now());

  // ── Track elapsed time per stage ──────────────────────────────────────────
  const recordStageTiming = useCallback((s: PipelineStage) => {
    const elapsed = Date.now() - stageStartRef.current;
    stageStartRef.current = Date.now();
    setDiag(d => ({ ...d, stageTimings: { ...d.stageTimings, [s]: elapsed } }));
    return elapsed;
  }, []);

  // ── Hard fail: keeps original visible, shows fallback buttons ─────────────
  const fail = useCallback((at: PipelineStage, reason: string) => {
    setStage("failed");
    setFailStage(at);
    setFailReason(reason);
    setDiag(d => ({ ...d, failedAtStage: at, lastErrorMsg: reason }));
  }, []);

  // ── Reset to a clean idle ─────────────────────────────────────────────────
  const resetState = useCallback(() => {
    setStage("idle");
    setSelectedBg(null);
    setPreviewUrl(null);
    setFailReason("");
    setFailStage(null);
    setDiag(emptyDiag());
    subjectBlobRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) resetState();
  }, [open, resetState]);

  // ── "Use original photo" — always available escape hatch ─────────────────
  const handleUseOriginal = useCallback(() => {
    logStage("idle", { action: "use_original", imageUrl });
    onApply(imageUrl);
    onClose();
  }, [imageUrl, onApply, onClose]);

  // ── Stage: preprocessing ──────────────────────────────────────────────────
  // Guard: verify image source is valid before attempting removal
  const preprocess = useCallback(async (): Promise<string | null> => {
    setStage("preprocessing");
    logStage("preprocessing", { imageUrl });
    stageStartRef.current = Date.now();

    // Precondition: imageUrl must exist
    if (!imageUrl) {
      const reason = "Source image URL is missing";
      logError("preprocessing", reason, { imageUrl });
      fail("preprocessing", reason);
      return null;
    }

    // Make URL absolute — the bg-removal library requires an absolute URL
    const abs = imageUrl.startsWith("http")
      ? imageUrl
      : `${window.location.origin}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;

    // Precondition: fetch the image HEAD to confirm it's reachable
    try {
      const head = await fetch(abs, { method: "HEAD" });
      if (!head.ok) {
        const reason = `Source image not reachable: HTTP ${head.status}`;
        logError("preprocessing", reason, { abs, status: head.status });
        fail("preprocessing", reason);
        return null;
      }
    } catch (err) {
      // Network error — still try to proceed (some environments block HEAD)
      logError("preprocessing", err, { abs, note: "HEAD check failed, proceeding anyway" });
    }

    const elapsed = recordStageTiming("preprocessing");
    logStage("source_ready", { abs, elapsed });
    setStage("source_ready");
    return abs;
  }, [imageUrl, fail, recordStageTiming]);

  // ── Stage: removing_background ────────────────────────────────────────────
  // Cached: once a cutout blob exists we skip the expensive AI pass
  const removeBackground = useCallback(async (absoluteUrl: string): Promise<Blob | null> => {
    if (subjectBlobRef.current) {
      logStage("cutout_ready", { source: "cache" });
      setStage("cutout_ready");
      setDiag(d => ({ ...d, cutoutAvailable: true }));
      return subjectBlobRef.current;
    }

    setStage("removing_background");
    stageStartRef.current = Date.now();
    logStage("removing_background", { absoluteUrl });
    setDiag(d => ({ ...d, bgRemovalRequested: true }));

    // Precondition: onnxruntime-web must be resolvable
    try {
      await import("onnxruntime-web");
    } catch (err) {
      const { msg } = logError("removing_background", err, { note: "onnxruntime-web unavailable" });
      fail("removing_background", `AI inference engine unavailable: ${msg}`);
      return null;
    }

    try {
      const { removeBackground: removeBg } = await import("@imgly/background-removal");

      const result = await removeBg(absoluteUrl, {
        // Use library's built-in default CDN (staticimgly.com) for ONNX + WASM.
        // Do NOT override publicPath with jsDelivr — that CDN's resources.json is empty.
        output: { format: "image/png", quality: 0.9 },
        progress: (key: string, current: number, total: number) => {
          if (total > 0) {
            console.debug(`[bg-studio] progress key=${key} ${Math.round(current / total * 100)}%`);
          }
        },
      });

      setDiag(d => ({ ...d, bgRemovalResponded: true, cutoutAvailable: true }));
      const elapsed = recordStageTiming("removing_background");
      logStage("cutout_ready", { sizeBytes: result.size, elapsed });
      subjectBlobRef.current = result;
      setStage("cutout_ready");
      return result;
    } catch (err) {
      const { msg, stack } = logError("removing_background", err, { absoluteUrl });
      setDiag(d => ({ ...d, bgRemovalResponded: true, lastErrorMsg: msg, lastErrorStack: stack }));
      const elapsed = recordStageTiming("removing_background");
      fail("removing_background", `Background removal failed (${elapsed}ms): ${msg}`);
      return null;
    }
  }, [fail, recordStageTiming]);

  // ── Stage: compositing_preview ────────────────────────────────────────────
  const composite = useCallback(async (bg: BackgroundImage, subjectBlob: Blob): Promise<string | null> => {
    setStage("compositing_preview");
    stageStartRef.current = Date.now();
    logStage("compositing_preview", { bgId: bg.id, bgLabel: bg.label, cutoutSize: subjectBlob.size });

    // Preconditions
    if (!bg.url) {
      fail("compositing_preview", "Background image URL is missing");
      return null;
    }
    if (subjectBlob.size === 0) {
      fail("compositing_preview", "Cutout blob is empty — background removal produced no output");
      return null;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      fail("compositing_preview", "Canvas element not mounted — cannot composite");
      return null;
    }

    const loadImg = (src: string): Promise<HTMLImageElement> =>
      new Promise((res, rej) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => res(img);
        img.onerror = (e) => rej(new Error(`Image load failed: ${src} — ${String(e)}`));
        img.src = src;
      });

    try {
      const subjectObjectUrl = URL.createObjectURL(subjectBlob);
      const [bgImg, subjectImg] = await Promise.all([
        loadImg(bg.url),
        loadImg(subjectObjectUrl),
      ]);
      URL.revokeObjectURL(subjectObjectUrl);

      // Precondition: images decoded with non-zero dimensions
      if (bgImg.naturalWidth === 0 || subjectImg.naturalWidth === 0) {
        fail("compositing_preview", "One or both images decoded with zero dimensions");
        return null;
      }

      const W = 1200, H = 900;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        fail("compositing_preview", "Canvas 2D context unavailable");
        return null;
      }

      // Draw background (cover-fit)
      const bgAspect = bgImg.width / bgImg.height;
      const canvasAspect = W / H;
      let sx = 0, sy = 0, sw = bgImg.width, sh = bgImg.height;
      if (bgAspect > canvasAspect) { sw = bgImg.height * canvasAspect; sx = (bgImg.width - sw) / 2; }
      else { sh = bgImg.width / canvasAspect; sy = (bgImg.height - sh) / 2; }
      ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, W, H);

      // Draw subject (center-bottom, 85% of canvas)
      const scale = Math.min(W / subjectImg.width, H / subjectImg.height) * 0.85;
      const dw = subjectImg.width * scale;
      const dh = subjectImg.height * scale;
      ctx.drawImage(subjectImg, (W - dw) / 2, H - dh, dw, dh);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      if (!dataUrl || dataUrl === "data:,") {
        fail("compositing_preview", "canvas.toDataURL returned empty — canvas draw error");
        return null;
      }

      setDiag(d => ({ ...d, previewComposed: true }));
      const elapsed = recordStageTiming("compositing_preview");
      logStage("preview_ready", { elapsed, dataUrlLength: dataUrl.length });
      return dataUrl;
    } catch (err) {
      const { msg } = logError("compositing_preview", err, { bgId: bg.id });
      fail("compositing_preview", `Compositing error: ${msg}`);
      return null;
    }
  }, [fail, recordStageTiming]);

  // ── Full pipeline: called when user clicks a background tile ─────────────
  const handleSelectBg = useCallback(async (bg: BackgroundImage) => {
    setSelectedBg(bg);
    setPreviewUrl(null);
    setDiag(d => ({
      ...d,
      imageUrl,
      attemptStartedAt: Date.now(),
      selectedBgId: bg.id,
      selectedBgLabel: bg.label,
    }));

    logStage("idle", { action: "select_background", bgId: bg.id, bgLabel: bg.label, imageUrl });

    // Stage 1: preprocess
    const absoluteUrl = await preprocess();
    if (!absoluteUrl) return;

    // Stage 2: remove background
    const subjectBlob = await removeBackground(absoluteUrl);
    if (!subjectBlob) return;

    // Stage 3: composite preview
    const dataUrl = await composite(bg, subjectBlob);
    if (!dataUrl) return;

    setPreviewUrl(dataUrl);
    setStage("preview_ready");
  }, [imageUrl, preprocess, removeBackground, composite]);

  // ── Apply composite: upload and hand off to parent ────────────────────────
  const handleApply = useCallback(async () => {
    if (!previewUrl || !selectedBg) return;
    setStage("applying");
    stageStartRef.current = Date.now();
    logStage("applying", { bgId: selectedBg.id });

    try {
      const res = await fetch(previewUrl);
      if (!res.ok) throw new Error(`Failed to read preview blob: HTTP ${res.status}`);
      const blob = await res.blob();
      if (blob.size === 0) throw new Error("Preview blob is empty — canvas may not have drawn");

      const fd = new FormData();
      fd.append("file", blob, "bg-studio.jpg");
      const session = getAdminSession();
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const up = await fetch(`${base}/api/upload/image`, {
        method: "POST",
        headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
        body: fd,
      });
      if (!up.ok) throw new Error(`Upload request failed: HTTP ${up.status}`);
      const data = await up.json();
      if (!data.url) throw new Error("Upload response missing url field");

      const elapsed = recordStageTiming("applying");
      logStage("preview_ready", { action: "apply_complete", uploadedUrl: data.url, elapsed });
      onApply(data.url);
      onClose();
    } catch (err) {
      const { msg } = logError("applying", err);
      fail("applying", `Save failed: ${msg}`);
    }
  }, [previewUrl, selectedBg, onApply, onClose, fail, recordStageTiming]);

  // ── Retry: clear only the failed state, keep what was successful ──────────
  const handleRetry = useCallback(() => {
    if (failStage === "removing_background" || failStage === "preprocessing") {
      // Clear cutout cache so we re-run AI
      subjectBlobRef.current = null;
    }
    if (selectedBg) {
      handleSelectBg(selectedBg);
    } else {
      resetState();
    }
  }, [failStage, selectedBg, handleSelectBg, resetState]);

  const currentCategory = BACKGROUND_CATEGORIES.find(c => c.id === activeCat)!;
  const isBusy = stage === "preprocessing" || stage === "removing_background" || stage === "compositing_preview" || stage === "applying";

  // ── Left pane: what to show ───────────────────────────────────────────────
  // The ORIGINAL IMAGE is ALWAYS the fallback — left pane never goes black/empty
  const showComposite  = stage === "preview_ready" && previewUrl;
  const showOriginal   = !showComposite; // original always visible unless composite is ready
  const showFailed     = stage === "failed";
  const showSpinner    = isBusy;

  // ── Friendly stage label for UI ───────────────────────────────────────────
  const stageLabel: Record<PipelineStage, string> = {
    idle: "Select a background to preview",
    source_ready: "Image ready",
    preprocessing: "Checking image…",
    removing_background: "Removing background…",
    cutout_ready: "Background removed",
    compositing_preview: "Compositing preview…",
    preview_ready: "Preview ready — click Apply to save",
    applying: "Saving…",
    failed: "Preview failed",
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-5xl w-full p-0 overflow-hidden">
        <canvas ref={canvasRef} className="hidden" />

        <div className="flex flex-col h-[90vh]">
          {/* ── Header ── */}
          <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wand2 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base">Background Studio</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Pick an OutdoorShare background — we'll cut out your subject and place it in the scene.
                  This is optional — you can always save the original photo.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-1 overflow-hidden">
            {/* ── Left: Preview pane — original ALWAYS visible as base ── */}
            <div className="w-[44%] shrink-0 bg-gray-950 flex flex-col items-center justify-center p-5 gap-4 relative">

              {/* Original image — always rendered as the base layer */}
              <div className={cn(
                "w-full rounded-xl overflow-hidden shadow-xl border border-white/10 transition-opacity duration-300",
                showComposite && "opacity-0 absolute inset-5"
              )}>
                <img src={imageUrl} alt="Original photo" className="w-full object-cover" />
                {!showComposite && !showFailed && !isBusy && (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
                    <p className="text-[11px] text-gray-300">
                      {stage === "idle" ? "Select a background →" : stageLabel[stage]}
                    </p>
                  </div>
                )}
              </div>

              {/* Composite preview — shown only when ready */}
              {showComposite && (
                <div className="w-full rounded-xl overflow-hidden shadow-2xl border border-white/10 relative">
                  <img src={previewUrl!} alt="Preview" className="w-full object-cover" />
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-primary/90 text-white text-[10px] font-bold px-2 py-0.5">
                      <CheckCircle2 className="w-3 h-3 mr-1" />Preview
                    </Badge>
                  </div>
                </div>
              )}

              {/* Loading overlay */}
              {showSpinner && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 rounded-l-xl">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Loader2 className="w-7 h-7 text-primary animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-white font-medium">{stageLabel[stage]}</p>
                    {stage === "removing_background" && (
                      <p className="text-xs text-gray-400 mt-1">
                        AI model loads once, then runs locally
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Failure overlay — original image stays visible behind */}
              {showFailed && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 rounded-l-xl px-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">Preview unavailable</p>
                    <p className="text-xs text-gray-300 mt-1.5 leading-relaxed">
                      We couldn't generate a background preview for this image.
                      You can try again or continue with the original photo.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 w-full mt-1">
                    <Button
                      size="sm"
                      onClick={handleRetry}
                      className="w-full gap-1.5 bg-white/10 hover:bg-white/20 text-white border-white/20"
                      variant="outline"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Try again
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleUseOriginal}
                      className="w-full gap-1.5 bg-primary/90 hover:bg-primary text-white"
                    >
                      <Image className="w-3.5 h-3.5" />
                      Use original photo
                    </Button>
                  </div>
                </div>
              )}

              {/* Idle: prompt to select */}
              {stage === "idle" && (
                <div className="absolute bottom-7 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <p className="text-xs text-gray-400">Select a background to see preview</p>
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
                        disabled={isBusy}
                        onClick={() => handleSelectBg(bg)}
                        className={cn(
                          "relative rounded-lg overflow-hidden aspect-[4/3] border-2 transition-all focus:outline-none",
                          isSelected
                            ? "border-primary ring-2 ring-primary/30 scale-[0.97]"
                            : "border-transparent hover:border-primary/40 hover:scale-[0.97]",
                          isBusy && "opacity-60 cursor-not-allowed"
                        )}
                      >
                        <img src={bg.thumb} alt={bg.label} className="w-full h-full object-cover" loading="lazy" />
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
                        {isBusy && isSelected && (
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
                      Background removal works best with clear, well-lit photos against a contrasting
                      background. If the preview fails, you can always save the original photo.
                    </p>
                  </div>
                </div>

                {/* ── Dev diagnostics panel ── */}
                {SHOW_DIAG_PANEL && (
                  <div className="mt-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200 font-mono text-[10px] text-yellow-900 space-y-0.5">
                    <p className="font-bold text-[11px] mb-1">🔬 Dev Diagnostics</p>
                    <p>stage: <span className="font-bold">{stage}</span>{failStage && ` (failed at: ${failStage})`}</p>
                    <p>bg_removal_requested: {diag.bgRemovalRequested ? "✅" : "—"}</p>
                    <p>bg_removal_responded: {diag.bgRemovalResponded ? "✅" : "—"}</p>
                    <p>cutout_available: {diag.cutoutAvailable ? "✅" : "—"}</p>
                    <p>preview_composed: {diag.previewComposed ? "✅" : "—"}</p>
                    <p>selected_bg: {diag.selectedBgId ?? "none"}</p>
                    {diag.lastErrorMsg && (
                      <p className="text-red-700 break-all">error: {diag.lastErrorMsg.slice(0, 200)}</p>
                    )}
                    {Object.entries(diag.stageTimings).map(([s, ms]) => (
                      <p key={s}>{s}: {ms}ms</p>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Footer actions ── */}
              <div className="shrink-0 border-t bg-white px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground min-w-0">
                  {showFailed ? (
                    <span className="text-red-500 font-medium">
                      Preview failed at: {failStage}
                    </span>
                  ) : (
                    <span className={stage === "preview_ready" ? "text-primary font-medium" : ""}>
                      {stageLabel[stage]}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                    Cancel
                  </Button>
                  {/* "Use original photo" — always available, never blocks */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUseOriginal}
                    className="gap-1.5"
                  >
                    <Image className="w-3.5 h-3.5" />
                    Use original
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!previewUrl || isBusy}
                    onClick={handleApply}
                    className="bg-primary hover:bg-primary/90 text-white gap-1.5"
                  >
                    {stage === "applying" ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>
                    ) : (
                      <><Wand2 className="w-3.5 h-3.5" />Apply Background</>
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
