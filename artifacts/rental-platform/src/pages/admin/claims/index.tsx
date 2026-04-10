import { adminPath } from "@/lib/admin-nav";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { CustomerContactPopover } from "@/components/admin/customer-contact-popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShieldAlert, Plus, Search, ChevronRight,
  AlertTriangle, Clock, CheckCircle2, XCircle, DollarSign
} from "lucide-react";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ClaimStatus = "open" | "reviewing" | "resolved" | "denied";
type ClaimType = "damage" | "theft" | "overage" | "dispute" | "policy_violation" | "other";

interface Claim {
  id: number;
  bookingId: number | null;
  listingId: number | null;
  customerName: string;
  customerEmail: string;
  type: ClaimType;
  description: string;
  claimedAmount: number | null;
  settledAmount: number | null;
  status: ClaimStatus;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<ClaimStatus, { label: string; color: string; icon: any }> = {
  open:       { label: "Open",       color: "bg-red-100 text-red-800",     icon: AlertTriangle },
  reviewing:  { label: "Reviewing",  color: "bg-amber-100 text-amber-800", icon: Clock },
  resolved:   { label: "Resolved",   color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  denied:     { label: "Denied",     color: "bg-muted text-muted-foreground", icon: XCircle },
};

const TYPE_CONFIG: Record<ClaimType, { label: string; color: string }> = {
  damage:           { label: "Damage",           color: "bg-orange-100 text-orange-800" },
  theft:            { label: "Theft",            color: "bg-red-100 text-red-800" },
  overage:          { label: "Overage",          color: "bg-purple-100 text-purple-800" },
  dispute:          { label: "Dispute",          color: "bg-blue-100 text-blue-800" },
  policy_violation: { label: "Policy Violation", color: "bg-amber-100 text-amber-800" },
  other:    { label: "Other",    color: "bg-muted text-muted-foreground" },
};

export default function AdminClaims() {
  const [, setLocation] = useLocation();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/api/claims`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setClaims(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = claims.filter(c => {
    const matchSearch = !search ||
      c.customerName.toLowerCase().includes(search.toLowerCase()) ||
      c.customerEmail.toLowerCase().includes(search.toLowerCase()) ||
      String(c.id).includes(search) ||
      (c.bookingId && String(c.bookingId).includes(search));
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const matchType = typeFilter === "all" || c.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  // Stats
  const totalClaimed = claims.reduce((s, c) => s + (c.claimedAmount ?? 0), 0);
  const totalSettled = claims.reduce((s, c) => s + (c.settledAmount ?? 0), 0);
  const openCount = claims.filter(c => c.status === "open").length;
  const reviewingCount = claims.filter(c => c.status === "reviewing").length;
  const resolvedCount = claims.filter(c => c.status === "resolved").length;
  const deniedCount = claims.filter(c => c.status === "denied").length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-primary" /> Claims
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage damage, theft, and rental dispute claims.
          </p>
        </div>
        <Button onClick={() => setLocation(adminPath("/claims/new"))} className="gap-2">
          <Plus className="w-4 h-4" /> New Claim
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Claims", value: claims.length, icon: ShieldAlert, color: "text-foreground" },
          { label: "Open", value: openCount, icon: AlertTriangle, color: "text-red-600" },
          { label: "Reviewing", value: reviewingCount, icon: Clock, color: "text-amber-600" },
          { label: "Resolved", value: resolvedCount, icon: CheckCircle2, color: "text-green-600" },
          { label: "Denied", value: deniedCount, icon: XCircle, color: "text-muted-foreground" },
          { label: "$ Claimed", value: `$${totalClaimed.toFixed(2)}`, icon: DollarSign, color: "text-foreground", sub: `$${totalSettled.toFixed(2)} settled` },
        ].map(stat => (
          <div key={stat.label} className="bg-background rounded-xl border p-4 space-y-1">
            <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground`}>
              <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
              {stat.label}
            </div>
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            {stat.sub && <p className="text-xs text-muted-foreground">{stat.sub}</p>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="reviewing">Reviewing</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="denied">Denied</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="damage">Damage</SelectItem>
            <SelectItem value="theft">Theft</SelectItem>
            <SelectItem value="overage">Overage</SelectItem>
            <SelectItem value="dispute">Dispute</SelectItem>
            <SelectItem value="policy_violation">Policy Violation</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-background rounded-2xl border overflow-hidden">
        {loading ? (
          <div className="space-y-0 divide-y">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-12" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-muted rounded w-48" />
                  <div className="h-3 bg-muted rounded w-32" />
                </div>
                <div className="h-5 bg-muted rounded w-20" />
                <div className="h-5 bg-muted rounded w-16" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-muted" />
            <p className="font-semibold">No claims found</p>
            <p className="text-sm mt-1">
              {claims.length === 0 ? "Create your first claim to get started." : "Try adjusting your filters."}
            </p>
            {claims.length === 0 && (
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setLocation(adminPath("/claims/new"))}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> New Claim
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-5 py-3 font-semibold">#</th>
                  <th className="text-left px-5 py-3 font-semibold">Customer</th>
                  <th className="text-left px-5 py-3 font-semibold">Type</th>
                  <th className="text-left px-5 py-3 font-semibold hidden md:table-cell">Booking</th>
                  <th className="text-left px-5 py-3 font-semibold hidden lg:table-cell">Claimed</th>
                  <th className="text-left px-5 py-3 font-semibold hidden lg:table-cell">Settled</th>
                  <th className="text-left px-5 py-3 font-semibold">Status</th>
                  <th className="text-left px-5 py-3 font-semibold hidden sm:table-cell">Date</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(claim => {
                  const st = STATUS_CONFIG[claim.status];
                  const ty = TYPE_CONFIG[claim.type];
                  return (
                    <tr
                      key={claim.id}
                      onClick={() => setLocation(adminPath(`/claims/${claim.id}`))}
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-4 font-mono text-xs text-muted-foreground">#{claim.id}</td>
                      <td className="px-5 py-4">
                        <CustomerContactPopover
                          customerName={claim.customerName}
                          customerEmail={claim.customerEmail}
                        />
                        <p className="text-xs text-muted-foreground">{claim.customerEmail}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ty.color}`}>
                          {ty.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        {claim.bookingId
                          ? <span className="text-muted-foreground font-mono text-xs">Booking #{claim.bookingId}</span>
                          : <span className="text-muted-foreground/40">—</span>
                        }
                      </td>
                      <td className="px-5 py-4 hidden lg:table-cell font-semibold">
                        {claim.claimedAmount != null ? `$${claim.claimedAmount.toFixed(2)}` : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-5 py-4 hidden lg:table-cell">
                        {claim.settledAmount != null
                          ? <span className="text-green-700 font-semibold">${claim.settledAmount.toFixed(2)}</span>
                          : <span className="text-muted-foreground/40">—</span>
                        }
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit ${st.color}`}>
                          <st.icon className="w-3 h-3" />
                          {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-muted-foreground hidden sm:table-cell">
                        {format(new Date(claim.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-3 py-4">
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
