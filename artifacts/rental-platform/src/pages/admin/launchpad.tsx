import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { adminPath, getAdminSlug } from "@/lib/admin-nav";
import { Button } from "@/components/ui/button";
import {
  Building2, Image, CreditCard, FileSignature, Package,
  Mail, ShieldCheck, CheckCircle2, Circle, ChevronRight,
  Rocket, ExternalLink, Loader2, RefreshCw
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function adminHeaders(): HeadersInit {
  try {
    const raw = localStorage.getItem("admin_session");
    if (raw) {
      const s = JSON.parse(raw);
      if (s?.token) return { "x-admin-token": s.token };
    }
  } catch { /* ignore */ }
  return {};
}

type ItemState = "complete" | "incomplete" | "loading" | "always";

interface LaunchItem {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  state: ItemState;
  actionLabel: string;
  onAction: () => void;
  optional?: boolean;
}

export default function AdminLaunchpad() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data state
  const [profile, setProfile] = useState<any>(null);
  const [stripeStatus, setStripeStatus] = useState<{ connected: boolean; chargesEnabled?: boolean } | null>(null);
  const [listingCount, setListingCount] = useState<number | null>(null);

  const fetchAll = async () => {
    const [profileRes, stripeRes, listingsRes] = await Promise.allSettled([
      fetch(`${BASE}/api/business`).then(r => r.json()),
      fetch(`${BASE}/api/stripe/connect/status`, { headers: adminHeaders() }).then(r => r.ok ? r.json() : { connected: false }),
      fetch(`${BASE}/api/listings`).then(r => r.json()),
    ]);

    if (profileRes.status === "fulfilled") setProfile(profileRes.value);
    if (stripeRes.status === "fulfilled") setStripeStatus(stripeRes.value);
    if (listingsRes.status === "fulfilled") {
      const data = listingsRes.value;
      setListingCount(Array.isArray(data) ? data.length : 0);
    }
  };

  useEffect(() => {
    // Mark this slug as having visited the launchpad so the first-visit
    // redirect in App.tsx no longer triggers on subsequent admin visits.
    const slug = getAdminSlug();
    if (slug) localStorage.setItem(`admin_launchpad_seen_${slug}`, "1");

    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const handleStripeConnect = async () => {
    try {
      const res = await fetch(`${BASE}/api/stripe/connect/onboard`, { method: "POST", headers: adminHeaders() });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { /* ignore */ }
  };

  const isProfileComplete = !!(
    profile &&
    profile.name &&
    profile.name !== "My Rental Company" &&
    profile.email
  );
  const hasBranding = !!(profile?.logoUrl);
  const isStripeConnected = !!(stripeStatus?.connected && stripeStatus?.chargesEnabled);
  const hasAgreement = !!(profile?.rentalTerms && profile.rentalTerms.trim().length > 20);
  const hasListing = (listingCount ?? 0) > 0;

  // 5 trackable + 2 always-complete
  const TRACKABLE = [isProfileComplete, hasBranding, isStripeConnected, hasAgreement, hasListing];
  const completed = TRACKABLE.filter(Boolean).length + 2; // +2 for always-complete items
  const total = TRACKABLE.length + 2;
  const pct = Math.round((completed / total) * 100);
  const allDone = completed === total;

  const items: LaunchItem[] = [
    {
      id: "profile",
      icon: Building2,
      title: "Business Profile",
      description: "Set your company name, contact email, and location. This powers your storefront header and all customer communications.",
      state: loading ? "loading" : isProfileComplete ? "complete" : "incomplete",
      actionLabel: "Complete Profile",
      onAction: () => setLocation(adminPath("/settings?tab=general")),
    },
    {
      id: "branding",
      icon: Image,
      title: "Logo & Cover Photo",
      description: "Upload your logo and a cover image. They appear on your storefront, booking emails, and the rental agreement PDF.",
      state: loading ? "loading" : hasBranding ? "complete" : "incomplete",
      actionLabel: "Upload Logo",
      onAction: () => setLocation(adminPath("/settings?tab=branding")),
    },
    {
      id: "stripe",
      icon: CreditCard,
      title: "Stripe Connect",
      description: "Link your Stripe account to start accepting payments and receiving payouts. Required for live bookings.",
      state: loading ? "loading" : isStripeConnected ? "complete" : "incomplete",
      actionLabel: isStripeConnected ? "View Stripe Dashboard" : "Connect Stripe",
      onAction: isStripeConnected
        ? () => setLocation(adminPath("/settings?tab=payments"))
        : handleStripeConnect,
    },
    {
      id: "agreement",
      icon: FileSignature,
      title: "Rental Agreement",
      description: "Write your rental terms and waiver. Customers sign it electronically before their rental begins — a signed PDF is saved to each booking.",
      state: loading ? "loading" : hasAgreement ? "complete" : "incomplete",
      actionLabel: "Write Agreement",
      onAction: () => setLocation(adminPath("/settings?tab=policies")),
    },
    {
      id: "listing",
      icon: Package,
      title: "First Rental Listing",
      description: "Add your first rental item with pricing, photos, and availability. Customers browse and book directly from your storefront.",
      state: loading ? "loading" : hasListing ? "complete" : "incomplete",
      actionLabel: hasListing ? "Manage Listings" : "Add First Listing",
      onAction: () => setLocation(adminPath(hasListing ? "/listings" : "/listings/new")),
    },
    {
      id: "email",
      icon: Mail,
      title: "Email Notifications",
      description: "Booking confirmations, pickup reminders, and return receipts are sent automatically. OutdoorShare handles Gmail delivery using your business email as the reply-to.",
      state: "always",
      actionLabel: "View Email Settings",
      onAction: () => setLocation(adminPath("/communications")),
    },
    {
      id: "identity",
      icon: ShieldCheck,
      title: "Stripe Identity Verification",
      description: "Renters are asked to verify their government-issued ID before pickup. Powered by Stripe Identity and built into every booking — no setup required.",
      state: "always",
      actionLabel: "Learn About Verification",
      onAction: () => window.open("https://stripe.com/identity", "_blank"),
      optional: true,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      {/* ── Progress Header ─────────────────────────────────────────────── */}
      <div className={`rounded-2xl border p-6 ${allDone ? "bg-green-50 border-green-200" : "bg-card border-border"}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${allDone ? "bg-green-100" : "bg-primary/10"}`}>
              <Rocket className={`w-7 h-7 ${allDone ? "text-green-600" : "text-primary"}`} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">
                {allDone ? "You're all set!" : "Get up and running"}
              </h2>
              <p className="text-muted-foreground text-sm mt-0.5">
                {allDone
                  ? "All integrations are active. Your storefront is fully configured."
                  : "Complete these steps to unlock the full OutdoorShare experience."}
              </p>
            </div>
          </div>
          <button
            onClick={refresh}
            disabled={refreshing || loading}
            className="shrink-0 p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Counter + Progress bar */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-semibold text-foreground">
              <span className={`text-2xl font-black tabular-nums ${allDone ? "text-green-600" : "text-primary"}`}>{completed}</span>
              <span className="text-muted-foreground font-normal"> / {total} complete</span>
            </span>
            <span className="text-muted-foreground text-xs">{pct}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${allDone ? "bg-green-500" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Checklist ───────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {items.map((item, idx) => {
          const isComplete = item.state === "complete" || item.state === "always";
          const isLoading = item.state === "loading";

          return (
            <div
              key={item.id}
              className={`rounded-xl border p-5 flex items-start gap-4 transition-all ${
                isComplete
                  ? "bg-muted/30 border-border opacity-80"
                  : "bg-card border-border shadow-sm hover:shadow-md"
              }`}
            >
              {/* Status icon */}
              <div className="shrink-0 mt-0.5">
                {isLoading ? (
                  <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                ) : isComplete ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground/40" />
                )}
              </div>

              {/* Step icon + content */}
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  isComplete ? "bg-green-100" : "bg-primary/10"
                }`}>
                  <item.icon className={`w-4.5 h-4.5 ${isComplete ? "text-green-600" : "text-primary"}`} style={{ width: "1.125rem", height: "1.125rem" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-semibold text-sm ${isComplete ? "text-muted-foreground line-through decoration-muted-foreground/40" : "text-foreground"}`}>
                      {idx + 1}. {item.title}
                    </p>
                    {item.state === "always" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                        Included
                      </span>
                    )}
                    {item.optional && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border">
                        Optional
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
                </div>
              </div>

              {/* Action button */}
              <div className="shrink-0">
                {isLoading ? null : (
                  <Button
                    size="sm"
                    variant={isComplete ? "ghost" : "default"}
                    className="gap-1.5 text-xs"
                    onClick={item.onAction}
                  >
                    {item.actionLabel}
                    {item.id === "identity" ? (
                      <ExternalLink className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer tip ──────────────────────────────────────────────────── */}
      {!allDone && (
        <p className="text-center text-xs text-muted-foreground pb-4">
          Hit refresh after completing a step to update your progress. Changes in Settings or Stripe take a moment to reflect.
        </p>
      )}
    </div>
  );
}
