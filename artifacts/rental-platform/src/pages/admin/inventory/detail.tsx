import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Link } from "wouter";
import { adminPath, getAdminSession } from "@/lib/admin-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  ArrowLeft, Pencil, Trash2, Plus, Wrench, AlertTriangle,
  CheckCircle2, Clock, Archive, Package, ImageIcon, ExternalLink,
  ChevronRight, CalendarDays, User, DollarSign, Loader2, X,
} from "lucide-react";

type ProductStatus = "available" | "maintenance" | "damaged" | "reserved" | "out_of_service";
type LogType = "scheduled" | "repair" | "inspection" | "cleaning" | "other";

type Product = {
  id: number;
  name: string;
  sku: string | null;
  categoryId: number | null;
  status: ProductStatus;
  quantity: number;
  imageUrls: string[];
  brand: string | null;
  model: string | null;
  specs: string | null;
  description: string | null;
  notes: string | null;
  nextMaintenanceDate: string | null;
  linkedListings: { id: number; title: string; status: string }[];
  createdAt: string;
  updatedAt: string;
};

type MaintenanceLog = {
  id: number;
  type: LogType;
  performedBy: string | null;
  cost: string | null;
  description: string;
  dateCompleted: string | null;
  nextDue: string | null;
  createdAt: string;
};

const STATUS_CONFIG: Record<ProductStatus, { label: string; color: string; icon: React.ElementType }> = {
  available:     { label: "Available",      color: "bg-green-100 text-green-700 border-green-200",   icon: CheckCircle2 },
  maintenance:   { label: "Maintenance",    color: "bg-orange-100 text-orange-700 border-orange-200", icon: Wrench },
  damaged:       { label: "Damaged",        color: "bg-red-100 text-red-700 border-red-200",          icon: AlertTriangle },
  reserved:      { label: "Reserved",       color: "bg-blue-100 text-blue-700 border-blue-200",       icon: Clock },
  out_of_service:{ label: "Out of Service", color: "bg-gray-100 text-gray-600 border-gray-200",       icon: Archive },
};

const LOG_TYPE_LABELS: Record<LogType, string> = {
  scheduled: "Scheduled Service",
  repair: "Repair",
  inspection: "Inspection",
  cleaning: "Cleaning",
  other: "Other",
};

export default function AdminInventoryDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  const [product, setProduct] = useState<Product | null>(null);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Status change
  const [statusSaving, setStatusSaving] = useState(false);

  // Log form
  const [showLogForm, setShowLogForm] = useState(false);
  const [logForm, setLogForm] = useState({
    type: "other" as LogType,
    description: "",
    performedBy: "",
    cost: "",
    dateCompleted: new Date().toISOString().split("T")[0],
    nextDue: "",
  });
  const [logSaving, setLogSaving] = useState(false);

  const adminHeaders = (): Record<string, string> => {
    const s = getAdminSession();
    return s?.token ? { "x-admin-token": s.token } : {};
  };

  const fetchAll = async () => {
    try {
      const [pRes, lRes] = await Promise.all([
        fetch(`${BASE}/api/products/${id}`, { headers: adminHeaders() }),
        fetch(`${BASE}/api/products/${id}/maintenance`, { headers: adminHeaders() }),
      ]);
      if (pRes.ok) setProduct(await pRes.json());
      if (lRes.ok) setLogs(await lRes.json());
    } catch {
      toast({ title: "Failed to load product", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [id]);

  const handleStatusChange = async (newStatus: ProductStatus) => {
    if (!product) return;
    setStatusSaving(true);
    try {
      const res = await fetch(`${BASE}/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProduct(prev => prev ? { ...prev, status: updated.status } : prev);
        toast({ title: `Status updated to ${STATUS_CONFIG[newStatus].label}` });
      }
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    } finally {
      setStatusSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${BASE}/api/products/${id}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      if (res.ok) {
        toast({ title: "Product deleted" });
        navigate(adminPath("/inventory"));
      }
    } catch {
      toast({ title: "Failed to delete product", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logForm.description.trim()) {
      toast({ title: "Description is required", variant: "destructive" });
      return;
    }
    setLogSaving(true);
    try {
      const res = await fetch(`${BASE}/api/products/${id}/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({
          type: logForm.type,
          description: logForm.description.trim(),
          performedBy: logForm.performedBy.trim() || null,
          cost: logForm.cost ? Number(logForm.cost) : null,
          dateCompleted: logForm.dateCompleted || null,
          nextDue: logForm.nextDue || null,
        }),
      });
      if (res.ok) {
        toast({ title: "Maintenance logged" });
        setShowLogForm(false);
        setLogForm({
          type: "other",
          description: "",
          performedBy: "",
          cost: "",
          dateCompleted: new Date().toISOString().split("T")[0],
          nextDue: "",
        });
        fetchAll();
      }
    } catch {
      toast({ title: "Failed to log maintenance", variant: "destructive" });
    } finally {
      setLogSaving(false);
    }
  };

  const deleteLog = async (logId: number) => {
    try {
      await fetch(`${BASE}/api/products/${id}/maintenance/${logId}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      setLogs(prev => prev.filter(l => l.id !== logId));
    } catch {
      toast({ title: "Failed to delete log entry", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading product…
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        <Package className="w-12 h-12 mx-auto mb-3 text-muted" />
        <p className="font-medium">Product not found</p>
        <Link href={adminPath("/inventory")}>
          <Button variant="outline" size="sm" className="mt-4 gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Inventory
          </Button>
        </Link>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[product.status];
  const StatusIcon = cfg.icon;
  const dueDate = product.nextMaintenanceDate ? new Date(product.nextMaintenanceDate) : null;
  const daysUntilDue = dueDate
    ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={adminPath("/inventory")}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold">{product.name}</h2>
            {product.sku && (
              <p className="text-xs font-mono text-muted-foreground mt-0.5">{product.sku}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={adminPath(`/inventory/${id}/edit`)}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
        </div>
      </div>

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-3">
          <p className="font-semibold text-red-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Confirm Deletion
          </p>
          <p className="text-sm text-red-700">
            Deleting <strong>{product.name}</strong> will remove all its maintenance history and unlink it from any associated listings. The listings themselves will not be deleted. This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="gap-1.5">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {deleting ? "Deleting…" : "Yes, Delete"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Photos */}
          {product.imageUrls.length > 0 && (
            <div className="bg-background rounded-2xl border overflow-hidden">
              <div className="flex gap-0 overflow-x-auto">
                {product.imageUrls.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={product.name}
                    className="h-52 w-auto object-cover shrink-0 first:rounded-l-2xl last:rounded-r-2xl"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {(product.description || product.specs) && (
            <div className="bg-background rounded-2xl border p-5 space-y-3">
              {product.description && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Description</p>
                  <p className="text-sm leading-relaxed">{product.description}</p>
                </div>
              )}
              {product.specs && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Specs</p>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{product.specs}</p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {product.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Internal Notes</p>
              <p className="text-sm text-amber-800 leading-relaxed">{product.notes}</p>
            </div>
          )}

          {/* Linked listings */}
          {product.linkedListings?.length > 0 && (
            <div className="bg-background rounded-2xl border overflow-hidden">
              <div className="px-5 py-3 border-b bg-muted/20">
                <p className="text-sm font-semibold">Linked Listings ({product.linkedListings.length})</p>
              </div>
              <div className="divide-y">
                {product.linkedListings.map(l => (
                  <Link key={l.id} href={adminPath(`/listings/${l.id}`)}>
                    <div className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 cursor-pointer transition-colors group">
                      <span className="text-sm font-medium">{l.title}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${l.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                          {l.status}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Maintenance Log */}
          <div className="bg-background rounded-2xl border overflow-hidden">
            <div className="px-5 py-4 border-b bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">Maintenance Log</h3>
                {logs.length > 0 && (
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                    {logs.length} {logs.length === 1 ? "entry" : "entries"}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setShowLogForm(v => !v)}
              >
                <Plus className="w-3.5 h-3.5" />
                Log Maintenance
              </Button>
            </div>

            {/* Log form */}
            {showLogForm && (
              <form onSubmit={handleLogSubmit} className="p-5 space-y-4 border-b bg-blue-50/40">
                <p className="text-sm font-semibold text-blue-900">New Maintenance Entry</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select value={logForm.type} onValueChange={v => setLogForm(p => ({ ...p, type: v as LogType }))}>
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(LOG_TYPE_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date Completed</Label>
                    <Input
                      type="date"
                      value={logForm.dateCompleted}
                      onChange={e => setLogForm(p => ({ ...p, dateCompleted: e.target.value }))}
                      className="bg-background"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>Description *</Label>
                    <Textarea
                      value={logForm.description}
                      onChange={e => setLogForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="What was done? e.g. Replaced tent poles, patched canoe hull, tuned brakes…"
                      rows={2}
                      className="bg-background"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Performed By</Label>
                    <Input
                      value={logForm.performedBy}
                      onChange={e => setLogForm(p => ({ ...p, performedBy: e.target.value }))}
                      placeholder="Name or company"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cost (optional)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={logForm.cost}
                      onChange={e => setLogForm(p => ({ ...p, cost: e.target.value }))}
                      placeholder="$0.00"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Next Service Due</Label>
                    <Input
                      type="date"
                      value={logForm.nextDue}
                      onChange={e => setLogForm(p => ({ ...p, nextDue: e.target.value }))}
                      className="bg-background"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={logSaving} className="gap-1.5">
                    {logSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    {logSaving ? "Saving…" : "Add Entry"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowLogForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {/* Log entries */}
            {logs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground space-y-2">
                <Wrench className="w-8 h-8 mx-auto text-muted" />
                <p className="text-sm">No maintenance logged yet.</p>
                <p className="text-xs">Click "Log Maintenance" to record service, repairs, or inspections.</p>
              </div>
            ) : (
              <div className="divide-y">
                {logs.map(log => (
                  <div key={log.id} className="px-5 py-4 flex gap-4 group">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {LOG_TYPE_LABELS[log.type]}
                        </span>
                        {log.dateCompleted && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            {format(new Date(log.dateCompleted), "MMM d, yyyy")}
                          </span>
                        )}
                        {log.performedBy && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="w-3 h-3" /> {log.performedBy}
                          </span>
                        )}
                        {log.cost && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <DollarSign className="w-3 h-3" /> ${parseFloat(log.cost).toFixed(2)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed">{log.description}</p>
                      {log.nextDue && (
                        <p className="text-xs text-amber-700 flex items-center gap-1 font-medium">
                          <Wrench className="w-3 h-3" />
                          Next service due: {format(new Date(log.nextDue), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteLog(log.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 shrink-0"
                      title="Delete entry"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column — status & quick actions */}
        <div className="space-y-4">
          {/* Status card */}
          <div className="bg-background rounded-2xl border p-5 space-y-4">
            <h3 className="font-semibold text-sm">Status</h3>
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2 border text-sm font-semibold ${cfg.color}`}>
              <StatusIcon className="w-4 h-4" />
              {cfg.label}
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Change Status</p>
              <div className="space-y-1.5">
                {(["available", "maintenance", "damaged", "reserved", "out_of_service"] as ProductStatus[]).map(s => {
                  const c = STATUS_CONFIG[s];
                  const Icon = c.icon;
                  return (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      disabled={product.status === s || statusSaving}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left transition-all border
                        ${product.status === s
                          ? `${c.color} cursor-default`
                          : "bg-muted/30 border-transparent hover:bg-muted/60 text-muted-foreground hover:text-foreground"}`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      {c.label}
                      {product.status === s && <span className="ml-auto text-[10px] font-bold">CURRENT</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Details card */}
          <div className="bg-background rounded-2xl border p-5 space-y-3">
            <h3 className="font-semibold text-sm">Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quantity</span>
                <span className="font-medium">{product.quantity}</span>
              </div>
              {product.brand && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Brand</span>
                  <span className="font-medium">{product.brand}</span>
                </div>
              )}
              {product.model && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Model</span>
                  <span className="font-medium">{product.model}</span>
                </div>
              )}
              {dueDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Next Maintenance</span>
                  <span className={`font-medium ${daysUntilDue !== null && daysUntilDue < 0 ? "text-red-600" : daysUntilDue !== null && daysUntilDue <= 14 ? "text-amber-600" : ""}`}>
                    {format(dueDate, "MMM d, yyyy")}
                  </span>
                </div>
              )}
              {daysUntilDue !== null && (
                <div className={`rounded-lg px-3 py-2 text-xs font-medium ${daysUntilDue < 0 ? "bg-red-50 text-red-700 border border-red-200" : daysUntilDue <= 14 ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
                  {daysUntilDue < 0
                    ? `⚠️ Overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? "s" : ""}`
                    : daysUntilDue === 0
                      ? "⚠️ Due today"
                      : `✓ Due in ${daysUntilDue} day${daysUntilDue !== 1 ? "s" : ""}`}
                </div>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-background rounded-2xl border p-5 space-y-3">
            <h3 className="font-semibold text-sm">Quick Actions</h3>
            <div className="space-y-2">
              <Link href={adminPath(`/listings/new?productId=${product.id}&productName=${encodeURIComponent(product.name)}`)}>
                <Button variant="outline" size="sm" className="w-full gap-2 justify-start">
                  <ExternalLink className="w-3.5 h-3.5" /> Create Listing from Product
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 justify-start text-orange-700 border-orange-200 hover:bg-orange-50"
                onClick={() => handleStatusChange("maintenance")}
                disabled={product.status === "maintenance" || statusSaving}
              >
                <Wrench className="w-3.5 h-3.5" /> Put into Maintenance
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 justify-start text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => handleStatusChange("damaged")}
                disabled={product.status === "damaged" || statusSaving}
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Mark as Damaged
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
