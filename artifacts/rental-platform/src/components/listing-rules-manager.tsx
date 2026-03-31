import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ShieldCheck, DollarSign, X, AlertTriangle } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Rule = {
  id: number;
  listingId: number;
  title: string;
  description: string | null;
  fee: number;
  sortOrder: number;
};

const BLANK = { title: "", description: "", fee: "" };

export function ListingRulesManager({ listingId }: { listingId: number }) {
  const { toast } = useToast();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchRules = async () => {
    try {
      const res = await fetch(`${BASE}/api/listings/${listingId}/rules`);
      const data = await res.json();
      setRules(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRules(); }, [listingId]);

  const openNew = () => {
    setEditingId(null);
    setForm(BLANK);
    setShowForm(true);
  };

  const openEdit = (r: Rule) => {
    setEditingId(r.id);
    setForm({ title: r.title, description: r.description ?? "", fee: String(r.fee) });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(BLANK); };

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: "Rule title is required", variant: "destructive" }); return; }
    const fee = parseFloat(form.fee);
    if (isNaN(fee) || fee < 0) { toast({ title: "Fee must be a valid amount", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload = {
        listingId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        fee,
        sortOrder: editingId ? undefined : rules.length,
      };
      const url = editingId ? `${BASE}/api/listing-rules/${editingId}` : `${BASE}/api/listing-rules`;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: editingId ? "Rule updated" : "Rule added" });
      closeForm();
      fetchRules();
    } catch (err: any) {
      toast({ title: err?.message || "Failed to save rule", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await fetch(`${BASE}/api/listing-rules/${id}`, { method: "DELETE" });
      setRules(prev => prev.filter(r => r.id !== id));
      toast({ title: "Rule deleted" });
    } catch {
      toast({ title: "Failed to delete rule", variant: "destructive" });
    } finally { setDeletingId(null); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" /> Rules &amp; Violations
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Rules renters must initial before renting. A fee applies if broken.
            </CardDescription>
          </div>
          {!showForm && (
            <Button size="sm" variant="outline" onClick={openNew} className="gap-1.5 shrink-0">
              <Plus className="w-3.5 h-3.5" /> Add Rule
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Inline form */}
        {showForm && (
          <div className="border rounded-xl p-4 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">{editingId ? "Edit Rule" : "New Rule"}</p>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rule Title <span className="text-destructive">*</span></Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. No smoking in or around the vehicle"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description (optional)</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Additional details about this rule…"
                rows={2}
                className="resize-none text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fee if Broken <span className="text-destructive">*</span></Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  type="number" min="0" step="0.01"
                  value={form.fee}
                  onChange={e => setForm(f => ({ ...f, fee: e.target.value }))}
                  placeholder="0.00"
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" size="sm" onClick={closeForm}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editingId ? "Update Rule" : "Add Rule"}
              </Button>
            </div>
          </div>
        )}

        {loading && <p className="text-sm text-muted-foreground py-2">Loading rules…</p>}

        {!loading && rules.length === 0 && !showForm && (
          <div className="text-center py-6 border-2 border-dashed rounded-xl">
            <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No rules added yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Add rules renters must initial — and fees if broken</p>
            <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={openNew}>
              <Plus className="w-3.5 h-3.5" /> Add First Rule
            </Button>
          </div>
        )}

        {rules.map(rule => (
          <div key={rule.id} className="flex items-start gap-3 p-3 rounded-xl border bg-background">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{rule.title}</p>
              {rule.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
              )}
              <p className="text-xs font-semibold text-red-600 mt-1">
                ${rule.fee.toFixed(2)} fee if broken
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => openEdit(rule)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(rule.id)}
                disabled={deletingId === rule.id}
                className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
