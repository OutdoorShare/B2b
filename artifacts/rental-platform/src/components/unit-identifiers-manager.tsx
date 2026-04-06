import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Fingerprint, Plus, Trash2, AlertTriangle, CheckCircle2, Pencil, X, Check } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type IdentifierType = "vin" | "hin" | "serial";
type UnitStatus = "available" | "rented" | "maintenance" | "retired";

interface ListingUnit {
  id: number;
  listingId: number;
  unitIdentifier: string;
  identifierType: IdentifierType;
  label: string | null;
  status: UnitStatus;
  notes: string | null;
}

const TYPE_LABELS: Record<IdentifierType, string> = {
  vin: "VIN",
  hin: "HIN",
  serial: "Serial #",
};

const STATUS_COLORS: Record<UnitStatus, string> = {
  available: "bg-green-100 text-green-800 border-green-200",
  rented: "bg-blue-100 text-blue-800 border-blue-200",
  maintenance: "bg-amber-100 text-amber-800 border-amber-200",
  retired: "bg-gray-100 text-gray-600 border-gray-200",
};

interface Props {
  listingId: number;
  quantity: number;
}

export function UnitIdentifiersManager({ listingId, quantity }: Props) {
  const { toast } = useToast();
  const [units, setUnits] = useState<ListingUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [newIdentifier, setNewIdentifier] = useState("");
  const [newType, setNewType] = useState<IdentifierType>("serial");
  const [newLabel, setNewLabel] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const [editIdentifier, setEditIdentifier] = useState("");
  const [editType, setEditType] = useState<IdentifierType>("serial");
  const [editLabel, setEditLabel] = useState("");
  const [editStatus, setEditStatus] = useState<UnitStatus>("available");
  const [editNotes, setEditNotes] = useState("");

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/listings/${listingId}/units`);
      const data = await res.json();
      setUnits(data);
    } catch {
      toast({ title: "Failed to load units", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => { fetchUnits(); }, [fetchUnits]);

  const handleAdd = async () => {
    if (!newIdentifier.trim()) {
      toast({ title: "Identifier is required", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`${BASE}/api/listings/${listingId}/units`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitIdentifier: newIdentifier, identifierType: newType, label: newLabel || null, notes: newNotes || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Unit added" });
      setNewIdentifier(""); setNewType("serial"); setNewLabel(""); setNewNotes("");
      setAdding(false);
      await fetchUnits();
    } catch (e: any) {
      toast({ title: e?.message || "Failed to add unit", variant: "destructive" });
    }
  };

  const startEdit = (unit: ListingUnit) => {
    setEditingId(unit.id);
    setEditIdentifier(unit.unitIdentifier);
    setEditType(unit.identifierType);
    setEditLabel(unit.label ?? "");
    setEditStatus(unit.status);
    setEditNotes(unit.notes ?? "");
  };

  const handleEdit = async (unit: ListingUnit) => {
    try {
      const res = await fetch(`${BASE}/api/listings/${listingId}/units/${unit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitIdentifier: editIdentifier, identifierType: editType, label: editLabel || null, status: editStatus, notes: editNotes || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Unit updated" });
      setEditingId(null);
      await fetchUnits();
    } catch (e: any) {
      toast({ title: e?.message || "Failed to update unit", variant: "destructive" });
    }
  };

  const handleDelete = async (unit: ListingUnit) => {
    if (!confirm(`Remove unit "${unit.unitIdentifier}"?`)) return;
    try {
      const res = await fetch(`${BASE}/api/listings/${listingId}/units/${unit.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Unit removed" });
      await fetchUnits();
    } catch {
      toast({ title: "Failed to remove unit", variant: "destructive" });
    }
  };

  const registered = units.length;
  const needed = quantity - registered;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3">
        <Fingerprint className="w-5 h-5 mt-0.5 text-primary shrink-0" />
        <div className="flex-1">
          <CardTitle className="text-base">Unit Identifiers</CardTitle>
          <CardDescription>
            Register a VIN, HIN, or serial number for each physical unit.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Coverage indicator */}
        <div className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm border ${
          needed > 0
            ? "bg-amber-50 border-amber-200 text-amber-800"
            : "bg-green-50 border-green-200 text-green-800"
        }`}>
          {needed > 0
            ? <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            : <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />}
          <span>
            {needed > 0
              ? <><strong>{registered} of {quantity}</strong> units have identifiers — <strong>{needed} more needed</strong></>
              : <><strong>All {quantity} unit{quantity > 1 ? "s" : ""}</strong> have identifiers registered</>}
          </span>
        </div>

        {/* Unit list */}
        {loading ? (
          <p className="text-sm text-muted-foreground py-2">Loading…</p>
        ) : units.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 text-center">No units registered yet. Add the first one below.</p>
        ) : (
          <div className="divide-y rounded-lg border overflow-hidden">
            {units.map(unit => (
              <div key={unit.id} className="bg-background">
                {editingId === unit.id ? (
                  <div className="p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Select value={editType} onValueChange={(v: any) => setEditType(v)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="serial">Serial #</SelectItem>
                            <SelectItem value="vin">VIN</SelectItem>
                            <SelectItem value="hin">HIN</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Status</Label>
                        <Select value={editStatus} onValueChange={(v: any) => setEditStatus(v)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="rented">Rented</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="retired">Retired</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{TYPE_LABELS[editType]} Number <span className="text-destructive">*</span></Label>
                      <Input className="h-8 text-sm font-mono" value={editIdentifier} onChange={e => setEditIdentifier(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Nickname / Label (optional)</Label>
                      <Input className="h-8 text-sm" placeholder="e.g. Unit A, Jet Ski #1" value={editLabel} onChange={e => setEditLabel(e.target.value)} />
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="h-7 text-xs gap-1">
                        <X className="w-3 h-3" /> Cancel
                      </Button>
                      <Button size="sm" onClick={() => handleEdit(unit)} className="h-7 text-xs gap-1">
                        <Check className="w-3 h-3" /> Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {TYPE_LABELS[unit.identifierType]}
                        </span>
                        <span className="font-mono text-sm font-medium truncate">{unit.unitIdentifier}</span>
                        {unit.label && (
                          <span className="text-sm text-muted-foreground truncate">— {unit.label}</span>
                        )}
                      </div>
                    </div>
                    <Badge className={`text-xs border shrink-0 ${STATUS_COLORS[unit.status]}`} variant="outline">
                      {unit.status}
                    </Badge>
                    <button onClick={() => startEdit(unit)} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(unit)} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add new unit form */}
        {adding ? (
          <div className="rounded-xl border border-dashed p-4 space-y-3 bg-muted/30">
            <p className="text-sm font-medium">Add New Unit</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Identifier Type <span className="text-destructive">*</span></Label>
                <Select value={newType} onValueChange={(v: any) => setNewType(v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="serial">Serial #</SelectItem>
                    <SelectItem value="vin">VIN (Vehicle)</SelectItem>
                    <SelectItem value="hin">HIN (Watercraft)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{TYPE_LABELS[newType]} Number <span className="text-destructive">*</span></Label>
                <Input
                  className="h-8 text-sm font-mono"
                  placeholder={newType === "vin" ? "1HGBH41JXMN109186" : newType === "hin" ? "ABC12345D202" : "SN-00001"}
                  value={newIdentifier}
                  onChange={e => setNewIdentifier(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAdd())}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nickname / Label (optional)</Label>
              <Input
                className="h-8 text-sm"
                placeholder="e.g. Unit A, Jet Ski #1, Boat #2"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button size="sm" variant="outline" onClick={() => { setAdding(false); setNewIdentifier(""); setNewLabel(""); }} className="h-8 text-xs gap-1">
                <X className="w-3 h-3" /> Cancel
              </Button>
              <Button size="sm" onClick={handleAdd} className="h-8 text-xs gap-1">
                <Plus className="w-3 h-3" /> Add Unit
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 w-full border-dashed"
            onClick={() => setAdding(true)}
            disabled={registered >= quantity * 2}
          >
            <Plus className="w-4 h-4" />
            Add Unit Identifier
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
