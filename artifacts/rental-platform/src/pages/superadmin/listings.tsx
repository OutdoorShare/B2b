import { useState, useEffect, useCallback } from "react";
import {
  Package, Search, Edit, Trash2, CheckCircle2, XCircle,
  AlertTriangle, ChevronRight, RefreshCcw, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function getToken() { return localStorage.getItem("superadmin_token") ?? ""; }

async function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-superadmin-token": getToken(), ...opts?.headers },
  });
}

type Listing = {
  id: number;
  title: string;
  description: string;
  status: string;
  pricePerDay: number;
  pricePerWeek: number | null;
  depositAmount: number | null;
  quantity: number;
  brand: string | null;
  model: string | null;
  condition: string | null;
  location: string | null;
  requirements: string | null;
  ageRestriction: number | null;
  imageUrls: string[];
  createdAt: string;
  updatedAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-900/50 text-green-300 border-green-800",
  inactive: "bg-slate-700 text-slate-400 border-slate-600",
  draft: "bg-amber-900/40 text-amber-300 border-amber-800",
};

const CONDITION_LABELS: Record<string, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
};

const defaultEdit = {
  title: "",
  description: "",
  status: "active",
  pricePerDay: "",
  pricePerWeek: "",
  depositAmount: "",
  quantity: "1",
  brand: "",
  model: "",
  condition: "",
  location: "",
  requirements: "",
  ageRestriction: "",
};

export default function SuperAdminListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Listing | null>(null);
  const [editForm, setEditForm] = useState(defaultEdit);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/superadmin/listings");
      const data = await res.json();
      if (Array.isArray(data)) setListings(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (l: Listing) => {
    setEditTarget(l);
    setEditForm({
      title: l.title,
      description: l.description,
      status: l.status,
      pricePerDay: String(l.pricePerDay),
      pricePerWeek: l.pricePerWeek ? String(l.pricePerWeek) : "",
      depositAmount: l.depositAmount ? String(l.depositAmount) : "",
      quantity: String(l.quantity),
      brand: l.brand ?? "",
      model: l.model ?? "",
      condition: l.condition ?? "",
      location: l.location ?? "",
      requirements: l.requirements ?? "",
      ageRestriction: l.ageRestriction ? String(l.ageRestriction) : "",
    });
    setEditError("");
    setEditOpen(true);
  };

  const handleSave = async () => {
    setEditError("");
    if (!editForm.title.trim()) { setEditError("Title is required."); return; }
    if (!editForm.pricePerDay || isNaN(Number(editForm.pricePerDay))) { setEditError("Valid price per day is required."); return; }
    setSaving(true);
    try {
      const res = await apiFetch(`/superadmin/listings/${editTarget!.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: editForm.description.trim(),
          status: editForm.status,
          pricePerDay: Number(editForm.pricePerDay),
          pricePerWeek: editForm.pricePerWeek ? Number(editForm.pricePerWeek) : null,
          depositAmount: editForm.depositAmount ? Number(editForm.depositAmount) : null,
          quantity: Number(editForm.quantity) || 1,
          brand: editForm.brand || null,
          model: editForm.model || null,
          condition: editForm.condition || null,
          location: editForm.location || null,
          requirements: editForm.requirements || null,
          ageRestriction: 21,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error || "Failed to save"); return; }
      setListings(prev => prev.map(l => l.id === data.id ? data : l));
      setEditOpen(false);
    } catch { setEditError("Connection error."); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/superadmin/listings/${deleteTarget.id}`, { method: "DELETE" });
      setListings(prev => prev.filter(l => l.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  const filtered = listings.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.title.toLowerCase().includes(q) || (l.brand ?? "").toLowerCase().includes(q) || (l.model ?? "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">All Products</h1>
          <p className="text-slate-400 text-sm mt-0.5">{listings.length} listing{listings.length !== 1 ? "s" : ""} across all companies</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg transition-colors self-start sm:self-auto"
        >
          <RefreshCcw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, brand, or model…"
            className="pl-9 bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:ring-0 focus-visible:border-[#3ab549]"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-slate-900 border-slate-700 text-slate-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active", count: listings.filter(l => l.status === "active").length, color: "text-green-400" },
          { label: "Inactive", count: listings.filter(l => l.status === "inactive").length, color: "text-slate-400" },
          { label: "Draft", count: listings.filter(l => l.status === "draft").length, color: "text-amber-400" },
        ].map(s => (
          <div key={s.label} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500">Loading listings…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>{listings.length === 0 ? "No listings yet." : "No listings match your filters."}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Product</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Brand / Model</th>
                <th className="text-left px-4 py-3 font-medium">Price/Day</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Qty</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filtered.map(l => (
                <tr key={l.id} className="hover:bg-slate-800/40 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {l.imageUrls?.[0] ? (
                        <img src={l.imageUrls[0]} alt={l.title} className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4 text-slate-600" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-100 truncate max-w-[180px]">{l.title}</p>
                        {l.condition && (
                          <p className="text-xs text-slate-500">{CONDITION_LABELS[l.condition] ?? l.condition}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-slate-300">
                      {[l.brand, l.model].filter(Boolean).join(" ") || <span className="text-slate-600 italic">—</span>}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-mono font-semibold text-slate-100">${l.pricePerDay.toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell text-slate-300">{l.quantity}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[l.status] ?? "bg-slate-700 text-slate-400"}`}>
                      {l.status === "active" && <CheckCircle2 className="w-3 h-3" />}
                      {l.status === "inactive" && <XCircle className="w-3 h-3" />}
                      {l.status === "draft" && <AlertTriangle className="w-3 h-3" />}
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell text-slate-500 text-xs">
                    {format(new Date(l.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(l)}
                        className="p-1.5 rounded-lg bg-slate-700 hover:bg-[#3ab549] text-slate-300 hover:text-white transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(l)}
                        className="p-1.5 rounded-lg bg-slate-700 hover:bg-red-700 text-slate-300 hover:text-white transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Listing</DialogTitle>
            <DialogDescription className="text-slate-400">
              #{editTarget?.id} — Changes apply immediately across all storefronts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Basic */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Basic Info</h3>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Title <span className="text-red-400">*</span></Label>
                <Input
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-slate-100 h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Description</Label>
                <Textarea
                  value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="bg-slate-800 border-slate-600 text-slate-100 resize-none text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Status</Label>
                  <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-200 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Quantity</Label>
                  <Input
                    type="number" min="1"
                    value={editForm.quantity}
                    onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-slate-100 h-9"
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-slate-800" />

            {/* Pricing */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pricing</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Per Day <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                    <Input
                      type="number" min="0" step="0.01"
                      value={editForm.pricePerDay}
                      onChange={e => setEditForm(f => ({ ...f, pricePerDay: e.target.value }))}
                      className="pl-6 bg-slate-800 border-slate-600 text-slate-100 h-9"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Per Week</Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                    <Input
                      type="number" min="0" step="0.01"
                      value={editForm.pricePerWeek}
                      onChange={e => setEditForm(f => ({ ...f, pricePerWeek: e.target.value }))}
                      placeholder="—"
                      className="pl-6 bg-slate-800 border-slate-600 text-slate-100 h-9"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Deposit</Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                    <Input
                      type="number" min="0" step="0.01"
                      value={editForm.depositAmount}
                      onChange={e => setEditForm(f => ({ ...f, depositAmount: e.target.value }))}
                      placeholder="—"
                      className="pl-6 bg-slate-800 border-slate-600 text-slate-100 h-9"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator className="bg-slate-800" />

            {/* Details */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Details</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Brand</Label>
                  <Input
                    value={editForm.brand}
                    onChange={e => setEditForm(f => ({ ...f, brand: e.target.value }))}
                    placeholder="e.g. Yamaha"
                    className="bg-slate-800 border-slate-600 text-slate-100 h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Model</Label>
                  <Input
                    value={editForm.model}
                    onChange={e => setEditForm(f => ({ ...f, model: e.target.value }))}
                    placeholder="e.g. FX Cruiser"
                    className="bg-slate-800 border-slate-600 text-slate-100 h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Condition</Label>
                  <Select value={editForm.condition || "_none"} onValueChange={v => setEditForm(f => ({ ...f, condition: v === "_none" ? "" : v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-200 h-9">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                      <SelectItem value="_none">Not specified</SelectItem>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="fair">Fair</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Location</Label>
                <Input
                  value={editForm.location}
                  onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-slate-100 h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Requirements / Notes</Label>
                <Textarea
                  value={editForm.requirements}
                  onChange={e => setEditForm(f => ({ ...f, requirements: e.target.value }))}
                  rows={2}
                  className="bg-slate-800 border-slate-600 text-slate-100 resize-none text-sm"
                />
              </div>
            </div>
          </div>

          {editError && (
            <p className="text-sm text-red-400 font-medium pt-1">{editError}</p>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditOpen(false)} className="text-slate-400 hover:text-white border-slate-700">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#3ab549] hover:bg-[#2e9a3d] text-white"
            >
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete listing?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              <strong className="text-slate-200">"{deleteTarget?.title}"</strong> will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-700 hover:bg-red-600 text-white border-0"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
