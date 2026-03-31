import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Save, Eye, Edit3, RotateCcw, Clock,
  Info, CheckCircle2, Globe, Tag, Plus, Trash2, ChevronRight,
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

type Category = { slug: string; name: string };
type Override = { categorySlug: string; value: string; updatedAt: string | null };

type ActiveSection = { kind: "global" } | { kind: "category"; slug: string; name: string };

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
}) {
  const [text, setText] = useState(initialValue);
  const [tab, setTab] = useState<Tab>("edit");

  useEffect(() => { setText(initialValue); }, [initialValue]);

  const isDirty = text !== savedValue;
  const paragraphs = text.split("\n\n").filter(Boolean);

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
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              disabled={deleting}
              className="border-red-700/50 text-red-400 hover:bg-red-900/30 hover:text-red-300 hover:border-red-600"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {deleting ? "Removing…" : "Remove Override"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setText(DEFAULT_AGREEMENT)}
            className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset to Default
          </Button>
          <Button
            size="sm"
            onClick={() => onSave(text)}
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

      {/* Edit / Preview tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex-1">
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

        {tab === "edit" ? (
          <div className="p-4">
            <p className="text-xs text-slate-500 mb-2">
              Write each clause on its own paragraph (separated by a blank line). Plain text only — no markdown or HTML.
            </p>
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={22}
              className="font-mono text-sm bg-slate-950 border-slate-700 text-slate-100 resize-y leading-relaxed focus:border-emerald-500 focus:ring-emerald-500/20"
              placeholder="Type your rental agreement clauses here…"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-slate-500">{text.length} characters · {text.split("\n\n").filter(Boolean).length} clauses</p>
              {isDirty && (
                <button onClick={() => setText(savedValue)} className="text-xs text-slate-500 hover:text-slate-300 underline">
                  Discard changes
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6">
            <p className="text-xs text-slate-500 mb-5 italic">
              This is how the agreement appears to renters during checkout.
            </p>
            <div className="bg-white rounded-2xl border p-6 space-y-4 text-sm text-gray-500 leading-relaxed max-h-[480px] overflow-y-auto">
              <h2 className="text-base font-bold text-gray-900">Vehicle Rental Agreement</h2>
              <p><strong className="text-gray-900">Rental Period:</strong> Apr 1, 2026 — Apr 3, 2026 (2 days)</p>
              <p><strong className="text-gray-900">Vehicle:</strong> Yamaha FX Cruiser Jet Ski</p>
              <p><strong className="text-gray-900">Renter:</strong> Jane Smith (jane@example.com)</p>
              <Separator />
              {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
              <p className="text-xs italic">By signing below, you confirm you have read, understood, and agree to all terms in this rental agreement.</p>
              <Separator />
              <div className="bg-gray-50 rounded-xl border px-4 py-3 space-y-2">
                <p className="font-semibold text-gray-800 text-sm">Sign the Agreement</p>
                <p className="text-xs text-gray-500">Type your full legal name below to sign</p>
                <div className="h-9 border rounded-lg bg-white flex items-center px-3 text-gray-400 text-sm italic">Jane Smith</div>
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

export default function SuperAdminAgreementPage() {
  const { toast } = useToast();

  // Global agreement
  const [globalText, setGlobalText] = useState("");
  const [globalSaved, setGlobalSaved] = useState("");
  const [globalUpdatedAt, setGlobalUpdatedAt] = useState<string | null>(null);
  const [globalSaving, setGlobalSaving] = useState(false);

  // Category data
  const [categories, setCategories] = useState<Category[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);

  // Active section
  const [active, setActive] = useState<ActiveSection>({ kind: "global" });

  // Per-category editor state (saving/deleting)
  const [catSaving, setCatSaving] = useState<string | null>(null);
  const [catDeleting, setCatDeleting] = useState<string | null>(null);

  // Load all data
  useEffect(() => {
    Promise.all([
      apiFetch("superadmin/agreement"),
      apiFetch("superadmin/agreement/categories"),
    ])
      .then(([global, catData]) => {
        const val = global.value || DEFAULT_AGREEMENT;
        setGlobalText(val);
        setGlobalSaved(val);
        setGlobalUpdatedAt(global.updatedAt);
        setCategories(catData.categories ?? []);
        setOverrides(catData.overrides ?? []);
      })
      .catch(() => {
        setGlobalText(DEFAULT_AGREEMENT);
        setGlobalSaved(DEFAULT_AGREEMENT);
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveGlobal(value: string) {
    setGlobalSaving(true);
    try {
      const data = await apiFetch("superadmin/agreement", {
        method: "PUT",
        body: JSON.stringify({ value }),
      });
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
      const data = await apiFetch(`superadmin/agreement/category/${slug}`, {
        method: "PUT",
        body: JSON.stringify({ value }),
      });
      setOverrides(prev => {
        const existing = prev.find(o => o.categorySlug === slug);
        if (existing) return prev.map(o => o.categorySlug === slug ? { ...o, value, updatedAt: data.updatedAt } : o);
        return [...prev, { categorySlug: slug, value, updatedAt: data.updatedAt }];
      });
      toast({ title: "Category agreement saved", description: "This category now uses its own custom agreement." });
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
    // Create an override initialized to the current global text
    setOverrides(prev => {
      if (prev.find(o => o.categorySlug === cat.slug)) return prev;
      return [...prev, { categorySlug: cat.slug, value: globalSaved || DEFAULT_AGREEMENT, updatedAt: null }];
    });
    setActive({ kind: "category", slug: cat.slug, name: cat.name });
  }

  // Separate categories into those with overrides and those without
  const categoriesWithOverride = categories.filter(c => overrides.find(o => o.categorySlug === c.slug));
  const categoriesWithout = categories.filter(c => !overrides.find(o => o.categorySlug === c.slug));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">Loading agreements…</div>
    );
  }

  // Get current override for active category
  const activeOverride = active.kind === "category"
    ? overrides.find(o => o.categorySlug === active.slug)
    : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Page header */}
      <div className="flex items-center gap-2.5">
        <FileText className="w-5 h-5 text-emerald-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Rental Agreements</h1>
          <p className="text-sm text-slate-400">Set a default agreement for all categories, or override it per category.</p>
        </div>
      </div>

      {/* How it works banner */}
      <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-slate-300 space-y-1">
          <p className="font-medium text-blue-300">How it works</p>
          <p>When a renter books a listing, they see the agreement for that listing's category. If no custom agreement exists for the category, the default is shown. Each booking auto-prepends rental details and appends the digital signature section.</p>
        </div>
      </div>

      <div className="flex gap-5 items-start">
        {/* Sidebar */}
        <div className="w-64 shrink-0 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {/* Default section */}
          <button
            onClick={() => setActive({ kind: "global" })}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors border-b border-slate-800 ${
              active.kind === "global"
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="text-left min-w-0">
              <p className="font-semibold">Default Agreement</p>
              <p className="text-xs text-slate-500 font-normal truncate">All categories without override</p>
            </div>
            {active.kind === "global" && <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-500" />}
          </button>

          {/* Categories with overrides */}
          {categoriesWithOverride.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-900/80">
                Custom Overrides
              </div>
              {categoriesWithOverride.map(cat => (
                <button
                  key={cat.slug}
                  onClick={() => setActive({ kind: "category", slug: cat.slug, name: cat.name })}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-b border-slate-800/60 ${
                    active.kind === "category" && active.slug === cat.slug
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  }`}
                >
                  <Tag className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{cat.name}</span>
                  {active.kind === "category" && active.slug === cat.slug && (
                    <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-500 shrink-0" />
                  )}
                </button>
              ))}
            </>
          )}

          {/* Add override for categories */}
          {categoriesWithout.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-900/80">
                Add Category Override
              </div>
              {categoriesWithout.map(cat => (
                <button
                  key={cat.slug}
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

        {/* Main editor */}
        {active.kind === "global" ? (
          <AgreementEditor
            label="Default Agreement"
            description="Used for all categories that don't have a custom override. Applies across all companies on the platform."
            initialValue={globalText}
            savedValue={globalSaved}
            updatedAt={globalUpdatedAt}
            onSave={saveGlobal}
            saving={globalSaving}
          />
        ) : activeOverride ? (
          <AgreementEditor
            key={active.slug}
            label={`${active.name} Agreement`}
            description={`Custom agreement shown only when a renter books a ${active.name} listing. Falls back to the default if removed.`}
            initialValue={activeOverride.value}
            savedValue={activeOverride.value}
            updatedAt={activeOverride.updatedAt}
            onSave={(value) => saveCategoryAgreement(active.slug, value)}
            onDelete={() => deleteCategoryAgreement(active.slug)}
            saving={catSaving === active.slug}
            deleting={catDeleting === active.slug}
          />
        ) : null}
      </div>
    </div>
  );
}
