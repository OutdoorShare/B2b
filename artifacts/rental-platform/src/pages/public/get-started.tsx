import { Link } from "wouter";
import {
  CalendarDays, BarChart3, Users, Package, Shield, Zap,
  CheckCircle2, ArrowRight, Star, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

const plans = [
  {
    name: "Starter",
    price: 49,
    period: "month",
    description: "Perfect for small rental businesses just getting started.",
    features: ["Up to 10 listings", "Booking management", "Customer storefront", "Analytics dashboard", "Email support"],
    cta: "Start Free Trial",
    highlighted: false,
    badge: null,
  },
  {
    name: "Professional",
    price: 99,
    period: "month",
    description: "For growing businesses that need more power and flexibility.",
    features: ["Up to 50 listings", "Everything in Starter", "Team members (5 seats)", "Custom branding & colors", "Claims management", "Priority support"],
    cta: "Get Started",
    highlighted: true,
    badge: "Most Popular",
  },
  {
    name: "Enterprise",
    price: 249,
    period: "month",
    description: "Full-featured for large fleets and multi-location operations.",
    features: ["Unlimited listings", "Everything in Professional", "Unlimited team seats", "Kiosk mode", "API access", "Dedicated account manager"],
    cta: "Contact Sales",
    highlighted: false,
    badge: null,
  },
];

const testimonials = [
  { name: "Jake Winters", company: "Summit Gear Rentals", text: "Set up our entire booking system in one afternoon. Bookings went up 40% in the first month.", stars: 5 },
  { name: "Maria Chen", company: "Coastal Watersports", text: "The kiosk mode alone saved us 2 hours of staff time per day. Our customers love it.", stars: 5 },
  { name: "Derek Park", company: "Trail Wheels MTB", text: "Finally a platform built for rental companies, not adapted from something else.", stars: 5 },
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
            <Link href="/admin">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
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

      {/* Stats bar — deep green with logo-green highlights */}
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
              style={{ ["--tw-hover-border" as string]: `${OS_GREEN}50` }}
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
          <div className="grid md:grid-cols-3 gap-8 items-start">
            {plans.map(plan => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 ${plan.highlighted ? "text-white shadow-xl scale-105" : "bg-white border border-gray-200"}`}
                style={plan.highlighted ? { background: `linear-gradient(135deg, ${OS_GREEN} 0%, ${OS_GREEN_DARK} 100%)`, boxShadow: `0 20px 60px ${OS_GREEN}40` } : {}}
              >
                {plan.badge && (
                  <span className="inline-block bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full mb-4">
                    {plan.badge}
                  </span>
                )}
                <h3 className={`text-xl font-black mb-1 ${plan.highlighted ? "text-white" : "text-gray-900"}`}>
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className={`text-4xl font-black ${plan.highlighted ? "text-white" : "text-gray-900"}`}>
                    ${plan.price}
                  </span>
                  <span className={`text-sm ${plan.highlighted ? "text-white/70" : "text-muted-foreground"}`}>
                    /{plan.period}
                  </span>
                </div>
                <p className={`text-sm mb-6 ${plan.highlighted ? "text-white/80" : "text-muted-foreground"}`}>
                  {plan.description}
                </p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <CheckCircle2
                        className="w-4 h-4 shrink-0"
                        style={{ color: plan.highlighted ? "rgba(255,255,255,0.9)" : OS_GREEN }}
                      />
                      <span className={plan.highlighted ? "text-white/90" : "text-gray-700"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href={plan.name === "Enterprise" ? "/contact" : "/signup"}>
                  <Button
                    className="w-full font-bold"
                    style={plan.highlighted
                      ? { backgroundColor: "white", color: OS_GREEN_DARK }
                      : { backgroundColor: OS_GREEN, color: "white" }}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
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
