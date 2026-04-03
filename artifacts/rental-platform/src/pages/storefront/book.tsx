import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import type { DateRange } from "react-day-picker";
import { 
  useGetListing,
  getGetListingQueryKey,
  useGetBusinessProfile,
  getGetBusinessProfileQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, ArrowRight, CheckCircle2, Calendar as CalendarIcon,
  Lock, User, CreditCard, FileText, Eye, EyeOff, ShieldCheck,
  Zap, AlertTriangle, Umbrella, Star, Loader2, BadgeCheck,
  ScanFace, RefreshCw, XCircle, Clock, Tag, Monitor, QrCode, Smartphone,
  ScanLine, X, Copy, Check, Upload, ImagePlus, Car, Mountain, BookOpen, Building2, Package,
  Minus, Plus
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { differenceInDays, format, addDays, eachDayOfInterval, parseISO, isBefore, isAfter, startOfDay } from "date-fns";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { QRCodeSVG } from "qrcode.react";

const liveStripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "");
const testStripePromise = loadStripe(import.meta.env.VITE_STRIPE_TEST_PUBLISHABLE_KEY ?? "");

// Generate 30-minute time slots from 6:00 AM to 10:00 PM
const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 22; h++) {
  for (const m of [0, 30]) {
    if (h === 22 && m === 30) break;
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    const ampm = h < 12 ? "AM" : "PM";
    const minStr = m === 0 ? "00" : "30";
    TIME_OPTIONS.push(`${hour12}:${minStr} ${ampm}`);
  }
}

function currentTimeSlot(): string {
  const now = new Date();
  let h = now.getHours();
  let m = now.getMinutes();
  if (m === 0) { }
  else if (m <= 30) { m = 30; }
  else { m = 0; h += 1; }
  if (h < 6) { h = 6; m = 0; }
  if (h > 22 || (h === 22 && m > 0)) { h = 22; m = 0; }
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "AM" : "PM";
  const minStr = m === 0 ? "00" : "30";
  return `${hour12}:${minStr} ${ampm}`;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// Default rental agreement shown when the superadmin hasn't configured one yet.
// Uses the same {{variable}} tokens as the custom agreement editor.
const DEFAULT_AGREEMENT = `RENTAL AGREEMENT

This Rental Agreement ("Agreement") is entered into between {{company_name}} ("Owner") and {{renter_name}} ("Renter") on {{start_date}}.

RENTAL DETAILS

Item Rented: {{listing_title}}
Rental Period: {{start_date}} through {{end_date}} ({{rental_days}} days)
Daily Rate: {{price_per_day}}
Total Rental Fee: {{total_price}}
Security Deposit: {{deposit_amount}}

RENTER ACKNOWLEDGMENT & RESPONSIBILITIES

Renter confirms they are at least 18 years of age and hold a valid driver's license or other required credentials for the rented item. Renter agrees to return the item in the same condition it was received, normal wear and tear excepted. Any damage, loss, or theft of the rental item will be the sole financial responsibility of the Renter.

PROHIBITED USE

Renter agrees not to use the rented item in any illegal manner, in any reckless or unsafe way, or in any manner not consistent with its intended purpose. Renter agrees not to sub-rent or lend the item to any third party without prior written consent from the Owner.

FUEL & CONDITION

Unless otherwise stated, the item must be returned with the same fuel level as at pickup. Renter is responsible for all fuel used during the rental period.

CANCELLATION & REFUND POLICY

Cancellations made more than 48 hours before the rental start date may be eligible for a full refund at the Owner's discretion. Cancellations made within 48 hours of the rental start date may be subject to a cancellation fee.

LIMITATION OF LIABILITY

Owner shall not be liable for any indirect, incidental, or consequential damages arising out of the use of the rental item. Renter assumes all risks associated with the use of the rented item and agrees to indemnify and hold harmless Owner from any claims, damages, or expenses arising from Renter's use.

AGREEMENT

By signing below, Renter confirms they have read, understood, and agree to all terms and conditions of this Rental Agreement. Renter acknowledges receipt of the rental item in satisfactory condition.`;

// Two screens: "book" (dates+info+payment) and "complete" (agreement→verification→confirmation)
type Step = "book" | "complete";

type Addon = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  priceType: "flat" | "per_day";
  isRequired: boolean;
  isActive: boolean;
};

type ListingRule = {
  id: number;
  title: string;
  description: string | null;
  fee: number;
  sortOrder: number;
};

interface CustomerSession {
  id: number;
  email: string;
  name: string;
  phone?: string;
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  cardLastFour?: string;
  cardBrand?: string;
}

function loadSession(): CustomerSession | null {
  try {
    const raw = localStorage.getItem("rental_customer");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(c: CustomerSession) {
  localStorage.setItem("rental_customer", JSON.stringify(c));
}

// ── Card Scan Helper ──────────────────────────────────────────────────────────
type ScanPhase = "idle" | "camera" | "processing" | "result" | "manual";

function CardScanHelper() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [copied, setCopied] = useState<"number" | "expiry" | null>(null);
  const [camError, setCamError] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [flashActive, setFlashActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const numberRef = useRef<HTMLInputElement>(null);

  function fmtNumber(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 16);
    return d.replace(/(.{4})(?=.)/g, "$1 ");
  }
  function fmtExpiry(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0,2)} / ${d.slice(2)}` : d;
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  function handleClose() {
    stopCamera();
    setOpen(false);
    setPhase("idle");
    setCamError("");
    setOcrProgress(0);
  }

  async function startCamera() {
    setCamError("");
    setPhase("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("permission")) {
        setCamError("Camera access was denied. Please allow camera access in your browser settings, or enter the card details manually.");
      } else {
        setCamError("Could not open the camera on this device. Please enter the card details manually.");
      }
      setPhase("manual");
    }
  }

  function parseCardFromText(text: string): { number: string; expiry: string } {
    const cleaned = text.replace(/[^0-9/\s\-]/g, " ").replace(/\s+/g, " ");
    let number = "";
    let expiry = "";

    const numMatch = cleaned.match(/\b(\d{4})[\s\-]?(\d{4})[\s\-]?(\d{4})[\s\-]?(\d{4})\b/);
    if (numMatch) {
      number = `${numMatch[1]} ${numMatch[2]} ${numMatch[3]} ${numMatch[4]}`;
    } else {
      const amexMatch = cleaned.match(/\b(\d{4})[\s\-]?(\d{6})[\s\-]?(\d{5})\b/);
      if (amexMatch) number = `${amexMatch[1]} ${amexMatch[2]} ${amexMatch[3]}`;
    }

    const expMatch = cleaned.match(/\b(0[1-9]|1[0-2])[\s\/\-](\d{2})\b/);
    if (expMatch) expiry = `${expMatch[1]} / ${expMatch[2]}`;

    return { number, expiry };
  }

  async function captureAndScan() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 200);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const enhanced = avg > 140 ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = enhanced;
    }
    ctx.putImageData(imageData, 0, 0);

    stopCamera();
    setPhase("processing");
    setOcrProgress(0);

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") setOcrProgress(Math.round(m.progress * 100));
        },
      });
      await worker.setParameters({ tessedit_char_whitelist: "0123456789/ -" });
      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();

      const { number, expiry: exp } = parseCardFromText(text);
      if (number) {
        setCardNumber(number);
        setExpiry(exp);
        setPhase("result");
      } else {
        setCamError("Couldn't read card details from the image. Try better lighting and hold the card flat, or enter details manually.");
        setPhase("manual");
      }
    } catch {
      setCamError("OCR processing failed. Please enter the card details manually.");
      setPhase("manual");
    }
  }

  function copyToClipboard(text: string, field: "number" | "expiry") {
    navigator.clipboard.writeText(text.replace(/\s/g, "")).catch(() => {});
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  }

  useEffect(() => {
    if (phase === "manual") setTimeout(() => numberRef.current?.focus(), 150);
  }, [phase]);

  useEffect(() => () => stopCamera(), []);

  if (!open) {
    return (
      <button
        type="button"
        className="flex items-center gap-1.5 text-xs text-primary/80 hover:text-primary transition-colors"
        onClick={() => { setOpen(true); startCamera(); }}
      >
        <ScanLine className="w-3.5 h-3.5" />
        Scan card instead
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <canvas ref={canvasRef} className="hidden" />

      <div className="bg-background rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-primary" />
            {phase === "processing" ? "Reading card…" : phase === "result" ? "Card scanned!" : "Scan your card"}
          </h3>
          <button type="button" onClick={handleClose} className="rounded-full p-1.5 hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {phase === "camera" && (
          <div className="relative bg-black w-full" style={{ aspectRatio: "4/3" }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {flashActive && <div className="absolute inset-0 bg-white opacity-80 pointer-events-none" />}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="border-2 border-white rounded-xl shadow-lg"
                style={{ width: "82%", aspectRatio: "1.586/1" }}
              >
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-xl" />
              </div>
            </div>
            <p className="absolute bottom-3 left-0 right-0 text-center text-white text-xs drop-shadow">
              Position card inside the frame — front side facing up
            </p>
          </div>
        )}

        {phase === "processing" && (
          <div className="px-5 py-8 flex flex-col items-center gap-4">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="absolute inset-0" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted" />
                <circle
                  cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - ocrProgress / 100)}`}
                  strokeLinecap="round"
                  className="text-primary transition-all duration-300"
                  style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
                />
              </svg>
              <ScanLine className="w-7 h-7 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium text-sm">Analyzing card image…</p>
              <p className="text-xs text-muted-foreground mt-1">{ocrProgress}% complete</p>
            </div>
          </div>
        )}

        {phase === "result" && (
          <div className="px-5 pb-5 space-y-4">
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-green-700 dark:text-green-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Card details extracted — enter these in the form below
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-bold tracking-widest truncate">{cardNumber}</span>
                <button type="button" onClick={() => copyToClipboard(cardNumber, "number")} className="shrink-0 flex items-center gap-1 text-xs text-primary hover:underline">
                  {copied === "number" ? <><Check className="w-3.5 h-3.5" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
                </button>
              </div>
              {expiry && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">Exp: <span className="font-mono font-medium">{expiry}</span></span>
                  <button type="button" onClick={() => copyToClipboard(expiry, "expiry")} className="shrink-0 flex items-center gap-1 text-xs text-primary hover:underline">
                    {copied === "expiry" ? <><Check className="w-3.5 h-3.5" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setCardNumber(""); setExpiry(""); startCamera(); }}
                className="flex-1 border rounded-xl py-2.5 text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-1.5">
                <RefreshCw className="w-4 h-4" /> Scan again
              </button>
              <button type="button" onClick={handleClose}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors">
                Done
              </button>
            </div>
          </div>
        )}

        {(phase === "manual" || phase === "camera") && phase !== "camera" && (
          <div className="px-5 pb-5 space-y-4">
            {camError && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 text-xs text-amber-800 dark:text-amber-300 leading-snug">
                {camError}
              </div>
            )}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Card number</label>
                <input
                  ref={numberRef}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  value={cardNumber}
                  onChange={e => setCardNumber(fmtNumber(e.target.value))}
                  placeholder="•••• •••• •••• ••••"
                  maxLength={19}
                  className="w-full border rounded-xl px-4 py-3 font-mono text-base tracking-widest bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">Expiry</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    value={expiry}
                    onChange={e => setExpiry(fmtExpiry(e.target.value))}
                    placeholder="MM / YY"
                    maxLength={7}
                    className="w-full border rounded-xl px-4 py-3 font-mono text-base tracking-wider bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">CVC</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    value={cvc}
                    onChange={e => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="•••"
                    maxLength={4}
                    className="w-full border rounded-xl px-4 py-3 font-mono text-base tracking-widest bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => startCamera()}
                className="flex items-center gap-1.5 border rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                <ScanLine className="w-4 h-4" /> Try camera
              </button>
              <button type="button" onClick={handleClose}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors">
                Done
              </button>
            </div>
          </div>
        )}

        {phase === "camera" && (
          <div className="px-5 py-4 flex gap-2">
            <button type="button" onClick={() => { stopCamera(); setPhase("manual"); }}
              className="flex-1 border rounded-xl py-3 text-sm font-medium hover:bg-muted transition-colors">
              Enter manually
            </button>
            <button type="button" onClick={captureAndScan}
              className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
              <ScanLine className="w-4 h-4" /> Capture
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stripe Payment Form ────────────────────────────────────────────────────────
function StripePaymentForm({ onSuccess, customerEmail }: { onSuccess: () => void; customerEmail: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPaying(true);
    setError(null);
    try {
      const { error: submitErr } = await elements.submit();
      if (submitErr) { setError(submitErr.message ?? "Please check your card details"); setPaying(false); return; }

      const { error: confirmErr } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          receipt_email: customerEmail,
          return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (confirmErr) {
        setError(confirmErr.message ?? "Payment failed");
        setPaying(false);
      } else {
        toast({ title: "Payment successful!" });
        onSuccess();
      }
    } catch {
      setError("Payment failed. Please try again.");
      setPaying(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      <Button type="submit" size="lg" className="w-full h-13 text-base font-bold rounded-xl" disabled={paying || !stripe}>
        {paying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</> : <><ShieldCheck className="w-4 h-4 mr-2" />Pay & Book</>}
      </Button>
    </form>
  );
}

export default function StorefrontBook() {
  const { slug } = useParams<{ slug: string }>();
  const sfBase = slug ? `/${slug}` : "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const listingIdStr = searchParams.get("listingId");
  const listingId = listingIdStr ? parseInt(listingIdStr) : 0;
  const urlStart = searchParams.get("startDate");
  const urlEnd = searchParams.get("endDate");
  const isKiosk = searchParams.get("kiosk") === "1";

  // Keep the browser in fullscreen while the kiosk booking flow is active
  useEffect(() => {
    if (!isKiosk) return;
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    const doc = document as Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };

    const tryEnter = () => {
      const enter = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
      enter?.().catch(() => {});
    };

    tryEnter();

    const onFsChange = () => {
      const active = doc.fullscreenElement ?? doc.webkitFullscreenElement;
      if (!active) tryEnter();
    };

    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, [isKiosk]);

  const urlPricingType = searchParams.get("pricingType");
  const urlHours = searchParams.get("hours");

  const { data: listing, isLoading } = useGetListing(listingId, {
    query: { enabled: !!listingId, queryKey: getGetListingQueryKey(listingId) }
  });

  const { data: businessProfile } = useGetBusinessProfile({
    query: { queryKey: getGetBusinessProfileQueryKey() }
  });

  // ── 2 screens ──
  const [step, setStep] = useState<Step>("book");
  // Sub-state within "complete" screen (kiosk adds "photos" before "confirmed")
  type CompletePhase = "agreement" | "verification" | "photos" | "confirmed";
  const [completePhase, setCompletePhase] = useState<CompletePhase>("agreement");

  const [session, setSession] = useState<CustomerSession | null>(loadSession);

  // Dates + info
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    if (urlStart && urlEnd) {
      return { from: new Date(urlStart), to: new Date(urlEnd) };
    }
    return { from: new Date(), to: addDays(new Date(), 3) };
  });
  const [pickupTime, setPickupTime] = useState<string>(() => isKiosk ? currentTimeSlot() : "10:00 AM");
  const [dropoffTime, setDropoffTime] = useState<string>("10:00 AM");
  const [notes, setNotes] = useState("");
  const [name, setName] = useState(session?.name ?? "");
  const [email, setEmail] = useState(session?.email ?? "");
  const [phone, setPhone] = useState(session?.phone ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const [authError, setAuthError] = useState("");

  // Payment
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [showStripeForm, setShowStripeForm] = useState(false);
  // Prevents the auto-create effect from firing again when email/name change after intent is already in flight
  const intentFiredRef = useRef(false);

  // Kiosk QR-pay
  const [kioskPayMode, setKioskPayMode] = useState<"card" | "qr">("card");
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrPolling, setQrPolling] = useState(false);
  const [qrPayMethodLabel, setQrPayMethodLabel] = useState<string | null>(null);

  // Promo codes
  const [hasActivePromos, setHasActivePromos] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountType: "percent" | "fixed";
    discountValue: number;
    discountAmount: number;
    description: string;
  } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Agreement
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [agreementText, setAgreementText] = useState(DEFAULT_AGREEMENT);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [contractFields, setContractFields] = useState<Array<{
    id: string; label: string; key: string;
    type: "text" | "date" | "number" | "textarea" | "checkbox";
    required: boolean; placeholder: string; description: string;
  }>>([]);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const [sigHasContent, setSigHasContent] = useState(false);
  const [listingRules, setListingRules] = useState<ListingRule[]>([]);
  const [ruleInitials, setRuleInitials] = useState<Record<number, string>>({});
  const [ruleChecks, setRuleChecks] = useState<Record<number, boolean>>({});

  // Verification
  const [identityClientSecret, setIdentityClientSecret] = useState<string | null>(null);
  const [identitySessionId, setIdentitySessionId] = useState<string | null>(null);
  const [identityStatus, setIdentityStatus] = useState<"idle" | "pending" | "verified" | "failed">("idle");
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [identitySessionLoading, setIdentitySessionLoading] = useState(false);
  const [identitySessionFailed, setIdentitySessionFailed] = useState(false);
  const [identityIsTestMode, setIdentityIsTestMode] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<{ id: number; totalPrice: number } | null>(null);

  const [customerBookings, setCustomerBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  // Add-ons
  const [availableAddons, setAvailableAddons] = useState<Addon[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<number>>(new Set());

  // Quantity selection (multi-unit listings)
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [availabilityData, setAvailabilityData] = useState<{
    listingQuantity: number;
    ranges: { start: string; end: string; type: string; quantity: number }[];
  } | null>(null);

  // Platform protection plan (auto-applied based on listing category)
  const [platformProtectionPlan, setPlatformProtectionPlan] = useState<{
    enabled: boolean; feeAmount: string; categoryName?: string; categorySlug?: string;
  } | null>(null);

  // Kiosk pickup photos (only used in kiosk mode)
  const beforePhotoInputRef = useRef<HTMLInputElement>(null);
  const [beforePhotos, setBeforePhotos] = useState<File[]>([]);
  const [beforePreviews, setBeforePreviews] = useState<string[]>([]);
  const [savedPhotos, setSavedPhotos] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // Fetch agreement + fields; fall back to DEFAULT_AGREEMENT if none is configured
  useEffect(() => {
    const catSlug = (listing as any)?.categorySlug;
    const url = catSlug
      ? `${BASE}/api/platform/agreement?categorySlug=${encodeURIComponent(catSlug)}`
      : `${BASE}/api/platform/agreement`;
    Promise.all([
      fetch(url).then(r => r.json()),
      fetch(`${BASE}/api/platform/agreement/fields`).then(r => r.json()),
    ]).then(([d, f]) => {
      setAgreementText(d.value || DEFAULT_AGREEMENT);
      if (f.fields) setContractFields(f.fields);
    }).catch(() => {
      // Network failure — still show the default so the flow isn't blocked
      setAgreementText(DEFAULT_AGREEMENT);
    });
  }, [(listing as any)?.categorySlug]);

  // Fetch platform protection plan for this listing's category
  useEffect(() => {
    const catSlug = (listing as any)?.categorySlug;
    if (!catSlug) return;
    fetch(`${BASE}/api/protection-plan/${encodeURIComponent(catSlug)}`)
      .then(r => r.json())
      .then(d => setPlatformProtectionPlan(d))
      .catch(() => {});
  }, [(listing as any)?.categorySlug]);

  // Fetch booked-dates availability for multi-quantity logic
  useEffect(() => {
    if (!listingId) return;
    fetch(`${BASE}/api/listings/${listingId}/booked-dates`)
      .then(r => r.json())
      .then(d => {
        if (d && typeof d.listingQuantity === "number") {
          setAvailabilityData(d);
        }
      })
      .catch(() => {});
  }, [listingId]);

  // Fetch addons
  useEffect(() => {
    if (!listingId) return;
    // Parse any pre-selected add-on IDs from the URL (passed from the listing page)
    const urlAddonIds = new Set(
      (searchParams.get("addons") ?? "").split(",").map(s => parseInt(s)).filter(n => !isNaN(n) && n > 0)
    );
    fetch(`${BASE}/api/listings/${listingId}/addons`)
      .then(r => r.json())
      .then((data: Addon[]) => {
        if (!Array.isArray(data)) return;
        const active = data.filter(a => a.isActive);
        setAvailableAddons(active);
        const preSelected = new Set(
          active
            .filter(a => a.isRequired || a.name.toLowerCase().includes("protection") || urlAddonIds.has(a.id))
            .map(a => a.id)
        );
        setSelectedAddonIds(preSelected);
      })
      .catch(() => {});
  }, [listingId]);

  // Fetch listing rules + check promos
  useEffect(() => {
    if (!listingId) return;
    fetch(`${BASE}/api/listings/${listingId}/rules`)
      .then(r => r.json())
      .then((data: ListingRule[]) => { if (Array.isArray(data)) setListingRules(data); })
      .catch(() => {});
    if (slug) {
      fetch(`${BASE}/api/promo-codes/has-active?tenantSlug=${encodeURIComponent(slug)}`)
        .then(r => r.json())
        .then((data: { hasActive: boolean }) => setHasActivePromos(!!data.hasActive))
        .catch(() => {});
    }
  }, [listingId, slug]);

  // Load bookings on confirmation
  useEffect(() => {
    if (completePhase !== "confirmed" || !email) return;
    setBookingsLoading(true);
    fetch(`${BASE}/api/bookings?customerEmail=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setCustomerBookings(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())); })
      .catch(() => {})
      .finally(() => setBookingsLoading(false));
  }, [completePhase, email]);

  // Restore identity session from sessionStorage (page refresh during verification)
  useEffect(() => {
    const storageKey = `identity_session_${listingId}`;
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.identityClientSecret && parsed.identitySessionId) {
          setIdentityClientSecret(parsed.identityClientSecret);
          setIdentitySessionId(parsed.identitySessionId);
          setIdentityIsTestMode(!!parsed.identityIsTestMode);
          setStep("complete");
          setCompletePhase("verification");
          window.scrollTo(0, 0);
        }
      } catch { }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  const fetchIdentitySession = async (customerId?: number) => {
    setIdentitySessionLoading(true);
    setIdentitySessionFailed(false);
    try {
      const idRes = await fetch(`${BASE}/api/stripe/identity/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: slug,
          customerId: customerId ?? undefined,
          returnUrl: window.location.href,
        }),
      });
      const idData = await idRes.json();
      if (idRes.ok && idData.alreadyVerified) {
        // Customer already verified — skip the step entirely
        setIdentityStatus("verified");
        sessionStorage.removeItem(`identity_session_${listingId}`);
        setTimeout(() => { setCompletePhase(isKiosk ? "photos" : "confirmed"); window.scrollTo(0, 0); }, 600);
      } else if (idRes.ok && idData.clientSecret) {
        setIdentityClientSecret(idData.clientSecret);
        setIdentitySessionId(idData.sessionId);
        setIdentityIsTestMode(!!idData.testMode);
        const storageKey = `identity_session_${listingId}`;
        sessionStorage.setItem(storageKey, JSON.stringify({
          identityClientSecret: idData.clientSecret,
          identitySessionId: idData.sessionId,
          identityIsTestMode: !!idData.testMode,
        }));
      } else {
        setIdentitySessionFailed(true);
      }
    } catch {
      setIdentitySessionFailed(true);
    } finally {
      setIdentitySessionLoading(false);
    }
  };

  const days = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 1;
    const diff = differenceInDays(dateRange.to, dateRange.from);
    return diff > 0 ? diff : 1;
  }, [dateRange]);

  // ── Sub-day pricing ──────────────────────────────────────────────────────────
  type SubDayOption =
    | { type: "half_day"; label: string; price: number; hours: number }
    | { type: `slot_${number}`; label: string; price: number; hours: number }
    | { type: "per_hour"; label: string; pricePerHour: number; minHours: number };

  const subDayOptions = useMemo<SubDayOption[]>(() => {
    if (!listing) return [];
    const opts: SubDayOption[] = [];
    if ((listing as any).halfDayEnabled && (listing as any).halfDayRate) {
      opts.push({
        type: "half_day",
        label: `Half Day (${(listing as any).halfDayDurationHours || 4} hrs)`,
        price: parseFloat(String((listing as any).halfDayRate)),
        hours: (listing as any).halfDayDurationHours || 4,
      });
    }
    if ((listing as any).hourlyEnabled) {
      ((listing as any).hourlySlots ?? []).forEach((slot: { label: string; hours: number; price: number }, idx: number) => {
        opts.push({ type: `slot_${idx}` as `slot_${number}`, label: slot.label, price: slot.price, hours: slot.hours });
      });
      if ((listing as any).hourlyPerHourEnabled && listing.pricePerHour) {
        opts.push({
          type: "per_hour",
          label: "Per Hour",
          pricePerHour: parseFloat(String(listing.pricePerHour)),
          minHours: (listing as any).hourlyMinimumHours ?? 1,
        });
      }
    }
    return opts;
  }, [listing]);

  const hasSubDayOptions = subDayOptions.length > 0;
  const isOneDay = days === 1;

  // selectedPricingType: null = full day, or a sub-day type (can be pre-set from URL)
  const [selectedPricingType, setSelectedPricingType] = useState<string | null>(urlPricingType ?? null);
  const [selectedHours, setSelectedHours] = useState<number>(() => {
    if (urlHours) return parseInt(urlHours) || 1;
    return listing ? ((listing as any).hourlyMinimumHours ?? 1) : 1;
  });

  // Reset to full day when multi-day selected
  useEffect(() => {
    if (!isOneDay) setSelectedPricingType(null);
  }, [isOneDay]);

  // Sync min hours when listing loads
  useEffect(() => {
    if (listing) setSelectedHours((listing as any).hourlyMinimumHours ?? 1);
  }, [listing]);

  // Fixed time slots — replaces free-form time picker when defined
  type TimeSlotDef = { label: string; startTime: string; endTime: string; rate: "full_day" | "half_day" };
  const listingTimeSlots: TimeSlotDef[] = useMemo(() => {
    if (!listing) return [];
    const raw = (listing as any).timeSlots;
    return Array.isArray(raw) ? raw : [];
  }, [listing]);
  const hasTimeSlots = listingTimeSlots.length > 0;
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlotDef | null>(null);

  // When a time slot is selected, auto-apply its start/end times
  useEffect(() => {
    if (selectedTimeSlot) {
      setPickupTime(selectedTimeSlot.startTime);
      setDropoffTime(selectedTimeSlot.endTime);
    }
  }, [selectedTimeSlot]);

  // Reset slot selection when listing changes
  useEffect(() => {
    setSelectedTimeSlot(null);
  }, [listing?.id]);

  const selectedOption = subDayOptions.find(o => o.type === selectedPricingType) ?? null;

  const fullDayPrice = listing?.pricePerDay ? parseFloat(String(listing.pricePerDay)) : 0;

  // ── Availability / quantity logic ─────────────────────────────────────────────
  const listingTotalQty = availabilityData?.listingQuantity ?? (listing as any)?.quantity ?? 1;

  // For a given date, compute how many units are booked (sum of booking quantities overlapping that date)
  const bookedQtyOnDate = useMemo(() => {
    if (!availabilityData) return (_d: Date) => 0;
    return (d: Date) => {
      const dayStr = format(d, "yyyy-MM-dd");
      return availabilityData.ranges
        .filter(r => r.type === "booking")
        .filter(r => r.start <= dayStr && r.end >= dayStr)
        .reduce((sum, r) => sum + (r.quantity ?? 1), 0);
    };
  }, [availabilityData]);

  // Minimum available units across every day in the selected date range
  const availableQtyForRange = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return listingTotalQty;
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    const minAvail = days.reduce((min, d) => {
      const booked = bookedQtyOnDate(d);
      return Math.min(min, listingTotalQty - booked);
    }, listingTotalQty);
    return Math.max(0, minAvail);
  }, [dateRange, listingTotalQty, bookedQtyOnDate]);

  // Dates that are completely unavailable (all units booked — disable in calendar)
  const fullyBookedDates = useMemo(() => {
    if (!availabilityData || listingTotalQty <= 1) return [];
    return (d: Date) => {
      if (isBefore(d, startOfDay(new Date()))) return true;
      return bookedQtyOnDate(d) >= listingTotalQty;
    };
  }, [availabilityData, listingTotalQty, bookedQtyOnDate]);

  // Clamp selectedQuantity to available range when dateRange changes
  useEffect(() => {
    if (availableQtyForRange < selectedQuantity) {
      setSelectedQuantity(Math.max(1, availableQtyForRange));
    }
  }, [availableQtyForRange]);

  // When quantity changes, invalidate any in-progress payment intent so it
  // gets re-created with the correct (updated) total.
  useEffect(() => {
    if (paymentConfirmed) return; // already paid — don't reset
    if (!clientSecret) return;    // no intent yet — nothing to reset
    setClientSecret(null);
    setShowStripeForm(false);
    intentFiredRef.current = false;
  }, [selectedQuantity]); // eslint-disable-line react-hooks/exhaustive-deps

  const subtotal = useMemo(() => {
    // Time-slot rate overrides everything else when a slot is selected
    let base: number;
    if (hasTimeSlots && selectedTimeSlot) {
      if (selectedTimeSlot.rate === "half_day") {
        const hr = listing?.halfDayRate ? parseFloat(String(listing.halfDayRate)) : null;
        if (hr) { base = hr; }
        else { base = fullDayPrice; }
      } else {
        base = fullDayPrice;
      }
    } else if (!isOneDay || !selectedOption) {
      base = fullDayPrice * days;
    } else if (selectedOption.type === "half_day") {
      base = selectedOption.price;
    } else if (selectedOption.type.startsWith("slot_")) {
      base = (selectedOption as any).price;
    } else if (selectedOption.type === "per_hour") {
      base = (selectedOption as any).pricePerHour * selectedHours;
    } else {
      base = fullDayPrice * days;
    }
    return base * selectedQuantity;
  }, [hasTimeSlots, selectedTimeSlot, listing, isOneDay, selectedOption, fullDayPrice, days, selectedHours, selectedQuantity]);
  const deposit = listing?.depositAmount ? parseFloat(String(listing.depositAmount)) : 0;
  const addonsSubtotal = useMemo(() => {
    return availableAddons
      .filter(a => selectedAddonIds.has(a.id))
      .reduce((sum, a) => sum + (a.priceType === "per_day" ? a.price * days : a.price), 0);
  }, [availableAddons, selectedAddonIds, days]);
  const platformProtectionRate = platformProtectionPlan?.enabled ? parseFloat(platformProtectionPlan.feeAmount || "0") : 0;
  const platformProtectionFee = platformProtectionRate * days;
  const total = subtotal + addonsSubtotal + platformProtectionFee;
  const promoDiscount = appliedPromo ? Math.min(appliedPromo.discountAmount, total) : 0;
  const discountedTotal = Math.max(0.50, total - promoDiscount);

  const startFormatted = dateRange?.from ? format(dateRange.from, "MMM d, yyyy") : "—";
  const endFormatted = dateRange?.to ? format(dateRange.to, "MMM d, yyyy") : "—";
  const startFormattedWithTime = dateRange?.from ? `${format(dateRange.from, "MMM d, yyyy")} at ${pickupTime}` : "—";
  const endFormattedWithTime = dateRange?.to ? `${format(dateRange.to, "MMM d, yyyy")} at ${dropoffTime}` : "—";

  const autoFillMap: Record<string, string> = {
    renter_name:    name || "—",
    renter_email:   email || "—",
    renter_phone:   phone || "—",
    listing_title:  listing?.title || "—",
    category:       (listing as any)?.categoryName || "—",
    start_date:     startFormattedWithTime,
    end_date:       endFormattedWithTime,
    pickup_time:    pickupTime,
    dropoff_time:   dropoffTime,
    rental_days:    String(days),
    price_per_day:  listing?.pricePerDay ? `$${parseFloat(String(listing.pricePerDay)).toFixed(2)}` : "—",
    subtotal:       `$${subtotal.toFixed(2)}`,
    deposit_amount: deposit > 0 ? `$${deposit.toFixed(2)}` : "$0.00",
    total_price:    `$${discountedTotal.toFixed(2)}`,
    company_name:   (businessProfile as any)?.name || "—",
  };

  function renderAgreementParagraph(para: string, paraIdx: number) {
    const parts = para.split(/({{[^}]+}})/g);
    return (
      <p key={paraIdx}>
        {parts.map((part, i) => {
          const m = part.match(/^{{(.+)}}$/);
          if (!m) return <span key={i}>{part}</span>;
          const key = m[1].trim();
          if (autoFillMap[key] !== undefined) {
            return (
              <span key={i} className="font-semibold text-foreground underline decoration-primary/40 decoration-dotted">
                {autoFillMap[key]}
              </span>
            );
          }
          const fieldDef = contractFields.find(f => f.key === key);
          const currentVal = customFieldValues[key];
          const label = fieldDef?.label || key.replace(/_/g, " ");
          const isRequired = fieldDef?.required ?? true;
          if (currentVal) {
            return (
              <span key={i} className={`inline-block font-semibold px-1 rounded mx-0.5 ${isRequired ? "bg-amber-100 text-amber-900 border border-amber-300" : "bg-blue-50 text-blue-900 border border-blue-200"}`}>
                {fieldDef?.type === "checkbox" ? (currentVal === "true" ? "✓ Yes" : "✗ No") : currentVal}
              </span>
            );
          }
          return (
            <span key={i} className={`inline-block mx-0.5 px-1.5 rounded border-b-2 italic text-xs ${isRequired ? "border-red-400 text-red-500 bg-red-50" : "border-slate-300 text-slate-400 bg-slate-50"}`}>
              [{label}]
            </span>
          );
        })}
      </p>
    );
  }

  function resolveAgreementText(template: string): string {
    return template.replace(/{{([^}]+)}}/g, (_, key) => {
      const k = key.trim();
      if (autoFillMap[k] !== undefined) return autoFillMap[k];
      return customFieldValues[k] || `[${k}]`;
    });
  }

  useEffect(() => {
    if (session) {
      setName(session.name);
      setEmail(session.email);
      setPhone(session.phone ?? "");
    }
  }, [session]);

  // ── Signature canvas helpers ──
  const getSigPos = useCallback((e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }, []);

  const startSigDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    isDrawingRef.current = true;
    const pos = getSigPos(e.nativeEvent, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, [getSigPos]);

  const drawSig = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getSigPos(e.nativeEvent, canvas);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setSigHasContent(true);
  }, [getSigPos]);

  const stopSigDraw = useCallback(() => { isDrawingRef.current = false; }, []);

  const clearSig = useCallback(() => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSigHasContent(false);
  }, []);

  // Kiosk QR session
  const createQrSession = useCallback(async () => {
    if (!slug || !listing) return;
    setQrLoading(true);
    try {
      const res = await fetch(`${BASE}/api/stripe/checkout-qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: slug,
          amountCents: Math.round(discountedTotal * 100),
          customerEmail: email,
          customerName: name,
          listingTitle: listing.title,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create QR session");
      setQrSessionId(data.sessionId);
      setQrUrl(data.url);
      setIsTestMode(!!data.testMode);
      setQrPolling(true);
    } catch {
      toast({ title: "Unable to generate QR code", description: "Please use card payment instead.", variant: "destructive" });
    } finally {
      setQrLoading(false);
    }
  }, [slug, listing, discountedTotal, email, name, toast]);

  // Poll for QR completion
  useEffect(() => {
    if (!qrPolling || !qrSessionId || !slug) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BASE}/api/stripe/checkout-qr/${qrSessionId}?tenantSlug=${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (data.status === "complete") {
          clearInterval(interval);
          setQrPolling(false);
          if (data.paymentIntentId) setPaymentIntentId(data.paymentIntentId);
          if (data.paymentMethodLabel) setQrPayMethodLabel(data.paymentMethodLabel);
          setPaymentConfirmed(true);
        } else if (data.status === "expired") {
          clearInterval(interval);
          setQrPolling(false);
          setQrSessionId(null);
          setQrUrl(null);
          toast({ title: "QR code expired", description: "Please generate a new one.", variant: "destructive" });
        }
      } catch { }
    }, 2500);
    return () => clearInterval(interval);
  }, [qrPolling, qrSessionId, slug, toast]);

  // Auto-advance to agreement as soon as payment is confirmed (all methods)
  useEffect(() => {
    if (!paymentConfirmed || step !== "book") return;
    const timer = setTimeout(() => advanceToComplete(), 1500);
    return () => clearTimeout(timer);
  }, [paymentConfirmed, step]);

  const createPaymentIntent = useCallback(async (totalCents: number) => {
    if (!slug) return;
    try {
      const res = await fetch(`${BASE}/api/stripe/payment-intent`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: slug,
          amountCents: totalCents,
          customerEmail: email,
          customerName: name,
          bookingMeta: { listing_id: String(listingId) },
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast({ title: "Unable to initialize payment", description: errData.error ?? `HTTP ${res.status}`, variant: "destructive" });
        setShowStripeForm(false);
        return;
      }
      const data = await res.json();
      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
      setIsTestMode(!!data.testMode);
    } catch {
      toast({ title: "Payment setup failed — please try again", variant: "destructive" });
      setShowStripeForm(false);
    }
  }, [slug, email, name, listingId, toast]);

  // Auto-create payment intent for logged-in or kiosk users.
  // Kiosk: fires as soon as dates + total are ready — no name/email needed yet.
  // Logged-in: waits for session email+name.
  // intentFiredRef prevents this from re-firing every time the user types in the email field,
  // which would spam Stripe with partial/invalid emails on every keystroke.
  useEffect(() => {
    if (!session && !isKiosk) return;
    if (clientSecret || paymentConfirmed) return;
    if (intentFiredRef.current) return;
    if (!isKiosk && (!email || !name)) return;
    if (!dateRange?.from || !dateRange?.to) return;
    if (discountedTotal <= 0) return;
    intentFiredRef.current = true;
    const cents = Math.round(discountedTotal * 100);
    setShowStripeForm(true);
    createPaymentIntent(cents);
  }, [session, isKiosk, email, name, discountedTotal, clientSecret, paymentConfirmed, dateRange, createPaymentIntent]);

  if (!listingIdStr) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">No listing selected</h2>
        <Button onClick={() => setLocation(sfBase || "/")}>Browse Listings</Button>
      </div>
    );
  }

  if (isLoading) return <div className="container mx-auto px-4 py-16 text-center">Loading...</div>;
  if (!listing) return <div className="container mx-auto px-4 py-16 text-center">Listing not found</div>;

  // ── Validate + register/login then go to screen 2 ──
  const advanceToComplete = () => {
    setStep("complete");
    setCompletePhase("agreement");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleApplyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoLoading(true);
    setPromoError(null);
    try {
      const res = await fetch(`${BASE}/api/promo-codes/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, tenantSlug: slug, bookingAmountCents: Math.round(total * 100) }),
      });
      const data = await res.json();
      if (!data.valid) {
        setPromoError(data.error || "Invalid promo code");
        setAppliedPromo(null);
      } else {
        setAppliedPromo(data);
        setPromoError(null);
        toast({ title: `Promo code applied: ${data.description}` });
      }
    } catch {
      setPromoError("Failed to validate promo code");
    } finally {
      setPromoLoading(false);
    }
  };

  const handleContinueToPayment = () => {
    if (!name || !email || !phone) {
      toast({ title: "Please fill in your name, email, and phone first", variant: "destructive" }); return;
    }
    if (hasTimeSlots && !selectedTimeSlot) {
      toast({ title: "Please select a time slot", description: "Choose a pickup time slot to continue.", variant: "destructive" }); return;
    }
    const cents = Math.round(discountedTotal * 100);
    createPaymentIntent(cents);
    setShowStripeForm(true);
  };

  // Register new customer account (non-kiosk, non-logged-in)
  const handleRegisterAndPay = async () => {
    setAuthError("");
    if (!name || !email || !phone) {
      toast({ title: "Please fill in your name, email, and phone", variant: "destructive" }); return;
    }
    if (hasTimeSlots && !selectedTimeSlot) {
      toast({ title: "Please select a time slot", description: "Choose a pickup time slot to continue.", variant: "destructive" }); return;
    }
    if (password.length < 6) { setAuthError("Password must be at least 6 characters"); return; }
    if (password !== confirmPassword) { setAuthError("Passwords don't match"); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/customers/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, phone, slug: slug ?? "" })
      });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || "Registration failed"); return; }
      saveSession(data); setSession(data);
      // Now show payment
      const cents = Math.round(discountedTotal * 100);
      createPaymentIntent(cents);
      setShowStripeForm(true);
    } catch {
      setAuthError("Connection error, please try again");
    } finally { setIsSubmitting(false); }
  };

  // ── Final agreement submission ──
  const handleFinalSubmit = async () => {
    if (!name || !email || !phone) {
      toast({ title: "Please fill in your name, email, and phone", description: "Scroll up to complete your information before signing.", variant: "destructive" }); return;
    }
    if (!sigHasContent) {
      toast({ title: "Please draw your signature to proceed", variant: "destructive" }); return;
    }
    if (!agreeChecked) {
      toast({ title: "Please accept the rental terms", variant: "destructive" }); return;
    }
    if (agreementText) {
      const unfilledRequired = Array.from(agreementText.matchAll(/{{([^}]+)}}/g))
        .map(m => m[1].trim())
        .filter(k => {
          if (k in autoFillMap) return false;
          const def = contractFields.find(f => f.key === k);
          const isRequired = def?.required ?? true;
          if (!isRequired) return false;
          const val = customFieldValues[k];
          return !val;
        });
      if (unfilledRequired.length > 0) {
        const labels = unfilledRequired.map(k => {
          const def = contractFields.find(f => f.key === k);
          return def?.label || k.replace(/_/g, " ");
        });
        toast({ title: "Please complete all required fields", description: `Missing: ${labels.join(", ")}`, variant: "destructive" });
        return;
      }
    }

    const uncheckedRules = listingRules.filter(r => !ruleChecks[r.id]);
    if (uncheckedRules.length > 0) {
      toast({ title: "Please acknowledge all rental rules", description: `${uncheckedRules.length} rule${uncheckedRules.length > 1 ? "s" : ""} still need your acknowledgment.`, variant: "destructive" });
      return;
    }

    const signatureDataUrl = sigCanvasRef.current?.toDataURL("image/png") ?? "";

    setIsSubmitting(true);
    try {
      const selectedAddons = availableAddons
        .filter(a => selectedAddonIds.has(a.id))
        .map(a => ({
          id: a.id,
          name: a.name,
          price: a.price,
          priceType: a.priceType,
          subtotal: a.priceType === "per_day" ? a.price * days : a.price,
        }));

      const res = await fetch(`${BASE}/api/bookings`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          startDate: format(dateRange!.from!, "yyyy-MM-dd"),
          endDate: format(dateRange!.to!, "yyyy-MM-dd"),
          pickupTime,
          dropoffTime,
          quantity: selectedQuantity,
          notes: notes || undefined,
          source: isKiosk ? "kiosk" : "online",
          addons: selectedAddons,
          agreementSignerName: name.trim(),
          agreementText: agreementText ? resolveAgreementText(agreementText) : undefined,
          agreementSignatureDataUrl: signatureDataUrl,
          stripePaymentIntentId: paymentIntentId || undefined,
          appliedPromoCode: appliedPromo?.code || undefined,
          discountAmount: promoDiscount > 0 ? promoDiscount : undefined,
          depositPaid: deposit > 0 ? String(deposit) : undefined,
          protectionPlanFee: platformProtectionFee > 0 ? String(platformProtectionFee) : undefined,
          ruleInitials: listingRules.length > 0
            ? JSON.stringify(listingRules.map(r => ({
                ruleId: r.id,
                title: r.title,
                fee: r.fee,
                initials: ruleChecks[r.id] ? "✓" : "",
                initialedAt: new Date().toISOString(),
              })))
            : undefined,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConfirmedBooking({ id: data.id, totalPrice: data.totalPrice });

      if (appliedPromo?.code && slug) {
        fetch(`${BASE}/api/promo-codes/use`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: appliedPromo.code, tenantSlug: slug }),
        }).catch(() => {});
      }

      setCompletePhase("verification");
      fetchIdentitySession(session?.id ?? undefined);
      window.scrollTo(0, 0);
    } catch {
      toast({ title: "Booking failed", description: "Please try again.", variant: "destructive" });
    } finally { setIsSubmitting(false); }
  };

  // ── Stripe Identity ──
  const handleStartVerification = async () => {
    setIdentityError(null);
    if (!identityClientSecret) {
      toast({ title: "Verification session unavailable. Please contact support.", variant: "destructive" });
      return;
    }
    setIdentityStatus("pending");
    try {
      const stripePromise = identityIsTestMode ? testStripePromise : liveStripePromise;
      const stripe = await stripePromise;
      if (!stripe) { setIdentityStatus("failed"); setIdentityError("Stripe could not load."); return; }

      const { error } = await stripe.verifyIdentity(identityClientSecret);
      if (error) {
        setIdentityStatus("failed");
        setIdentityError(error.message ?? "Verification was not completed.");
        return;
      }

      if (identitySessionId) {
        const statusRes = await fetch(`${BASE}/api/stripe/identity/status/${identitySessionId}?tenantSlug=${encodeURIComponent(slug ?? "")}`);
        const statusData = await statusRes.json();
        if (statusData.verified) {
          setIdentityStatus("verified");
          sessionStorage.removeItem(`identity_session_${listingId}`);
          setTimeout(() => { setCompletePhase(isKiosk ? "photos" : "confirmed"); window.scrollTo(0, 0); }, 1200);
        } else {
          setIdentityStatus("failed");
          setIdentityError("Identity could not be verified. Please try again or contact support.");
        }
      } else {
        setIdentityStatus("verified");
        sessionStorage.removeItem(`identity_session_${listingId}`);
        setTimeout(() => { setCompletePhase(isKiosk ? "photos" : "confirmed"); window.scrollTo(0, 0); }, 1200);
      }
    } catch {
      setIdentityStatus("failed");
      setIdentityError("Verification failed. Please try again.");
    }
  };

  const handleRetryVerification = async () => {
    setIdentityStatus("idle");
    setIdentityError(null);
    setIdentityClientSecret(null);
    setIdentitySessionId(null);
    setIdentitySessionLoading(true);
    setIdentitySessionFailed(false);
    try {
      const idRes = await fetch(`${BASE}/api/stripe/identity/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug: slug, customerId: session?.id ?? undefined, returnUrl: window.location.href }),
      });
      const idData = await idRes.json();
      if (idRes.ok && idData.alreadyVerified) {
        // Already verified — skip
        setIdentityStatus("verified");
        setIdentitySessionLoading(false);
        sessionStorage.removeItem(`identity_session_${listingId}`);
        setTimeout(() => { setCompletePhase(isKiosk ? "photos" : "confirmed"); window.scrollTo(0, 0); }, 600);
        return;
      }
      if (!idRes.ok || !idData.clientSecret) { setIdentitySessionFailed(true); return; }

      setIdentityClientSecret(idData.clientSecret);
      setIdentitySessionId(idData.sessionId);
      setIdentityIsTestMode(!!idData.testMode);
      sessionStorage.setItem(`identity_session_${listingId}`, JSON.stringify({
        identityClientSecret: idData.clientSecret,
        identitySessionId: idData.sessionId,
        identityIsTestMode: !!idData.testMode,
      }));
      setIdentitySessionLoading(false);

      setIdentityStatus("pending");
      const stripeInst = await (idData.testMode ? testStripePromise : liveStripePromise);
      if (!stripeInst) { setIdentityStatus("failed"); setIdentityError("Stripe could not load."); return; }

      const { error } = await stripeInst.verifyIdentity(idData.clientSecret);
      if (error) { setIdentityStatus("failed"); setIdentityError(error.message ?? "Verification was not completed."); return; }

      if (idData.sessionId) {
        const statusRes = await fetch(`${BASE}/api/stripe/identity/status/${idData.sessionId}?tenantSlug=${encodeURIComponent(slug ?? "")}`);
        const statusData = await statusRes.json();
        if (statusData.verified) {
          setIdentityStatus("verified");
          sessionStorage.removeItem(`identity_session_${listingId}`);
          setTimeout(() => { setCompletePhase(isKiosk ? "photos" : "confirmed"); window.scrollTo(0, 0); }, 1200);
        } else {
          setIdentityStatus("failed");
          setIdentityError("Identity could not be verified. Please try again or contact support.");
        }
      } else {
        setIdentityStatus("verified");
        sessionStorage.removeItem(`identity_session_${listingId}`);
        setTimeout(() => { setCompletePhase(isKiosk ? "photos" : "confirmed"); window.scrollTo(0, 0); }, 1200);
      }
    } catch {
      setIdentityStatus("failed");
      setIdentityError("Verification failed. Please try again.");
    } finally {
      setIdentitySessionLoading(false);
    }
  };

  // ── Progress indicator ──
  const progressLabels = isKiosk
    ? ["Details & Payment", "Agreement", "Verify ID", "Photos", "Confirmed"]
    : ["Details & Payment", "Agreement", "Verify ID", "Confirmed"];
  const progressStep = step === "book" ? 0
    : completePhase === "agreement" ? 1
    : completePhase === "verification" ? 2
    : isKiosk && completePhase === "photos" ? 3
    : isKiosk ? 4
    : 3;

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Slim 2-step progress bar */}
      <div className="sticky top-16 z-10 bg-background border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center gap-0">
            {progressLabels.map((label, i) => (
              <div key={label} className="flex items-center flex-1">
                <div className={`flex items-center gap-1.5 text-xs font-semibold transition-colors
                  ${progressStep > i ? "text-primary" : progressStep === i ? "text-foreground" : "text-muted-foreground"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors
                    ${progressStep > i ? "bg-primary text-primary-foreground" 
                    : progressStep === i ? "bg-foreground text-background" 
                    : "bg-muted text-muted-foreground"}`}>
                    {progressStep > i ? "✓" : i + 1}
                  </div>
                  <span className="hidden sm:inline">{label}</span>
                </div>
                {i < progressLabels.length - 1 && <div className={`flex-1 h-0.5 mx-2 rounded transition-colors ${progressStep > i ? "bg-primary" : "bg-muted"}`} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Back button — hide during verification, photos, and confirmed */}
        {completePhase !== "verification" && completePhase !== "photos" && completePhase !== "confirmed" && (
          <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent text-muted-foreground" onClick={() => {
            if (step === "book") {
              if (isKiosk) { setLocation(`${sfBase}/admin/kiosk`); }
              else { window.history.back(); }
            } else {
              setStep("book"); window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {step === "book" ? (isKiosk ? "Back to Listings" : "Back to listing") : "Back"}
          </Button>
        )}

        <div className={`grid grid-cols-1 gap-8 ${completePhase !== "confirmed" ? "xl:grid-cols-5" : ""}`}>
          {/* Main content */}
          <div className={`min-w-0 ${completePhase !== "confirmed" ? "order-1 xl:order-1 xl:col-span-3" : ""}`}>

            {/* ════════════════════════════════════════
                SCREEN 1: DETAILS & PAYMENT
                ════════════════════════════════════════ */}
            {step === "book" && (
              <div className="space-y-8">
                <h1 className="text-2xl font-bold">Book {listing.title}</h1>

                {/* ── Kiosk: date picker at the very top, next to Order Summary ── */}
                {isKiosk && (
                  <div className="bg-muted/40 rounded-2xl border p-4 space-y-3">
                    <div>
                      <h2 className="text-base font-semibold mb-0.5">Select Rental Dates</h2>
                      <p className="text-xs text-muted-foreground">Choose your pickup and return dates to get started.</p>
                    </div>
                    <div className="relative z-0 bg-background rounded-2xl border shadow-sm p-3">
                      <Calendar
                        mode="range"
                        selected={dateRange}
                        onSelect={setDateRange}
                        disabled={typeof fullyBookedDates === "function" ? fullyBookedDates : { before: new Date() }}
                        defaultMonth={dateRange?.from}
                        numberOfMonths={1}
                        className="[--cell-size:2.8rem] md:[--cell-size:3.2rem] w-full"
                        classNames={{ root: "w-full" }}
                      />
                    </div>
                    {/* ── Quantity picker (kiosk) — shown when listing has multiple units ── */}
                    {listingTotalQty > 1 && dateRange?.from && dateRange?.to && (
                      <div className="bg-background rounded-xl border p-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold">Quantity</p>
                          <p className="text-xs text-muted-foreground">
                            {availableQtyForRange} of {listingTotalQty} available
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedQuantity(q => Math.max(1, q - 1))}
                            disabled={selectedQuantity <= 1}
                            className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-xl font-bold w-6 text-center">{selectedQuantity}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedQuantity(q => Math.min(availableQtyForRange, q + 1))}
                            disabled={selectedQuantity >= availableQtyForRange}
                            className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                    {dateRange?.from && dateRange?.to && (
                      hasTimeSlots ? (
                        /* ── Time Slot Picker (kiosk) ── */
                        <div className="relative z-10 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select a Time Slot</p>
                          {listingTimeSlots.map((slot, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setSelectedTimeSlot(slot)}
                              className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                                selectedTimeSlot?.label === slot.label
                                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                                  : "hover:bg-muted/50"
                              }`}
                            >
                              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold">{slot.label}</p>
                                <p className="text-xs text-muted-foreground">{slot.startTime} – {slot.endTime}</p>
                              </div>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                slot.rate === "half_day"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                              }`}>
                                {slot.rate === "half_day" ? "Half Day" : "Full Day"}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="relative z-10 grid grid-cols-2 gap-3">
                          <div className="bg-background rounded-xl border p-3">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Pickup</p>
                            <p className="font-semibold text-sm mb-2">{format(dateRange.from, "EEE, MMM d")}</p>
                            <div className="relative">
                              <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none z-10" />
                              <Select value={pickupTime} onValueChange={setPickupTime}>
                                <SelectTrigger className="pl-8 h-8 text-xs font-medium">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent position="popper" side="bottom" sideOffset={4}>
                                  {TIME_OPTIONS.map(t => (
                                    <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="bg-background rounded-xl border p-3">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Return</p>
                            <p className="font-semibold text-sm mb-2">{format(dateRange.to, "EEE, MMM d")}</p>
                            <div className="relative">
                              <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none z-10" />
                              <Select value={dropoffTime} onValueChange={setDropoffTime}>
                                <SelectTrigger className="pl-8 h-8 text-xs font-medium">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent position="popper" side="bottom" sideOffset={4}>
                                  {TIME_OPTIONS.map(t => (
                                    <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* ── Sub-Day Pricing Selector ── */}
                {hasSubDayOptions && isOneDay && (
                  <div className="rounded-2xl border p-4 space-y-3">
                    <div>
                      <p className="font-semibold text-sm mb-0.5">Rental Type</p>
                      <p className="text-xs text-muted-foreground">Choose how long you need it for this day.</p>
                    </div>
                    <div className="grid gap-2">
                      {/* Full Day option */}
                      <button
                        type="button"
                        onClick={() => setSelectedPricingType(null)}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                          selectedPricingType === null
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium">Full Day</p>
                        </div>
                        <p className="text-sm font-bold">${fullDayPrice.toFixed(2)}</p>
                      </button>

                      {subDayOptions.map(opt => (
                        <button
                          key={opt.type}
                          type="button"
                          onClick={() => {
                            setSelectedPricingType(opt.type);
                            if (opt.type === "per_hour") setSelectedHours((opt as any).minHours ?? 1);
                          }}
                          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                            selectedPricingType === opt.type
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <div>
                            <p className="text-sm font-medium">{opt.label}</p>
                            {opt.type !== "per_hour" && (opt as any).hours && (
                              <p className="text-xs text-muted-foreground">{(opt as any).hours} hr{(opt as any).hours !== 1 ? "s" : ""}</p>
                            )}
                          </div>
                          <p className="text-sm font-bold">
                            {opt.type === "per_hour"
                              ? `$${(opt as any).pricePerHour.toFixed(2)}/hr`
                              : `$${(opt as any).price.toFixed(2)}`}
                          </p>
                        </button>
                      ))}
                    </div>

                    {/* Per-hour selector */}
                    {selectedPricingType === "per_hour" && (() => {
                      const opt = selectedOption as { type: "per_hour"; pricePerHour: number; minHours: number } | null;
                      if (!opt) return null;
                      return (
                        <div className="border-t pt-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Number of Hours</p>
                            <p className="text-xs text-muted-foreground">Min: {opt.minHours} hr{opt.minHours !== 1 ? "s" : ""}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setSelectedHours(h => Math.max(opt.minHours, h - 1))}
                              className="w-8 h-8 rounded-full border flex items-center justify-center text-lg font-bold hover:bg-muted transition-colors disabled:opacity-30"
                              disabled={selectedHours <= opt.minHours}
                            >−</button>
                            <span className="font-bold text-lg w-12 text-center">{selectedHours}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedHours(h => h + 1)}
                              className="w-8 h-8 rounded-full border flex items-center justify-center text-lg font-bold hover:bg-muted transition-colors"
                            >+</button>
                            <span className="text-sm text-muted-foreground">× ${opt.pricePerHour.toFixed(2)}/hr = <span className="font-bold text-foreground">${(opt.pricePerHour * selectedHours).toFixed(2)}</span></span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special requests?" rows={2} />
                </div>

                {/* ── Rental Guidelines (informational, no action required) ── */}
                {listingRules.length > 0 && (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-blue-900">Rental Guidelines</p>
                        <p className="text-xs text-blue-600">Good to know before you confirm your booking</p>
                      </div>
                    </div>
                    <ul className="space-y-2.5">
                      {listingRules.map(rule => (
                        <li key={rule.id} className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-blue-900">{rule.title}</p>
                            {rule.description && (
                              <p className="text-xs text-blue-700/80 mt-0.5 leading-relaxed">{rule.description}</p>
                            )}
                            {rule.fee > 0 && (
                              <p className="text-xs text-amber-700 mt-1 font-medium">
                                Violation fee: ${rule.fee.toFixed(2)}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-blue-500 pt-1">
                      You'll be asked to initial each guideline when you sign the rental agreement below.
                    </p>
                  </div>
                )}

                {/* ── Protection Plan + Regular Add-ons ── */}
                {(() => {
                  const protectionAddons = availableAddons.filter(a => a.name.toLowerCase().includes("protection"));
                  const regularAddons = availableAddons.filter(a => !a.name.toLowerCase().includes("protection"));

                  const toggleAddon = (id: number, isProtection: boolean, isRequired: boolean) => {
                    if (isRequired || isProtection) return;
                    setSelectedAddonIds(prev => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id); else next.add(id);
                      return next;
                    });
                  };

                  return (
                    <>
                      {protectionAddons.map(addon => {
                        const addonPrice = addon.priceType === "per_day" ? addon.price * days : addon.price;
                        return (
                          <div
                            key={addon.id}
                            className="w-full text-left rounded-2xl overflow-hidden shadow-lg"
                            style={{ border: "2px solid #3ab549" }}
                          >
                            <div className="px-5 py-3 flex items-center justify-between" style={{ background: "#1a2332" }}>
                              <div className="flex items-center gap-2.5">
                                <ShieldCheck className="w-5 h-5" style={{ color: "#3ab549" }} />
                                <div className="flex flex-col leading-tight">
                                  <span className="font-black text-white text-sm tracking-wide">Protection Plan</span>
                                  <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#3ab549" }}>by OutdoorShare</span>
                                </div>
                              </div>
                              <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="h-5 opacity-80 object-contain" />
                              <span className="text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border" style={{ background: "rgba(58,181,73,0.15)", borderColor: "#3ab549", color: "#3ab549" }}>
                                <Lock className="w-3 h-3" /> Required
                              </span>
                            </div>
                            <div className="p-5" style={{ background: "#f0faf1" }}>
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <p className="text-sm text-gray-700 mb-3">
                                    A contractual protection offering (not insurance) that covers accidental damage to rented equipment, liability protection for certain incidents, and partial loss from accidents. Renters are responsible for deductibles and excluded situations.{" "}
                                    <a href="https://myoutdoorshare.com/protection-plan" target="_blank" rel="noopener noreferrer" className="font-semibold underline" style={{ color: "#3ab549" }}>Learn more →</a>
                                  </p>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                    {[
                                      { icon: AlertTriangle, text: "Accidental equipment damage" },
                                      { icon: ShieldCheck, text: "Liability protection" },
                                      { icon: Package, text: "Partial loss from accidents" },
                                      { icon: Lock, text: "Theft w/ forcible entry" },
                                    ].map(({ icon: Icon, text }) => (
                                      <div key={text} className="flex items-center gap-1.5">
                                        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "#3ab549" }} />
                                        <span className="text-xs text-gray-700">{text}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-3xl font-black" style={{ color: "#1a2332" }}>
                                    ${addonPrice.toFixed(0)}
                                  </p>
                                  {addon.priceType === "per_day" ? (
                                    <p className="text-xs text-gray-500">${addon.price}/day × {days} day{days !== 1 ? "s" : ""}</p>
                                  ) : (
                                    <p className="text-xs text-gray-500">flat fee</p>
                                  )}
                                  <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 font-bold text-sm text-white cursor-default" style={{ background: "#3ab549" }}>
                                    <CheckCircle2 className="w-4 h-4" /> Included
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {regularAddons.length > 0 && (
                        <div className="bg-background rounded-2xl border shadow-sm p-6 space-y-4">
                          <div>
                            <h2 className="font-bold text-base">Add-ons & Extras</h2>
                            <p className="text-sm text-muted-foreground mt-0.5">Enhance your rental with optional upgrades.</p>
                          </div>
                          <div className="space-y-3">
                            {regularAddons.map(addon => {
                              const selected = selectedAddonIds.has(addon.id);
                              const addonPrice = addon.priceType === "per_day" ? addon.price * days : addon.price;
                              return (
                                <button
                                  key={addon.id}
                                  type="button"
                                  disabled={addon.isRequired}
                                  onClick={() => toggleAddon(addon.id, false, addon.isRequired)}
                                  className={`w-full flex items-start gap-4 border-2 rounded-xl p-4 text-left transition-all
                                    ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}
                                    ${addon.isRequired ? "cursor-default" : "cursor-pointer"}`}
                                >
                                  <div className={`w-5 h-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors
                                    ${selected ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                                    {selected && (
                                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold text-sm">{addon.name}</span>
                                      {addon.isRequired && <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">Required</span>}
                                    </div>
                                    {addon.description && <p className="text-xs text-muted-foreground mt-0.5">{addon.description}</p>}
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="font-bold text-sm text-primary">+${addonPrice.toFixed(2)}</p>
                                    <p className="text-xs text-muted-foreground">{addon.priceType === "per_day" ? `$${addon.price.toFixed(2)}/day` : "flat fee"}</p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                <Separator />

                {/* ── Your Information ── */}
                <div>
                  <h2 className="text-lg font-semibold mb-4">Your Information</h2>

                  {isKiosk ? (
                    <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 mb-4">
                      <Monitor className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                        <span className="font-semibold">Kiosk booking</span> — No account needed. We'll email you a link to create your account and view your rental details.
                      </p>
                    </div>
                  ) : !session ? (
                    showLoginPanel ? (
                      <div className="bg-background border-2 border-primary/20 rounded-2xl p-5 space-y-4 shadow-sm mb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-primary" />
                            <h3 className="font-semibold text-sm">Log in to your account</h3>
                          </div>
                          <button onClick={() => { setShowLoginPanel(false); setAuthError(""); setPassword(""); }} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs">Email</Label>
                            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="mt-1 h-11" />
                          </div>
                          <div>
                            <Label className="text-xs">Password</Label>
                            <div className="relative mt-1">
                              <Input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" className="h-11 pr-10" />
                              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                        </div>
                        {authError && <p className="text-destructive text-sm">{authError}</p>}
                        <Button
                          className="w-full h-11"
                          disabled={isSubmitting}
                          onClick={async () => {
                            setAuthError("");
                            if (!email || !password) { setAuthError("Enter your email and password"); return; }
                            setIsSubmitting(true);
                            try {
                              const res = await fetch(`${BASE}/api/customers/login`, {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ email, password, slug: slug ?? "" })
                              });
                              const data = await res.json();
                              if (!res.ok) { setAuthError(data.error || "Login failed"); return; }
                              saveSession(data); setSession(data);
                              setName(data.name); setPhone(data.phone ?? "");
                              setShowLoginPanel(false);
                              setPassword("");
                            } catch { setAuthError("Connection error, please try again"); }
                            finally { setIsSubmitting(false); }
                          }}
                        >
                          {isSubmitting ? "Signing in…" : "Sign In"}
                        </Button>
                        <p className="text-center text-xs text-muted-foreground">
                          No account yet?{" "}
                          <button onClick={() => { setShowLoginPanel(false); setAuthError(""); }} className="text-primary hover:underline font-medium">
                            Continue as new customer
                          </button>
                        </p>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setShowLoginPanel(true); setAuthError(""); }}
                        className="w-full flex items-center gap-3 bg-muted/50 hover:bg-muted border border-border hover:border-primary/40 rounded-xl px-4 py-3 transition-all group text-left mb-4"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground">Returning customer?</p>
                          <p className="text-xs text-muted-foreground">Log in to pre-fill your details</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </button>
                    )
                  ) : (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3 mb-4">
                      <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="font-semibold text-sm">Signed in as {session.name}</p>
                        <p className="text-xs text-muted-foreground">{session.email}</p>
                      </div>
                      <button onClick={() => { localStorage.removeItem("rental_customer"); setSession(null); setName(""); setEmail(""); setPhone(""); }} className="ml-auto text-xs text-muted-foreground hover:text-foreground underline">Log out</button>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" value={name} onChange={e => setName(e.target.value)} className="mt-1.5 h-11" required />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1.5 h-11" required disabled={!!session} />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone</Label>
                        <Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="mt-1.5 h-11" required />
                      </div>
                    </div>
                  </div>

                  {!isKiosk && !session && !showLoginPanel && (
                    <div className="bg-muted/40 rounded-2xl p-5 space-y-3 border mt-4">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-primary" />
                        <h3 className="font-semibold text-sm">Create your account</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="relative">
                          <Input type={showPassword ? "text" : "password"} placeholder="Create password (min 6 chars)" value={password} onChange={e => setPassword(e.target.value)} className="h-11 pr-10" />
                          <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <Input type="password" placeholder="Confirm password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="h-11" />
                      </div>
                      {authError && <p className="text-destructive text-sm">{authError}</p>}
                      <p className="text-xs text-muted-foreground">Saves your info for future bookings.</p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* ── Payment ── */}
                <div>
                  <h2 className="text-lg font-semibold mb-4">Payment</h2>

                  {isKiosk && !paymentConfirmed && (
                    <div className="bg-background rounded-2xl border shadow-sm p-1.5 flex gap-1 mb-4">
                      <button
                        onClick={() => { setKioskPayMode("card"); setQrPolling(false); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${kioskPayMode === "card" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        <CreditCard className="w-4 h-4" />
                        Pay by Card
                      </button>
                      <button
                        onClick={() => {
                          setKioskPayMode("qr");
                          setShowStripeForm(false);
                          if (!qrUrl && !qrLoading) createQrSession();
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${kioskPayMode === "qr" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        <Smartphone className="w-4 h-4" />
                        Scan to Pay on Phone
                      </button>
                    </div>
                  )}

                  {/* QR payment panel */}
                  {isKiosk && kioskPayMode === "qr" && (
                    <div className="bg-background rounded-2xl border shadow-sm p-6 space-y-5 mb-4">
                      {paymentConfirmed ? (
                        <div className="flex flex-col items-center gap-4 py-4 text-center">
                          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                            <BadgeCheck className="w-10 h-10 text-green-600" />
                          </div>
                          <div>
                            <h2 className="text-2xl font-black text-green-800">Payment Received!</h2>
                            <p className="text-green-700 text-sm mt-1">
                              {qrPayMethodLabel ? `Paid via ${qrPayMethodLabel}` : "Payment confirmed"}
                              {isTestMode ? " (Test Mode — no real charge)" : ""}
                            </p>
                          </div>
                          <div className="text-4xl font-black tabular-nums text-green-900">${discountedTotal.toFixed(2)}</div>
                          <div className="flex items-center gap-2 text-sm text-green-700">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Advancing to agreement…
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-center space-y-1">
                            <h2 className="font-bold text-lg">Scan with your phone to pay</h2>
                            <p className="text-sm text-muted-foreground">Open your camera app and point it at the QR code.</p>
                            <div className="flex items-center justify-center gap-2 pt-1">
                              <span className="inline-flex items-center gap-1 bg-black text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white" aria-hidden="true"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z"/></svg>
                                Apple Pay
                              </span>
                              <span className="inline-flex items-center gap-1 bg-white border border-border text-foreground text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">Google Pay</span>
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">+ Card</span>
                            </div>
                          </div>
                          {qrLoading ? (
                            <div className="flex flex-col items-center gap-3 py-8">
                              <Loader2 className="w-8 h-8 animate-spin text-primary" />
                              <p className="text-sm text-muted-foreground">Generating secure payment link…</p>
                            </div>
                          ) : qrUrl ? (
                            <>
                              <div className="flex justify-center">
                                <div className="bg-white rounded-2xl p-4 shadow-sm border border-border inline-block">
                                  <QRCodeSVG value={qrUrl} size={220} level="M" includeMargin={false} />
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-3xl font-black tabular-nums">${discountedTotal.toFixed(2)}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">Total due</div>
                              </div>
                              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                                </span>
                                Waiting for payment on your phone…
                              </div>
                              {isTestMode && (
                                <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
                                  <span className="text-amber-600 font-bold text-xs uppercase tracking-wider bg-amber-200 px-2 py-0.5 rounded">Test Mode</span>
                                  <span className="text-sm text-amber-800">No real charges. Use card <strong>4242 4242 4242 4242</strong> on the phone.</span>
                                </div>
                              )}
                              <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => { setQrSessionId(null); setQrUrl(null); setQrPolling(false); createQrSession(); }}>
                                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                Generate new QR code
                              </Button>
                            </>
                          ) : (
                            <div className="flex flex-col items-center gap-4 py-6">
                              <p className="text-sm text-muted-foreground text-center">Click below to generate a secure payment QR code.</p>
                              <Button onClick={createQrSession} className="px-8">
                                <QrCode className="w-4 h-4 mr-2" />
                                Generate QR Code
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Promo code */}
                  {hasActivePromos && (!isKiosk || kioskPayMode === "card") && !showStripeForm && !paymentConfirmed && (
                    <div className="bg-background rounded-2xl border shadow-sm p-5 space-y-3 mb-4">
                      <h2 className="font-semibold text-sm flex items-center gap-2">
                        <Tag className="w-4 h-4 text-primary" />
                        Have a promo code?
                      </h2>
                      {appliedPromo ? (
                        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                            <div>
                              <p className="font-bold text-green-800 font-mono tracking-wider">{appliedPromo.code}</p>
                              <p className="text-xs text-green-700">{appliedPromo.description} applied</p>
                            </div>
                          </div>
                          <button className="text-xs text-muted-foreground hover:text-destructive underline" onClick={() => { setAppliedPromo(null); setPromoInput(""); setPromoError(null); }}>Remove</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            value={promoInput}
                            onChange={e => setPromoInput(e.target.value.toUpperCase().replace(/\s/g, ""))}
                            onKeyDown={e => e.key === "Enter" && handleApplyPromo()}
                            placeholder="Enter code"
                            className="font-mono uppercase font-semibold tracking-widest flex-1"
                            maxLength={30}
                          />
                          <Button variant="outline" onClick={handleApplyPromo} disabled={!promoInput.trim() || promoLoading} className="shrink-0">
                            {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                          </Button>
                        </div>
                      )}
                      {promoError && (
                        <p className="text-xs text-destructive flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5 shrink-0" />
                          {promoError}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Card payment — non-kiosk or kiosk card mode */}
                  {(!isKiosk || kioskPayMode === "card") && (
                    <>
                      {paymentConfirmed ? (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-3">
                          <BadgeCheck className="w-6 h-6 text-green-600 shrink-0" />
                          <div>
                            <p className="font-semibold text-green-800">Payment authorized</p>
                            <p className="text-sm text-green-700">{isTestMode ? "Test payment recorded — no real charge." : "Your card has been charged successfully."}</p>
                            <p className="text-xs text-green-600 mt-1 flex items-center gap-1.5">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Taking you to the rental agreement…
                            </p>
                          </div>
                        </div>
                      ) : !showStripeForm ? (
                        <div className="space-y-3">
                          {!isKiosk && !session && !showLoginPanel ? (
                            <Button size="lg" className="w-full h-13 text-base font-bold rounded-xl" onClick={handleRegisterAndPay} disabled={isSubmitting}>
                              {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account…</> : <><ShieldCheck className="w-4 h-4 mr-2" />Create Account & Pay {appliedPromo ? `— $${discountedTotal.toFixed(2)}` : ""}</>}
                            </Button>
                          ) : isKiosk && (!name || !email) ? (
                            <div className="flex items-start gap-3 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/30 px-4 py-4">
                              <div className="mt-0.5 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-primary font-bold text-xs">↓</span>
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground">Almost there!</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Fill in your name and email below to unlock payment.</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center py-6 gap-3 text-muted-foreground">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Preparing payment…</span>
                            </div>
                          )}
                          <div className="flex justify-center">
                            <CardScanHelper />
                          </div>
                        </div>
                      ) : !clientSecret ? (
                        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Preparing payment…</span>
                        </div>
                      ) : (
                        <>
                          {isTestMode && (
                            <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 mb-4">
                              <span className="text-amber-600 font-bold text-xs uppercase tracking-wider bg-amber-200 px-2 py-0.5 rounded">Test Mode</span>
                              <span className="text-sm text-amber-800">No real money will be charged. Use card <strong>4242 4242 4242 4242</strong>, any future expiry and CVC.</span>
                            </div>
                          )}
                          <div className="bg-background rounded-2xl border shadow-sm p-5">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="font-semibold flex items-center gap-2">
                                <CreditCard className="w-4 h-4 text-primary" />
                                Card Details
                              </h3>
                              <CardScanHelper />
                            </div>
                            <Elements stripe={isTestMode ? testStripePromise : liveStripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
                              <StripePaymentForm
                                onSuccess={() => setPaymentConfirmed(true)}
                                customerEmail={email}
                              />
                            </Elements>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-3">
                    <Lock className="w-3.5 h-3.5" />
                    Payments are processed securely by Stripe. Your card details are never stored on our servers.
                  </p>
                </div>

                {/* ── Review / Change Dates — non-kiosk only (kiosk shows this above payment) ── */}
                {!isKiosk && (
                  <div>
                    <Separator className="mb-6" />
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      Review or Change Dates
                    </h2>
                    <div className="bg-background rounded-2xl border shadow-sm p-3 sm:p-4">
                      <Calendar
                        mode="range"
                        selected={dateRange}
                        onSelect={setDateRange}
                        disabled={typeof fullyBookedDates === "function" ? fullyBookedDates : { before: new Date() }}
                        defaultMonth={dateRange?.from}
                        numberOfMonths={1}
                        className="[--cell-size:2.2rem] sm:[--cell-size:2.6rem] w-full"
                        classNames={{ root: "w-full" }}
                      />
                    </div>
                    {/* ── Quantity picker (online) — shown when listing has multiple units ── */}
                    {listingTotalQty > 1 && dateRange?.from && dateRange?.to && (
                      <div className="mt-3 bg-muted/40 rounded-xl border p-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold">Quantity</p>
                          <p className="text-xs text-muted-foreground">
                            {availableQtyForRange} of {listingTotalQty} available for your dates
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedQuantity(q => Math.max(1, q - 1))}
                            disabled={selectedQuantity <= 1}
                            className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-xl font-bold w-6 text-center">{selectedQuantity}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedQuantity(q => Math.min(availableQtyForRange, q + 1))}
                            disabled={selectedQuantity >= availableQtyForRange}
                            className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                    {dateRange?.from && dateRange?.to && (
                      hasTimeSlots ? (
                        /* ── Time Slot Picker (online) ── */
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select a Time Slot</p>
                          {listingTimeSlots.map((slot, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setSelectedTimeSlot(slot)}
                              className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                                selectedTimeSlot?.label === slot.label
                                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                                  : "hover:bg-muted/50"
                              }`}
                            >
                              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold">{slot.label}</p>
                                <p className="text-xs text-muted-foreground">{slot.startTime} – {slot.endTime}</p>
                              </div>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                slot.rate === "half_day"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                              }`}>
                                {slot.rate === "half_day" ? "Half Day" : "Full Day"}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div className="bg-background rounded-xl border p-3">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Pickup</p>
                            <p className="font-semibold text-sm mb-2">{format(dateRange.from, "EEE, MMM d")}</p>
                            <div className="relative">
                              <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none z-10" />
                              <Select value={pickupTime} onValueChange={setPickupTime}>
                                <SelectTrigger className="pl-8 h-8 text-xs font-medium">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent position="popper" side="bottom" sideOffset={4}>
                                  {TIME_OPTIONS.map(t => (
                                    <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="bg-background rounded-xl border p-3">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Return</p>
                            <p className="font-semibold text-sm mb-2">{format(dateRange.to, "EEE, MMM d")}</p>
                            <div className="relative">
                              <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none z-10" />
                              <Select value={dropoffTime} onValueChange={setDropoffTime}>
                                <SelectTrigger className="pl-8 h-8 text-xs font-medium">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent position="popper" side="bottom" sideOffset={4}>
                                  {TIME_OPTIONS.map(t => (
                                    <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* Auto-advances to agreement after payment — no button needed */}
              </div>
            )}

            {/* ════════════════════════════════════════
                SCREEN 2: AGREEMENT → VERIFY → CONFIRMED
                ════════════════════════════════════════ */}
            {step === "complete" && (
              <div className="space-y-6">

                {/* ── AGREEMENT PHASE ── */}
                {completePhase === "agreement" && (
                  <>
                    <h1 className="text-2xl font-bold">Rental Agreement</h1>

                    {/* Required contract fields */}
                    {agreementText && (() => {
                      const renterKeys = Array.from(agreementText.matchAll(/{{([^}]+)}}/g))
                        .map(m => m[1].trim())
                        .filter(k => !(k in autoFillMap));
                      const uniqueKeys = [...new Set(renterKeys)];
                      if (uniqueKeys.length === 0) return null;

                      const requiredUnfilled = uniqueKeys.filter(k => {
                        const def = contractFields.find(f => f.key === k);
                        const isRequired = def?.required ?? true;
                        const val = customFieldValues[k];
                        return isRequired && !val;
                      });

                      return (
                        <div className="bg-background rounded-2xl border shadow-sm overflow-hidden">
                          <div className={`px-6 py-4 border-b flex items-center gap-3 ${requiredUnfilled.length === 0 ? "bg-green-50/60" : "bg-amber-50/60"}`}>
                            {requiredUnfilled.length === 0
                              ? <><CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" /><div><p className="font-semibold text-green-800">All required fields complete</p><p className="text-xs text-green-600 mt-0.5">Review the agreement below before signing.</p></div></>
                              : <><AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" /><div><p className="font-semibold text-amber-800">Complete Required Information</p><p className="text-xs text-amber-600 mt-0.5">Fill in the fields below before signing.</p></div></>
                            }
                          </div>
                          <div className="p-6 grid grid-cols-1 gap-4">
                            {uniqueKeys.map(k => {
                              const def = contractFields.find(f => f.key === k);
                              const label = def?.label || k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                              const isRequired = def?.required ?? true;
                              const placeholder = def?.placeholder || label;
                              const description = def?.description;
                              const type = def?.type || "text";
                              const val = customFieldValues[k] ?? "";
                              const isFilledIn = type === "checkbox" ? true : !!val;

                              return (
                                <div key={k} className={`rounded-xl border p-4 transition-colors ${isFilledIn ? "border-green-200 bg-green-50/30" : isRequired ? "border-amber-200 bg-amber-50/30" : "border-slate-200 bg-slate-50/30"}`}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <label className="text-sm font-semibold text-foreground">{label}</label>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${isRequired ? "bg-red-100 text-red-600 border-red-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                                      {isRequired ? "Required" : "Optional"}
                                    </span>
                                    {isFilledIn && type !== "checkbox" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto" />}
                                  </div>
                                  {description && <p className="text-xs text-muted-foreground mb-2">{description}</p>}
                                  {type === "textarea" ? (
                                    <textarea
                                      value={val}
                                      onChange={e => setCustomFieldValues(prev => ({ ...prev, [k]: e.target.value }))}
                                      placeholder={placeholder}
                                      rows={3}
                                      className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                                    />
                                  ) : type === "checkbox" ? (
                                    <label className="flex items-center gap-3 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={val === "true"}
                                        onChange={e => setCustomFieldValues(prev => ({ ...prev, [k]: e.target.checked ? "true" : "false" }))}
                                        className="w-4 h-4 accent-primary"
                                      />
                                      <span className="text-sm text-foreground">{placeholder || label}</span>
                                    </label>
                                  ) : (
                                    <input
                                      type={type === "date" ? "date" : type === "number" ? "number" : "text"}
                                      value={val}
                                      onChange={e => setCustomFieldValues(prev => ({ ...prev, [k]: e.target.value }))}
                                      placeholder={placeholder}
                                      className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Agreement text */}
                    <div className="bg-background rounded-2xl border shadow-sm p-6 space-y-4 max-h-96 overflow-y-auto text-sm text-muted-foreground leading-relaxed">
                      <h2 className="text-base font-bold text-foreground">Rental Agreement</h2>
                      <p><strong className="text-foreground">Rental Period:</strong> {startFormattedWithTime} — {endFormattedWithTime} ({days} day{days > 1 ? "s" : ""})</p>
                      <p><strong className="text-foreground">Item:</strong> {listing.title}</p>
                      <p><strong className="text-foreground">Renter:</strong> {name} ({email})</p>
                      <Separator />
                      {agreementText
                        ? agreementText.split("\n\n").filter(Boolean).map((para, i) => renderAgreementParagraph(para, i))
                        : (
                          <div className="flex items-center gap-2 text-muted-foreground italic py-4">
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                            <span>Loading agreement…</span>
                          </div>
                        )
                      }
                      <p className="text-xs italic">By signing below, you confirm you have read, understood, and agree to all terms in this rental agreement.</p>
                    </div>

                    {/* Listing rules — checkbox acknowledgment */}
                    {listingRules.length > 0 && (
                      <div className="bg-background rounded-2xl border shadow-sm p-6 space-y-4">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-primary" />
                          <h3 className="font-semibold">Rental Rules — Check Each to Acknowledge</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Check the box next to each rule to confirm you have read and agree to it before signing.
                        </p>
                        <div className="space-y-2.5">
                          {listingRules.map(rule => {
                            const checked = !!ruleChecks[rule.id];
                            return (
                              <button
                                key={rule.id}
                                type="button"
                                onClick={() => setRuleChecks(prev => ({ ...prev, [rule.id]: !prev[rule.id] }))}
                                className={`w-full flex gap-4 items-start rounded-xl border p-4 text-left transition-all cursor-pointer
                                  ${checked
                                    ? "border-green-300 bg-green-50/60 shadow-sm"
                                    : "border-dashed border-muted-foreground/30 bg-muted/20 hover:border-muted-foreground/50 hover:bg-muted/30"}`}
                              >
                                {/* Checkbox */}
                                <div className={`mt-0.5 w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-all
                                  ${checked
                                    ? "bg-green-600 border-green-600"
                                    : "bg-background border-muted-foreground/40"}`}
                                >
                                  {checked && (
                                    <svg viewBox="0 0 12 9" className="w-3 h-3 text-white fill-current" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M1 4l3.5 3.5L11 1" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </div>
                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm">{rule.title}</p>
                                  {rule.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{rule.description}</p>
                                  )}
                                  {rule.fee > 0 && (
                                    <p className="text-xs text-amber-700 mt-1.5 font-semibold flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 shrink-0" />
                                      Violation fee: ${rule.fee.toFixed(2)} one time
                                    </p>
                                  )}
                                </div>
                                {checked && (
                                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {listingRules.some(r => !ruleChecks[r.id]) && (
                          <p className="text-xs text-amber-700 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            All rules must be checked before you can sign the agreement.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Cancellation Policy */}
                    {(businessProfile as any)?.cancellationPolicy && (
                      <div className="bg-background rounded-2xl border shadow-sm p-6 space-y-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          <h3 className="font-semibold">Cancellation Policy</h3>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                          <p className="text-sm text-amber-900 dark:text-amber-200 whitespace-pre-wrap leading-relaxed">
                            {(businessProfile as any).cancellationPolicy}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          This policy is set by <strong>{(businessProfile as any)?.name}</strong>. Contact them directly if you have questions about your specific situation.
                        </p>
                      </div>
                    )}

                    {/* Signature */}
                    <div className="bg-background rounded-2xl border shadow-sm p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          <h3 className="font-semibold">Sign the Agreement</h3>
                        </div>
                        {sigHasContent && (
                          <button type="button" onClick={clearSig} className="text-xs text-muted-foreground hover:text-destructive underline">Clear</button>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">Draw your signature below using your mouse or finger</p>
                      <div className={`relative border-2 rounded-xl overflow-hidden bg-white transition-colors ${sigHasContent ? "border-primary" : "border-dashed border-muted-foreground/40"}`} style={{ touchAction: "none" }}>
                        <canvas
                          ref={sigCanvasRef}
                          width={800}
                          height={200}
                          className="w-full block cursor-crosshair"
                          style={{ height: "160px" }}
                          onMouseDown={startSigDraw}
                          onMouseMove={drawSig}
                          onMouseUp={stopSigDraw}
                          onMouseLeave={stopSigDraw}
                          onTouchStart={startSigDraw}
                          onTouchMove={drawSig}
                          onTouchEnd={stopSigDraw}
                        />
                        {!sigHasContent && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                            <span className="text-muted-foreground/50 text-sm font-light italic">Sign here</span>
                            <span className="text-muted-foreground/30 text-xs mt-1">{name}</span>
                          </div>
                        )}
                        <div className="absolute bottom-8 left-8 right-8 border-b border-muted-foreground/20 pointer-events-none" />
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <User className="w-3 h-3" />
                        Signing as: <strong>{name}</strong>
                      </p>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={agreeChecked} onChange={e => setAgreeChecked(e.target.checked)} className="mt-0.5 w-4 h-4 accent-primary" />
                        <span className="text-sm">I have read and agree to all terms in the rental agreement above, including the cancellation policy and damage liability.</span>
                      </label>
                    </div>

                    <Button
                      size="lg"
                      className="w-full h-13 text-base font-bold rounded-xl"
                      onClick={handleFinalSubmit}
                      disabled={isSubmitting || !agreeChecked || !sigHasContent || listingRules.some(r => !ruleChecks[r.id])}
                    >
                      {isSubmitting ? "Submitting…" : "Sign & Verify My Identity"}
                      <ScanFace className="w-4 h-4 ml-2" />
                    </Button>
                  </>
                )}

                {/* ── VERIFICATION PHASE ── */}
                {completePhase === "verification" && (
                  <>
                    <h1 className="text-2xl font-bold">Verify Your Identity</h1>

                    {isTestMode && (
                      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-amber-800">Test Mode — </span>
                          <span className="text-amber-700">No real documents are collected. Use Stripe's test flow to simulate the verification experience.</span>
                        </div>
                      </div>
                    )}

                    {identityStatus === "verified" ? (
                      <div className="bg-green-50 border border-green-200 rounded-2xl p-8 flex flex-col items-center gap-4 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                          <BadgeCheck className="w-9 h-9 text-green-600" />
                        </div>
                        <div>
                          <p className="text-xl font-bold text-green-800">Identity Verified!</p>
                          <p className="text-green-700 text-sm mt-1">Confirming your booking…</p>
                        </div>
                        <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                      </div>
                    ) : (
                      <>
                        <div className="bg-background rounded-2xl border shadow-sm overflow-hidden">
                          <div className="bg-gradient-to-br from-primary/8 via-[#635BFF]/6 to-primary/5 px-6 py-6 border-b">
                            {/* 3-party trust chain: OutdoorShare + Rental Co + Stripe */}
                            <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
                              {/* OutdoorShare */}
                              <div className="flex items-center gap-1.5 bg-white/80 rounded-xl px-3 py-2 shadow-sm border border-primary/15">
                                <img
                                  src="/outdoorshare-logo.png"
                                  alt="OutdoorShare"
                                  className="h-6 w-auto object-contain shrink-0"
                                />
                              </div>
                              <span className="text-muted-foreground text-sm font-bold">+</span>
                              {/* Rental company */}
                              <div className="flex items-center gap-1.5 bg-white/80 rounded-xl px-3 py-2 shadow-sm border border-border">
                                {(businessProfile as any)?.logoUrl ? (
                                  <img
                                    src={`/api${(businessProfile as any).logoUrl}`}
                                    alt=""
                                    className="w-7 h-7 rounded-lg object-cover shrink-0"
                                  />
                                ) : (
                                  <div className="w-7 h-7 bg-muted rounded-lg flex items-center justify-center shrink-0">
                                    <Building2 className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                )}
                                <span className="font-bold text-xs text-foreground whitespace-nowrap">{(businessProfile as any)?.name || "Your Rental Company"}</span>
                              </div>
                              <span className="text-muted-foreground text-sm font-bold">+</span>
                              {/* Stripe Identity */}
                              <div className="flex items-center gap-1.5 bg-white/80 rounded-xl px-3 py-2 shadow-sm border border-[#635BFF]/20">
                                <svg width="20" height="20" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                                  <rect width="22" height="22" rx="5" fill="#635BFF"/>
                                  <path d="M11.08 8.22c0-.6.5-.84 1.32-.84.94 0 2.12.28 3.06.78V5.44a8.13 8.13 0 0 0-3.06-.56c-2.5 0-4.16 1.3-4.16 3.48 0 3.38 4.66 2.84 4.66 4.3 0 .7-.62.92-1.48.92-1.28 0-2.9-.52-4.18-1.24v2.76c1.42.62 2.86.88 4.18.88 2.56 0 4.32-1.26 4.32-3.48-.02-3.66-4.66-3-4.66-4.28z" fill="white"/>
                                </svg>
                                <span className="font-bold text-xs" style={{ color: "#635BFF" }}>Stripe</span>
                                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "#635BFF18", color: "#635BFF" }}>Identity</span>
                              </div>
                            </div>
                            <div className="text-center">
                              <h2 className="font-bold text-base text-foreground">Secure Identity Verification</h2>
                              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                OutdoorShare and <span className="font-semibold text-foreground">{(businessProfile as any)?.name || "your rental company"}</span> have teamed up with <span className="font-semibold" style={{ color: "#635BFF" }}>Stripe Identity</span> to verify renters before every rental — keeping equipment, owners, and renters protected.
                              </p>
                            </div>
                          </div>
                          <div className="p-5 space-y-4">
                            <p className="text-xs text-muted-foreground text-center uppercase tracking-wider font-semibold">What you'll need</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {[
                                { icon: CreditCard, label: "Government-issued ID", sub: "Passport, driver's license, or national ID" },
                                { icon: ScanFace, label: "Live selfie", sub: "A quick photo to match your ID" },
                                { icon: ShieldCheck, label: "Encrypted & private", sub: "Documents never stored by us" },
                              ].map(({ icon: Icon, label, sub }) => (
                                <div key={label} className="flex flex-col gap-1 bg-muted/40 rounded-xl p-4">
                                  <Icon className="w-5 h-5 text-primary mb-1" />
                                  <p className="text-xs font-semibold leading-snug">{label}</p>
                                  <p className="text-xs text-muted-foreground">{sub}</p>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-center text-muted-foreground leading-relaxed">
                              Your documents are processed directly by Stripe — neither OutdoorShare nor {(businessProfile as any)?.name || "your rental company"} ever sees or stores them. We only receive a verified / not verified result.
                            </p>
                          </div>
                        </div>

                        {identityStatus === "failed" && identityError && (
                          <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-sm text-destructive">
                            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-semibold">Verification not completed</p>
                              <p className="mt-0.5 text-destructive/80">{identityError}</p>
                            </div>
                          </div>
                        )}

                        {identityStatus === "pending" ? (
                          <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Verification in progress…</span>
                          </div>
                        ) : identitySessionLoading ? (
                          <Button size="lg" className="w-full h-13 text-base font-bold rounded-xl gap-2" disabled>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Preparing verification…
                          </Button>
                        ) : identitySessionFailed ? (
                          <div className="space-y-3">
                            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                              <div>
                                <p className="font-semibold">Couldn't start verification session</p>
                                <p className="text-amber-700 mt-0.5">There was a problem connecting to our verification service. You may retry or continue — your booking is already saved and the rental company will be notified.</p>
                              </div>
                            </div>
                            <Button size="lg" variant="outline" className="w-full h-13 text-base font-bold rounded-xl gap-2" onClick={() => fetchIdentitySession(session?.id ?? undefined)}>
                              <RefreshCw className="w-4 h-4" />
                              Retry
                            </Button>
                            <Button size="lg" variant="ghost" className="w-full h-11 text-sm font-medium rounded-xl gap-2 text-muted-foreground hover:text-foreground" onClick={() => { setCompletePhase(isKiosk ? "photos" : "confirmed"); window.scrollTo(0, 0); }}>
                              Continue without verification
                            </Button>
                          </div>
                        ) : identityStatus === "failed" ? (
                          <Button size="lg" className="w-full h-13 text-base font-bold rounded-xl gap-2" onClick={handleRetryVerification}>
                            <RefreshCw className="w-4 h-4" />Try Again
                          </Button>
                        ) : (
                          <Button size="lg" className="w-full h-13 text-base font-bold rounded-xl gap-2" onClick={handleStartVerification} disabled={!identityClientSecret}>
                            <ScanFace className="w-4 h-4" />Start Identity Verification
                          </Button>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* ── PHOTOS PHASE (kiosk only) ── */}
                {completePhase === "photos" && (
                  <div className="space-y-6">
                    <div>
                      <h1 className="text-2xl font-bold">Equipment Pickup Photos</h1>
                      <p className="text-muted-foreground text-sm mt-1">Take photos of the equipment right now before leaving. These protect both you and the owner in case of any later damage claims.</p>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3 text-sm text-blue-800">
                      <Upload className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Photograph all sides and any existing damage</p>
                        <p className="text-blue-700 text-xs mt-0.5">Minimum 2 photos recommended. The more the better.</p>
                      </div>
                    </div>

                    {/* Photo grid */}
                    <div className="grid grid-cols-3 gap-3">
                      {beforePreviews.map((src, i) => (
                        <div key={i} className="relative aspect-square rounded-xl overflow-hidden border-2 border-primary/20 bg-muted group">
                          <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              const newFiles = beforePhotos.filter((_, j) => j !== i);
                              const newPreviews = beforePreviews.filter((_, j) => j !== i);
                              URL.revokeObjectURL(beforePreviews[i]);
                              setBeforePhotos(newFiles);
                              setBeforePreviews(newPreviews);
                            }}
                            className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {savedPhotos.map((url, i) => (
                        <div key={`saved-${i}`} className="relative aspect-square rounded-xl overflow-hidden border-2 border-green-300 bg-muted">
                          <img src={url} alt={`Saved ${i + 1}`} className="w-full h-full object-cover" />
                          <div className="absolute bottom-1.5 right-1.5 bg-green-600 text-white rounded-full p-0.5">
                            <Check className="w-3 h-3" />
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => beforePhotoInputRef.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 bg-muted/40 hover:bg-muted/60 flex flex-col items-center justify-center gap-1.5 transition-all text-muted-foreground hover:text-primary"
                      >
                        <ImagePlus className="w-6 h-6" />
                        <span className="text-xs font-medium">Add photo</span>
                      </button>
                    </div>

                    <input
                      ref={beforePhotoInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      capture="environment"
                      className="hidden"
                      onChange={e => {
                        const files = Array.from(e.target.files ?? []);
                        if (!files.length) return;
                        setBeforePhotos(prev => [...prev, ...files]);
                        setBeforePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
                        e.target.value = "";
                      }}
                    />

                    <div className="space-y-3">
                      {(beforePhotos.length > 0 || savedPhotos.length === 0) && (
                        <Button
                          size="lg"
                          className="w-full h-13 text-base font-bold rounded-xl"
                          disabled={uploadingPhotos || beforePhotos.length === 0}
                          onClick={async () => {
                            if (!confirmedBooking || beforePhotos.length === 0) return;
                            setUploadingPhotos(true);
                            try {
                              const fd = new FormData();
                              beforePhotos.forEach(f => fd.append("photos", f));
                              const r = await fetch(`${BASE}/api/bookings/${confirmedBooking.id}/before-photos`, { method: "POST", body: fd });
                              const data = await r.json();
                              if (r.ok) {
                                setSavedPhotos(data.photos ?? []);
                                setBeforePhotos([]);
                                beforePreviews.forEach(u => URL.revokeObjectURL(u));
                                setBeforePreviews([]);
                                toast({ title: `${data.photos?.length ?? 0} photo${(data.photos?.length ?? 0) !== 1 ? "s" : ""} saved!` });
                              }
                            } catch {
                              toast({ title: "Upload failed — please try again", variant: "destructive" });
                            } finally {
                              setUploadingPhotos(false);
                            }
                          }}
                        >
                          {uploadingPhotos
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading…</>
                            : <><Upload className="w-4 h-4 mr-2" />Upload {beforePhotos.length} Photo{beforePhotos.length !== 1 ? "s" : ""}</>}
                        </Button>
                      )}

                      <Button
                        size="lg"
                        variant={savedPhotos.length > 0 ? "default" : "outline"}
                        className="w-full h-13 text-base font-bold rounded-xl"
                        onClick={() => { setCompletePhase("confirmed"); window.scrollTo(0, 0); }}
                      >
                        {savedPhotos.length > 0 ? (
                          <><CheckCircle2 className="w-4 h-4 mr-2" />Continue to Confirmation</>
                        ) : (
                          "Skip for now — continue without photos"
                        )}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>

                    <p className="text-xs text-center text-muted-foreground">
                      Powered by OutdoorShare — your photos are securely stored and linked to Booking #{confirmedBooking?.id}.
                    </p>
                  </div>
                )}

                {/* ── CONFIRMED PHASE ── */}
                {completePhase === "confirmed" && (
                  <div className="space-y-8">
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex items-center gap-5">
                      <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-7 h-7" />
                      </div>
                      <div>
                        <h1 className="text-xl font-black tracking-tight text-green-900">Booking Requested!</h1>
                        {confirmedBooking && <p className="text-green-700 text-sm mt-0.5">Reference #{confirmedBooking.id} · {listing.title}</p>}
                        {isKiosk ? (
                          <p className="text-green-700/80 text-sm mt-1">
                            A confirmation has been sent to <strong>{email}</strong>. Scan below to access your renter portal on your phone.
                          </p>
                        ) : (
                          <p className="text-green-700/80 text-sm mt-1">
                            We'll review and email a confirmation to <strong>{email}</strong>. Bring a valid ID on {startFormatted}.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* ── KIOSK: Portal QR code panel ── */}
                    {isKiosk && (() => {
                      const portalUrl = `${window.location.origin}${sfBase}/my-bookings`;
                      return (
                        <div className="bg-background rounded-2xl border shadow-sm overflow-hidden">
                          <div className="bg-gradient-to-br from-primary/8 to-primary/4 px-6 py-5 border-b flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                              <Smartphone className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-bold text-foreground">Take Your Booking With You</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Scan to open your renter portal on your phone</p>
                            </div>
                          </div>
                          <div className="p-6 flex flex-col sm:flex-row gap-8 items-center sm:items-start">
                            {/* QR code */}
                            <div className="shrink-0 flex flex-col items-center gap-2">
                              <div className="bg-white rounded-2xl p-3 border shadow-sm">
                                <QRCodeSVG value={portalUrl} size={160} level="M" includeMargin={false} />
                              </div>
                              <p className="text-[11px] text-muted-foreground text-center max-w-[160px]">Point your phone camera at this code</p>
                            </div>
                            {/* Benefits */}
                            <div className="flex-1 space-y-4">
                              <p className="text-sm text-muted-foreground">
                                Your renter portal lets you manage everything about your rental — right from your phone. Log in with the email you provided and you'll find:
                              </p>
                              <ul className="space-y-2.5">
                                {[
                                  { icon: CalendarIcon, text: "View all your past and upcoming bookings" },
                                  { icon: FileText,     text: "Download your signed rental agreement as a PDF" },
                                  { icon: RefreshCw,    text: "Request changes or cancellations" },
                                  { icon: QrCode,       text: "Chat directly with the rental company" },
                                  { icon: ShieldCheck,  text: "Check the status of your booking in real time" },
                                ].map(({ icon: Icon, text }, i) => (
                                  <li key={i} className="flex items-start gap-2.5 text-sm">
                                    <div className="mt-0.5 w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                      <Icon className="w-3 h-3 text-primary" />
                                    </div>
                                    <span className="text-foreground/80">{text}</span>
                                  </li>
                                ))}
                              </ul>
                              <p className="text-xs text-muted-foreground pt-1">
                                A confirmation email with your portal link has also been sent to <strong className="text-foreground">{email}</strong>.
                              </p>
                            </div>
                          </div>
                          <div className="px-6 pb-6">
                            <Button
                              size="lg"
                              variant="outline"
                              className="w-full font-semibold"
                              onClick={() => setLocation(`${sfBase}/admin/kiosk`)}
                            >
                              <ArrowLeft className="w-4 h-4 mr-2" />
                              Return to Kiosk
                            </Button>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-1 space-y-4">
                        <div className="bg-background rounded-2xl border shadow-sm p-5 space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <p className="font-bold leading-tight">{name}</p>
                              <p className="text-xs text-muted-foreground">{email}</p>
                            </div>
                          </div>
                          <Separator />
                          {phone && (
                            <div className="text-sm">
                              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Phone</p>
                              <p>{phone}</p>
                            </div>
                          )}
                          <Separator />
                          {isKiosk ? (
                            <Button variant="outline" size="sm" className="w-full" onClick={() => setLocation(`${sfBase}/admin/kiosk`)}>
                              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                              Return to Kiosk
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" className="w-full" onClick={() => setLocation(sfBase || "/")}>
                              Browse More Listings
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="lg:col-span-2 space-y-4">
                        <h2 className="font-bold text-lg">My Bookings</h2>
                        {bookingsLoading ? (
                          <div className="space-y-3">
                            {[1,2,3].map(i => <div key={i} className="animate-pulse bg-muted rounded-xl h-20" />)}
                          </div>
                        ) : customerBookings.length === 0 ? (
                          <div className="bg-muted/30 rounded-2xl p-8 text-center text-muted-foreground text-sm">No bookings found</div>
                        ) : (
                          <div className="space-y-3">
                            {customerBookings.map(b => {
                              const isNew = b.id === confirmedBooking?.id;
                              const statusColors: Record<string, string> = {
                                pending: "bg-amber-100 text-amber-800",
                                confirmed: "bg-blue-100 text-blue-800",
                                active: "bg-green-100 text-green-800",
                                completed: "bg-muted text-muted-foreground",
                                cancelled: "bg-red-100 text-red-800",
                              };
                              return (
                                <div
                                  key={b.id}
                                  onClick={() => setLocation(`${sfBase}/my-bookings/${b.id}`)}
                                  className={`bg-background rounded-2xl border p-4 flex items-center gap-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all ${isNew ? "border-primary ring-1 ring-primary/20" : ""}`}
                                >
                                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                    <CalendarIcon className="w-5 h-5 text-primary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <p className="font-semibold text-sm truncate">{b.listingTitle}</p>
                                      {isNew && <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">NEW</span>}
                                    </div>
                                    <p className="text-xs text-muted-foreground">{b.startDate} → {b.endDate}</p>
                                  </div>
                                  <div className="text-right shrink-0 space-y-1">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${statusColors[b.status] ?? "bg-muted text-muted-foreground"}`}>
                                      {b.status}
                                    </span>
                                    <p className="text-xs font-bold text-foreground">${parseFloat(b.totalPrice).toFixed(2)}</p>
                                  </div>
                                </div>
                              );
                            })}
                            <Button variant="outline" size="sm" className="w-full mt-1" onClick={() => setLocation(`${sfBase}/my-bookings`)}>
                              View All My Bookings
                              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── SIDEBAR SUMMARY ── */}
          {completePhase !== "confirmed" && (
            <div className="min-w-0 order-2 xl:order-2 xl:col-span-2">
              <div className="sticky top-32 space-y-4">
                {dateRange?.from && dateRange?.to && (
                  <div className="bg-background rounded-2xl border shadow-sm p-5 space-y-3">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-primary" />
                      Order Summary
                    </h3>
                    <Separator />
                    <div className="space-y-2 text-sm">
                      <div className="flex flex-col gap-1 text-muted-foreground text-xs">
                        <div className="flex items-center gap-1.5">
                          <CalendarIcon className="w-3 h-3 shrink-0" />
                          <span className="font-medium text-foreground">Pickup:</span>
                          {startFormatted}
                          <span className="flex items-center gap-0.5 ml-auto text-primary font-semibold"><Clock className="w-3 h-3" />{pickupTime}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CalendarIcon className="w-3 h-3 shrink-0" />
                          <span className="font-medium text-foreground">Return:</span>
                          {endFormatted}
                          <span className="flex items-center gap-0.5 ml-auto text-primary font-semibold"><Clock className="w-3 h-3" />{dropoffTime}</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        {selectedOption && isOneDay ? (
                          <span>
                            {selectedOption.type === "per_hour"
                              ? `${selectedHours} hr${selectedHours !== 1 ? "s" : ""} × $${(selectedOption as any).pricePerHour.toFixed(2)}/hr${selectedQuantity > 1 ? ` × ${selectedQuantity}` : ""}`
                              : selectedOption.label}{selectedQuantity > 1 ? ` × ${selectedQuantity}` : ""}
                          </span>
                        ) : (
                          <span>
                            ${fullDayPrice.toFixed(2)}/day × {days} day{days > 1 ? "s" : ""}
                            {selectedQuantity > 1 && <span className="font-semibold text-foreground"> × {selectedQuantity}</span>}
                          </span>
                        )}
                        <span className="font-semibold text-foreground">${subtotal.toFixed(2)}</span>
                      </div>
                      {availableAddons.filter(a => selectedAddonIds.has(a.id)).map(a => (
                        <div key={a.id} className="flex justify-between text-muted-foreground">
                          <span className="truncate mr-2">{a.name}</span>
                          <span>+${(a.priceType === "per_day" ? a.price * days : a.price).toFixed(2)}</span>
                        </div>
                      ))}
                      {platformProtectionFee > 0 && (
                        <div className="flex justify-between text-blue-700 font-medium">
                          <span className="flex items-center gap-1.5">
                            <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="h-3.5 object-contain opacity-80" />
                            Protection Plan (${platformProtectionRate.toFixed(0)}/day × {days} day{days !== 1 ? "s" : ""})
                          </span>
                          <span>+${platformProtectionFee.toFixed(2)}</span>
                        </div>
                      )}
                      {appliedPromo && (
                        <div className="flex justify-between text-green-600 font-medium">
                          <span className="flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {appliedPromo.code}
                          </span>
                          <span>-${promoDiscount.toFixed(2)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between font-bold text-base">
                        <span>Total due today</span>
                        <span className={appliedPromo ? "text-green-700" : ""}>${discountedTotal.toFixed(2)}</span>
                      </div>
                      {appliedPromo && (
                        <div className="flex justify-between text-xs text-muted-foreground line-through">
                          <span>Original price</span>
                          <span>${total.toFixed(2)}</span>
                        </div>
                      )}
                      {deposit > 0 && (
                        <div className="flex justify-between text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          <span className="flex items-center gap-1.5 text-amber-800 font-medium">
                            <Lock className="w-3 h-3" />
                            Security deposit (held at pickup)
                          </span>
                          <span className="text-amber-800 font-semibold">${deposit.toFixed(2)}</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Lock className="w-3 h-3" /> No charge until confirmed
                      </p>
                    </div>
                  </div>
                )}

                <div className="bg-background rounded-2xl border shadow-sm overflow-hidden">
                  <div className="aspect-[16/9] bg-muted relative">
                    {listing.imageUrls?.[0] ? (
                      <img src={listing.imageUrls[0]} alt={listing.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No image</div>
                    )}
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-0.5">{listing.categoryName}</p>
                    <h3 className="font-semibold text-sm leading-snug">{listing.title}</h3>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
