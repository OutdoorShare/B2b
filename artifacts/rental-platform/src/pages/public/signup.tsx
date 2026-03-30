import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, ArrowRight, Eye, EyeOff, ExternalLink, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const OS_GREEN = "#3ab549";
const OS_GREEN_DARK = "#2e9a3d";

const PLANS = [
  { id: "starter", name: "Starter", price: 49, features: ["Up to 10 listings", "Booking management", "Customer storefront", "Analytics"] },
  { id: "professional", name: "Professional", price: 99, features: ["Up to 50 listings", "Team members (5 seats)", "Custom branding", "Claims management"], popular: true },
  { id: "enterprise", name: "Enterprise", price: 249, features: ["Unlimited listings", "Unlimited team seats", "Kiosk mode", "API access"] },
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

  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    password: "",
    phone: "",
    plan: "professional",
  });

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
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Signup failed. Please try again."); return; }
      setCreated(data);
      setStep("payment");
    } catch {
      setError("Connection error. Please try again.");
    } finally { setSubmitting(false); }
  };

  const selectedPlan = PLANS.find(p => p.id === form.plan)!;

  const STRIPE_PAYMENT_LINK = (window as any).__STRIPE_LINK__ ?? "#";

  const steps: { key: Step; label: string }[] = [
    { key: "info", label: "Company Details" },
    { key: "plan", label: "Choose Plan" },
    { key: "payment", label: "Complete Payment" },
  ];
  const stepIndex = steps.findIndex(s => s.key === step);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/get-started">
            <div className="flex items-center gap-2.5 cursor-pointer">
              <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="w-8 h-8 object-contain" />
              <span className="font-black text-lg tracking-tight text-gray-900">OutdoorShare</span>
            </div>
          </Link>
          <div className="text-sm text-muted-foreground">
            Already have an account? <Link href="/admin" className="font-semibold hover:underline" style={{ color: OS_GREEN }}>Sign in</Link>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Progress */}
        {step !== "done" && (
          <div className="flex items-center gap-2 mb-10">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 ${i <= stepIndex ? "" : "text-muted-foreground"}`} style={i <= stepIndex ? { color: OS_GREEN } : {}}>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i >= stepIndex ? "border-2" : ""}`}
                    style={
                      i < stepIndex ? { backgroundColor: OS_GREEN, color: "white" } :
                      i === stepIndex ? { borderColor: OS_GREEN, color: OS_GREEN } :
                      { borderColor: "#e5e7eb", color: "#9ca3af" }
                    }
                  >
                    {i < stepIndex ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className="text-sm font-medium hidden sm:block">{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2" style={{ backgroundColor: i < stepIndex ? OS_GREEN : "#e5e7eb" }} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step 1: Company Info */}
        {step === "info" && (
          <form
            autoComplete="on"
            onSubmit={e => { e.preventDefault(); if (validateInfo()) setStep("plan"); }}
            className="bg-white rounded-2xl border shadow-sm p-8 space-y-6"
          >
            <div>
              <h1 className="text-2xl font-black text-gray-900">Create your rental business</h1>
              <p className="text-muted-foreground mt-1">Set up your account and branded booking site.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="companyName">Company Name <span className="text-destructive">*</span></Label>
                <Input
                  id="companyName" value={form.companyName}
                  onChange={e => set("companyName", e.target.value)}
                  placeholder="Acme Rentals" className="h-11"
                />
                {slugPreview && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="w-3 h-3" />
                    Your site URL: <code className="font-mono bg-gray-100 px-1 rounded">platform.com/<strong>{slugPreview}</strong></code>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="contactName">Your Name <span className="text-destructive">*</span></Label>
                  <Input id="contactName" value={form.contactName} onChange={e => set("contactName", e.target.value)} placeholder="Jane Smith" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+1 (555) 000-0000" className="h-11" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address <span className="text-destructive">*</span></Label>
                <Input id="email" type="email" autoComplete="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@company.com" className="h-11" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Admin Password <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    id="password" autoComplete="new-password"
                    type={showPass ? "text" : "password"}
                    value={form.password} onChange={e => set("password", e.target.value)}
                    placeholder="Min. 8 characters" className="h-11 pr-10"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-destructive font-medium">{error}</p>}

            <Button
              type="submit"
              className="w-full h-11 font-bold gap-2 text-white hover:opacity-90"
              style={{ backgroundColor: OS_GREEN }}
            >
              Next: Choose a Plan <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        )}

        {/* Step 2: Plan */}
        {step === "plan" && (
          <div className="bg-white rounded-2xl border shadow-sm p-8 space-y-6">
            <div>
              <h1 className="text-2xl font-black text-gray-900">Choose your plan</h1>
              <p className="text-muted-foreground mt-1">All plans include a 14-day free trial. No card charged until trial ends.</p>
            </div>

            <div className="space-y-3">
              {PLANS.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => set("plan", plan.id)}
                  className="w-full text-left p-4 rounded-xl border-2 transition-all hover:border-gray-300"
                  style={form.plan === plan.id ? { borderColor: OS_GREEN, backgroundColor: `${OS_GREEN}0c` } : { borderColor: "#e5e7eb" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: form.plan === plan.id ? OS_GREEN : "#d1d5db" }}>
                        {form.plan === plan.id && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: OS_GREEN }} />}
                      </div>
                      <span className="font-bold text-gray-900">{plan.name}</span>
                      {plan.popular && <Badge className="text-white text-xs" style={{ backgroundColor: OS_GREEN }}>Popular</Badge>}
                    </div>
                    <span className="font-black text-gray-900">${plan.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></span>
                  </div>
                  <ul className="grid grid-cols-2 gap-1 pl-7">
                    {plan.features.map(f => (
                      <li key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 shrink-0" style={{ color: OS_GREEN }} /> {f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            {error && <p className="text-sm text-destructive font-medium">{error}</p>}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-11" onClick={() => setStep("info")}>Back</Button>
              <Button
                className="flex-1 h-11 font-bold gap-2 text-white hover:opacity-90"
                style={{ backgroundColor: OS_GREEN }}
                onClick={handleCreate}
                disabled={submitting}
              >
                {submitting ? "Creating account…" : `Continue to Payment →`}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Payment */}
        {step === "payment" && created && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border shadow-sm p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900">Account created!</h1>
                <p className="text-muted-foreground mt-1">
                  <strong>{created.tenant.name}</strong> is set up. Complete payment to fully activate.
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2 text-left">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-semibold capitalize">{created.tenant.plan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Admin email</span>
                  <span className="font-semibold">{created.adminEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Site slug</span>
                  <code className="font-mono text-xs bg-white border rounded px-1.5 py-0.5">/{created.siteSlug}</code>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="font-bold text-amber-900">Complete your payment</h3>
                <p className="text-sm text-amber-700 mt-1">
                  Your account is ready but your plan requires payment to stay active after your 14-day trial.
                </p>
              </div>
              <a
                href={STRIPE_PAYMENT_LINK}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2">
                  Complete Payment <ExternalLink className="w-4 h-4" />
                </Button>
              </a>
              <p className="text-xs text-amber-600 text-center">
                You'll be redirected to our secure payment page. Return here after completing payment.
              </p>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
              <h3 className="font-bold text-gray-900">Ready to set up your site?</h3>
              <p className="text-sm text-muted-foreground">You can start configuring your rental site now while your trial is active.</p>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/login">
                  <Button variant="outline" className="w-full font-semibold">
                    Sign In to Admin
                  </Button>
                </Link>
                <Link href="/admin/onboarding">
                  <Button className="w-full font-bold gap-1.5 text-white hover:opacity-90" style={{ backgroundColor: OS_GREEN }}>
                    Set Up My Site <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
