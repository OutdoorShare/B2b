import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle, AlertCircle, Loader2, ChevronRight, PenLine,
  RotateCcw, ShieldCheck, Calendar, Bike, FileText, Download
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getParam(key: string): string {
  return new URLSearchParams(window.location.search).get(key) ?? "";
}

type Phase = "verify" | "loading" | "agreement" | "identity" | "confirmed" | "error";

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

// Replace {{variable}} tokens with booking data
function resolveTokens(text: string, booking: BookingData, signerName: string): string {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return text
    .replace(/{{renter_name}}/g, signerName || booking.customerName)
    .replace(/{{customer_name}}/g, booking.customerName)
    .replace(/{{listing_title}}/g, booking.listingTitle)
    .replace(/{{start_date}}/g, booking.startDate)
    .replace(/{{end_date}}/g, booking.endDate)
    .replace(/{{total_price}}/g, `$${parseFloat(String(booking.totalPrice)).toFixed(2)}`)
    .replace(/{{today}}/g, today)
    .replace(/{{date}}/g, today)
    .replace(/{{[^}]+}}/g, "___");
}

const liveStripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "");
const testStripePromise = loadStripe(import.meta.env.VITE_STRIPE_TEST_PUBLISHABLE_KEY ?? "");

export default function BookingComplete() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [, navigate] = useLocation();

  const bookingId = getParam("booking_id");

  const [phase, setPhase] = useState<Phase>("verify");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [error, setError] = useState("");

  // Agreement state
  const [agreementText, setAgreementText] = useState("");
  const [signerName, setSignerName] = useState("");
  const [isSigning, setIsSigning] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigIsDrawingRef = useRef(false);
  const sigLastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Identity state
  const [identityLoading, setIdentityLoading] = useState(false);
  const [identityError, setIdentityError] = useState("");

  // Redirect if no booking_id
  useEffect(() => {
    if (!bookingId) {
      navigate(`/${slug}`);
    }
  }, [bookingId, slug]);

  // Fetch agreement text after booking is loaded
  useEffect(() => {
    if (!booking) return;
    fetch(`${BASE}/api/platform/agreement`)
      .then(r => r.json())
      .then(data => {
        if (data.value) setAgreementText(data.value);
      })
      .catch(() => {});
  }, [booking]);

  // Signature canvas helpers
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
    sigLastPosRef.current = pos;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  }, [getSigPos]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!sigIsDrawingRef.current) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getSigPos(e.nativeEvent as any, canvas);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1e293b";
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    sigLastPosRef.current = pos;
    setHasSignature(true);
  }, [getSigPos]);

  const endDraw = useCallback(() => {
    sigIsDrawingRef.current = false;
    sigLastPosRef.current = null;
  }, []);

  const clearSig = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleVerifyEmail = async () => {
    setEmailError("");
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setPhase("loading");
    try {
      const res = await fetch(`${BASE}/api/bookings/${bookingId}?customerEmail=${encodeURIComponent(email.trim())}`);
      const data = await res.json();
      if (res.status === 403) {
        setPhase("verify");
        setEmailError("That email doesn't match this booking. Please check and try again.");
        return;
      }
      if (!res.ok) {
        setPhase("error");
        setError(data.error || "Booking not found. Please contact support.");
        return;
      }
      setBooking(data);
      setSignerName(data.customerName ?? "");
      if (data.agreementSignedAt) {
        // Agreement already signed — check if identity needed
        if (data.requireIdentityVerification) {
          setPhase("identity");
        } else {
          setPhase("confirmed");
        }
      } else {
        setPhase("agreement");
      }
    } catch {
      setPhase("error");
      setError("Connection error. Please check your connection and try again.");
    }
  };

  const handleSignAgreement = async () => {
    if (!hasSignature) return;
    if (!signerName.trim()) return;
    setIsSigning(true);
    try {
      const canvas = sigCanvasRef.current;
      const signatureDataUrl = canvas?.toDataURL("image/png") ?? "";
      const resolvedText = agreementText ? resolveTokens(agreementText, booking!, signerName) : "";
      const res = await fetch(`${BASE}/api/bookings/${bookingId}/sign-agreement-public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail: email.trim(),
          agreementSignerName: signerName.trim(),
          agreementText: resolvedText,
          agreementSignatureDataUrl: signatureDataUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to sign agreement. Please try again.");
        return;
      }
      if (booking?.requireIdentityVerification) {
        setPhase("identity");
      } else {
        setPhase("confirmed");
      }
    } catch {
      alert("Connection error. Please try again.");
    } finally {
      setIsSigning(false);
    }
  };

  const handleStartIdentityVerification = async () => {
    if (!booking) return;
    setIdentityLoading(true);
    setIdentityError("");
    try {
      const res = await fetch(`${BASE}/api/stripe/identity/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: Number(bookingId), listingId: booking.listingId, tenantSlug: slug }),
      });
      const data = await res.json();
      if (!res.ok || !data.clientSecret) {
        setIdentityError(data.error || "Failed to start identity verification.");
        setIdentityLoading(false);
        return;
      }
      const isTestMode = !!data.testMode;
      const stripePromise = isTestMode ? testStripePromise : liveStripePromise;
      const stripe = await stripePromise;
      if (!stripe) { setIdentityError("Failed to load payment processor."); setIdentityLoading(false); return; }
      const { error } = await (stripe as any).verifyIdentity(data.clientSecret);
      if (error) {
        setIdentityError(error.message || "Verification failed.");
        setIdentityLoading(false);
        return;
      }
      // Check status
      const statusRes = await fetch(`${BASE}/api/stripe/identity/status/${data.sessionId}?tenantSlug=${encodeURIComponent(slug ?? "")}`);
      const statusData = await statusRes.json();
      if (statusData.verified) {
        setPhase("confirmed");
      } else {
        setIdentityError("Verification could not be confirmed. Please try again or contact support.");
      }
    } catch {
      setIdentityError("Identity verification failed. Please try again.");
    } finally {
      setIdentityLoading(false);
    }
  };

  const skipIdentity = () => setPhase("confirmed");

  // Format date
  const fmt = (d: string) => {
    try { return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); }
    catch { return d; }
  };

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
            {phase === "verify" && "Enter your email to continue with your booking."}
            {phase === "loading" && "Looking up your booking…"}
            {phase === "agreement" && "Please review and sign the rental agreement to finalize your booking."}
            {phase === "identity" && "One last step — please verify your identity."}
            {phase === "confirmed" && "Payment received and booking confirmed."}
            {phase === "error" && "Something went wrong."}
          </p>
        </div>

        {/* Step indicator */}
        {booking && phase !== "verify" && phase !== "loading" && phase !== "error" && (() => {
          const steps = [
            "agreement",
            ...(booking.requireIdentityVerification ? ["identity"] : []),
            "confirmed",
          ];
          const labels: Record<string, string> = { agreement: "Agreement", identity: "Verify ID", confirmed: "Confirmed" };
          const currentIdx = steps.indexOf(phase);
          return (
            <div className="flex items-center justify-center gap-2">
              {steps.map((key, i) => (
                <div key={key} className="flex items-center gap-2">
                  <div className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                    i === currentIdx ? "bg-primary text-white" :
                    i < currentIdx ? "bg-primary/20 text-primary" : "bg-slate-200 text-slate-500"
                  }`}>
                    {labels[key]}
                  </div>
                  {i < steps.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Booking summary card */}
        {booking && phase !== "verify" && phase !== "loading" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Bike className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 truncate">{booking.listingTitle}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {fmt(booking.startDate)} – {fmt(booking.endDate)}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-slate-800">${parseFloat(String(booking.totalPrice)).toFixed(2)}</p>
                <p className="text-xs text-slate-400">total paid</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Phase: Verify email ── */}
        {phase === "verify" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
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

        {/* ── Phase: Loading ── */}
        {phase === "loading" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-slate-500">Loading your booking…</p>
          </div>
        )}

        {/* ── Phase: Agreement ── */}
        {phase === "agreement" && booking && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
            <div className="space-y-1.5">
              <Label>Your name (as signer)</Label>
              <Input
                value={signerName}
                onChange={e => setSignerName(e.target.value)}
                placeholder="Full name"
              />
            </div>

            {agreementText && (
              <div className="space-y-1.5">
                <Label>Rental Agreement</Label>
                <div
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 leading-relaxed max-h-52 overflow-y-auto whitespace-pre-wrap font-mono"
                >
                  {resolveTokens(agreementText, booking, signerName)}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <PenLine className="w-4 h-4 text-slate-400" /> Signature
                </Label>
                {hasSignature && (
                  <button
                    type="button"
                    onClick={clearSig}
                    className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden touch-none">
                <canvas
                  ref={sigCanvasRef}
                  width={600}
                  height={140}
                  className="w-full h-[140px] cursor-crosshair"
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                />
              </div>
              {!hasSignature && (
                <p className="text-xs text-slate-400 text-center">Draw your signature above</p>
              )}
            </div>

            <Button
              className="w-full text-white"
              style={{ backgroundColor: "#3ab549" }}
              disabled={!hasSignature || !signerName.trim() || isSigning}
              onClick={handleSignAgreement}
            >
              {isSigning ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Saving…</span>
              ) : "Finalize Booking"}
            </Button>
            <p className="text-xs text-slate-400 text-center">
              By signing, you agree to the rental agreement and terms above.
            </p>
          </div>
        )}

        {/* ── Phase: Identity verification ── */}
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
                className="w-full text-white"
                style={{ backgroundColor: "#3ab549" }}
                disabled={identityLoading || !stripePublishableKey}
                onClick={handleStartIdentityVerification}
              >
                {identityLoading ? (
                  <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Starting…</span>
                ) : "Start Identity Verification"}
              </Button>
              <button
                type="button"
                className="w-full text-xs text-slate-400 hover:text-slate-600 py-1"
                onClick={skipIdentity}
              >
                Skip for now (you may be contacted by the host)
              </button>
            </div>
          </div>
        )}

        {/* ── Phase: Confirmed ── */}
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
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Download Signed Agreement PDF
              <Download className="w-3.5 h-3.5 opacity-70" />
            </a>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate(`/${slug}`)}
            >
              Back to storefront
            </Button>
          </div>
        )}

        {/* ── Phase: Error ── */}
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
