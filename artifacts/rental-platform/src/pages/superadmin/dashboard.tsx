import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import {
  Building2, Users, BarChart3, Package,
  Plus, Edit, Trash2, CheckCircle2, XCircle,
  AlertTriangle, RefreshCcw, Eye, EyeOff,
  ChevronRight, Search, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getToken() { return localStorage.getItem("superadmin_token") ?? ""; }

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  return fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-superadmin-token": token, ...opts?.headers },
  });
}

type Stats = { total: number; active: number; inactive: number; suspended: number; totalListings: number; totalBookings: number };
type Tenant = {
  id: number; name: string; slug: string; email: string; plan: string;
  status: string; maxListings: number; contactName?: string; phone?: string;
  notes?: string; createdAt: string; updatedAt: string;
  listingCount: number; bookingCount: number;
};

const OS_GREEN = "#3ab549";
const PLAN_COLORS: Record<string, string> = {
  starter: "bg-slate-700 text-slate-200",
  professional: "bg-blue-900/60 text-blue-300",
  enterprise: "bg-emerald-900/60 text-emerald-300",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-900/50 text-green-300",
  inactive: "bg-slate-700 text-slate-400",
  suspended: "bg-red-900/50 text-red-300",
};

const PLAN_LIMITS: Record<string, number> = { starter: 10, professional: 50, enterprise: 500 };

const defaultForm = {
  name: "", slug: "", email: "", password: "", confirmPassword: "",
  plan: "starter", status: "active", maxListings: "10",
  contactName: "", phone: "", notes: "",
};

export default function SuperAdminDashboard() {
  const [, setLocation] = useLocation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const loadData = useCallback(async () => {
    const token = getToken();
    if (!token) { setLocation("/superadmin"); return; }
    setLoading(true);
    try {
      const [statsRes, tenantsRes] = await Promise.all([
        apiFetch("/superadmin/stats"),
        apiFetch("/superadmin/tenants"),
      ]);
      if (statsRes.status === 401 || tenantsRes.status === 401) { setLocation("/superadmin"); return; }
      setStats(await statsRes.json());
      setTenants(await tenantsRes.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [setLocation]);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setEditTenant(null);
    setForm({ ...defaultForm });
    setFormError("");
    setShowPassword(false);
    setShowForm(true);
  };

  const openEdit = (t: Tenant) => {
    setEditTenant(t);
    setForm({
      name: t.name, slug: t.slug, email: t.email, password: "", confirmPassword: "",
      plan: t.plan, status: t.status, maxListings: String(t.maxListings),
      contactName: t.contactName ?? "", phone: t.phone ?? "", notes: t.notes ?? "",
    });
    setFormError("");
    setShowPassword(false);
    setShowForm(true);
  };

  const updateField = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    // Auto-set maxListings when plan changes
    if (field === "plan") setForm(f => ({ ...f, plan: value, maxListings: String(PLAN_LIMITS[value] ?? 10) }));
    // Auto-generate slug from name
    if (field === "name" && !editTenant) {
      const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      setForm(f => ({ ...f, name: value, slug }));
    }
  };

  const handleSubmit = async () => {
    setFormError("");
    if (!form.name || !form.slug || !form.email) { setFormError("Name, slug and email are required."); return; }
    if (!editTenant && !form.password) { setFormError("Password is required."); return; }
    if (form.password && form.password !== form.confirmPassword) { setFormError("Passwords don't match."); return; }
    if (form.password && form.password.length < 6) { setFormError("Password must be at least 6 characters."); return; }
    setSubmitting(true);
    try {
      const body = {
        name: form.name, slug: form.slug, email: form.email,
        plan: form.plan, status: form.status, maxListings: parseInt(form.maxListings),
        contactName: form.contactName || undefined, phone: form.phone || undefined, notes: form.notes || undefined,
        ...(form.password ? { password: form.password } : {}),
      };
      const res = editTenant
        ? await apiFetch(`/superadmin/tenants/${editTenant.id}`, { method: "PUT", body: JSON.stringify(body) })
        : await apiFetch("/superadmin/tenants", { method: "POST", body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "Failed to save."); return; }
      setShowForm(false);
      await loadData();
    } catch { setFormError("Connection error."); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/superadmin/tenants/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      await loadData();
    } catch { /* ignore */ }
  };

  const handleStatusToggle = async (t: Tenant) => {
    const newStatus = t.status === "active" ? "inactive" : "active";
    await apiFetch(`/superadmin/tenants/${t.id}`, { method: "PUT", body: JSON.stringify({ status: newStatus }) });
    await loadData();
  };

  const filtered = tenants.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.email.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Company Accounts</h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage all white-label rental companies on the platform.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={loadData} className="text-slate-400 hover:text-white hover:bg-slate-800">
            <RefreshCcw className="w-4 h-4" />
          </Button>
          <Button onClick={openCreate} className="text-white gap-1.5 hover:opacity-90" style={{ backgroundColor: OS_GREEN }}>
            <Plus className="w-4 h-4" /> New Company
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total", value: stats.total, color: "text-white" },
            { label: "Active", value: stats.active, color: "text-green-400" },
            { label: "Inactive", value: stats.inactive, color: "text-slate-400" },
            { label: "Suspended", value: stats.suspended, color: "text-red-400" },
            { label: "Listings", value: stats.totalListings, color: "text-blue-400" },
            { label: "Bookings", value: stats.totalBookings, color: "text-emerald-400" },
          ].map(s => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{s.label}</p>
              <p className={`text-2xl font-black mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search + Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search companies…"
              className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-9 focus:border-emerald-500"
            />
          </div>
          <p className="text-sm text-slate-500 ml-auto">{filtered.length} companies</p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 font-semibold">
              {search ? "No companies match your search" : "No companies yet"}
            </p>
            {!search && (
              <Button onClick={openCreate} className="mt-4 text-white gap-1.5 hover:opacity-90" style={{ backgroundColor: OS_GREEN }}>
                <Plus className="w-4 h-4" /> Create First Company
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left">
                  {["Company", "Contact", "Plan", "Status", "Listings", "Bookings", "Created", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group">
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-white">{t.name}</p>
                      <p className="text-xs text-slate-500 font-mono">{t.slug}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-slate-300">{t.email}</p>
                      {t.contactName && <p className="text-xs text-slate-500">{t.contactName}</p>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${PLAN_COLORS[t.plan] ?? "bg-slate-700 text-slate-300"}`}>
                        {t.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[t.status] ?? "bg-slate-700 text-slate-400"}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-300">
                      {t.listingCount} / {t.maxListings}
                    </td>
                    <td className="px-4 py-3.5 text-slate-300">{t.bookingCount}</td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs">
                      {format(new Date(t.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        <Link href={`/superadmin/companies/${t.id}`}>
                          <button
                            title="Manage company"
                            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors"
                            style={{ backgroundColor: `${OS_GREEN}20`, color: OS_GREEN }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${OS_GREEN}35`)}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = `${OS_GREEN}20`)}
                          >
                            Manage <ChevronRight className="w-3 h-3" />
                          </button>
                        </Link>
                        <button
                          onClick={() => handleStatusToggle(t)}
                          title={t.status === "active" ? "Deactivate" : "Activate"}
                          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                        >
                          {t.status === "active"
                            ? <XCircle className="w-4 h-4 text-red-400" />
                            : <CheckCircle2 className="w-4 h-4 text-green-400" />}
                        </button>
                        <button
                          onClick={() => openEdit(t)}
                          title="Quick edit"
                          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(t.id)}
                          title="Delete"
                          className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) setShowForm(false); }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{editTenant ? "Edit Company" : "New Company Account"}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {editTenant ? `Update details for ${editTenant.name}.` : "Create a new white-label rental company account."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-slate-300 text-xs">Company Name *</Label>
                <Input value={form.name} onChange={e => updateField("name", e.target.value)} placeholder="Adventure Rentals Co."
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Slug * <span className="text-slate-500 font-normal">(URL identifier)</span></Label>
                <Input value={form.slug} onChange={e => updateField("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="adventure-rentals"
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 font-mono focus:border-emerald-500" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Plan</Label>
                <Select value={form.plan} onValueChange={v => updateField("plan", v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white focus:border-emerald-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    {["starter", "professional", "enterprise"].map(p => (
                      <SelectItem key={p} value={p} className="capitalize focus:bg-slate-700">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="bg-slate-800" />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-slate-300 text-xs">Admin Email *</Label>
                <Input value={form.email} onChange={e => updateField("email", e.target.value)} type="email" placeholder="admin@company.com"
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">{editTenant ? "New Password" : "Password *"}</Label>
                <div className="relative">
                  <Input value={form.password} onChange={e => updateField("password", e.target.value)}
                    type={showPassword ? "text" : "password"} placeholder={editTenant ? "Leave blank to keep" : "Min. 6 characters"}
                    className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 pr-9 focus:border-emerald-500" />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Confirm Password</Label>
                <Input value={form.confirmPassword} onChange={e => updateField("confirmPassword", e.target.value)}
                  type={showPassword ? "text" : "password"} placeholder="Repeat password"
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500" />
              </div>
            </div>

            <Separator className="bg-slate-800" />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Contact Name</Label>
                <Input value={form.contactName} onChange={e => updateField("contactName", e.target.value)} placeholder="Jane Smith"
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Phone</Label>
                <Input value={form.phone} onChange={e => updateField("phone", e.target.value)} placeholder="+1 555-000-0000"
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => updateField("status", v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white focus:border-emerald-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    {["active", "inactive", "suspended"].map(s => (
                      <SelectItem key={s} value={s} className="capitalize focus:bg-slate-700">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Max Listings</Label>
                <Input value={form.maxListings} onChange={e => updateField("maxListings", e.target.value)} type="number" min="1"
                  className="bg-slate-800 border-slate-600 text-white focus:border-emerald-500" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-slate-300 text-xs">Internal Notes</Label>
                <Textarea value={form.notes} onChange={e => updateField("notes", e.target.value)} placeholder="Optional notes…" rows={2}
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500 resize-none" />
              </div>
            </div>

            {formError && (
              <p className="text-red-400 text-sm font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {formError}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white hover:bg-slate-800">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="text-white hover:opacity-90" style={{ backgroundColor: OS_GREEN }}>
              {submitting ? "Saving…" : editTenant ? "Save Changes" : "Create Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" /> Delete Company
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This will permanently delete the company account and all associated data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete Company
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
