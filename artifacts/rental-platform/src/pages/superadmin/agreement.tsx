import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Save, Eye, Edit3, RotateCcw, Clock,
  Info, CheckCircle2, Building2
} from "lucide-react";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getToken() { return localStorage.getItem("superadmin_token") ?? ""; }

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${BASE}/api/${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-superadmin-token": token, ...(opts?.headers ?? {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Request failed");
  return res.json();
}

const DEFAULT_AGREEMENT = `1. Use of Vehicle. The renter agrees to use the vehicle only for lawful purposes and in a safe manner. The vehicle shall not be used off-road unless specifically permitted, sub-rented, or used to tow any object unless specifically authorized.

2. Damage & Liability. The renter accepts full financial responsibility for any damage to the vehicle during the rental period, including but not limited to collisions, theft, vandalism, and weather damage. The security deposit will be held against damages and returned within 5 business days of vehicle return if no damage is found.

3. Age & License. The renter certifies they are of legal age to operate this vehicle and hold a valid license or certification required by law.

4. Fuel & Condition. The vehicle must be returned with the same fuel level and in the same general condition as when received. Cleaning fees may apply if the vehicle is returned excessively dirty.

5. Cancellation. Cancellations made more than 48 hours before the rental start date are eligible for a full refund. Cancellations within 48 hours may forfeit the deposit.

6. Payment. The total rental fee includes the base rental amount plus a refundable security deposit. No charge will be processed until this booking is confirmed by our team.

7. Governing Law. This agreement shall be governed by the laws of the state where the rental business is located. Any disputes shall be resolved through binding arbitration.`;

type Tab = "edit" | "preview";

export default function SuperAdminAgreementPage() {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [savedText, setSavedText] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    apiFetch("superadmin/agreement")
      .then(data => {
        setText(data.value || DEFAULT_AGREEMENT);
        setSavedText(data.value || DEFAULT_AGREEMENT);
        setUpdatedAt(data.updatedAt);
      })
      .catch(() => {
        setText(DEFAULT_AGREEMENT);
        setSavedText(DEFAULT_AGREEMENT);
      })
      .finally(() => setLoading(false));
  }, []);

  const isDirty = text !== savedText;

  async function handleSave() {
    setSaving(true);
    try {
      const data = await apiFetch("superadmin/agreement", {
        method: "PUT",
        body: JSON.stringify({ value: text }),
      });
      setSavedText(text);
      setUpdatedAt(data.updatedAt);
      toast({ title: "Agreement saved", description: "All companies will use the updated agreement immediately." });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setText(DEFAULT_AGREEMENT);
  }

  const paragraphs = text.split("\n\n").filter(Boolean);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl font-bold text-white">Rental Agreement Template</h1>
          </div>
          <p className="text-sm text-slate-400">
            This agreement is shown to every renter across all companies during checkout.
            Changes take effect immediately for all new bookings.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && (
            <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full font-medium">
              Unsaved changes
            </span>
          )}
          {updatedAt && !isDirty && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last saved {format(new Date(updatedAt), "MMM d, yyyy 'at' h:mm a")}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset to Default
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            {saving ? (
              <><span className="animate-spin mr-1.5">⏳</span> Saving…</>
            ) : (
              <><Save className="w-3.5 h-3.5 mr-1.5" /> Save Agreement</>
            )}
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-slate-300 space-y-1">
          <p className="font-medium text-blue-300">How it works</p>
          <p>The agreement body below is shown on every booking checkout. Each booking automatically prepends the renter name, listing title, and rental dates at the top, and appends the digital signature section at the bottom.</p>
        </div>
      </div>

      {/* Applies-to banner */}
      <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
        <Building2 className="w-4 h-4 text-emerald-400" />
        <span>Applies to <strong className="text-slate-200">all companies</strong> on the platform — this is the single global agreement template</span>
      </div>

      {/* Edit / Preview tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setTab("edit")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
              tab === "edit"
                ? "text-white border-b-2 border-emerald-400 bg-slate-800/50"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            onClick={() => setTab("preview")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
              tab === "preview"
                ? "text-white border-b-2 border-emerald-400 bg-slate-800/50"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Preview (as customer sees it)
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-500 text-sm">Loading agreement…</div>
        ) : tab === "edit" ? (
          <div className="p-4">
            <p className="text-xs text-slate-500 mb-2">
              Write each clause on its own paragraph (separated by a blank line). Plain text only — no markdown or HTML.
            </p>
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              rows={24}
              className="font-mono text-sm bg-slate-950 border-slate-700 text-slate-100 resize-y leading-relaxed focus:border-emerald-500 focus:ring-emerald-500/20"
              placeholder="Type your rental agreement clauses here…"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-slate-500">{text.length} characters · {text.split("\n\n").filter(Boolean).length} clauses</p>
              {isDirty && (
                <button onClick={() => setText(savedText)} className="text-xs text-slate-500 hover:text-slate-300 underline">
                  Discard changes
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6">
            <p className="text-xs text-slate-500 mb-5 italic">
              This is how the agreement appears to renters during checkout. The header and signature section are added automatically.
            </p>

            {/* Simulated booking header */}
            <div className="bg-white rounded-2xl border p-6 space-y-4 text-sm text-gray-500 leading-relaxed max-h-[520px] overflow-y-auto">
              <h2 className="text-base font-bold text-gray-900">Vehicle Rental Agreement</h2>
              <p><strong className="text-gray-900">Rental Period:</strong> Apr 1, 2026 — Apr 3, 2026 (2 days)</p>
              <p><strong className="text-gray-900">Vehicle:</strong> Yamaha FX Cruiser Jet Ski</p>
              <p><strong className="text-gray-900">Renter:</strong> Jane Smith (jane@example.com)</p>
              <Separator />
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              <p className="text-xs italic">By signing below, you confirm you have read, understood, and agree to all terms in this rental agreement.</p>
              <Separator />
              {/* Simulated signature area */}
              <div className="bg-gray-50 rounded-xl border px-4 py-3 space-y-2">
                <p className="font-semibold text-gray-800 text-sm">Sign the Agreement</p>
                <p className="text-xs text-gray-500">Type your full legal name below to sign</p>
                <div className="h-9 border rounded-lg bg-white flex items-center px-3 text-gray-400 text-sm italic">Jane Smith</div>
                <div className="flex items-center gap-2 mt-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-gray-600">I have read and agree to all terms in the rental agreement above, including the cancellation policy and damage liability.</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
