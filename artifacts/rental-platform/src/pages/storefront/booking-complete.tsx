import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { fetchWithRetry } from "@/lib/booking-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle, AlertCircle, Loader2, ChevronRight, PenLine,
  RotateCcw, ShieldCheck, Calendar, Bike, FileText, Download,
  Plus, X, Users, Baby, ChevronDown, ExternalLink,
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getParam(key: string): string {
  return new URLSearchParams(window.location.search).get(key) ?? "";
}

type Phase = "verify" | "loading" | "payment_processing" | "agreement" | "identity" | "confirmed" | "error";

interface BookingData {
  id: number;
  listingTitle: string;
  customerName: string;
  customerEmail: string;
  startDate: string;
  endDate: string;
  totalPrice: string | number;
  status: string;
  agreementSignedAt: string | null;
  requireIdentityVerification: boolean;
  tenantSlug?: string;
  listingId?: number;
}

interface RuleItem   { id: number; title: string; description: string; fee: number; }
interface PlatformAgreement { id: number; title: string; checkboxLabel: string; isRequired: boolean; version: number; }
interface OperatorContract  {
  id: number;
  title: string;
  checkboxLabel: string;
  version: number;
  contractType: "template" | "uploaded_pdf";
  content: string | null;
  hasPdf: boolean;
  uploadedFileName: string | null;
}

interface AgreementsData {
  rules: RuleItem[];
  platformAgreements: PlatformAgreement[];
  operatorContract: OperatorContract | null;
  alreadySigned: boolean;
}

const liveStripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "");
const testStripePromise = loadStripe(import.meta.env.VITE_STRIPE_TEST_PUBLISHABLE_KEY ?? "");

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "";

export default function BookingComplete() {
  const params  = useParams<{ slug: string }>();
  const slug    = params.slug;
  const [, navigate] = useLocation();

  const bookingId = getParam("booking_id");

  const [phase, setPhase]     = useState<Phase>("verify");
  const [email, setEmail]     = useState("");
  const [emailError, setEmailError] = useState("");
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [error, setError]     = useState("");

  // Agreement v2 state
  const [agreementsData, setAgreementsData]     = useState<AgreementsData | null>(null);
  const [agreementsLoading, setAgreementsLoading] = useState(false);
  const [signerName, setSignerName]             = useState("");
  const [additionalRiders, setAdditionalRiders] = useState<string[]>([]);
  const [riderInput, setRiderInput]             = useState("");
  const [minors, setMinors]                     = useState<string[]>([]);
  const [minorInput, setMinorInput]             = useState("");
  const [checkboxStates, setCheckboxStates]     = useState<Record<string, boolean>>({});
  const [isSigning, setIsSigning]               = useState(false);
  const [hasSignature, setHasSignature]         = useState(false);
  const [contractExpanded, setContractExpanded] = useState(false);
  const sigCanvasRef  = useRef<HTMLCanvasElement>(null);
  const sigIsDrawingRef = useRef(false);

  // Identity state
  const [identityLoading, setIdentityLoading] = useState(false);
  const [identityError, setIdentityError]     = useState("");

  useEffect(() => {
    if (!bookingId) navigate(`/${slug}`);
  }, [bookingId, slug]);

  // ── Signature canvas helpers ──────────────────────────────────────────────
  const getSigPos = useCallback((e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }, []);

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    sigIsDrawingRef.current = true;
    const pos = getSigPos(e.nativeEvent as any, canvas);
    const ctx = canvas.getContext("2d");
    if (ctx) { ctx.beginPath(); ctx.moveTo(pos.x, pos.y); }
  }, [getSigPos]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!sigIsDrawingRef.current) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getSigPos(e.nativeEvent as any, canvas);
    ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.strokeStyle = "#1e293b";
    ctx.lineTo(pos.x, pos.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
    setHasSignature(true);
  }, [getSigPos]);

  const endDraw = useCallback(() => { sigIsDrawingRef.current = false; }, []);

  const clearSig = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // ── Check if all required checkboxes are checked ──────────────────────────
  const allRequiredChecked = (): boolean => {
    if (!agreementsData) return false;
    for (const rule of agreementsData.rules) {
      if (!checkboxStates[`rule-${rule.id}`]) return false;
    }
    for (const pa of agreementsData.platformAgreements) {
      if (pa.isRequired && !checkboxStates[`platform-${pa.id}`]) return false;
    }
    if (agreementsData.operatorContract && !checkboxStates["operator"]) return false;
    return true;
  };

  // ── Poll for webhook confirmation (Rule 4) ────────────────────────────────
  // After Stripe payment, the webhook may take a few seconds to fire and update
  // the booking status from `pending_payment` → `confirmed`. This function polls
  // the server until confirmation arrives or a 30-second timeout elapses.
  const proceedWithBooking = async (data: BookingData, verifiedEmail: string) => {
    setBooking(data);
    setSignerName(data.customerName ?? "");
    if (data.agreementSignedAt) {
      setPhase(data.requireIdentityVerification ? "identity" : "confirmed");
    } else {
      setAgreementsLoading(true);
      try {
        const ar = await fetch(`${BASE}/api/bookings/${bookingId}/agreements-for-signing?customerEmail=${encodeURIComponent(verifiedEmail)}`);
        const ad = await ar.json();
        if (ar.ok) { setAgreementsData(ad); }
      } catch { /* proceed with empty agreements */ }
      setAgreementsLoading(false);
      setPhase("agreement");
    }
  };

  const pollForPaymentConfirmation = async (verifiedEmail: string) => {
    setPhase("payment_processing");
    const MAX_ATTEMPTS = 15;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const res = await fetch(`${BASE}/api/bookings/${bookingId}?customerEmail=${encodeURIComponent(verifiedEmail)}`);
        if (!res.ok) continue;
        const data: BookingData = await res.json();
        if (data.status === "confirmed" || data.status === "active" || data.status === "completed") {
          await proceedWithBooking(data, verifiedEmail);
          return;
        }
        if (data.status === "payment_failed") {
          setPhase("error");
          setError("Your payment could not be processed. Please go back and try again.");
          return;
        }
        if (data.status === "cancelled" || data.status === "refunded") {
          setPhase("error");
          setError("This booking has been cancelled. Please contact support if you believe this is an error.");
          return;
        }
      } catch { /* keep polling */ }
    }
    // Timeout — webhook likely delayed or Stripe is slow
    setPhase("error");
    setError("Your payment is being processed — this is taking longer than expected. You'll receive a confirmation email shortly. If you don't, please contact support.");
  };

  // ── Verify email & load booking ───────────────────────────────────────────
  const handleVerifyEmail = async () => {
    setEmailError("");
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address."); return;
    }
    setPhase("loading");
    try {
      // fetchWithRetry handles 5xx / network failures with 3 attempts and back-off.
      // 403 (wrong email) and 404 (not found) are thrown immediately as BookingFetchError.
      let res: Response;
      try {
        res = await fetchWithRetry(
          `${BASE}/api/bookings/${bookingId}?customerEmail=${encodeURIComponent(email.trim())}`,
          undefined,
          3,
        );
      } catch (fetchErr: any) {
        if (fetchErr?.code === "ACCESS_DENIED") {
          setPhase("verify");
          setEmailError("That email doesn't match this booking. Please check and try again.");
          return;
        }
        if (fetchErr?.code === "NOT_FOUND") {
          setPhase("error");
          setError("Booking not found. The link may be outdated or the booking may have been removed.");
          return;
        }
        // Transient — exhausted retries
        setPhase("error");
        setError("Connection error after multiple attempts. Please check your connection and try again.");
        return;
      }

      const data = await res.json();

      // Rule 4: Booking confirmation must be based on server/webhook truth.
      // If the booking is still in `pending_payment`, the Stripe webhook has not
      // yet fired. Poll the server until the status becomes `confirmed`.
      if (data.status === "pending_payment") {
        await pollForPaymentConfirmation(email.trim());
        return;
      }
      if (data.status === "payment_failed") {
        setPhase("error");
        setError("Your payment could not be processed. Please go back and try again, or contact support.");
        return;
      }
      if (data.status === "cancelled" || data.status === "refunded") {
        setPhase("error");
        setError("This booking is no longer active. Please contact support.");
        return;
      }

      await proceedWithBooking(data, email.trim());
    } catch {
      setPhase("error");
      setError("Something went wrong loading your booking. Please try again.");
    }
  };

  // ── Add / remove riders and minors ────────────────────────────────────────
  const addRider = () => {
    const name = riderInput.trim();
    if (!name) return;
    setAdditionalRiders(prev => [...prev, name]);
    setRiderInput("");
  };
  const removeRider = (i: number) => setAdditionalRiders(prev => prev.filter((_, idx) => idx !== i));

  const addMinor = () => {
    const name = minorInput.trim();
    if (!name) return;
    setMinors(prev => [...prev, name]);
    setMinorInput("");
  };
  const removeMinor = (i: number) => setMinors(prev => prev.filter((_, idx) => idx !== i));

  // ── Toggle a checkbox ─────────────────────────────────────────────────────
  const toggleCheck = (key: string) => {
    setCheckboxStates(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Sign agreement ────────────────────────────────────────────────────────
  const handleSignAgreement = async () => {
    if (!hasSignature || !signerName.trim()) return;
    setIsSigning(true);
    try {
      const canvas = sigCanvasRef.current;
      const signatureDataUrl = canvas?.toDataURL("image/png") ?? "";

      const acceptances = [
        ...(agreementsData?.rules ?? []).map(r => ({
          type: "rule" as const,
          id: r.id,
          title: r.title,
          checkboxLabel: r.title,
          accepted: !!checkboxStates[`rule-${r.id}`],
        })),
        ...(agreementsData?.platformAgreements ?? []).map(a => ({
          type: "platform" as const,
          id: a.id,
          version: a.version,
          checkboxLabel: a.checkboxLabel,
          accepted: !!checkboxStates[`platform-${a.id}`],
        })),
        ...(agreementsData?.operatorContract
          ? [{
              type: "operator" as const,
              id: agreementsData.operatorContract.id,
              version: agreementsData.operatorContract.version,
              checkboxLabel: agreementsData.operatorContract.checkboxLabel,
              accepted: !!checkboxStates["operator"],
            }]
          : []),
      ];

      const res = await fetch(`${BASE}/api/bookings/${bookingId}/sign-agreement-public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail: email.trim(),
          signerName: signerName.trim(),
          signatureDataUrl,
          additionalRiders: additionalRiders.filter(Boolean),
          minors: minors.filter(Boolean),
          acceptances,
        }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Failed to sign. Please try again."); return; }
      setPhase(booking?.requireIdentityVerification ? "identity" : "confirmed");
    } catch {
      alert("Connection error. Please try again.");
    } finally {
      setIsSigning(false);
    }
  };

  // ── Identity verification ─────────────────────────────────────────────────
  const handleStartIdentityVerification = async () => {
    if (!booking) return;
    setIdentityLoading(true); setIdentityError("");
    try {
      const res = await fetch(`${BASE}/api/stripe/identity/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: Number(bookingId), listingId: booking.listingId, tenantSlug: slug }),
      });
      const data = await res.json();
      if (!res.ok || !data.clientSecret) { setIdentityError(data.error || "Failed to start identity verification."); setIdentityLoading(false); return; }
      const stripePromise = data.testMode ? testStripePromise : liveStripePromise;
      const stripe = await stripePromise;
      if (!stripe) { setIdentityError("Failed to load payment processor."); setIdentityLoading(false); return; }
      const { error: stripeErr } = await (stripe as any).verifyIdentity(data.clientSecret);
      if (stripeErr) { setIdentityError(stripeErr.message || "Verification failed."); setIdentityLoading(false); return; }
      const statusRes  = await fetch(`${BASE}/api/stripe/identity/status/${data.sessionId}?tenantSlug=${encodeURIComponent(slug ?? "")}`);
      const statusData = await statusRes.json();
      if (statusData.verified) { setPhase("confirmed"); }
      else { setIdentityError("Verification could not be confirmed. Please try again or contact support."); }
    } catch { setIdentityError("Identity verification failed. Please try again."); }
    finally { setIdentityLoading(false); }
  };

  const skipIdentity = () => setPhase("confirmed");

  const fmt = (d: string) => {
    try { return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); }
    catch { return d; }
  };

  const hasAnyAgreements = (agreementsData?.rules?.length ?? 0) > 0
    || (agreementsData?.platformAgreements?.length ?? 0) > 0
    || !!agreementsData?.operatorContract;

  const canSubmit = hasSignature && signerName.trim().length > 0 && allRequiredChecked();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-start px-4 py-10">
      <div className="w-full max-w-lg space-y-6">

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4" style={{ backgroundColor: "#3ab549" }}>
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            {phase === "confirmed" ? "You're all set!" : "Complete your booking"}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {phase === "verify"              && "Enter your email to continue with your booking."}
            {phase === "loading"             && "Looking up your booking…"}
            {phase === "payment_processing"  && "Confirming your payment — please wait…"}
            {phase === "agreement"           && "Review and sign to finalize your booking."}
            {phase === "identity"            && "One last step — please verify your identity."}
            {phase === "confirmed"           && "Payment received and booking confirmed."}
            {phase === "error"              && "Something went wrong."}
          </p>
        </div>

        {/* Step indicator */}
        {booking && phase !== "verify" && phase !== "loading" && phase !== "payment_processing" && phase !== "error" && (() => {
          const steps  = ["agreement", ...(booking.requireIdentityVerification ? ["identity"] : []), "confirmed"];
          const labels: Record<string, string> = { agreement: "Agreement", identity: "Verify ID", confirmed: "Confirmed" };
          const currentIdx = steps.indexOf(phase);
          return (
            <div className="flex items-center justify-center gap-2">
              {steps.map((key, i) => (
                <div key={key} className="flex items-center gap-2">
                  <div className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                    i === currentIdx ? "bg-primary text-white" :
                    i < currentIdx  ? "bg-primary/20 text-primary" : "bg-slate-200 text-slate-500"
                  }`}>{labels[key]}</div>
                  {i < steps.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Booking summary card */}
        {booking && phase !== "verify" && phase !== "loading" && phase !== "payment_processing" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Bike className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 truncate">{booking.listingTitle}</p>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {fmt(booking.startDate)} – {fmt(booking.endDate)}
                </span>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-slate-800">${parseFloat(String(booking.totalPrice)).toFixed(2)}</p>
                <p className="text-xs text-slate-400">total paid</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Verify email ─────────────────────────────────────────────────── */}
        {phase === "verify" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email" type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleVerifyEmail()}
                placeholder="the email used for your booking"
                autoFocus
              />
              {emailError && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {emailError}
                </p>
              )}
            </div>
            <Button className="w-full" style={{ backgroundColor: "#3ab549" }} onClick={handleVerifyEmail}>
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* ── Loading ──────────────────────────────────────────────────────── */}
        {phase === "loading" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-slate-500">Loading your booking…</p>
          </div>
        )}

        {/* ── Payment processing (polling for webhook confirmation) ─────────── */}
        {phase === "payment_processing" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 flex flex-col items-center gap-4 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <div>
              <p className="font-semibold text-slate-800">Confirming your payment…</p>
              <p className="text-sm text-slate-500 mt-1">
                This usually takes just a few seconds. Please don't close this page.
              </p>
            </div>
          </div>
        )}

        {/* ── Agreement ────────────────────────────────────────────────────── */}
        {phase === "agreement" && booking && (
          <div className="space-y-4">
            {agreementsLoading && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                <p className="text-sm text-slate-500">Fetching your agreements…</p>
              </div>
            )}

            {/* Section 1 — Your Information */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">1</span>
                Your Information
              </h2>

              <div className="space-y-1.5">
                <Label>Full name (signer)</Label>
                <Input
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  placeholder="Full legal name"
                />
              </div>

              {/* Additional Riders */}
              <div className="space-y-2">
                <div>
                  <Label className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    Additional Riders
                    <span className="text-xs font-normal text-slate-400 ml-1">— optional</span>
                  </Label>
                  <p className="text-xs text-slate-400 mt-0.5">Anyone 21 or older who will drive or operate the equipment. By being listed here, each person is agreeing to and bound by the terms of this rental agreement.</p>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={riderInput}
                    onChange={e => setRiderInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addRider()}
                    placeholder="Full name (21 or older)"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addRider} className="shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {additionalRiders.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {additionalRiders.map((name, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs rounded-full px-2.5 py-1">
                        {name}
                        <button onClick={() => removeRider(i)} className="text-slate-400 hover:text-slate-700 ml-0.5">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Minors */}
              <div className="space-y-2">
                <div>
                  <Label className="flex items-center gap-1.5">
                    <Baby className="w-3.5 h-3.5 text-slate-400" />
                    Minors
                    <span className="text-xs font-normal text-slate-400 ml-1">— optional</span>
                  </Label>
                  <p className="text-xs text-slate-400 mt-0.5">Anyone under 21 who will participate in the rental, regardless of experience or licensing. Add one at a time.</p>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={minorInput}
                    onChange={e => setMinorInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addMinor()}
                    placeholder="Name and age, e.g. Emma, 17"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addMinor} className="shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {minors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {minors.map((name, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs rounded-full px-2.5 py-1">
                        {name}
                        <button onClick={() => removeMinor(i)} className="text-slate-400 hover:text-slate-700 ml-0.5">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Section 2 — Rules & Policies */}
            {(agreementsData?.rules?.length ?? 0) > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">2</span>
                  Rental Rules & Policies
                </h2>
                <div className="space-y-3">
                  {agreementsData!.rules.map(rule => (
                    <label
                      key={rule.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        checkboxStates[`rule-${rule.id}`]
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 w-4 h-4 accent-emerald-600 shrink-0 cursor-pointer"
                        checked={!!checkboxStates[`rule-${rule.id}`]}
                        onChange={() => toggleCheck(`rule-${rule.id}`)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{rule.title}</p>
                        {rule.description && (
                          <p className="text-xs text-slate-500 mt-0.5">{rule.description}</p>
                        )}
                        {rule.fee > 0 && (
                          <p className="text-xs text-amber-700 font-medium mt-0.5">
                            Violation fee: ${rule.fee.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Section 3 — Agreements */}
            {hasAnyAgreements && (agreementsData?.platformAgreements?.length ?? 0) + (agreementsData?.operatorContract ? 1 : 0) > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
                    {(agreementsData?.rules?.length ?? 0) > 0 ? "3" : "2"}
                  </span>
                  Agreements & Terms
                </h2>
                <div className="space-y-3">
                  {/* Operator contract */}
                  {agreementsData?.operatorContract && (() => {
                    const oc = agreementsData.operatorContract;
                    const renterPdfUrl = oc.hasPdf
                      ? `${BASE}/api/bookings/${bookingId}/contract-pdf?customerEmail=${encodeURIComponent(email)}`
                      : null;
                    return (
                      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                        {/* Header — title + view link */}
                        <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 border-b border-slate-200">
                          <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                          <span className="text-sm font-semibold text-slate-800 flex-1">{oc.title}</span>
                          {oc.hasPdf && renterPdfUrl && (
                            <a
                              href={renterPdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-2.5 py-1.5 transition-colors shrink-0"
                            >
                              <ExternalLink className="w-3 h-3" /> View PDF
                            </a>
                          )}
                          {!oc.hasPdf && oc.content && (
                            <button
                              type="button"
                              onClick={() => setContractExpanded(v => !v)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors shrink-0"
                            >
                              {contractExpanded ? "Collapse" : "Read contract"}
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${contractExpanded ? "rotate-180" : ""}`} />
                            </button>
                          )}
                        </div>

                        {/* PDF inline preview (only shows when PDF available) */}
                        {oc.hasPdf && renterPdfUrl && (
                          <div className="border-b border-slate-200 bg-slate-100">
                            <iframe
                              src={renterPdfUrl}
                              title={oc.title}
                              className="w-full"
                              style={{ height: 280 }}
                            />
                          </div>
                        )}

                        {/* Template text (expandable) */}
                        {!oc.hasPdf && oc.content && contractExpanded && (
                          <div className="px-4 py-3 max-h-64 overflow-y-auto border-b border-slate-100">
                            <pre
                              className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed"
                              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                            >
                              {oc.content}
                            </pre>
                          </div>
                        )}

                        {/* Checkbox row */}
                        <label
                          className={`flex items-start gap-3 px-3 py-3 cursor-pointer transition-colors ${
                            checkboxStates["operator"] ? "bg-emerald-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 w-4 h-4 accent-emerald-600 shrink-0 cursor-pointer"
                            checked={!!checkboxStates["operator"]}
                            onChange={() => toggleCheck("operator")}
                          />
                          <p className="text-sm text-slate-800 leading-snug">{oc.checkboxLabel}</p>
                        </label>
                      </div>
                    );
                  })()}
                  {/* Platform agreements */}
                  {agreementsData?.platformAgreements.map(pa => (
                    <label
                      key={pa.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        checkboxStates[`platform-${pa.id}`]
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 w-4 h-4 accent-emerald-600 shrink-0 cursor-pointer"
                        checked={!!checkboxStates[`platform-${pa.id}`]}
                        onChange={() => toggleCheck(`platform-${pa.id}`)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 leading-snug">{pa.checkboxLabel}</p>
                        {!pa.isRequired && (
                          <p className="text-xs text-slate-400 mt-0.5">Optional</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Section — Signature */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
                  <PenLine className="w-3 h-3" />
                </span>
                Signature
              </h2>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">Draw your signature in the box below</p>
                  {hasSignature && (
                    <button type="button" onClick={clearSig} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Clear
                    </button>
                  )}
                </div>
                <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden touch-none">
                  <canvas
                    ref={sigCanvasRef}
                    width={600} height={140}
                    className="w-full h-[140px] cursor-crosshair"
                    onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                    onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
                  />
                </div>
                {!hasSignature && (
                  <p className="text-xs text-slate-400 text-center">Sign above to finalize</p>
                )}
              </div>

              <Button
                className="w-full text-white"
                style={{ backgroundColor: "#3ab549" }}
                disabled={!canSubmit || isSigning}
                onClick={handleSignAgreement}
              >
                {isSigning
                  ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Saving…</span>
                  : "Finalize Booking"}
              </Button>

              {!canSubmit && (
                <p className="text-xs text-slate-400 text-center">
                  {!signerName.trim() && "Enter your name above. "}
                  {!allRequiredChecked() && "Check all required boxes. "}
                  {!hasSignature && "Draw your signature above."}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Identity verification ─────────────────────────────────────────── */}
        {phase === "identity" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-7 h-7 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Verify Your Identity</h3>
              <p className="text-sm text-slate-500 mt-1.5">
                This rental requires a quick ID check. You'll be guided through a secure scan of your ID and a selfie. It only takes about a minute.
              </p>
            </div>
            {identityError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {identityError}
              </p>
            )}
            <div className="space-y-2">
              <Button
                className="w-full text-white" style={{ backgroundColor: "#3ab549" }}
                disabled={identityLoading || !stripePublishableKey}
                onClick={handleStartIdentityVerification}
              >
                {identityLoading
                  ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Starting…</span>
                  : "Start Identity Verification"}
              </Button>
              <button type="button" className="w-full text-xs text-slate-400 hover:text-slate-600 py-1" onClick={skipIdentity}>
                Skip for now (you may be contacted by the host)
              </button>
            </div>
          </div>
        )}

        {/* ── Confirmed ────────────────────────────────────────────────────── */}
        {phase === "confirmed" && booking && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Booking Confirmed!</h3>
              <p className="text-slate-500 text-sm mt-1.5">
                You're all set, <strong>{booking.customerName}</strong>! A confirmation email has been sent to <strong>{email || booking.customerEmail}</strong>.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-sm text-slate-600 space-y-1.5">
              <p><span className="font-medium">Booking ID:</span> #{booking.id}</p>
              <p><span className="font-medium">Rental:</span> {booking.listingTitle}</p>
              <p><span className="font-medium">Dates:</span> {fmt(booking.startDate)} – {fmt(booking.endDate)}</p>
              <p><span className="font-medium">Total:</span> ${parseFloat(String(booking.totalPrice)).toFixed(2)}</p>
            </div>
            <p className="text-xs text-slate-400">
              Watch your email for pickup instructions closer to your rental date.
            </p>
            <a
              href={`${BASE}/api/bookings/${booking.id}/agreement-pdf`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Download Signed Agreement PDF
              <Download className="w-3.5 h-3.5 opacity-70" />
            </a>
            <Button variant="outline" className="w-full" onClick={() => navigate(`/${slug}`)}>
              Back to storefront
            </Button>
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {phase === "error" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7 text-red-500" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Unable to load booking</h3>
              <p className="text-slate-500 text-sm mt-1">{error}</p>
            </div>
            <Button variant="outline" onClick={() => { setPhase("verify"); setError(""); }}>Try again</Button>
          </div>
        )}
      </div>
    </div>
  );
}
