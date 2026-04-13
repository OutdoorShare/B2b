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

const DEFAULT_CONTENT = `This Rental Agreement ("Agreement") is entered into as of {{today}} between {{company_name}} ("Company") and {{full_name}} ("Renter").

1. RENTAL DETAILS
The Renter agrees to rent {{listing_name}} for the period from {{start_date}} to {{end_date}}. The total rental fee is {{total_price}}.

2. RENTER RESPONSIBILITIES
The Renter agrees to:
a) Use the rental equipment only for its intended purpose and in a safe manner.
b) Return the equipment in the same condition as received, normal wear and tear excepted.
c) Immediately report any damage, malfunction, or theft to the Company.
d) Be solely responsible for any citations, fines, or violations incurred during the rental period.

3. LIABILITY WAIVER
The Renter acknowledges that use of the rental equipment involves inherent risks, including the risk of personal injury, property damage, or death. The Renter voluntarily assumes all such risks and agrees to hold the Company harmless from any claims arising out of the rental.

4. DAMAGE & LOSS
The Renter is responsible for all damage to or loss of the rental equipment beyond normal wear and tear. The Renter authorizes the Company to charge the Renter's payment method on file for the cost of repairs or replacement.

5. IDENTIFICATION
The Renter represents that they are of legal rental age and possess any licenses or qualifications required to operate the rental equipment.

6. ADDITIONAL RIDERS & MINORS
Additional riders: {{additional_riders}}
Minors: {{minors}}
All additional riders and minors using the equipment are covered under the terms of this Agreement and are the Renter's sole responsibility.

7. GOVERNING LAW
This Agreement shall be governed by the laws of the jurisdiction where the Company is located.

By signing below, the Renter confirms they have read, understood, and agree to all terms of this Agreement.`;

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
  createdAt: string;
  updatedAt: string;
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
  const [contract, setContract] = useState<Contract | null>(null);
  const [history, setHistory]   = useState<Contract[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState("");

  const [mode, setMode]                     = useState<"template" | "upload_pdf">("template");
  const [uploadPhase, setUploadPhase]       = useState<"card" | "upload_form">("card");

  const [title, setTitle]                   = useState("Rental Agreement");
  const [content, setContent]               = useState(DEFAULT_CONTENT);
  const [checkboxLabel, setCheckboxLabel]   = useState("I have read and agree to the rental terms and conditions");
  const [includePlatform, setIncludePlatform] = useState(true);
  const [settingsOpen, setSettingsOpen]     = useState(false);
  const [historyOpen, setHistoryOpen]       = useState(false);

  const [showPlatformWarning, setShowPlatformWarning]             = useState(false);
  const [platformWarningAcknowledged, setPlatformWarningAcknowledged] = useState(false);
  const [disablingPlatform, setDisablingPlatform]                 = useState(false);

  const fileInputRef              = useRef<HTMLInputElement>(null);
  const textareaRef               = useRef<HTMLTextAreaElement>(null);
  const [pdfFile, setPdfFile]     = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "processing" | "done" | "error">("idle");

  const wordCount = useMemo(() => content.trim().split(/\s+/).filter(Boolean).length, [content]);

  const loadData = async () => {
    try {
      const [active, hist] = await Promise.all([
        apiFetch("contracts").catch(() => null),
        apiFetch("contracts/history").catch(() => []),
      ]);
      if (active) {
        setContract(active);
        setTitle(active.title);
        setContent(active.content || DEFAULT_CONTENT);
        setCheckboxLabel(active.checkboxLabel);
        setIncludePlatform(active.includeOutdoorShareAgreements !== false);
        if (active.contractType === "uploaded_pdf") {
          setMode("upload_pdf");
          setUploadPhase("card");
        }
      }
      setHistory(hist || []);
    } catch { /* fallback */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const insertToken = (token: string) => {
    const ta = textareaRef.current;
    if (!ta) { setContent(prev => prev + " " + token); return; }
    const start = ta.selectionStart ?? content.length;
    const end   = ta.selectionEnd   ?? content.length;
    const next  = content.slice(0, start) + token + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + token.length, start + token.length); });
  };

  const handleSave = async () => {
    setError(""); setSaving(true); setSaved(false);
    try {
      const data = await apiFetch("contracts", {
        method: "POST",
        body: JSON.stringify({ title, content, checkboxLabel, includeOutdoorShareAgreements: includePlatform }),
      });
      setContract(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await loadData();
    } catch (e: any) {
      setError(e.message || "Failed to save contract");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!contract) return;
    if (!confirm("Remove your current contract? Renters will only see OutdoorShare's platform agreements going forward.")) return;
    setDeleting(true);
    try {
      await apiFetch("contracts/active", { method: "DELETE" });
      setContract(null);
      setTitle("Rental Agreement");
      setContent(DEFAULT_CONTENT);
      setCheckboxLabel("I have read and agree to the rental terms and conditions");
      setIncludePlatform(true);
      setPdfFile(null);
      setMode("template");
      setUploadPhase("card");
      await loadData();
    } catch (e: any) {
      setError(e.message || "Failed to remove contract");
    } finally { setDeleting(false); }
  };

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
      setUploadProgress("processing");
      const res = await fetch(`${BASE}/api/contracts/upload-pdf`, { method: "POST", headers, body: fd });
      if (!res.ok) { const t = await res.text(); throw new Error(t || "Upload failed"); }
      const data = await res.json();
      setContract(data);
      setPdfFile(null);
      setUploadPhase("card");
      setUploadProgress("done");
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
      await loadData();
    } catch (e: any) {
      setError(e.message || "Failed to upload PDF");
      setUploadProgress("error");
    } finally { setUploading(false); }
  };

  const handleActivate = async (id: number) => {
    try {
      const data = await apiFetch(`contracts/${id}/activate`, { method: "PATCH" });
      setContract(data);
      setTitle(data.title);
      setContent(data.content || DEFAULT_CONTENT);
      setCheckboxLabel(data.checkboxLabel);
      setIncludePlatform(data.includeOutdoorShareAgreements !== false);
      if (data.contractType === "uploaded_pdf") { setMode("upload_pdf"); setUploadPhase("card"); }
      else setMode("template");
      await loadData();
    } catch (e: any) {
      setError(e.message || "Failed to activate version");
    }
  };

  // ── Platform toggle handler (shared) ────────────────────────────────────────
  const platformToggle = (checked: boolean) => {
    if (!checked) requestDisablePlatform();
    else { setIncludePlatform(true); setShowPlatformWarning(false); }
  };

  // ── Platform settings JSX (shared) ──────────────────────────────────────────
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // ── Version History section (shared at bottom) ───────────────────────────────
  const historySection = history.length > 1 && (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setHistoryOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <History className="w-4 h-4 text-slate-400" />
          Version History
          <Badge variant="outline" className="text-xs text-slate-500 border-slate-200">{history.length}</Badge>
        </span>
        {historyOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {historyOpen && (
        <div className="border-t border-slate-100 px-5">
          {history.map(row => (
            <HistoryRow key={row.id} row={row} onActivate={handleActivate} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-screen bg-slate-100">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
            <FileSignature className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-900 leading-none">Contract Builder</h1>
            <p className="text-xs text-slate-400 mt-0.5">Create the agreement your renters sign at checkout</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {contract && (
            <Badge variant="outline" className="text-xs text-slate-400 border-slate-200">v{contract.version}</Badge>
          )}
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
          {contract && (
            <button type="button" onClick={handleDelete} disabled={deleting}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Remove contract">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* ── Alerts ───────────────────────────────────────────────────────── */}
      {(!contract || error) && (
        <div className="px-6 pt-3 space-y-2 shrink-0">
          {!contract && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">No contract yet. Use the editor below to get started, then save.</p>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* ── TEMPLATE MODE ────────────────────────────────────────────────── */}
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
            </div>
          </div>

          {/* Document canvas */}
          <div className="flex-1 overflow-y-auto py-8 px-6 flex justify-center">
            <div className="w-full max-w-[780px] space-y-6">
              <div className="bg-white rounded-sm shadow-[0_2px_8px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)] flex flex-col" style={{ minHeight: 900 }}>
                <div className="px-16 pt-14 pb-6 border-b border-slate-100">
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                    className="w-full text-2xl font-bold text-slate-900 placeholder-slate-300 bg-transparent border-none outline-none tracking-tight"
                    placeholder="Agreement Title"
                    style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }} />
                  {contract?.updatedAt && (
                    <p className="text-xs text-slate-400 mt-2">Last saved {new Date(contract.updatedAt).toLocaleString()}</p>
                  )}
                </div>
                <div className="flex-1 px-16 py-10">
                  <textarea ref={textareaRef} id="contract-content" value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Start typing your agreement…"
                    className="w-full h-full min-h-[640px] bg-transparent border-none outline-none resize-none text-slate-800 placeholder-slate-300"
                    style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontSize: "14.5px", lineHeight: "1.9", letterSpacing: "0.01em" }}
                    spellCheck />
                </div>
              </div>

              {historySection}
            </div>
          </div>

          {/* Settings drawer */}
          <div className="bg-white border-t border-slate-200 shrink-0">
            <button type="button" onClick={() => setSettingsOpen(v => !v)}
              className="w-full flex items-center justify-between px-6 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">
              <span className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-slate-400" />
                Agreement settings — checkbox label &amp; platform policy
              </span>
              {settingsOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
            </button>

            {settingsOpen && (
              <div className="px-6 pb-5 grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-100">
                <div className="space-y-1.5 pt-4">
                  <Label htmlFor="checkbox-label" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Renter Checkbox Label</Label>
                  <Input id="checkbox-label" value={checkboxLabel} onChange={e => setCheckboxLabel(e.target.value)}
                    placeholder="I have read and agree to the rental terms and conditions" className="text-sm" />
                  <p className="text-xs text-slate-400">The exact text shown next to the checkbox renters must check before signing.</p>
                </div>
                <div className="pt-5">{platformSettingsJSX}</div>
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
                  : <span className="flex items-center gap-1.5"><Save className="w-3.5 h-3.5" /> Save Contract</span>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── UPLOAD PDF MODE ──────────────────────────────────────────────── */}
      {mode === "upload_pdf" && (
        <div className="flex-1 overflow-y-auto py-8 px-6 flex justify-center">
          <div className="w-full max-w-[640px] space-y-5 pb-8">

            {/* Active PDF card (shown when a PDF is already uploaded and not replacing) */}
            {uploadPhase === "card" && contract?.contractType === "uploaded_pdf" && (
              <ActivePdfCard
                contract={contract}
                onReplace={() => { setPdfFile(null); setUploadPhase("upload_form"); setUploadProgress("idle"); }}
                onRemove={handleDelete}
              />
            )}

            {/* Upload form (shown when no PDF yet, or replacing) */}
            {(uploadPhase === "upload_form" || !contract || contract.contractType !== "uploaded_pdf") && (
              <>
                {uploadPhase === "upload_form" && contract?.contractType === "uploaded_pdf" && (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setUploadPhase("card")}
                      className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5">
                      ← Back to current PDF
                    </button>
                  </div>
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

                    {/* Upload progress states */}
                    {(uploadProgress === "uploading" || uploadProgress === "processing") && (
                      <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-blue-800">
                            {uploadProgress === "uploading" ? "Uploading…" : "Processing…"}
                          </p>
                          <p className="text-xs text-blue-600 mt-0.5">Please wait, do not close this page</p>
                        </div>
                      </div>
                    )}

                    {uploadProgress === "done" && !pdfFile && (
                      <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                        <p className="text-sm font-medium text-emerald-800">Upload complete — PDF is now active</p>
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

            {historySection}
          </div>
        </div>
      )}
    </div>
  );
}
