import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, AlertTriangle, Clock, CreditCard, ExternalLink, Zap, Star, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getAdminSlug } from "@/lib/admin-nav";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface BillingStatus {
  plan: string;
  status: string;
  trialEndsAt: string | null;
  trialActive: boolean;
  trialExpired: boolean;
  daysLeft: number | null;
  subscriptionStatus: string | null;
  subscriptionId: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  isBlocked: boolean;
}

const PLAN_DISPLAY: Record<string, { label: string; price: string; icon: typeof Zap; color: string }> = {
  starter: { label: "Half Throttle", price: "Free — 15% flat fee per booking", icon: Zap, color: "#3ab549" },
  professional: { label: "Full Throttle", price: "$895 / year", icon: Star, color: "#29b4d4" },
  enterprise: { label: "Growth & Scale", price: "$500 / month or $3,400 / year", icon: Building2, color: "#f59e0b" },
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const map: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
    active: { label: "Active", variant: "default" },
    trialing: { label: "Trial", variant: "secondary" },
    past_due: { label: "Payment Due", variant: "destructive" },
    canceled: { label: "Canceled", variant: "destructive" },
    unpaid: { label: "Unpaid", variant: "destructive" },
    incomplete: { label: "Incomplete", variant: "outline" },
  };
  const cfg = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export default function AdminBilling() {
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [, navigate] = useLocation();
  const slug = getAdminSlug();

  const searchParams = new URLSearchParams(window.location.search);
  const justPaid = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  useEffect(() => {
    async function fetchBilling() {
      try {
        const res = await fetch(`${BASE}/api/billing/status`, { headers: { "x-tenant-slug": slug } });
        if (res.ok) setBilling(await res.json());
      } catch { } finally { setLoading(false); }
    }
    fetchBilling();
  }, [slug]);

  async function handleSubscribe() {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/api/billing/checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": slug },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to start checkout."); return; }
      window.location.href = data.url;
    } catch { setError("Connection error. Please try again."); }
    finally { setActionLoading(false); }
  }

  async function handlePortal() {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/api/billing/portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": slug },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to open portal."); return; }
      window.location.href = data.url;
    } catch { setError("Connection error. Please try again."); }
    finally { setActionLoading(false); }
  }

  const isSubscribed = ["active", "trialing", "past_due"].includes(billing?.subscriptionStatus ?? "");
  const planCfg = PLAN_DISPLAY[billing?.plan ?? "starter"];
  const PlanIcon = planCfg?.icon ?? Zap;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Loading billing info…</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Billing & Subscription</h1>
          <p className="text-muted-foreground mt-1">Manage your OutdoorShare plan and payment method.</p>
        </div>

        {/* Success / canceled banners */}
        {justPaid && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            Payment successful! Your subscription is now active.
          </div>
        )}
        {canceled && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            Checkout was canceled — no charge was made.
          </div>
        )}

        {/* Current plan card */}
        <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${planCfg?.color ?? "#3ab549"}18` }}>
                <PlanIcon className="w-5 h-5" style={{ color: planCfg?.color ?? "#3ab549" }} />
              </div>
              <div>
                <div className="font-black text-lg text-gray-900">{planCfg?.label}</div>
                <div className="text-sm text-muted-foreground">{planCfg?.price}</div>
              </div>
            </div>
            {billing?.subscriptionStatus && <StatusBadge status={billing.subscriptionStatus} />}
          </div>

          {/* Trial status */}
          {billing?.trialActive && billing.daysLeft !== null && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <Clock className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-amber-800">
                <strong>{billing.daysLeft} {billing.daysLeft === 1 ? "day" : "days"} left</strong> in your free trial
                {billing.trialEndsAt && <span className="text-amber-600"> · ends {new Date(billing.trialEndsAt).toLocaleDateString()}</span>}
              </span>
            </div>
          )}

          {billing?.trialExpired && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-red-800">
                <strong>Trial expired.</strong> Your storefront is paused. Subscribe to restore access.
              </span>
            </div>
          )}

          {/* Active subscription details */}
          {billing?.subscriptionStatus === "active" && billing.currentPeriodEnd && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-green-800">
                <strong>Active</strong> · Renews {new Date(billing.currentPeriodEnd).toLocaleDateString()}
              </span>
            </div>
          )}

          {billing?.subscriptionStatus === "past_due" && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-red-800"><strong>Payment failed.</strong> Update your payment method to avoid suspension.</span>
            </div>
          )}

          {error && <p className="text-sm text-destructive font-medium">{error}</p>}

          {/* Actions */}
          {billing?.plan === "enterprise" ? (
            <a href="mailto:contact.us@myoutdoorshare.com" className="block">
              <Button className="w-full h-11 font-bold gap-2" variant="outline">
                <ExternalLink className="w-4 h-4" /> Contact Us for Pricing
              </Button>
            </a>
          ) : isSubscribed ? (
            <Button
              className="w-full h-11 font-bold gap-2 text-white hover:opacity-90"
              style={{ backgroundColor: "#1a2332" }}
              onClick={handlePortal}
              disabled={actionLoading}
            >
              <CreditCard className="w-4 h-4" />
              {actionLoading ? "Opening portal…" : "Manage Subscription & Payment"}
            </Button>
          ) : (
            <Button
              className="w-full h-11 font-bold gap-2 text-white hover:opacity-90"
              style={{ backgroundColor: "#3ab549" }}
              onClick={handleSubscribe}
              disabled={actionLoading}
            >
              <CreditCard className="w-4 h-4" />
              {actionLoading ? "Redirecting to checkout…" : "Subscribe Now — Secure Checkout"}
            </Button>
          )}
        </div>

        {/* What's included */}
        <div className="bg-white rounded-2xl border shadow-sm p-6">
          <h3 className="font-bold text-gray-900 mb-3">What's included in your plan</h3>
          <ul className="space-y-2">
            {billing?.plan === "starter" && [
              "Booking platform with custom branding",
              "Protection plan on every rental",
              "OutdoorShare Marketplace listing",
              "Automated booking & payments",
              "15% flat platform fee per booking",
              "\"Powered by OutdoorShare\" branding",
            ].map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> {f}
              </li>
            ))}
            {billing?.plan === "professional" && [
              "Everything in Half Throttle",
              "Protection plan on every rental",
              "Tiered commissions — as low as 7%",
              "CRM tools",
              "AI answering agent",
              "Custom branding",
              "In-person setup support",
            ].map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> {f}
              </li>
            ))}
            {billing?.plan === "enterprise" && [
              "Everything in Full Throttle",
              "Protection plan on every rental",
              "No OutdoorShare branding",
              "Tiered commissions — minimum 7% fee",
              "Active marketing management",
              "Social media post management",
              "Ad spend management ($250/mo first 3 months*)",
            ].map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Questions? Email <a href="mailto:contact.us@myoutdoorshare.com" className="underline">contact.us@myoutdoorshare.com</a> or call <a href="tel:8016530765" className="underline">801-653-0765</a>
        </p>
      </div>
    </AdminLayout>
  );
}
