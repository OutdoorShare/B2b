import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Save, Eye, Edit3, RotateCcw, Clock,
  Info, CheckCircle2, Globe, Tag, Plus, Trash2, ChevronRight,
  Zap, UserCheck, FormInput, ToggleLeft, ToggleRight,
  Pencil, X, Hash, Calendar, AlignLeft, CheckSquare,
  Maximize2, Minimize2, Layers, Shield, ChevronUp, ChevronDown,
  AlertCircle, Loader2,
} from "lucide-react";
import { format } from "date-fns";

function getToken() { return localStorage.getItem("superadmin_token") ?? ""; }

async function apiFetch(path: string, opts?: RequestInit) {
  const tok = getToken();
  const res = await fetch(`/api/${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-superadmin-token": tok, ...(opts?.headers ?? {}) },
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

// ── Token definitions ────────────────────────────────────────────────────────
const AUTO_TOKENS = [
  { key: "renter_name",    label: "Renter Name",    example: "Jane Smith" },
  { key: "renter_email",   label: "Renter Email",   example: "jane@example.com" },
  { key: "renter_phone",   label: "Renter Phone",   example: "(555) 123-4567" },
  { key: "listing_title",  label: "Listing Title",  example: "Yamaha Jet Ski" },
  { key: "category",       label: "Category",       example: "Jet Ski" },
  { key: "start_date",     label: "Start Date",     example: "Apr 1, 2026" },
  { key: "end_date",       label: "End Date",       example: "Apr 3, 2026" },
  { key: "rental_days",    label: "# of Days",      example: "2" },
  { key: "price_per_day",  label: "Price / Day",    example: "$150.00" },
  { key: "subtotal",       label: "Subtotal",       example: "$300.00" },
  { key: "deposit_amount", label: "Deposit",        example: "$250.00" },
  { key: "total_price",    label: "Total Price",    example: "$550.00" },
  { key: "company_name",   label: "Company Name",   example: "My Rental Co." },
] as const;

const RENTER_TOKENS = [
  { key: "drivers_license",    label: "Driver's License #"  },
  { key: "home_address",       label: "Home Address"        },
  { key: "emergency_contact",  label: "Emergency Contact"   },
] as const;

const AUTO_KEYS = new Set(AUTO_TOKENS.map(t => t.key));
const RENTER_KEYS = new Set(RENTER_TOKENS.map(t => t.key));

// ── Preview renderer (replaces {{tokens}} with examples) ─────────────────────
function renderPreviewText(text: string): React.ReactNode[] {
  const parts = text.split(/({{[^}]+}})/g);
  return parts.map((part, i) => {
    const m = part.match(/^{{(.+)}}$/);
    if (!m) return <span key={i}>{part}</span>;
    const key = m[1].trim();
    const autoTok = AUTO_TOKENS.find(t => t.key === key);
    if (autoTok) {
      return (
        <span key={i} className="inline-flex items-center bg-emerald-500/20 text-emerald-300 rounded px-1 text-[11px] font-mono font-semibold mx-0.5">
          {autoTok.example || `[${autoTok.label}]`}
        </span>
      );
    }
    if (RENTER_KEYS.has(key as any)) {
      const renterTok = RENTER_TOKENS.find(t => t.key === key)!;
      return (
        <span key={i} className="inline-flex items-center bg-amber-500/20 text-amber-300 rounded px-1 text-[11px] font-mono font-semibold mx-0.5">
          [{renterTok.label}: ___________]
        </span>
      );
    }
    return (
      <span key={i} className="inline-flex items-center bg-slate-500/20 text-slate-400 rounded px-1 text-[11px] font-mono mx-0.5">
        [{key}: ___________]
      </span>
    );
  });
}

// ── Customer preview renderer (white bg) ─────────────────────────────────────
function renderCustomerPreview(text: string): React.ReactNode[] {
  const parts = text.split(/({{[^}]+}})/g);
  return parts.map((part, i) => {
    const m = part.match(/^{{(.+)}}$/);
    if (!m) return <span key={i}>{part}</span>;
    const key = m[1].trim();
    const autoTok = AUTO_TOKENS.find(t => t.key === key);
    if (autoTok) {
      return (
        <span key={i} className="bg-emerald-100 text-emerald-800 rounded px-1 text-xs font-semibold border border-emerald-300 mx-0.5">
          {autoTok.example}
        </span>
      );
    }
    return (
      <span key={i} className="bg-amber-50 border border-amber-300 rounded px-2 py-0.5 text-xs text-gray-600 italic mx-0.5">
        [Renter fills in]
      </span>
    );
  });
}

// ── Agreement editor component ────────────────────────────────────────────────
type ViewMode = "split" | "edit" | "preview";

function AgreementEditor({
  label,
  description,
  initialValue,
  savedValue,
  updatedAt,
  onSave,
  onDelete,
  saving,
  deleting,
  customFields,
  onInsertTokenRef,
}: {
  label: string;
  description: string;
  initialValue: string;
  savedValue: string;
  updatedAt: string | null;
  onSave: (value: string) => void;
  onDelete?: () => void;
  saving: boolean;
  deleting?: boolean;
  customFields?: ContractField[];
  onInsertTokenRef?: React.MutableRefObject<((token: string) => void) | null>;
}) {
  const [text, setText] = useState(initialValue);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorRef = useRef<number>(0);

  useEffect(() => { setText(initialValue); }, [initialValue]);

  // Escape key exits fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  const isDirty = text !== savedValue;
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim());

  function trackCursor() {
    if (textareaRef.current) cursorRef.current = textareaRef.current.selectionStart ?? text.length;
  }

  function insertToken(token: string) {
    const el = textareaRef.current;
    const pos = cursorRef.current ?? text.length;
    const newText = text.slice(0, pos) + token + text.slice(pos);
    setText(newText);
    const newPos = pos + token.length;
    cursorRef.current = newPos;
    setViewMode(m => m === "preview" ? "split" : m);
    requestAnimationFrame(() => {
      if (el) { el.focus(); el.setSelectionRange(newPos, newPos); }
    });
  }

  useEffect(() => {
    if (onInsertTokenRef) onInsertTokenRef.current = insertToken;
  });

  function handleDrop(e: React.DragEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    const token = e.dataTransfer.getData("text/plain");
    if (!token) return;
    const el = e.currentTarget;
    const pos = typeof el.selectionStart === "number" ? el.selectionStart : text.length;
    const newText = text.slice(0, pos) + token + text.slice(pos);
    setText(newText);
    const newPos = pos + token.length;
    cursorRef.current = newPos;
    requestAnimationFrame(() => {
      if (el) { el.focus(); el.setSelectionRange(newPos, newPos); }
    });
  }

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 flex flex-col bg-slate-900" : "flex-1 min-w-0 flex flex-col gap-3"}>
      {/* Header */}
      <div className={`flex items-start justify-between gap-4 flex-wrap ${isFullscreen ? "px-4 pt-4" : ""}`}>
        <div>
          <h2 className="text-lg font-bold text-white">{label}</h2>
          <p className="text-sm text-slate-400 mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isDirty && (
            <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full font-medium">
              Unsaved changes
            </span>
          )}
          {updatedAt && !isDirty && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Saved {format(new Date(updatedAt), "MMM d, yyyy 'at' h:mm a")}
            </span>
          )}
          {onDelete && (
            <Button variant="outline" size="sm" onClick={onDelete} disabled={deleting}
              className="border-red-700/50 text-red-400 hover:bg-red-900/30 hover:text-red-300 hover:border-red-600">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {deleting ? "Removing…" : "Remove Override"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setText(DEFAULT_AGREEMENT)}
            className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset to Default
          </Button>
          <Button size="sm" onClick={() => onSave(text)} disabled={saving || !isDirty}
            className="bg-emerald-500 hover:bg-emerald-600 text-white">
            {saving ? <><span className="animate-spin mr-1.5">⏳</span>Saving…</> : <><Save className="w-3.5 h-3.5 mr-1.5" />Save Agreement</>}
          </Button>
        </div>
      </div>

      {/* Document editor card */}
      <div className={`border border-slate-700 overflow-hidden flex flex-col shadow-xl ${isFullscreen ? "flex-1 rounded-none" : "rounded-2xl"}`}>

        {/* ── Toolbar bar: token insertion ─────────────────────────────── */}
        <div className="bg-slate-800 border-b border-slate-700 px-3 py-2 flex items-start gap-2 flex-wrap">
          {/* Auto tokens */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1 shrink-0">
              <Zap className="w-2.5 h-2.5" /> Auto
            </span>
            {AUTO_TOKENS.map(tok => (
              <button
                key={tok.key}
                onClick={() => insertToken(`{{${tok.key}}}`)}
                title={`Insert {{${tok.key}}} — filled from booking`}
                className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 font-medium transition-colors"
              >
                {tok.label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-slate-700 self-center shrink-0 mx-0.5" />

          {/* Renter tokens */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1 shrink-0">
              <UserCheck className="w-2.5 h-2.5" /> Renter
            </span>
            {RENTER_TOKENS.map(tok => (
              <button
                key={tok.key}
                onClick={() => insertToken(`{{${tok.key}}}`)}
                title={`Insert {{${tok.key}}} — renter fills in`}
                className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 font-medium transition-colors"
              >
                {tok.label}
              </button>
            ))}
          </div>

          {customFields && customFields.length > 0 && (
            <>
              <div className="w-px h-5 bg-slate-700 self-center shrink-0 mx-0.5" />
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                  <FormInput className="w-2.5 h-2.5" /> Custom
                </span>
                {customFields.map(f => (
                  <button
                    key={f.id}
                    onClick={() => insertToken(`{{${f.key}}}`)}
                    title={`Insert {{${f.key}}}${f.required ? " — required" : ""}`}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 font-medium transition-colors"
                  >
                    {f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── View mode toggle ──────────────────────────────────────────── */}
        <div className="bg-slate-900 border-b border-slate-700 px-3 py-1.5 flex items-center gap-1">
          <span className="text-[11px] text-slate-500 mr-1.5 font-medium">View:</span>
          {(["split", "edit", "preview"] as ViewMode[]).map(m => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`text-[11px] px-2.5 py-1 rounded font-medium transition-colors ${
                viewMode === m
                  ? "bg-slate-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {m === "split" ? "⬜ Split" : m === "edit" ? "✏️ Edit" : "👁 Preview"}
            </button>
          ))}
          <span className="text-[10px] text-slate-600 ml-auto">
            {text.length.toLocaleString()} chars · {paragraphs.length} ¶
          </span>
          {isDirty && (
            <button onClick={() => setText(savedValue)} className="text-[11px] text-slate-500 hover:text-slate-300 underline ml-2">
              Discard
            </button>
          )}
          <button
            onClick={() => setIsFullscreen(f => !f)}
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
            className="ml-2 p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* ── Editor + Preview panes ────────────────────────────────────── */}
        <div className={`flex overflow-hidden ${isFullscreen ? "flex-1" : "min-h-[600px]"}`}>

          {/* EDIT PANE */}
          {viewMode !== "preview" && (
            <div className={`flex flex-col bg-white ${viewMode === "split" ? "w-1/2 border-r border-slate-300" : "w-full"}`}>
              {/* Ruler-style label */}
              <div className="bg-gray-100 border-b border-gray-200 px-4 py-1 flex items-center gap-2">
                <Edit3 className="w-3 h-3 text-gray-400" />
                <span className="text-[11px] text-gray-500 font-medium">Edit Mode — type freely, click a token above to insert at cursor</span>
              </div>
              {/* Page-style textarea */}
              <div className="flex-1 overflow-y-auto" style={{ background: "#f5f5f4" }}>
                <div className="min-h-full px-10 py-8">
                  <div className="bg-white shadow-md border border-gray-200 min-h-[520px] relative">
                    {/* Margin lines (decorative, like paper) */}
                    <div className="absolute left-16 top-0 bottom-0 border-l border-red-100 pointer-events-none" />
                    <textarea
                      ref={textareaRef}
                      value={text}
                      onChange={e => setText(e.target.value)}
                      onClick={trackCursor}
                      onKeyUp={trackCursor}
                      onSelect={trackCursor}
                      onFocus={trackCursor}
                      onDragOver={e => e.preventDefault()}
                      onDrop={handleDrop}
                      spellCheck
                      className="w-full h-full min-h-[520px] resize-none outline-none text-gray-800 bg-transparent px-10 py-8 text-[14px] leading-7 placeholder:text-gray-300"
                      style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                      placeholder="Type your rental agreement here. Use the token buttons above to insert booking fields…"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PREVIEW PANE */}
          {viewMode !== "edit" && (
            <div className={`flex flex-col bg-gray-100 ${viewMode === "split" ? "w-1/2" : "w-full"} overflow-y-auto`}>
              {/* Preview label */}
              <div className="bg-gray-100 border-b border-gray-200 px-4 py-1 flex items-center gap-2 sticky top-0 z-10">
                <Eye className="w-3 h-3 text-gray-400" />
                <span className="text-[11px] text-gray-500 font-medium">Preview — as the renter will see it</span>
                <span className="text-[10px] text-gray-400 ml-2">
                  <span className="bg-emerald-100 text-emerald-700 px-1 rounded border border-emerald-200">green</span> = auto-filled ·{" "}
                  <span className="bg-amber-100 text-amber-700 px-1 rounded border border-amber-200">amber</span> = renter fills in
                </span>
              </div>
              {/* Document page */}
              <div className="flex-1 px-10 py-8">
                <div className="bg-white shadow-md border border-gray-200 px-10 py-8" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                  {/* Document header */}
                  <div className="text-center mb-6 pb-4 border-b border-gray-200">
                    <h1 className="text-lg font-bold text-gray-900 tracking-wide uppercase" style={{ letterSpacing: "0.05em" }}>
                      Rental Agreement
                    </h1>
                  </div>

                  {/* Summary info block */}
                  <div className="mb-6 text-[13px] text-gray-700 space-y-1 bg-gray-50 border border-gray-200 rounded px-4 py-3">
                    <div><span className="font-semibold text-gray-900">Rental Period: </span>
                      <span className="bg-emerald-100 text-emerald-800 rounded px-1 text-xs font-semibold border border-emerald-200">Apr 1, 2026</span>
                      {" — "}
                      <span className="bg-emerald-100 text-emerald-800 rounded px-1 text-xs font-semibold border border-emerald-200">Apr 3, 2026</span>
                      {" (2 days)"}
                    </div>
                    <div><span className="font-semibold text-gray-900">Vehicle: </span>
                      <span className="bg-emerald-100 text-emerald-800 rounded px-1 text-xs font-semibold border border-emerald-200">Yamaha FX Cruiser Jet Ski</span>
                    </div>
                    <div><span className="font-semibold text-gray-900">Renter: </span>
                      <span className="bg-emerald-100 text-emerald-800 rounded px-1 text-xs font-semibold border border-emerald-200">Jane Smith</span>
                      {" · "}
                      <span className="bg-emerald-100 text-emerald-800 rounded px-1 text-xs font-semibold border border-emerald-200">jane@example.com</span>
                    </div>
                  </div>

                  {/* Agreement body */}
                  <div className="text-[13.5px] leading-7 text-gray-700 space-y-4">
                    {paragraphs.length === 0 ? (
                      <p className="text-gray-400 italic">Agreement text will appear here as you type…</p>
                    ) : paragraphs.map((para, i) => (
                      <p key={i}>{renderCustomerPreview(para)}</p>
                    ))}
                  </div>

                  {/* Signature section */}
                  <div className="mt-8 pt-6 border-t border-gray-200 space-y-4">
                    <p className="text-[12px] text-gray-500 italic text-center">
                      By signing below, I confirm I have read, understood, and agree to all terms in this rental agreement.
                    </p>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-5 py-4 space-y-3">
                      <p className="font-semibold text-gray-800 text-sm">Sign the Agreement</p>
                      <div className="h-12 border-2 border-dashed border-gray-300 rounded bg-white flex items-center px-4 text-gray-400 text-sm italic">
                        Signature canvas
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-xs text-gray-600">I have read and agree to all terms in the rental agreement above.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Contract Fields ────────────────────────────────────────────────────────────
export type ContractField = {
  id: string;
  label: string;
  key: string;        // token key e.g. "drivers_license"
  type: "text" | "date" | "number" | "textarea" | "checkbox";
  required: boolean;
  placeholder: string;
  description: string;
};

const FIELD_TYPE_CONFIG: Record<ContractField["type"], { label: string; icon: React.ReactNode }> = {
  text:     { label: "Text",      icon: <FormInput className="w-3.5 h-3.5" /> },
  date:     { label: "Date",      icon: <Calendar  className="w-3.5 h-3.5" /> },
  number:   { label: "Number",    icon: <Hash      className="w-3.5 h-3.5" /> },
  textarea: { label: "Long text", icon: <AlignLeft className="w-3.5 h-3.5" /> },
  checkbox: { label: "Checkbox",  icon: <CheckSquare className="w-3.5 h-3.5" /> },
};

function labelToKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function ContractFieldsManager({
  fields,
  saving,
  onSave,
  onInsertToken,
}: {
  fields: ContractField[];
  saving: boolean;
  onSave: (fields: ContractField[]) => void;
  onInsertToken: (token: string) => void;
}) {
  const [localFields, setLocalFields] = useState<ContractField[]>(fields);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<ContractField>>({ type: "text", required: true, placeholder: "", description: "" });

  useEffect(() => { setLocalFields(fields); }, [fields]);

  const isDirty = JSON.stringify(localFields) !== JSON.stringify(fields);

  function startAdd() {
    setDraft({ label: "", key: "", type: "text", required: true, placeholder: "", description: "" });
    setAdding(true);
    setEditingId(null);
  }

  function startEdit(f: ContractField) {
    setDraft({ ...f });
    setEditingId(f.id);
    setAdding(false);
  }

  function cancelForm() { setAdding(false); setEditingId(null); }

  function commitField() {
    if (!draft.label?.trim()) return;
    const key = draft.key?.trim() || labelToKey(draft.label);
    const field: ContractField = {
      id: editingId ?? crypto.randomUUID(),
      label: draft.label!.trim(),
      key,
      type: draft.type ?? "text",
      required: draft.required ?? true,
      placeholder: draft.placeholder ?? "",
      description: draft.description ?? "",
    };
    if (editingId) {
      setLocalFields(prev => prev.map(f => f.id === editingId ? field : f));
    } else {
      setLocalFields(prev => [...prev, field]);
      onInsertToken(`{{${field.key}}}`);
    }
    cancelForm();
  }

  function deleteField(id: string) {
    setLocalFields(prev => prev.filter(f => f.id !== id));
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <FormInput className="w-4 h-4 text-amber-400" />
          <div>
            <p className="text-sm font-bold text-white">Contract Fields</p>
            <p className="text-xs text-slate-400">Fields the renter must fill in before signing.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
              onClick={() => onSave(localFields)}
              disabled={saving}
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Save Fields"}
            </Button>
          )}
          <Button size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-1.5" onClick={startAdd}>
            <Plus className="w-3.5 h-3.5" /> Add Field
          </Button>
        </div>
      </div>

      {/* Field list */}
      <div className="divide-y divide-slate-800">
        {localFields.length === 0 && !adding && (
          <div className="px-5 py-8 text-center text-slate-500 text-sm">
            <FormInput className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No custom fields yet. Click <strong className="text-slate-400">Add Field</strong> to define fields renters will fill in.
          </div>
        )}

        {localFields.map(f => (
          editingId === f.id ? (
            <FieldForm key={f.id} draft={draft} onChange={setDraft} onCommit={commitField} onCancel={cancelForm} isEdit />
          ) : (
            <div key={f.id} className="flex items-center gap-3 px-5 py-3 group hover:bg-slate-800/40">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${FIELD_TYPE_CONFIG[f.type].icon ? "bg-amber-500/15 text-amber-400" : "bg-slate-800 text-slate-500"}`}>
                {FIELD_TYPE_CONFIG[f.type].icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white">{f.label}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${f.required ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-slate-700 text-slate-400 border border-slate-600"}`}>
                    {f.required ? "Required" : "Optional"}
                  </span>
                  <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded font-mono">{FIELD_TYPE_CONFIG[f.type].label}</span>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{`{{${f.key}}}`}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onInsertToken(`{{${f.key}}}`)}
                  title="Insert token into agreement"
                  className="text-[10px] text-amber-400 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded font-medium transition-colors"
                >
                  Insert ↗
                </button>
                <button onClick={() => startEdit(f)} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteField(f.id)} className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-900/30 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        ))}

        {adding && <FieldForm draft={draft} onChange={setDraft} onCommit={commitField} onCancel={cancelForm} isEdit={false} />}
      </div>
    </div>
  );
}

function FieldForm({
  draft,
  onChange,
  onCommit,
  onCancel,
  isEdit,
}: {
  draft: Partial<ContractField>;
  onChange: (d: Partial<ContractField>) => void;
  onCommit: () => void;
  onCancel: () => void;
  isEdit: boolean;
}) {
  return (
    <div className="px-5 py-4 bg-slate-800/60 space-y-3 border-l-2 border-amber-500">
      <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">{isEdit ? "Edit Field" : "New Field"}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">Field Label <span className="text-red-400">*</span></label>
          <Input
            value={draft.label ?? ""}
            onChange={e => {
              const label = e.target.value;
              onChange({ ...draft, label, key: labelToKey(label) });
            }}
            placeholder="e.g. Driver's License #"
            className="bg-slate-900 border-slate-700 text-white text-sm h-8"
            autoFocus
          />
        </div>
        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">Token key (auto-generated)</label>
          <Input
            value={draft.key ?? ""}
            onChange={e => onChange({ ...draft, key: e.target.value })}
            placeholder="drivers_license"
            className="bg-slate-900 border-slate-700 text-slate-300 text-sm h-8 font-mono"
          />
        </div>
        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">Field Type</label>
          <select
            value={draft.type ?? "text"}
            onChange={e => onChange({ ...draft, type: e.target.value as ContractField["type"] })}
            className="w-full h-8 bg-slate-900 border border-slate-700 rounded-md text-sm text-white px-2 focus:outline-none"
          >
            {(Object.keys(FIELD_TYPE_CONFIG) as ContractField["type"][]).map(t => (
              <option key={t} value={t}>{FIELD_TYPE_CONFIG[t].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">Placeholder hint</label>
          <Input
            value={draft.placeholder ?? ""}
            onChange={e => onChange({ ...draft, placeholder: e.target.value })}
            placeholder="e.g. DL-123456789"
            className="bg-slate-900 border-slate-700 text-white text-sm h-8"
          />
        </div>
      </div>
      <div>
        <label className="text-[11px] text-slate-400 mb-1 block">Help text (shown to renter)</label>
        <Input
          value={draft.description ?? ""}
          onChange={e => onChange({ ...draft, description: e.target.value })}
          placeholder="e.g. Your state-issued driver's license number"
          className="bg-slate-900 border-slate-700 text-white text-sm h-8"
        />
      </div>
      <div className="flex items-center justify-between">
        <button
          onClick={() => onChange({ ...draft, required: !draft.required })}
          className="flex items-center gap-2 text-sm"
        >
          {draft.required
            ? <ToggleRight className="w-6 h-6 text-red-400" />
            : <ToggleLeft  className="w-6 h-6 text-slate-500" />}
          <span className={draft.required ? "text-red-400 font-semibold" : "text-slate-400"}>
            {draft.required ? "Required — renter must fill this in" : "Optional — renter may skip"}
          </span>
        </button>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel} className="text-slate-400 hover:text-white gap-1">
            <X className="w-3.5 h-3.5" /> Cancel
          </Button>
          <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5" onClick={onCommit} disabled={!draft.label?.trim()}>
            <CheckCircle2 className="w-3.5 h-3.5" /> {isEdit ? "Update" : "Add Field"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Category = { slug: string; name: string };
type Override = { categorySlug: string; value: string; updatedAt: string | null };
type ActiveSection = { kind: "global" } | { kind: "category"; slug: string; name: string };

type PlatformAgreement = {
  id: number;
  title: string;
  content: string;
  checkboxLabel: string;
  isRequired: boolean;
  sortOrder: number;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type PlatformAckItem = {
  id: number;
  platformAgreementId: number;
  text: string;
  required: boolean;
  sortOrder: number;
  isActive: boolean;
};

// ── Platform Acknowledgements Manager ─────────────────────────────────────────
function PlatformAckManager({ agreementId }: { agreementId: number }) {
  const { toast } = useToast();
  const [items, setItems] = useState<PlatformAckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftRequired, setDraftRequired] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editRequired, setEditRequired] = useState(true);

  useEffect(() => {
    apiFetch(`superadmin/platform-agreements/${agreementId}/acknowledgements`)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [agreementId]);

  async function addItem() {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      const item = await apiFetch(`superadmin/platform-agreements/${agreementId}/acknowledgements`, {
        method: "POST",
        body: JSON.stringify({ text: draft.trim(), required: draftRequired, sortOrder: items.length * 10 }),
      });
      setItems(prev => [...prev, item]);
      setDraft(""); setDraftRequired(true); setAdding(false);
    } catch (e: any) { toast({ title: "Failed to add", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function updateItem(id: number) {
    setSaving(true);
    try {
      const item = await apiFetch(`superadmin/platform-agreements/acknowledgements/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ text: editText.trim(), required: editRequired }),
      });
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...item } : i));
      setEditingId(null);
    } catch (e: any) { toast({ title: "Failed to update", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function deleteItem(id: number) {
    if (!confirm("Remove this acknowledgement item?")) return;
    try {
      await apiFetch(`superadmin/platform-agreements/acknowledgements/${id}`, { method: "DELETE" });
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e: any) { toast({ title: "Failed to delete", description: e.message, variant: "destructive" }); }
  }

  async function moveItem(id: number, dir: "up" | "down") {
    const idx = items.findIndex(i => i.id === id);
    if (idx < 0) return;
    const newIdx = dir === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= items.length) return;
    const reordered = [...items];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    const updated = reordered.map((it, i) => ({ ...it, sortOrder: i * 10 }));
    setItems(updated);
    for (const it of updated) {
      await apiFetch(`superadmin/platform-agreements/acknowledgements/${it.id}`, {
        method: "PATCH", body: JSON.stringify({ sortOrder: it.sortOrder }),
      }).catch(() => {});
    }
  }

  if (loading) return <div className="flex items-center gap-2 py-4 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Acknowledgement Items</p>
          <p className="text-xs text-slate-500 mt-0.5">Custom checkboxes the renter must confirm within this agreement.</p>
        </div>
        {!adding && (
          <Button size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-1.5 h-8"
            onClick={() => { setAdding(true); setDraft(""); setDraftRequired(true); }}>
            <Plus className="w-3.5 h-3.5" />Add Item
          </Button>
        )}
      </div>
      {items.length === 0 && !adding && (
        <p className="text-slate-500 text-sm py-2">No acknowledgement items yet. Items here appear as extra checkboxes in the renter's signing flow for this agreement.</p>
      )}
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={item.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            {editingId === item.id ? (
              <div className="p-3 space-y-2">
                <textarea value={editText} onChange={e => setEditText(e.target.value)}
                  className="w-full min-h-[60px] text-sm text-slate-200 bg-slate-900 border border-slate-600 rounded-lg p-2 resize-none focus:outline-none focus:border-emerald-500" />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={editRequired} onChange={e => setEditRequired(e.target.checked)} className="w-3.5 h-3.5 accent-emerald-500" />
                    Required
                  </label>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="text-slate-500 h-7 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs gap-1"
                      disabled={saving} onClick={() => updateItem(item.id)}>
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}Save
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 px-3 py-2.5">
                <div className="flex flex-col gap-0.5 shrink-0 mt-0.5">
                  <button onClick={() => moveItem(item.id, "up")} disabled={idx === 0} className="text-slate-600 hover:text-slate-400 disabled:opacity-20 p-0.5"><ChevronUp className="w-3 h-3" /></button>
                  <button onClick={() => moveItem(item.id, "down")} disabled={idx === items.length - 1} className="text-slate-600 hover:text-slate-400 disabled:opacity-20 p-0.5"><ChevronDown className="w-3 h-3" /></button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200">{item.text}</p>
                  {item.required && <span className="text-[10px] text-emerald-400 font-medium mt-0.5 block">Required</span>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-slate-300"
                    onClick={() => { setEditingId(item.id); setEditText(item.text); setEditRequired(item.required); }}>
                    <Edit3 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-300" onClick={() => deleteItem(item.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {adding && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 space-y-2">
          <textarea value={draft} onChange={e => setDraft(e.target.value)} autoFocus
            placeholder="e.g. I confirm I have read and agree to the full terms of this agreement."
            className="w-full min-h-[70px] text-sm text-slate-200 bg-slate-900 border border-slate-600 rounded-lg p-2 resize-none focus:outline-none focus:border-emerald-500" />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={draftRequired} onChange={e => setDraftRequired(e.target.checked)} className="w-3.5 h-3.5 accent-emerald-500" />
              Required
            </label>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="text-slate-500 h-7 text-xs" onClick={() => setAdding(false)}>Cancel</Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs gap-1"
                disabled={saving || !draft.trim()} onClick={addItem}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}Add
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Platform Agreement Full Editor ────────────────────────────────────────────
function PAEditorCard({
  pa, contractFields, onClose, onCreated, onUpdated,
}: {
  pa: PlatformAgreement | null;
  contractFields: ContractField[];
  onClose: () => void;
  onCreated: (pa: PlatformAgreement) => void;
  onUpdated: (pa: PlatformAgreement) => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(pa?.title ?? "");
  const [content, setContent] = useState(pa?.content ?? "");
  const [checkboxLabel, setCheckboxLabel] = useState(pa?.checkboxLabel ?? "I agree to the terms and conditions");
  const [isRequired, setIsRequired] = useState(pa?.isRequired ?? true);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editorTab, setEditorTab] = useState<"document" | "acks">("document");
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorRef = useRef<number>(0);
  const isNew = pa === null;
  const savedContent = pa?.content ?? "";
  const isDirty = content !== savedContent || (pa && (title !== pa.title || checkboxLabel !== pa.checkboxLabel || isRequired !== pa.isRequired));

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  function trackCursor() {
    if (textareaRef.current) cursorRef.current = textareaRef.current.selectionStart ?? content.length;
  }

  function insertToken(token: string) {
    const el = textareaRef.current;
    const pos = cursorRef.current;
    const next = content.slice(0, pos) + token + content.slice(pos);
    setContent(next);
    cursorRef.current = pos + token.length;
    setTimeout(() => { if (el) { el.focus(); el.setSelectionRange(cursorRef.current, cursorRef.current); } }, 0);
    setViewMode(m => m === "preview" ? "split" : m);
  }

  async function handleSave() {
    if (!title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    setIsSaving(true);
    try {
      const body = { title: title.trim(), content, checkboxLabel, isRequired };
      if (isNew) {
        const data = await apiFetch("superadmin/platform-agreements", { method: "POST", body: JSON.stringify(body) });
        onCreated(data);
        toast({ title: "Agreement created" });
      } else {
        const data = await apiFetch(`superadmin/platform-agreements/${pa.id}`, { method: "PATCH", body: JSON.stringify(body) });
        onUpdated(data);
        toast({ title: "Agreement saved" });
      }
    } catch (e: any) { toast({ title: "Save failed", description: e.message, variant: "destructive" }); }
    finally { setIsSaving(false); }
  }

  const paragraphs = content.split(/\n{2,}/).filter(p => p.trim());

  const editorBody = (
    <div className={`flex flex-col ${isFullscreen ? "flex-1 min-h-0" : ""}`}>
      {/* Token toolbar */}
      <div className="flex items-center gap-1.5 flex-wrap px-3 py-2 border-b border-slate-700 bg-slate-800/50">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mr-1">Auto</span>
        {AUTO_TOKENS.map(tok => (
          <button key={tok.key} onClick={() => insertToken(`{{${tok.key}}}`)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/30 transition-colors border border-emerald-500/20">
            <Zap className="w-2.5 h-2.5" />{tok.label}
          </button>
        ))}
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mx-1">Renter</span>
        {RENTER_TOKENS.map(tok => (
          <button key={tok.key} onClick={() => insertToken(`{{${tok.key}}}`)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-300 hover:bg-amber-500/30 transition-colors border border-amber-500/20">
            <UserCheck className="w-2.5 h-2.5" />{tok.label}
          </button>
        ))}
        {contractFields.length > 0 && <>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mx-1">Custom</span>
          {contractFields.map(f => (
            <button key={f.id} onClick={() => insertToken(`{{${f.key}}}`)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-500/15 text-violet-300 hover:bg-violet-500/30 transition-colors border border-violet-500/20">
              {f.label}
            </button>
          ))}
        </>}
        <div className="ml-auto flex items-center gap-1">
          {(["split", "edit", "preview"] as ViewMode[]).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${viewMode === m ? "bg-slate-600 text-white" : "text-slate-400 hover:bg-slate-700"}`}>
              {m === "split" ? "⬜ Split" : m === "edit" ? "✏️ Edit" : "👁 Preview"}
            </button>
          ))}
          <button onClick={() => setIsFullscreen(f => !f)} title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 ml-1">
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      {/* Edit / Preview panes */}
      <div className={`flex overflow-hidden ${isFullscreen ? "flex-1" : "min-h-[280px]"}`}>
        {viewMode !== "preview" && (
          <div className={`flex flex-col bg-white ${viewMode === "split" ? "w-1/2 border-r border-slate-300" : "w-full"}`}>
            <div className="flex-none px-3 py-1.5 bg-gray-50 border-b border-gray-200">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Edit</span>
            </div>
            <textarea ref={textareaRef} value={content} onChange={e => setContent(e.target.value)}
              onSelect={trackCursor} onKeyUp={trackCursor} onMouseUp={trackCursor}
              className="flex-1 p-4 text-sm text-gray-800 font-mono leading-relaxed resize-none focus:outline-none bg-white"
              placeholder={"Enter agreement text here…\n\nUse {{token}} placeholders for booking data."} spellCheck={false} />
          </div>
        )}
        {viewMode !== "edit" && (
          <div className={`flex flex-col bg-gray-100 ${viewMode === "split" ? "w-1/2" : "w-full"} overflow-y-auto`}>
            <div className="flex-none px-4 py-1.5 bg-gray-200 border-b border-gray-300">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Preview</span>
            </div>
            <div className="flex-1 p-6 font-serif">
              {paragraphs.length === 0
                ? <p className="text-gray-400 italic text-sm">Start typing to see the preview…</p>
                : paragraphs.map((para, i) => (
                    <p key={i} className="mb-4 text-sm leading-relaxed text-gray-800">{renderPreviewText(para)}</p>
                  ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={isFullscreen
      ? "fixed inset-0 z-50 bg-slate-950 flex flex-col"
      : "bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden"}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-700 bg-slate-800/60 shrink-0">
        <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-sm font-semibold text-white flex-1 truncate">{isNew ? "New Platform Agreement" : `Editing: ${pa.title}`}</span>
        {isDirty && <span className="text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0">Unsaved</span>}
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 shrink-0"><X className="w-4 h-4" /></button>
      </div>
      {/* Meta fields */}
      {!isFullscreen && (
        <div className="px-5 py-3 border-b border-slate-700 grid grid-cols-2 gap-3 bg-slate-900 shrink-0">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Title</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. OutdoorShare Terms of Service"
              className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Checkbox Label</label>
            <Input value={checkboxLabel} onChange={e => setCheckboxLabel(e.target.value)} placeholder="I agree to the terms…"
              className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
          </div>
          <div className="col-span-2 flex items-center gap-3">
            <button type="button" onClick={() => setIsRequired(r => !r)} className="flex items-center gap-2 text-sm text-slate-300">
              {isRequired ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-slate-500" />}
              <span>Required — renter must check this to proceed</span>
            </button>
          </div>
        </div>
      )}
      {/* Sub-tabs (only for existing agreements) */}
      {!isNew && !isFullscreen && (
        <div className="flex gap-0 border-b border-slate-700 bg-slate-900 shrink-0">
          <button onClick={() => setEditorTab("document")}
            className={`px-4 py-2 text-xs font-semibold transition-colors border-b-2 ${editorTab === "document" ? "border-emerald-500 text-emerald-300 bg-emerald-500/5" : "border-transparent text-slate-400 hover:text-slate-200"}`}>
            <span className="flex items-center gap-1.5"><FileText className="w-3 h-3" />Document</span>
          </button>
          <button onClick={() => setEditorTab("acks")}
            className={`px-4 py-2 text-xs font-semibold transition-colors border-b-2 ${editorTab === "acks" ? "border-emerald-500 text-emerald-300 bg-emerald-500/5" : "border-transparent text-slate-400 hover:text-slate-200"}`}>
            <span className="flex items-center gap-1.5"><CheckSquare className="w-3 h-3" />Acknowledgements</span>
          </button>
        </div>
      )}
      {/* Content area */}
      {(editorTab === "document" || isNew || isFullscreen) && editorBody}
      {editorTab === "acks" && !isNew && pa && (
        <div className="p-5 overflow-y-auto">
          <PlatformAckManager agreementId={pa.id} />
        </div>
      )}
      {/* Footer */}
      {!isFullscreen && (
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-700 bg-slate-900 shrink-0">
          <Button variant="ghost" size="sm" className="text-slate-400" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            disabled={isSaving || (!isNew && !isDirty)} onClick={handleSave}>
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isNew ? "Create Agreement" : "Save Changes"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SuperAdminAgreementPage() {
  const { toast } = useToast();

  const [globalText, setGlobalText] = useState("");
  const [globalSaved, setGlobalSaved] = useState("");
  const [globalUpdatedAt, setGlobalUpdatedAt] = useState<string | null>(null);
  const [globalSaving, setGlobalSaving] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);

  const [active, setActive] = useState<ActiveSection>({ kind: "global" });
  const [catSaving, setCatSaving] = useState<string | null>(null);
  const [catDeleting, setCatDeleting] = useState<string | null>(null);

  // Contract fields
  const [contractFields, setContractFields] = useState<ContractField[]>([]);
  const [fieldsSaving, setFieldsSaving] = useState(false);
  const insertTokenRef = useRef<((token: string) => void) | null>(null);

  // Tab state
  const [tab, setTab] = useState<"templates" | "platform-agreements">("templates");

  // Platform agreements
  const [platformAgreements, setPlatformAgreements] = useState<PlatformAgreement[]>([]);
  const [paLoading, setPaLoading] = useState(false);
  const [paError, setPaError] = useState("");
  const [creatingPA, setCreatingPA] = useState(false);
  const [editingPA, setEditingPA] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch("superadmin/agreement"),
      apiFetch("superadmin/agreement/categories"),
      apiFetch("superadmin/agreement/fields"),
    ])
      .then(([global, catData, fieldsData]) => {
        const val = global.value || DEFAULT_AGREEMENT;
        setGlobalText(val);
        setGlobalSaved(val);
        setGlobalUpdatedAt(global.updatedAt);
        setCategories(catData.categories ?? []);
        setOverrides(catData.overrides ?? []);
        setContractFields(fieldsData.fields ?? []);
      })
      .catch(() => {
        setGlobalText(DEFAULT_AGREEMENT);
        setGlobalSaved(DEFAULT_AGREEMENT);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Platform Agreements CRUD ──────────────────────────────────────────────
  async function fetchPlatformAgreements() {
    setPaLoading(true); setPaError("");
    try {
      const data = await apiFetch("superadmin/platform-agreements");
      setPlatformAgreements(data ?? []);
    } catch (e: any) {
      setPaError(e.message ?? "Failed to load platform agreements");
    } finally {
      setPaLoading(false); }
  }

  useEffect(() => { if (tab === "platform-agreements") fetchPlatformAgreements(); }, [tab]);

  async function deletePlatformAgreement(id: number) {
    if (!confirm("Deactivate this platform agreement? It will no longer appear in the renter's signing flow.")) return;
    try {
      await apiFetch(`superadmin/platform-agreements/${id}`, { method: "DELETE" });
      setPlatformAgreements(prev => prev.filter(p => p.id !== id));
      toast({ title: "Agreement removed" });
    } catch (e: any) {
      toast({ title: "Failed to remove", description: e.message, variant: "destructive" });
    }
  }

  async function movePlatformAgreement(id: number, direction: "up" | "down") {
    const idx = platformAgreements.findIndex(p => p.id === id);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === platformAgreements.length - 1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const reordered = [...platformAgreements];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    const order = reordered.map((p, i) => ({ id: p.id, sortOrder: i * 10 }));
    setPlatformAgreements(reordered.map((p, i) => ({ ...p, sortOrder: i * 10 })));
    try {
      await apiFetch("superadmin/platform-agreements/reorder", { method: "POST", body: JSON.stringify({ order }) });
    } catch { fetchPlatformAgreements(); }
  }

  async function saveContractFields(fields: ContractField[]) {
    setFieldsSaving(true);
    try {
      await apiFetch("superadmin/agreement/fields", { method: "PUT", body: JSON.stringify({ fields }) });
      setContractFields(fields);
      toast({ title: "Contract fields saved", description: `${fields.length} field${fields.length !== 1 ? "s" : ""} will appear in the signing form.` });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setFieldsSaving(false);
    }
  }

  async function saveGlobal(value: string) {
    setGlobalSaving(true);
    try {
      const data = await apiFetch("superadmin/agreement", { method: "PUT", body: JSON.stringify({ value }) });
      setGlobalText(value);
      setGlobalSaved(value);
      setGlobalUpdatedAt(data.updatedAt);
      toast({ title: "Default agreement saved", description: "Applied to all categories without a custom agreement." });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setGlobalSaving(false);
    }
  }

  async function saveCategoryAgreement(slug: string, value: string) {
    setCatSaving(slug);
    try {
      const data = await apiFetch(`superadmin/agreement/category/${slug}`, { method: "PUT", body: JSON.stringify({ value }) });
      setOverrides(prev => {
        const ex = prev.find(o => o.categorySlug === slug);
        if (ex) return prev.map(o => o.categorySlug === slug ? { ...o, value, updatedAt: data.updatedAt } : o);
        return [...prev, { categorySlug: slug, value, updatedAt: data.updatedAt }];
      });
      toast({ title: "Category agreement saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setCatSaving(null);
    }
  }

  async function deleteCategoryAgreement(slug: string) {
    setCatDeleting(slug);
    try {
      await apiFetch(`superadmin/agreement/category/${slug}`, { method: "DELETE" });
      setOverrides(prev => prev.filter(o => o.categorySlug !== slug));
      toast({ title: "Custom agreement removed", description: "This category will now use the default agreement." });
      setActive({ kind: "global" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setCatDeleting(null);
    }
  }

  function addCategoryOverride(cat: Category) {
    setOverrides(prev => {
      if (prev.find(o => o.categorySlug === cat.slug)) return prev;
      return [...prev, { categorySlug: cat.slug, value: globalSaved || DEFAULT_AGREEMENT, updatedAt: null }];
    });
    setActive({ kind: "category", slug: cat.slug, name: cat.name });
  }

  const categoriesWithOverride = categories.filter(c => overrides.find(o => o.categorySlug === c.slug));
  const categoriesWithout = categories.filter(c => !overrides.find(o => o.categorySlug === c.slug));

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-500 text-sm">Loading agreements…</div>;
  }

  const activeOverride = active.kind === "category"
    ? overrides.find(o => o.categorySlug === active.slug)
    : null;

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <FileText className="w-5 h-5 text-emerald-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Rental Agreements</h1>
          <p className="text-sm text-slate-400">Manage platform agreements and category overrides shown to renters at checkout.</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("templates")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "templates" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileText className="w-4 h-4" /> Agreement Templates
        </button>
        <button
          onClick={() => setTab("platform-agreements")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "platform-agreements" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Shield className="w-4 h-4" /> Platform Agreements
        </button>
      </div>

      {/* ── Platform Agreements Tab ── */}
      {tab === "platform-agreements" && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-sm text-slate-300 space-y-1">
              <p className="font-medium text-emerald-300">Platform Agreements</p>
              <p>
                These documents appear as required checkboxes in every renter's signing flow, across all operators.
                Each agreement is included in the combined PDF generated after signing.
                Operators may opt out via their contract settings if they have their own insurance arrangement.
              </p>
            </div>
          </div>

          {paError && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{paError}</p>
            </div>
          )}

          {/* New agreement card */}
          {creatingPA && (
            <PAEditorCard
              pa={null}
              contractFields={contractFields}
              onClose={() => setCreatingPA(false)}
              onCreated={(newPA) => { setPlatformAgreements(prev => [...prev, newPA]); setCreatingPA(false); }}
              onUpdated={() => {}}
            />
          )}

          {/* List */}
          {paLoading ? (
            <div className="flex items-center gap-3 text-slate-400 py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading platform agreements…</span>
            </div>
          ) : platformAgreements.length === 0 && !creatingPA ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto">
                <Layers className="w-7 h-7 text-slate-600" />
              </div>
              <p className="text-slate-400 text-sm">No platform agreements yet. Add your first one below.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {platformAgreements.map((pa, idx) => (
                <div key={pa.id}>
                  {editingPA === pa.id ? (
                    <PAEditorCard
                      pa={pa}
                      contractFields={contractFields}
                      onClose={() => setEditingPA(null)}
                      onCreated={() => {}}
                      onUpdated={(updated) => {
                        setPlatformAgreements(prev => prev.map(p => p.id === updated.id ? updated : p));
                        setEditingPA(null);
                      }}
                    />
                  ) : (
                    /* View row */
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-3 px-5 py-4">
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button onClick={() => movePlatformAgreement(pa.id, "up")} disabled={idx === 0}
                          className="p-0.5 text-slate-600 hover:text-slate-400 disabled:opacity-20">
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => movePlatformAgreement(pa.id, "down")} disabled={idx === platformAgreements.length - 1}
                          className="p-0.5 text-slate-600 hover:text-slate-400 disabled:opacity-20">
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white truncate">{pa.title}</p>
                          {pa.isRequired && (
                            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-medium shrink-0">Required</span>
                          )}
                          <span className="text-xs text-slate-600 shrink-0">v{pa.version}</span>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{pa.checkboxLabel}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="ghost" size="sm"
                          className="text-slate-400 hover:text-white hover:bg-slate-700 h-8 px-3 gap-1.5 text-xs"
                          onClick={() => { setCreatingPA(false); setEditingPA(pa.id); }}>
                          <Edit3 className="w-3.5 h-3.5" />Edit
                        </Button>
                        <Button variant="ghost" size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                          onClick={() => deletePlatformAgreement(pa.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!creatingPA && editingPA === null && (
            <Button
              variant="outline"
              className="border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 gap-2"
              onClick={() => { setEditingPA(null); setCreatingPA(true); }}
            >
              <Plus className="w-4 h-4" /> Add Platform Agreement
            </Button>
          )}
        </div>
      )}

      {/* ── Templates Tab ── */}
      {tab === "templates" && (
      <div className="contents">
      {/* How it works */}
      <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-slate-300 space-y-1">
          <p className="font-medium text-blue-300">Field Tokens</p>
          <p>
            Insert <span className="font-mono text-emerald-300 bg-emerald-500/10 px-1 rounded text-xs">{"{{token}}"}</span> placeholders in your agreement text.{" "}
            <span className="text-emerald-400">Auto-filled tokens</span> (green) are replaced with booking data automatically.{" "}
            <span className="text-amber-400">Renter tokens</span> (amber) and{" "}
            <span className="text-purple-400">custom fields</span> appear as input fields the renter must complete before signing.
          </p>
        </div>
      </div>

      {/* Contract Fields Manager */}
      <ContractFieldsManager
        fields={contractFields}
        saving={fieldsSaving}
        onSave={saveContractFields}
        onInsertToken={(token) => { if (insertTokenRef.current) insertTokenRef.current(token); }}
      />

      <div className="flex gap-5 items-start">
        {/* Sidebar */}
        <div className="w-60 shrink-0 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <button
            onClick={() => setActive({ kind: "global" })}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors border-b border-slate-800 ${
              active.kind === "global" ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="text-left min-w-0">
              <p className="font-semibold">Default Agreement</p>
              <p className="text-xs text-slate-500 font-normal truncate">All categories without override</p>
            </div>
            {active.kind === "global" && <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-500" />}
          </button>

          {categoriesWithOverride.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-900/80">Custom Overrides</div>
              {categoriesWithOverride.map(cat => (
                <button key={cat.slug}
                  onClick={() => setActive({ kind: "category", slug: cat.slug, name: cat.name })}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-b border-slate-800/60 ${
                    active.kind === "category" && active.slug === cat.slug ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  }`}
                >
                  <Tag className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{cat.name}</span>
                  {active.kind === "category" && active.slug === cat.slug && <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-500 shrink-0" />}
                </button>
              ))}
            </>
          )}

          {categoriesWithout.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-900/80">Add Category Override</div>
              {categoriesWithout.map(cat => (
                <button key={cat.slug}
                  onClick={() => addCategoryOverride(cat)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-800/60 hover:text-slate-300 transition-colors border-b border-slate-800/40"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{cat.name}</span>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Editor */}
        {active.kind === "global" ? (
          <AgreementEditor
            label="Default Agreement"
            description="Used for all categories without a custom override. Applies across all companies."
            initialValue={globalText}
            savedValue={globalSaved}
            updatedAt={globalUpdatedAt}
            onSave={saveGlobal}
            saving={globalSaving}
            customFields={contractFields}
            onInsertTokenRef={insertTokenRef}
          />
        ) : activeOverride ? (
          <AgreementEditor
            key={active.slug}
            label={`${(active as any).name} Agreement`}
            description={`Custom agreement for ${(active as any).name} listings. Falls back to default if removed.`}
            initialValue={activeOverride.value}
            savedValue={activeOverride.value}
            updatedAt={activeOverride.updatedAt}
            onSave={(value) => saveCategoryAgreement((active as any).slug, value)}
            onDelete={() => deleteCategoryAgreement((active as any).slug)}
            saving={catSaving === (active as any).slug}
            deleting={catDeleting === (active as any).slug}
            customFields={contractFields}
            onInsertTokenRef={insertTokenRef}
          />
        ) : null}
      </div>
      </div>)}
    </div>
  );
}
