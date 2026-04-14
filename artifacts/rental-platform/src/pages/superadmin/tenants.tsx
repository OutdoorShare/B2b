import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Building2, Plus, Search, RefreshCcw, ExternalLink,
  Package, CalendarDays, ChevronRight, AlertTriangle,
  CheckCircle2, XCircle, Filter, Eye, EyeOff, Mail, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const OS_GREEN = "#3ab549";

function getToken() { return localStorage.getItem("superadmin_token") ?? ""; }

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      "x-superadmin-token": getToken(),
      ...(opts?.body ? { "Content-Type": "application/json" } : {}),
      ...(opts?.headers ?? {}),
    },
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? "Request failed");
  }
  return r.json();
}

type Tenant = {
  id: number;
  name: string;
  slug: string;
  email: string;
  plan: "starter" | "professional" | "enterprise";
  status: "active" | "inactive" | "suspended";
  maxListings: number;
  contactName: string | null;
  phone: string | null;
  stripeAccountStatus: string | null;
  stripeChargesEnabled: boolean | null;
  testMode: boolean | null;
  listingCount: number;
  bookingCount: number;
  createdAt: string;
};

const PLAN_COLORS: Record<string, string> = {
  starter:      "bg-slate-700/60 text-slate-300 border border-slate-600/40",
  professional: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  enterprise:   "bg-amber-500/15 text-amber-300 border border-amber-500/30",
};

const STATUS_META: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  active:    { label: "Active",    icon: CheckCircle2,  cls: "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" },
  inactive:  { label: "Inactive",  icon: XCircle,       cls: "text-slate-400 bg-slate-700/50 border border-slate-600/30" },
  suspended: { label: "Suspended", icon: AlertTriangle, cls: "text-red-400 bg-red-500/10 border border-red-500/20" },
};

type PlanFilter   = "all" | "starter" | "professional" | "enterprise";
type StatusFilter = "all" | "active" | "inactive" | "suspended";

const DEFAULT_FORM = {
  name: "", email: "", password: "", contactName: "", phone: "",
  plan: "starter" as "starter" | "professional" | "enterprise",
  maxListings: "10",
};

export default function SuperAdminTenants() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [tenants, setTenants]         = useState<Tenant[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [planFilter, setPlanFilter]   = useState<PlanFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [showCreate, setShowCreate]   = useState(false);
  const [creating, setCreating]       = useState(false);
  const [showPw, setShowPw]           = useState(false);
  const [form, setForm]               = useState(DEFAULT_FORM);
  const [formError, setFormError]     = useState("");

  const [showInvite, setShowInvite]       = useState(false);
  const [inviteEmail, setInviteEmail]     = useState("");
  const [inviteNote, setInviteNote]       = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError]     = useState("");
  const [inviteSent, setInviteSent]       = useState(false);

  const openInvite = () => {
    setInviteEmail("");
    setInviteNote("");
    setInviteError("");
    setInviteSent(false);
    setShowInvite(true);
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) { setInviteError("Email address is required."); return; }
    setInviteSending(true);
    setInviteError("");
    try {
      await apiFetch("/superadmin/invite-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), personalNote: inviteNote.trim() || undefined }),
      });
      setInviteSent(true);
    } catch (err: any) {
      setInviteError(err.message ?? "Failed to send invite. Please try again.");
    } finally {
      setInviteSending(false);
    }
  };

  const load = useCallback(async () => {
    if (!localStorage.getItem("superadmin_user")) { setLocation("/superadmin"); return; }
    setLoading(true);
    try {
      const data = await apiFetch("/superadmin/tenants");
      setTenants(data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [setLocation]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm(DEFAULT_FORM);
    setFormError("");
    setShowCreate(true);
  };

  const handleCreate = async () => {
    setFormError("");
    if (!form.name.trim())     { setFormError("Company name is required."); return; }
    if (!form.email.trim())    { setFormError("Email is required."); return; }
    if (form.password.length < 6) { setFormError("Password must be at least 6 characters."); return; }
    setCreating(true);
    try {
      const created: Tenant = await apiFetch("/superadmin/tenants", {
        method: "POST",
        body: JSON.stringify({
          name:        form.name.trim(),
          email:       form.email.trim(),
          password:    form.password,
          contactName: form.contactName.trim() || undefined,
          phone:       form.phone.trim() || undefined,
          plan:        form.plan,
          maxListings: parseInt(form.maxListings) || 10,
        }),
      });
      setShowCreate(false);
      toast({ title: "Company created", description: `${created.name} is ready.` });
      load();
    } catch (e: any) {
      setFormError(e.message ?? "Failed to create company.");
    } finally {
      setCreating(false);
    }
  };

  const filtered = tenants.filter(t => {
    if (planFilter !== "all" && t.plan !== planFilter) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !t.name.toLowerCase().includes(q) &&
        !t.slug.toLowerCase().includes(q) &&
        !t.email.toLowerCase().includes(q) &&
        !(t.contactName ?? "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const planCounts = {
    all:          tenants.length,
    starter:      tenants.filter(t => t.plan === "starter").length,
    professional: tenants.filter(t => t.plan === "professional").length,
    enterprise:   tenants.filter(t => t.plan === "enterprise").length,
  };

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Companies</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            All tenant accounts on the OutdoorShare platform.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={load}
            disabled={loading}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 text-sm font-semibold border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            onClick={openInvite}
          >
            <Mail className="w-4 h-4" /> Send Invite
          </Button>
          <Button
            size="sm"
            className="gap-2 text-sm font-semibold"
            style={{ background: OS_GREEN }}
            onClick={openCreate}
          >
            <Plus className="w-4 h-4" /> Add Company
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["all", "starter", "professional", "enterprise"] as PlanFilter[]).map(p => (
          <button
            key={p}
            onClick={() => setPlanFilter(p)}
            className={`rounded-xl border p-4 text-left transition-all hover:scale-[1.02] ${
              planFilter === p ? "ring-2 ring-white/20" : ""
            } ${
              p === "all"          ? "bg-slate-800/60 border-slate-700" :
              p === "starter"      ? "bg-slate-800/40 border-slate-700" :
              p === "professional" ? "bg-blue-500/10 border-blue-500/20" :
                                     "bg-amber-500/10 border-amber-500/20"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 capitalize">{p}</p>
            <p className={`text-2xl font-black mt-1 ${
              p === "all"          ? "text-white" :
              p === "starter"      ? "text-slate-300" :
              p === "professional" ? "text-blue-300" :
                                     "text-amber-300"
            }`}>{planCounts[p]}</p>
          </button>
        ))}
      </div>

      {/* Search + Status Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search by name, slug, email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-slate-800/60 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-slate-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          {(["all", "active", "inactive", "suspended"] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors capitalize ${
                statusFilter === s
                  ? "bg-slate-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading companies…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 font-semibold">
              {search || planFilter !== "all" || statusFilter !== "all"
                ? "No companies match your filters"
                : "No companies yet"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left bg-slate-900/60">
                  {["Company", "Contact", "Plan", "Status", "Listings", "Bookings", "Joined", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const sm = STATUS_META[t.status] ?? STATUS_META.inactive;
                  const StatusIcon = sm.icon;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setLocation(`/superadmin/companies/${t.id}`)}
                      className="border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-slate-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate max-w-[180px]">{t.name}</p>
                            <p className="text-xs text-slate-500 font-mono truncate max-w-[180px]">/{t.slug}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="text-slate-300 truncate max-w-[160px]">{t.contactName ?? "—"}</p>
                        <p className="text-xs text-slate-500 truncate max-w-[160px]">{t.email}</p>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${PLAN_COLORS[t.plan] ?? ""}`}>
                          {t.plan}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${sm.cls}`}>
                          <StatusIcon className="w-3 h-3" />
                          {sm.label}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 text-slate-300">
                          <Package className="w-3.5 h-3.5 text-slate-500" />
                          <span>{t.listingCount} / {t.maxListings}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 text-slate-300">
                          <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
                          <span>{t.bookingCount}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                        {format(new Date(t.createdAt), "MMM d, yyyy")}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a
                            href={`/${t.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                            title="View Storefront"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={e => { e.stopPropagation(); setLocation(`/superadmin/companies/${t.id}`); }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                            title="View Details"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <p className="text-xs text-slate-600 text-right">
          Showing {filtered.length} of {tenants.length} {tenants.length === 1 ? "company" : "companies"}
        </p>
      )}

      {/* Create Company Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Company</DialogTitle>
            <DialogDescription>
              Create a new tenant account on the OutdoorShare platform.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Company Name <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Acme Rentals"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contact Name</Label>
                <Input
                  value={form.contactName}
                  onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                  placeholder="Jane Smith"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="555-000-0000"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Admin Email <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="owner@acmerentals.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Password <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min 6 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Select value={form.plan} onValueChange={(v: any) => setForm(f => ({ ...f, plan: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Max Listings</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.maxListings}
                  onChange={e => setForm(f => ({ ...f, maxListings: e.target.value }))}
                />
              </div>
            </div>

            {formError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating} style={{ background: OS_GREEN }}>
              {creating ? "Creating…" : "Create Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Signup Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={open => { if (!inviteSending) setShowInvite(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" style={{ color: OS_GREEN }} />
              Invite to Free Tier
            </DialogTitle>
            <DialogDescription>
              Send a branded invitation email with a direct link to sign up for the Half Throttle (free) plan.
            </DialogDescription>
          </DialogHeader>

          {inviteSent ? (
            <div className="py-6 flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="w-12 h-12" style={{ color: OS_GREEN }} />
              <p className="text-base font-semibold text-slate-800">Invite sent!</p>
              <p className="text-sm text-slate-500">
                An invitation email was sent to <strong>{inviteEmail}</strong> with a link to create their free account.
              </p>
              <Button
                className="mt-2"
                style={{ background: OS_GREEN }}
                onClick={() => {
                  setInviteSent(false);
                  setInviteEmail("");
                  setInviteNote("");
                }}
              >
                Send Another
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">Email address <span className="text-red-500">*</span></Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="owner@example.com"
                    value={inviteEmail}
                    onChange={e => { setInviteEmail(e.target.value); setInviteError(""); }}
                    disabled={inviteSending}
                    onKeyDown={e => { if (e.key === "Enter") handleSendInvite(); }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-note">Personal note <span className="text-slate-400 font-normal">(optional)</span></Label>
                  <textarea
                    id="invite-note"
                    rows={3}
                    placeholder="Add a short personal message that will appear in the email…"
                    value={inviteNote}
                    onChange={e => setInviteNote(e.target.value)}
                    disabled={inviteSending}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-none"
                  />
                </div>
                {inviteError && (
                  <p className="text-sm text-red-600 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {inviteError}
                  </p>
                )}
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-0.5">
                  <p className="font-semibold text-slate-700 mb-1">Half Throttle — Free forever</p>
                  <p>· Booking platform with custom branding</p>
                  <p>· OutdoorShare Marketplace listing</p>
                  <p>· Automated bookings & payments</p>
                  <p>· 10% platform fee per booking — no monthly charge</p>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={() => setShowInvite(false)} disabled={inviteSending}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSendInvite}
                  disabled={inviteSending || !inviteEmail.trim()}
                  className="gap-2"
                  style={{ background: OS_GREEN }}
                >
                  <Send className="w-4 h-4" />
                  {inviteSending ? "Sending…" : "Send Invite"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
