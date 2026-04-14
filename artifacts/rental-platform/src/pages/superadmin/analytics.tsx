import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  DollarSign, Shield, TrendingUp, BookOpen, UserPlus,
  Building2, RefreshCcw, Trophy, Package, Tag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { format } from "date-fns";

const OS_GREEN = "#3ab549";

function getToken() { return localStorage.getItem("superadmin_token") ?? ""; }

async function apiFetch(path: string) {
  return fetch(`/api${path}`, {
    headers: { "x-superadmin-token": getToken() },
  });
}

function fmt$(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

type AnalyticsData = {
  kpi: {
    totalRevenue: number;
    platformCommission: number;
    protectionFees: number;
    totalBookings: number;
    newSignups: number;
    totalCompanies: number;
  };
  sources: { source: string; count: number }[];
  leaderboard: {
    id: number; name: string; slug: string;
    bookingCount: number; totalRevenue: number; commissionPaid: number; createdAt: string;
  }[];
  categories: { name: string; bookingCount: number; totalRevenue: number }[];
  topListings: { id: number; title: string; companyName: string; bookingCount: number; totalRevenue: number }[];
  signupTrend: { month: string; count: number }[];
};

const SOURCE_LABELS: Record<string, string> = {
  online: "Online",
  kiosk: "Kiosk",
  walkin: "Walk-In",
  phone: "Phone",
};
const SOURCE_COLORS: Record<string, string> = {
  online: "#3ab549",
  kiosk: "#29b4d4",
  walkin: "#f59e0b",
  phone: "#a78bfa",
};

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <div className="rounded-lg p-1.5" style={{ backgroundColor: `${color}20` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 -mt-2">{sub}</p>}
    </div>
  );
}

export default function SuperAdminAnalytics() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!localStorage.getItem("superadmin_user")) { setLocation("/superadmin"); return; }
    setLoading(true);
    try {
      const r = await apiFetch("/superadmin/analytics");
      if (r.status === 401) { setLocation("/superadmin"); return; }
      setData(await r.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [setLocation]);

  useEffect(() => { load(); }, [load]);

  const totalSources = data ? data.sources.reduce((s, r) => s + r.count, 0) : 0;
  const maxCategory = data ? Math.max(...data.categories.map(c => c.totalRevenue), 1) : 1;
  const maxLeader = data ? Math.max(...data.leaderboard.map(l => l.bookingCount), 1) : 1;

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Platform Analytics</h1>
          <p className="text-slate-400 text-sm mt-0.5">Combined metrics across all companies on OutdoorShare.</p>
        </div>
        <Button
          variant="ghost" size="icon"
          onClick={load}
          className="text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 animate-pulse h-28" />
          ))}
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard icon={DollarSign} label="Total Revenue" value={fmt$(data.kpi.totalRevenue)} sub="All non-cancelled" color={OS_GREEN} />
            <KpiCard icon={TrendingUp} label="Platform Commission" value={fmt$(data.kpi.platformCommission)} sub="OutdoorShare take" color="#29b4d4" />
            <KpiCard icon={Shield} label="Protection Fees" value={fmt$(data.kpi.protectionFees)} sub="All time" color="#a78bfa" />
            <KpiCard icon={BookOpen} label="Total Bookings" value={data.kpi.totalBookings.toLocaleString()} color="#f59e0b" />
            <KpiCard icon={UserPlus} label="New Sign-ups" value={String(data.kpi.newSignups)} sub="Last 30 days" color="#f87171" />
            <KpiCard icon={Building2} label="Companies" value={String(data.kpi.totalCompanies)} sub="All tenants" color="#94a3b8" />
          </div>

          {/* Booking Sources + Signup Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sources */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-slate-400" /> Bookings by Source
              </h2>
              {data.sources.length === 0 ? (
                <p className="text-slate-500 text-sm">No data yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.sources.map(s => {
                    const pct = totalSources > 0 ? Math.round((s.count / totalSources) * 100) : 0;
                    const color = SOURCE_COLORS[s.source] ?? "#64748b";
                    return (
                      <div key={s.source} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-300">{SOURCE_LABELS[s.source] ?? s.source}</span>
                          <span className="text-slate-400 tabular-nums">{s.count} <span className="text-slate-600">({pct}%)</span></span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-xs text-slate-600 pt-1">Total: {totalSources} bookings</p>
                </div>
              )}
            </div>

            {/* Signup trend */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-slate-400" /> New Company Sign-ups (Last 6 Months)
              </h2>
              {data.signupTrend.length === 0 ? (
                <p className="text-slate-500 text-sm">No sign-ups in this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.signupTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9" }}
                      cursor={{ fill: "#ffffff10" }}
                      formatter={(v: number) => [v, "Sign-ups"]}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} fill={OS_GREEN} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Company Leaderboard */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Company Leaderboard</h2>
              <span className="text-xs text-slate-500 ml-1">(1 booking = 1 point)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left">
                    {["Rank", "Company", "Points", "Score Bar", "Revenue", "Commission", "Joined"].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.leaderboard.map((row, i) => {
                    const barPct = maxLeader > 0 ? Math.round((row.bookingCount / maxLeader) * 100) : 0;
                    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
                        onClick={() => setLocation(`/superadmin/companies/${row.id}`)}
                      >
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                          {medal ? <span className="text-base">{medal}</span> : `#${i + 1}`}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-white">{row.name}</p>
                          <p className="text-xs text-slate-500 font-mono">/{row.slug}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-lg font-black" style={{ color: i < 3 ? OS_GREEN : "#94a3b8" }}>
                            {row.bookingCount}
                          </span>
                        </td>
                        <td className="px-4 py-3 w-40">
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: OS_GREEN }} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-300 font-medium tabular-nums">
                          {fmt$(row.totalRevenue)}
                        </td>
                        <td className="px-4 py-3 tabular-nums" style={{ color: "#29b4d4" }}>
                          {fmt$(row.commissionPaid)}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {format(new Date(row.createdAt), "MMM d, yyyy")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Category Totals + Top Listings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Totals */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Tag className="w-4 h-4 text-slate-400" /> Revenue by Category
              </h2>
              {data.categories.length === 0 ? (
                <p className="text-slate-500 text-sm">No category data yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.categories.map(c => {
                    const barPct = maxCategory > 0 ? Math.round((c.totalRevenue / maxCategory) * 100) : 0;
                    return (
                      <div key={c.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-300">{c.name}</span>
                          <span className="text-slate-400 tabular-nums">
                            {fmt$(c.totalRevenue)}
                            <span className="text-slate-600 text-xs ml-1.5">{c.bookingCount} bkgs</span>
                          </span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: OS_GREEN }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Listings */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Top Products by Bookings</h2>
              </div>
              {data.topListings.length === 0 ? (
                <p className="text-slate-500 text-sm p-6">No product data yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-left">
                      {["Product", "Company", "Bookings", "Revenue"].map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.topListings.map((l, i) => (
                      <tr key={l.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-600 font-mono mr-2">#{i + 1}</span>
                          <span className="font-medium text-white">{l.title}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{l.companyName}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold" style={{ color: OS_GREEN }}>{l.bookingCount}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-300 tabular-nums">{fmt$(l.totalRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
