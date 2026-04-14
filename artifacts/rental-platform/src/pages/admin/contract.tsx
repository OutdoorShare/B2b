import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  FileSignature, Save, Loader2, CheckCircle, AlertCircle,
  Info, Trash2, Upload, FileText, X, ChevronDown, ChevronUp,
  Type, DollarSign, Users, Eye, Download, RotateCcw,
  ExternalLink, Clock, ShieldCheck, ShieldOff, History,
  ArrowLeft, Plus, ToggleLeft, ToggleRight, Link2,
  ListChecks, GripVertical, Pencil, ChevronUp as Up, ChevronDown as Down, Check,
  Zap, BookOpen,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function adminHeaders(): HeadersInit {
  try {
    const raw = localStorage.getItem("admin_session");
    if (raw) {
      const s = JSON.parse(raw);
      if (s?.token) return { "x-admin-token": s.token };
    }
  } catch { /* ignore */ }
  return {};
}

function getAdminToken(): string {
  try {
    const raw = localStorage.getItem("admin_session");
    if (raw) {
      const s = JSON.parse(raw);
      if (s?.token) return s.token;
    }
  } catch { /* ignore */ }
  return "";
}

async function apiFetch(path: string, opts?: RequestInit) {
  const headers: HeadersInit = { ...adminHeaders(), ...(opts?.body ? { "Content-Type": "application/json" } : {}) };
  const res = await fetch(`${BASE}/api/${path}`, { ...opts, headers });
  if (!res.ok) {
    const msg = await res.text().catch(() => "Request failed");
    throw new Error(msg || `${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── Token groups for template editor ─────────────────────────────────────────
const TOKEN_GROUPS = [
  {
    label: "Renter",
    color: "text-violet-600 bg-violet-50 border-violet-200 hover:bg-violet-100",
    tokens: [
      { token: "{{first_name}}", label: "First Name" },
      { token: "{{last_name}}", label: "Last Name" },
      { token: "{{full_name}}", label: "Full Name" },
      { token: "{{email}}", label: "Email" },
      { token: "{{phone}}", label: "Phone" },
    ],
  },
  {
    label: "Booking",
    color: "text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100",
    tokens: [
      { token: "{{booking_id}}", label: "Booking #" },
      { token: "{{listing_name}}", label: "Listing" },
      { token: "{{total_price}}", label: "Total Price" },
    ],
  },
  {
    label: "Dates",
    color: "text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100",
    tokens: [
      { token: "{{start_date}}", label: "Start Date" },
      { token: "{{end_date}}", label: "End Date" },
      { token: "{{today}}", label: "Today's Date" },
      { token: "{{signed_at}}", label: "Signed At" },
    ],
  },
  {
    label: "Business",
    color: "text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
    tokens: [{ token: "{{company_name}}", label: "Company" }],
  },
  {
    label: "Riders",
    color: "text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100",
    tokens: [
      { token: "{{additional_riders}}", label: "Riders" },
      { token: "{{minors}}", label: "Minors" },
    ],
  },
];

// Markdown format — paste directly from ChatGPT.
// Supports: # ## ### headings, **bold**, *italic*, - bullets, 1. numbered lists.
const DEFAULT_CONTENT = `# Rental Agreement

This Rental Agreement ("Agreement") is entered into as of **{{today}}** between **{{company_name}}** ("Company") and **{{full_name}}** ("Renter").

---

## 1. Rental Details

The Renter agrees to rent **{{listing_name}}** for the period from **{{start_date}}** to **{{end_date}}**. The total rental fee is **{{total_price}}**.

## 2. Renter Responsibilities

The Renter agrees to:

- Use the rental equipment only for its intended purpose and in a safe manner.
- Return the equipment in the same condition as received, normal wear and tear excepted.
- Immediately report any damage, malfunction, or theft to the Company.
- Be solely responsible for any citations, fines, or violations incurred during the rental period.

## 3. Liability Waiver

The Renter acknowledges that use of the rental equipment involves inherent risks, including the risk of personal injury, property damage, or death. The Renter **voluntarily assumes all such risks** and agrees to hold the Company harmless from any claims arising out of the rental.

## 4. Damage & Loss

The Renter is responsible for all damage to or loss of the rental equipment beyond normal wear and tear. The Renter authorizes the Company to charge the Renter's payment method on file for the cost of repairs or replacement.

## 5. Identification

The Renter represents that they are of legal rental age and possess any licenses or qualifications required to operate the rental equipment.

## 6. Additional Riders & Minors

- Additional riders: {{additional_riders}}
- Minors: {{minors}}

All additional riders and minors using the equipment are covered under the terms of this Agreement and are the Renter's sole responsibility.

## 7. Governing Law

This Agreement shall be governed by the laws of the jurisdiction where the Company is located.

---

By signing below, the Renter confirms they have read, understood, and agree to all terms of this Agreement.`;

// ── Markdown → HTML renderer (supports ChatGPT output format) ─────────────────
// Handles: # ## ### headings, **bold**, *italic*, - bullets, 1. lists, ---, blank lines.
// {{tokens}} are highlighted in the preview as styled badges.
function inlineMd(raw: string): string {
  return raw
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code style='background:#f1f5f9;padding:1px 4px;border-radius:3px;font-size:0.9em'>$1</code>")
    .replace(/\{\{([^}]+)\}\}/g,
      "<span style='display:inline-block;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:4px;padding:0 5px;font-size:0.85em;font-family:monospace'>{{$1}}</span>");
}

function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let ulOpen = false;
  let olOpen = false;

  const closeList = () => {
    if (ulOpen) { out.push("</ul>"); ulOpen = false; }
    if (olOpen) { out.push("</ol>"); olOpen = false; }
  };

  for (const line of lines) {
    if (line.startsWith("### ")) {
      closeList();
      out.push(`<h3 style="font-size:1em;font-weight:700;margin:1.1em 0 0.3em;color:#1e293b">${inlineMd(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      closeList();
      out.push(`<h2 style="font-size:1.15em;font-weight:700;margin:1.4em 0 0.4em;color:#1b4332;border-bottom:1px solid #e2e8f0;padding-bottom:0.3em">${inlineMd(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      closeList();
      out.push(`<h1 style="font-size:1.45em;font-weight:800;margin:0 0 0.6em;color:#111827">${inlineMd(line.slice(2))}</h1>`);
    } else if (/^---+$/.test(line.trim())) {
      closeList();
      out.push(`<hr style="border:none;border-top:1px solid #e2e8f0;margin:1em 0">`);
    } else if (/^[-*] /.test(line)) {
      if (olOpen) { out.push("</ol>"); olOpen = false; }
      if (!ulOpen) { out.push(`<ul style="padding-left:1.4em;margin:0.4em 0">`); ulOpen = true; }
      out.push(`<li style="margin:0.2em 0">${inlineMd(line.slice(2))}</li>`);
    } else if (/^\d+\. /.test(line)) {
      if (ulOpen) { out.push("</ul>"); ulOpen = false; }
      if (!olOpen) { out.push(`<ol style="padding-left:1.4em;margin:0.4em 0">`); olOpen = true; }
      out.push(`<li style="margin:0.2em 0">${inlineMd(line.replace(/^\d+\. /, ""))}</li>`);
    } else if (line.trim() === "") {
      closeList();
      out.push(`<div style="height:0.7em"></div>`);
    } else {
      closeList();
      out.push(`<p style="margin:0 0 0.5em;line-height:1.8">${inlineMd(line)}</p>`);
    }
  }
  closeList();
  return out.join("");
}

// ── Platform-off warning panel ────────────────────────────────────────────────
interface PlatformWarningPanelProps {
  show: boolean;
  acknowledged: boolean;
  loading: boolean;
  onAcknowledge: (v: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

function PlatformWarningPanel({ show, acknowledged, loading, onAcknowledge, onCancel, onConfirm }: PlatformWarningPanelProps) {
  if (!show) return null;
  return (
    <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 space-y-4">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-800">OutdoorShare platform agreements will be removed</p>
          <p className="text-sm text-red-700 mt-1">Renters will only see and sign your contract. Turning this off will:</p>
          <ul className="mt-2 space-y-1 text-sm text-red-700 list-disc list-inside">
            <li>Remove OutdoorShare's Terms of Service from your renter checkout</li>
            <li>Renters will rely solely on your contract for liability and damage terms</li>
            <li>OutdoorShare will not process any damage or loss claims for future bookings</li>
            <li>The Protection Plan add-on will be hidden from your booking flow entirely</li>
          </ul>
        </div>
      </div>
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input type="checkbox" className="mt-0.5 accent-red-600 w-4 h-4 shrink-0" checked={acknowledged} onChange={e => onAcknowledge(e.target.checked)} />
        <span className="text-sm font-medium text-red-800">
          I understand that disabling platform agreements removes OutdoorShare coverage from all future bookings, and I accept full responsibility through my own rental contract.
        </span>
      </label>
      <div className="flex items-center gap-2 justify-end pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
          Keep Platform Agreements On
        </button>
        <button
          type="button"
          disabled={!acknowledged || loading}
          onClick={onConfirm}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Disable Platform Agreements &amp; Protection Plan
        </button>
      </div>
    </div>
  );
}

// ── Contract interface ─────────────────────────────────────────────────────────
interface Contract {
  id: number;
  title: string;
  content: string;
  contractType?: "template" | "uploaded_pdf";
  uploadedPdfStorageKey?: string;
  uploadedFileName?: string;
  uploadedFileSizeBytes?: number;
  checkboxLabel: string;
  includeOutdoorShareAgreements: boolean;
  version: number;
  isActive: boolean;
  listingIds: number[];
  createdAt: string;
  updatedAt: string;
}

interface Listing {
  id: number;
  title: string;
}

interface PlatformAgreement {
  id: number;
  title: string;
  content: string;
  checkboxLabel: string;
  isRequired: boolean;
  sortOrder: number;
  version: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function pdfUrl(contractId: number | "active"): string {
  const token = getAdminToken();
  const path = contractId === "active" ? "contracts/active/pdf" : `contracts/${contractId}/pdf`;
  return `${BASE}/api/${path}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}

// ── Active PDF Contract Card ───────────────────────────────────────────────────
function ActivePdfCard({
  contract,
  onReplace,
  onRemove,
}: {
  contract: Contract;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const url = pdfUrl("active");

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header strip */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{contract.uploadedFileName ?? contract.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {contract.uploadedFileSizeBytes ? formatBytes(contract.uploadedFileSizeBytes) + " · " : ""}
              Version {contract.version} · Uploaded {new Date(contract.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 shrink-0 ml-3">Active</Badge>
      </div>

      {/* Usage explanation */}
      <div className="px-5 py-4 space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Where this contract is used</p>
        <div className="space-y-1.5">
          {[
            { icon: CheckCircle, label: "Shown to renters in the signing flow at checkout", ok: true },
            { icon: contract.includeOutdoorShareAgreements ? ShieldCheck : ShieldOff,
              label: contract.includeOutdoorShareAgreements
                ? "Combined with OutdoorShare platform agreements in the final signed PDF"
                : "Standalone only — OutdoorShare platform agreements are not included",
              ok: contract.includeOutdoorShareAgreements },
            { icon: CheckCircle, label: "Included as a static appendix in the renter's signed packet", ok: true },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <item.icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${item.ok ? "text-emerald-500" : "text-amber-500"}`} />
              <p className={`text-xs ${item.ok ? "text-slate-600" : "text-amber-700"}`}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* PDF Preview iframe strip */}
      <div className="mx-5 mb-4 rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-white">
          <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" /> PDF Preview
          </span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
          >
            Open full <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <iframe
          src={url}
          title="PDF Preview"
          className="w-full bg-slate-100"
          style={{ height: 320 }}
        />
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 px-5 pb-4 flex-wrap">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-700 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" /> View PDF
        </a>
        <a
          href={`${url}&download=1`}
          download={contract.uploadedFileName ?? "contract.pdf"}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 border border-slate-200 transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Download
        </a>
        <button
          type="button"
          onClick={onReplace}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 border border-slate-200 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Replace PDF
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-red-600 text-xs font-medium hover:bg-red-50 border border-red-200 transition-colors ml-auto"
        >
          <Trash2 className="w-3.5 h-3.5" /> Remove
        </button>
      </div>
    </div>
  );
}

// ── Version History row ────────────────────────────────────────────────────────
function HistoryRow({ row, onActivate }: { row: Contract; onActivate: (id: number) => void }) {
  const [activating, setActivating] = useState(false);
  const url = pdfUrl(row.id);
  const isPdf = row.contractType === "uploaded_pdf";

  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${row.isActive ? "bg-emerald-100" : "bg-slate-100"}`}>
        {isPdf
          ? <FileText className={`w-4 h-4 ${row.isActive ? "text-emerald-600" : "text-slate-400"}`} />
          : <Type className={`w-4 h-4 ${row.isActive ? "text-emerald-600" : "text-slate-400"}`} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-700 truncate">
            {isPdf ? (row.uploadedFileName ?? row.title) : row.title}
          </p>
          {row.isActive && <Badge className="bg-emerald-100 text-emerald-600 border-emerald-200 text-[10px] px-1.5 py-0">Active</Badge>}
        </div>
        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          v{row.version} · {new Date(row.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          {row.uploadedFileSizeBytes ? ` · ${formatBytes(row.uploadedFileSizeBytes)}` : ""}
          {isPdf ? " · PDF" : " · Template"}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isPdf && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="View PDF"
          >
            <Eye className="w-3.5 h-3.5" />
          </a>
        )}
        {!row.isActive && (
          <button
            type="button"
            disabled={activating}
            onClick={async () => {
              setActivating(true);
              try { await onActivate(row.id); } finally { setActivating(false); }
            }}
            title="Restore this version"
            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
          >
            {activating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ContractBuilder() {
  // ── Library state ──────────────────────────────────────────────────────────
  const [templates, setTemplates]   = useState<Contract[]>([]);
  const [listings, setListings]     = useState<Listing[]>([]);
  const [platformAgreements, setPlatformAgreements] = useState<PlatformAgreement[]>([]);
  const [loadingLib, setLoadingLib] = useState(true);
  const [view, setView]             = useState<"library" | "editor">("library");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // ── Editor state ───────────────────────────────────────────────────────────
  const [editingId, setEditingId]   = useState<number | null>(null); // null = creating new

  const [mode, setMode]                   = useState<"template" | "upload_pdf">("template");
  const [uploadPhase, setUploadPhase]     = useState<"card" | "upload_form">("card");
  const [title, setTitle]                 = useState("Rental Agreement");
  const [content, setContent]             = useState(DEFAULT_CONTENT);
  const [checkboxLabel, setCheckboxLabel] = useState("I have read and agree to the rental terms and conditions");
  const [includePlatform, setIncludePlatform] = useState(true);
  const [editorListingIds, setEditorListingIds] = useState<number[]>([]);
  const [listingRules, setListingRules] = useState<Array<{ id: number; listingId: number; title: string; description: string | null; fee: number; sortOrder: number }>>([]);

  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState("");
  const [settingsOpen, setSettingsOpen]   = useState(false);

  // Acknowledgement checkbox management
  const [ackItems, setAckItems]   = useState<Array<{ id: number; text: string; required: boolean; sortOrder: number; contractId: number | null }>>([]);
  const [ackText, setAckText]     = useState("");
  const [ackRequired, setAckRequired] = useState(true);
  const [savingAck, setSavingAck] = useState(false);
  const [deletingAck, setDeletingAck] = useState<number | null>(null);
  const [editingAckId, setEditingAckId] = useState<number | null>(null);
  const [editingAckText, setEditingAckText] = useState("");
  const [reorderingAck, setReorderingAck] = useState<number | null>(null);
  const [listingDropOpen, setListingDropOpen] = useState(false);
  const [viewMode, setViewMode]           = useState<"edit" | "preview">("edit");

  const [showPlatformWarning, setShowPlatformWarning]                 = useState(false);
  const [platformWarningAcknowledged, setPlatformWarningAcknowledged] = useState(false);
  const [disablingPlatform, setDisablingPlatform]                     = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const [pdfFile, setPdfFile]         = useState<File | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "processing" | "done" | "error">("idle");

  const wordCount = useMemo(() => content.trim().split(/\s+/).filter(Boolean).length, [content]);

  // ── Data loaders ───────────────────────────────────────────────────────────
  const loadTemplates = async () => {
    setLoadingLib(true);
    try {
      const [tmpl, lst, platDocs] = await Promise.all([
        apiFetch("contracts").catch(() => []),
        apiFetch("listings").catch(() => []),
        apiFetch("contracts/platform-agreements").catch(() => []),
      ]);
      setTemplates(Array.isArray(tmpl) ? tmpl : []);
      setListings(Array.isArray(lst) ? lst.map((l: any) => ({ id: l.id, title: l.title })) : []);
      setPlatformAgreements(Array.isArray(platDocs) ? platDocs : []);
    } finally { setLoadingLib(false); }
  };

  useEffect(() => { loadTemplates(); }, []);

  useEffect(() => {
    if (editorListingIds.length === 0) { setListingRules([]); return; }
    let stale = false;
    Promise.all(
      editorListingIds.map(id => apiFetch(`listings/${id}/rules`).catch(() => []))
    ).then(results => {
      if (stale) return;
      const seen = new Set<number>();
      const allRules = results.flat().filter((r: any) => r && !seen.has(r.id) && seen.add(r.id));
      setListingRules(allRules);
    });
    return () => { stale = true; };
  }, [editorListingIds.join(",")]);

  // ── Editor helpers ─────────────────────────────────────────────────────────
  const loadAckItems = (contractId: number | null) => {
    const url = contractId
      ? `contracts/acknowledgements/admin?contractId=${contractId}`
      : `contracts/acknowledgements/admin`;
    apiFetch(url).then((items: any[]) => {
      if (Array.isArray(items)) setAckItems(items);
    }).catch(() => {});
  };

  const resetEditor = () => {
    setTitle("Rental Agreement");
    setContent(DEFAULT_CONTENT);
    setCheckboxLabel("I have read and agree to the rental terms and conditions");
    setIncludePlatform(true);
    setEditorListingIds([]);
    setMode("template");
    setUploadPhase("card");
    setPdfFile(null);
    setUploadProgress("idle");
    setViewMode("edit");
    setSettingsOpen(false);
    setError("");
    setSaved(false);
    setAckItems([]);
    setAckText("");
    setEditingAckId(null);
    setEditingAckText("");
    setListingRules([]);
    setReorderingAck(null);
  };

  const loadIntoEditor = (t: Contract) => {
    setEditingId(t.id);
    setTitle(t.title);
    setContent(t.content || DEFAULT_CONTENT);
    setCheckboxLabel(t.checkboxLabel || "I have read and agree to the rental terms and conditions");
    setIncludePlatform(t.includeOutdoorShareAgreements !== false);
    setEditorListingIds(Array.isArray(t.listingIds) ? t.listingIds : []);
    setMode(t.contractType === "uploaded_pdf" ? "upload_pdf" : "template");
    setUploadPhase(t.contractType === "uploaded_pdf" ? "card" : "card");
    setPdfFile(null);
    setUploadProgress("idle");
    setViewMode("edit");
    setSettingsOpen(false);
    setError("");
    setSaved(false);
    setAckItems([]);
    setAckText("");
    loadAckItems(t.id);
  };

  const handleAddAck = async (prefillText?: string) => {
    const text = (prefillText ?? ackText).trim();
    if (!text) return;
    setSavingAck(true);
    try {
      const nextNum = ackItems.length + 1;
      const item = await apiFetch("contracts/acknowledgements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, required: ackRequired, contractId: editingId ?? null, sortOrder: ackItems.length }),
      });
      setAckItems(prev => [...prev, item]);
      if (!prefillText) setAckText("");
      setAckRequired(true);
      insertToken(`{{ack_${nextNum}}}`);
    } catch { /* silent */ } finally { setSavingAck(false); }
  };

  const handleDeleteAck = async (id: number) => {
    setDeletingAck(id);
    try {
      await apiFetch(`contracts/acknowledgements/${id}`, { method: "DELETE" });
      setAckItems(prev => prev.filter(a => a.id !== id));
    } catch { /* silent */ } finally { setDeletingAck(null); }
  };

  const handleToggleAckRequired = async (ack: { id: number; required: boolean }) => {
    try {
      const updated = await apiFetch(`contracts/acknowledgements/${ack.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ required: !ack.required }),
      });
      setAckItems(prev => prev.map(a => a.id === ack.id ? updated : a));
    } catch { /* silent */ }
  };

  const handleStartEditAck = (ack: { id: number; text: string }) => {
    setEditingAckId(ack.id);
    setEditingAckText(ack.text);
  };

  const handleSaveEditAck = async (id: number) => {
    const trimmed = editingAckText.trim();
    if (!trimmed) return;
    try {
      const updated = await apiFetch(`contracts/acknowledgements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      setAckItems(prev => prev.map(a => a.id === id ? updated : a));
      setEditingAckId(null);
      setEditingAckText("");
    } catch { /* silent */ }
  };

  const handleCancelEditAck = () => {
    setEditingAckId(null);
    setEditingAckText("");
  };

  const handleMoveAck = async (id: number, direction: "up" | "down") => {
    const idx = ackItems.findIndex(a => a.id === id);
    if (idx < 0) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === ackItems.length - 1) return;
    const newItems = [...ackItems];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newItems[idx], newItems[swapIdx]] = [newItems[swapIdx], newItems[idx]];
    setAckItems(newItems);
    setReorderingAck(id);
    try {
      await Promise.all([
        apiFetch(`contracts/acknowledgements/${newItems[idx].id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: idx }),
        }),
        apiFetch(`contracts/acknowledgements/${newItems[swapIdx].id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: swapIdx }),
        }),
      ]);
    } catch { /* silent */ } finally { setReorderingAck(null); }
  };

  const openEditor = (t?: Contract) => {
    if (t) loadIntoEditor(t);
    else { resetEditor(); setEditingId(null); }
    setView("editor");
  };

  const closeEditor = async () => {
    setView("library");
    await loadTemplates();
  };

  const insertToken = (token: string) => {
    const ta = textareaRef.current;
    if (!ta) { setContent(prev => prev + " " + token); return; }
    const start = ta.selectionStart ?? content.length;
    const end   = ta.selectionEnd   ?? content.length;
    const next  = content.slice(0, start) + token + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + token.length, start + token.length); });
  };

  // ── Save (create or update) ────────────────────────────────────────────────
  const handleSave = async () => {
    setError(""); setSaving(true); setSaved(false);
    try {
      const body = { title, content, checkboxLabel, includeOutdoorShareAgreements: includePlatform, listingIds: editorListingIds };
      if (editingId !== null) {
        await apiFetch(`contracts/${editingId}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch("contracts", { method: "POST", body: JSON.stringify(body) });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await closeEditor();
    } catch (e: any) {
      setError(e.message || "Failed to save contract");
    } finally { setSaving(false); }
  };

  // ── Delete a template ──────────────────────────────────────────────────────
  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await apiFetch(`contracts/${id}`, { method: "DELETE" });
      await loadTemplates();
    } catch (e: any) {
      alert(e.message || "Failed to delete");
    } finally { setDeletingId(null); }
  };

  // ── Toggle active / inactive ───────────────────────────────────────────────
  const handleToggleActive = async (t: Contract) => {
    setTogglingId(t.id);
    try {
      await apiFetch(`contracts/${t.id}/${t.isActive ? "deactivate" : "activate"}`, { method: "PATCH" });
      await loadTemplates();
    } catch (e: any) {
      alert(e.message || "Failed to update status");
    } finally { setTogglingId(null); }
  };

  // ── Upload PDF for a new template ─────────────────────────────────────────
  const handlePdfUpload = async () => {
    if (!pdfFile) return;
    setError(""); setUploading(true); setSaved(false); setUploadProgress("uploading");
    try {
      const headers = adminHeaders();
      const fd = new FormData();
      fd.append("file", pdfFile);
      fd.append("title", title.trim() || "Rental Agreement");
      fd.append("checkboxLabel", checkboxLabel.trim() || "I have read and agree to the attached rental agreement");
      fd.append("includeOutdoorShareAgreements", String(includePlatform));
      fd.append("listingIds", JSON.stringify(editorListingIds));
      setUploadProgress("processing");
      const res = await fetch(`${BASE}/api/contracts/upload-pdf`, { method: "POST", headers, body: fd });
      if (!res.ok) { const t = await res.text(); throw new Error(t || "Upload failed"); }
      setPdfFile(null);
      setUploadProgress("done");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await closeEditor();
    } catch (e: any) {
      setError(e.message || "Failed to upload PDF");
      setUploadProgress("error");
    } finally { setUploading(false); }
  };

  // ── Platform toggle ────────────────────────────────────────────────────────
  const requestDisablePlatform = () => { setShowPlatformWarning(true); setPlatformWarningAcknowledged(false); setSettingsOpen(true); };
  const cancelDisablePlatform  = () => { setShowPlatformWarning(false); setPlatformWarningAcknowledged(false); setIncludePlatform(true); };
  const handleDisablePlatform  = async () => {
    if (!platformWarningAcknowledged) return;
    setDisablingPlatform(true);
    try {
      await apiFetch("business", { method: "PUT", body: JSON.stringify({ protectionPlanEnabled: false }) });
      setIncludePlatform(false);
      setShowPlatformWarning(false);
      setPlatformWarningAcknowledged(false);
    } catch (e: any) {
      setError(e.message || "Failed to update protection plan settings");
    } finally { setDisablingPlatform(false); }
  };

  const platformToggle = (checked: boolean) => {
    if (!checked) requestDisablePlatform();
    else { setIncludePlatform(true); setShowPlatformWarning(false); }
  };

  const platformSettingsJSX = (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <Switch id="include-platform" checked={includePlatform} onCheckedChange={platformToggle} />
        <div>
          <Label htmlFor="include-platform" className="cursor-pointer text-sm font-medium text-slate-700">
            Include OutdoorShare platform agreements
          </Label>
          <p className="text-xs text-slate-400 mt-1">
            Renters also accept OutdoorShare's Terms of Service alongside your contract.
            Disabling this also removes the Protection Plan from all bookings.
          </p>
        </div>
      </div>
      <PlatformWarningPanel
        show={showPlatformWarning}
        acknowledged={platformWarningAcknowledged}
        loading={disablingPlatform}
        onAcknowledge={setPlatformWarningAcknowledged}
        onCancel={cancelDisablePlatform}
        onConfirm={handleDisablePlatform}
      />
    </div>
  );

  // ── Listing assignment label ───────────────────────────────────────────────
  const assignmentLabel = (ids: number[]) => {
    if (!ids || ids.length === 0) return "All rentals (default)";
    const names = ids.map(id => listings.find(l => l.id === id)?.title ?? `#${id}`);
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LIBRARY VIEW
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === "library") {
    return (
      <div className="flex flex-col h-full min-h-screen bg-slate-100">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <FileSignature className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-900 leading-none">Contract Templates</h1>
              <p className="text-xs text-slate-400 mt-0.5">Build and manage the agreements your renters sign at checkout</p>
            </div>
          </div>
          <Button onClick={() => openEditor()} size="sm" style={{ backgroundColor: "#3ab549" }} className="text-white text-xs">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> New Template
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingLib ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                <FileSignature className="w-7 h-7 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700">No contract templates yet</p>
                <p className="text-xs text-slate-400 mt-1">Create a template to collect signed agreements from your renters at checkout.</p>
              </div>
              <Button onClick={() => openEditor()} size="sm" style={{ backgroundColor: "#3ab549" }} className="text-white text-xs mt-2">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Create First Template
              </Button>
            </div>
          ) : (
            <div className="space-y-3 max-w-4xl">
              {templates.map(t => {
                const ids = Array.isArray(t.listingIds) ? t.listingIds : [];
                const isPdf = t.contractType === "uploaded_pdf";
                return (
                  <div key={t.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center gap-4 px-5 py-4">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.isActive ? "bg-emerald-100 border border-emerald-200" : "bg-slate-100 border border-slate-200"}`}>
                        {isPdf
                          ? <FileText className={`w-5 h-5 ${t.isActive ? "text-emerald-600" : "text-slate-400"}`} />
                          : <Type className={`w-5 h-5 ${t.isActive ? "text-emerald-600" : "text-slate-400"}`} />
                        }
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-900 truncate">{t.title}</p>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${t.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
                            {t.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 bg-slate-50 text-slate-500 border-slate-200">
                            {isPdf ? "PDF" : "Template"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Link2 className="w-3 h-3" />
                            {assignmentLabel(ids)}
                          </span>
                          <span className="text-xs text-slate-300">·</span>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            v{t.version} · {new Date(t.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* View PDF */}
                        {isPdf && (
                          <a
                            href={pdfUrl(t.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="View PDF"
                          >
                            <Eye className="w-4 h-4" />
                          </a>
                        )}
                        {/* Toggle active */}
                        <button
                          type="button"
                          onClick={() => handleToggleActive(t)}
                          disabled={togglingId === t.id}
                          title={t.isActive ? "Deactivate" : "Activate"}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          {togglingId === t.id
                            ? <Loader2 className="w-8 h-8 animate-spin" />
                            : t.isActive
                              ? <ToggleRight className="w-8 h-8 text-emerald-500" />
                              : <ToggleLeft className="w-8 h-8" />
                          }
                        </button>
                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => openEditor(t)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
                        >
                          Edit
                        </button>
                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDelete(t.id, t.title)}
                          disabled={deletingId === t.id}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          {deletingId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Info callout */}
              <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 mt-2">
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800">
                  <span className="font-semibold">Assignment rules:</span> When a renter books, OutdoorShare first looks for an active template assigned to that specific rental.
                  If none matches, it uses the default template (assigned to "All rentals").
                  Multiple templates can be active at the same time.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EDITOR VIEW
  // ═══════════════════════════════════════════════════════════════════════════
  const editorContract = editingId !== null ? templates.find(t => t.id === editingId) ?? null : null;

  return (
    <div className="flex flex-col h-full min-h-screen bg-slate-100">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={closeEditor}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Templates
          </button>
          <span className="text-slate-300">/</span>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <FileSignature className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-slate-900">
              {editingId !== null ? "Edit Template" : "New Template"}
            </p>
            {editorContract && (
              <Badge variant="outline" className="text-xs text-slate-400 border-slate-200">v{editorContract.version}</Badge>
            )}
          </div>
        </div>

        <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg">
          <button type="button" onClick={() => { setMode("template"); setUploadPhase("card"); }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${mode === "template" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            <Type className="w-3 h-3" /> Build Template
          </button>
          <button type="button" onClick={() => setMode("upload_pdf")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${mode === "upload_pdf" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            <Upload className="w-3 h-3" /> Upload PDF
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-3 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3 shrink-0">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* ── TEMPLATE MODE ──────────────────────────────────────────────── */}
      {mode === "template" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Token ribbon */}
          <div className="bg-white border-b border-slate-200 px-6 py-2 shrink-0">
            <div className="flex items-start gap-5 flex-wrap">
              {TOKEN_GROUPS.map(group => (
                <div key={group.label} className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-0.5">{group.label}</span>
                  {group.tokens.map(t => (
                    <button key={t.token} type="button" onClick={() => insertToken(t.token)} title={`Insert ${t.token}`}
                      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors ${group.color}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              ))}
              {ackItems.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-0.5">Ack</span>
                  {ackItems.map((_, idx) => (
                    <button key={idx} type="button" onClick={() => insertToken(`{{ack_${idx + 1}}}`)} title={`Insert {{ack_${idx + 1}}}`}
                      className="inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100">
                      Ack #{idx + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Document canvas */}
          <div className="flex-1 overflow-y-auto py-8 px-6 flex justify-center">
            <div className="w-full max-w-[780px] space-y-6">
              {/* Edit / Preview toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  Supports Markdown — paste directly from ChatGPT.&nbsp;
                  <span className="font-mono text-slate-400"># ## **bold** - list 1. list</span>
                </div>
                <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                  <button type="button" onClick={() => setViewMode("edit")}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${viewMode === "edit" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                    <Type className="w-3 h-3" /> Edit
                  </button>
                  <button type="button" onClick={() => setViewMode("preview")}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${viewMode === "preview" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                    <Eye className="w-3 h-3" /> Preview
                  </button>
                </div>
              </div>

              {/* ── Document paper ─────────────────────────────────────── */}
              <div className="bg-white rounded-sm shadow-[0_2px_8px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)] flex flex-col" style={{ minHeight: 900 }}>
                <div className="px-16 pt-14 pb-6 border-b border-slate-100">
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                    className="w-full text-2xl font-bold text-slate-900 placeholder-slate-300 bg-transparent border-none outline-none tracking-tight"
                    placeholder="Agreement Title"
                    style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }} />
                  {editorContract?.updatedAt && (
                    <p className="text-xs text-slate-400 mt-2">Last saved {new Date(editorContract.updatedAt).toLocaleString()}</p>
                  )}
                </div>

                {viewMode === "edit" ? (
                  <div className="flex-1 px-16 py-10">
                    <textarea ref={textareaRef} id="contract-content" value={content}
                      onChange={e => setContent(e.target.value)}
                      placeholder={`Start typing your agreement, or paste directly from ChatGPT.\n\nMarkdown is supported:\n  # Section Heading\n  ## Sub-section\n  **bold text**\n  - bullet item\n  1. numbered item`}
                      className="w-full h-full min-h-[640px] bg-transparent border-none outline-none resize-none text-slate-800 placeholder-slate-300"
                      style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontSize: "14.5px", lineHeight: "1.9", letterSpacing: "0.01em" }}
                      spellCheck />
                  </div>
                ) : (
                  <>
                    <div className="flex-1 px-16 py-10 min-h-[640px] text-slate-800"
                      style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontSize: "14.5px" }}
                      dangerouslySetInnerHTML={{ __html: (() => {
                        const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
                        let md = content.replace(/\{\{ack_(\d+)\}\}/g, (_, num) => {
                          const idx = parseInt(num, 10) - 1;
                          const ack = ackItems[idx];
                          if (ack) return `<span style="display:inline-flex;align-items:center;gap:4px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:600;color:#065f46;font-family:system-ui;vertical-align:baseline">☑ Ack #${num}: ${esc(ack.text)}</span>`;
                          return `<span style="display:inline-flex;align-items:center;gap:4px;background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:600;color:#92400e;font-family:system-ui">⚠ ack_${num} — not found</span>`;
                        });
                        return markdownToHtml(md) || "<p style='color:#94a3b8'>Nothing to preview yet.</p>";
                      })() }} />
                    {/* Operator checkbox preview */}
                    <div className="px-16 pb-10">
                      <label className="flex items-start gap-3 cursor-default select-none">
                        <div className="mt-0.5 w-4 h-4 rounded border-2 border-emerald-500 bg-emerald-500 flex items-center justify-center shrink-0">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" /></svg>
                        </div>
                        <span className="text-sm text-slate-700" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                          {checkboxLabel || "I have read and agree to the rental terms and conditions"}
                        </span>
                      </label>
                    </div>
                  </>
                )}
              </div>

              {/* ── Custom Acknowledgements ─────────────────────────────── */}
              <div className="space-y-5">
                {/* Section divider + header */}
                <div className="flex items-center gap-3 pt-2">
                  <div className="flex-1 border-t border-slate-200" />
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 shadow-sm">
                      <ListChecks className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-800">Custom Acknowledgements</span>
                      {ackItems.length > 0 && (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                          {ackItems.length}
                        </span>
                      )}
                    </div>
                    {!editingId && (
                      <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 shrink-0">
                        Save contract first to add items
                      </span>
                    )}
                  </div>
                  <div className="flex-1 border-t border-slate-200" />
                </div>
                <p className="text-xs text-center text-slate-400 -mt-2">
                  Each item below is shown as a required checkbox the renter must confirm before signing. You write the exact wording.
                </p>

                {listingRules.length > 0 && (
                  <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-amber-50 to-white border-b border-amber-100">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                        <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900">Rules &amp; Guidelines</p>
                        <p className="text-xs text-slate-500 mt-0.5">From assigned rentals — click to add as an acknowledgement.</p>
                      </div>
                    </div>
                    <div className="divide-y divide-amber-50">
                      {listingRules.map(rule => {
                        const alreadyAdded = ackItems.some(a => a.text === `I acknowledge and agree to the following rule: ${rule.title}${rule.description ? ` — ${rule.description}` : ""}`);
                        const ruleText = `I acknowledge and agree to the following rule: ${rule.title}${rule.description ? ` — ${rule.description}` : ""}`;
                        return (
                          <div key={rule.id} className="flex items-center gap-3 px-5 py-3 hover:bg-amber-50/50 transition-colors">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800">{rule.title}</p>
                              {rule.description && <p className="text-xs text-slate-500 mt-0.5">{rule.description}</p>}
                              {rule.fee > 0 && <p className="text-[10px] text-amber-600 mt-0.5">Violation fee: ${rule.fee.toFixed(2)}</p>}
                            </div>
                            <button
                              type="button"
                              disabled={alreadyAdded || savingAck}
                              onClick={() => handleAddAck(ruleText)}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                                alreadyAdded
                                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default"
                                  : "text-white shadow-sm hover:opacity-90"
                              }`}
                              style={!alreadyAdded ? { backgroundColor: "#3ab549" } : undefined}
                            >
                              {alreadyAdded ? <><Check className="w-3 h-3" /> Added</> : <><Plus className="w-3 h-3" /> Add</>}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-emerald-50 to-white border-b border-emerald-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">Acknowledgement Items</p>
                      <p className="text-xs text-slate-500 mt-0.5">Add, edit, and reorder items. Each auto-inserts a numbered token into the document.</p>
                    </div>
                  </div>

                    {/* Item list */}
                    <div className="divide-y divide-slate-100">
                      {ackItems.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                            <ListChecks className="w-5 h-5 text-slate-400" />
                          </div>
                          <p className="text-sm font-medium text-slate-600">No acknowledgements yet</p>
                          <p className="text-xs text-slate-400 mt-1 max-w-xs">Add items below. Each becomes a required checkbox in the renter's signing flow with your exact wording.</p>
                        </div>
                      )}
                      {ackItems.map((ack, idx) => (
                        <div key={ack.id} className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50 transition-colors group">
                          {/* Grip + order controls */}
                          <div className="flex flex-col items-center gap-0.5 pt-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveAck(ack.id, "up")}
                              disabled={idx === 0 || reorderingAck === ack.id}
                              className="p-0.5 rounded text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title="Move up"
                            >
                              <Up className="w-3.5 h-3.5" />
                            </button>
                            <GripVertical className="w-3.5 h-3.5 text-slate-200 group-hover:text-slate-400 transition-colors" />
                            <button
                              type="button"
                              onClick={() => handleMoveAck(ack.id, "down")}
                              disabled={idx === ackItems.length - 1 || reorderingAck === ack.id}
                              className="p-0.5 rounded text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title="Move down"
                            >
                              <Down className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Item number + token badge */}
                          <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
                            <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[10px] font-bold text-emerald-700">
                              {idx + 1}
                            </div>
                            <button
                              type="button"
                              onClick={() => insertToken(`{{ack_${idx + 1}}}`)}
                              className="text-[9px] font-mono text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5 hover:bg-emerald-100 transition-colors whitespace-nowrap"
                              title={`Insert {{ack_${idx + 1}}} into document`}
                            >
                              ack_{idx + 1}
                            </button>
                          </div>

                          {/* Content / inline editor */}
                          <div className="flex-1 min-w-0">
                            {editingAckId === ack.id ? (
                              <div className="space-y-2">
                                <textarea
                                  value={editingAckText}
                                  onChange={e => setEditingAckText(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSaveEditAck(ack.id);
                                    if (e.key === "Escape") handleCancelEditAck();
                                  }}
                                  autoFocus
                                  rows={3}
                                  className="w-full text-sm border border-emerald-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400/40 bg-white text-slate-800"
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditAck(ack.id)}
                                    disabled={!editingAckText.trim()}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 transition-opacity"
                                    style={{ backgroundColor: "#3ab549" }}
                                  >
                                    <Check className="w-3 h-3" /> Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelEditAck}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                                  >
                                    <X className="w-3 h-3" /> Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* Renter-preview checkbox look */}
                                <div className="flex items-start gap-2.5 mb-2">
                                  <div className="mt-0.5 w-4 h-4 rounded border-2 border-emerald-500 bg-emerald-50 shrink-0" />
                                  <p className="text-sm text-slate-800 leading-relaxed">{ack.text}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleAckRequired(ack)}
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${
                                      ack.required
                                        ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
                                        : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                                    }`}
                                  >
                                    {ack.required ? "Required" : "Optional"} — click to toggle
                                  </button>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Edit / delete actions */}
                          {editingAckId !== ack.id && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditAck(ack)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAck(ack.id)}
                                disabled={deletingAck === ack.id}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Delete"
                              >
                                {deletingAck === ack.id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add new item form */}
                    <div className="px-5 py-4 bg-slate-50 border-t border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Add New Acknowledgement</p>
                      <textarea
                        value={ackText}
                        onChange={e => setAckText(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddAck(); }}
                        placeholder='Type the exact text the renter must acknowledge — e.g. "I understand that I am responsible for all damage or loss during the rental period."'
                        rows={3}
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white placeholder-slate-400"
                      />
                      <div className="flex items-center gap-3 mt-2">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={ackRequired}
                            onChange={e => setAckRequired(e.target.checked)}
                            className="w-3.5 h-3.5 accent-primary rounded"
                          />
                          <span className="text-xs text-slate-600">Required</span>
                        </label>
                        <p className="text-xs text-slate-400 flex-1">⌘↵ to add quickly</p>
                        <button
                          type="button"
                          onClick={handleAddAck}
                          disabled={savingAck || !ackText.trim()}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50 transition-opacity shadow-sm"
                          style={{ backgroundColor: "#3ab549" }}
                        >
                          {savingAck ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                          Add Acknowledgement
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Renter preview section */}
                  {ackItems.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-200">
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Renter View Preview</p>
                        <p className="text-xs text-slate-400 ml-1">— this is what renters see before signing</p>
                      </div>
                      <div className="p-5 space-y-3">
                        {ackItems.map((ack, idx) => (
                          <div
                            key={ack.id}
                            className="flex items-start gap-3 p-4 rounded-xl border border-emerald-100 bg-emerald-50"
                          >
                            <div className="mt-0.5 w-4 h-4 rounded border-2 border-emerald-500 bg-emerald-500 flex items-center justify-center shrink-0">
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" /></svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-800 leading-relaxed">{ack.text}</p>
                              {!ack.required && <p className="text-[10px] text-slate-400 mt-0.5">Optional</p>}
                            </div>
                            <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">#{idx + 1}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              {/* ── OutdoorShare Platform Agreements (preview only) ────────── */}
              {viewMode === "preview" && includePlatform && platformAgreements.length > 0 && (
                <div className="space-y-4">
                  {/* Section divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 border-t border-slate-200" />
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-xs font-semibold text-emerald-700">OutdoorShare Required Documents</span>
                    </div>
                    <div className="flex-1 border-t border-slate-200" />
                  </div>
                  <p className="text-xs text-center text-slate-400">
                    The following agreements are required by OutdoorShare and are automatically appended to every signed packet.
                  </p>

                  {platformAgreements.map(pa => (
                    <div key={pa.id} className="bg-white rounded-sm shadow-[0_2px_8px_rgba(0,0,0,0.10),0_0_0_1px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden">
                      {/* OutdoorShare badge strip */}
                      <div className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-50 to-white border-b border-emerald-100">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-xs font-semibold text-emerald-700">OutdoorShare Platform Agreement</span>
                        <span className="ml-auto text-[10px] text-slate-400">v{pa.version}</span>
                      </div>
                      {/* Title */}
                      <div className="px-16 pt-10 pb-6 border-b border-slate-100">
                        <p className="text-2xl font-bold text-slate-900 tracking-tight"
                          style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                          {pa.title}
                        </p>
                      </div>
                      {/* Content */}
                      <div className="px-16 py-10 text-slate-800 min-h-[200px]"
                        style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontSize: "14.5px" }}
                        dangerouslySetInnerHTML={{ __html: markdownToHtml(pa.content) || "<p style='color:#94a3b8'>No content.</p>" }} />
                      {/* Checkbox preview */}
                      <div className="px-16 pb-10">
                        <label className="flex items-start gap-3 cursor-default select-none">
                          <div className="mt-0.5 w-4 h-4 rounded border-2 border-emerald-500 bg-emerald-500 flex items-center justify-center shrink-0">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" /></svg>
                          </div>
                          <span className="text-sm text-slate-700" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                            {pa.checkboxLabel}
                          </span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Hint when platform docs are disabled */}
              {viewMode === "preview" && !includePlatform && (
                <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-amber-50 border border-amber-200">
                  <ShieldOff className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700">
                    OutdoorShare platform agreements are <strong>disabled</strong> for this contract. Only your operator contract above will appear in the renter signing flow.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Settings drawer */}
          <div className="bg-white border-t border-slate-200 shrink-0">
            <button type="button" onClick={() => setSettingsOpen(v => !v)}
              className="w-full flex items-center justify-between px-6 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">
              <span className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-slate-400" />
                Agreement settings — checkbox label, platform policy &amp; listing assignment
              </span>
              {settingsOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
            </button>

            {settingsOpen && (
              <div className="px-6 pb-5 border-t border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="checkbox-label" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Renter Checkbox Label</Label>
                    <Input id="checkbox-label" value={checkboxLabel} onChange={e => setCheckboxLabel(e.target.value)}
                      placeholder="I have read and agree to the rental terms and conditions" className="text-sm" />
                    <p className="text-xs text-slate-400">The exact text shown next to the checkbox renters must check before signing.</p>
                  </div>
                  <div className="pt-1">{platformSettingsJSX}</div>
                </div>

                {/* Listing assignment */}
                <div className="mt-5 space-y-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5" /> Assign to Specific Rentals
                  </Label>
                  <p className="text-xs text-slate-400">
                    Leave empty to use as the default template for all rentals.
                    When assigned to specific rentals, this template only applies to bookings for those rentals.
                  </p>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setListingDropOpen(v => !v)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 hover:border-slate-300 transition-colors"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <Link2 className="w-3.5 h-3.5 text-slate-400" />
                        {editorListingIds.length === 0
                          ? <span className="text-slate-400">All rentals (default)</span>
                          : <span>{assignmentLabel(editorListingIds)}</span>
                        }
                      </span>
                      {listingDropOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {listingDropOpen && (
                      <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10 max-h-60 overflow-y-auto">
                        {/* "All rentals" option */}
                        <button
                          type="button"
                          onClick={() => setEditorListingIds([])}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${editorListingIds.length === 0 ? "text-emerald-700 font-medium" : "text-slate-700"}`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${editorListingIds.length === 0 ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`}>
                            {editorListingIds.length === 0 && <CheckCircle className="w-3 h-3 text-white" />}
                          </div>
                          All rentals (default)
                        </button>
                        {listings.length > 0 && <div className="border-t border-slate-100" />}
                        {listings.map(l => {
                          const checked = editorListingIds.includes(l.id);
                          return (
                            <button
                              key={l.id}
                              type="button"
                              onClick={() => {
                                setEditorListingIds(prev =>
                                  prev.includes(l.id) ? prev.filter(id => id !== l.id) : [...prev, l.id]
                                );
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${checked ? "text-emerald-700 font-medium" : "text-slate-700"}`}
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`}>
                                {checked && <CheckCircle className="w-3 h-3 text-white" />}
                              </div>
                              {l.title}
                            </button>
                          );
                        })}
                        {listings.length === 0 && (
                          <p className="px-4 py-3 text-xs text-slate-400">No rentals found. Create rentals first.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Acknowledgements are now managed in the dedicated Acknowledgements tab */}
                <div className="mt-5 pt-5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { setSettingsOpen(false); setViewMode("acks"); }}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-2 transition-colors"
                  >
                    <ListChecks className="w-3.5 h-3.5" />
                    Manage Acknowledgements
                    {ackItems.length > 0 && (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-800">
                        {ackItems.length}
                      </span>
                    )}
                  </button>
                  <p className="text-xs text-slate-400 mt-1.5">Custom per-item acknowledgements the renter must check before signing.</p>
                </div>
              </div>
            )}
          </div>

          {/* Status bar */}
          <div className="bg-white border-t border-slate-200 px-6 py-2.5 flex items-center justify-between shrink-0">
            <p className="text-xs text-slate-400">
              {wordCount.toLocaleString()} {wordCount === 1 ? "word" : "words"}{content.length > 0 && <> · {content.length.toLocaleString()} characters</>}
            </p>
            <div className="flex items-center gap-3">
              {saved && <span className="text-xs text-emerald-600 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Saved</span>}
              <Button onClick={handleSave} disabled={saving || !title.trim() || !content.trim()} size="sm"
                style={{ backgroundColor: "#3ab549" }} className="text-white text-xs px-4">
                {saving
                  ? <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</span>
                  : <span className="flex items-center gap-1.5"><Save className="w-3.5 h-3.5" /> Save Template</span>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── UPLOAD PDF MODE ─────────────────────────────────────────────── */}
      {mode === "upload_pdf" && (
        <div className="flex-1 overflow-y-auto py-8 px-6 flex justify-center">
          <div className="w-full max-w-[640px] space-y-5 pb-8">
            {/* Active PDF card (editing an existing PDF template) */}
            {uploadPhase === "card" && editorContract?.contractType === "uploaded_pdf" && (
              <ActivePdfCard
                contract={editorContract}
                onReplace={() => { setPdfFile(null); setUploadPhase("upload_form"); setUploadProgress("idle"); }}
                onRemove={() => handleDelete(editorContract.id, editorContract.title).then(closeEditor)}
              />
            )}

            {/* Upload form */}
            {(uploadPhase === "upload_form" || !editorContract || editorContract.contractType !== "uploaded_pdf") && (
              <>
                {uploadPhase === "upload_form" && editorContract?.contractType === "uploaded_pdf" && (
                  <button type="button" onClick={() => setUploadPhase("card")}
                    className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5">
                    ← Back to current PDF
                  </button>
                )}

                <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">
                    Upload your own PDF contract. It will be included as-is in the final signed document alongside any
                    OutdoorShare platform agreements. The renter must check the box and sign before their booking confirms.
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Agreement Title</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Rental Agreement" />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">PDF File</Label>
                    {(uploadProgress === "uploading" || uploadProgress === "processing") && (
                      <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-blue-800">{uploadProgress === "uploading" ? "Uploading…" : "Processing…"}</p>
                          <p className="text-xs text-blue-600 mt-0.5">Please wait, do not close this page</p>
                        </div>
                      </div>
                    )}
                    {uploadProgress === "error" && (
                      <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                        <p className="text-sm text-red-700">{error || "Upload failed. Please try again."}</p>
                      </div>
                    )}
                    {pdfFile && uploadProgress !== "uploading" && uploadProgress !== "processing" ? (
                      <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <FileText className="w-5 h-5 text-slate-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{pdfFile.name}</p>
                          <p className="text-xs text-slate-400">{formatBytes(pdfFile.size)}</p>
                        </div>
                        <button type="button" onClick={() => { setPdfFile(null); setUploadProgress("idle"); }} className="text-slate-400 hover:text-red-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : uploadProgress === "idle" && (
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        className="w-full flex flex-col items-center gap-3 p-10 border-2 border-dashed border-slate-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors text-slate-400 hover:text-emerald-600">
                        <Upload className="w-8 h-8" />
                        <div className="text-center">
                          <p className="text-sm font-medium">Click to select a PDF</p>
                          <p className="text-xs mt-0.5">Max 20 MB · PDF only</p>
                        </div>
                      </button>
                    )}
                    <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) { setPdfFile(f); setUploadProgress("idle"); setError(""); } e.target.value = ""; }} />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pdf-checkbox-label" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Renter Checkbox Label</Label>
                    <Input id="pdf-checkbox-label" value={checkboxLabel} onChange={e => setCheckboxLabel(e.target.value)}
                      placeholder="I have read and agree to the attached rental agreement" />
                  </div>

                  <div className="pt-1">{platformSettingsJSX}</div>

                  {/* Listing assignment for PDF */}
                  <div className="space-y-2 pt-2">
                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5" /> Assign to Specific Rentals
                    </Label>
                    <p className="text-xs text-slate-400">Leave empty to use as the default for all rentals.</p>
                    <div className="relative">
                      <button type="button" onClick={() => setListingDropOpen(v => !v)}
                        className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 hover:border-slate-300 transition-colors">
                        <span className="flex items-center gap-2">
                          <Link2 className="w-3.5 h-3.5 text-slate-400" />
                          {editorListingIds.length === 0
                            ? <span className="text-slate-400">All rentals (default)</span>
                            : <span>{assignmentLabel(editorListingIds)}</span>
                          }
                        </span>
                        {listingDropOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </button>
                      {listingDropOpen && (
                        <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10 max-h-60 overflow-y-auto">
                          <button type="button" onClick={() => setEditorListingIds([])}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 ${editorListingIds.length === 0 ? "text-emerald-700 font-medium" : "text-slate-700"}`}>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${editorListingIds.length === 0 ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`}>
                              {editorListingIds.length === 0 && <CheckCircle className="w-3 h-3 text-white" />}
                            </div>
                            All rentals (default)
                          </button>
                          {listings.length > 0 && <div className="border-t border-slate-100" />}
                          {listings.map(l => {
                            const checked = editorListingIds.includes(l.id);
                            return (
                              <button key={l.id} type="button"
                                onClick={() => setEditorListingIds(prev => prev.includes(l.id) ? prev.filter(id => id !== l.id) : [...prev, l.id])}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 ${checked ? "text-emerald-700 font-medium" : "text-slate-700"}`}>
                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`}>
                                  {checked && <CheckCircle className="w-3 h-3 text-white" />}
                                </div>
                                {l.title}
                              </button>
                            );
                          })}
                          {listings.length === 0 && <p className="px-4 py-3 text-xs text-slate-400">No rentals found.</p>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  {saved && <span className="text-sm text-emerald-600 flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Uploaded!</span>}
                  <Button onClick={handlePdfUpload} disabled={uploading || !pdfFile} style={{ backgroundColor: "#3ab549" }} className="text-white">
                    {uploading
                      ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {uploadProgress === "processing" ? "Processing…" : "Uploading…"}</span>
                      : <span className="flex items-center gap-2"><Upload className="w-4 h-4" /> Upload PDF Contract</span>}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
