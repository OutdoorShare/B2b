import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, GripVertical, Package, CheckCircle, X } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Addon = {
  id: number;
  listingId: number;
  name: string;
  description: string | null;
  price: number;
  priceType: "flat" | "per_day";
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
};

const BLANK_FORM = {
  name: "",
  description: "",
  price: "",
  priceType: "flat" as const,
  isRequired: false,
  isActive: true,
};

export function AddonManager({ listingId }: { listingId: number }) {
  const { toast } = useToast();
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);

  const fetchAddons = async () => {
    try {
      const res = await fetch(`${BASE}/api/listings/${listingId}/addons`);
      const data = await res.json();
      setAddons(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAddons(); }, [listingId]);

  const openNew = () => {
    setEditingId(null);
    setForm(BLANK_FORM);
    setShowForm(true);
  };

  const openEdit = (addon: Addon) => {
    setEditingId(addon.id);
    setForm({
      name: addon.name,
      description: addon.description ?? "",
      price: String(addon.price),
      priceType: addon.priceType,
      isRequired: addon.isRequired,
      isActive: addon.isActive,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) {
      toast({ title: "Name and price are required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: parseFloat(form.price),
        priceType: form.priceType,
        isRequired: form.isRequired,
        isActive: form.isActive,
      };

      const url = editingId
        ? `${BASE}/api/listings/${listingId}/addons/${editingId}`
        : `${BASE}/api/listings/${listingId}/addons`;
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error();
      toast({ title: editingId ? "Add-on updated" : "Add-on created" });
      setShowForm(false);
      await fetchAddons();
    } catch {
      toast({ title: "Failed to save add-on", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await fetch(`${BASE}/api/listings/${listingId}/addons/${id}`, { method: "DELETE" });
      toast({ title: "Add-on removed" });
      fetchAddons();
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const toggleActive = async (addon: Addon) => {
    try {
      await fetch(`${BASE}/api/listings/${listingId}/addons/${addon.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !addon.isActive }),
      });
      fetchAddons();
    } catch {}
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="w-4 h-4" /> Add-ons & Extras
            </CardTitle>
            <CardDescription className="mt-1">
              Optional (or required) upgrades customers can add during booking.
            </CardDescription>
          </div>
          <Button type="button" size="sm" onClick={openNew} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Inline add/edit form */}
        {showForm && (
          <div className="border rounded-xl p-5 bg-muted/30 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-sm">{editingId ? "Edit Add-on" : "New Add-on"}</h4>
              <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. GPS Tracker, Helmet, Insurance"
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description shown to customers..."
                  rows={2}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Price <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                    className="pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Pricing Type</Label>
                <Select value={form.priceType} onValueChange={(v: any) => setForm(p => ({ ...p, priceType: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat fee (one-time)</SelectItem>
                    <SelectItem value="per_day">Per day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-6 pt-1">
              <div className="flex items-center gap-2">
                <Switch
                  id="isRequired"
                  checked={form.isRequired}
                  onCheckedChange={v => setForm(p => ({ ...p, isRequired: v }))}
                />
                <Label htmlFor="isRequired" className="cursor-pointer">Required for all bookings</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={form.isActive}
                  onCheckedChange={v => setForm(p => ({ ...p, isActive: v }))}
                />
                <Label htmlFor="isActive" className="cursor-pointer">Active / visible</Label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editingId ? "Save Changes" : "Create Add-on"}
              </Button>
            </div>
          </div>
        )}

        {/* Addon list */}
        {loading ? (
          <p className="text-sm text-muted-foreground py-2">Loading...</p>
        ) : addons.length === 0 && !showForm ? (
          <div className="text-center py-8 border-2 border-dashed rounded-xl">
            <Package className="w-8 h-8 text-muted mx-auto mb-2" />
            <p className="text-sm font-medium text-muted-foreground">No add-ons yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add extras like insurance, GPS, helmets, or delivery.</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={openNew}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add your first add-on
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {addons.map(addon => (
              <div
                key={addon.id}
                className={`flex items-start gap-3 border rounded-xl p-4 transition-opacity ${!addon.isActive ? "opacity-50" : ""}`}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{addon.name}</span>
                    {addon.isRequired && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800">Required</Badge>
                    )}
                    {!addon.isActive && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">Hidden</Badge>
                    )}
                  </div>
                  {addon.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{addon.description}</p>
                  )}
                  <p className="text-sm font-bold text-primary mt-1">
                    ${addon.price.toFixed(2)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      {addon.priceType === "per_day" ? "/ day" : "flat fee"}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleActive(addon)}
                    title={addon.isActive ? "Hide add-on" : "Show add-on"}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <CheckCircle className={`w-4 h-4 ${addon.isActive ? "text-green-500" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(addon)}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(addon.id, addon.name)}
                    className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
