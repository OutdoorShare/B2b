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
  ScanFace, RefreshCw, XCircle, Clock, Tag, Monitor, QrCode, Smartphone
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { differenceInDays, format, addDays } from "date-fns";
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

/** Returns the current time rounded UP to the nearest 30-min slot, clamped to TIME_OPTIONS range. */
function currentTimeSlot(): string {
  const now = new Date();
  let h = now.getHours();
  let m = now.getMinutes();
  // Round up to next 30-minute boundary
  if (m === 0) { /* exactly on a slot — keep as-is */ }
  else if (m <= 30) { m = 30; }
  else { m = 0; h += 1; }
  // Clamp to operating range (6:00 AM – 10:00 PM)
  if (h < 6) { h = 6; m = 0; }
  if (h > 22 || (h === 22 && m > 0)) { h = 22; m = 0; }
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "AM" : "PM";
  const minStr = m === 0 ? "00" : "30";
  return `${hour12}:${minStr} ${ampm}`;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Step = "dates" | "payment" | "agreement" | "verification" | "confirmation";

type Addon = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  priceType: "flat" | "per_day";
  isRequired: boolean;
  isActive: boolean;
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


const STEP_LABELS: Record<Step, string> = {
  dates: "Dates & Info",
  payment: "Payment",
  agreement: "Agreement",
  verification: "Verify ID",
  confirmation: "Confirmed",
};
const STEPS: Step[] = ["dates", "payment", "agreement", "verification", "confirmation"];

// ── Stripe Payment Form (uses Stripe Elements context) ────────────────────────
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
        confirmParams: { receipt_email: customerEmail },
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-background rounded-2xl border shadow-sm p-6">
        <h2 className="font-semibold flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-primary" />
          Card Details
        </h2>
        <PaymentElement options={{ layout: "tabs" }} />
      </div>
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      <Button type="submit" size="lg" className="w-full h-13 text-base font-bold rounded-xl" disabled={paying || !stripe}>
        {paying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</> : <><ShieldCheck className="w-4 h-4 mr-2" />Pay & Continue</>}
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

  const { data: listing, isLoading } = useGetListing(listingId, {
    query: { enabled: !!listingId, queryKey: getGetListingQueryKey(listingId) }
  });

  const { data: businessProfile } = useGetBusinessProfile({
    query: { queryKey: getGetBusinessProfileQueryKey() }
  });

  const [step, setStep] = useState<Step>("dates");
  const [session, setSession] = useState<CustomerSession | null>(loadSession);

  // Step 1: dates + personal + account — pre-fill from listing page URL params
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

  // Step 2: payment — Stripe
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [showStripeForm, setShowStripeForm] = useState(false);

  // Kiosk QR-pay (pay on phone via Stripe Checkout)
  const [kioskPayMode, setKioskPayMode] = useState<"card" | "qr">("card");
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrPolling, setQrPolling] = useState(false);
  const [qrPayMethodLabel, setQrPayMethodLabel] = useState<string | null>(null);

  // Promo codes
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

  // Step 3: agreement
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [agreementText, setAgreementText] = useState("");
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const [sigHasContent, setSigHasContent] = useState(false);

  // Step 4: Stripe Identity verification
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

  // Fetch the agreement text — use category-specific if available, else global
  useEffect(() => {
    const slug = (listing as any)?.categorySlug;
    const url = slug
      ? `${BASE}/api/platform/agreement?categorySlug=${encodeURIComponent(slug)}`
      : `${BASE}/api/platform/agreement`;
    fetch(url)
      .then(r => r.json())
      .then(d => { if (d.value) setAgreementText(d.value); })
      .catch(() => {});
  }, [(listing as any)?.categorySlug]);

  // Fetch addons for the listing; auto-select required ones
  useEffect(() => {
    if (!listingId) return;
    fetch(`${BASE}/api/listings/${listingId}/addons`)
      .then(r => r.json())
      .then((data: Addon[]) => {
        if (!Array.isArray(data)) return;
        const active = data.filter(a => a.isActive);
        setAvailableAddons(active);
        // auto-select required addons + all protection plan addons (always required)
        const required = new Set(active.filter(a => a.isRequired || a.name.toLowerCase().includes("protection")).map(a => a.id));
        setSelectedAddonIds(required);
      })
      .catch(() => {});
  }, [listingId]);

  useEffect(() => {
    if (step !== "confirmation" || !email) return;
    setBookingsLoading(true);
    fetch(`${BASE}/api/bookings?customerEmail=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setCustomerBookings(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())); })
      .catch(() => {})
      .finally(() => setBookingsLoading(false));
  }, [step, email]);

  // Restore identity session from sessionStorage on page load (in case of refresh mid-verification)
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
          setStep("verification");
          window.scrollTo(0, 0);
        }
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  // ── Fetch a new Stripe Identity session ───────────────────────────────────
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
      if (idRes.ok && idData.clientSecret) {
        setIdentityClientSecret(idData.clientSecret);
        setIdentitySessionId(idData.sessionId);
        setIdentityIsTestMode(!!idData.testMode);
        // Persist to sessionStorage so page refresh can resume
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

  const subtotal = (listing?.pricePerDay ? parseFloat(String(listing.pricePerDay)) : 0) * days;
  const deposit = listing?.depositAmount ? parseFloat(String(listing.depositAmount)) : 0;
  const addonsSubtotal = useMemo(() => {
    return availableAddons
      .filter(a => selectedAddonIds.has(a.id))
      .reduce((sum, a) => sum + (a.priceType === "per_day" ? a.price * days : a.price), 0);
  }, [availableAddons, selectedAddonIds, days]);
  const total = subtotal + addonsSubtotal + deposit;
  const promoDiscount = appliedPromo ? Math.min(appliedPromo.discountAmount, total) : 0;
  const discountedTotal = Math.max(0.50, total - promoDiscount);

  // ── Agreement token resolution ─────────────────────────────────────────────
  // Map of known auto-fill token keys → their runtime values
  const autoFillMap: Record<string, string> = {
    renter_name:    name || "—",
    renter_email:   email || "—",
    renter_phone:   phone || "—",
    listing_title:  listing?.title || "—",
    category:       (listing as any)?.categoryName || "—",
    start_date:     dateRange?.from ? `${format(dateRange.from, "MMM d, yyyy")} at ${pickupTime}` : "—",
    end_date:       dateRange?.to   ? `${format(dateRange.to,   "MMM d, yyyy")} at ${dropoffTime}` : "—",
    pickup_time:    pickupTime,
    dropoff_time:   dropoffTime,
    rental_days:    String(days),
    price_per_day:  listing?.pricePerDay ? `$${parseFloat(String(listing.pricePerDay)).toFixed(2)}` : "—",
    subtotal:       `$${subtotal.toFixed(2)}`,
    deposit_amount: deposit > 0 ? `$${deposit.toFixed(2)}` : "$0.00",
    total_price:    `$${discountedTotal.toFixed(2)}`,
    company_name:   (businessProfile as any)?.name || "—",
  };

  // Render agreement template as React nodes — auto-fill tokens become
  // highlighted spans; unknown tokens become inputs the renter must complete
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
          // Unknown token → inline input the renter must complete
          const label = key.replace(/_/g, " ");
          return (
            <span key={i} className="inline-flex items-center gap-1 mx-0.5 align-middle">
              <input
                type="text"
                value={customFieldValues[key] ?? ""}
                onChange={e => setCustomFieldValues(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={label}
                className="border-b-2 border-amber-400 bg-amber-50 text-amber-900 text-xs px-1.5 py-0.5 rounded-sm focus:outline-none focus:border-amber-600 min-w-[120px] font-medium placeholder:text-amber-400/60"
              />
            </span>
          );
        })}
      </p>
    );
  }

  // Resolve all tokens to final text for booking submission
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

  // ── Signature canvas helpers (must be defined before early returns) ───────
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

  // Kiosk: create Stripe Checkout Session for phone-pay QR code
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

  // Poll Stripe for QR session completion every 2.5 seconds
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
      } catch { /* ignore polling errors */ }
    }, 2500);
    return () => clearInterval(interval);
  }, [qrPolling, qrSessionId, slug, toast]);

  // Auto-advance from payment step to agreement step after QR payment confirmed
  useEffect(() => {
    if (!paymentConfirmed || kioskPayMode !== "qr" || step !== "payment") return;
    const timer = setTimeout(() => handlePaymentNext(), 3000);
    return () => clearTimeout(timer);
  }, [paymentConfirmed, kioskPayMode, step]);

  // Create Stripe payment intent when entering the payment step
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
      // Note: payments always accepted — OutdoorShare holds funds if tenant not yet connected
      if (!res.ok) { toast({ title: "Unable to initialize payment", variant: "destructive" }); return; }
      const data = await res.json();
      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
      setIsTestMode(!!data.testMode);
    } catch {
      toast({ title: "Payment setup failed", variant: "destructive" });
    }
  }, [slug, email, name, listingId, toast]);

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

  const startFormatted = dateRange?.from ? format(dateRange.from, "MMM d, yyyy") : "—";
  const endFormatted = dateRange?.to ? format(dateRange.to, "MMM d, yyyy") : "—";
  const startFormattedWithTime = dateRange?.from ? `${format(dateRange.from, "MMM d, yyyy")} at ${pickupTime}` : "—";
  const endFormattedWithTime = dateRange?.to ? `${format(dateRange.to, "MMM d, yyyy")} at ${dropoffTime}` : "—";

  const handleDatesNext = async () => {
    setAuthError("");
    if (!dateRange?.from || !dateRange?.to) {
      toast({ title: "Please select pickup and return dates", variant: "destructive" }); return;
    }
    if (!name || !email || !phone) {
      toast({ title: "Please fill in your name, email, and phone", variant: "destructive" }); return;
    }

    // Kiosk mode: no login or account creation — go straight to payment
    if (isKiosk) {
      setStep("payment");
      setShowStripeForm(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Already logged in — go straight to payment
    if (session) {
      setStep("payment");
      setShowStripeForm(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Register new account
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
      setStep("payment");
      setShowStripeForm(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setAuthError("Connection error, please try again");
    } finally { setIsSubmitting(false); }
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
    const cents = Math.round(discountedTotal * 100);
    createPaymentIntent(cents);
    setShowStripeForm(true);
  };

  const handlePaymentNext = () => {
    if (!paymentConfirmed) {
      toast({ title: "Please complete your payment before continuing", variant: "destructive" });
      return;
    }
    setStep("agreement");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Final booking submission ──────────────────────────────────────────────
  const handleFinalSubmit = async () => {
    if (!sigHasContent) {
      toast({ title: "Please draw your signature to proceed", variant: "destructive" }); return;
    }
    if (!agreeChecked) {
      toast({ title: "Please accept the rental terms", variant: "destructive" }); return;
    }
    // Validate all renter-fill fields are completed
    if (agreementText) {
      const unfilledKeys = Array.from(agreementText.matchAll(/{{([^}]+)}}/g))
        .map(m => m[1].trim())
        .filter(k => !(k in autoFillMap) && !customFieldValues[k]);
      if (unfilledKeys.length > 0) {
        toast({ title: "Please complete all required fields", description: "Fill in the highlighted fields in the agreement above.", variant: "destructive" });
        return;
      }
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
          quantity: 1,
          notes: notes || undefined,
          source: isKiosk ? "kiosk" : "online",
          addons: selectedAddons,
          agreementSignerName: name.trim(),
          agreementText: agreementText ? resolveAgreementText(agreementText) : undefined,
          agreementSignatureDataUrl: signatureDataUrl,
          stripePaymentIntentId: paymentIntentId || undefined,
          appliedPromoCode: appliedPromo?.code || undefined,
          discountAmount: promoDiscount > 0 ? promoDiscount : undefined,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConfirmedBooking({ id: data.id, totalPrice: data.totalPrice });

      // Track promo code usage
      if (appliedPromo?.code && slug) {
        fetch(`${BASE}/api/promo-codes/use`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: appliedPromo.code, tenantSlug: slug }),
        }).catch(() => {});
      }

      // Kiosk: skip Stripe Identity — go straight to confirmation
      if (isKiosk) {
        setStep("confirmation");
        window.scrollTo(0, 0);
      } else {
        setStep("verification");
        fetchIdentitySession(session?.id ?? undefined);
        window.scrollTo(0, 0);
      }
    } catch {
      toast({ title: "Booking failed", description: "Please try again.", variant: "destructive" });
    } finally { setIsSubmitting(false); }
  };

  // ── Stripe Identity verification launcher ─────────────────────────────────
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

      // Modal closed successfully — check status from backend
      if (identitySessionId) {
        const statusRes = await fetch(`${BASE}/api/stripe/identity/status/${identitySessionId}?tenantSlug=${encodeURIComponent(slug ?? "")}`);
        const statusData = await statusRes.json();
        if (statusData.verified) {
          setIdentityStatus("verified");
          sessionStorage.removeItem(`identity_session_${listingId}`);
          setTimeout(() => { setStep("confirmation"); window.scrollTo(0, 0); }, 1200);
        } else {
          setIdentityStatus("failed");
          setIdentityError("Identity could not be verified. Please try again or contact support.");
        }
      } else {
        // No session ID — treat modal close as verified (test mode fallback)
        setIdentityStatus("verified");
        sessionStorage.removeItem(`identity_session_${listingId}`);
        setTimeout(() => { setStep("confirmation"); window.scrollTo(0, 0); }, 1200);
      }
    } catch {
      setIdentityStatus("failed");
      setIdentityError("Verification failed. Please try again.");
    }
  };

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Progress bar */}
      <div className="sticky top-16 z-10 bg-background border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center gap-0">
            {STEPS.filter(s => s !== "confirmation").map((s, i) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`flex items-center gap-1.5 text-xs font-semibold transition-colors
                  ${stepIndex > i ? "text-primary" : stepIndex === i ? "text-foreground" : "text-muted-foreground"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors
                    ${stepIndex > i ? "bg-primary text-primary-foreground" 
                    : stepIndex === i ? "bg-foreground text-background" 
                    : "bg-muted text-muted-foreground"}`}>
                    {stepIndex > i ? "✓" : i + 1}
                  </div>
                  <span className="hidden sm:inline">{STEP_LABELS[s]}</span>
                </div>
                {i < STEPS.filter(s => s !== "confirmation").length - 1 && <div className={`flex-1 h-0.5 mx-2 rounded transition-colors ${stepIndex > i ? "bg-primary" : "bg-muted"}`} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {step !== "verification" && (
          <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent text-muted-foreground" onClick={() => {
            if (step === "dates") { window.history.back(); }
            else { setStep(STEPS[stepIndex - 1]); window.scrollTo({ top: 0, behavior: "smooth" }); }
          }}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {step === "dates" ? "Back to listing" : "Back"}
          </Button>
        )}

        <div className={`grid grid-cols-1 gap-8 ${step !== "confirmation" ? "lg:grid-cols-5" : ""}`}>
          {/* Main content */}
          <div className={step !== "confirmation" ? "order-2 lg:order-1 lg:col-span-3" : ""}>

            {/* ── STEP 1: DATES & INFO ── */}
            {step === "dates" && (
              <div className="space-y-8">
                <h1 className="text-2xl font-bold">Select Your Dates</h1>

                {/* Calendar */}
                <div className="bg-background rounded-2xl border shadow-sm p-3 sm:p-5">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    disabled={{ before: new Date() }}
                    defaultMonth={dateRange?.from}
                    numberOfMonths={1}
                    className="[--cell-size:2.25rem] sm:[--cell-size:3rem] w-full"
                    classNames={{ root: "w-full" }}
                  />
                </div>

                {dateRange?.from && dateRange?.to && (
                  <div className="grid grid-cols-2 gap-3">
                    {/* Pickup */}
                    <div className="bg-background rounded-xl border p-4">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1.5">Pickup</p>
                      <p className="font-bold text-base mb-3">{format(dateRange.from, "EEE, MMM d")}</p>
                      <div className="relative">
                        <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none z-10" />
                        <Select value={pickupTime} onValueChange={setPickupTime}>
                          <SelectTrigger className="pl-8 h-8 text-xs font-medium">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map(t => (
                              <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {/* Return */}
                    <div className="bg-background rounded-xl border p-4">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1.5">Return</p>
                      <p className="font-bold text-base mb-3">{format(dateRange.to, "EEE, MMM d")}</p>
                      <div className="relative">
                        <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none z-10" />
                        <Select value={dropoffTime} onValueChange={setDropoffTime}>
                          <SelectTrigger className="pl-8 h-8 text-xs font-medium">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map(t => (
                              <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special requests?" rows={2} />
                </div>

                {/* ── PROTECTION PLAN ── */}
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
                            {/* Header bar — OutdoorShare brand */}
                            <div className="px-5 py-3 flex items-center justify-between" style={{ background: "#1a2332" }}>
                              <div className="flex items-center gap-2.5">
                                <ShieldCheck className="w-5 h-5" style={{ color: "#3ab549" }} />
                                <div className="flex flex-col leading-tight">
                                  <span className="font-black text-white text-sm tracking-wide">Protection Plan</span>
                                  <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#3ab549" }}>by OutdoorShare</span>
                                </div>
                              </div>
                              <span className="text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border" style={{ background: "rgba(58,181,73,0.15)", borderColor: "#3ab549", color: "#3ab549" }}>
                                <Lock className="w-3 h-3" /> Required
                              </span>
                            </div>

                            {/* Body */}
                            <div className="p-5" style={{ background: "#f0faf1" }}>
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <p className="text-sm text-gray-700 mb-3">
                                    All rentals include our Damage Protection Plan. It covers you against unexpected accidents, weather events, and disasters — so you can enjoy your adventure worry-free.
                                  </p>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                    {[
                                      { icon: AlertTriangle, text: "Accident & collision damage" },
                                      { icon: Umbrella, text: "Weather & water damage" },
                                      { icon: Zap, text: "Mechanical breakdown" },
                                      { icon: ShieldCheck, text: "Disaster & fire coverage" },
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
                                  <p className="text-xs text-gray-500">flat fee</p>
                                  <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 font-bold text-sm text-white cursor-default" style={{ background: "#3ab549" }}>
                                    <CheckCircle2 className="w-4 h-4" /> Included
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* ── REGULAR ADD-ONS ── */}
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

                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Your Information</h2>
                </div>

                {/* ── Login / Account status banner ── */}
                {isKiosk ? (
                  <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3">
                    <Monitor className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                      <span className="font-semibold">Kiosk booking</span> — No account needed. After booking, we'll email you a link to create your account and view your rental details.
                    </p>
                  </div>
                ) : !session ? (
                  showLoginPanel ? (
                    /* Expanded login form */
                    <div className="bg-background border-2 border-primary/20 rounded-2xl p-5 space-y-4 shadow-sm">
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
                    /* Collapsed "returning customer" prompt */
                    <button
                      onClick={() => { setShowLoginPanel(true); setAuthError(""); }}
                      className="w-full flex items-center gap-3 bg-muted/50 hover:bg-muted border border-border hover:border-primary/40 rounded-xl px-4 py-3 transition-all group text-left"
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
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">Signed in as {session.name}</p>
                      <p className="text-xs text-muted-foreground">{session.email}</p>
                    </div>
                    <button onClick={() => { localStorage.removeItem("rental_customer"); setSession(null); setName(""); setEmail(""); setPhone(""); }} className="ml-auto text-xs text-muted-foreground hover:text-foreground underline">Log out</button>
                  </div>
                )}

                {/* Personal info fields */}
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

                {/* New-customer account creation (only when not logged in and not kiosk) */}
                {!isKiosk && !session && !showLoginPanel && (
                  <div className="bg-muted/40 rounded-2xl p-5 space-y-3 border">
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
                    <p className="text-xs text-muted-foreground">
                      Saves your info and payment details for future bookings.
                    </p>
                  </div>
                )}

                <Button size="lg" className="w-full h-13 text-base font-bold rounded-xl" onClick={handleDatesNext} disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Continue to Payment"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {/* ── STEP 2: PAYMENT ── */}
            {step === "payment" && (
              <div className="space-y-6">
                <h1 className="text-2xl font-bold">Payment</h1>

                {/* ── Kiosk: pay mode toggle (card vs QR) ── */}
                {isKiosk && !paymentConfirmed && (
                  <div className="bg-background rounded-2xl border shadow-sm p-1.5 flex gap-1">
                    <button
                      onClick={() => { setKioskPayMode("card"); setQrPolling(false); }}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                        kioskPayMode === "card"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
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
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                        kioskPayMode === "qr"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Smartphone className="w-4 h-4" />
                      Scan to Pay on Phone
                    </button>
                  </div>
                )}

                {/* ── Kiosk QR payment panel ── */}
                {isKiosk && kioskPayMode === "qr" && (
                  <div className="bg-background rounded-2xl border shadow-sm p-6 space-y-5">
                    {paymentConfirmed ? (
                      /* ── SUCCESS STATE ── */
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
                        <div className="text-4xl font-black tabular-nums text-green-900">
                          ${discountedTotal.toFixed(2)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-green-700">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Advancing to agreement…
                        </div>
                      </div>
                    ) : (
                      /* ── QR SCAN STATE ── */
                      <>
                        <div className="text-center space-y-1">
                          <h2 className="font-bold text-lg">Scan with your phone to pay</h2>
                          <p className="text-sm text-muted-foreground">
                            Open your camera app and point it at the QR code.
                          </p>
                          {/* Wallet badges */}
                          <div className="flex items-center justify-center gap-2 pt-1">
                            <span className="inline-flex items-center gap-1 bg-black text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white" aria-hidden="true"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z"/></svg>
                              Apple Pay
                            </span>
                            <span className="inline-flex items-center gap-1 bg-white border border-border text-foreground text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
                              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="none"/><path d="M6.24 10.34l1.41-1.41 4.24 4.24-1.41 1.41z" fill="#4285F4"/><path d="M9.07 7.5h1.5v9h-1.5z" fill="#EA4335"/><path d="M13.43 7.5h1.5v9h-1.5z" fill="#FBBC05"/><path d="M11.25 4.5l1.06 1.06-4.24 4.24-1.06-1.06z" fill="#34A853"/></svg>
                              Google Pay
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              + Card
                            </span>
                          </div>
                        </div>

                        {qrLoading ? (
                          <div className="flex flex-col items-center gap-3 py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Generating secure payment link…</p>
                          </div>
                        ) : qrUrl ? (
                          <>
                            {/* QR Code */}
                            <div className="flex justify-center">
                              <div className="bg-white rounded-2xl p-4 shadow-sm border border-border inline-block">
                                <QRCodeSVG value={qrUrl} size={220} level="M" includeMargin={false} />
                              </div>
                            </div>

                            {/* Amount */}
                            <div className="text-center">
                              <div className="text-3xl font-black tabular-nums">${discountedTotal.toFixed(2)}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">Total due</div>
                            </div>

                            {/* Polling indicator */}
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

                            {/* Refresh button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full text-muted-foreground"
                              onClick={() => { setQrSessionId(null); setQrUrl(null); setQrPolling(false); createQrSession(); }}
                            >
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

                {/* Promo Code section — only shown before Stripe form loads, and in card mode */}
                {(!isKiosk || kioskPayMode === "card") && !showStripeForm && !paymentConfirmed && (
                  <div className="bg-background rounded-2xl border shadow-sm p-5 space-y-3">
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
                        <button
                          className="text-xs text-muted-foreground hover:text-destructive underline"
                          onClick={() => { setAppliedPromo(null); setPromoInput(""); setPromoError(null); }}
                        >
                          Remove
                        </button>
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
                        <Button
                          variant="outline"
                          onClick={handleApplyPromo}
                          disabled={!promoInput.trim() || promoLoading}
                          className="shrink-0"
                        >
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

                {/* Stripe card payment flow — hidden in kiosk QR mode */}
                {(!isKiosk || kioskPayMode === "card") && !showStripeForm && !paymentConfirmed ? (
                  <Button size="lg" className="w-full h-13 text-base font-bold rounded-xl" onClick={handleContinueToPayment}>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Continue to Payment
                    {appliedPromo && <span className="ml-1 opacity-80">— ${discountedTotal.toFixed(2)}</span>}
                  </Button>
                ) : showStripeForm && !clientSecret ? (
                  <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Preparing payment…</span>
                  </div>
                ) : paymentConfirmed && (!isKiosk || kioskPayMode === "card") ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-3">
                    <BadgeCheck className="w-6 h-6 text-green-600 shrink-0" />
                    <div>
                      <p className="font-semibold text-green-800">Payment authorized</p>
                      <p className="text-sm text-green-700">{isTestMode ? "Test payment recorded — no real charge." : "Your card has been charged. Continue to sign the agreement."}</p>
                    </div>
                  </div>
                ) : clientSecret ? (
                  <>
                    {isTestMode && (
                      <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
                        <span className="text-amber-600 font-bold text-xs uppercase tracking-wider bg-amber-200 px-2 py-0.5 rounded">Test Mode</span>
                        <span className="text-sm text-amber-800">No real money will be charged. Use card <strong>4242 4242 4242 4242</strong>, any future expiry and CVC.</span>
                      </div>
                    )}
                    <Elements stripe={isTestMode ? testStripePromise : liveStripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
                      <StripePaymentForm
                        onSuccess={() => setPaymentConfirmed(true)}
                        customerEmail={email}
                      />
                    </Elements>
                  </>
                ) : null}

                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Payments are processed securely by Stripe. Your card details are never stored on our servers.
                </p>

                {paymentConfirmed && (!isKiosk || kioskPayMode === "card") && (
                  <Button size="lg" className="w-full h-13 text-base font-bold rounded-xl" onClick={handlePaymentNext}>
                    Continue to Agreement
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            )}

            {/* ── STEP 3: RENTAL AGREEMENT ── */}
            {step === "agreement" && (
              <div className="space-y-6">
                <h1 className="text-2xl font-bold">Rental Agreement</h1>

                <div className="bg-background rounded-2xl border shadow-sm p-6 space-y-4 max-h-96 overflow-y-auto text-sm text-muted-foreground leading-relaxed">
                  <h2 className="text-base font-bold text-foreground">Vehicle Rental Agreement</h2>
                  <p><strong className="text-foreground">Rental Period:</strong> {startFormattedWithTime} — {endFormattedWithTime} ({days} day{days > 1 ? "s" : ""})</p>
                  <p><strong className="text-foreground">Vehicle:</strong> {listing.title}</p>
                  <p><strong className="text-foreground">Renter:</strong> {name} ({email})</p>
                  <Separator />
                  {agreementText
                    ? agreementText.split("\n\n").filter(Boolean).map((para, i) =>
                        renderAgreementParagraph(para, i)
                      )
                    : <p className="text-muted-foreground italic">Loading agreement…</p>
                  }
                  {/* Notice if there are renter-fill fields outstanding */}
                  {agreementText && (() => {
                    const unfilled = Array.from(agreementText.matchAll(/{{([^}]+)}}/g))
                      .map(m => m[1].trim())
                      .filter(k => !(k in autoFillMap) && !customFieldValues[k]);
                    return unfilled.length > 0 ? (
                      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                        <span className="text-amber-500 text-xs mt-0.5">⚠️</span>
                        <p className="text-xs text-amber-700">
                          Please fill in the highlighted field{unfilled.length > 1 ? "s" : ""} above before signing.
                        </p>
                      </div>
                    ) : null;
                  })()}
                  <p className="text-xs italic">By signing below, you confirm you have read, understood, and agree to all terms in this rental agreement.</p>
                </div>

                <div className="bg-background rounded-2xl border shadow-sm p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold">Sign the Agreement</h3>
                    </div>
                    {sigHasContent && (
                      <button
                        type="button"
                        onClick={clearSig}
                        className="text-xs text-muted-foreground hover:text-destructive underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Draw your signature below using your mouse or finger
                  </p>

                  {/* Signature canvas */}
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
                    {/* Bottom border line simulating a signature line */}
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
                  disabled={isSubmitting || !agreeChecked || !sigHasContent}
                >
                  {isSubmitting ? "Submitting…" : "Sign & Continue to ID Verification"}
                  <ScanFace className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {/* ── STEP 4: IDENTITY VERIFICATION ── */}
            {step === "verification" && (
              <div className="space-y-6">
                <h1 className="text-2xl font-bold">Identity Verification</h1>

                {isTestMode && (
                  <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-amber-800">Test Mode — </span>
                      <span className="text-amber-700">No real documents are collected. Use Stripe's test flow to simulate the full verification experience.</span>
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
                      <p className="text-green-700 text-sm mt-1">Taking you to your confirmation…</p>
                    </div>
                    <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                  </div>
                ) : (
                  <>
                    {/* Explanation card */}
                    <div className="bg-background rounded-2xl border shadow-sm p-6 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <ScanFace className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h2 className="font-semibold">Verify your identity to complete your booking</h2>
                          <p className="text-sm text-muted-foreground">Required by law for all rentals</p>
                        </div>
                      </div>
                      <Separator />
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        To protect our equipment and comply with rental regulations, we require all renters to verify their identity before pickup. This is handled securely by Stripe — we never see or store your document images.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        {[
                          { icon: CreditCard, label: "Government-issued photo ID", sub: "Passport, driver's license, or national ID" },
                          { icon: ScanFace, label: "Live selfie", sub: "A quick selfie to match your ID" },
                          { icon: ShieldCheck, label: "Encrypted & secure", sub: "Stripe-verified, never stored by us" },
                        ].map(({ icon: Icon, label, sub }) => (
                          <div key={label} className="flex flex-col gap-1 bg-muted/40 rounded-xl p-4">
                            <Icon className="w-5 h-5 text-primary mb-1" />
                            <p className="text-xs font-semibold leading-snug">{label}</p>
                            <p className="text-xs text-muted-foreground">{sub}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Error state */}
                    {identityStatus === "failed" && identityError && (
                      <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-sm text-destructive">
                        <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-semibold">Verification not completed</p>
                          <p className="mt-0.5 text-destructive/80">{identityError}</p>
                        </div>
                      </div>
                    )}

                    {/* Loading state while Stripe modal is open */}
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
                            <p className="text-amber-700 mt-0.5">There was a problem connecting to our verification service. Please try again.</p>
                          </div>
                        </div>
                        <Button
                          size="lg"
                          variant="outline"
                          className="w-full h-13 text-base font-bold rounded-xl gap-2"
                          onClick={() => fetchIdentitySession(session?.id ?? undefined)}
                        >
                          <RefreshCw className="w-4 h-4" />
                          Retry
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="lg"
                        className="w-full h-13 text-base font-bold rounded-xl gap-2"
                        onClick={handleStartVerification}
                        disabled={!identityClientSecret}
                      >
                        {identityStatus === "failed" ? (
                          <><RefreshCw className="w-4 h-4" />Try Again</>
                        ) : (
                          <><ScanFace className="w-4 h-4" />Start Identity Verification</>
                        )}
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── CONFIRMATION ── */}
            {step === "confirmation" && (
              <div className="space-y-8">
                {/* Success banner */}
                <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex items-center gap-5">
                  <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-green-900">Booking Requested!</h1>
                    {confirmedBooking && <p className="text-green-700 text-sm mt-0.5">Reference #{confirmedBooking.id} · {listing.title}</p>}
                    {isKiosk ? (
                      <p className="text-green-700/80 text-sm mt-1">
                        A confirmation has been sent to <strong>{email}</strong> with a link to create your account and view your booking anytime.
                      </p>
                    ) : (
                      <p className="text-green-700/80 text-sm mt-1">
                        We'll review and email a confirmation to <strong>{email}</strong>. Bring a valid ID on {startFormatted}.
                      </p>
                    )}
                  </div>
                </div>

                {/* Profile + bookings split */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Profile card */}
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
                      {session?.billingAddress && (
                        <div className="text-sm">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Billing Address</p>
                          <p>{session.billingAddress}</p>
                          <p>{session.billingCity}, {session.billingState} {session.billingZip}</p>
                        </div>
                      )}
                      {session?.cardLastFour && (
                        <div className="text-sm">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Payment Method</p>
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-muted-foreground" />
                            <span>{session.cardBrand} •••• {session.cardLastFour}</span>
                          </div>
                        </div>
                      )}
                      <Separator />
                      <Button variant="outline" size="sm" className="w-full" onClick={() => setLocation(sfBase || "/")}>
                        Browse More Listings
                      </Button>
                    </div>
                  </div>

                  {/* Bookings list */}
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
                                <p className="text-xs text-muted-foreground">
                                  {b.startDate} → {b.endDate}
                                </p>
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-1"
                          onClick={() => setLocation(`${sfBase}/my-bookings`)}
                        >
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

          {/* ── SIDEBAR SUMMARY ── */}
          {step !== "confirmation" && (
            <div className="order-1 lg:order-2 lg:col-span-2">
              <div className="sticky top-32 space-y-4">

                {/* Price breakdown — always at the top */}
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
                        <span>${listing.pricePerDay}/day × {days} day{days > 1 ? "s" : ""}</span>
                        <span>${subtotal.toFixed(2)}</span>
                      </div>
                      {availableAddons.filter(a => selectedAddonIds.has(a.id)).map(a => (
                        <div key={a.id} className="flex justify-between text-muted-foreground">
                          <span className="truncate mr-2">{a.name}</span>
                          <span>+${(a.priceType === "per_day" ? a.price * days : a.price).toFixed(2)}</span>
                        </div>
                      ))}
                      {deposit > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Refundable deposit</span>
                          <span>${deposit.toFixed(2)}</span>
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
                        <span>Total due</span>
                        <span className={appliedPromo ? "text-green-700" : ""}>${discountedTotal.toFixed(2)}</span>
                      </div>
                      {appliedPromo && (
                        <div className="flex justify-between text-xs text-muted-foreground line-through">
                          <span>Original price</span>
                          <span>${total.toFixed(2)}</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Lock className="w-3 h-3" /> No charge until confirmed
                      </p>
                    </div>
                  </div>
                )}

                {/* Listing photo + name — below the breakdown */}
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
