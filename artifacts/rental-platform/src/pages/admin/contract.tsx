import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  FileSignature, Save, Loader2, CheckCircle, AlertCircle,
  Info, Trash2, RefreshCw, Upload, FileText, X,
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

const TOKEN_HELPERS = [
  { token: "{{first_name}}",        label: "First Name" },
  { token: "{{last_name}}",         label: "Last Name" },
  { token: "{{full_name}}",         label: "Full Name" },
  { token: "{{email}}",             label: "Email" },
  { token: "{{phone}}",             label: "Phone" },
  { token: "{{booking_id}}",        label: "Booking #" },
  { token: "{{listing_name}}",      label: "Listing" },
  { token: "{{start_date}}",        label: "Start Date" },
  { token: "{{end_date}}",          label: "End Date" },
  { token: "{{company_name}}",      label: "Company" },
  { token: "{{additional_riders}}", label: "Riders" },
  { token: "{{minors}}",            label: "Minors" },
  { token: "{{today}}",             label: "Today's Date" },
  { token: "{{total_price}}",       label: "Total Price" },
  { token: "{{signed_at}}",         label: "Signed At" },
];

const DEFAULT_CONTENT = `RENTAL AGREEMENT

This Rental Agreement ("Agreement") is entered into as of {{today}} between {{company_name}} ("Company") and {{full_name}} ("Renter").

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

  // Mode: "template" (editor) or "upload_pdf"
  const [mode, setMode] = useState<"template" | "upload_pdf">("template");

  // Template fields
  const [title, setTitle]                     = useState("Rental Agreement");
  const [content, setContent]                 = useState(DEFAULT_CONTENT);
  const [checkboxLabel, setCheckboxLabel]     = useState("I have read and agree to the rental terms and conditions");
  const [includePlatform, setIncludePlatform] = useState(true);

  // PDF upload state
  const fileInputRef           = useRef<HTMLInputElement>(null);
  const [pdfFile, setPdfFile]  = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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
      } catch { /* no contract yet — use defaults */ }
      finally { setLoading(false); }
    })();
  }, []);

  const insertToken = (token: string) => {
    const ta = document.getElementById("contract-content") as HTMLTextAreaElement | null;
    if (!ta) { setContent(prev => prev + " " + token); return; }
    const start = ta.selectionStart ?? content.length;
    const end   = ta.selectionEnd ?? content.length;
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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
            <FileSignature className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Rental Contract Builder</h1>
            <p className="text-sm text-slate-500">Create the agreement your renters sign at checkout</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {contract && (
            <Badge variant="outline" className="text-xs text-slate-500 border-slate-200">
              Version {contract.version}
            </Badge>
          )}
          {contract && (
            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* Status */}
      {!contract && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            You don't have a contract yet. Use the template below to get started, then save it.
            Renters will see your contract as a checkbox they must agree to before signing.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setMode("template")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === "template"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <span className="flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" /> Build Template</span>
        </button>
        <button
          type="button"
          onClick={() => setMode("upload_pdf")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === "upload_pdf"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <span className="flex items-center gap-2"><Upload className="w-3.5 h-3.5" /> Upload PDF</span>
        </button>
      </div>

      {/* ── Template mode ─────────────────────────────────────────────────── */}
      {mode === "template" && (
        <>
          {/* Token helpers */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-slate-400" />
              <p className="text-sm font-medium text-slate-700">Template Tokens</p>
              <span className="text-xs text-slate-500">Click to insert at cursor</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TOKEN_HELPERS.map(t => (
                <button
                  key={t.token}
                  type="button"
                  onClick={() => insertToken(t.token)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-xs text-slate-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-colors font-mono"
                >
                  {t.token}
                </button>
              ))}
            </div>
          </div>

          {/* Contract fields */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="contract-title">Agreement Title</Label>
              <Input id="contract-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Rental Agreement" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contract-content">Agreement Text</Label>
              <Textarea
                id="contract-content"
                value={content}
                onChange={e => setContent(e.target.value)}
                className="min-h-[400px] font-mono text-sm resize-y"
                placeholder="Enter your full rental agreement text here…"
              />
              <p className="text-xs text-slate-400">
                Use <code className="bg-slate-100 px-1 rounded text-slate-600">{`{{token}}`}</code> placeholders to auto-fill renter and booking data.
                Supports <code className="bg-slate-100 px-1 rounded text-slate-600">{"{{#each riders}}"}</code> loops.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="checkbox-label">Renter Checkbox Label</Label>
              <Input
                id="checkbox-label"
                value={checkboxLabel}
                onChange={e => setCheckboxLabel(e.target.value)}
                placeholder="I have read and agree to the rental terms and conditions"
              />
              <p className="text-xs text-slate-400">This is the exact text the renter sees next to the checkbox they must check before signing.</p>
            </div>

            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <Switch id="include-platform" checked={includePlatform} onCheckedChange={setIncludePlatform} />
              <div>
                <Label htmlFor="include-platform" className="cursor-pointer">Include OutdoorShare platform agreements</Label>
                <p className="text-xs text-slate-500 mt-1">
                  When enabled, renters also accept OutdoorShare's Terms of Service and any other active platform agreements in addition to your contract.
                  Disable only if you have your own insurance arrangement and have been approved by OutdoorShare.
                </p>
              </div>
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center justify-between">
            {contract?.updatedAt && <p className="text-xs text-slate-400">Last saved: {new Date(contract.updatedAt).toLocaleString()}</p>}
            <div className="ml-auto flex items-center gap-3">
              {saved && <span className="text-sm text-emerald-600 flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Saved!</span>}
              <Button onClick={handleSave} disabled={saving || !title.trim() || !content.trim()} style={{ backgroundColor: "#3ab549" }} className="text-white">
                {saving
                  ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Saving…</span>
                  : <span className="flex items-center gap-2"><Save className="w-4 h-4" /> Save Contract</span>}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ── Upload PDF mode ────────────────────────────────────────────────── */}
      {mode === "upload_pdf" && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800">
              Upload your own PDF contract. It will be included as-is in the final signed document alongside any
              OutdoorShare platform agreements. The renter must check the checkbox below and sign before their
              booking is confirmed.
            </p>
          </div>

          {/* Current uploaded PDF status */}
          {contract?.contractType === "uploaded_pdf" && !pdfFile && (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-800">PDF contract active — {contract.title}</p>
                <p className="text-xs text-emerald-600 mt-0.5">Version {contract.version} · Saved {new Date(contract.updatedAt).toLocaleDateString()}</p>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Active</Badge>
            </div>
          )}

          {/* File picker */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div className="space-y-1.5">
              <Label>Agreement Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Rental Agreement" />
            </div>

            <div>
              <Label className="mb-2 block">PDF File</Label>
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
                  className="w-full flex flex-col items-center gap-2 p-8 border-2 border-dashed border-slate-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors text-slate-400 hover:text-emerald-600"
                >
                  <Upload className="w-7 h-7" />
                  <span className="text-sm font-medium">Click to select PDF</span>
                  <span className="text-xs">Max 20 MB</span>
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
              <Label htmlFor="pdf-checkbox-label">Renter Checkbox Label</Label>
              <Input
                id="pdf-checkbox-label"
                value={checkboxLabel}
                onChange={e => setCheckboxLabel(e.target.value)}
                placeholder="I have read and agree to the attached rental agreement"
              />
            </div>

            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <Switch id="include-platform-pdf" checked={includePlatform} onCheckedChange={setIncludePlatform} />
              <div>
                <Label htmlFor="include-platform-pdf" className="cursor-pointer">Include OutdoorShare platform agreements</Label>
                <p className="text-xs text-slate-500 mt-1">Your PDF will be combined with OutdoorShare's platform agreements in the final signed document.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div />
            <div className="flex items-center gap-3">
              {saved && <span className="text-sm text-emerald-600 flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Uploaded!</span>}
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
