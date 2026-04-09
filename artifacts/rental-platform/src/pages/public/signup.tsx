import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, ArrowRight, Eye, EyeOff, CreditCard, Building2, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const OS_GREEN = "#3ab549";

const PLANS = [
  {
    id: "half_throttle",
    name: "Half Throttle",
    features: ["Booking platform with custom branding", "Protection plan on every rental", "OutdoorShare Marketplace listing", "Automated booking & payments"],
    billing: null,
  },
  {
    id: "full_throttle",
    name: "Full Throttle",
    features: ["Protection plan on every rental", "White-labeled OutdoorShare website", "AI answering agent included", "Hands-on in-person onboarding"],
    popular: true,
    billing: {
      monthly: { priceLabel: "$298", priceSuffix: "/mo", sub: "3 monthly payments · then renews annually" },
      annually: { priceLabel: "$895", priceSuffix: "/year", sub: "Tiered fee — as low as 7%" },
    },
  },
  {
    id: "growth_scale",
    name: "Growth & Scale",
    features: ["Protection plan on every rental", "No OutdoorShare branding", "Dedicated onboarding specialist", "Active marketing management"],
    billing: {
      monthly: { priceLabel: "$500", priceSuffix: "/mo", sub: "Billed monthly · cancel anytime" },
      annually: { priceLabel: "$3,400", priceSuffix: "/year", sub: "Save $1,600/year vs. monthly" },
    },
  },
];

type Step = "info" | "plan" | "payment" | "done";

interface CreatedAccount {
  tenant: { id: number; name: string; slug: string; email: string; plan: string };
  adminEmail: string;
  siteSlug: string;
}

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>("info");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedAccount | null>(null);

  // Read invite params from URL (?plan=starter&email=someone@example.com)
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const inviteEmail = params.get("email") ?? "";
  const invitePlan = params.get("plan") === "starter" ? "half_throttle" : "";

  const [billingInterval, setBillingInterval] = useState<"monthly" | "annually">("annually");

  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    email: inviteEmail,
    password: "",
    phone: "",
    plan: invitePlan || "professional",
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [slugPreview, setSlugPreview] = useState("");

  useEffect(() => {
    const slug = form.companyName
      .toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 40);
    setSlugPreview(slug);
  }, [form.companyName]);

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setLogoUrl("");
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview("");
    setLogoUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadLogo = async (): Promise<string> => {
    if (!logoFile) return "";
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", logoFile);
      const res = await fetch(`${BASE}/api/upload/image`, { method: "POST", body: fd });
      if (!res.ok) return "";
      const data = await res.json();
      return data.url ?? "";
    } catch {
      return "";
    } finally {
      setLogoUploading(false);
    }
  };

  const validateInfo = () => {
    if (!form.companyName.trim()) { setError("Company name is required."); return false; }
    if (!form.contactName.trim()) { setError("Your name is required."); return false; }
    if (!form.email.trim()) { setError("Email is required."); return false; }
    if (!/\S+@\S+\.\S+/.test(form.email)) { setError("Enter a valid email."); return false; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return false; }
    setError(""); return true;
  };

  const handleCreate = async () => {
    setError("");
    setSubmitting(true);
    try {
      const uploadedLogoUrl = logoFile ? await uploadLogo() : logoUrl;
      const res = await fetch(`${BASE}/api/public/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName.trim(),
          contactName: form.contactName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          plan: form.plan,
          phone: form.phone || null,
          logoUrl: uploadedLogoUrl || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Signup failed. Please try again."); return; }

      if (data.adminToken && data.siteSlug) {
        localStorage.setItem("admin_session", JSON.stringify({
          type: "owner",
          token: data.adminToken,
          tenantId: data.tenant?.id,
          tenantName: data.tenant?.name,
          tenantSlug: data.siteSlug,
          email: data.adminEmail,
          emailVerified: data.emailVerified ?? false,
        }));
      }

      setCreated(data);
      setStep("payment");
    } catch {
      setError("Connection error. Please try again.");
    } finally { setSubmitting(false); }
  };

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const selectedPlan = PLANS.find(p => p.id === form.plan)!;

  const handleCheckout = async () => {
    if (!created) return;
    setCheckoutLoading(true);
    setCheckoutError("");
    try {
      const res = await fetch(`${BASE}/api/billing/checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": created.siteSlug },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) { setCheckoutError(data.error ?? "Failed to start checkout."); return; }
      window.location.href = data.url;
    } catch { setCheckoutError("Connection error. Please try again."); }
    finally { setCheckoutLoading(false); }
  };

  const steps: { key: Step; label: string }[] = [
    { key: "info", label: "Company Details" },
    { key: "plan", label: "Choose Plan" },
    { key: "payment", label: "Complete Payment" },
  ];
  const stepIndex = steps.findIndex(s => s.key === step);

  return (
    <div className="min-h-screen flex" style={{ background: "#0d1117" }}>

      {/* LEFT PANEL — hero image + branding */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col">
        <img
          src="/hero-cover.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{ zIndex: 0 }}
        />
        {/* Dark gradient so text stays readable */}
        <div
          className="absolute inset-0"
          style={{ zIndex: 1, background: "linear-gradient(135deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.70) 100%)" }}
        />

        {/* Content overlay */}
        <div className="relative flex flex-col h-full p-10" style={{ zIndex: 2 }}>
          {/* Logo */}
          <Link href="/get-started">
            <div className="flex items-center gap-2.5 cursor-pointer">
              <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="w-8 h-8 object-contain" />
              <span className="font-black text-lg tracking-tight text-white">OutdoorShare</span>
            </div>
          </Link>

          {/* Center — storefront preview when logo uploaded, marketing copy otherwise */}
          <div className="flex-1 flex flex-col justify-center">
            {logoPreview ? (
              /* Live branded storefront preview */
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: OS_GREEN }}>
                  ✦ Your storefront preview
                </p>
                {/* Mock browser chrome */}
                <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)" }}>
                  {/* Browser bar */}
                  <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: "rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
                    </div>
                    <div className="flex-1 mx-3 rounded-md px-3 py-1 text-xs text-white/30 text-center" style={{ background: "rgba(255,255,255,0.05)" }}>
                      outdoorshare.rent/{slugPreview || "your-company"}
                    </div>
                  </div>
                  {/* Storefront header */}
                  <div className="px-5 py-4 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="flex items-center gap-3">
                      <img
                        src={logoPreview}
                        alt="Your logo"
                        className="h-10 w-10 object-contain rounded-lg"
                        style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
                      />
                      <span className="font-black text-white text-sm truncate max-w-[140px]">
                        {form.companyName || "Your Company"}
                      </span>
                    </div>
                    <div className="rounded-lg px-3 py-1.5 text-xs font-bold text-white" style={{ background: OS_GREEN }}>
                      Book Now
                    </div>
                  </div>
                  {/* Fake fleet grid */}
                  <div className="p-4 grid grid-cols-3 gap-2">
                    {["🛻", "🛥️", "🚵"].map((emoji, i) => (
                      <div key={i} className="rounded-xl aspect-[4/3] flex flex-col items-center justify-center gap-1" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <span className="text-2xl">{emoji}</span>
                        <span className="text-[10px] text-white/40">from $89/day</span>
                      </div>
                    ))}
                  </div>
                  {/* Powered by badge */}
                  <div className="px-4 pb-3 flex justify-center">
                    <span className="text-[9px] text-white/20 tracking-wider">Powered by OutdoorShare</span>
                  </div>
                </div>
                <p className="text-white/40 text-xs mt-4 text-center">This is a preview of your branded rental site</p>
              </div>
            ) : (
              /* Default marketing copy */
              <>
                <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: OS_GREEN }}>
                  Your outdoor rental platform
                </p>
                <h2 className="text-4xl font-black text-white leading-tight mb-4">
                  Launch your branded<br />rental site today.
                </h2>
                <p className="text-white/70 text-base leading-relaxed max-w-sm">
                  ATVs, jet skis, e-bikes, snowmobiles — manage your entire fleet, take bookings, and grow your brand without the tech headache.
                </p>
                <div className="mt-8 flex flex-col gap-3">
                  {[
                    { stat: "500+", label: "Rental companies launched" },
                    { stat: "50k+", label: "Bookings processed" },
                    { stat: "Free", label: "Lowest tier, no credit card required" },
                  ].map(item => (
                    <div key={item.stat} className="flex items-center gap-3">
                      <span className="font-black text-lg" style={{ color: OS_GREEN }}>{item.stat}</span>
                      <span className="text-white/60 text-sm">{item.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Bottom tagline */}
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} OutdoorShare · Powered by adventure
          </p>
        </div>
      </div>

      {/* RIGHT PANEL — form */}
      <div className="flex-1 flex flex-col overflow-y-auto" style={{ background: "#0d1117" }}>
        {/* Mobile logo header */}
        <div className="lg:hidden flex items-center justify-between px-6 pt-6 pb-4">
          <Link href="/get-started">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="w-7 h-7 object-contain" />
              <span className="font-black text-base tracking-tight text-white">OutdoorShare</span>
            </div>
          </Link>
          <Link href="/get-started" className="text-xs font-semibold" style={{ color: OS_GREEN }}>Sign in</Link>
        </div>

        <div className="flex-1 flex flex-col justify-center px-8 py-10 max-w-lg mx-auto w-full">

          {/* Desktop sign-in link */}
          <div className="hidden lg:flex justify-end mb-4">
            <span className="text-sm text-white/40">Already have an account?{" "}
              <Link href="/get-started" className="font-semibold hover:underline" style={{ color: OS_GREEN }}>Sign in</Link>
            </span>
          </div>

          {/* Step progress */}
          {step !== "done" && (
            <div className="flex items-center gap-2 mb-8">
              {steps.map((s, i) => (
                <div key={s.key} className="flex items-center gap-2 flex-1">
                  <div className={`flex items-center gap-2 ${i <= stepIndex ? "" : "opacity-40"}`}>
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border-2"
                      style={
                        i < stepIndex
                          ? { backgroundColor: OS_GREEN, borderColor: OS_GREEN, color: "white" }
                          : i === stepIndex
                          ? { borderColor: OS_GREEN, color: OS_GREEN, background: "transparent" }
                          : { borderColor: "#374151", color: "#6b7280", background: "transparent" }
                      }
                    >
                      {i < stepIndex ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                    </div>
                    <span className="text-xs font-semibold hidden sm:block" style={{ color: i <= stepIndex ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)" }}>
                      {s.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="flex-1 h-px mx-2" style={{ backgroundColor: i < stepIndex ? OS_GREEN : "#1f2937" }} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* STEP 1 — Company Info */}
          {step === "info" && (
            <form
              autoComplete="on"
              onSubmit={e => { e.preventDefault(); if (validateInfo()) setStep("plan"); }}
              className="space-y-5"
            >
              <div className="mb-6">
                <h1 className="text-2xl font-black text-white">Create your rental business</h1>
                <p className="text-white/50 text-sm mt-1">Set up your account and branded booking site.</p>
              </div>

              {/* Company Name */}
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                  Company Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="companyName" value={form.companyName}
                  onChange={e => set("companyName", e.target.value)}
                  placeholder="Acme Rentals"
                  className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-green-500 focus:ring-green-500/20"
                />
                {slugPreview && (
                  <p className="text-xs flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                    <Building2 className="w-3 h-3" />
                    Your site: <code className="font-mono rounded px-1" style={{ background: "rgba(255,255,255,0.06)", color: OS_GREEN }}>platform.com/<strong>{slugPreview}</strong></code>
                  </p>
                )}
              </div>

              {/* Logo Upload */}
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                  Company Logo <span className="text-white/30 font-normal normal-case">(optional)</span>
                </Label>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif" className="hidden" onChange={handleLogoChange} />
                {logoPreview ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
                    <img src={logoPreview} alt="Logo preview" className="h-12 w-12 object-contain rounded-lg border bg-white/10" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/80 truncate">{logoFile?.name}</p>
                      <p className="text-xs text-white/30">{logoFile ? `${(logoFile.size / 1024).toFixed(0)} KB` : ""}</p>
                    </div>
                    <button type="button" onClick={removeLogo} className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-20 rounded-xl flex flex-col items-center justify-center gap-1.5 border-2 border-dashed transition-colors"
                    style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.35)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(58,181,73,0.5)"; (e.currentTarget as HTMLElement).style.color = OS_GREEN; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.10)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)"; }}
                  >
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">Upload your logo</span>
                    <span className="text-xs opacity-60">PNG, JPG, SVG or WebP · max 5 MB</span>
                  </button>
                )}
              </div>

              {/* Name + Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                    Your Name <span className="text-red-400">*</span>
                  </Label>
                  <Input id="contactName" value={form.contactName} onChange={e => set("contactName", e.target.value)} placeholder="Jane Smith" className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-green-500" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-xs font-semibold uppercase tracking-wide">Phone</Label>
                  <Input id="phone" type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+1 (555) 000-0000" className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-green-500" />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                  Email Address <span className="text-red-400">*</span>
                </Label>
                <Input id="email" type="email" autoComplete="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@company.com" className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-green-500" />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                  Admin Password <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password" autoComplete="new-password"
                    type={showPass ? "text" : "password"}
                    value={form.password} onChange={e => set("password", e.target.value)}
                    placeholder="Min. 8 characters"
                    className="h-11 pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-green-500"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg px-4 py-2.5 text-sm font-medium" style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full h-12 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] mt-2"
                style={{ background: `linear-gradient(135deg, ${OS_GREEN}, #2e9a3d)`, boxShadow: `0 4px 24px rgba(58,181,73,0.35)` }}
              >
                Next: Choose a Plan <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                By continuing you agree to our Terms of Service &amp; Privacy Policy.
              </p>
            </form>
          )}

          {/* STEP 2 — Plan */}
          {step === "plan" && (
            <div className="space-y-5">
              <div className="mb-2">
                <h1 className="text-2xl font-black text-white">Choose your plan</h1>
                <p className="text-white/50 text-sm mt-1">Start free on Half Throttle or upgrade anytime.</p>
              </div>

              {/* Billing interval toggle */}
              <div className="flex items-center justify-center">
                <div className="flex rounded-lg p-0.5" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}>
                  {(["monthly", "annually"] as const).map(interval => (
                    <button
                      key={interval}
                      onClick={() => setBillingInterval(interval)}
                      className="px-4 py-1.5 rounded-md text-sm font-semibold transition-all capitalize"
                      style={
                        billingInterval === interval
                          ? { background: OS_GREEN, color: "#fff", boxShadow: "0 2px 8px rgba(58,181,73,0.4)" }
                          : { color: "rgba(255,255,255,0.45)" }
                      }
                    >
                      {interval}
                      {interval === "annually" && (
                        <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(58,181,73,0.25)", color: "#6ee47a" }}>
                          Save
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {PLANS.map(plan => {
                  const pricing = plan.billing
                    ? plan.billing[billingInterval]
                    : null;
                  return (
                    <button
                      key={plan.id}
                      onClick={() => set("plan", plan.id)}
                      className="w-full text-left p-4 rounded-xl border-2 transition-all"
                      style={
                        form.plan === plan.id
                          ? { borderColor: OS_GREEN, background: "rgba(58,181,73,0.08)" }
                          : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }
                      }
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: form.plan === plan.id ? OS_GREEN : "#374151" }}>
                            {form.plan === plan.id && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: OS_GREEN }} />}
                          </div>
                          <span className="font-bold text-white">{plan.name}</span>
                          {(plan as any).popular && <Badge className="text-white text-xs px-2" style={{ backgroundColor: OS_GREEN }}>Popular</Badge>}
                        </div>
                        <div className="text-right">
                          {pricing ? (
                            <>
                              <span className="font-black text-white">
                                {pricing.priceLabel}
                                <span className="text-xs font-normal text-white/40">{pricing.priceSuffix}</span>
                              </span>
                              <p className="text-[10px] text-white/35 mt-0.5">{pricing.sub}</p>
                            </>
                          ) : (
                            <span className="font-black text-white">Free</span>
                          )}
                        </div>
                      </div>
                      <ul className="grid grid-cols-2 gap-1 pl-7">
                        {plan.features.map(f => (
                          <li key={f} className="text-xs text-white/50 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 shrink-0" style={{ color: OS_GREEN }} /> {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>

              {error && (
                <div className="rounded-lg px-4 py-2.5 text-sm font-medium" style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}>
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("info")}
                  className="flex-1 h-12 rounded-xl font-semibold text-white/60 border border-white/10 hover:border-white/20 hover:text-white/80 transition-all"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                >
                  Back
                </button>
                <button
                  className="flex-1 h-12 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: `linear-gradient(135deg, ${OS_GREEN}, #2e9a3d)`, boxShadow: `0 4px 24px rgba(58,181,73,0.35)`, opacity: submitting ? 0.7 : 1 }}
                  onClick={handleCreate}
                  disabled={submitting}
                >
                  {submitting ? "Creating account…" : "Continue to Payment →"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — Payment */}
          {step === "payment" && created && (
            <div className="space-y-5">
              {/* Email verification notice */}
              <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.20)" }}>
                <span className="text-amber-400 text-lg shrink-0 mt-0.5">📧</span>
                <div>
                  <p className="font-semibold text-amber-300 text-sm">Check your inbox</p>
                  <p className="text-amber-200/60 text-sm mt-0.5">
                    We sent a verification link to <strong className="text-amber-200/90">{created.adminEmail}</strong>. Click it to activate your account.
                  </p>
                </div>
              </div>

              {/* Account created card */}
              <div className="rounded-xl p-6 text-center space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(58,181,73,0.15)", border: `2px solid ${OS_GREEN}40` }}>
                  <CheckCircle2 className="w-7 h-7" style={{ color: OS_GREEN }} />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white">Account created!</h1>
                  <p className="text-white/50 mt-1 text-sm">
                    <strong className="text-white/80">{created.tenant.name}</strong> is set up.{" "}
                    {selectedPlan?.id === "half_throttle" ? "You're ready to go — no payment required." : "Complete payment to fully activate."}
                  </p>
                </div>
                <div className="rounded-lg p-4 text-sm space-y-2 text-left" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="flex justify-between">
                    <span className="text-white/40">Plan</span>
                    <span className="font-semibold text-white capitalize">{created.tenant.plan}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Admin email</span>
                    <span className="font-semibold text-white">{created.adminEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Site slug</span>
                    <code className="font-mono text-xs rounded px-1.5 py-0.5" style={{ background: "rgba(58,181,73,0.12)", color: OS_GREEN }}>/{created.siteSlug}</code>
                  </div>
                </div>
              </div>

              {/* Payment CTA */}
              <div className="rounded-xl p-6 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {selectedPlan?.id === "half_throttle" ? (
                  <>
                    <div>
                      <h3 className="font-bold text-white">You're all set — no payment needed</h3>
                      <p className="text-sm text-white/40 mt-1">
                        Half Throttle is free forever. You only pay a 15% platform fee when a booking is made.
                      </p>
                    </div>
                    <Link href={`/${created.siteSlug}/admin`}>
                      <button className="w-full h-12 rounded-xl font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-all" style={{ background: `linear-gradient(135deg, ${OS_GREEN}, #2e9a3d)`, boxShadow: `0 4px 24px rgba(58,181,73,0.35)` }}>
                        <ArrowRight className="w-4 h-4" />
                        Go to Admin Dashboard
                      </button>
                    </Link>
                  </>
                ) : selectedPlan?.id === "growth_scale" ? (
                  <>
                    <div>
                      <h3 className="font-bold text-white">Custom pricing — let's talk</h3>
                      <p className="text-sm text-white/40 mt-1">Growth & Scale is custom-quoted. Reach out and we'll get you set up.</p>
                    </div>
                    <a href="mailto:contact.us@myoutdoorshare.com" className="block">
                      <button className="w-full h-12 rounded-xl font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-all" style={{ background: `linear-gradient(135deg, ${OS_GREEN}, #2e9a3d)` }}>
                        Contact Us to Set Up Billing
                      </button>
                    </a>
                  </>
                ) : (
                  <>
                    <div>
                      <h3 className="font-bold text-white">Add a payment method</h3>
                      <p className="text-sm text-white/40 mt-1">
                        Secured by Stripe. You can cancel or change plans at any time.
                      </p>
                    </div>
                    {checkoutError && (
                      <div className="rounded-lg px-4 py-2.5 text-sm font-medium" style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}>
                        {checkoutError}
                      </div>
                    )}
                    <button
                      className="w-full h-12 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
                      style={{ background: `linear-gradient(135deg, ${OS_GREEN}, #2e9a3d)`, boxShadow: `0 4px 24px rgba(58,181,73,0.35)`, opacity: checkoutLoading ? 0.7 : 1 }}
                      onClick={handleCheckout}
                      disabled={checkoutLoading}
                    >
                      <CreditCard className="w-4 h-4" />
                      {checkoutLoading ? "Redirecting to checkout…" : "Set Up Payment — Secure Checkout"}
                    </button>
                    <p className="text-xs text-white/25 text-center">
                      Secured by Stripe. Cancel anytime.
                    </p>
                  </>
                )}
              </div>

              {/* Quick launch */}
              <div className="rounded-xl p-6 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <h3 className="font-bold text-white">Ready to set up your site?</h3>
                <p className="text-sm text-white/40">Your account is active — start setting it up now.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Link href={`/${created.siteSlug}/admin`}>
                    <button className="w-full h-11 rounded-xl font-semibold text-white/60 border border-white/10 hover:border-white/20 hover:text-white/80 transition-all" style={{ background: "rgba(255,255,255,0.03)" }}>
                      Sign In to Admin
                    </button>
                  </Link>
                  <Link href={`/${created.siteSlug}/admin/onboarding`}>
                    <button className="w-full h-11 rounded-xl font-bold text-white flex items-center justify-center gap-1.5 hover:opacity-90 transition-all" style={{ background: `linear-gradient(135deg, ${OS_GREEN}, #2e9a3d)` }}>
                      Set Up My Site <ArrowRight className="w-4 h-4" />
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
