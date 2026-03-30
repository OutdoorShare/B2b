import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  CalendarDays, BarChart3, Users, Package, Shield, Zap,
  CheckCircle2, ArrowRight, Star, Star as StarFull, TrendingDown,
  ShieldCheck, User, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const OS_GREEN = "#3ab549";
const OS_GREEN_DARK = "#2e9a3d";
const OS_BLUE = "#29b4d4";

const features = [
  { icon: Package, title: "Listing Management", desc: "Add unlimited equipment listings with photos, pricing, add-ons, and availability." },
  { icon: CalendarDays, title: "Booking Calendar", desc: "Real-time calendar view of all reservations. Confirm, activate, and complete bookings in clicks." },
  { icon: BarChart3, title: "Analytics Dashboard", desc: "Revenue trends, utilization rates, and top-performing listings at a glance." },
  { icon: Users, title: "Customer Portal", desc: "Your customers browse, book, and manage rentals on a branded storefront." },
  { icon: Shield, title: "Claims & Deposits", desc: "Track damage claims, manage security deposits, and protect your fleet." },
  { icon: Zap, title: "Kiosk Mode", desc: "Self-service check-in terminal for customers to pick up gear without staff." },
];

const testimonials = [
  { name: "Jake Winters", company: "Summit Gear Rentals", text: "Set up our entire booking system in one afternoon. Bookings went up 40% in the first month.", stars: 5 },
  { name: "Maria Chen", company: "Coastal Watersports", text: "The kiosk mode alone saved us 2 hours of staff time per day. Our customers love it.", stars: 5 },
  { name: "Derek Park", company: "Trail Wheels MTB", text: "Finally a platform built for rental companies, not adapted from something else.", stars: 5 },
];

function SignInDropdown() {
  const [open, setOpen] = useState(false);
  const [renterSlug, setRenterSlug] = useState("");
  const [slugError, setSlugError] = useState("");
  const [, navigate] = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function goToRenterPortal(e: React.FormEvent) {
    e.preventDefault();
    const slug = renterSlug.trim().toLowerCase().replace(/\s+/g, "-");
    if (!slug) { setSlugError("Please enter your rental company's website name."); return; }
    setOpen(false);
    navigate(`/${slug}/login`);
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 font-semibold"
        onClick={() => setOpen(v => !v)}
      >
        Sign In <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
          {/* Admin option */}
          <Link href="/admin" onClick={() => setOpen(false)}>
            <div className="flex items-start gap-3.5 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer border-b">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${OS_GREEN}18` }}>
                <ShieldCheck className="w-4.5 h-4.5" style={{ color: OS_GREEN }} />
              </div>
              <div>
                <div className="font-bold text-sm text-gray-900">Business Admin</div>
                <div className="text-xs text-muted-foreground mt-0.5">Manage your rental company, bookings &amp; listings</div>
              </div>
            </div>
          </Link>

          {/* Renter option */}
          <div className="px-5 py-4">
            <div className="flex items-start gap-3.5 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${OS_BLUE}18` }}>
                <User className="w-4.5 h-4.5" style={{ color: OS_BLUE }} />
              </div>
              <div>
                <div className="font-bold text-sm text-gray-900">Renter Portal</div>
                <div className="text-xs text-muted-foreground mt-0.5">Sign in to manage your active rentals &amp; bookings</div>
              </div>
            </div>
            <form onSubmit={goToRenterPortal} className="space-y-2">
              <Input
                value={renterSlug}
                onChange={e => { setRenterSlug(e.target.value); setSlugError(""); }}
                placeholder="e.g. summit-gear-rentals"
                className="h-9 text-sm"
              />
              {slugError && <p className="text-xs text-destructive">{slugError}</p>}
              <p className="text-[11px] text-muted-foreground">Enter your rental company's website name</p>
              <Button
                type="submit"
                size="sm"
                className="w-full font-bold text-white hover:opacity-90"
                style={{ backgroundColor: OS_BLUE }}
              >
                Go to Renter Portal
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const revenueTiers = [
  { rate: "20%", threshold: "Under $25K /year", label: "Starting rate", best: false },
  { rate: "15%", threshold: "$50K+ /year", label: null, best: false },
  { rate: "10%", threshold: "$100K+ /year", label: null, best: false },
  { rate: "7%", threshold: "$150K+ /year", label: "Best rate", best: true },
];

export default function GetStartedPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b bg-white/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="w-8 h-8 object-contain" />
            <span className="font-black text-lg tracking-tight text-gray-900">OutdoorShare</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <SignInDropdown />
            <Link href="/signup">
              <Button size="sm" style={{ backgroundColor: OS_GREEN }} className="hover:opacity-90 text-white font-semibold">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <Badge
          className="mb-6 border-0 px-4 py-1.5 text-sm font-semibold"
          style={{ backgroundColor: `${OS_GREEN}18`, color: OS_GREEN_DARK }}
        >
          🎉 &nbsp; White-label rental management platform
        </Badge>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight text-gray-900 leading-tight mb-6">
          Your rental business,<br />
          <span style={{ color: OS_GREEN }}>fully online</span> in minutes
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          OutdoorShare gives you a complete booking platform — branded storefront, admin dashboard, calendar, analytics, and more — without hiring developers.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/signup">
            <Button
              size="lg"
              className="h-13 px-8 text-base font-bold gap-2 text-white hover:opacity-90"
              style={{ backgroundColor: OS_GREEN }}
            >
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/admin">
            <Button size="lg" variant="outline" className="h-13 px-8 text-base">
              Sign into my account
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground mt-5">No credit card required for trial · Cancel anytime</p>
      </section>

      {/* Stats bar */}
      <section className="py-10" style={{ background: `linear-gradient(135deg, #1a6b2e 0%, #1c7a32 50%, #1a6b2e 100%)` }}>
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[["500+", "Rental Companies"], ["50k+", "Bookings Processed"], ["98%", "Uptime SLA"], ["< 2 min", "Average Setup"]].map(([val, label]) => (
            <div key={label}>
              <div className="text-3xl font-black text-white">{val}</div>
              <div className="text-sm mt-1" style={{ color: `${OS_GREEN}cc` }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black text-gray-900 mb-4">Everything you need to run rentals</h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">One platform handles your entire operation — from customer booking to fleet management.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map(f => (
            <div
              key={f.title}
              className="p-6 rounded-2xl border border-gray-100 bg-gray-50 transition-colors"
              onMouseEnter={e => (e.currentTarget.style.borderColor = `${OS_GREEN}40`)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "")}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ backgroundColor: `${OS_GREEN}15` }}
              >
                <f.icon className="w-5 h-5" style={{ color: OS_GREEN }} />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-gray-50 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-gray-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-muted-foreground">Start free, upgrade when you're ready. All plans include a 14-day trial.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-start">

            {/* Half Throttle */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200 flex flex-col">
              <div>
                <p className="text-sm font-semibold text-gray-500 mb-1">Half Throttle</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-5xl font-black text-gray-900">$25</span>
                  <span className="text-base text-muted-foreground font-medium">/mo</span>
                </div>
                <p className="text-sm text-muted-foreground mb-1">or $250/year — includes 1 month free</p>
                <p className="text-sm font-bold mb-6" style={{ color: OS_GREEN }}>No fee on your first rental!</p>
              </div>
              <ul className="space-y-3 mb-6 flex-1">
                {[
                  "Protection plan on every booking",
                  "Priority OutdoorShare listings",
                  "Tiered revenue share — as low as 7%",
                  "Customer management tools",
                  "Marketing tools included",
                  "Booking software with custom garage",
                  "Automated bookings",
                  "Mobile app management",
                ].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: OS_GREEN }} />
                    {f}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground italic mb-5">Typically pays for itself with 1 booking.</p>
              <Link href="/signup">
                <Button variant="outline" className="w-full font-bold border-gray-300 hover:border-gray-400">
                  Get Started
                </Button>
              </Link>
            </div>

            {/* Full Throttle — highlighted */}
            <div className="rounded-2xl p-8 flex flex-col relative" style={{ backgroundColor: "#1a1f2e" }}>
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-full text-white shadow-lg" style={{ backgroundColor: OS_GREEN }}>
                  <StarFull className="w-3 h-3 fill-white" /> Most Popular
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-400 mb-1 mt-2">Full Throttle</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-5xl font-black text-white">$895</span>
                  <span className="text-base text-gray-400 font-medium">/year</span>
                </div>
                <p className="text-sm text-gray-400 mb-1">+ Revenue share (decreases as you grow)</p>
                <p className="text-sm font-bold mb-6" style={{ color: OS_GREEN }}>Revenue share as low as 7%</p>
              </div>
              <ul className="space-y-3 mb-6 flex-1">
                {[
                  "Everything in Half Throttle",
                  "White-labeled OutdoorShare website",
                  "Build your own brand",
                  "Custom branded booking page",
                  "AI assistants included",
                  "Tiered revenue share — as low as 7%",
                  "Custom scheduling",
                  "In-person setup support",
                ].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-200">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: OS_GREEN }} />
                    {f}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 italic mb-5">Typically pays for itself with 2–3 bookings.</p>
              <Link href="/signup">
                <Button className="w-full font-bold text-white hover:opacity-90" style={{ backgroundColor: OS_GREEN }}>
                  Get Started
                </Button>
              </Link>
            </div>

            {/* Growth & Scale */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200 flex flex-col">
              <div>
                <p className="text-sm font-semibold text-gray-500 mb-1">Growth &amp; Scale</p>
                <div className="mb-1">
                  <span className="text-5xl font-black text-gray-900">Custom</span>
                </div>
                <p className="text-sm text-muted-foreground mb-6">Schedule a free consultation for your business</p>
              </div>
              <ul className="space-y-3 mb-6 flex-1">
                {[
                  "Everything in Full Throttle",
                  "Marketing partnership included",
                  "Manage renter relationships",
                  "Social media post management",
                  "Marketing funnels & automations",
                  "AI agents & resources",
                  "Email & text campaigns",
                  "Reputation management",
                  "Tracking & analytics",
                  "Ad management",
                ].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: OS_GREEN }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup">
                <Button variant="outline" className="w-full font-bold border-gray-300 hover:border-gray-400">
                  Schedule a Consultation
                </Button>
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* Tiered Revenue Share */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="rounded-2xl p-8 md:p-10" style={{ backgroundColor: "#1a1f2e" }}>
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-3">
                <TrendingDown className="w-5 h-5" style={{ color: OS_GREEN }} />
                <h3 className="text-2xl font-black text-white">Tiered Revenue Share</h3>
              </div>
              <p className="text-gray-400 text-sm max-w-md mx-auto">
                Your commission rate decreases automatically as your revenue grows — no renegotiating required.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {revenueTiers.map(tier => (
                <div
                  key={tier.rate}
                  className="rounded-xl p-5 text-center"
                  style={tier.best
                    ? { backgroundColor: "#1e3a1f", border: `1px solid ${OS_GREEN}50` }
                    : { backgroundColor: "#232936" }
                  }
                >
                  <div className="text-3xl font-black mb-1" style={{ color: tier.best ? OS_GREEN : "white" }}>
                    {tier.rate}
                  </div>
                  <div className="text-xs text-gray-400 mb-2">{tier.threshold}</div>
                  {tier.label && (
                    <div className="text-xs font-bold" style={{ color: OS_GREEN }}>{tier.label}</div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-gray-500 mt-6">
              Tiered revenue share applies to Half Throttle and Full Throttle plans. Not applicable on the Growth &amp; Scale plan.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black text-gray-900 mb-4">Loved by rental businesses</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map(t => (
            <div key={t.name} className="p-6 rounded-2xl border bg-white">
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-gray-700 text-sm leading-relaxed mb-4">"{t.text}"</p>
              <div>
                <div className="font-semibold text-sm text-gray-900">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.company}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center text-white" style={{ background: `linear-gradient(135deg, #1a6b2e 0%, ${OS_GREEN} 60%, ${OS_BLUE} 100%)` }}>
        <div className="max-w-2xl mx-auto px-6">
          <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="w-16 h-16 object-contain mx-auto mb-6 drop-shadow-lg" />
          <h2 className="text-4xl font-black mb-4">Your branded rental site, ready today</h2>
          <p className="text-white/80 text-lg mb-8">
            Sign up in 2 minutes. We'll walk you through setting up your listings, branding, and going live.
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-white font-bold px-10 gap-2 hover:bg-white/90" style={{ color: OS_GREEN_DARK }}>
              Create My Rental Site <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="w-5 h-5 object-contain" />
            <span className="font-black text-foreground tracking-tight">OutdoorShare</span>
          </div>
          <div>© {new Date().getFullYear()} OutdoorShare. All rights reserved.</div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <Link href="/superadmin" className="hover:text-foreground">Platform Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
