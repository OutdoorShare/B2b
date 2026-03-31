import { useState } from "react";
import { ExternalLink, Monitor, Settings, Copy, Check, Globe, ShieldCheck, Eye } from "lucide-react";

const DEMO_SLUG = "demo-outdoorshare";
const DEMO_ADMIN_EMAIL = "demo@myoutdoorshare.com";
const DEMO_ADMIN_PASSWORD = "demo123";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="ml-2 p-1 rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-200"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function DemoSitePage() {
  const origin = window.location.origin;
  const storefrontUrl = `${origin}/${DEMO_SLUG}`;
  const adminUrl = `${origin}/${DEMO_SLUG}/admin`;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <Monitor className="w-5 h-5 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Demo Site</h1>
        </div>
        <p className="text-slate-400 text-sm">
          A fully functional demo tenant — <span className="text-slate-300 font-medium">Demo OutdoorShare</span>. Use it to showcase the platform or test features. Changes here are real and persist.
        </p>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Storefront */}
        <a
          href={storefrontUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group block bg-slate-900 border border-slate-800 hover:border-green-500/40 rounded-xl p-5 transition-all hover:bg-slate-900/80"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <Globe className="w-5 h-5 text-green-400" />
            </div>
            <ExternalLink className="w-4 h-4 text-slate-600 group-hover:text-green-400 transition-colors" />
          </div>
          <h3 className="text-white font-semibold mb-1">Customer Storefront</h3>
          <p className="text-slate-400 text-sm mb-3">
            The public-facing rental storefront renters see when browsing and booking.
          </p>
          <p className="text-xs text-slate-500 font-mono truncate">/{DEMO_SLUG}</p>
        </a>

        {/* Admin Panel */}
        <a
          href={adminUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group block bg-slate-900 border border-slate-800 hover:border-blue-500/40 rounded-xl p-5 transition-all hover:bg-slate-900/80"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Settings className="w-5 h-5 text-blue-400" />
            </div>
            <ExternalLink className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors" />
          </div>
          <h3 className="text-white font-semibold mb-1">Admin Panel</h3>
          <p className="text-slate-400 text-sm mb-3">
            The company admin dashboard for managing listings, bookings, and settings.
          </p>
          <p className="text-xs text-slate-500 font-mono truncate">/{DEMO_SLUG}/admin</p>
        </a>
      </div>

      {/* Credentials */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-4 h-4 text-slate-400" />
          <h3 className="text-white font-semibold">Admin Login Credentials</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-slate-950 rounded-lg px-4 py-3 border border-slate-800">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Email</p>
              <p className="text-sm text-slate-200 font-mono">{DEMO_ADMIN_EMAIL}</p>
            </div>
            <CopyButton value={DEMO_ADMIN_EMAIL} />
          </div>
          <div className="flex items-center justify-between bg-slate-950 rounded-lg px-4 py-3 border border-slate-800">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Password</p>
              <p className="text-sm text-slate-200 font-mono">{DEMO_ADMIN_PASSWORD}</p>
            </div>
            <CopyButton value={DEMO_ADMIN_PASSWORD} />
          </div>
        </div>
      </div>

      {/* Live Preview */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-slate-400" />
            <h3 className="text-white font-semibold text-sm">Live Storefront Preview</h3>
          </div>
          <a
            href={storefrontUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-green-400 flex items-center gap-1 transition-colors"
          >
            Open full screen <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="relative bg-slate-950" style={{ height: 520 }}>
          <iframe
            src={storefrontUrl}
            className="w-full h-full border-0"
            title="Demo Storefront Preview"
            allow="fullscreen"
          />
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex gap-3 bg-blue-500/5 border border-blue-500/20 rounded-xl px-5 py-4">
        <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-slate-300">
          This demo site is a real tenant on the platform. Listings, bookings, and settings you change here persist and are visible to anyone you share the link with. It's the ideal environment to walk through the full renter and admin experience.
        </p>
      </div>
    </div>
  );
}
