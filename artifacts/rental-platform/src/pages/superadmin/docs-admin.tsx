import { useEffect, useRef, useState } from "react";
import { SuperAdminLayout } from "@/components/layout/superadmin-layout";
import { ExternalLink, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const OS_GREEN = "#3ab549";

export default function DocsAdminPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

  const docsAdminUrl = `${window.location.origin}/docs/admin`;

  function reload() {
    setLoading(true);
    setKey(k => k + 1);
  }

  return (
    <SuperAdminLayout>
      <div className="flex flex-col h-full min-h-[calc(100dvh-4rem)]">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full" style={{ background: OS_GREEN }} />
            <span className="text-sm font-semibold text-slate-200">Docs Admin</span>
            <span className="text-xs text-slate-500 font-mono">/docs/admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={reload}
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

        {/* Loading bar */}
        {loading && (
          <div className="h-0.5 w-full shrink-0 overflow-hidden bg-slate-800">
            <div
              className="h-full animate-pulse"
              style={{ background: `linear-gradient(90deg, ${OS_GREEN}, #29b4d4)`, width: "60%" }}
            />
          </div>
        )}

        {/* Iframe */}
        <iframe
          key={key}
          ref={iframeRef}
          src={docsAdminUrl}
          title="Docs Admin"
          className="flex-1 w-full border-0"
          onLoad={() => setLoading(false)}
        />
      </div>
    </SuperAdminLayout>
  );
}
