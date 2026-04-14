import { useRef, useState, useCallback, useEffect } from "react";
import { SuperAdminLayout } from "@/components/layout/superadmin-layout";
import { ExternalLink, RefreshCcw, Zap, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const OS_GREEN = "#3ab549";

function getToken() { return localStorage.getItem("superadmin_token") ?? ""; }

type SyncStatus = {
  totalPlatformFeatures: number;
  synced: number;
  missing: number;
  manifest: Array<{
    name: string; slug: string; description: string;
    status: string; category: string;
    inDocs: boolean; articleCount: number;
  }>;
};

type SyncResult = {
  totalPlatformFeatures: number;
  featuresCreated: number;
  featuresAlreadyExisted: number;
  stubArticlesCreated: number;
  created: string[];
  articlesCreated: string[];
  syncedAt: string;
};

export default function DocsAdminPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);

  // Sync panel state
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncStatusLoading, setSyncStatusLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const docsAdminUrl = `${window.location.origin}/docs/admin`;

  function reloadIframe() {
    setIframeLoading(true);
    setIframeKey(k => k + 1);
  }

  const loadSyncStatus = useCallback(async () => {
    setSyncStatusLoading(true);
    setSyncError(null);
    try {
      const res = await fetch(`/api/superadmin/docs/sync-platform-features`, {
        headers: { "x-superadmin-token": getToken() },
      });
      if (!res.ok) throw new Error("Failed to load");
      setSyncStatus(await res.json());
    } catch {
      setSyncError("Could not load sync status.");
    } finally {
      setSyncStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    if (syncOpen && !syncStatus) loadSyncStatus();
  }, [syncOpen]);

  async function runSync() {
    setSyncing(true);
    setSyncError(null);
    setLastResult(null);
    try {
      const res = await fetch(`/api/superadmin/docs/sync-platform-features`, {
        method: "POST",
        headers: { "x-superadmin-token": getToken(), "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Sync failed");
      const result: SyncResult = await res.json();
      setLastResult(result);
      // Refresh status + iframe
      await loadSyncStatus();
      reloadIframe();
    } catch (e: any) {
      setSyncError(e.message ?? "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const groupedManifest = syncStatus
    ? Object.entries(
        syncStatus.manifest.reduce<Record<string, typeof syncStatus.manifest>>((acc, f) => {
          (acc[f.category] ??= []).push(f);
          return acc;
        }, {})
      )
    : [];

  return (
    <SuperAdminLayout>
      <div className="flex flex-col h-full min-h-[calc(100dvh-4rem)]">
        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full" style={{ background: OS_GREEN }} />
            <span className="text-sm font-semibold text-slate-200">Docs Admin</span>
            <span className="text-xs text-slate-500 font-mono">/docs/admin</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Sync button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSyncOpen(v => !v)}
              className={cn(
                "gap-1.5 text-sm font-medium transition-colors",
                syncOpen
                  ? "text-white bg-slate-800"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              )}
              style={syncOpen ? { borderColor: `${OS_GREEN}50`, border: `1px solid ${OS_GREEN}40` } : {}}
            >
              <Zap className="w-3.5 h-3.5" style={{ color: OS_GREEN }} />
              Platform Sync
              {syncStatus && syncStatus.missing > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${OS_GREEN}20`, color: OS_GREEN }}>
                  {syncStatus.missing} new
                </span>
              )}
              {syncOpen ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={reloadIframe}
              className="text-slate-400 hover:text-slate-100 hover:bg-slate-800 gap-1.5"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Reload
            </Button>
            <a
              href={docsAdminUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in new tab
            </a>
          </div>
        </div>

        {/* ── Platform Sync Panel ─────────────────────────────────────────── */}
        {syncOpen && (
          <div className="shrink-0 border-b border-slate-800 bg-slate-950 px-6 py-5 space-y-4 max-h-[55vh] overflow-y-auto">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-200">Platform Feature Sync</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Keeps the docs in sync with OutdoorShare's feature manifest. Safe to run anytime — existing entries are never overwritten.
                </p>
              </div>
              <Button
                size="sm"
                disabled={syncing}
                onClick={runSync}
                className="gap-2 font-semibold"
                style={{ background: OS_GREEN, color: "#fff" }}
              >
                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                {syncing ? "Syncing…" : "Sync Now"}
              </Button>
            </div>

            {/* Last sync result */}
            {lastResult && (
              <div className="rounded-lg px-4 py-3 text-sm space-y-1" style={{ background: `${OS_GREEN}12`, border: `1px solid ${OS_GREEN}30` }}>
                <p className="font-semibold" style={{ color: OS_GREEN }}>
                  Sync complete — {new Date(lastResult.syncedAt).toLocaleTimeString()}
                </p>
                <p className="text-slate-400 text-xs">
                  {lastResult.featuresCreated} feature{lastResult.featuresCreated !== 1 ? "s" : ""} created &nbsp;·&nbsp;
                  {lastResult.stubArticlesCreated} stub article{lastResult.stubArticlesCreated !== 1 ? "s" : ""} generated &nbsp;·&nbsp;
                  {lastResult.featuresAlreadyExisted} already existed
                </p>
                {lastResult.created.length > 0 && (
                  <p className="text-slate-500 text-xs">New: {lastResult.created.join(", ")}</p>
                )}
              </div>
            )}

            {syncError && (
              <div className="rounded-lg px-4 py-3 text-sm bg-red-900/20 border border-red-500/30 text-red-400">
                {syncError}
              </div>
            )}

            {/* Status counts */}
            {syncStatusLoading ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading status…
              </div>
            ) : syncStatus && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-slate-400">
                    <span className="text-white font-bold">{syncStatus.synced}</span> / {syncStatus.totalPlatformFeatures} platform features in docs
                  </span>
                  {syncStatus.missing > 0 && (
                    <span style={{ color: OS_GREEN }} className="font-semibold">
                      {syncStatus.missing} not yet synced — click Sync Now to add them
                    </span>
                  )}
                  {syncStatus.missing === 0 && (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> All features synced
                    </span>
                  )}
                </div>

                {/* Feature grid by category */}
                <div className="space-y-3">
                  {groupedManifest.map(([category, features]) => (
                    <div key={category}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-1.5">{category}</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {features.map(f => (
                          <div
                            key={f.slug}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-md"
                            style={{
                              background: f.inDocs ? "#ffffff08" : "#ffffff04",
                              border: `1px solid ${f.inDocs ? "#ffffff14" : "#ffffff08"}`,
                            }}
                          >
                            <div className="shrink-0">
                              {f.inDocs
                                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                : <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                              }
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={cn("text-xs font-medium truncate", f.inDocs ? "text-slate-300" : "text-slate-500")}>{f.name}</p>
                              {f.inDocs && (
                                <p className="text-[10px] text-slate-600">
                                  {f.articleCount} article{f.articleCount !== 1 ? "s" : ""}
                                </p>
                              )}
                            </div>
                            <Badge
                              variant="outline"
                              className="text-[9px] shrink-0"
                              style={f.inDocs
                                ? { borderColor: `${OS_GREEN}40`, color: OS_GREEN }
                                : { borderColor: "#6b7280", color: "#6b7280" }
                              }
                            >
                              {f.inDocs ? "synced" : "pending"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Loading bar ─────────────────────────────────────────────────── */}
        {iframeLoading && (
          <div className="h-0.5 w-full shrink-0 overflow-hidden bg-slate-800">
            <div
              className="h-full animate-pulse"
              style={{ background: `linear-gradient(90deg, ${OS_GREEN}, #29b4d4)`, width: "60%" }}
            />
          </div>
        )}

        {/* ── Iframe ──────────────────────────────────────────────────────── */}
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={docsAdminUrl}
          title="Docs Admin"
          className="flex-1 w-full border-0"
          onLoad={() => setIframeLoading(false)}
        />
      </div>
    </SuperAdminLayout>
  );
}
