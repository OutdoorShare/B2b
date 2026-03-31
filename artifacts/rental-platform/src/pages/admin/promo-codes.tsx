import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Tag, Loader2, Copy, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { getAdminSlug } from "@/lib/admin-nav";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface PromoCode {
  id: number;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: string;
  maxUses: number | null;
  usesCount: number;
  minBookingAmount: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

type FormData = {
  code: string;
  discountType: "percent" | "fixed";
  discountValue: string;
  maxUses: string;
  minBookingAmount: string;
  expiresAt: string;
  isActive: boolean;
};

const emptyForm: FormData = {
  code: "",
  discountType: "percent",
  discountValue: "",
  maxUses: "",
  minBookingAmount: "",
  expiresAt: "",
  isActive: true,
};

function getAdminToken(): string | null {
  try {
    const raw = localStorage.getItem("admin_session");
    return raw ? JSON.parse(raw)?.token : null;
  } catch { return null; }
}

export default function AdminPromoCodes() {
  const { slug: urlSlug } = useParams<{ slug: string }>();
  const slug = getAdminSlug(urlSlug);
  const { toast } = useToast();

  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PromoCode | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const token = getAdminToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { "x-admin-token": token } : {}),
  };

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/promo-codes`, { headers });
      const data = await res.json();
      if (Array.isArray(data)) setCodes(data);
    } catch {
      toast({ title: "Failed to load promo codes", variant: "destructive" });
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(code: PromoCode) {
    setEditTarget(code);
    setForm({
      code: code.code,
      discountType: code.discountType,
      discountValue: code.discountValue,
      maxUses: code.maxUses != null ? String(code.maxUses) : "",
      minBookingAmount: code.minBookingAmount ?? "",
      expiresAt: code.expiresAt ? code.expiresAt.slice(0, 10) : "",
      isActive: code.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.code.trim()) { toast({ title: "Code name is required", variant: "destructive" }); return; }
    if (!form.discountValue || Number(form.discountValue) <= 0) {
      toast({ title: "Discount value must be greater than 0", variant: "destructive" }); return;
    }
    if (form.discountType === "percent" && Number(form.discountValue) > 100) {
      toast({ title: "Percent discount cannot exceed 100%", variant: "destructive" }); return;
    }

    setSaving(true);
    try {
      const body = {
        code: form.code.toUpperCase().trim().replace(/\s+/g, ""),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        minBookingAmount: form.minBookingAmount ? Number(form.minBookingAmount) : null,
        expiresAt: form.expiresAt || null,
        isActive: form.isActive,
      };

      const url = editTarget ? `${BASE}/api/promo-codes/${editTarget.id}` : `${BASE}/api/promo-codes`;
      const method = editTarget ? "PUT" : "POST";

      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error || "Failed to save promo code", variant: "destructive" }); return; }

      toast({ title: editTarget ? "Promo code updated" : "Promo code created" });
      setDialogOpen(false);
      load();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`${BASE}/api/promo-codes/${id}`, { method: "DELETE", headers });
      if (!res.ok) { toast({ title: "Failed to delete promo code", variant: "destructive" }); return; }
      toast({ title: "Promo code deleted" });
      setCodes(prev => prev.filter(c => c.id !== id));
    } finally { setDeleteId(null); }
  }

  async function toggleActive(code: PromoCode) {
    try {
      await fetch(`${BASE}/api/promo-codes/${code.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ isActive: !code.isActive }),
      });
      setCodes(prev => prev.map(c => c.id === code.id ? { ...c, isActive: !c.isActive } : c));
    } catch {
      toast({ title: "Failed to update promo code", variant: "destructive" });
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1800);
  }

  function describeDiscount(c: PromoCode) {
    const v = parseFloat(c.discountValue);
    return c.discountType === "percent" ? `${v}% off` : `$${v.toFixed(2)} off`;
  }

  function isExpired(c: PromoCode) {
    return !!c.expiresAt && new Date(c.expiresAt) < new Date();
  }

  function getStatus(c: PromoCode) {
    if (!c.isActive) return { label: "Inactive", variant: "secondary" as const };
    if (isExpired(c)) return { label: "Expired", variant: "destructive" as const };
    if (c.maxUses != null && c.usesCount >= c.maxUses) return { label: "Maxed out", variant: "destructive" as const };
    return { label: "Active", variant: "default" as const };
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tag className="w-6 h-6 text-primary" />
            Promo Codes
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Create discount codes for your renters to use at checkout.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          New Code
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading promo codes…
        </div>
      ) : codes.length === 0 ? (
        <div className="text-center py-20 bg-muted/30 rounded-2xl border-2 border-dashed">
          <Tag className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-semibold text-muted-foreground">No promo codes yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first code to offer discounts to renters.</p>
          <Button onClick={openCreate} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" /> Create Promo Code
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden shadow-sm bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Code</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Discount</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Uses</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Expires</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.map(code => {
                const status = getStatus(code);
                return (
                  <tr key={code.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold tracking-widest text-primary bg-primary/8 px-2 py-0.5 rounded text-sm">{code.code}</span>
                        <button
                          onClick={() => copyCode(code.code)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Copy code"
                        >
                          {copiedCode === code.code ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-green-700">
                      {describeDiscount(code)}
                      {code.minBookingAmount && (
                        <span className="text-xs text-muted-foreground font-normal ml-1">(min ${parseFloat(code.minBookingAmount).toFixed(2)})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {code.usesCount}{code.maxUses != null ? ` / ${code.maxUses}` : ""}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {code.expiresAt ? format(new Date(code.expiresAt), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={status.variant}>{status.label}</Badge>
                        <Switch
                          checked={code.isActive}
                          onCheckedChange={() => toggleActive(code)}
                          className="scale-75"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(code)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(code.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Promo Code" : "Create Promo Code"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Code <span className="text-destructive">*</span></Label>
              <Input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, "") }))}
                placeholder="SUMMER20"
                className="font-mono font-bold tracking-widest uppercase"
                disabled={!!editTarget}
              />
              <p className="text-xs text-muted-foreground">Renters will enter this code at checkout. Letters and numbers only.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Discount Type <span className="text-destructive">*</span></Label>
                <Select value={form.discountType} onValueChange={v => setForm(f => ({ ...f, discountType: v as "percent" | "fixed" }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent (%)</SelectItem>
                    <SelectItem value="fixed">Fixed ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Value <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">
                    {form.discountType === "percent" ? "%" : "$"}
                  </span>
                  <Input
                    type="number"
                    min="0"
                    max={form.discountType === "percent" ? "100" : undefined}
                    step="0.01"
                    value={form.discountValue}
                    onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))}
                    placeholder={form.discountType === "percent" ? "20" : "10.00"}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Max Uses</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={form.maxUses}
                  onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))}
                  placeholder="Unlimited"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Min Booking ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minBookingAmount}
                  onChange={e => setForm(f => ({ ...f, minBookingAmount: e.target.value }))}
                  placeholder="No minimum"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Expiration Date</Label>
              <Input
                type="date"
                value={form.expiresAt}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Leave blank for no expiration.</p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium text-sm">Active</p>
                <p className="text-xs text-muted-foreground">Renters can use this code</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editTarget ? "Save Changes" : "Create Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Promo Code?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone. Renters with this code will no longer be able to use it.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
