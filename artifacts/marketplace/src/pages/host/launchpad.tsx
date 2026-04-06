import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/context/auth";
import { HostLayout } from "./layout";
import { api } from "@/lib/api";
import {
  CheckCircle2, Circle, Package, CalendarDays, CreditCard,
  User, Package2, ArrowRight, Rocket, Zap, BookOpen, Star,
  ChevronRight, ExternalLink, BadgeCheck,
} from "lucide-react";

const API_BASE = "/api";

export function HostLaunchpadPage() {
  const { customer, hostInfo } = useAuth();
  const [, setLocation] = useLocation();

  const { data: listings } = useQuery({
    queryKey: ["host-listings", customer?.id],
    queryFn: () => api.host.listings(customer!.id),
    enabled: !!customer,
  });

  const { data: bundles } = useQuery({
    queryKey: ["host-bundles", customer?.id],
    queryFn: () => api.host.bundles(customer!.id),
    enabled: !!customer,
  });

  const { data: stripeStatus } = useQuery({
    queryKey: ["host-stripe-status", customer?.id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/host/stripe/status`, {
        headers: { "x-customer-id": String(customer!.id) },
      });
      if (!res.ok) return null;
      return res.json() as Promise<{ connected: boolean; status: string } | null>;
    },
    enabled: !!customer,
  });

  const hasListings   = (listings?.length ?? 0) > 0;
  const hasActiveList = listings?.some(l => l.status === "active") ?? false;
  const hasStripe     = stripeStatus?.connected === true;
  const hasProfile    = !!(hostInfo?.name && hostInfo?.location);
  const hasBundles    = (bundles?.length ?? 0) > 0;

  const steps: {
    id: string;
    label: string;
    desc: string;
    done: boolean;
    action: string;
    actionLabel: string;
    icon: React.ElementType;
    required: boolean;
  }[] = [
    {
      id: "account",
      label: "Create your host account",
      desc: "You're signed up and ready to list your adventures.",
      done: true,
      action: "/host",
      actionLabel: "Dashboard",
      icon: User,
      required: true,
    },
    {
      id: "profile",
      label: "Complete your host profile",
      desc: "Add your host name and location so renters know who they're booking with.",
      done: hasProfile,
      action: "/host/settings",
      actionLabel: "Open Settings",
      icon: BadgeCheck,
      required: true,
    },
    {
      id: "listing",
      label: "Add your first listing",
      desc: "Create a listing for any outdoor gear or experience you want to rent out.",
      done: hasListings,
      action: "/host/listings/new",
      actionLabel: "Create Listing",
      icon: Package,
      required: true,
    },
    {
      id: "activate",
      label: "Activate a listing",
      desc: "Set at least one listing to Active so it appears in the OutdoorShare marketplace.",
      done: hasActiveList,
      action: "/host/listings",
      actionLabel: "Manage Listings",
      icon: Zap,
      required: true,
    },
    {
      id: "stripe",
      label: "Connect Stripe for payouts",
      desc: "Link your Stripe account to receive 80% of each rental fee directly.",
      done: hasStripe,
      action: "/host/settings",
      actionLabel: "Connect Stripe",
      icon: CreditCard,
      required: true,
    },
    {
      id: "bundle",
      label: "Create a bundle (optional)",
      desc: "Group related gear together to offer a complete adventure package.",
      done: hasBundles,
      action: "/host/bundles",
      actionLabel: "Create Bundle",
      icon: Package2,
      required: false,
    },
  ];

  const requiredSteps = steps.filter(s => s.required);
  const doneCount = requiredSteps.filter(s => s.done).length;
  const pct = Math.round((doneCount / requiredSteps.length) * 100);
  const allDone = doneCount === requiredSteps.length;

  const nextStep = steps.find(s => !s.done);

  return (
    <HostLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <Rocket className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Launchpad</h1>
              <p className="text-sm text-gray-500">Get your adventure listed and earning on OutdoorShare</p>
            </div>
          </div>
        </div>

        {/* Progress banner */}
        <div className={`rounded-2xl p-5 mb-8 border ${allDone
          ? "bg-emerald-50 border-emerald-200"
          : "bg-white border-gray-200"
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold text-gray-900 text-sm">
                {allDone ? "You're all set! 🎉" : `${doneCount} of ${requiredSteps.length} steps complete`}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {allDone
                  ? "Your listings are live and ready to receive bookings."
                  : nextStep
                  ? `Next: ${nextStep.label}`
                  : "Almost there!"}
              </p>
            </div>
            <span className={`text-2xl font-bold ${allDone ? "text-emerald-600" : "text-primary"}`}>{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${allDone ? "bg-emerald-500" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {allDone && (
            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              All required steps completed — great work!
            </div>
          )}
        </div>

        {/* Checklist */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Setup Checklist</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-start gap-4 px-5 py-4 transition-colors ${
                  step.done ? "opacity-60" : "hover:bg-gray-50/60"
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold ${step.done ? "line-through text-gray-400" : "text-gray-900"}`}>
                      {step.label}
                    </p>
                    {!step.required && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Optional</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
                {!step.done && (
                  <button
                    onClick={() => setLocation(step.action)}
                    className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors whitespace-nowrap mt-0.5"
                  >
                    {step.actionLabel}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 px-0.5">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <QuickCard
              icon={Package}
              label="Add Listing"
              color="bg-primary/10 text-primary"
              onClick={() => setLocation("/host/listings/new")}
            />
            <QuickCard
              icon={CalendarDays}
              label="View Bookings"
              color="bg-blue-50 text-blue-600"
              onClick={() => setLocation("/host/bookings")}
            />
            <QuickCard
              icon={Package2}
              label="Create Bundle"
              color="bg-violet-50 text-violet-600"
              onClick={() => setLocation("/host/bundles")}
            />
            <QuickCard
              icon={CreditCard}
              label="Payout Settings"
              color="bg-emerald-50 text-emerald-600"
              onClick={() => setLocation("/host/settings")}
            />
            <QuickCard
              icon={Star}
              label="My Listings"
              color="bg-amber-50 text-amber-600"
              onClick={() => setLocation("/host/listings")}
            />
            <QuickCard
              icon={BookOpen}
              label="Browse Marketplace"
              color="bg-gray-100 text-gray-600"
              onClick={() => setLocation("/")}
            />
          </div>
        </div>

        {/* Tips */}
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl border border-primary/15 p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-3">Tips for a great listing</h2>
          <div className="space-y-2.5">
            {[
              { emoji: "📸", tip: "Upload high-quality photos from multiple angles — listings with photos get 3× more bookings." },
              { emoji: "💰", tip: "Price competitively to start. You can always raise prices once you have reviews." },
              { emoji: "📍", tip: "Add a precise pickup location so renters know exactly where to find you." },
              { emoji: "📦", tip: "Create a bundle to offer a complete adventure package and earn more per booking." },
              { emoji: "⚡", tip: "Connect Stripe early — payouts can take up to 2 business days to process." },
            ].map(({ emoji, tip }) => (
              <div key={tip} className="flex items-start gap-2.5">
                <span className="text-base leading-tight mt-px flex-shrink-0">{emoji}</span>
                <p className="text-xs text-gray-600 leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Upgrade banner */}
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 flex items-center gap-4">
          <div className="bg-primary/10 rounded-xl p-3 flex-shrink-0">
            <ExternalLink className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Ready to go pro?</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Register as a business for your own branded storefront, custom domain, full analytics, and team management.
            </p>
          </div>
          <button
            onClick={() => window.open("/", "_blank")}
            className="flex-shrink-0 flex items-center gap-1 bg-primary hover:bg-primary/90 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            Register as Business
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </HostLayout>
  );
}

function QuickCard({
  icon: Icon,
  label,
  color,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 p-4 bg-white rounded-xl border border-gray-200 hover:border-primary/30 hover:shadow-sm transition-all"
    >
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-xs font-medium text-gray-700">{label}</span>
    </button>
  );
}
