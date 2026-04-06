import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/context/auth";
import { HostLayout } from "./layout";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Upload, X, Loader2, Plus, Trash2,
  ChevronDown, ChevronUp, Clock, Tag, Info,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const CONDITIONS = [
  { value: "excellent", label: "Excellent" },
  { value: "good",      label: "Good" },
  { value: "fair",      label: "Fair" },
];

const STATUSES = [
  { value: "active",   label: "Active — visible on marketplace" },
  { value: "draft",    label: "Draft — hidden from marketplace" },
  { value: "inactive", label: "Inactive" },
];

const SLOT_TIMES = [
  "6:00 AM", "6:30 AM", "7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM",
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM",
  "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM",
];

// ─── Form state type ──────────────────────────────────────────────────────────

type HourlySlot  = { label: string; hours: number; price: number };
type TimeSlotDef = { label: string; startTime: string; endTime: string; rate: "full_day" | "half_day" };

interface FormState {
  title: string;
  description: string;
  categoryId: string;
  status: string;
  // Pricing
  pricePerDay: string;
  weekendPrice: string;
  holidayPrice: string;
  pricePerWeek: string;
  depositAmount: string;
  // Half day
  halfDayEnabled: boolean;
  halfDayDurationHours: string;
  halfDayRate: string;
  // Hourly
  hourlyEnabled: boolean;
  hourlySlots: HourlySlot[];
  hourlyPerHourEnabled: boolean;
  pricePerHour: string;
  hourlyMinimumHours: string;
  // Time slots
  timeSlots: TimeSlotDef[];
  // Details
  quantity: string;
  imageUrls: string[];
  location: string;
  condition: string;
  brand: string;
  model: string;
  weight: string;
  dimensions: string;
  includedItems: string[];
  requirements: string;
  ageRestriction: string;
}

// ─── Small helper components ──────────────────────────────────────────────────

function DollarInput({
  value, onChange, placeholder, id,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; id?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">$</span>
      <Input
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="pl-7"
        placeholder={placeholder}
        type="number"
        min="0"
        step="0.01"
      />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="font-semibold text-gray-900 mb-4">{children}</h2>;
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function HostListingFormPage() {
  const { id }  = useParams<{ id?: string }>();
  const isEdit  = !!id;
  const { customer } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [uploading, setUploading] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [timeSlotsOpen, setTimeSlotsOpen] = useState(false);

  // Slot draft for hourly packages
  const [slotDraft, setSlotDraft] = useState({ label: "", hours: "", price: "" });
  // Time slot draft
  const [tsD, setTsD] = useState<{ label: string; startTime: string; endTime: string; rate: "full_day" | "half_day" }>({
    label: "", startTime: "8:00 AM", endTime: "5:00 PM", rate: "full_day",
  });
  // Included item input
  const [itemInput, setItemInput] = useState("");

  const [form, setForm] = useState<FormState>({
    title: "", description: "", categoryId: "", status: "active",
    pricePerDay: "", weekendPrice: "", holidayPrice: "", pricePerWeek: "", depositAmount: "",
    halfDayEnabled: false, halfDayDurationHours: "4", halfDayRate: "",
    hourlyEnabled: false, hourlySlots: [], hourlyPerHourEnabled: false,
    pricePerHour: "", hourlyMinimumHours: "1",
    timeSlots: [],
    quantity: "1", imageUrls: [], location: "", condition: "good",
    brand: "", model: "", weight: "", dimensions: "",
    includedItems: [], requirements: "", ageRestriction: "",
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: categories = [] } = useQuery({
    queryKey: ["host-categories"],
    queryFn: () => api.host.categories(),
  });

  const { data: existingListings = [] } = useQuery({
    queryKey: ["host-listings", customer?.id],
    queryFn: () => api.host.listings(customer!.id),
    enabled: !!customer && isEdit,
  });

  // Populate form when editing
  useEffect(() => {
    if (!isEdit || !existingListings.length) return;
    const listing = existingListings.find(l => String(l.id) === id);
    if (!listing) return;
    setForm({
      title:       listing.title,
      description: listing.description,
      categoryId:  listing.categoryId ? String(listing.categoryId) : "",
      status:      listing.status,
      pricePerDay:   String(listing.pricePerDay ?? ""),
      weekendPrice:  listing.weekendPrice  ? String(listing.weekendPrice)  : "",
      holidayPrice:  listing.holidayPrice  ? String(listing.holidayPrice)  : "",
      pricePerWeek:  listing.pricePerWeek  ? String(listing.pricePerWeek)  : "",
      depositAmount: listing.depositAmount ? String(listing.depositAmount) : "",
      halfDayEnabled:      listing.halfDayEnabled ?? false,
      halfDayDurationHours: listing.halfDayDurationHours ? String(listing.halfDayDurationHours) : "4",
      halfDayRate:         listing.halfDayRate ? String(listing.halfDayRate) : "",
      hourlyEnabled:       listing.hourlyEnabled ?? false,
      hourlySlots:         listing.hourlySlots  ?? [],
      hourlyPerHourEnabled: listing.hourlyPerHourEnabled ?? false,
      pricePerHour:        listing.pricePerHour ? String(listing.pricePerHour) : "",
      hourlyMinimumHours:  listing.hourlyMinimumHours ? String(listing.hourlyMinimumHours) : "1",
      timeSlots:           (listing.timeSlots ?? []) as TimeSlotDef[],
      quantity:   String(listing.quantity ?? 1),
      imageUrls:  listing.imageUrls ?? [],
      location:   listing.location  ?? "",
      condition:  listing.condition ?? "good",
      brand:      listing.brand     ?? "",
      model:      listing.model     ?? "",
      weight:     listing.weight    ?? "",
      dimensions: listing.dimensions ?? "",
      includedItems: listing.includedItems ?? [],
      requirements:  listing.requirements  ?? "",
      ageRestriction: listing.ageRestriction ? String(listing.ageRestriction) : "",
    });
    if (listing.halfDayEnabled || listing.hourlyEnabled) setAdvancedOpen(true);
    if ((listing.timeSlots ?? []).length > 0) setTimeSlotsOpen(true);
  }, [isEdit, id, existingListings]);

  // ── Image upload ───────────────────────────────────────────────────────────

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of files.slice(0, 5)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload/image", { method: "POST", body: fd });
        if (res.ok) {
          const data = await res.json();
          uploaded.push(data.url);
        }
      }
      setForm(f => ({ ...f, imageUrls: [...f.imageUrls, ...uploaded].slice(0, 5) }));
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // ── Hourly slot helpers ───────────────────────────────────────────────────

  const addHourlySlot = () => {
    const hours = parseFloat(slotDraft.hours);
    const price = parseFloat(slotDraft.price);
    if (!slotDraft.label.trim() || isNaN(hours) || hours <= 0 || isNaN(price) || price < 0) return;
    set("hourlySlots", [...form.hourlySlots, { label: slotDraft.label.trim(), hours, price }]);
    setSlotDraft({ label: "", hours: "", price: "" });
  };

  const removeHourlySlot = (idx: number) =>
    set("hourlySlots", form.hourlySlots.filter((_, i) => i !== idx));

  // ── Time slot helpers ─────────────────────────────────────────────────────

  const addTimeSlot = () => {
    if (!tsD.startTime || !tsD.endTime) return;
    const label = tsD.label.trim() || `${tsD.startTime} – ${tsD.endTime}`;
    set("timeSlots", [...form.timeSlots, { label, startTime: tsD.startTime, endTime: tsD.endTime, rate: tsD.rate }]);
    setTsD(prev => ({ ...prev, label: "" }));
  };
  const removeTimeSlot = (idx: number) =>
    set("timeSlots", form.timeSlots.filter((_, i) => i !== idx));

  // ── Included items ────────────────────────────────────────────────────────

  const addItem = () => {
    const v = itemInput.trim();
    if (!v || form.includedItems.includes(v)) return;
    set("includedItems", [...form.includedItems, v]);
    setItemInput("");
  };

  // ── Save mutation ─────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        title:       form.title,
        description: form.description,
        categoryId:  form.categoryId ? Number(form.categoryId) : null,
        status:      form.status,
        pricePerDay:   parseFloat(form.pricePerDay) || 0,
        weekendPrice:  form.weekendPrice  ? parseFloat(form.weekendPrice)  : null,
        holidayPrice:  form.holidayPrice  ? parseFloat(form.holidayPrice)  : null,
        pricePerWeek:  form.pricePerWeek  ? parseFloat(form.pricePerWeek)  : null,
        pricePerHour:  form.pricePerHour  ? parseFloat(form.pricePerHour)  : null,
        depositAmount: form.depositAmount ? parseFloat(form.depositAmount) : null,
        halfDayEnabled:      form.halfDayEnabled,
        halfDayDurationHours: form.halfDayDurationHours ? parseInt(form.halfDayDurationHours) : null,
        halfDayRate:         form.halfDayRate ? parseFloat(form.halfDayRate) : null,
        hourlyEnabled:       form.hourlyEnabled,
        hourlySlots:         form.hourlySlots,
        hourlyPerHourEnabled: form.hourlyPerHourEnabled,
        hourlyMinimumHours:  form.hourlyMinimumHours ? parseInt(form.hourlyMinimumHours) : null,
        timeSlots:   form.timeSlots,
        quantity:    parseInt(form.quantity) || 1,
        imageUrls:   form.imageUrls,
        location:    form.location || null,
        condition:   form.condition || null,
        brand:       form.brand       || null,
        model:       form.model       || null,
        weight:      form.weight      || null,
        dimensions:  form.dimensions  || null,
        includedItems: form.includedItems,
        requirements:  form.requirements || null,
        ageRestriction: form.ageRestriction ? parseInt(form.ageRestriction) : null,
      };
      return isEdit
        ? api.host.updateListing(customer!.id, parseInt(id!), body)
        : api.host.createListing(customer!.id, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["host-listings"] });
      qc.invalidateQueries({ queryKey: ["host-stats"] });
      toast({ title: isEdit ? "Listing updated!" : "Listing created!" });
      setLocation("/host/listings");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.description || !form.pricePerDay) {
      toast({ title: "Please fill in the required fields", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  // ── Shared select class ───────────────────────────────────────────────────

  const selectCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <HostLayout>
      <div className="max-w-2xl mx-auto pb-12">
        <button
          onClick={() => setLocation("/host/listings")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Listings
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {isEdit ? "Edit Listing" : "New Listing"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Basic Info ── */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <SectionLabel>Basic Info</SectionLabel>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <Input
                  value={form.title}
                  onChange={e => set("title", e.target.value)}
                  placeholder="e.g. 2023 Yamaha Jet Ski"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={e => set("description", e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Describe your adventure — condition, features, what's included..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={form.categoryId} onChange={e => set("categoryId", e.target.value)} className={selectCls}>
                    <option value="">Select category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                  <select value={form.condition} onChange={e => set("condition", e.target.value)} className={selectCls}>
                    <option value="">Select condition</option>
                    {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                  <Input value={form.brand} onChange={e => set("brand", e.target.value)} placeholder="e.g. Yamaha" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <Input value={form.model} onChange={e => set("model", e.target.value)} placeholder="e.g. WaveRunner FX" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Location</label>
                <Input value={form.location} onChange={e => set("location", e.target.value)} placeholder="e.g. Boulder, CO" />
              </div>
            </div>
          </section>

          {/* ── Pricing ── */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <SectionLabel>Pricing</SectionLabel>
            <div className="space-y-4">

              {/* Base rates */}
              <div className="rounded-lg border p-3 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Daily Rates</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Weekday <span className="text-red-500">*</span></label>
                    <DollarInput value={form.pricePerDay} onChange={v => set("pricePerDay", v)} placeholder="150" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Weekend</label>
                    <DollarInput value={form.weekendPrice} onChange={v => set("weekendPrice", v)} placeholder="Same" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Holiday</label>
                    <DollarInput value={form.holidayPrice} onChange={v => set("holidayPrice", v)} placeholder="Same" />
                  </div>
                </div>
              </div>

              {/* Weekly & deposit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weekly Rate</label>
                  <DollarInput value={form.pricePerWeek} onChange={v => set("pricePerWeek", v)} placeholder="900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Security Deposit</label>
                  <DollarInput value={form.depositAmount} onChange={v => set("depositAmount", v)} placeholder="500" />
                </div>
              </div>

              {/* Sub-day & Hourly (collapsible) */}
              <div className="border rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen(o => !o)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Sub-Day &amp; Hourly Pricing</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {form.halfDayEnabled || form.hourlyEnabled
                        ? `Enabled: ${[form.halfDayEnabled && "Half Day", form.hourlyEnabled && "Hourly"].filter(Boolean).join(", ")}`
                        : "Full Day only (default)"}
                    </p>
                  </div>
                  {advancedOpen
                    ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                </button>

                {advancedOpen && (
                  <div className="px-4 pb-5 pt-2 border-t space-y-4">
                    {/* Toggle checkboxes */}
                    <div className="flex flex-wrap gap-5 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-400">
                        <input type="checkbox" checked disabled className="h-4 w-4 rounded accent-primary opacity-50" />
                        Full Day (always on)
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={form.halfDayEnabled}
                          onChange={e => set("halfDayEnabled", e.target.checked)}
                          className="h-4 w-4 rounded accent-primary"
                        />
                        <span className="text-sm font-medium text-gray-800">Half Day</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={form.hourlyEnabled}
                          onChange={e => set("hourlyEnabled", e.target.checked)}
                          className="h-4 w-4 rounded accent-primary"
                        />
                        <span className="text-sm font-medium text-gray-800">Hourly</span>
                      </label>
                    </div>

                    {/* Half Day details */}
                    {form.halfDayEnabled && (
                      <div className="rounded-lg border p-3 space-y-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Half Day Options</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Duration (hours)</label>
                            <Input
                              type="number" min="1" step="1" placeholder="4"
                              value={form.halfDayDurationHours}
                              onChange={e => set("halfDayDurationHours", e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Flat Rate ($)</label>
                            <DollarInput value={form.halfDayRate} onChange={v => set("halfDayRate", v)} placeholder="0.00" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Hourly details */}
                    {form.hourlyEnabled && (
                      <div className="rounded-lg border p-3 space-y-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hourly Packages</p>
                        {form.hourlySlots.length > 0 && (
                          <div className="space-y-1.5">
                            {form.hourlySlots.map((slot, idx) => (
                              <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                                <span className="flex-1 text-sm font-medium">{slot.label}</span>
                                <span className="text-xs text-gray-400">{slot.hours}hr{slot.hours !== 1 ? "s" : ""}</span>
                                <span className="text-xs font-semibold">${slot.price.toFixed(2)}</span>
                                <button type="button" onClick={() => removeHourlySlot(idx)} className="text-gray-300 hover:text-red-500 transition-colors ml-1">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Input
                            className="flex-1 h-8 text-xs"
                            placeholder='Label (e.g. "Morning 4hrs")'
                            value={slotDraft.label}
                            onChange={e => setSlotDraft(p => ({ ...p, label: e.target.value }))}
                          />
                          <Input
                            className="w-20 h-8 text-xs"
                            placeholder="Hrs"
                            type="number" min="0.5" step="0.5"
                            value={slotDraft.hours}
                            onChange={e => setSlotDraft(p => ({ ...p, hours: e.target.value }))}
                          />
                          <Input
                            className="w-20 h-8 text-xs"
                            placeholder="$"
                            type="number" min="0" step="0.01"
                            value={slotDraft.price}
                            onChange={e => setSlotDraft(p => ({ ...p, price: e.target.value }))}
                          />
                          <Button type="button" variant="secondary" size="sm" className="h-8 px-2 shrink-0" onClick={addHourlySlot}>
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={form.hourlyPerHourEnabled}
                            onChange={e => set("hourlyPerHourEnabled", e.target.checked)}
                            className="h-4 w-4 rounded accent-primary"
                          />
                          <span className="text-sm font-medium text-gray-800">Also offer per-hour pricing</span>
                        </label>

                        {form.hourlyPerHourEnabled && (
                          <div className="grid grid-cols-2 gap-3 pt-1">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Price per Hour ($)</label>
                              <DollarInput value={form.pricePerHour} onChange={v => set("pricePerHour", v)} placeholder="0.00" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Minimum Hours</label>
                              <Input
                                type="number" min="1" step="1" placeholder="1"
                                value={form.hourlyMinimumHours}
                                onChange={e => set("hourlyMinimumHours", e.target.value)}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Available Time Slots (collapsible) */}
              <div className="border rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTimeSlotsOpen(o => !o)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-gray-400" /> Available Time Slots
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {form.timeSlots.length > 0
                        ? `${form.timeSlots.length} slot${form.timeSlots.length !== 1 ? "s" : ""} configured`
                        : "Not configured — renters use the standard time picker"}
                    </p>
                  </div>
                  {timeSlotsOpen
                    ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                </button>

                {timeSlotsOpen && (
                  <div className="px-4 pb-4 pt-2 border-t space-y-3">
                    <p className="text-xs text-gray-400">Define specific pickup/return windows. When slots are added, renters must select one when booking.</p>

                    {form.timeSlots.length > 0 && (
                      <div className="space-y-2">
                        {form.timeSlots.map((slot, idx) => (
                          <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                            <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{slot.label}</p>
                              <p className="text-xs text-gray-400">{slot.startTime} – {slot.endTime}</p>
                            </div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${slot.rate === "half_day" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                              {slot.rate === "half_day" ? "Half Day Rate" : "Full Day Rate"}
                            </span>
                            <button type="button" onClick={() => removeTimeSlot(idx)} className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="rounded-lg border border-dashed p-3 space-y-3 bg-gray-50/50">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add a Slot</p>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Label <span className="text-gray-400 font-normal">(optional)</span></label>
                        <Input className="h-8 text-sm" placeholder='"Morning Slot"' value={tsD.label} onChange={e => setTsD(p => ({ ...p, label: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
                          <select value={tsD.startTime} onChange={e => setTsD(p => ({ ...p, startTime: e.target.value }))} className={`${selectCls} h-8 text-sm py-1`}>
                            {SLOT_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">End / Return</label>
                          <select value={tsD.endTime} onChange={e => setTsD(p => ({ ...p, endTime: e.target.value }))} className={`${selectCls} h-8 text-sm py-1`}>
                            {SLOT_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        {(["full_day", "half_day"] as const).map(rate => (
                          <label
                            key={rate}
                            className={`flex items-center gap-2 cursor-pointer border rounded-lg px-3 py-2 text-sm transition-colors ${tsD.rate === rate ? "border-primary bg-primary/5 font-medium" : "hover:bg-gray-100 border-gray-200"}`}
                          >
                            <input type="radio" name="tsRate" value={rate} checked={tsD.rate === rate} onChange={() => setTsD(p => ({ ...p, rate }))} className="accent-primary" />
                            {rate === "full_day" ? "Full Day Rate" : "Half Day Rate"}
                          </label>
                        ))}
                      </div>
                      {tsD.rate === "half_day" && !form.halfDayEnabled && (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <Info className="w-3 h-3" /> Enable Half Day Pricing above to set a half-day rate.
                        </p>
                      )}
                      <Button type="button" size="sm" variant="outline" onClick={addTimeSlot} className="w-full gap-1.5">
                        <Plus className="w-3.5 h-3.5" /> Add Time Slot
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Photos ── */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <SectionLabel>Photos</SectionLabel>
            <div className="space-y-3">
              {form.imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {form.imageUrls.map((url, i) => (
                    <div key={i} className="relative group">
                      <img src={url} alt="" className="w-20 h-20 rounded-lg object-cover border border-gray-200" />
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, imageUrls: f.imageUrls.filter((_, j) => j !== i) }))}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {form.imageUrls.length < 5 && (
                <label className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-200 rounded-lg p-6 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                  {uploading
                    ? <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    : <Upload className="h-6 w-6 text-gray-400" />}
                  <span className="text-sm text-gray-500">
                    {uploading ? "Uploading..." : `Click to upload photos (${form.imageUrls.length}/5)`}
                  </span>
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={handleImageUpload} disabled={uploading} />
                </label>
              )}
            </div>
          </section>

          {/* ── Included Items ── */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <SectionLabel>
              <span className="flex items-center gap-2"><Tag className="h-4 w-4 text-gray-400" />What's Included</span>
            </SectionLabel>
            <p className="text-sm text-gray-500 mb-3">List all accessories, gear, or extras that come with this rental.</p>
            {form.includedItems.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {form.includedItems.map((item, i) => (
                  <span key={i} className="flex items-center gap-1.5 bg-green-50 text-green-800 border border-green-200 rounded-full px-3 py-1 text-sm font-medium">
                    {item}
                    <button type="button" onClick={() => set("includedItems", form.includedItems.filter((_, j) => j !== i))} className="text-green-400 hover:text-green-800">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={itemInput}
                onChange={e => setItemInput(e.target.value)}
                placeholder='e.g. "Life jackets", "Paddle"'
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
              />
              <Button type="button" variant="outline" onClick={addItem} className="shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Press Enter or click + to add each item.</p>
          </section>

          {/* ── Details ── */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <SectionLabel>Details &amp; Requirements</SectionLabel>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Available</label>
                  <Input value={form.quantity} onChange={e => set("quantity", e.target.value)} type="number" min="1" placeholder="1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Age</label>
                  <Input value={form.ageRestriction} onChange={e => set("ageRestriction", e.target.value)} type="number" min="1" max="99" placeholder="e.g. 18" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
                  <Input value={form.weight} onChange={e => set("weight", e.target.value)} placeholder="e.g. 5 lbs" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dimensions</label>
                  <Input value={form.dimensions} onChange={e => set("dimensions", e.target.value)} placeholder="L × W × H" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Special Requirements</label>
                <p className="text-xs text-gray-400 mb-1.5">Shown to renters on your listing page (e.g. license type, tow vehicle specs).</p>
                <textarea
                  value={form.requirements}
                  onChange={e => set("requirements", e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="e.g. Valid driver's license required, minimum age 21..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={e => set("status", e.target.value)} className={selectCls}>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </section>

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setLocation("/host/listings")}>
              Cancel
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-white" disabled={saveMutation.isPending}>
              {saveMutation.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{isEdit ? "Saving..." : "Creating..."}</>
                : isEdit ? "Save Changes" : "Create Listing"}
            </Button>
          </div>

        </form>
      </div>
    </HostLayout>
  );
}
