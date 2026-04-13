import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  FileSignature, Save, Loader2, CheckCircle, AlertCircle,
  Info, Trash2, Upload, FileText, X, ChevronDown, ChevronUp,
  Type, Hash, Calendar, User, Building2, DollarSign, Users,
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

const TOKEN_GROUPS = [
  {
    label: "Renter",
    icon: User,
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
    icon: Hash,
    color: "text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100",
    tokens: [
      { token: "{{booking_id}}", label: "Booking #" },
      { token: "{{listing_name}}", label: "Listing" },
      { token: "{{total_price}}", label: "Total Price" },
    ],
  },
  {
    label: "Dates",
    icon: Calendar,
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
    icon: Building2,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
    tokens: [
      { token: "{{company_name}}", label: "Company" },
    ],
  },
  {
    label: "Riders",
    icon: Users,
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
          <p className="text-sm font-semibold text-red-800">Protection Plan will be automatically disabled</p>
          <p className="text-sm text-red-700 mt-1">
            OutdoorShare platform agreements are required for the Protection Plan to function. Turning this off will:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-red-700 list-disc list-inside">
            <li>Remove OutdoorShare's Terms of Service from your renter checkout</li>
            <li>Automatically mark the Protection Plan as optional on your account</li>
            <li>Renters will <strong>not</strong> receive OutdoorShare Protection Plan coverage</li>
            <li>In the event of damage or loss, OutdoorShare will not process claims</li>
          </ul>
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          className="mt-0.5 accent-red-600 w-4 h-4 shrink-0"
          checked={acknowledged}
          onChange={e => onAcknowledge(e.target.checked)}
        />
        <span className="text-sm font-medium text-red-800">
          I understand that disabling platform agreements will remove Protection Plan coverage from all future bookings and I accept full responsibility for unprotected rentals.
        </span>
      </label>

      <div className="flex items-center gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
        >
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

interface Contract {
  id: number;
  title: string;
  content: string;
  contractType?: "template" | "uploaded_pdf";
  uploadedPdfStorageKey?: string;
  checkboxLabel: string;
  includeOutdoorShareAgreements: boolean;
  version: number;
  isActive: boolean;
  updatedAt: string;
}

export default function ContractBuilder() {
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState("");

  const [mode, setMode] = useState<"template" | "upload_pdf">("template");

  const [title, setTitle]                     = useState("Rental Agreement");
  const [content, setContent]                 = useState(DEFAULT_CONTENT);
  const [checkboxLabel, setCheckboxLabel]     = useState("I have read and agree to the rental terms and conditions");
  const [includePlatform, setIncludePlatform] = useState(true);
  const [settingsOpen, setSettingsOpen]       = useState(false);

  // Platform-off warning flow
  const [showPlatformWarning, setShowPlatformWarning]             = useState(false);
  const [platformWarningAcknowledged, setPlatformWarningAcknowledged] = useState(false);
  const [disablingPlatform, setDisablingPlatform]                 = useState(false);

  const fileInputRef              = useRef<HTMLInputElement>(null);
  const textareaRef               = useRef<HTMLTextAreaElement>(null);
  const [pdfFile, setPdfFile]     = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const wordCount = useMemo(() => {
    const words = content.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }, [content]);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch("contracts");
        if (data) {
          setContract(data);
          setTitle(data.title);
          setContent(data.content || DEFAULT_CONTENT);
          setCheckboxLabel(data.checkboxLabel);
          setIncludePlatform(data.includeOutdoorShareAgreements !== false);
          if (data.contractType === "uploaded_pdf") setMode("upload_pdf");
        }
      } catch { /* no contract yet */ }
      finally { setLoading(false); }
    })();
  }, []);

  const insertToken = (token: string) => {
    const ta = textareaRef.current;
    if (!ta) { setContent(prev => prev + " " + token); return; }
    const start = ta.selectionStart ?? content.length;
    const end   = ta.selectionEnd   ?? content.length;
    const next  = content.slice(0, start) + token + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + token.length, start + token.length);
    });
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
    } catch (e: any) {
      setError(e.message || "Failed to save contract");
    } finally {
      setSaving(false);
    }
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
    } catch (e: any) {
      setError(e.message || "Failed to remove contract");
    } finally {
      setDeleting(false);
    }
  };

  // Called when user wants to turn platform agreements OFF — shows warning first
  const requestDisablePlatform = () => {
    setShowPlatformWarning(true);
    setPlatformWarningAcknowledged(false);
    setSettingsOpen(true); // ensure the settings drawer is open so the warning is visible
  };

  // Re-enable platform agreements — clears warning state
  const cancelDisablePlatform = () => {
    setShowPlatformWarning(false);
    setPlatformWarningAcknowledged(false);
    setIncludePlatform(true);
  };

  // Confirmed: disable platform agreements AND auto-disable protection plan
  const handleDisablePlatform = async () => {
    if (!platformWarningAcknowledged) return;
    setDisablingPlatform(true);
    try {
      // Automatically make protection plan optional (effectively disabled) when platform agreements are removed
      await apiFetch("business", {
        method: "PATCH",
        body: JSON.stringify({ protectionPlanOptional: true }),
      });
      setIncludePlatform(false);
      setShowPlatformWarning(false);
      setPlatformWarningAcknowledged(false);
    } catch (e: any) {
      setError(e.message || "Failed to update protection plan settings");
    } finally {
      setDisablingPlatform(false);
    }
  };

  const handlePdfUpload = async () => {
    if (!pdfFile) return;
    setError(""); setUploading(true); setSaved(false);
    try {
      const headers = adminHeaders();
      const fd = new FormData();
      fd.append("file", pdfFile);
      fd.append("title", title.trim() || "Rental Agreement");
      fd.append("checkboxLabel", checkboxLabel.trim() || "I have read and agree to the attached rental agreement");
      fd.append("includeOutdoorShareAgreements", String(includePlatform));
      const res = await fetch(`${BASE}/api/contracts/upload-pdf`, { method: "POST", headers, body: fd });
      if (!res.ok) { const t = await res.text(); throw new Error(t || "Upload failed"); }
      const data = await res.json();
      setContract(data);
      setPdfFile(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message || "Failed to upload PDF");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

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
            <Badge variant="outline" className="text-xs text-slate-400 border-slate-200">
              v{contract.version}
            </Badge>
          )}

          {/* Mode toggle */}
          <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setMode("template")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                mode === "template" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Type className="w-3 h-3" /> Build Template
            </button>
            <button
              type="button"
              onClick={() => setMode("upload_pdf")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                mode === "upload_pdf" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Upload className="w-3 h-3" /> Upload PDF
            </button>
          </div>

          {contract && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Remove contract"
            >
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
              <p className="text-xs text-amber-800">
                No contract yet. Use the editor below to get started, then save.
                Renters will see your contract as a checkbox they must agree to before signing.
              </p>
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
              {TOKEN_GROUPS.map(group => {
                const Icon = group.icon;
                return (
                  <div key={group.label} className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-0.5">
                      <Icon className="w-3 h-3" /> {group.label}
                    </span>
                    {group.tokens.map(t => (
                      <button
                        key={t.token}
                        type="button"
                        onClick={() => insertToken(t.token)}
                        title={`Insert ${t.token}`}
                        className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors ${group.color}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Document canvas */}
          <div className="flex-1 overflow-y-auto py-8 px-6 flex justify-center">
            <div
              className="w-full max-w-[780px] bg-white rounded-sm shadow-[0_2px_8px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)] flex flex-col"
              style={{ minHeight: 900 }}
            >
              {/* Document header / title area */}
              <div className="px-16 pt-14 pb-6 border-b border-slate-100">
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full text-2xl font-bold text-slate-900 placeholder-slate-300 bg-transparent border-none outline-none focus:outline-none tracking-tight"
                  placeholder="Agreement Title"
                  style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                />
                {contract?.updatedAt && (
                  <p className="text-xs text-slate-400 mt-2">
                    Last saved {new Date(contract.updatedAt).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Body text area */}
              <div className="flex-1 px-16 py-10">
                <textarea
                  ref={textareaRef}
                  id="contract-content"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Start typing your agreement…"
                  className="w-full h-full min-h-[640px] bg-transparent border-none outline-none resize-none text-slate-800 placeholder-slate-300"
                  style={{
                    fontFamily: "'Georgia', 'Times New Roman', serif",
                    fontSize: "14.5px",
                    lineHeight: "1.9",
                    letterSpacing: "0.01em",
                  }}
                  spellCheck
                />
              </div>
            </div>
          </div>

          {/* Settings drawer (collapsible) */}
          <div className="bg-white border-t border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setSettingsOpen(v => !v)}
              className="w-full flex items-center justify-between px-6 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-slate-400" />
                Agreement settings — checkbox label &amp; platform policy
              </span>
              {settingsOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
            </button>

            {settingsOpen && (
              <div className="px-6 pb-5 grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-100">
                <div className="space-y-1.5 pt-4">
                  <Label htmlFor="checkbox-label" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Renter Checkbox Label
                  </Label>
                  <Input
                    id="checkbox-label"
                    value={checkboxLabel}
                    onChange={e => setCheckboxLabel(e.target.value)}
                    placeholder="I have read and agree to the rental terms and conditions"
                    className="text-sm"
                  />
                  <p className="text-xs text-slate-400">The exact text shown next to the checkbox renters must check before signing.</p>
                </div>

                <div className="pt-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Switch
                      id="include-platform"
                      checked={includePlatform}
                      onCheckedChange={checked => {
                        if (!checked) { requestDisablePlatform(); }
                        else { setIncludePlatform(true); setShowPlatformWarning(false); }
                      }}
                    />
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
              </div>
            )}
          </div>

          {/* Status bar / save */}
          <div className="bg-white border-t border-slate-200 px-6 py-2.5 flex items-center justify-between shrink-0">
            <p className="text-xs text-slate-400">
              {wordCount.toLocaleString()} {wordCount === 1 ? "word" : "words"}
              {content.length > 0 && <> · {content.length.toLocaleString()} characters</>}
            </p>
            <div className="flex items-center gap-3">
              {saved && (
                <span className="text-xs text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" /> Saved
                </span>
              )}
              <Button
                onClick={handleSave}
                disabled={saving || !title.trim() || !content.trim()}
                size="sm"
                style={{ backgroundColor: "#3ab549" }}
                className="text-white text-xs px-4"
              >
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
          <div className="w-full max-w-[640px] space-y-5">

            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
                Upload your own PDF contract. It will be shown as-is in the final signed document alongside any
                OutdoorShare platform agreements. The renter must check the box and sign before their booking confirms.
              </p>
            </div>

            {contract?.contractType === "uploaded_pdf" && !pdfFile && (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-emerald-800">{contract.title}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    Version {contract.version} · Saved {new Date(contract.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 shrink-0">Active</Badge>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Agreement Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Rental Agreement" />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">PDF File</Label>
                {pdfFile ? (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <FileText className="w-5 h-5 text-slate-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{pdfFile.name}</p>
                      <p className="text-xs text-slate-400">{(pdfFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button type="button" onClick={() => setPdfFile(null)} className="text-slate-400 hover:text-red-500 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center gap-3 p-10 border-2 border-dashed border-slate-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors text-slate-400 hover:text-emerald-600"
                  >
                    <Upload className="w-8 h-8" />
                    <div className="text-center">
                      <p className="text-sm font-medium">Click to select a PDF</p>
                      <p className="text-xs mt-0.5">Max 20 MB</p>
                    </div>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setPdfFile(f); e.target.value = ""; }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pdf-checkbox-label" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Renter Checkbox Label
                </Label>
                <Input
                  id="pdf-checkbox-label"
                  value={checkboxLabel}
                  onChange={e => setCheckboxLabel(e.target.value)}
                  placeholder="I have read and agree to the attached rental agreement"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <Switch
                    id="include-platform-pdf"
                    checked={includePlatform}
                    onCheckedChange={checked => {
                      if (!checked) { requestDisablePlatform(); }
                      else { setIncludePlatform(true); setShowPlatformWarning(false); }
                    }}
                  />
                  <div>
                    <Label htmlFor="include-platform-pdf" className="cursor-pointer text-sm font-medium text-slate-700">
                      Include OutdoorShare platform agreements
                    </Label>
                    <p className="text-xs text-slate-400 mt-1">
                      Your PDF will be combined with OutdoorShare's platform agreements in the final signed document.
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
            </div>

            <div className="flex items-center justify-end gap-3 pb-8">
              {saved && (
                <span className="text-sm text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Uploaded!
                </span>
              )}
              {error && (
                <span className="text-sm text-red-500">{error}</span>
              )}
              <Button
                onClick={handlePdfUpload}
                disabled={uploading || !pdfFile}
                style={{ backgroundColor: "#3ab549" }}
                className="text-white"
              >
                {uploading
                  ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</span>
                  : <span className="flex items-center gap-2"><Upload className="w-4 h-4" /> Upload PDF Contract</span>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
