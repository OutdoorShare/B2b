import { useState, useEffect, useCallback, useRef } from "react";
import { SuperAdminLayout } from "@/components/layout/superadmin-layout";
import {
  CheckCircle2, XCircle, AlertTriangle, RefreshCcw, Trash2,
  Server, Database, Cpu, MemoryStick, Activity, Bug,
  Shield, Clock, ChevronDown, ChevronUp, Wifi, WifiOff,
  TrendingDown, TrendingUp, Eye, Filter, Building2, Copy, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const OS_GREEN = "#3ab549";

const ISSUE_DESCRIPTIONS: Record<string, { what: string; impact: string }> = {
  "No Stripe Connect account": {
    what: "This tenant has not connected a Stripe account to their business. Stripe is required to charge renters and collect payments.",
    impact: "Renters cannot pay — all bookings will fail at checkout until Stripe is connected.",
  },
  "Stripe account is restricted": {
    what: "Stripe has placed a restriction on this tenant's account. This is usually due to incomplete identity verification, a dispute, or suspicious activity flagged by Stripe.",
    impact: "Payments are blocked. The tenant needs to log into their Stripe dashboard and resolve the restriction.",
  },
  "Stripe charges not yet enabled": {
    what: "The tenant has connected a Stripe account, but Stripe has not yet enabled charges on it. This typically happens when the account is still under review.",
    impact: "Payments cannot be collected until Stripe finishes reviewing and approves the account.",
  },
  "No listings created": {
    what: "This tenant has not added any rental items to their inventory. Their storefront is completely empty.",
    impact: "Customers visiting their storefront see nothing to rent. They need to add at least one listing.",
  },
  "No logo uploaded": {
    what: "The tenant has not uploaded a logo for their business. Their storefront and emails will show a generic placeholder instead of their brand.",
    impact: "Makes the storefront look unfinished. Low priority but affects customer trust.",
  },
  "No phone number set": {
    what: "The tenant's business profile is missing a contact phone number. This is shown on their storefront and contact card.",
    impact: "Customers have no phone number to call if they have questions about a rental.",
  },
  "Trial period expired": {
    what: "This tenant was on a free trial that has now ended. They have not upgraded to a paid subscription plan.",
    impact: "Depending on platform settings, their storefront may be restricted or locked until they upgrade.",
  },
  "Account suspended": {
    what: "This tenant account has been manually suspended — either by the platform owner or automatically by a billing failure.",
    impact: "The tenant cannot accept bookings, and their storefront may show as unavailable to customers.",
  },
};

function getToken() { return localStorage.getItem("superadmin_token") ?? ""; }

async function saFetch(path: string, opts?: RequestInit) {
  return fetch(`/api${path}`, {
    ...opts,
    headers: {
      "x-superadmin-token": getToken(),
      "Content-Type": "application/json",
      ...(opts?.headers ?? {}),
    },
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

type HealthStatus = "ok" | "warn" | "error";

type HealthCheck = {
  name: string;
  status: HealthStatus;
  message: string;
  responseMs?: number;
};

type HealthData = {
  overallStatus: HealthStatus;
  checkedAt: string;
  checks: HealthCheck[];
};

type ErrorLog = {
  id: number;
  level: string;
  method: string | null;
  path: string | null;
  statusCode: number | null;
  message: string | null;
  stack: string | null;
  tenantSlug: string | null;
  userAgent: string | null;
  ip: string | null;
  responseTimeMs: number | null;
  body: string | null;
  createdAt: string;
};

type ErrorsData = { total: number; logs: ErrorLog[] };

type MetricsData = {
  errorsLastHour: number;
  warnsLastHour: number;
  errorsLastDay: number;
  avgResponseMs: number | null;
  topErrors: { path: string | null; statusCode: number | null; count: number }[];
};

type SystemData = {
  server: { nodeVersion: string; platform: string; arch: string; uptimeSeconds: number; pid: number };
  memory: { heapUsedMB: number; heapTotalMB: number; rssMB: number; externalMB: number; heapPercent: number };
  os: { hostname: string; totalMemMB: number; freeMemMB: number; cpuLoad1m: string; cpuLoad5m: string; cpuCores: number };
  database: { tableCounts: Record<string, number> };
  activity: { bookingsLast7Days: number };
  checkedAt: string;
};

type TenantHealthEntry = {
  id: number; name: string; slug: string; plan: string; status: string;
  health: HealthStatus; issues: string[]; warnings: string[];
  listingCount: number; bookingCount: number;
  stripeConnected: boolean; stripeStatus: string | null;
  createdAt: string;
};

type TenantHealthData = {
  summary: { total: number; healthy: number; warnings: number; errors: number };
  tenants: TenantHealthEntry[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusIcon({ status, size = 4 }: { status: HealthStatus; size?: number }) {
  const cls = `w-${size} h-${size}`;
  if (status === "ok") return <CheckCircle2 className={cn(cls, "text-emerald-400")} />;
  if (status === "warn") return <AlertTriangle className={cn(cls, "text-yellow-400")} />;
  return <XCircle className={cn(cls, "text-red-400")} />;
}

function StatusBadge({ status }: { status: HealthStatus }) {
  if (status === "ok") return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-xs">Healthy</Badge>;
  if (status === "warn") return <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/20 text-xs">Warning</Badge>;
  return <Badge className="bg-red-500/15 text-red-400 border-red-500/20 text-xs">Error</Badge>;
}

function LevelBadge({ level }: { level: string }) {
  if (level === "error") return <Badge className="bg-red-500/15 text-red-400 border-red-500/20 text-xs font-mono">ERR</Badge>;
  return <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/20 text-xs font-mono">WARN</Badge>;
}

function uptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${seconds % 60}s`;
}

function MemBar({ pct }: { pct: number }) {
  const color = pct < 60 ? "#3ab549" : pct < 80 ? "#f59e0b" : "#ef4444";
  return (
    <div className="w-full h-1.5 rounded-full bg-slate-700 mt-1">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function IssueItem({ text, level }: { text: string; level: "error" | "warn" }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const desc = ISSUE_DESCRIPTIONS[text];

  function copyText() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className={cn(
      "rounded-lg border text-xs mt-1",
      level === "error" ? "border-red-500/20 bg-red-500/5" : "border-yellow-500/20 bg-yellow-500/5"
    )}>
      <div className="flex items-center gap-2 px-3 py-2">
        {level === "error"
          ? <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          : <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
        <span className={cn("flex-1 font-medium", level === "error" ? "text-red-300" : "text-yellow-300")}>
          {text}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {desc && (
            <button
              onClick={() => setOpen(v => !v)}
              className="text-slate-400 hover:text-slate-200 transition-colors px-1.5 py-0.5 rounded hover:bg-slate-700"
              title="What does this mean?"
            >
              {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          <button
            onClick={copyText}
            className="text-slate-400 hover:text-slate-200 transition-colors px-1.5 py-0.5 rounded hover:bg-slate-700"
            title="Copy issue text"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
      {open && desc && (
        <div className="px-3 pb-3 pt-0 space-y-2 border-t border-slate-700/50">
          <div className="mt-2">
            <p className="text-slate-400 uppercase tracking-wide text-[10px] font-semibold mb-1">What this means</p>
            <p className="text-slate-300 leading-relaxed">{desc.what}</p>
          </div>
          <div>
            <p className="text-slate-400 uppercase tracking-wide text-[10px] font-semibold mb-1">Impact</p>
            <p className={cn("leading-relaxed", level === "error" ? "text-red-300" : "text-yellow-300")}>{desc.impact}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DeveloperPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [errors, setErrors] = useState<ErrorsData | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [system, setSystem] = useState<SystemData | null>(null);
  const [tenantHealth, setTenantHealth] = useState<TenantHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [errorFilter, setErrorFilter] = useState<"all" | "error" | "warn">("all");
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [clearingLogs, setClearingLogs] = useState(false);
  const [cancellingTestBookings, setCancellingTestBookings] = useState(false);
  const [cancelTestResult, setCancelTestResult] = useState<string | null>(null);
  const [tab, setTab] = useState<"health" | "errors" | "tenants" | "system">("health");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [hRes, eRes, mRes, sRes, tRes] = await Promise.all([
        saFetch("/superadmin/developer/health"),
        saFetch("/superadmin/developer/errors?limit=100"),
        saFetch("/superadmin/developer/metrics"),
        saFetch("/superadmin/developer/system"),
        saFetch("/superadmin/developer/tenant-health"),
      ]);
      if (hRes.ok) setHealth(await hRes.json());
      if (eRes.ok) setErrors(await eRes.json());
      if (mRes.ok) setMetrics(await mRes.json());
      if (sRes.ok) setSystem(await sRes.json());
      if (tRes.ok) setTenantHealth(await tRes.json());
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchAll, 30_000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchAll]);

  async function clearLogs() {
    setClearingLogs(true);
    await saFetch("/superadmin/developer/errors", { method: "DELETE" });
    await fetchAll();
    setClearingLogs(false);
  }

  async function cancelTestBookings(tenantId?: number) {
    setCancellingTestBookings(true);
    setCancelTestResult(null);
    try {
      const res = await saFetch("/superadmin/developer/cancel-test-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tenantId ? { tenantId } : {}),
      });
      const data = await res.json().catch(() => ({}));
      setCancelTestResult(`Cancelled ${data.cancelled ?? "?"} test booking(s).`);
    } catch {
      setCancelTestResult("Error — could not cancel test bookings.");
    } finally {
      setCancellingTestBookings(false);
    }
  }

  const filteredLogs = (errors?.logs ?? []).filter(l =>
    errorFilter === "all" ? true : l.level === errorFilter
  );

  const overallOk = health?.overallStatus === "ok";
  const overallWarn = health?.overallStatus === "warn";

  return (
    <SuperAdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Bug className="w-6 h-6" style={{ color: OS_GREEN }} />
              Developer Monitor
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Real-time system health, error tracking, and platform diagnostics
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 text-xs">
              Last check: {format(lastRefresh, "h:mm:ss a")}
            </span>
            <Button
              size="sm"
              variant="outline"
              className={cn(
                "border-slate-700 text-slate-300 hover:bg-slate-800 text-xs h-8",
                autoRefresh && "border-emerald-500/30 text-emerald-400"
              )}
              onClick={() => setAutoRefresh(v => !v)}
            >
              {autoRefresh ? <Wifi className="w-3.5 h-3.5 mr-1" /> : <WifiOff className="w-3.5 h-3.5 mr-1" />}
              {autoRefresh ? "Auto (30s)" : "Paused"}
            </Button>
            <Button
              size="sm"
              className="text-xs h-8"
              onClick={fetchAll}
              disabled={loading}
              style={{ backgroundColor: OS_GREEN }}
            >
              <RefreshCcw className={cn("w-3.5 h-3.5 mr-1.5", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Overall Status Banner */}
        {health && (
          <div className={cn(
            "rounded-xl border px-5 py-3.5 flex items-center gap-3",
            health.overallStatus === "ok"
              ? "bg-emerald-500/10 border-emerald-500/20"
              : health.overallStatus === "warn"
                ? "bg-yellow-500/10 border-yellow-500/20"
                : "bg-red-500/10 border-red-500/20"
          )}>
            <StatusIcon status={health.overallStatus} size={5} />
            <div>
              <p className={cn(
                "font-semibold",
                health.overallStatus === "ok" ? "text-emerald-300" :
                  health.overallStatus === "warn" ? "text-yellow-300" : "text-red-300"
              )}>
                {health.overallStatus === "ok" ? "All systems operational" :
                  health.overallStatus === "warn" ? "Some systems need attention" :
                    "Critical issues detected"}
              </p>
              <p className="text-slate-400 text-xs">
                Checked {formatDistanceToNow(new Date(health.checkedAt), { addSuffix: true })}
                {metrics && (
                  <> · {metrics.errorsLastHour} server errors in last hour · {metrics.warnsLastHour} warnings</>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Metric KPI Row */}
        {metrics && system && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Errors (1h)",
                value: metrics.errorsLastHour,
                icon: XCircle,
                color: metrics.errorsLastHour === 0 ? "text-emerald-400" : "text-red-400",
                sub: `${metrics.errorsLastDay} today`,
              },
              {
                label: "Warnings (1h)",
                value: metrics.warnsLastHour,
                icon: AlertTriangle,
                color: metrics.warnsLastHour === 0 ? "text-emerald-400" : "text-yellow-400",
                sub: "4xx responses",
              },
              {
                label: "Avg Response",
                value: metrics.avgResponseMs != null ? `${metrics.avgResponseMs}ms` : "—",
                icon: Activity,
                color: "text-slate-300",
                sub: "error requests only",
              },
              {
                label: "Heap Used",
                value: `${system.memory.heapPercent}%`,
                icon: MemoryStick,
                color: system.memory.heapPercent < 75 ? "text-emerald-400" : "text-yellow-400",
                sub: `${system.memory.heapUsedMB}/${system.memory.heapTotalMB}MB`,
              },
            ].map(({ label, value, icon: Icon, color, sub }) => (
              <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={cn("w-4 h-4", color)} />
                  <span className="text-slate-400 text-xs">{label}</span>
                </div>
                <p className={cn("text-2xl font-bold", color)}>{value}</p>
                <p className="text-slate-500 text-xs mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-800">
          {([
            { key: "health", label: "Health Checks", icon: Shield },
            { key: "errors", label: `Error Log ${errors ? `(${errors.total})` : ""}`, icon: Bug },
            { key: "tenants", label: "Tenant Audit", icon: Building2 },
            { key: "system", label: "System Info", icon: Server },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                tab === key
                  ? "text-white border-current"
                  : "text-slate-400 border-transparent hover:text-slate-200"
              )}
              style={tab === key ? { borderColor: OS_GREEN, color: OS_GREEN } : {}}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── HEALTH CHECKS TAB ── */}
        {tab === "health" && (
          <div className="grid sm:grid-cols-2 gap-3">
            {(health?.checks ?? Array(10).fill(null)).map((check, i) => (
              check ? (
                <div key={check.name} className={cn(
                  "bg-slate-900 border rounded-xl px-4 py-3.5 flex items-start gap-3",
                  check.status === "ok" ? "border-slate-800" :
                    check.status === "warn" ? "border-yellow-500/20" : "border-red-500/20"
                )}>
                  <StatusIcon status={check.status} size={5} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-slate-200 text-sm font-medium">{check.name}</p>
                      {check.responseMs != null && (
                        <span className="text-slate-500 text-xs font-mono">{check.responseMs}ms</span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5 truncate">{check.message}</p>
                  </div>
                </div>
              ) : (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl h-16 animate-pulse" />
              )
            ))}
          </div>
        )}

        {/* ── ERROR LOG TAB ── */}
        {tab === "errors" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
                {(["all", "error", "warn"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setErrorFilter(f)}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                      errorFilter === f
                        ? "bg-slate-700 text-white"
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    {f === "all" ? "All" : f === "error" ? "Errors" : "Warnings"}
                  </button>
                ))}
              </div>
              <span className="text-slate-500 text-xs ml-auto">
                {filteredLogs.length} of {errors?.total ?? 0} entries
              </span>
              <Button
                size="sm"
                variant="outline"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-8"
                onClick={clearLogs}
                disabled={clearingLogs || !errors?.total}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                {clearingLogs ? "Clearing…" : "Clear All"}
              </Button>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl py-16 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <p className="text-slate-300 font-medium">No errors logged</p>
                <p className="text-slate-500 text-sm mt-1">The platform is running cleanly</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredLogs.map(log => (
                  <div
                    key={log.id}
                    className={cn(
                      "bg-slate-900 border rounded-xl overflow-hidden transition-colors cursor-pointer",
                      log.level === "error" ? "border-red-500/15 hover:border-red-500/30" : "border-yellow-500/15 hover:border-yellow-500/30"
                    )}
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                    <div className="flex items-start gap-3 px-4 py-3">
                      <LevelBadge level={log.level} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {log.method && (
                            <span className="text-xs font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                              {log.method}
                            </span>
                          )}
                          {log.path && (
                            <span className="text-xs font-mono text-slate-300">{log.path}</span>
                          )}
                          {log.statusCode && (
                            <span className={cn(
                              "text-xs font-mono font-bold",
                              log.statusCode >= 500 ? "text-red-400" : "text-yellow-400"
                            )}>
                              {log.statusCode}
                            </span>
                          )}
                          {log.tenantSlug && (
                            <span className="text-xs text-blue-400 font-mono bg-blue-500/10 px-1.5 py-0.5 rounded">
                              /{log.tenantSlug}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 text-xs mt-0.5 truncate">{log.message}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {log.responseTimeMs != null && (
                          <span className="text-slate-600 text-xs font-mono">{log.responseTimeMs}ms</span>
                        )}
                        <span className="text-slate-600 text-xs">
                          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                        </span>
                        {expandedLog === log.id
                          ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                          : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                      </div>
                    </div>
                    {expandedLog === log.id && (
                      <div className="border-t border-slate-800 px-4 py-3 space-y-2 bg-slate-950">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <p className="text-slate-500 mb-0.5">Time</p>
                            <p className="text-slate-300 font-mono">{format(new Date(log.createdAt), "MMM d, HH:mm:ss")}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 mb-0.5">IP</p>
                            <p className="text-slate-300 font-mono">{log.ip ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 mb-0.5">Response time</p>
                            <p className="text-slate-300 font-mono">{log.responseTimeMs != null ? `${log.responseTimeMs}ms` : "—"}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 mb-0.5">User Agent</p>
                            <p className="text-slate-300 font-mono truncate">{log.userAgent ?? "—"}</p>
                          </div>
                        </div>
                        {log.body && (
                          <div>
                            <p className="text-slate-500 text-xs mb-1">Request body (truncated)</p>
                            <pre className="text-slate-400 text-xs bg-slate-900 rounded p-2 overflow-x-auto font-mono whitespace-pre-wrap">
                              {log.body}
                            </pre>
                          </div>
                        )}
                        {log.stack && (
                          <div>
                            <p className="text-slate-500 text-xs mb-1">Stack trace</p>
                            <pre className="text-red-400/80 text-xs bg-slate-900 rounded p-2 overflow-x-auto font-mono whitespace-pre-wrap">
                              {log.stack}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Top Error Paths */}
            {metrics && metrics.topErrors.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mt-4">
                <h3 className="text-slate-300 text-sm font-semibold mb-3 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-400" />
                  Top Error Endpoints (24h)
                </h3>
                <div className="space-y-1.5">
                  {metrics.topErrors.map((e, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <span className="text-slate-600 font-mono w-4">{i + 1}.</span>
                      <span className="font-mono text-slate-300 flex-1 truncate">{e.path ?? "(unknown)"}</span>
                      {e.statusCode && (
                        <span className={cn(
                          "font-mono font-bold px-1.5 py-0.5 rounded",
                          e.statusCode >= 500 ? "text-red-400 bg-red-500/10" : "text-yellow-400 bg-yellow-500/10"
                        )}>
                          {e.statusCode}
                        </span>
                      )}
                      <span className="text-slate-400 font-semibold w-10 text-right">{e.count}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TENANT AUDIT TAB ── */}
        {tab === "tenants" && tenantHealth && (
          <div className="space-y-3">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total", value: tenantHealth.summary.total, color: "text-slate-300" },
                { label: "Healthy", value: tenantHealth.summary.healthy, color: "text-emerald-400" },
                { label: "Warnings", value: tenantHealth.summary.warnings, color: "text-yellow-400" },
                { label: "Issues", value: tenantHealth.summary.errors, color: "text-red-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                  <p className={cn("text-2xl font-bold", color)}>{value}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Tenant list */}
            <div className="space-y-2">
              {tenantHealth.tenants.map(t => (
                <div key={t.id} className={cn(
                  "bg-slate-900 border rounded-xl px-4 py-3.5",
                  t.health === "ok" ? "border-slate-800" :
                    t.health === "warn" ? "border-yellow-500/20" : "border-red-500/20"
                )}>
                  <div className="flex items-center gap-3">
                    <StatusIcon status={t.health} size={4} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-slate-200 text-sm font-semibold">{t.name}</span>
                        <span className="text-slate-500 font-mono text-xs">/{t.slug}</span>
                        <Badge className={cn(
                          "text-xs capitalize",
                          t.plan === "enterprise" ? "bg-purple-500/15 text-purple-300 border-purple-500/20" :
                            t.plan === "professional" ? "bg-blue-500/15 text-blue-300 border-blue-500/20" :
                              "bg-slate-700/50 text-slate-400 border-slate-600"
                        )}>
                          {t.plan}
                        </Badge>
                        {t.status !== "active" && (
                          <Badge className="bg-red-500/15 text-red-300 border-red-500/20 text-xs capitalize">
                            {t.status}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                        <span>{t.listingCount} listings</span>
                        <span>{t.bookingCount} bookings</span>
                        <span className={t.stripeConnected ? "text-emerald-400" : "text-red-400"}>
                          {t.stripeConnected ? "Stripe ✓" : "No Stripe"}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={t.health} />
                  </div>

                  {(t.issues.length > 0 || t.warnings.length > 0) && (
                    <div className="mt-2 pl-7 space-y-1">
                      {t.issues.map(issue => (
                        <IssueItem key={issue} text={issue} level="error" />
                      ))}
                      {t.warnings.map(warn => (
                        <IssueItem key={warn} text={warn} level="warn" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SYSTEM INFO TAB ── */}
        {tab === "system" && system && (
          <div className="space-y-4">

            {/* ── Test Data Management ── */}
            <div className="bg-slate-900 border border-amber-500/20 rounded-xl p-4">
              <h3 className="text-slate-300 text-sm font-semibold mb-1 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-amber-400" />
                Test Data Management
              </h3>
              <p className="text-slate-500 text-xs mb-3">
                Cancel all active/confirmed/pending bookings for test-mode tenants. Safe to run — only affects tenants where <span className="font-mono text-slate-400">testMode = true</span>.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs h-8"
                  onClick={() => cancelTestBookings()}
                  disabled={cancellingTestBookings}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  {cancellingTestBookings ? "Cancelling…" : "Cancel All Test Bookings"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs h-8"
                  onClick={() => cancelTestBookings(8)}
                  disabled={cancellingTestBookings}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  {cancellingTestBookings ? "Cancelling…" : "Reset Demo Tenant Only"}
                </Button>
                {cancelTestResult && (
                  <span className="text-xs text-emerald-400">{cancelTestResult}</span>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Server */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h3 className="text-slate-300 text-sm font-semibold mb-3 flex items-center gap-2">
                  <Server className="w-4 h-4" style={{ color: OS_GREEN }} />
                  API Server
                </h3>
                <div className="space-y-2">
                  {[
                    { label: "Node.js", value: system.server.nodeVersion },
                    { label: "Platform", value: `${system.server.platform} / ${system.server.arch}` },
                    { label: "PID", value: system.server.pid.toString() },
                    { label: "Uptime", value: uptime(system.server.uptimeSeconds) },
                    { label: "Hostname", value: system.os.hostname },
                    { label: "CPU Cores", value: system.os.cpuCores.toString() },
                    { label: "Load (1m / 5m)", value: `${system.os.cpuLoad1m} / ${system.os.cpuLoad5m}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{label}</span>
                      <span className="text-slate-300 font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Memory */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h3 className="text-slate-300 text-sm font-semibold mb-3 flex items-center gap-2">
                  <MemoryStick className="w-4 h-4" style={{ color: OS_GREEN }} />
                  Memory
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-500">Heap</span>
                      <span className="text-slate-300 font-mono">{system.memory.heapUsedMB}MB / {system.memory.heapTotalMB}MB ({system.memory.heapPercent}%)</span>
                    </div>
                    <MemBar pct={system.memory.heapPercent} />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-500">RSS</span>
                      <span className="text-slate-300 font-mono">{system.memory.rssMB}MB</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-500">OS Free</span>
                      <span className="text-slate-300 font-mono">
                        {system.os.freeMemMB}MB / {system.os.totalMemMB}MB
                      </span>
                    </div>
                    <MemBar pct={Math.round(((system.os.totalMemMB - system.os.freeMemMB) / system.os.totalMemMB) * 100)} />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-500">External</span>
                      <span className="text-slate-300 font-mono">{system.memory.externalMB}MB</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* DB Table Counts */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h3 className="text-slate-300 text-sm font-semibold mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4" style={{ color: OS_GREEN }} />
                  Database Row Counts
                </h3>
                <div className="space-y-2">
                  {Object.entries(system.database.tableCounts).map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-mono">{name}</span>
                      <span className="text-slate-300 font-mono font-semibold">
                        {count === -1 ? "err" : count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h3 className="text-slate-300 text-sm font-semibold mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4" style={{ color: OS_GREEN }} />
                  Platform Activity
                </h3>
                <div className="space-y-2">
                  {[
                    { label: "Bookings (7 days)", value: system.activity.bookingsLast7Days.toString() },
                    { label: "Total error logs", value: (errors?.total ?? "—").toString() },
                    { label: "Data snapshot", value: format(new Date(system.checkedAt), "MMM d, h:mm:ss a") },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{label}</span>
                      <span className="text-slate-300 font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
