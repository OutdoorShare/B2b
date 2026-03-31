import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Save, Eye, Edit3, RotateCcw, Clock,
  Info, CheckCircle2, Globe, Tag, Plus, Trash2, ChevronRight,
  Zap, UserCheck, GripVertical, FormInput, ToggleLeft, ToggleRight,
  Pencil, X, Hash, Calendar, AlignLeft, CheckSquare,
} from "lucide-react";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getToken() { return localStorage.getItem("superadmin_token") ?? ""; }

async function apiFetch(path: string, opts?: RequestInit) {
  const tok = getToken();
  const res = await fetch(`${BASE}/api/${path}`, {
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

type Tab = "edit" | "preview";

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

// ── Token chip ────────────────────────────────────────────────────────────────
function TokenChip({ tokenKey, label, variant, onInsert }: {
  tokenKey: string;
  label: string;
  variant: "auto" | "renter";
  onInsert: (token: string) => void;
}) {
  const token = `{{${tokenKey}}}`;
  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData("text/plain", token);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => onInsert(token)}
      title={`Click or drag to insert ${token}`}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium cursor-grab active:cursor-grabbing select-none transition-all hover:scale-105 ${
        variant === "auto"
          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
          : "bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
      }`}
    >
      <GripVertical className="w-2.5 h-2.5 opacity-50 shrink-0" />
      <span className="truncate">{`{{${tokenKey}}}`}</span>
    </div>
  );
}

// ── Agreement editor component ────────────────────────────────────────────────
type Tab2 = "edit" | "preview";

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
  const [tab, setTab] = useState<Tab2>("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorRef = useRef<number>(0);

  useEffect(() => { setText(initialValue); }, [initialValue]);

  const isDirty = text !== savedValue;
  const paragraphs = text.split("\n\n").filter(Boolean);

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
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(newPos, newPos);
      }
    });
  }

  // Expose insertToken for the ContractFieldsManager
  useEffect(() => {
    if (onInsertTokenRef) onInsertTokenRef.current = insertToken;
  });


  function handleDrop(e: React.DragEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    const token = e.dataTransfer.getData("text/plain");
    if (!token) return;
    const el = e.currentTarget;
    // Best-effort: insert at current cursor / end
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
    <div className="flex-1 min-w-0 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
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

      {/* Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
        <div className="flex border-b border-slate-800">
          {(["edit", "preview"] as Tab2[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                tab === t ? "text-white border-b-2 border-emerald-400 bg-slate-800/50" : "text-slate-400 hover:text-slate-200"
              }`}>
              {t === "edit" ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {t === "edit" ? "Edit" : "Preview (as customer sees it)"}
            </button>
          ))}
        </div>

        {tab === "edit" ? (
          <div className="flex gap-0 min-h-[540px]">
            {/* Textarea */}
            <div className="flex-1 p-4 min-w-0">
              <p className="text-xs text-slate-500 mb-2">
                Write agreement text, then click or drag a field token from the right panel to insert it at your cursor.
              </p>
              <Textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onClick={trackCursor}
                onKeyUp={trackCursor}
                onSelect={trackCursor}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                rows={24}
                className="font-mono text-sm bg-slate-950 border-slate-700 text-slate-100 resize-y leading-relaxed focus:border-emerald-500 focus:ring-emerald-500/20 w-full"
                placeholder="Type your rental agreement clauses here, then insert field tokens from the panel →"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-slate-500">{text.length} chars · {text.split("\n\n").filter(Boolean).length} clauses</p>
                {isDirty && (
                  <button onClick={() => setText(savedValue)} className="text-xs text-slate-500 hover:text-slate-300 underline">
                    Discard changes
                  </button>
                )}
              </div>
            </div>

            {/* Token picker panel */}
            <div className="w-56 shrink-0 border-l border-slate-800 bg-slate-950 p-3 overflow-y-auto">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Insert Fields</p>

              {/* Auto-filled section */}
              <div className="mb-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap className="w-3 h-3 text-emerald-400" />
                  <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Auto-filled</p>
                </div>
                <p className="text-[10px] text-slate-600 mb-2 leading-snug">Filled automatically from booking data — renter doesn't need to enter these.</p>
                <div className="flex flex-col gap-1.5">
                  {AUTO_TOKENS.map(tok => (
                    <TokenChip key={tok.key} tokenKey={tok.key} label={tok.label} variant="auto" onInsert={insertToken} />
                  ))}
                </div>
              </div>

              <Separator className="bg-slate-800 mb-4" />

              {/* Renter fills in */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <UserCheck className="w-3 h-3 text-amber-400" />
                  <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Renter completes</p>
                </div>
                <p className="text-[10px] text-slate-600 mb-2 leading-snug">Rendered as input fields the renter must fill in before signing.</p>
                <div className="flex flex-col gap-1.5">
                  {RENTER_TOKENS.map(tok => (
                    <TokenChip key={tok.key} tokenKey={tok.key} label={tok.label} variant="renter" onInsert={insertToken} />
                  ))}
                </div>
              </div>

              {customFields && customFields.length > 0 && (
                <>
                  <Separator className="bg-slate-800 mb-4" />
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <FormInput className="w-3 h-3 text-purple-400" />
                      <p className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">Custom Fields</p>
                    </div>
                    <p className="text-[10px] text-slate-600 mb-2 leading-snug">Defined contract fields renters complete before signing.</p>
                    <div className="flex flex-col gap-1.5">
                      {customFields.map(f => (
                        <div
                          key={f.id}
                          draggable
                          onDragStart={e => {
                            e.dataTransfer.setData("text/plain", `{{${f.key}}}`);
                            e.dataTransfer.effectAllowed = "copy";
                          }}
                          onClick={() => insertToken(`{{${f.key}}}`)}
                          title={`Click or drag to insert {{${f.key}}}`}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium cursor-grab active:cursor-grabbing select-none transition-all hover:scale-105 bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25"
                        >
                          <GripVertical className="w-2.5 h-2.5 opacity-50 shrink-0" />
                          <span className="truncate flex-1">{`{{${f.key}}}`}</span>
                          {f.required && <span className="text-[9px] text-red-400 font-bold shrink-0">REQ</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator className="bg-slate-800 my-4" />
              <p className="text-[10px] text-slate-600 leading-snug">
                <strong className="text-slate-500">Tip:</strong> You can also type <span className="font-mono text-slate-400 bg-slate-800 px-0.5 rounded">{"{{any_label}}"}</span> directly — unknown tokens become blank fields the renter fills in.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <p className="text-xs text-slate-500 mb-5 italic">
              This is how the agreement appears to renters. <span className="text-emerald-400">Green</span> = auto-filled · <span className="text-amber-400">Amber</span> = renter fills in.
            </p>
            <div className="bg-white rounded-2xl border p-6 space-y-4 text-sm text-gray-500 leading-relaxed max-h-[480px] overflow-y-auto">
              <h2 className="text-base font-bold text-gray-900">Vehicle Rental Agreement</h2>
              <p>
                <strong className="text-gray-900">Rental Period:</strong>{" "}
                <span className="bg-emerald-100 text-emerald-800 rounded px-1 text-xs font-semibold border border-emerald-200">Apr 1, 2026</span>
                {" — "}
                <span className="bg-emerald-100 text-emerald-800 rounded px-1 text-xs font-semibold border border-emerald-200">Apr 3, 2026</span>
                {" (2 days)"}
              </p>
              <p>
                <strong className="text-gray-900">Vehicle:</strong>{" "}
                <span className="bg-emerald-100 text-emerald-800 rounded px-1 text-xs font-semibold border border-emerald-200">Yamaha FX Cruiser Jet Ski</span>
              </p>
              <p>
                <strong className="text-gray-900">Renter:</strong>{" "}
                <span className="bg-emerald-100 text-emerald-800 rounded px-1 text-xs font-semibold border border-emerald-200">Jane Smith</span>
                {" ("}
                <span className="bg-emerald-100 text-emerald-800 rounded px-1 text-xs font-semibold border border-emerald-200">jane@example.com</span>
                {")"}
              </p>
              <Separator />
              {paragraphs.map((para, i) => (
                <p key={i}>{renderCustomerPreview(para)}</p>
              ))}
              <p className="text-xs italic">By signing below, you confirm you have read, understood, and agree to all terms in this rental agreement.</p>
              <Separator />
              <div className="bg-gray-50 rounded-xl border px-4 py-3 space-y-2">
                <p className="font-semibold text-gray-800 text-sm">Sign the Agreement</p>
                <p className="text-xs text-gray-500">Draw your signature below</p>
                <div className="h-9 border-2 border-dashed rounded-lg bg-white flex items-center px-3 text-gray-400 text-sm italic">Signature canvas</div>
                <div className="flex items-center gap-2 mt-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-gray-600">I have read and agree to all terms in the rental agreement above.</span>
                </div>
              </div>
            </div>
          </div>
        )}
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
          <p className="text-sm text-slate-400">Set a default agreement or override per category. Use field tokens to auto-fill booking data.</p>
        </div>
      </div>

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
    </div>
  );
}
