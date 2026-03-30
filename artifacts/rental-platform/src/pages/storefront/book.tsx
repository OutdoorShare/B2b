import { useState, useMemo, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import type { DateRange } from "react-day-picker";
import { 
  useGetListing,
  getGetListingQueryKey
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
  Lock, User, CreditCard, FileText, Eye, EyeOff, ShieldCheck
} from "lucide-react";
import { differenceInDays, format, addDays } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Step = "dates" | "payment" | "agreement" | "confirmation";

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

function getCardBrand(num: string): string {
  const n = num.replace(/\s/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^5[1-5]/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  if (/^6(?:011|5)/.test(n)) return "Discover";
  return "Card";
}

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

const STEP_LABELS: Record<Step, string> = {
  dates: "Dates & Info",
  payment: "Payment",
  agreement: "Agreement",
  confirmation: "Confirmed",
};
const STEPS: Step[] = ["dates", "payment", "agreement", "confirmation"];

export default function StorefrontBook() {
  const { slug } = useParams<{ slug: string }>();
  const sfBase = slug ? `/${slug}` : "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const searchParams = new URLSearchParams(window.location.search);
  const listingIdStr = searchParams.get("listingId");
  const listingId = listingIdStr ? parseInt(listingIdStr) : 0;

  const { data: listing, isLoading } = useGetListing(listingId, {
    query: { enabled: !!listingId, queryKey: getGetListingQueryKey(listingId) }
  });

  const [step, setStep] = useState<Step>("dates");
  const [session, setSession] = useState<CustomerSession | null>(loadSession);

  // Step 1: dates + personal + account
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 3),
  });
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

  // Step 2: payment
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [billingName, setBillingName] = useState(session?.name ?? "");
  const [billingAddress, setBillingAddress] = useState(session?.billingAddress ?? "");
  const [billingCity, setBillingCity] = useState(session?.billingCity ?? "");
  const [billingState, setBillingState] = useState(session?.billingState ?? "");
  const [billingZip, setBillingZip] = useState(session?.billingZip ?? "");

  // Step 3: agreement
  const [agreeSigned, setAgreeSigned] = useState("");
  const [agreeChecked, setAgreeChecked] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<{ id: number; totalPrice: number } | null>(null);
  const [customerBookings, setCustomerBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  // Add-ons
  const [availableAddons, setAvailableAddons] = useState<Addon[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<number>>(new Set());

  // Fetch addons for the listing; auto-select required ones
  useEffect(() => {
    if (!listingId) return;
    fetch(`${BASE}/api/listings/${listingId}/addons`)
      .then(r => r.json())
      .then((data: Addon[]) => {
        if (!Array.isArray(data)) return;
        const active = data.filter(a => a.isActive);
        setAvailableAddons(active);
        // auto-select required addons
        const required = new Set(active.filter(a => a.isRequired).map(a => a.id));
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

  useEffect(() => {
    if (session) {
      setName(session.name);
      setEmail(session.email);
      setPhone(session.phone ?? "");
      setBillingName(session.name);
      setBillingAddress(session.billingAddress ?? "");
      setBillingCity(session.billingCity ?? "");
      setBillingState(session.billingState ?? "");
      setBillingZip(session.billingZip ?? "");
      if (session.cardLastFour) {
        setCardNumber(`•••• •••• •••• ${session.cardLastFour}`);
        setCardExpiry("••/••");
      }
    }
  }, [session]);

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

  const handleDatesNext = async () => {
    setAuthError("");
    if (!dateRange?.from || !dateRange?.to) {
      toast({ title: "Please select pickup and return dates", variant: "destructive" }); return;
    }
    if (!name || !email || !phone) {
      toast({ title: "Please fill in your name, email, and phone", variant: "destructive" }); return;
    }
    // Already logged in — go straight to payment
    if (session) { setStep("payment"); return; }

    // Register new account
    if (password.length < 6) { setAuthError("Password must be at least 6 characters"); return; }
    if (password !== confirmPassword) { setAuthError("Passwords don't match"); return; }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/customers/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, phone })
      });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || "Registration failed"); return; }
      saveSession(data); setSession(data); setStep("payment");
    } catch {
      setAuthError("Connection error, please try again");
    } finally { setIsSubmitting(false); }
  };

  const handlePaymentNext = async () => {
    const isSavedCard = cardNumber.startsWith("••••");
    const rawCard = cardNumber.replace(/\s/g, "");
    if (!isSavedCard && (rawCard.length < 15 || !cardExpiry || cardCvc.length < 3)) {
      toast({ title: "Please complete payment details", variant: "destructive" }); return;
    }
    if (!billingAddress || !billingCity || !billingState || !billingZip) {
      toast({ title: "Please fill in billing address", variant: "destructive" }); return;
    }

    if (session && !isSavedCard) {
      const lastFour = rawCard.slice(-4);
      const brand = getCardBrand(rawCard);
      try {
        const res = await fetch(`${BASE}/api/customers/${session.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ billingAddress, billingCity, billingState, billingZip, cardLastFour: lastFour, cardBrand: brand })
        });
        if (res.ok) {
          const updated = await res.json();
          saveSession(updated); setSession(updated);
        }
      } catch { /* non-critical */ }
    }
    setStep("agreement");
  };

  const handleFinalSubmit = async () => {
    if (!agreeSigned.trim() || agreeSigned.trim().toLowerCase() !== name.trim().toLowerCase()) {
      toast({ title: "Please type your full name to sign the agreement", variant: "destructive" }); return;
    }
    if (!agreeChecked) {
      toast({ title: "Please accept the rental terms", variant: "destructive" }); return;
    }

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
          quantity: 1,
          notes: notes || undefined,
          source: "online",
          addons: selectedAddons,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConfirmedBooking({ id: data.id, totalPrice: data.totalPrice });
      setStep("confirmation");
      window.scrollTo(0, 0);
    } catch {
      toast({ title: "Booking failed", description: "Please try again.", variant: "destructive" });
    } finally { setIsSubmitting(false); }
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
                {i < 2 && <div className={`flex-1 h-0.5 mx-2 rounded transition-colors ${stepIndex > i ? "bg-primary" : "bg-muted"}`} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent text-muted-foreground" onClick={() => step === "dates" ? window.history.back() : setStep(STEPS[stepIndex - 1])}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {step === "dates" ? "Back to listing" : "Back"}
        </Button>

        <div className={`grid grid-cols-1 gap-8 ${step !== "confirmation" ? "lg:grid-cols-5" : ""}`}>
          {/* Main content */}
          <div className={step !== "confirmation" ? "lg:col-span-3" : ""}>

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
                    numberOfMonths={1}
                    className="[--cell-size:2.25rem] sm:[--cell-size:3rem] w-full"
                    classNames={{ root: "w-full" }}
                  />
                </div>

                {dateRange?.from && dateRange?.to && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-background rounded-xl border p-4 text-center">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Pickup</p>
                      <p className="font-bold text-base">{format(dateRange.from, "EEE, MMM d")}</p>
                    </div>
                    <div className="bg-background rounded-xl border p-4 text-center">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Return</p>
                      <p className="font-bold text-base">{format(dateRange.to, "EEE, MMM d")}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special requests?" rows={2} />
                </div>

                {/* ── ADD-ONS ── */}
                {availableAddons.length > 0 && (
                  <div className="bg-background rounded-2xl border shadow-sm p-6 space-y-4">
                    <div>
                      <h2 className="font-bold text-base">Add-ons & Extras</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">Enhance your rental with optional upgrades.</p>
                    </div>
                    <div className="space-y-3">
                      {availableAddons.map(addon => {
                        const selected = selectedAddonIds.has(addon.id);
                        const addonPrice = addon.priceType === "per_day" ? addon.price * days : addon.price;
                        return (
                          <button
                            key={addon.id}
                            type="button"
                            disabled={addon.isRequired}
                            onClick={() => {
                              if (addon.isRequired) return;
                              setSelectedAddonIds(prev => {
                                const next = new Set(prev);
                                if (next.has(addon.id)) next.delete(addon.id);
                                else next.add(addon.id);
                                return next;
                              });
                            }}
                            className={`w-full flex items-start gap-4 border-2 rounded-xl p-4 text-left transition-all
                              ${selected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50 hover:bg-muted/30"
                              }
                              ${addon.isRequired ? "cursor-default" : "cursor-pointer"}
                            `}
                          >
                            <div className={`w-5 h-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors
                              ${selected ? "bg-primary border-primary" : "border-muted-foreground/40"}
                            `}>
                              {selected && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm">{addon.name}</span>
                                {addon.isRequired && (
                                  <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">Required</span>
                                )}
                              </div>
                              {addon.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">{addon.description}</p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-sm text-primary">+${addonPrice.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">
                                {addon.priceType === "per_day" ? `$${addon.price.toFixed(2)}/day` : "flat fee"}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Your Information</h2>
                </div>

                {/* ── Login / Account status banner ── */}
                {!session ? (
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
                              body: JSON.stringify({ email, password })
                            });
                            const data = await res.json();
                            if (!res.ok) { setAuthError(data.error || "Login failed"); return; }
                            saveSession(data); setSession(data);
                            setName(data.name); setPhone(data.phone ?? "");
                            setBillingName(data.name);
                            setBillingAddress(data.billingAddress ?? "");
                            setBillingCity(data.billingCity ?? "");
                            setBillingState(data.billingState ?? "");
                            setBillingZip(data.billingZip ?? "");
                            if (data.cardLastFour) { setCardNumber(`•••• •••• •••• ${data.cardLastFour}`); setCardExpiry("••/••"); }
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

                {/* New-customer account creation (only when not logged in) */}
                {!session && !showLoginPanel && (
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
                <h1 className="text-2xl font-bold">Payment Information</h1>

                {session?.cardLastFour && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">Saved card ending in {session.cardLastFour}</p>
                      <p className="text-xs text-muted-foreground">{session.cardBrand}</p>
                    </div>
                    <button onClick={() => { setCardNumber(""); setCardExpiry(""); setCardCvc(""); }} className="ml-auto text-xs text-primary underline">Use a different card</button>
                  </div>
                )}

                <div className="bg-background rounded-2xl border shadow-sm p-6 space-y-5">
                  <h2 className="font-semibold flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" />
                    Card Details
                  </h2>

                  <div className="space-y-1.5">
                    <Label>Card Number</Label>
                    <Input
                      value={cardNumber}
                      onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                      placeholder="1234 5678 9012 3456"
                      className="h-11 font-mono tracking-wider"
                      maxLength={19}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Expiry Date</Label>
                      <Input value={cardExpiry} onChange={e => setCardExpiry(formatExpiry(e.target.value))} placeholder="MM/YY" className="h-11" maxLength={5} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>CVC</Label>
                      <Input value={cardCvc} onChange={e => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" className="h-11" />
                    </div>
                  </div>
                </div>

                <div className="bg-background rounded-2xl border shadow-sm p-6 space-y-5">
                  <h2 className="font-semibold flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    Billing Address
                  </h2>

                  <div className="space-y-1.5">
                    <Label>Name on Card</Label>
                    <Input value={billingName} onChange={e => setBillingName(e.target.value)} className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Street Address</Label>
                    <Input value={billingAddress} onChange={e => setBillingAddress(e.target.value)} className="h-11" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1 space-y-1.5">
                      <Label>City</Label>
                      <Input value={billingCity} onChange={e => setBillingCity(e.target.value)} className="h-11" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>State</Label>
                      <Input value={billingState} onChange={e => setBillingState(e.target.value)} className="h-11" maxLength={2} placeholder="CA" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>ZIP</Label>
                      <Input value={billingZip} onChange={e => setBillingZip(e.target.value.replace(/\D/g, "").slice(0, 5))} className="h-11" />
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Your payment info is saved securely to your account for future bookings. No charge is made until your booking is confirmed.
                </p>

                <Button size="lg" className="w-full h-13 text-base font-bold rounded-xl" onClick={handlePaymentNext}>
                  Continue to Agreement
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {/* ── STEP 3: RENTAL AGREEMENT ── */}
            {step === "agreement" && (
              <div className="space-y-6">
                <h1 className="text-2xl font-bold">Rental Agreement</h1>

                <div className="bg-background rounded-2xl border shadow-sm p-6 space-y-4 max-h-96 overflow-y-auto text-sm text-muted-foreground leading-relaxed">
                  <h2 className="text-base font-bold text-foreground">Vehicle Rental Agreement</h2>
                  <p><strong className="text-foreground">Rental Period:</strong> {startFormatted} — {endFormatted} ({days} day{days > 1 ? "s" : ""})</p>
                  <p><strong className="text-foreground">Vehicle:</strong> {listing.title}</p>
                  <p><strong className="text-foreground">Renter:</strong> {name} ({email})</p>
                  <Separator />
                  <p><strong className="text-foreground">1. Use of Vehicle.</strong> The renter agrees to use the vehicle only for lawful purposes and in a safe manner. The vehicle shall not be used off-road unless specifically permitted, sub-rented, or used to tow any object unless specifically authorized.</p>
                  <p><strong className="text-foreground">2. Damage & Liability.</strong> The renter accepts full financial responsibility for any damage to the vehicle during the rental period, including but not limited to collisions, theft, vandalism, and weather damage. The security deposit of ${deposit.toFixed(2)} will be held against damages and returned within 5 business days of vehicle return if no damage is found.</p>
                  <p><strong className="text-foreground">3. Age & License.</strong> The renter certifies they are of legal age to operate this vehicle and hold a valid license or certification required by law.</p>
                  <p><strong className="text-foreground">4. Fuel & Condition.</strong> The vehicle must be returned with the same fuel level and in the same general condition as when received. Cleaning fees may apply if the vehicle is returned excessively dirty.</p>
                  <p><strong className="text-foreground">5. Cancellation.</strong> Cancellations made more than 48 hours before the rental start date are eligible for a full refund. Cancellations within 48 hours may forfeit the deposit.</p>
                  <p><strong className="text-foreground">6. Payment.</strong> The total rental fee is <strong className="text-foreground">${total.toFixed(2)}</strong> (${subtotal.toFixed(2)} rental + ${deposit.toFixed(2)} refundable deposit). No charge will be processed until this booking is confirmed by our team.</p>
                  <p><strong className="text-foreground">7. Governing Law.</strong> This agreement shall be governed by the laws of the state where the rental business is located. Any disputes shall be resolved through binding arbitration.</p>
                  <p className="text-xs italic">By signing below, you confirm you have read, understood, and agree to all terms in this rental agreement.</p>
                </div>

                <div className="bg-background rounded-2xl border shadow-sm p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold">Sign the Agreement</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Type your full legal name below to sign</p>
                  <Input
                    placeholder={`Type your name: ${name}`}
                    value={agreeSigned}
                    onChange={e => setAgreeSigned(e.target.value)}
                    className="h-11 font-medium"
                  />
                  {agreeSigned && agreeSigned.trim().toLowerCase() !== name.trim().toLowerCase() && (
                    <p className="text-xs text-amber-600">Must match exactly: <strong>{name}</strong></p>
                  )}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={agreeChecked} onChange={e => setAgreeChecked(e.target.checked)} className="mt-0.5 w-4 h-4 accent-primary" />
                    <span className="text-sm">I have read and agree to all terms in the rental agreement above, including the cancellation policy and damage liability.</span>
                  </label>
                </div>

                <Button
                  size="lg"
                  className="w-full h-13 text-base font-bold rounded-xl"
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting || !agreeChecked || agreeSigned.trim().toLowerCase() !== name.trim().toLowerCase()}
                >
                  {isSubmitting ? "Submitting..." : "Sign & Submit Booking Request"}
                  <CheckCircle2 className="w-4 h-4 ml-2" />
                </Button>
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
                    <p className="text-green-700/80 text-sm mt-1">
                      We'll review and email a confirmation to <strong>{email}</strong>. Bring a valid ID on {startFormatted}.
                    </p>
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
                            <div key={b.id} className={`bg-background rounded-2xl border p-4 flex items-center gap-4 ${isNew ? "border-primary ring-1 ring-primary/20" : ""}`}>
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
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── SIDEBAR SUMMARY ── */}
          {step !== "confirmation" && (
            <div className="lg:col-span-2">
              <div className="sticky top-32">
                <div className="bg-background rounded-2xl border shadow-sm overflow-hidden">
                  <div className="aspect-[4/3] bg-muted relative">
                    {listing.imageUrls?.[0] ? (
                      <img src={listing.imageUrls[0]} alt={listing.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No image</div>
                    )}
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-0.5">{listing.categoryName}</p>
                      <h3 className="font-bold text-base leading-snug">{listing.title}</h3>
                    </div>
                    {dateRange?.from && dateRange?.to && (
                      <>
                        <Separator />
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <CalendarIcon className="w-3.5 h-3.5" /> {startFormatted}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-muted-foreground">{endFormatted}</span>
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
                          <Separator />
                          <div className="flex justify-between font-bold text-base">
                            <span>Total</span>
                            <span>${total.toFixed(2)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">No charge until confirmed</p>
                        </div>
                      </>
                    )}
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
