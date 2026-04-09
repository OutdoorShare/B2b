import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { adminPath, getAdminSession } from "@/lib/admin-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, X, Upload, Loader2, Package, Search, CheckCircle2,
  Calendar, RefreshCw, Clock, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Link } from "wouter";
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, parseISO, isBefore, startOfDay,
} from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

function adminFetch(path: string, opts?: RequestInit) {
  const session = getAdminSession();
  return fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
}

const CATEGORIES = [
  { value: "adventure", label: "Adventure" },
  { value: "water-sport", label: "Water Sport" },
  { value: "guided-tour", label: "Guided Tour" },
  { value: "lesson", label: "Lesson" },
  { value: "wildlife-tour", label: "Wildlife Tour" },
  { value: "off-road", label: "Off-Road" },
  { value: "camping", label: "Camping" },
  { value: "climbing", label: "Climbing" },
  { value: "snow-sport", label: "Snow Sport" },
  { value: "fishing", label: "Fishing" },
  { value: "other", label: "Other" },
];

const WEEKDAYS = [
  { label: "Sun", short: "S", value: 0 },
  { label: "Mon", short: "M", value: 1 },
  { label: "Tue", short: "T", value: 2 },
  { label: "Wed", short: "W", value: 3 },
  { label: "Thu", short: "T", value: 4 },
  { label: "Fri", short: "F", value: 5 },
  { label: "Sat", short: "S", value: 6 },
];

type RecurringSlot = { dayOfWeek: number; times: string[] };
type SpecificSlot = { date: string; times: string[] };

type FormState = {
  title: string;
  description: string;
  category: string;
  pricePerPerson: string;
  durationMinutes: string;
  maxCapacity: string;
  location: string;
  imageUrls: string[];
  highlights: string[];
  whatToBring: string;
  minAge: string;
  isActive: boolean;
  listingId: number | null;
  requiresRental: boolean;
  scheduleMode: "open" | "recurring" | "specific";
  recurringSlots: RecurringSlot[];
  specificSlots: SpecificSlot[];
};

type ListingOption = {
  id: number;
  title: string;
  pricePerDay: number;
  imageUrls: string[];
  description: string;
};

const DEFAULTS: FormState = {
  title: "",
  description: "",
  category: "adventure",
  pricePerPerson: "",
  durationMinutes: "60",
  maxCapacity: "10",
  location: "",
  imageUrls: [],
  highlights: [],
  whatToBring: "",
  minAge: "",
  isActive: true,
  listingId: null,
  requiresRental: false,
  scheduleMode: "open",
  recurringSlots: [],
  specificSlots: [],
};

function SpecificDatePicker({
  slots,
  onChange,
}: {
  slots: SpecificSlot[];
  onChange: (v: SpecificSlot[]) => void;
}) {
  const today = startOfDay(new Date());
  const [month, setMonth] = useState(startOfMonth(today));
  const [newTime, setNewTime] = useState<Record<string, string>>({});

  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const dateStrings = new Set(slots.map(s => s.date));

  function toggleDate(day: Date) {
    if (isBefore(day, today)) return;
    const ds = format(day, "yyyy-MM-dd");
    if (dateStrings.has(ds)) {
      onChange(slots.filter(s => s.date !== ds));
    } else {
      onChange([...slots, { date: ds, times: [] }].sort((a, b) => a.date.localeCompare(b.date)));
    }
  }

  function addTime(dateStr: string) {
    const t = (newTime[dateStr] ?? "").trim();
    if (!t) return;
    onChange(slots.map(s => s.date === dateStr && !s.times.includes(t)
      ? { ...s, times: [...s.times, t].sort() }
      : s
    ));
    setNewTime(p => ({ ...p, [dateStr]: "" }));
  }

  function removeTime(dateStr: string, time: string) {
    onChange(slots.map(s => s.date === dateStr ? { ...s, times: s.times.filter(t => t !== time) } : s));
  }

  function removeDate(dateStr: string) {
    onChange(slots.filter(s => s.date !== dateStr));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-gray-50 p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setMonth(subMonths(month, 1))} className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-sm">{format(month, "MMMM yyyy")}</span>
          <button onClick={() => setMonth(addMonths(month, 1))} className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
            <div key={d} className="text-center text-xs text-muted-foreground py-1 font-medium">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {days.map(day => {
            const ds = format(day, "yyyy-MM-dd");
            const inMonth = isSameMonth(day, month);
            const isPast = isBefore(day, today);
            const selected = dateStrings.has(ds);
            return (
              <button
                key={ds}
                onClick={() => toggleDate(day)}
                disabled={!inMonth || isPast}
                className={[
                  "rounded-lg text-sm py-1.5 font-medium transition-all",
                  !inMonth || isPast ? "text-gray-300 cursor-default" : "cursor-pointer",
                  selected ? "bg-green-600 text-white shadow-sm" : inMonth && !isPast ? "hover:bg-green-50 text-gray-700" : "",
                ].join(" ")}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
      </div>

      {slots.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">Click dates above to add them to your schedule.</p>
      ) : (
        <div className="space-y-3">
          {slots.map(slot => (
            <div key={slot.date} className="rounded-xl border bg-white p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm">{format(parseISO(slot.date), "EEE, MMM d, yyyy")}</span>
                <button onClick={() => removeDate(slot.date)} className="text-muted-foreground hover:text-red-500 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {slot.times.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 bg-green-50 text-green-800 border border-green-200 rounded-full px-2.5 py-0.5 text-xs font-medium">
                    {t}
                    <button onClick={() => removeTime(slot.date, t)} className="hover:text-red-600 transition-colors ml-0.5">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                {slot.times.length === 0 && <span className="text-xs text-muted-foreground">No times added — add at least one</span>}
              </div>
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={newTime[slot.date] ?? ""}
                  onChange={e => setNewTime(p => ({ ...p, [slot.date]: e.target.value }))}
                  className="h-7 text-xs w-32"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTime(slot.date); } }}
                />
                <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => addTime(slot.date)}>
                  <Plus className="w-3 h-3 mr-1" /> Add time
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecurringScheduler({
  slots,
  onChange,
}: {
  slots: RecurringSlot[];
  onChange: (v: RecurringSlot[]) => void;
}) {
  const [newTime, setNewTime] = useState<Record<number, string>>({});

  const activeDays = new Set(slots.map(s => s.dayOfWeek));

  function toggleDay(day: number) {
    if (activeDays.has(day)) {
      onChange(slots.filter(s => s.dayOfWeek !== day));
    } else {
      onChange([...slots, { dayOfWeek: day, times: [] }].sort((a, b) => a.dayOfWeek - b.dayOfWeek));
    }
  }

  function addTime(day: number) {
    const t = (newTime[day] ?? "").trim();
    if (!t) return;
    onChange(slots.map(s => s.dayOfWeek === day && !s.times.includes(t)
      ? { ...s, times: [...s.times, t].sort() }
      : s
    ));
    setNewTime(p => ({ ...p, [day]: "" }));
  }

  function removeTime(day: number, time: string) {
    onChange(slots.map(s => s.dayOfWeek === day ? { ...s, times: s.times.filter(t => t !== time) } : s));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Select which days this experience runs</Label>
        <div className="flex gap-2 flex-wrap">
          {WEEKDAYS.map(wd => {
            const active = activeDays.has(wd.value);
            return (
              <button
                key={wd.value}
                type="button"
                onClick={() => toggleDay(wd.value)}
                className={[
                  "w-12 h-12 rounded-xl text-sm font-semibold border-2 transition-all",
                  active
                    ? "bg-green-600 border-green-600 text-white shadow-sm"
                    : "bg-white border-gray-200 text-gray-600 hover:border-green-300 hover:text-green-700",
                ].join(" ")}
              >
                {wd.label}
              </button>
            );
          })}
        </div>
      </div>

      {slots.length === 0 ? (
        <p className="text-sm text-muted-foreground">Select at least one day, then add time slots below.</p>
      ) : (
        <div className="space-y-3">
          {slots.map(slot => {
            const wd = WEEKDAYS.find(w => w.value === slot.dayOfWeek)!;
            return (
              <div key={slot.dayOfWeek} className="rounded-xl border bg-white p-3">
                <p className="font-semibold text-sm mb-2 text-green-700">{wd.label}</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {slot.times.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 bg-green-50 text-green-800 border border-green-200 rounded-full px-2.5 py-0.5 text-xs font-medium">
                      <Clock className="w-2.5 h-2.5" />
                      {t}
                      <button onClick={() => removeTime(slot.dayOfWeek, t)} className="hover:text-red-600 transition-colors ml-0.5">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                  {slot.times.length === 0 && <span className="text-xs text-muted-foreground">No times yet</span>}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="time"
                    value={newTime[slot.dayOfWeek] ?? ""}
                    onChange={e => setNewTime(p => ({ ...p, [slot.dayOfWeek]: e.target.value }))}
                    className="h-7 text-xs w-32"
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTime(slot.dayOfWeek); } }}
                  />
                  <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => addTime(slot.dayOfWeek)}>
                    <Plus className="w-3 h-3 mr-1" /> Add time
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ActivityForm() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newHighlight, setNewHighlight] = useState("");
  const [listings, setListings] = useState<ListingOption[]>([]);
  const [listingSearch, setListingSearch] = useState("");
  const [showListingPicker, setShowListingPicker] = useState(false);

  const set = (k: keyof FormState, v: any) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    adminFetch("/listings?limit=200")
      .then(r => r.ok ? r.json() : [])
      .then(d => setListings(Array.isArray(d) ? d.filter((l: any) => l.status === "active") : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    adminFetch(`/activities/${id}`)
      .then(r => r.json())
      .then(d => {
        setForm({
          title: d.title ?? "",
          description: d.description ?? "",
          category: d.category ?? "adventure",
          pricePerPerson: d.pricePerPerson?.toString() ?? "",
          durationMinutes: d.durationMinutes?.toString() ?? "60",
          maxCapacity: d.maxCapacity?.toString() ?? "10",
          location: d.location ?? "",
          imageUrls: d.imageUrls ?? [],
          highlights: d.highlights ?? [],
          whatToBring: d.whatToBring ?? "",
          minAge: d.minAge?.toString() ?? "",
          isActive: d.isActive ?? true,
          listingId: d.listingId ?? null,
          requiresRental: d.requiresRental ?? false,
          scheduleMode: d.scheduleMode ?? "open",
          recurringSlots: d.recurringSlots ?? [],
          specificSlots: d.specificSlots ?? [],
        });
      })
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const session = getAdminSession();
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`${BASE}/api/upload/image`, {
        method: "POST",
        headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      set("imageUrls", [...form.imageUrls, url]);
    } catch {
      toast({ title: "Image upload failed", variant: "destructive" });
    } finally { setUploading(false); e.target.value = ""; }
  }

  function addHighlight() {
    const h = newHighlight.trim();
    if (!h) return;
    set("highlights", [...form.highlights, h]);
    setNewHighlight("");
  }

  async function save() {
    if (!form.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const body = {
        ...form,
        pricePerPerson: parseFloat(form.pricePerPerson) || 0,
        durationMinutes: parseInt(form.durationMinutes) || 60,
        maxCapacity: parseInt(form.maxCapacity) || 10,
        minAge: form.minAge ? parseInt(form.minAge) : null,
      };
      const res = await adminFetch(isEdit ? `/activities/${id}` : "/activities", {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        toast({ title: d.error ?? "Save failed", variant: "destructive" });
        return;
      }
      toast({ title: isEdit ? "Activity updated" : "Activity created" });
      navigate(adminPath("/activities"));
    } finally { setSaving(false); }
  }

  if (loading) {
    return <div className="py-16 text-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href={adminPath("/activities")}>
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold">{isEdit ? "Edit Activity" : "New Activity"}</h2>
          <p className="text-sm text-muted-foreground">
            {isEdit ? "Update this experience listing" : "Create a guided experience or tour for customers"}
          </p>
        </div>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Basic Info</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Activity Title <span className="text-red-500">*</span></Label>
            <Input
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="e.g. Sunset Kayak Tour"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <div className="flex items-center gap-3 h-10">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={v => set("isActive", v)}
                  className="data-[state=checked]:bg-green-600"
                />
                <span className="text-sm text-muted-foreground">
                  {form.isActive ? "Active — visible on marketplace" : "Hidden from marketplace"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="Describe what customers will experience…"
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input
              value={form.location}
              onChange={e => set("location", e.target.value)}
              placeholder="e.g. Lake Tahoe, CA or Meeting point address"
            />
          </div>
        </CardContent>
      </Card>

      {/* Pricing & Logistics */}
      <Card>
        <CardHeader><CardTitle className="text-base">Pricing & Logistics</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Price per Person ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.pricePerPerson}
                onChange={e => set("pricePerPerson", e.target.value)}
                placeholder="75.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (minutes)</Label>
              <Input
                type="number"
                min="15"
                step="15"
                value={form.durationMinutes}
                onChange={e => set("durationMinutes", e.target.value)}
                placeholder="60"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max Capacity</Label>
              <Input
                type="number"
                min="1"
                value={form.maxCapacity}
                onChange={e => set("maxCapacity", e.target.value)}
                placeholder="10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Minimum Age <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              type="number"
              min="1"
              value={form.minAge}
              onChange={e => set("minAge", e.target.value)}
              placeholder="No minimum"
              className="w-32"
            />
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Availability Schedule</CardTitle>
          <p className="text-sm text-muted-foreground">How do customers pick their date and time?</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {([
              {
                key: "open",
                icon: <Calendar className="w-5 h-5" />,
                title: "Open Request",
                desc: "Customers request any date, you confirm",
              },
              {
                key: "recurring",
                icon: <RefreshCw className="w-5 h-5" />,
                title: "Recurring Schedule",
                desc: "Set weekly days & times that repeat",
              },
              {
                key: "specific",
                icon: <Clock className="w-5 h-5" />,
                title: "Specific Dates",
                desc: "Pick exact dates & time slots",
              },
            ] as const).map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => set("scheduleMode", opt.key)}
                className={[
                  "flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-all",
                  form.scheduleMode === opt.key
                    ? "border-green-600 bg-green-50"
                    : "border-gray-200 hover:border-green-300 bg-white",
                ].join(" ")}
              >
                <div className={form.scheduleMode === opt.key ? "text-green-600" : "text-gray-400"}>
                  {opt.icon}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${form.scheduleMode === opt.key ? "text-green-800" : "text-gray-700"}`}>
                    {opt.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {form.scheduleMode === "recurring" && (
            <div className="pt-2">
              <RecurringScheduler
                slots={form.recurringSlots}
                onChange={v => set("recurringSlots", v)}
              />
            </div>
          )}

          {form.scheduleMode === "specific" && (
            <div className="pt-2">
              <SpecificDatePicker
                slots={form.specificSlots}
                onChange={v => set("specificSlots", v)}
              />
            </div>
          )}

          {form.scheduleMode === "open" && (
            <div className="rounded-xl bg-gray-50 border p-4 text-sm text-muted-foreground flex items-start gap-3">
              <Calendar className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />
              <p>Customers submit a date request. You'll receive their preferred date/time in the inquiry and can confirm or suggest alternatives.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Highlights */}
      <Card>
        <CardHeader><CardTitle className="text-base">Highlights</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Bullet points shown on the marketplace — what makes this experience special?</p>
          <div className="space-y-2">
            {form.highlights.map((h, i) => (
              <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <span className="text-sm flex-1">{h}</span>
                <button onClick={() => set("highlights", form.highlights.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-500 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newHighlight}
              onChange={e => setNewHighlight(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addHighlight(); } }}
              placeholder="e.g. Professional certified guides"
            />
            <Button type="button" variant="outline" onClick={addHighlight}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* What to Bring */}
      <Card>
        <CardHeader><CardTitle className="text-base">What to Bring</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            value={form.whatToBring}
            onChange={e => set("whatToBring", e.target.value)}
            placeholder="e.g. Sunscreen, water bottle, comfortable shoes…"
            rows={2}
            className="resize-none"
          />
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardHeader><CardTitle className="text-base">Photos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {form.imageUrls.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {form.imageUrls.map((url, i) => (
                <div key={i} className="relative group aspect-video rounded-lg overflow-hidden">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => set("imageUrls", form.imageUrls.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer w-fit">
            <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
              <span>
                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {uploading ? "Uploading…" : "Upload Photo"}
              </span>
            </Button>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
        </CardContent>
      </Card>

      {/* Linked Rental */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Linked Rental</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Attach a rental listing so customers book equipment and the activity together.
              </p>
            </div>
            <Switch
              checked={!!form.listingId || showListingPicker}
              onCheckedChange={v => {
                if (!v) { set("listingId", null); set("requiresRental", false); setShowListingPicker(false); setListingSearch(""); }
                else setShowListingPicker(true);
              }}
              className="data-[state=checked]:bg-green-600"
            />
          </div>
        </CardHeader>

        {(form.listingId || showListingPicker) && (
          <CardContent className="space-y-4">
            {form.listingId && (() => {
              const sel = listings.find(l => l.id === form.listingId);
              if (!sel) return null;
              return (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-green-50/50 border-green-100">
                  {sel.imageUrls?.[0] ? (
                    <img src={sel.imageUrls[0]} alt={sel.title} className="w-14 h-14 rounded-md object-cover shrink-0 border" />
                  ) : (
                    <div className="w-14 h-14 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                      <Package className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{sel.title}</p>
                    <p className="text-xs text-muted-foreground">${sel.pricePerDay}/day rental</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <button
                      type="button"
                      onClick={() => { set("listingId", null); setListingSearch(""); }}
                      className="text-muted-foreground hover:text-red-500 transition-colors ml-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })()}

            {!form.listingId && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search your listings…"
                    value={listingSearch}
                    onChange={e => setListingSearch(e.target.value)}
                  />
                </div>
                <div className="rounded-lg border divide-y max-h-52 overflow-y-auto">
                  {listings
                    .filter(l => l.title.toLowerCase().includes(listingSearch.toLowerCase()))
                    .slice(0, 20)
                    .map(l => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => { set("listingId", l.id); setShowListingPicker(false); }}
                        className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
                      >
                        {l.imageUrls?.[0] ? (
                          <img src={l.imageUrls[0]} alt={l.title} className="w-10 h-10 rounded object-cover shrink-0 border" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{l.title}</p>
                          <p className="text-xs text-muted-foreground">${l.pricePerDay}/day</p>
                        </div>
                      </button>
                    ))}
                  {listings.filter(l => l.title.toLowerCase().includes(listingSearch.toLowerCase())).length === 0 && (
                    <p className="text-sm text-muted-foreground p-4 text-center">No active listings found</p>
                  )}
                </div>
              </div>
            )}

            {form.listingId && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border">
                <div>
                  <p className="text-sm font-medium">Rental is required</p>
                  <p className="text-xs text-muted-foreground">If off, customers can book the activity without renting this equipment.</p>
                </div>
                <Switch
                  checked={form.requiresRental}
                  onCheckedChange={v => set("requiresRental", v)}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            )}

            {form.listingId && (() => {
              const sel = listings.find(l => l.id === form.listingId);
              const actPrice = parseFloat(form.pricePerPerson) || 0;
              const rentalPrice = sel?.pricePerDay || 0;
              if (!sel) return null;
              return (
                <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                  <p className="text-xs font-semibold text-blue-800 mb-1.5">Combined pricing</p>
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <span>${actPrice.toFixed(2)} activity fee</span>
                    <span className="text-blue-400">+</span>
                    <span>${rentalPrice.toFixed(2)}/day rental</span>
                    <span className="text-blue-400">=</span>
                    <span className="font-bold">${(actPrice + rentalPrice).toFixed(2)} total</span>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        )}
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={save} disabled={saving} style={{ backgroundColor: "#3ab549" }} className="text-white">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Activity"}
        </Button>
        <Link href={adminPath("/activities")}>
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>
    </div>
  );
}
