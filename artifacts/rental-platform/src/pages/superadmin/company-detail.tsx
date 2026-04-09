import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, Building2, Package, CalendarDays, Settings2,
  Plus, Edit2, Trash2, Save, X, CheckCircle2, XCircle,
  AlertTriangle, Eye, EyeOff, ExternalLink, RefreshCcw,
  Globe, Phone, Mail, MapPin, Palette, BarChart3, ShieldAlert,
  TrendingUp, DollarSign, AlertCircle, Clock
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function getToken() { return localStorage.getItem("superadmin_token") ?? ""; }
async function sa(path: string, opts?: RequestInit) {
  return fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-superadmin-token": getToken(), ...opts?.headers },
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────
type Tenant = { id: number; name: string; slug: string; email: string; plan: string; status: string; maxListings: number; contactName?: string; phone?: string; notes?: string; createdAt: string; listingCount: number; bookingCount: number; platformFeePercent?: string | null; testMode?: boolean; trialEndsAt?: string | null; ghlLocationId?: string | null };
type BizProfile = { name: string; tagline: string; description: string; logoUrl?: string; primaryColor: string; accentColor: string; email: string; phone: string; website?: string; location: string; address?: string; city?: string; state?: string; zipCode?: string; socialInstagram?: string; socialFacebook?: string; depositRequired: boolean; depositPercent: number; cancellationPolicy: string; rentalTerms?: string };
type Listing = { id: number; title: string; description: string; pricePerDay: number; pricePerWeek?: number | null; quantity: number; status: string; brand?: string; model?: string; condition?: string; location?: string; requirements?: string; depositAmount?: number | null; createdAt: string };
type Booking = { id: number; customerName: string; customerEmail: string; startDate: string; endDate: string; quantity: number; totalPrice: number; status: string; source: string; adminNotes?: string; createdAt: string; listingId: number };

const OS_GREEN = "#3ab549";
const PLAN_COLORS: Record<string, string> = { starter: "bg-slate-700 text-slate-200", professional: "bg-blue-900/60 text-blue-300", enterprise: "bg-emerald-900/60 text-emerald-300" };
const STATUS_COLORS: Record<string, string> = { active: "bg-green-900/50 text-green-300", inactive: "bg-slate-700 text-slate-400", suspended: "bg-red-900/50 text-red-300" };
const BOOKING_COLORS: Record<string, string> = { pending: "bg-amber-900/50 text-amber-300", confirmed: "bg-blue-900/50 text-blue-300", active: "bg-green-900/50 text-green-300", completed: "bg-slate-700 text-slate-300", cancelled: "bg-red-900/50 text-red-300" };

// ─── Account Tab ─────────────────────────────────────────────────────────────
function AccountTab({ tenant, tenantId, onSaved }: { tenant: Tenant; tenantId: number; onSaved: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ name: tenant.name, email: tenant.email, plan: tenant.plan, status: tenant.status, maxListings: String(tenant.maxListings), contactName: tenant.contactName ?? "", phone: tenant.phone ?? "", notes: tenant.notes ?? "", password: "", platformFeePercent: tenant.platformFeePercent != null ? String(tenant.platformFeePercent) : "5.00", testMode: !!tenant.testMode, trialEndsAt: tenant.trialEndsAt ?? null });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const fee = parseFloat(form.platformFeePercent);
      if (isNaN(fee) || fee < 0 || fee > 100) {
        toast({ title: "Platform fee must be between 0% and 100%", variant: "destructive" });
        setSaving(false);
        return;
      }
      const body: any = { name: form.name, email: form.email, plan: form.plan, status: form.status, maxListings: parseInt(form.maxListings), contactName: form.contactName || null, phone: form.phone || null, notes: form.notes || null, platformFeePercent: form.platformFeePercent, testMode: form.testMode, trialEndsAt: form.trialEndsAt };
      if (form.password) body.password = form.password;
      const res = await sa(`/superadmin/tenants/${tenantId}`, { method: "PUT", body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); toast({ title: d.error ?? "Save failed", variant: "destructive" }); return; }
      toast({ title: "Account saved" });
      setForm(f => ({ ...f, password: "" }));
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-slate-300 text-xs">Company Name</Label>
          <Input value={form.name} onChange={e => set("name", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-xs">URL Slug <span className="text-slate-500 font-normal">(permanent)</span></Label>
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-slate-900 border border-slate-700 font-mono text-sm text-slate-400 select-all cursor-default">
            <span className="text-slate-600">/</span>{tenant.slug}
            <span className="ml-auto text-xs text-slate-600 font-sans">locked</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-xs">Plan</Label>
          <Select value={form.plan} onValueChange={v => set("plan", v)}>
            <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-white">
              {["starter","professional","enterprise"].map(p => <SelectItem key={p} value={p} className="capitalize focus:bg-slate-700">{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label className="text-slate-300 text-xs">Admin Email</Label>
          <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-xs">New Password <span className="text-slate-500">(leave blank to keep)</span></Label>
          <div className="relative">
            <Input type={showPw ? "text" : "password"} value={form.password} onChange={e => set("password", e.target.value)} placeholder="New password…" className="bg-slate-800 border-slate-600 text-white pr-9" />
            <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">{showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-xs">Status</Label>
          <Select value={form.status} onValueChange={v => set("status", v)}>
            <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-white">
              {["active","inactive","suspended"].map(s => <SelectItem key={s} value={s} className="capitalize focus:bg-slate-700">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-xs">Contact Name</Label>
          <Input value={form.contactName} onChange={e => set("contactName", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-xs">Phone</Label>
          <Input value={form.phone} onChange={e => set("phone", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-xs">Max Listings</Label>
          <Input type="number" min="1" value={form.maxListings} onChange={e => set("maxListings", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-xs">Platform Fee %</Label>
          <div className="relative">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.platformFeePercent}
              onChange={e => set("platformFeePercent", e.target.value)}
              className="bg-slate-800 border-slate-600 text-white pr-8"
              placeholder="5.00"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none">%</span>
          </div>
          <p className="text-xs text-slate-500">Kept by the platform; remainder paid to the owner</p>
        </div>
        <div className="col-span-2">
          <div className="flex items-center justify-between bg-amber-950/30 border border-amber-700/40 rounded-lg px-4 py-3">
            <div>
              <p className="text-sm font-medium text-amber-300">Test Mode</p>
              <p className="text-xs text-amber-600 mt-0.5">When on, bookings use Stripe test keys — no real money is charged. Show test card 4242 4242 4242 4242 to renters.</p>
            </div>
            <Switch
              checked={form.testMode}
              onCheckedChange={v => setForm(f => ({ ...f, testMode: v }))}
              className="data-[state=checked]:bg-amber-500"
            />
          </div>
        </div>
        {/* Trial Period */}
        <div className="col-span-2">
          <div className={`flex items-center justify-between rounded-lg px-4 py-3 border ${form.trialEndsAt ? "bg-violet-950/30 border-violet-700/40" : "bg-slate-800/50 border-slate-700/50"}`}>
            <div>
              <p className="text-sm font-medium text-slate-200">Trial Period</p>
              {form.trialEndsAt ? (
                <p className="text-xs text-violet-400 mt-0.5">
                  Expires {format(new Date(form.trialEndsAt), "MMM d, yyyy")}
                  {new Date(form.trialEndsAt) < new Date() && <span className="text-red-400 ml-1">(expired)</span>}
                </p>
              ) : (
                <p className="text-xs text-slate-500 mt-0.5">No trial — permanent access</p>
              )}
            </div>
            {form.trialEndsAt ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setForm(f => ({ ...f, trialEndsAt: null }))}
                className="border-violet-600 text-violet-300 hover:bg-violet-900/40 text-xs"
              >
                Make Permanent
              </Button>
            ) : (
              <span className="text-xs text-green-400 font-medium">Permanent ✓</span>
            )}
          </div>
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label className="text-slate-300 text-xs">Internal Notes</Label>
          <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="bg-slate-800 border-slate-600 text-white resize-none" />
        </div>
      </div>

      {/* GHL Sub-Account Status */}
      <GHLProvisionPanel tenant={tenant} tenantId={tenantId} onSaved={onSaved} />

      <Button onClick={save} disabled={saving} className="text-white gap-1.5" style={{ backgroundColor: "#3ab549" }} >
        <Save className="w-4 h-4" />{saving ? "Saving…" : "Save Account"}
      </Button>
    </div>
  );
}

// ─── GHL Provision Panel ─────────────────────────────────────────────────────
function GHLProvisionPanel({ tenant, tenantId, onSaved }: { tenant: Tenant; tenantId: number; onSaved: () => void }) {
  const { toast } = useToast();
  const [provisioning, setProvisioning] = useState(false);
  const isPaidPlan = tenant.plan === "professional" || tenant.plan === "enterprise";

  const provision = async () => {
    setProvisioning(true);
    try {
      const res = await sa(`/superadmin/tenants/${tenantId}/provision-ghl`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error ?? "GHL provisioning failed", variant: "destructive" });
      } else {
        toast({ title: "GHL sub-account created!", description: `Location ID: ${data.locationId}` });
        onSaved();
      }
    } finally { setProvisioning(false); }
  };

  return (
    <div className={`rounded-lg px-4 py-3 border ${tenant.ghlLocationId ? "bg-emerald-950/30 border-emerald-700/40" : isPaidPlan ? "bg-slate-800/50 border-slate-600/50" : "bg-slate-900/50 border-slate-700/30"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-200 mb-0.5">GoHighLevel Sub-Account</p>
          {tenant.ghlLocationId ? (
            <p className="text-xs text-emerald-400 font-mono">{tenant.ghlLocationId}</p>
          ) : isPaidPlan ? (
            <p className="text-xs text-slate-400">No sub-account yet — click to provision one in GHL</p>
          ) : (
            <p className="text-xs text-slate-500">Upgrade to Full Throttle or Growth &amp; Scale to enable GHL</p>
          )}
        </div>
        {isPaidPlan && (
          <Button
            size="sm"
            variant="outline"
            onClick={provision}
            disabled={provisioning}
            className={tenant.ghlLocationId ? "border-slate-600 text-slate-300 hover:bg-slate-700 text-xs" : "border-emerald-600 text-emerald-300 hover:bg-emerald-900/40 text-xs"}
          >
            {provisioning ? "Provisioning…" : tenant.ghlLocationId ? "Re-Provision" : "Provision GHL"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Business Profile Tab ─────────────────────────────────────────────────────
function StorefrontTab({ tenantId }: { tenantId: number }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<Partial<BizProfile>>({});
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    sa(`/superadmin/tenants/${tenantId}/business`).then(r => r.json()).then(d => { setF(d); setLoading(false); });
  }, [tenantId]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await sa(`/superadmin/tenants/${tenantId}/business`, { method: "PUT", body: JSON.stringify(f) });
      if (!res.ok) { toast({ title: "Save failed", variant: "destructive" }); return; }
      toast({ title: "Business profile saved" });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="text-slate-400 py-8">Loading…</div>;

  const field = (label: string, key: keyof BizProfile, type = "text", placeholder?: string) => (
    <div className="space-y-1.5">
      <Label className="text-slate-300 text-xs">{label}</Label>
      <Input type={type} value={(f[key] as string) ?? ""} onChange={e => set(key, e.target.value)} placeholder={placeholder} className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Identity */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Identity</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label className="text-slate-300 text-xs">Business Name</Label>
            <Input value={f.name ?? ""} onChange={e => set("name", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
          </div>
          {field("Tagline", "tagline", "text", "Your next adventure starts here")}
          {field("Website", "website", "url", "https://")}
          <div className="col-span-2 space-y-1.5">
            <Label className="text-slate-300 text-xs">Description</Label>
            <Textarea value={f.description ?? ""} onChange={e => set("description", e.target.value)} rows={3} className="bg-slate-800 border-slate-600 text-white resize-none" />
          </div>
          {field("Logo URL", "logoUrl", "url", "https://...")}
        </div>
      </div>

      <Separator className="bg-slate-800" />

      {/* Branding */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5"><Palette className="w-3 h-3" />Branding</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Primary Color</Label>
            <div className="flex gap-2">
              <input type="color" value={f.primaryColor ?? "#2d6a4f"} onChange={e => set("primaryColor", e.target.value)} className="w-10 h-10 rounded border border-slate-600 bg-slate-800 p-0.5 cursor-pointer" />
              <Input value={f.primaryColor ?? ""} onChange={e => set("primaryColor", e.target.value)} className="bg-slate-800 border-slate-600 text-white font-mono" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Accent Color</Label>
            <div className="flex gap-2">
              <input type="color" value={f.accentColor ?? "#52b788"} onChange={e => set("accentColor", e.target.value)} className="w-10 h-10 rounded border border-slate-600 bg-slate-800 p-0.5 cursor-pointer" />
              <Input value={f.accentColor ?? ""} onChange={e => set("accentColor", e.target.value)} className="bg-slate-800 border-slate-600 text-white font-mono" />
            </div>
          </div>
        </div>
      </div>

      <Separator className="bg-slate-800" />

      {/* Contact */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5"><Mail className="w-3 h-3" />Contact</p>
        <div className="grid grid-cols-2 gap-4">
          {field("Contact Email", "email", "email")}
          {field("Phone", "phone", "tel")}
          {field("Location Display", "location", "text", "Denver, CO")}
          {field("Street Address", "address")}
          {field("City", "city")}
          {field("State", "state")}
          {field("Zip", "zipCode")}
        </div>
      </div>

      <Separator className="bg-slate-800" />

      {/* Social */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5"><Globe className="w-3 h-3" />Social Media</p>
        <div className="grid grid-cols-2 gap-4">
          {field("Instagram", "socialInstagram", "text", "@handle")}
          {field("Facebook", "socialFacebook", "text", "fb.com/page")}
        </div>
      </div>

      <Separator className="bg-slate-800" />

      {/* Policies */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Policies</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Deposit %</Label>
            <Input type="number" min="0" max="100" value={f.depositPercent ?? ""} onChange={e => set("depositPercent", parseFloat(e.target.value))} className="bg-slate-800 border-slate-600 text-white" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-slate-300 text-xs">Cancellation Policy</Label>
            <Textarea value={f.cancellationPolicy ?? ""} onChange={e => set("cancellationPolicy", e.target.value)} rows={2} className="bg-slate-800 border-slate-600 text-white resize-none" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-slate-300 text-xs">Rental Terms</Label>
            <Textarea value={f.rentalTerms ?? ""} onChange={e => set("rentalTerms", e.target.value)} rows={3} className="bg-slate-800 border-slate-600 text-white resize-none" />
          </div>
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="text-white gap-1.5" style={{ backgroundColor: "#3ab549" }} >
        <Save className="w-4 h-4" />{saving ? "Saving…" : "Save Storefront Settings"}
      </Button>
    </div>
  );
}

// ─── Listings Tab ─────────────────────────────────────────────────────────────
const emptyListing = { title: "", description: "", pricePerDay: "", pricePerWeek: "", quantity: "1", status: "active", brand: "", model: "", condition: "", location: "", requirements: "", depositAmount: "" };

function ListingsTab({ tenantId }: { tenantId: number }) {
  const { toast } = useToast();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editListing, setEditListing] = useState<Listing | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyListing });
  const [saving, setSaving] = useState(false);
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    const r = await sa(`/superadmin/tenants/${tenantId}/listings`);
    setListings(await r.json());
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditListing(null); setForm({ ...emptyListing }); setShowForm(true); };
  const openEdit = (l: Listing) => {
    setEditListing(l);
    setForm({ title: l.title, description: l.description ?? "", pricePerDay: String(l.pricePerDay), pricePerWeek: l.pricePerWeek ? String(l.pricePerWeek) : "", quantity: String(l.quantity), status: l.status, brand: l.brand ?? "", model: l.model ?? "", condition: l.condition ?? "", location: l.location ?? "", requirements: l.requirements ?? "", depositAmount: l.depositAmount ? String(l.depositAmount) : "" });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.title || !form.pricePerDay) { toast({ title: "Title and price required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const body = { title: form.title, description: form.description, pricePerDay: parseFloat(form.pricePerDay), pricePerWeek: form.pricePerWeek ? parseFloat(form.pricePerWeek) : null, quantity: parseInt(form.quantity) || 1, status: form.status, brand: form.brand || null, model: form.model || null, condition: form.condition || null, location: form.location || null, requirements: form.requirements || null, depositAmount: form.depositAmount ? parseFloat(form.depositAmount) : null };
      const res = editListing
        ? await sa(`/superadmin/tenants/${tenantId}/listings/${editListing.id}`, { method: "PUT", body: JSON.stringify(body) })
        : await sa(`/superadmin/tenants/${tenantId}/listings`, { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); toast({ title: d.error ?? "Save failed", variant: "destructive" }); return; }
      toast({ title: editListing ? "Listing updated" : "Listing created" });
      setShowForm(false);
      load();
    } finally { setSaving(false); }
  };

  const deleteListing = async () => {
    if (!deleteId) return;
    await sa(`/superadmin/tenants/${tenantId}/listings/${deleteId}`, { method: "DELETE" });
    toast({ title: "Listing deleted" });
    setDeleteId(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">{listings.length} listings</p>
        <Button onClick={openCreate} size="sm" className="text-white gap-1.5 hover:opacity-85" style={{ backgroundColor: "#3ab549" }}><Plus className="w-4 h-4" />New Listing</Button>
      </div>

      {loading ? <div className="text-slate-400 py-8">Loading…</div> : listings.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <Package className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-semibold">No listings yet</p>
          <Button onClick={openCreate} size="sm" className="mt-4 text-white gap-1.5 hover:opacity-85" style={{ backgroundColor: "#3ab549" }}><Plus className="w-4 h-4" />Create First Listing</Button>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800"><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Title</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Price/Day</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Qty</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th></tr></thead>
            <tbody>
              {listings.map(l => (
                <tr key={l.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 group">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{l.title}</p>
                    {l.brand && <p className="text-xs text-slate-500">{l.brand}{l.model ? ` — ${l.model}` : ""}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-300">${l.pricePerDay.toFixed(2)}</td>
                  <td className="px-4 py-3 text-slate-300">{l.quantity}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${l.status === "active" ? "bg-green-900/50 text-green-300" : "bg-slate-700 text-slate-400"}`}>{l.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(l)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleteId(l.id)} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-700"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Listing Form Dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) setShowForm(false); }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-white">{editListing ? "Edit Listing" : "New Listing"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label className="text-slate-300 text-xs">Title *</Label><Input value={form.title} onChange={e => setF("title", e.target.value)} className="bg-slate-800 border-slate-600 text-white" /></div>
            <div className="space-y-1.5"><Label className="text-slate-300 text-xs">Description</Label><Textarea value={form.description} onChange={e => setF("description", e.target.value)} rows={2} className="bg-slate-800 border-slate-600 text-white resize-none" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-slate-300 text-xs">Price / Day *</Label><Input type="number" min="0" step="0.01" value={form.pricePerDay} onChange={e => setF("pricePerDay", e.target.value)} className="bg-slate-800 border-slate-600 text-white" /></div>
              <div className="space-y-1.5"><Label className="text-slate-300 text-xs">Price / Week</Label><Input type="number" min="0" step="0.01" value={form.pricePerWeek} onChange={e => setF("pricePerWeek", e.target.value)} className="bg-slate-800 border-slate-600 text-white" /></div>
              <div className="space-y-1.5"><Label className="text-slate-300 text-xs">Quantity</Label><Input type="number" min="1" value={form.quantity} onChange={e => setF("quantity", e.target.value)} className="bg-slate-800 border-slate-600 text-white" /></div>
              <div className="space-y-1.5"><Label className="text-slate-300 text-xs">Deposit Amount</Label><Input type="number" min="0" step="0.01" value={form.depositAmount} onChange={e => setF("depositAmount", e.target.value)} className="bg-slate-800 border-slate-600 text-white" /></div>
              <div className="space-y-1.5"><Label className="text-slate-300 text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setF("status", v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">{["active","inactive","draft"].map(s => <SelectItem key={s} value={s} className="capitalize focus:bg-slate-700">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-slate-300 text-xs">Condition</Label>
                <Select value={form.condition || "_none"} onValueChange={v => setF("condition", v === "_none" ? "" : v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white"><SelectItem value="_none" className="focus:bg-slate-700">— None —</SelectItem>{["excellent","good","fair"].map(c => <SelectItem key={c} value={c} className="capitalize focus:bg-slate-700">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-slate-300 text-xs">Brand</Label><Input value={form.brand} onChange={e => setF("brand", e.target.value)} className="bg-slate-800 border-slate-600 text-white" /></div>
              <div className="space-y-1.5"><Label className="text-slate-300 text-xs">Model</Label><Input value={form.model} onChange={e => setF("model", e.target.value)} className="bg-slate-800 border-slate-600 text-white" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-slate-300 text-xs">Location</Label><Input value={form.location} onChange={e => setF("location", e.target.value)} className="bg-slate-800 border-slate-600 text-white" /></div>
            <div className="space-y-1.5"><Label className="text-slate-300 text-xs">Requirements</Label><Textarea value={form.requirements} onChange={e => setF("requirements", e.target.value)} rows={2} className="bg-slate-800 border-slate-600 text-white resize-none" /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white hover:bg-slate-800">Cancel</Button>
            <Button onClick={save} disabled={saving} className="text-white hover:opacity-90" style={{ backgroundColor: "#3ab549" }}>{saving ? "Saving…" : editListing ? "Save Changes" : "Create Listing"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
          <AlertDialogHeader><AlertDialogTitle className="text-white flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-400" />Delete Listing</AlertDialogTitle><AlertDialogDescription className="text-slate-400">This listing will be permanently deleted.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300">Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteListing} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Bookings Tab ─────────────────────────────────────────────────────────────
function BookingsTab({ tenantId }: { tenantId: number }) {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);
  type SAVerifData = { found: boolean; identityVerificationStatus?: string; identityVerificationSessionId?: string | null; identityVerifiedAt?: string | null };
  const [verifData, setVerifData] = useState<SAVerifData | null>(null);
  const [bizPolicy, setBizPolicy] = useState<{ cancellationPolicy?: string; rentalTerms?: string } | null>(null);

  useEffect(() => {
    sa(`/superadmin/tenants/${tenantId}/business`)
      .then(r => r.json())
      .then(d => setBizPolicy({ cancellationPolicy: d.cancellationPolicy, rentalTerms: d.rentalTerms }))
      .catch(() => {});
  }, [tenantId]);

  const load = useCallback(async () => {
    const r = await sa(`/superadmin/tenants/${tenantId}/bookings?limit=100`);
    setBookings(await r.json());
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const openBooking = (b: Booking) => {
    setSelectedBooking(b);
    setNewStatus(b.status);
    setAdminNotes(b.adminNotes ?? "");
    setVerifData(null);
    sa(`/superadmin/customers/lookup?email=${encodeURIComponent(b.customerEmail)}`)
      .then(r => r.json())
      .then(d => setVerifData(d))
      .catch(() => {});
  };

  const saveBooking = async () => {
    if (!selectedBooking) return;
    setSaving(true);
    try {
      const res = await sa(`/superadmin/tenants/${tenantId}/bookings/${selectedBooking.id}`, { method: "PUT", body: JSON.stringify({ status: newStatus, adminNotes }) });
      if (!res.ok) { toast({ title: "Update failed", variant: "destructive" }); return; }
      toast({ title: "Booking updated" });
      setSelectedBooking(null);
      load();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">{bookings.length} bookings</p>
        <Button variant="ghost" size="sm" onClick={load} className="text-slate-400 hover:text-white hover:bg-slate-800"><RefreshCcw className="w-3.5 h-3.5" /></Button>
      </div>

      {loading ? <div className="text-slate-400 py-8">Loading…</div> : bookings.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <CalendarDays className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-semibold">No bookings yet</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800"><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Customer</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Dates</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Total</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Source</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th></tr></thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 group">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{b.customerName}</p>
                    <p className="text-xs text-slate-500">{b.customerEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{b.startDate} → {b.endDate}</td>
                  <td className="px-4 py-3 text-slate-300">${b.totalPrice.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${BOOKING_COLORS[b.status] ?? "bg-slate-700 text-slate-300"}`}>{b.status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs capitalize">{b.source}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => openBooking(b)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Booking Edit Dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={v => { if (!v) setSelectedBooking(null); }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader><DialogTitle className="text-white">Edit Booking #{selectedBooking?.id}</DialogTitle></DialogHeader>
          {selectedBooking && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-800 rounded-lg p-3 text-sm space-y-1">
                <p className="text-white font-medium">{selectedBooking.customerName}</p>
                <p className="text-slate-400">{selectedBooking.customerEmail}</p>
                <p className="text-slate-400">{selectedBooking.startDate} → {selectedBooking.endDate}</p>
                <p className="text-white font-semibold">${selectedBooking.totalPrice.toFixed(2)}</p>
              </div>

              {/* Identity Verification */}
              {(() => {
                const status = verifData?.identityVerificationStatus ?? "unverified";
                const sessionId = verifData?.identityVerificationSessionId;
                const verifiedAt = verifData?.identityVerifiedAt;

                const styles: Record<string, { bg: string; border: string; label: string; dot: string }> = {
                  verified:   { bg: "bg-green-900/40",  border: "border-green-700",  label: "✓ Identity Verified",         dot: "bg-green-400" },
                  pending:    { bg: "bg-amber-900/40",  border: "border-amber-700",  label: "⏳ Verification Pending",      dot: "bg-amber-400" },
                  failed:     { bg: "bg-red-900/40",    border: "border-red-700",    label: "✗ Verification Failed",        dot: "bg-red-400" },
                  unverified: { bg: "bg-slate-800",     border: "border-slate-700",  label: "○ Not Verified",              dot: "bg-slate-500" },
                };
                const s = styles[status] ?? styles.unverified;

                return (
                  <div className={`rounded-lg border p-3 text-sm ${s.bg} ${s.border}`}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Identity Verification</p>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                      <span className="text-white font-medium">{s.label}</span>
                    </div>
                    {verifiedAt && (
                      <p className="text-xs text-green-400 mt-1 ml-4">
                        Verified {new Date(verifiedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    )}
                    {sessionId && (
                      <p className="text-xs text-slate-500 font-mono mt-1 ml-4 break-all">ID: {sessionId}</p>
                    )}
                    {verifData && !verifData.found && (
                      <p className="text-xs text-slate-500 mt-1 ml-4 italic">No customer account on file.</p>
                    )}
                  </div>
                );
              })()}
              {/* Cancellation policy — visible to super admin during booking review */}
              {bizPolicy && (
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs uppercase tracking-wide">Cancellation Policy</Label>
                  {bizPolicy.cancellationPolicy ? (
                    <div className="bg-amber-950/40 border border-amber-700/50 rounded-lg px-3 py-2">
                      <p className="text-amber-200 text-xs leading-relaxed whitespace-pre-wrap">{bizPolicy.cancellationPolicy}</p>
                    </div>
                  ) : (
                    <p className="text-slate-600 text-xs italic">No cancellation policy set.</p>
                  )}
                  {bizPolicy.rentalTerms && (
                    <details>
                      <summary className="text-slate-500 text-xs cursor-pointer hover:text-slate-400 select-none mt-1">View rental terms ›</summary>
                      <div className="mt-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2">
                        <p className="text-slate-400 text-xs leading-relaxed whitespace-pre-wrap">{bizPolicy.rentalTerms}</p>
                      </div>
                    </details>
                  )}
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">{["pending","confirmed","active","completed","cancelled"].map(s => <SelectItem key={s} value={s} className="capitalize focus:bg-slate-700">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Admin Notes</Label>
                <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={3} className="bg-slate-800 border-slate-600 text-white resize-none" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setSelectedBooking(null)} className="text-slate-400 hover:text-white hover:bg-slate-800">Cancel</Button>
            <Button onClick={saveBooking} disabled={saving} className="text-white hover:opacity-90" style={{ backgroundColor: "#3ab549" }}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────
const CAT_COLORS = ["#3ab549","#166534","#15803d","#16a34a","#22c55e","#4ade80"];
const STATUS_CHIP: Record<string, string> = { pending: "bg-amber-800 text-amber-200", confirmed: "bg-blue-800 text-blue-200", active: "bg-green-800 text-green-200", completed: "bg-slate-700 text-slate-300", cancelled: "bg-red-800 text-red-200" };

type TenantAnalytics = {
  totalRevenue: number; feesRetained: number; feePercent: number;
  totalBookings: number; statusBreakdown: Record<string, number>;
  revenueByMonth: { month: string; revenue: number; bookings: number }[];
  categoryBreakdown: { name: string; bookings: number; revenue: number }[];
  claimsCount: number; openClaims: number;
};

function AnalyticsTab({ tenantId }: { tenantId: number }) {
  const [data, setData] = useState<TenantAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await sa(`/superadmin/tenants/${tenantId}/analytics`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="text-slate-400 py-12 text-center">Loading analytics…</div>;
  if (!data)   return <div className="text-red-400 py-8">Failed to load analytics</div>;

  const summaryCards = [
    { icon: DollarSign, label: "Total Revenue",     value: `$${data.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20" },
    { icon: TrendingUp, label: "Fees Retained",     value: `$${data.feesRetained.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, note: `${data.feePercent}% platform fee`, color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20" },
    { icon: CalendarDays, label: "Total Bookings",  value: String(data.totalBookings),  color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
    { icon: ShieldAlert, label: "Open Claims",      value: String(data.openClaims),     color: data.openClaims > 0 ? "text-red-400" : "text-slate-400", bg: data.openClaims > 0 ? "bg-red-500/10 border-red-500/20" : "bg-slate-800 border-slate-700" },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map(c => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.bg}`}>
            <div className={`flex items-center gap-1.5 mb-2 ${c.color}`}>
              <c.icon className="w-4 h-4" />
              <span className="text-xs font-semibold">{c.label}</span>
            </div>
            <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
            {c.note && <p className="text-slate-500 text-[10px] mt-0.5">{c.note}</p>}
          </div>
        ))}
      </div>

      {/* Booking Status Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p className="text-slate-300 font-semibold text-sm mb-3">Booking Status Breakdown</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.statusBreakdown).map(([status, count]) => (
            <span key={status} className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${STATUS_CHIP[status] ?? "bg-slate-700 text-slate-300"}`}>
              {status}: {count}
            </span>
          ))}
          {Object.keys(data.statusBreakdown).length === 0 && <span className="text-slate-500 text-sm">No bookings yet</span>}
        </div>
      </div>

      {/* Revenue by Month chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p className="text-slate-300 font-semibold text-sm mb-4">Revenue — Last 12 Months</p>
        {data.revenueByMonth.every(m => m.revenue === 0) ? (
          <div className="h-40 flex items-center justify-center text-slate-600 text-sm">No revenue data yet</div>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueByMonth} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="saRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3ab549" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3ab549" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="month" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => v.substring(5)} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} width={55} />
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#94a3b8" }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3ab549" strokeWidth={2} fill="url(#saRevGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Category Breakdown */}
      {data.categoryBreakdown.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Bar chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-300 font-semibold text-sm mb-4">Revenue by Category</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.categoryBreakdown} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1e293b" />
                  <XAxis type="number" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                  <YAxis type="category" dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} width={90} />
                  <Tooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]}
                  />
                  <Bar dataKey="revenue" radius={[0, 3, 3, 0]} maxBarSize={20}>
                    {data.categoryBreakdown.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-300 font-semibold text-sm mb-3">Category Summary</p>
            <table className="w-full text-sm">
              <thead><tr className="text-slate-500 text-xs border-b border-slate-800">
                <th className="text-left py-2 font-medium">Category</th>
                <th className="text-right py-2 font-medium">Bookings</th>
                <th className="text-right py-2 font-medium">Revenue</th>
                <th className="text-right py-2 font-medium">Fee</th>
              </tr></thead>
              <tbody>
                {data.categoryBreakdown.map(c => (
                  <tr key={c.name} className="border-b border-slate-800/50 last:border-0">
                    <td className="py-2 text-slate-200">{c.name}</td>
                    <td className="py-2 text-right text-slate-400">{c.bookings}</td>
                    <td className="py-2 text-right text-slate-200">${c.revenue.toFixed(2)}</td>
                    <td className="py-2 text-right text-blue-400 text-xs">${(c.revenue * data.feePercent / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Claims Tab ───────────────────────────────────────────────────────────────
type ClaimRow = {
  id: number; customerName: string; customerEmail: string; type: string;
  status: string; claimedAmount: number | null; settledAmount: number | null;
  adminNotes: string | null; description: string; createdAt: string;
  chargeMode: string | null; chargeStatus: string | null; chargedAmount: number | null;
};
const CLAIM_STATUS: Record<string, string> = { open: "bg-red-800 text-red-200", reviewing: "bg-yellow-800 text-yellow-200", resolved: "bg-green-800 text-green-200", denied: "bg-slate-700 text-slate-400" };
const CHARGE_STATUS_CHIP: Record<string, string> = { pending: "bg-amber-800 text-amber-200", paid: "bg-green-800 text-green-200", cancelled: "bg-slate-700 text-slate-400" };

type ChargeMode = "link" | "invoice" | "installments";

function ClaimsTab({ tenantId }: { tenantId: number }) {
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit dialog state
  const [selected, setSelected] = useState<ClaimRow | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSettled, setEditSettled] = useState("");
  const [saving, setSaving] = useState(false);

  // Charge dialog state
  const [charging, setCharging] = useState<ClaimRow | null>(null);
  const [chargeMode, setChargeMode] = useState<ChargeMode>("link");
  const [chargeAmount, setChargeAmount] = useState("");
  const [dueInDays, setDueInDays] = useState("7");
  const [installmentCount, setInstallmentCount] = useState("3");
  const [intervalDays, setIntervalDays] = useState("30");
  const [chargeLoading, setChargeLoading] = useState(false);
  const [chargeResult, setChargeResult] = useState<{ paymentUrl: string | null; mode: string; refs: string[] } | null>(null);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const r = await sa(`/superadmin/claims?tenantId=${tenantId}`);
    if (r.ok) setClaims(await r.json());
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  function openEdit(c: ClaimRow) {
    setSelected(c);
    setEditStatus(c.status);
    setEditNotes(c.adminNotes ?? "");
    setEditSettled(c.settledAmount != null ? String(c.settledAmount) : "");
  }

  function openCharge(c: ClaimRow) {
    setCharging(c);
    setChargeMode("link");
    setChargeAmount(c.claimedAmount != null ? c.claimedAmount.toFixed(2) : "");
    setDueInDays("7");
    setInstallmentCount("3");
    setIntervalDays("30");
    setChargeResult(null);
  }

  async function saveClaim() {
    if (!selected) return;
    setSaving(true);
    const r = await sa(`/superadmin/claims/${selected.id}`, {
      method: "PUT",
      body: JSON.stringify({ status: editStatus, adminNotes: editNotes || null, settledAmount: editSettled !== "" ? parseFloat(editSettled) : null }),
    });
    setSaving(false);
    if (!r.ok) { toast({ title: "Failed to save", variant: "destructive" }); return; }
    toast({ title: "Claim updated" });
    const updated = await r.json();
    setClaims(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
    setSelected(null);
  }

  async function submitCharge() {
    if (!charging) return;
    const amt = parseFloat(chargeAmount);
    if (!amt || amt <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    setChargeLoading(true);
    try {
      const r = await sa(`/superadmin/claims/${charging.id}/charge`, {
        method: "POST",
        body: JSON.stringify({ mode: chargeMode, amount: amt, dueInDays: parseInt(dueInDays), installmentCount: parseInt(installmentCount), intervalDays: parseInt(intervalDays) }),
      });
      const data = await r.json();
      if (!r.ok) { toast({ title: data.error ?? "Charge failed", variant: "destructive" }); return; }
      setChargeResult(data);
      setClaims(prev => prev.map(c => c.id === charging.id ? { ...c, chargeMode: data.mode, chargeStatus: "pending", chargedAmount: amt } : c));
      toast({ title: chargeMode === "link" ? "Payment link created & emailed" : chargeMode === "invoice" ? "Invoice sent to renter" : `${installmentCount} installment invoices sent` });
    } finally {
      setChargeLoading(false);
    }
  }

  const openCount = claims.filter(c => c.status === "open").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-slate-400 text-sm">{claims.length} total claim{claims.length !== 1 ? "s" : ""}</p>
          {openCount > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-800 text-red-200">{openCount} open</span>}
        </div>
        <Button variant="ghost" size="sm" onClick={load} className="text-slate-400 hover:text-white hover:bg-slate-800"><RefreshCcw className="w-3.5 h-3.5" /></Button>
      </div>

      {loading ? <div className="text-slate-400 py-8 text-center">Loading…</div> : claims.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <ShieldAlert className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-semibold">No claims filed for this company</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800">
              {["#","Customer","Type","Claimed","Settled","Status","Charge",""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {claims.map(c => (
                <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 group">
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">#{c.id}</td>
                  <td className="px-4 py-3"><p className="text-white font-medium">{c.customerName}</p><p className="text-xs text-slate-500">{c.customerEmail}</p></td>
                  <td className="px-4 py-3 text-slate-300 capitalize text-xs">{c.type}</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{c.claimedAmount != null ? `$${Number(c.claimedAmount).toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{c.settledAmount != null ? `$${Number(c.settledAmount).toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-3"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${CLAIM_STATUS[c.status] ?? "bg-slate-700 text-slate-300"}`}>{c.status}</span></td>
                  <td className="px-4 py-3">
                    {c.chargeStatus ? (
                      <div className="flex flex-col gap-0.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize w-fit ${CHARGE_STATUS_CHIP[c.chargeStatus] ?? "bg-slate-700 text-slate-300"}`}>{c.chargeStatus}</span>
                        {c.chargedAmount != null && <span className="text-xs text-slate-400">${Number(c.chargedAmount).toFixed(2)}</span>}
                        {c.chargeMode && <span className="text-[10px] text-slate-600 capitalize">{c.chargeMode === "link" ? "Pay Link" : c.chargeMode === "invoice" ? "Invoice" : "Installments"}</span>}
                      </div>
                    ) : (
                      <button
                        onClick={() => openCharge(c)}
                        className="text-[11px] font-bold px-2 py-1 rounded bg-red-900/40 text-red-300 hover:bg-red-800/60 border border-red-800/50 transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100"
                      >
                        <DollarSign className="w-3 h-3" />Charge
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700"><Edit2 className="w-3.5 h-3.5" /></button>
                      {c.chargeStatus && <button onClick={() => openCharge(c)} className="p-1.5 rounded text-red-400 hover:text-red-200 hover:bg-red-900/30"><DollarSign className="w-3.5 h-3.5" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!selected} onOpenChange={v => { if (!v) setSelected(null); }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader><DialogTitle className="text-white">Edit Claim #{selected?.id}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-800 rounded-lg p-3 text-sm space-y-1">
                <p className="text-white font-medium">{selected.customerName}</p>
                <p className="text-slate-400">{selected.customerEmail}</p>
                <p className="text-slate-500 text-xs capitalize">{selected.type} claim</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-3 text-sm text-slate-300">{selected.description}</div>
              <div className="space-y-3">
                <div>
                  <Label className="text-slate-400 text-xs">Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger className="mt-1 bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>{["open","reviewing","resolved","denied"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Settled Amount ($)</Label>
                  <Input type="number" value={editSettled} onChange={e => setEditSettled(e.target.value)} placeholder="0.00" className="mt-1 bg-slate-800 border-slate-700 text-white" />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Admin Notes</Label>
                  <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Internal notes…" rows={3} className="mt-1 bg-slate-800 border-slate-700 text-white resize-none" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setSelected(null)} className="text-slate-400">Cancel</Button>
                <Button onClick={saveClaim} disabled={saving} className="bg-[#3ab549] hover:bg-[#2d9c3a] text-white font-bold">{saving ? "Saving…" : "Save"}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Charge Dialog */}
      <Dialog open={!!charging} onOpenChange={v => { if (!v) { setCharging(null); setChargeResult(null); } }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-red-400" />
              Charge Renter — Claim #{charging?.id}
            </DialogTitle>
          </DialogHeader>

          {charging && !chargeResult && (
            <div className="space-y-5 py-2">
              {/* Customer info */}
              <div className="bg-slate-800 rounded-lg p-3 text-sm flex items-start justify-between">
                <div>
                  <p className="text-white font-medium">{charging.customerName}</p>
                  <p className="text-slate-400 text-xs">{charging.customerEmail}</p>
                  <p className="text-slate-500 text-xs mt-0.5 capitalize">{charging.type} claim</p>
                </div>
                {charging.claimedAmount != null && (
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Claimed</p>
                    <p className="text-white font-bold">${Number(charging.claimedAmount).toFixed(2)}</p>
                  </div>
                )}
              </div>

              {/* Charge amount */}
              <div>
                <Label className="text-slate-300 text-sm font-semibold">Charge Amount</Label>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <Input
                    type="number"
                    value={chargeAmount}
                    onChange={e => setChargeAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0.50"
                    className="pl-7 bg-slate-800 border-slate-700 text-white text-lg font-bold"
                  />
                </div>
              </div>

              {/* Mode selector */}
              <div>
                <Label className="text-slate-300 text-sm font-semibold">Payment Method</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {([
                    { value: "link", icon: ExternalLink, label: "Payment Link", desc: "Renter clicks a link to pay now" },
                    { value: "invoice", icon: Clock, label: "Invoice", desc: "Stripe invoice with due date" },
                    { value: "installments", icon: AlertCircle, label: "Installments", desc: "Split into scheduled invoices" },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setChargeMode(opt.value)}
                      className={`rounded-lg border p-3 text-left transition-all ${chargeMode === opt.value ? "border-red-500 bg-red-500/10" : "border-slate-700 bg-slate-800 hover:border-slate-600"}`}
                    >
                      <opt.icon className={`w-4 h-4 mb-1.5 ${chargeMode === opt.value ? "text-red-400" : "text-slate-500"}`} />
                      <p className={`text-xs font-bold ${chargeMode === opt.value ? "text-red-300" : "text-slate-300"}`}>{opt.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Invoice options */}
              {chargeMode === "invoice" && (
                <div>
                  <Label className="text-slate-400 text-xs">Days Until Due</Label>
                  <Select value={dueInDays} onValueChange={setDueInDays}>
                    <SelectTrigger className="mt-1 bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[["7","7 days"], ["14","14 days"], ["30","30 days"], ["60","60 days"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Installment options */}
              {chargeMode === "installments" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-slate-400 text-xs">Number of Installments</Label>
                    <Select value={installmentCount} onValueChange={setInstallmentCount}>
                      <SelectTrigger className="mt-1 bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[["2","2 payments"], ["3","3 payments"], ["4","4 payments"], ["6","6 payments"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Interval Between Payments</Label>
                    <Select value={intervalDays} onValueChange={setIntervalDays}>
                      <SelectTrigger className="mt-1 bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[["7","Weekly"], ["14","Bi-weekly"], ["30","Monthly"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {chargeAmount && parseFloat(chargeAmount) > 0 && (
                    <div className="col-span-2 bg-slate-800 rounded-lg p-2.5 text-xs text-slate-400">
                      ~${(parseFloat(chargeAmount) / parseInt(installmentCount)).toFixed(2)} per installment,&nbsp;
                      {installmentCount} invoices sent at {intervalDays}-day intervals
                    </div>
                  )}
                </div>
              )}

              {/* Summary */}
              <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-3 text-xs text-red-300">
                <AlertCircle className="w-3.5 h-3.5 inline mr-1.5 mb-0.5" />
                {chargeMode === "link" && "A payment link will be created in Stripe and emailed to the renter. The renter pays by clicking the link."}
                {chargeMode === "invoice" && `A Stripe Invoice will be created and emailed to ${charging.customerEmail} with a ${dueInDays}-day payment window.`}
                {chargeMode === "installments" && `${installmentCount} Stripe Invoices will be created and emailed to ${charging.customerEmail}, each due ${intervalDays} days apart.`}
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setCharging(null)} className="text-slate-400">Cancel</Button>
                <Button
                  onClick={submitCharge}
                  disabled={chargeLoading || !chargeAmount || parseFloat(chargeAmount) <= 0}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  {chargeLoading ? "Processing…" : chargeMode === "link" ? "Create Payment Link" : chargeMode === "invoice" ? "Send Invoice" : `Send ${installmentCount} Invoices`}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Success state */}
          {chargeResult && (
            <div className="py-4 space-y-4">
              <div className="text-center">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-white font-bold text-lg">
                  {chargeResult.mode === "link" ? "Payment Link Created" : chargeResult.mode === "invoice" ? "Invoice Sent" : "Installment Invoices Sent"}
                </p>
                <p className="text-slate-400 text-sm mt-1">
                  A notification email has been sent to <strong className="text-slate-200">{charging?.customerEmail}</strong>
                </p>
              </div>
              {chargeResult.paymentUrl && (
                <div className="bg-slate-800 rounded-lg p-3">
                  <p className="text-slate-500 text-xs mb-1">Payment URL</p>
                  <a href={chargeResult.paymentUrl} target="_blank" rel="noopener noreferrer"
                    className="text-blue-400 text-xs break-all hover:underline flex items-center gap-1">
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    {chargeResult.paymentUrl}
                  </a>
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => { setCharging(null); setChargeResult(null); }} className="bg-slate-700 hover:bg-slate-600 text-white">Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const tenantId = parseInt(params.id ?? "0");
  const [, setLocation] = useLocation();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTenant = useCallback(async () => {
    const token = getToken();
    if (!token) { setLocation("/superadmin"); return; }
    const r = await sa(`/superadmin/tenants/${tenantId}`);
    if (r.status === 401) { setLocation("/superadmin"); return; }
    if (r.status === 404) { setLocation("/superadmin/dashboard"); return; }
    setTenant(await r.json());
    setLoading(false);
  }, [tenantId, setLocation]);

  useEffect(() => { loadTenant(); }, [loadTenant]);

  if (loading || !tenant) return (
    <div className="p-6 text-slate-400">Loading company…</div>
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/superadmin/tenants")} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">{tenant.name}</h1>
            <p className="text-slate-500 text-sm font-mono">/{tenant.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${PLAN_COLORS[tenant.plan] ?? ""}`}>{tenant.plan}</span>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[tenant.status] ?? ""}`}>{tenant.status}</span>
          <div className="flex gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" />{tenant.listingCount} listings</span>
            <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{tenant.bookingCount} bookings</span>
          </div>
          <Button size="sm" variant="outline" asChild className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-1.5">
            <a href={`/${tenant.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5" />View Storefront</a>
          </Button>
          <Button size="sm" variant="outline" asChild className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-1.5">
            <a href={`/${tenant.slug}/admin`} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5" />Open Admin</a>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="account">
        <TabsList className="bg-slate-900 border border-slate-800 flex-wrap h-auto">
          <TabsTrigger value="account" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 gap-1.5">
            <Settings2 className="w-3.5 h-3.5" />Account
          </TabsTrigger>
          <TabsTrigger value="storefront" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 gap-1.5">
            <Globe className="w-3.5 h-3.5" />Storefront
          </TabsTrigger>
          <TabsTrigger value="listings" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 gap-1.5">
            <Package className="w-3.5 h-3.5" />Listings
          </TabsTrigger>
          <TabsTrigger value="bookings" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />Bookings
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />Analytics
          </TabsTrigger>
          <TabsTrigger value="claims" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />Claims
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-6">
          <AccountTab tenant={tenant} tenantId={tenantId} onSaved={loadTenant} />
        </TabsContent>
        <TabsContent value="storefront" className="mt-6">
          <StorefrontTab tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="listings" className="mt-6">
          <ListingsTab tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="bookings" className="mt-6">
          <BookingsTab tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="analytics" className="mt-6">
          <AnalyticsTab tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="claims" className="mt-6">
          <ClaimsTab tenantId={tenantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
