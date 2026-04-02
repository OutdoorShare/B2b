import { useState, useEffect } from "react";
import { Link } from "wouter";
import { adminPath, getAdminSession } from "@/lib/admin-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, Package, Wrench, AlertTriangle, CheckCircle2,
  Archive, Clock, ChevronRight, ImageIcon, Filter,
} from "lucide-react";

type ProductStatus = "available" | "maintenance" | "damaged" | "reserved" | "out_of_service";

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
  nextMaintenanceDate: string | null;
  createdAt: string;
};

const STATUS_CONFIG: Record<ProductStatus, { label: string; color: string; icon: React.ElementType }> = {
  available:     { label: "Available",     color: "bg-green-100 text-green-700 border-green-200",   icon: CheckCircle2 },
  maintenance:   { label: "Maintenance",   color: "bg-orange-100 text-orange-700 border-orange-200", icon: Wrench },
  damaged:       { label: "Damaged",       color: "bg-red-100 text-red-700 border-red-200",          icon: AlertTriangle },
  reserved:      { label: "Reserved",      color: "bg-blue-100 text-blue-700 border-blue-200",       icon: Clock },
  out_of_service:{ label: "Out of Service",color: "bg-gray-100 text-gray-600 border-gray-200",       icon: Archive },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as ProductStatus[];

export default function AdminInventory() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<ProductStatus | "all">("all");
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  const adminHeaders = (): Record<string, string> => {
    const s = getAdminSession();
    return s?.token ? { "x-admin-token": s.token } : {};
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${BASE}/api/products`, { headers: adminHeaders() });
      if (res.ok) setProducts(await res.json());
    } catch {
      toast({ title: "Failed to load products", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const filtered = products.filter(p => {
    const matchSearch = !search
      || p.name.toLowerCase().includes(search.toLowerCase())
      || (p.sku ?? "").toLowerCase().includes(search.toLowerCase())
      || (p.brand ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // Summary counts
  const counts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = products.filter(p => p.status === s).length;
    return acc;
  }, {} as Record<ProductStatus, number>);

  const maintenanceDueSoon = products.filter(p => {
    if (!p.nextMaintenanceDate) return false;
    const due = new Date(p.nextMaintenanceDate);
    const diff = (due.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 14;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Inventory</h2>
          <p className="text-muted-foreground mt-1">Track your physical equipment, maintenance, and availability</p>
        </div>
        <Link href={adminPath("/inventory/new")}>
          <Button className="gap-2">
            <Plus className="w-4 h-4" /> Add Product
          </Button>
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-background rounded-xl border p-4 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Total Products</p>
          <p className="text-2xl font-bold">{products.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1">
          <p className="text-xs text-green-700 font-medium">Available</p>
          <p className="text-2xl font-bold text-green-800">{counts.available ?? 0}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-1">
          <p className="text-xs text-orange-700 font-medium">In Maintenance</p>
          <p className="text-2xl font-bold text-orange-800">{counts.maintenance ?? 0}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
          <p className="text-xs text-red-700 font-medium">Damaged</p>
          <p className="text-2xl font-bold text-red-800">{counts.damaged ?? 0}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
          <p className="text-xs text-amber-700 font-medium">Maintenance Due (14d)</p>
          <p className="text-2xl font-bold text-amber-800">{maintenanceDueSoon}</p>
        </div>
      </div>

      {/* Search + filter */}
      <div className="bg-background rounded-2xl border p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, SKU, or brand…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={filterStatus === "all" ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setFilterStatus("all")}
            >
              <Filter className="w-3.5 h-3.5" /> All
            </Button>
            {ALL_STATUSES.map(s => {
              const cfg = STATUS_CONFIG[s];
              return (
                <Button
                  key={s}
                  variant={filterStatus === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
                >
                  {cfg.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Product list */}
      <div className="bg-background rounded-2xl border overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-3 text-muted animate-pulse" />
            <p>Loading inventory…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground space-y-3">
            <Package className="w-12 h-12 mx-auto text-muted" />
            <div>
              <p className="font-medium">
                {products.length === 0 ? "No products yet" : "No products match your search"}
              </p>
              <p className="text-sm mt-1">
                {products.length === 0
                  ? "Add your first product to start tracking inventory."
                  : "Try a different search or filter."}
              </p>
            </div>
            {products.length === 0 && (
              <Link href={adminPath("/inventory/new")}>
                <Button size="sm" className="gap-2 mt-2"><Plus className="w-4 h-4" /> Add Product</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map(product => {
              const cfg = STATUS_CONFIG[product.status];
              const StatusIcon = cfg.icon;
              const thumb = product.imageUrls[0];
              const dueDate = product.nextMaintenanceDate ? new Date(product.nextMaintenanceDate) : null;
              const daysUntilDue = dueDate
                ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null;
              return (
                <Link key={product.id} href={adminPath(`/inventory/${product.id}`)}>
                  <div className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer group">
                    {/* Thumbnail */}
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0 overflow-hidden border">
                      {thumb
                        ? <img src={thumb} alt={product.name} className="w-full h-full object-cover" />
                        : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate">{product.name}</p>
                        {product.sku && (
                          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {product.sku}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                        <span className="text-xs text-muted-foreground">Qty: {product.quantity}</span>
                        {product.brand && <span className="text-xs text-muted-foreground">{product.brand}{product.model ? ` · ${product.model}` : ""}</span>}
                        {daysUntilDue !== null && (
                          <span className={`text-xs flex items-center gap-1 ${daysUntilDue <= 7 ? "text-red-600 font-semibold" : daysUntilDue <= 14 ? "text-amber-600" : "text-muted-foreground"}`}>
                            <Wrench className="w-3 h-3" />
                            Maintenance {daysUntilDue < 0 ? `overdue by ${Math.abs(daysUntilDue)}d` : daysUntilDue === 0 ? "due today" : `due in ${daysUntilDue}d`}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
