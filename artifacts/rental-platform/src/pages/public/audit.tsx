import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, CheckCircle2, ClipboardList, ShieldCheck,
  TrendingUp, Phone, Mail, Star,
} from "lucide-react";

const OS_GREEN = "#3ab549";
const OS_GREEN_DARK = "#2e9a3d";

const EQUIPMENT_OPTIONS = [
  "ATVs / UTVs", "Jet Skis", "Boats", "E-Bikes", "Snowmobiles",
  "Campers / RVs", "Trailers", "Dirt Bikes", "Other",
];

const PAIN_POINTS = [
  "Managing bookings manually",
  "No online presence / storefront",
  "Hard to collect payments online",
  "No digital rental agreements",
  "Customer communication is slow",
  "No damage protection / insurance",
  "Difficult to track fleet availability",
  "No reporting or analytics",
];

const MONTHLY_BOOKINGS = [
  "1–10 bookings/month",
  "11–30 bookings/month",
  "31–75 bookings/month",
  "76–150 bookings/month",
  "150+ bookings/month",
];

const ANNUAL_REVENUE = [
  "Under $25,000",
  "$25,000 – $75,000",
  "$75,000 – $150,000",
  "$150,000 – $300,000",
  "$300,000+",
];

const AUDIT_BENEFITS = [
  { icon: ClipboardList, title: "Full business review", desc: "We evaluate your current operations, online presence, and booking process." },
  { icon: TrendingUp, title: "Growth opportunities", desc: "Identify where you're leaving money on the table and how to capture it." },
  { icon: ShieldCheck, title: "Protection plan fit", desc: "See how built-in protection coverage could reduce your liability exposure." },
];

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-sm px-3 py-1.5 rounded-full border font-medium transition-all ${
        active
          ? "text-white border-transparent"
          : "bg-white border-gray-200 text-gray-700 hover:border-green-300"
      }`}
      style={active ? { backgroundColor: OS_GREEN, borderColor: OS_GREEN } : {}}
    >
      {label}
    </button>
  );
}

export default function AuditPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    businessName: "",
    website: "",
    currentSoftware: "",
    message: "",
    monthlyBookings: "",
    annualRevenue: "",
  });
  const [equipmentTypes, setEquipmentTypes] = useState<string[]>([]);
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function toggleEquipment(v: string) {
    setEquipmentTypes(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }

  function togglePain(v: string) {
    setPainPoints(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name || !form.email || !form.businessName) {
      setError("Please fill in your name, email, and business name.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, equipmentTypes, painPoints }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: `${OS_GREEN}20` }}>
          <CheckCircle2 className="w-9 h-9" style={{ color: OS_GREEN }} />
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-3">Request received!</h1>
        <p className="text-lg text-muted-foreground max-w-md mb-3">
          We'll review your business details and reach out within <strong>1 business day</strong> to schedule your free audit.
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          Check your inbox — we sent a confirmation to <strong>{form.email}</strong>.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/signup">
            <Button style={{ backgroundColor: OS_GREEN }} className="text-white font-bold rounded-full px-8 hover:opacity-90">
              Start Free Trial <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" className="rounded-full px-6">Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b bg-white/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer">
              <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="w-8 h-8 object-contain" />
              <span className="font-black text-lg tracking-tight text-gray-900">OutdoorShare</span>
            </div>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <a href="tel:8016530765" className="hidden sm:flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <Phone className="w-3.5 h-3.5" />801-653-0765
            </a>
            <Link href="/signup">
              <Button size="sm" style={{ backgroundColor: OS_GREEN }} className="text-white font-semibold hover:opacity-90">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-10 grid md:grid-cols-2 gap-12 items-start">
        <div>
          <Badge className="mb-5 border-0 px-4 py-1.5 text-sm font-semibold" style={{ backgroundColor: `${OS_GREEN}15`, color: OS_GREEN_DARK }}>
            100% Free — No Obligation
          </Badge>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-gray-900 leading-tight mb-5">
            Free rental<br />business audit
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            Tell us about your rental operation and we'll show you exactly how OutdoorShare can help you grow — more bookings, less manual work, and built-in protection on every rental.
          </p>

          {/* Benefits */}
          <div className="space-y-5 mb-8">
            {AUDIT_BENEFITS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${OS_GREEN}15` }}>
                  <Icon className="w-4.5 h-4.5" style={{ color: OS_GREEN }} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900">{title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div className="p-5 rounded-2xl border border-gray-100 bg-gray-50">
            <div className="flex gap-0.5 mb-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-sm text-gray-700 leading-relaxed italic mb-3">
              "Set up our entire booking system in one afternoon. Bookings went up 40% in the first month."
            </p>
            <div>
              <p className="font-semibold text-sm text-gray-900">Jake Winters</p>
              <p className="text-xs text-muted-foreground">Summit Rentals</p>
            </div>
          </div>

          {/* Contact */}
          <div className="flex flex-wrap gap-4 mt-6 text-sm text-muted-foreground">
            <a href="tel:8016530765" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <Phone className="w-3.5 h-3.5" />801-653-0765
            </a>
            <a href="mailto:contact.us@myoutdoorshare.com" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <Mail className="w-3.5 h-3.5" />contact.us@myoutdoorshare.com
            </a>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-7 shadow-sm space-y-6">
          <div>
            <p className="font-black text-lg text-gray-900 mb-1">Tell us about your business</p>
            <p className="text-sm text-muted-foreground">Takes about 3 minutes. We'll do the rest.</p>
          </div>

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Your name *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jake Winters" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Business name *</label>
              <Input value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} placeholder="Summit Rentals" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Email *</label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jake@summitrental.com" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Phone</label>
              <Input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(801) 555-0000" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Website (if any)</label>
              <Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="summitrentals.com" />
            </div>
          </div>

          {/* Equipment */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-2 block">What do you rent? (select all that apply)</label>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map(v => (
                <ToggleChip key={v} label={v} active={equipmentTypes.includes(v)} onClick={() => toggleEquipment(v)} />
              ))}
            </div>
          </div>

          {/* Bookings + Revenue */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Monthly bookings</label>
              <select
                className="w-full border border-gray-200 rounded-md text-sm px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-200"
                value={form.monthlyBookings}
                onChange={e => setForm(f => ({ ...f, monthlyBookings: e.target.value }))}
              >
                <option value="">Select range</option>
                {MONTHLY_BOOKINGS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Annual revenue</label>
              <select
                className="w-full border border-gray-200 rounded-md text-sm px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-200"
                value={form.annualRevenue}
                onChange={e => setForm(f => ({ ...f, annualRevenue: e.target.value }))}
              >
                <option value="">Select range</option>
                {ANNUAL_REVENUE.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Pain points */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-2 block">What's your biggest challenge right now?</label>
            <div className="flex flex-wrap gap-2">
              {PAIN_POINTS.map(v => (
                <ToggleChip key={v} label={v} active={painPoints.includes(v)} onClick={() => togglePain(v)} />
              ))}
            </div>
          </div>

          {/* Current software */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Current booking software (if any)</label>
            <Input value={form.currentSoftware} onChange={e => setForm(f => ({ ...f, currentSoftware: e.target.value }))} placeholder="e.g. FareHarbor, spreadsheet, nothing yet" />
          </div>

          {/* Message */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Anything else we should know?</label>
            <textarea
              rows={3}
              className="w-full border border-gray-200 rounded-md text-sm px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-200 resize-none"
              placeholder="Tell us more about your goals, timeline, or specific questions…"
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            />
          </div>

          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

          <Button
            type="submit"
            disabled={submitting}
            size="lg"
            className="w-full font-bold text-white hover:opacity-90 rounded-full"
            style={{ backgroundColor: OS_GREEN }}
          >
            {submitting ? "Submitting…" : "Request My Free Audit"}
            {!submitting && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            No credit card. No obligation. We'll be in touch within 1 business day.
          </p>
        </form>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-8 mt-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="w-5 h-5 object-contain" />
            <span className="font-black text-foreground tracking-tight">OutdoorShare</span>
          </div>
          <div>© {new Date().getFullYear()} OutdoorShare. All rights reserved.</div>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <Link href="/signup" className="hover:text-foreground">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
