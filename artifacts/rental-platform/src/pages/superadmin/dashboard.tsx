import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Search, RefreshCcw, Calendar, User, Building2,
  Package, Clock, CheckCircle2, XCircle, AlertTriangle,
  ChevronRight, ShieldAlert, Activity, CalendarCheck, Hourglass,
  CircleSlash, ExternalLink, Filter, Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format, isAfter, isBefore, parseISO, startOfToday } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function getToken() { return localStorage.getItem("superadmin_token") ?? ""; }
async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-superadmin-token": token, ...opts?.headers },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Request failed");
  return res.json();
}

type Booking = {
  id: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  status: "pending" | "confirmed" | "active" | "completed" | "cancelled";
  source: string;
  createdAt: string;
  companyName: string | null;
  companySlug: string | null;
  listingTitle: string | null;
};

type Claim = {
  id: number;
  bookingId: number;
  customerName: string;
  type: string;
  claimedAmount: number | null;
  status: string;
  createdAt: string;
  companyName: string | null;
  companySlug: string | null;
};

type Tab = "all" | "pending" | "active" | "upcoming" | "completed" | "cancelled" | "claims";

const STATUS_META: Record<string, { label: string; chip: string }> = {
  pending:   { label: "Pending",   chip: "bg-amber-500/20 text-amber-300 border border-amber-500/30" },
  confirmed: { label: "Confirmed", chip: "bg-blue-500/20 text-blue-300 border border-blue-500/30" },
  active:    { label: "Active",    chip: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" },
  completed: { label: "Completed", chip: "bg-slate-500/20 text-slate-300 border border-slate-500/30" },
  cancelled: { label: "Cancelled", chip: "bg-red-500/20 text-red-400 border border-red-500/30" },
};

const CLAIM_STATUS_META: Record<string, string> = {
  open:     "bg-red-500/20 text-red-300 border border-red-500/30",
  reviewing:"bg-amber-500/20 text-amber-300 border border-amber-500/30",
  settled:  "bg-slate-500/20 text-slate-400 border border-slate-600",
  closed:   "bg-slate-700 text-slate-500 border border-slate-700",
};

export default function SuperAdminDashboard() {
  const [, setLocation] = useLocation();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("all");

  const today = startOfToday();

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { setLocation("/superadmin"); return; }
    setLoading(true);
    setClaimsLoading(true);
    try {
      const [bData, cData] = await Promise.all([
        apiFetch("/superadmin/bookings?limit=400"),
        apiFetch("/superadmin/claims"),
      ]);
      setBookings(bData);
      setClaims(cData);
    } catch { /* ignore */ } finally {
      setLoading(false);
      setClaimsLoading(false);
    }
  }, [setLocation]);

  useEffect(() => { load(); }, [load]);

  // Classify bookings for stats
  const stats = useMemo(() => {
    const pending = bookings.filter(b => b.status === "pending").length;
    const active = bookings.filter(b => b.status === "active").length;
    const upcoming = bookings.filter(b => b.status === "confirmed" && isAfter(parseISO(b.startDate), today)).length;
    const completed = bookings.filter(b => b.status === "completed").length;
    const cancelled = bookings.filter(b => b.status === "cancelled").length;
    const openClaims = claims.filter(c => c.status === "open" || c.status === "reviewing").length;
    return { pending, active, upcoming, completed, cancelled, openClaims };
  }, [bookings, claims, today]);

  // Filter bookings by tab + search
  const filteredBookings = useMemo(() => {
    let list = bookings;
    if (activeTab === "pending")   list = list.filter(b => b.status === "pending");
    if (activeTab === "active")    list = list.filter(b => b.status === "active");
    if (activeTab === "upcoming")  list = list.filter(b => b.status === "confirmed" && isAfter(parseISO(b.startDate), today));
    if (activeTab === "completed") list = list.filter(b => b.status === "completed");
    if (activeTab === "cancelled") list = list.filter(b => b.status === "cancelled");
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        b.customerName.toLowerCase().includes(q) ||
        b.customerEmail.toLowerCase().includes(q) ||
        (b.listingTitle ?? "").toLowerCase().includes(q) ||
        (b.companyName ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [bookings, activeTab, search, today]);

  const filteredClaims = useMemo(() => {
    if (!search) return claims;
    const q = search.toLowerCase();
    return claims.filter(c =>
      c.customerName.toLowerCase().includes(q) ||
      (c.companyName ?? "").toLowerCase().includes(q) ||
      c.type.toLowerCase().includes(q)
    );
  }, [claims, search]);

  const statCards = [
    { tab: "pending" as Tab,   icon: Hourglass,     label: "Pending",      value: stats.pending,    color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
    { tab: "active" as Tab,    icon: Activity,      label: "Active Now",   value: stats.active,     color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { tab: "upcoming" as Tab,  icon: CalendarCheck, label: "Upcoming",     value: stats.upcoming,   color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" },
    { tab: "completed" as Tab, icon: CheckCircle2,  label: "Completed",    value: stats.completed,  color: "text-slate-400",   bg: "bg-slate-800 border-slate-700" },
    { tab: "cancelled" as Tab, icon: CircleSlash,   label: "Cancelled",    value: stats.cancelled,  color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20" },
    { tab: "claims" as Tab,    icon: ShieldAlert,   label: "Open Claims",  value: stats.openClaims, color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20" },
  ];

  const tabs: { id: Tab; label: string }[] = [
    { id: "all",       label: "All Bookings" },
    { id: "pending",   label: "Pending" },
    { id: "active",    label: "Active" },
    { id: "upcoming",  label: "Upcoming" },
    { id: "completed", label: "Completed" },
    { id: "cancelled", label: "Cancelled" },
    { id: "claims",    label: "Claims" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Bookings Overview</h1>
          <p className="text-slate-400 text-sm mt-0.5">All bookings, claims, and activity across every company.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={load} disabled={loading} className="text-slate-400 hover:text-white hover:bg-slate-800">
          <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map(({ tab, icon: Icon, label, value, color, bg }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-xl border p-4 text-left transition-all hover:scale-[1.02] ${bg} ${activeTab === tab ? "ring-2 ring-white/20" : ""}`}
          >
            <Icon className={`w-5 h-5 mb-2 ${color}`} />
            <p className={`text-2xl font-black ${color}`}>{loading ? "—" : value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Search + Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customer, company, or item…"
              className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-9 focus:border-emerald-500"
            />
          </div>
          {search && (
            <button onClick={() => setSearch("")} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> Clear
            </button>
          )}
          <p className="text-xs text-slate-500 ml-auto">
            {activeTab === "claims" ? `${filteredClaims.length} claims` : `${filteredBookings.length} bookings`}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-slate-800 scrollbar-none">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                activeTab === t.id
                  ? "text-white border-b-2 border-emerald-400 bg-slate-800/60"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
              }`}
            >
              {t.label}
              {t.id !== "all" && t.id !== "claims" && (
                <span className="text-[10px] bg-slate-700 text-slate-300 rounded-full px-1.5 py-0.5 font-bold">
                  {t.id === "pending" ? stats.pending : t.id === "active" ? stats.active : t.id === "upcoming" ? stats.upcoming : t.id === "completed" ? stats.completed : stats.cancelled}
                </span>
              )}
              {t.id === "claims" && stats.openClaims > 0 && (
                <span className="text-[10px] bg-red-500/20 text-red-400 rounded-full px-1.5 py-0.5 font-bold border border-red-500/30">
                  {stats.openClaims}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── CLAIMS TAB ── */}
        {activeTab === "claims" ? (
          claimsLoading ? (
            <div className="p-12 text-center text-slate-500 text-sm">Loading claims…</div>
          ) : filteredClaims.length === 0 ? (
            <div className="p-12 text-center">
              <ShieldAlert className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 font-semibold">{search ? "No claims match your search" : "No claims yet"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left">
                    {["Customer", "Company", "Type", "Amount", "Status", "Created"].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredClaims.map(c => (
                    <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-white">{c.customerName}</p>
                        <p className="text-xs text-slate-500">Booking #{c.bookingId}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        {c.companyName ? (
                          <div className="flex items-center gap-1">
                            <span className="text-slate-300">{c.companyName}</span>
                          </div>
                        ) : <span className="text-slate-600 italic">Unknown</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="capitalize text-slate-300">{c.type?.replace(/_/g, " ")}</span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-200 font-medium">
                        {c.claimedAmount != null ? `$${c.claimedAmount.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${CLAIM_STATUS_META[c.status] ?? "bg-slate-700 text-slate-400"}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 text-xs">
                        {format(new Date(c.createdAt), "MMM d, yyyy")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* ── BOOKINGS TABLE ── */
          loading ? (
            <div className="p-12 text-center text-slate-500 text-sm">Loading bookings…</div>
          ) : filteredBookings.length === 0 ? (
            <div className="p-12 text-center">
              <Inbox className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 font-semibold">
                {search ? "No bookings match your search" : `No ${activeTab === "all" ? "" : activeTab} bookings yet`}
              </p>
              {search && (
                <button onClick={() => setSearch("")} className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 underline">
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left">
                    {["Customer", "Company", "Item", "Dates", "Status", "Total", "Booked"].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map(b => {
                    const isUpcoming = b.status === "confirmed" && isAfter(parseISO(b.startDate), today);
                    const isOverdue  = (b.status === "active" || b.status === "confirmed") && isBefore(parseISO(b.endDate), today);
                    return (
                      <tr key={b.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0 text-[11px] font-bold text-slate-300 uppercase">
                              {b.customerName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate max-w-[140px]">{b.customerName}</p>
                              <p className="text-xs text-slate-500 truncate max-w-[140px]">{b.customerEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {b.companyName ? (
                            <div className="flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span className="text-slate-300 truncate max-w-[120px]">{b.companyName}</span>
                            </div>
                          ) : <span className="text-slate-600 italic text-xs">No company</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          {b.listingTitle ? (
                            <p className="text-slate-300 truncate max-w-[160px]" title={b.listingTitle}>{b.listingTitle}</p>
                          ) : <span className="text-slate-600 italic text-xs">Unknown item</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1 text-slate-300 whitespace-nowrap">
                            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="text-xs">{format(parseISO(b.startDate), "MMM d")} – {format(parseISO(b.endDate), "MMM d, yyyy")}</span>
                          </div>
                          {isOverdue && (
                            <span className="text-[10px] text-red-400 font-semibold flex items-center gap-0.5 mt-0.5">
                              <AlertTriangle className="w-3 h-3" /> Overdue
                            </span>
                          )}
                          {isUpcoming && (
                            <span className="text-[10px] text-blue-400 font-semibold flex items-center gap-0.5 mt-0.5">
                              <CalendarCheck className="w-3 h-3" /> Upcoming
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_META[b.status]?.chip ?? "bg-slate-700 text-slate-400"}`}>
                            {STATUS_META[b.status]?.label ?? b.status}
                          </span>
                          {b.source && b.source !== "online" && (
                            <p className="text-[10px] text-slate-500 capitalize mt-0.5">{b.source}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-200 font-semibold">
                          ${b.totalPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                          {format(new Date(b.createdAt), "MMM d, yyyy")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
