import { useState, useEffect } from "react";
import { CheckCircle2, AlertTriangle, CreditCard, ExternalLink, Zap, Star, Building2, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getAdminSlug, getAdminSession } from "@/lib/admin-nav";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface BillingStatus {
  plan: string;
  feePercent: number;
  status: string;
  subscriptionStatus: string | null;
  subscriptionId: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  isBlocked: boolean;
}

const PLANS = [
  {
    key: "starter",
    name: "Half Throttle",
    tagline: "Get started for free",
    price: "Free",
    priceSub: "forever",
    fee: "15% per booking",
    feeNote: "We take a cut — you keep the rest",
    icon: Zap,
    color: "#3ab549",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    features: [
      "Full booking platform with custom branding",
      "Protection plan on every rental",
      "OutdoorShare Marketplace listing",
      "Automated bookings & payments",
      "15% flat platform fee per booking",
      '"Powered by OutdoorShare" branding',
    ],
    cta: "Current Plan",
    ctaUpgrade: "Get Started — Free",
  },
  {
    key: "professional",
    name: "Full Throttle",
    tagline: "Best for growing businesses",
    price: "$895",
    priceSub: "/ year",
    fee: "As low as 7% per booking",
    feeNote: "Tiered commissions — keep more of each rental",
    icon: Star,
    color: "#29b4d4",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-200",
    badge: "Most Popular",
    features: [
      "Everything in Half Throttle",
      "Unlimited team members",
      "Tiered commissions — as low as 7%",
      "CRM tools & customer management",
      "AI answering agent (Roamio)",
      "Remove OutdoorShare branding",
      "Custom domain support",
      "In-person setup support",
      "Priority support",
    ],
    cta: "Current Plan",
    ctaUpgrade: "Upgrade to Full Throttle",
  },
  {
    key: "enterprise",
    name: "Growth & Scale",
    tagline: "Full-service management",
    price: "$500",
    priceSub: "/ month  ·  or $3,400 / year",
    fee: "Minimum 7% per booking",
    feeNote: "Active management, done for you",
    icon: Building2,
    color: "#f59e0b",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    features: [
      "Everything in Full Throttle",
      "Active marketing management",
      "Social media post management",
      "Ad spend management ($250/mo first 3 months*)",
      "No OutdoorShare branding anywhere",
      "Dedicated account manager",
      "White-glove onboarding",
    ],
    cta: "Current Plan",
    ctaUpgrade: "Contact Us to Upgrade",
    isEnterprise: true,
  },
];

export default function AdminBilling() {
  const { toast } = useToast();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const slug = getAdminSlug();

  const searchParams = new URLSearchParams(window.location.search);
  const justPaid = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  const adminHeaders = () => {
    const t = getAdminSession()?.token;
    return t ? { "x-admin-token": t, "x-tenant-slug": slug } : { "x-tenant-slug": slug };
  };

  const fetchBilling = async () => {
    try {
      const res = await fetch(`${BASE}/api/billing/status`, { headers: adminHeaders() });
      if (res.ok) setBilling(await res.json());
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { fetchBilling(); }, [slug]);

  const handleUpgrade = async (planKey: string) => {
    setUpgrading(planKey);
    setError("");
    try {
      const res = await fetch(`${BASE}/api/billing/checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to start checkout."); setUpgrading(null); return; }
      window.location.href = data.url;
    } catch {
      setError("Connection error. Please try again.");
      setUpgrading(null);
    }
  };

  const handlePortal = async () => {
    setUpgrading("portal");
    setError("");
    try {
      const res = await fetch(`${BASE}/api/billing/portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to open portal."); setUpgrading(null); return; }
      window.location.href = data.url;
    } catch {
      setError("Connection error. Please try again.");
      setUpgrading(null);
    }
  };

  const currentPlan = billing?.plan ?? "starter";
  const currentPlanIdx = PLANS.findIndex(p => p.key === currentPlan);
  const isSubscribed = ["active", "trialing", "past_due"].includes(billing?.subscriptionStatus ?? "");

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-black text-gray-900">Plan & Billing</h1>
          <p className="text-muted-foreground mt-1">You're on <strong>{PLANS.find(p => p.key === currentPlan)?.name ?? currentPlan}</strong>. Upgrade anytime to unlock lower fees and more features.</p>
        </div>

        {/* Banners */}
        {justPaid && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            Payment successful! Your plan has been upgraded.
          </div>
        )}
        {canceled && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            Checkout was canceled — no charge was made.
          </div>
        )}
        {billing?.subscriptionStatus === "past_due" && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <span><strong>Payment failed.</strong> Update your payment method to avoid suspension.</span>
            <Button size="sm" variant="destructive" onClick={handlePortal} disabled={upgrading === "portal"} className="ml-auto shrink-0">
              Update Payment Method
            </Button>
          </div>
        )}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}

        {/* Current plan highlight (only for paid plans) */}
        {isSubscribed && billing?.subscriptionStatus === "active" && billing?.currentPeriodEnd && (
          <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-900 text-sm">Subscription active</p>
                <p className="text-xs text-green-700">Renews {new Date(billing.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={handlePortal} disabled={upgrading === "portal"} className="gap-1.5 border-green-300 text-green-800 hover:bg-green-100">
              <CreditCard className="w-3.5 h-3.5" />
              {upgrading === "portal" ? "Opening…" : "Manage Billing"}
            </Button>
          </div>
        )}

        {/* Fee highlight for free plan */}
        {currentPlan === "starter" && (
          <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 flex items-center gap-6">
            <div className="text-center shrink-0">
              <div className="text-4xl font-black text-emerald-600">{billing?.feePercent ?? 15}%</div>
              <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mt-0.5">per booking</div>
            </div>
            <div className="w-px h-12 bg-emerald-200 shrink-0" />
            <div>
              <p className="font-bold text-gray-900">You're on the free plan — <span className="text-emerald-600">Half Throttle</span></p>
              <p className="text-sm text-muted-foreground mt-0.5">OutdoorShare keeps {billing?.feePercent ?? 15}% of each booking as a platform fee. Upgrade to Full Throttle to reduce fees to as low as 7% and unlock powerful tools.</p>
            </div>
          </div>
        )}

        {/* Pricing cards */}
        <div>
          <h2 className="text-base font-bold text-gray-700 mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" /> Compare Plans
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((plan, idx) => {
              const isCurrent = plan.key === currentPlan;
              const isUpgrade = idx > currentPlanIdx;
              const Icon = plan.icon;
              return (
                <div
                  key={plan.key}
                  className={`relative rounded-2xl border-2 p-6 flex flex-col gap-4 transition-all ${
                    isCurrent
                      ? `${plan.borderColor} ${plan.bgColor}`
                      : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md"
                  }`}
                >
                  {/* Badges */}
                  {isCurrent && (
                    <div className="absolute -top-3 left-4">
                      <span className="px-3 py-0.5 rounded-full text-xs font-bold text-white shadow-sm" style={{ backgroundColor: plan.color }}>
                        Current Plan
                      </span>
                    </div>
                  )}
                  {plan.badge && !isCurrent && (
                    <div className="absolute -top-3 left-4">
                      <span className="px-3 py-0.5 rounded-full text-xs font-bold text-white bg-sky-500 shadow-sm">
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  {/* Plan identity */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${plan.color}18` }}>
                        <Icon className="w-4 h-4" style={{ color: plan.color }} />
                      </div>
                      <span className="font-black text-gray-900">{plan.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{plan.tagline}</p>
                  </div>

                  {/* Price */}
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-gray-900">{plan.price}</span>
                      <span className="text-sm text-muted-foreground">{plan.priceSub}</span>
                    </div>
                    <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: `${plan.color}15`, color: plan.color }}>
                      <span>{plan.fee}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{plan.feeNote}</p>
                  </div>

                  {/* Features */}
                  <ul className="space-y-1.5 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: plan.color }} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className="mt-2">
                    {isCurrent ? (
                      <div className="w-full h-10 rounded-lg flex items-center justify-center text-sm font-semibold border-2 gap-2" style={{ borderColor: plan.color, color: plan.color, backgroundColor: `${plan.color}10` }}>
                        <CheckCircle2 className="w-4 h-4" /> Your Current Plan
                      </div>
                    ) : plan.isEnterprise ? (
                      <a href="mailto:contact.us@myoutdoorshare.com" className="block">
                        <Button className="w-full h-10 font-bold gap-1.5" style={{ backgroundColor: plan.color, color: "#fff" }}>
                          Contact Us <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                    ) : isUpgrade ? (
                      <Button
                        className="w-full h-10 font-bold gap-1.5 text-white"
                        style={{ backgroundColor: plan.color }}
                        onClick={() => handleUpgrade(plan.key)}
                        disabled={upgrading === plan.key}
                      >
                        {upgrading === plan.key ? "Redirecting…" : plan.ctaUpgrade}
                        {upgrading !== plan.key && <ArrowRight className="w-3.5 h-3.5" />}
                      </Button>
                    ) : (
                      <Button className="w-full h-10 font-bold gap-1.5" variant="outline" onClick={handlePortal} disabled={upgrading === "portal"}>
                        <CreditCard className="w-3.5 h-3.5" />
                        {upgrading === "portal" ? "Opening…" : "Manage Subscription"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer note */}
        {currentPlan === "professional" && (
          <p className="text-xs text-muted-foreground">* Ad spend management available in Growth & Scale plan. First 3 months at $250/mo included.</p>
        )}

        <p className="text-xs text-muted-foreground text-center border-t pt-4">
          Questions? Email{" "}
          <a href="mailto:contact.us@myoutdoorshare.com" className="underline hover:text-foreground">contact.us@myoutdoorshare.com</a>
          {" "}or call{" "}
          <a href="tel:8016530765" className="underline hover:text-foreground">801-653-0765</a>
        </p>
      </div>
    </AdminLayout>
  );
}
