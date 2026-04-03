import { adminPath } from "@/lib/admin-nav";
import { useState, useEffect, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import {
  useGetListings, useGetBooking,
  getGetListingsQueryKey, getGetBookingQueryKey, getGetBookingsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CalendarDays, User, DollarSign, Package, Info, Hash, ShieldCheck } from "lucide-react";
import { format, addDays, differenceInDays } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const defaultForm = {
  listingId: "",
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  startDate: format(new Date(), "yyyy-MM-dd"),
  endDate: format(addDays(new Date(), 3), "yyyy-MM-dd"),
  quantity: "1",
  status: "confirmed",
  source: "walkin",
  notes: "",
  adminNotes: "",
  depositPaid: "",
};

export default function AdminBookingForm() {
  const params = useParams<{ slug: string; id?: string }>();
  const isEditing = !!params.id;
  const editId = params?.id ? parseInt(params.id) : 0;

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [listingDetails, setListingDetails] = useState<any | null>(null);

  // Protection plan addons for the selected listing
  const [protectionAddons, setProtectionAddons] = useState<Array<{ id: number; name: string; price: string; pricingType: string }>>([]);
  const [selectedProtectionId, setSelectedProtectionId] = useState<number | null>(null);

  // Per-unit assignment (VIN / HIN / serial)
  const [availableUnits, setAvailableUnits] = useState<{ id: number; unitIdentifier: string; identifierType: string; label: string | null; status: string }[]>([]);
  // assignedSlots[i] = unitId string (from dropdown) or free-text identifier
  const [assignedSlots, setAssignedSlots] = useState<string[]>([""]);

  const { data: listings } = useGetListings(
    {},
    { query: { queryKey: getGetListingsQueryKey({}) } }
  );

  const { data: existingBooking } = useGetBooking(editId, {
    query: { enabled: isEditing && !!editId, queryKey: getGetBookingQueryKey(editId) }
  });

  // Prefill on edit
  useEffect(() => {
    if (isEditing && existingBooking) {
      setForm({
        listingId: String(existingBooking.listingId),
        customerName: existingBooking.customerName,
        customerEmail: existingBooking.customerEmail,
        customerPhone: existingBooking.customerPhone ?? "",
        startDate: existingBooking.startDate,
        endDate: existingBooking.endDate,
        quantity: String(existingBooking.quantity),
        status: existingBooking.status,
        source: existingBooking.source ?? "walkin",
        notes: existingBooking.notes ?? "",
        adminNotes: existingBooking.adminNotes ?? "",
        depositPaid: existingBooking.depositPaid != null ? String(existingBooking.depositPaid) : "",
      });
      // Prefill assigned unit slots
      try {
        const raw = (existingBooking as any).assignedUnitIds;
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAssignedSlots(parsed.map(String));
        } else {
          setAssignedSlots(Array(existingBooking.quantity).fill(""));
        }
      } catch {
        setAssignedSlots(Array(existingBooking.quantity).fill(""));
      }
    }
  }, [isEditing, existingBooking]);

  // Fetch listing pricing when listingId changes
  useEffect(() => {
    if (!form.listingId) { setListingDetails(null); return; }
    const listing = listings?.find(l => l.id === Number(form.listingId));
    if (listing) setListingDetails(listing);
  }, [form.listingId, listings]);

  // Fetch available units when listing changes
  useEffect(() => {
    if (!form.listingId) { setAvailableUnits([]); return; }
    fetch(`${BASE}/api/listings/${form.listingId}/units`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAvailableUnits(data); })
      .catch(() => {});
  }, [form.listingId]);

  // Fetch protection plan addons when listing changes
  useEffect(() => {
    if (!form.listingId) { setProtectionAddons([]); setSelectedProtectionId(null); return; }
    fetch(`${BASE}/api/listings/${form.listingId}/addons`)
      .then(r => r.json())
      .then((data: any[]) => {
        const plans = Array.isArray(data)
          ? data.filter(a => a.isActive && a.name?.toLowerCase().includes("protection"))
          : [];
        setProtectionAddons(plans);
        setSelectedProtectionId(null);
      })
      .catch(() => { setProtectionAddons([]); setSelectedProtectionId(null); });
  }, [form.listingId]);

  // Keep assignedSlots array length in sync with quantity
  useEffect(() => {
    const qty = Math.max(1, Number(form.quantity) || 1);
    setAssignedSlots(prev => {
      if (prev.length === qty) return prev;
      if (prev.length < qty) return [...prev, ...Array(qty - prev.length).fill("")];
      return prev.slice(0, qty);
    });
  }, [form.quantity]);

  const days = useMemo(() => {
    try {
      return Math.max(1, differenceInDays(new Date(form.endDate), new Date(form.startDate)));
    } catch { return 1; }
  }, [form.startDate, form.endDate]);

  const basePrice = useMemo(() => {
    if (!listingDetails) return 0;
    return parseFloat(String(listingDetails.pricePerDay)) * days * Number(form.quantity || 1);
  }, [listingDetails, days, form.quantity]);

  const deposit = useMemo(() => {
    if (!listingDetails?.depositAmount) return 0;
    return parseFloat(String(listingDetails.depositAmount));
  }, [listingDetails]);

  const selectedProtection = useMemo(() => protectionAddons.find(a => a.id === selectedProtectionId) ?? null, [protectionAddons, selectedProtectionId]);
  const protectionPrice = useMemo(() => {
    if (!selectedProtection) return 0;
    const ppu = parseFloat(selectedProtection.price);
    if (selectedProtection.priceType === "per_day") return ppu * days * Number(form.quantity || 1);
    return ppu * Number(form.quantity || 1);
  }, [selectedProtection, days, form.quantity]);

  const estimatedTotal = basePrice + deposit + protectionPrice;

  const handleChange = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setError("");
  };

  const handleSubmit = async () => {
    setError("");
    if (!form.listingId) { setError("Please select a listing."); return; }
    if (!form.customerName.trim()) { setError("Customer name is required."); return; }
    if (!form.customerEmail.trim()) { setError("Customer email is required."); return; }
    if (!form.startDate || !form.endDate) { setError("Start and end dates are required."); return; }
    if (form.endDate <= form.startDate) { setError("End date must be after start date."); return; }

    setSaving(true);
    try {
      const filledSlots = assignedSlots.filter(s => s.trim() !== "");
      const addonsPayload = selectedProtection
        ? [{ id: selectedProtection.id, name: selectedProtection.name, price: parseFloat(selectedProtection.price), pricingType: selectedProtection.pricingType, subtotal: protectionPrice }]
        : [];

      const payload: any = {
        listingId: Number(form.listingId),
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim().toLowerCase(),
        customerPhone: form.customerPhone || null,
        startDate: form.startDate,
        endDate: form.endDate,
        quantity: Number(form.quantity),
        status: form.status,
        source: form.source,
        notes: form.notes || null,
        adminNotes: form.adminNotes || null,
        depositPaid: form.depositPaid ? Number(form.depositPaid) : null,
        assignedUnitIds: filledSlots.length > 0 ? filledSlots : [],
        addonsData: JSON.stringify(addonsPayload),
        totalPrice: estimatedTotal,
      };

      const url = isEditing ? `${BASE}/api/bookings/${editId}` : `${BASE}/api/bookings`;
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save booking"); return; }

      queryClient.invalidateQueries({ queryKey: getGetBookingsQueryKey() });
      if (isEditing) queryClient.setQueryData(getGetBookingQueryKey(editId), data);

      toast({ title: isEditing ? "Booking updated" : "Booking created", description: isEditing ? `Booking #${editId} has been updated.` : `Booking #${data.id} created for ${data.customerName}.` });
      setLocation(isEditing ? adminPath(`/bookings/${editId}`) : adminPath(`/bookings/${data.id}`));
    } catch {
      setError("Connection error. Please try again.");
    } finally { setSaving(false); }
  };

  if (isEditing && !existingBooking) {
    return <div className="p-8 text-muted-foreground">Loading booking…</div>;
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {isEditing ? `Edit Booking #${editId}` : "New Booking"}
          </h2>
          <p className="text-muted-foreground mt-1">
            {isEditing ? "Update customer or rental details." : "Create a manual booking for a walk-in or phone order."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">

          {/* Listing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="w-4 h-4 text-primary" /> Rental Item
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Listing <span className="text-destructive">*</span></Label>
                <Select value={form.listingId} onValueChange={v => handleChange("listingId", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a listing…" />
                  </SelectTrigger>
                  <SelectContent>
                    {listings?.filter(l => l.status === "active").map(l => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.title} — ${parseFloat(String(l.pricePerDay)).toFixed(2)}/day
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {listingDetails && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>Stock: <strong>{listingDetails.quantity}</strong> unit{listingDetails.quantity > 1 ? "s" : ""} · ${parseFloat(String(listingDetails.pricePerDay)).toFixed(2)}/day{listingDetails.depositAmount ? ` · $${parseFloat(String(listingDetails.depositAmount)).toFixed(2)} deposit` : ""}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Quantity <span className="text-destructive">*</span></Label>
                  <Input
                    type="number" min="1" max={listingDetails?.quantity ?? 99}
                    value={form.quantity}
                    onChange={e => handleChange("quantity", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Source</Label>
                  <Select value={form.source} onValueChange={v => handleChange("source", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="walkin">Walk-in</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="kiosk">Kiosk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ── Per-unit VIN / HIN / Serial assignment ── */}
              {form.listingId && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm">
                      Unit Assignment
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      — {assignedSlots.length} unit{assignedSlots.length !== 1 ? "s" : ""} required
                    </span>
                  </div>
                  <div className="space-y-2">
                    {assignedSlots.map((val, i) => {
                      const identType = availableUnits[0]?.identifierType ?? "serial";
                      const label = identType === "vin" ? "VIN" : identType === "hin" ? "HIN" : "Serial #";
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">
                            Unit {i + 1}
                          </span>
                          {availableUnits.length > 0 ? (
                            <Select
                              value={val}
                              onValueChange={v => setAssignedSlots(prev => { const n = [...prev]; n[i] = v; return n; })}
                            >
                              <SelectTrigger className={`flex-1 h-9 text-sm ${!val ? "border-destructive/60 bg-destructive/5" : ""}`}>
                                <SelectValue placeholder={`Select ${label}…`} />
                              </SelectTrigger>
                              <SelectContent>
                                {availableUnits.map(u => (
                                  <SelectItem
                                    key={u.id}
                                    value={String(u.id)}
                                    disabled={u.status !== "available" && assignedSlots[i] !== String(u.id)}
                                  >
                                    <span className="font-mono">{u.unitIdentifier}</span>
                                    {u.label && <span className="text-muted-foreground ml-1.5">— {u.label}</span>}
                                    {u.status !== "available" && (
                                      <span className="ml-1.5 text-xs text-amber-600">({u.status})</span>
                                    )}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              className={`flex-1 h-9 text-sm font-mono ${!val.trim() ? "border-destructive/60 bg-destructive/5" : ""}`}
                              placeholder={`Enter ${label} for unit ${i + 1}`}
                              value={val}
                              onChange={e => setAssignedSlots(prev => { const n = [...prev]; n[i] = e.target.value; return n; })}
                            />
                          )}
                          {!val && (
                            <span className="text-[10px] text-destructive font-semibold shrink-0">Required</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {availableUnits.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No units registered for this listing. Enter identifiers manually, or add units in the listing detail.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="w-4 h-4 text-primary" /> Rental Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Pickup Date <span className="text-destructive">*</span></Label>
                  <Input type="date" value={form.startDate} onChange={e => handleChange("startDate", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Return Date <span className="text-destructive">*</span></Label>
                  <Input type="date" value={form.endDate} onChange={e => handleChange("endDate", e.target.value)} />
                </div>
              </div>
              {days > 0 && (
                <p className="text-sm text-muted-foreground">
                  Duration: <strong>{days} day{days > 1 ? "s" : ""}</strong>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Customer */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="w-4 h-4 text-primary" /> Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Email — most important: drives all automated notifications */}
              <div className="space-y-1.5">
                <Label htmlFor="customerEmail" className="flex items-center gap-1.5 text-sm font-semibold">
                  Email Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={form.customerEmail}
                  onChange={e => handleChange("customerEmail", e.target.value)}
                  placeholder="jane@example.com"
                  className="h-10"
                  autoFocus={!isEditing}
                />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Used for booking confirmation, pickup &amp; return photo links, and all automated notifications.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Full Name <span className="text-destructive">*</span></Label>
                  <Input value={form.customerName} onChange={e => handleChange("customerName", e.target.value)} placeholder="Jane Smith" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input type="tel" value={form.customerPhone} onChange={e => handleChange("customerPhone", e.target.value)} placeholder="+1 (555) 000-0000" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Customer Notes</Label>
                <Textarea value={form.notes} onChange={e => handleChange("notes", e.target.value)} placeholder="Any requests or notes from the customer…" rows={3} />
              </div>
            </CardContent>
          </Card>

          {/* Internal */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Internal Notes</CardTitle>
              <CardDescription>Only visible to staff.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea value={form.adminNotes} onChange={e => handleChange("adminNotes", e.target.value)} placeholder="Condition notes, deposit tracking, special handling…" rows={3} />
            </CardContent>
          </Card>
        </div>

        {/* Right: Summary & Status */}
        <div className="space-y-6">
          {/* Pricing summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="w-4 h-4 text-primary" /> Price Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {listingDetails ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Base rate</span>
                    <span>${parseFloat(String(listingDetails.pricePerDay)).toFixed(2)}/day</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Days × Qty</span>
                    <span>{days}d × {form.quantity || 1}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Rental fee</span>
                    <span>${basePrice.toFixed(2)}</span>
                  </div>
                  {deposit > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Deposit</span>
                      <span>${deposit.toFixed(2)}</span>
                    </div>
                  )}
                  {protectionAddons.length > 0 && (
                    <div className="pt-1 pb-1 space-y-2">
                      <Label className="text-xs flex items-center gap-1.5 text-muted-foreground font-medium">
                        <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="h-3.5 object-contain opacity-75" /> Protection Plan
                      </Label>
                      {protectionAddons.map(addon => {
                        const ppu = parseFloat(addon.price);
                        const label = addon.priceType === "per_day"
                          ? `$${ppu.toFixed(2)}/day × ${days} days = $${(ppu * days * Number(form.quantity || 1)).toFixed(2)}`
                          : `$${ppu.toFixed(2)}/rental`;
                        const isSelected = selectedProtectionId === addon.id;
                        return (
                          <button
                            key={addon.id}
                            type="button"
                            onClick={() => setSelectedProtectionId(isSelected ? null : addon.id)}
                            className={`w-full text-left flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors ${isSelected ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700" : "border-border hover:border-muted-foreground"}`}
                          >
                            <span className="flex items-center gap-1.5">
                              <ShieldCheck className={`w-3.5 h-3.5 ${isSelected ? "text-emerald-600" : "text-muted-foreground"}`} />
                              {addon.name}
                            </span>
                            <span className="font-medium">{label}</span>
                          </button>
                        );
                      })}
                      {selectedProtection && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Protection subtotal</span>
                          <span className="text-emerald-700 font-medium">+${protectionPrice.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Estimated Total</span>
                    <span className="text-lg">${estimatedTotal.toFixed(2)}</span>
                  </div>
                  <div className="space-y-1.5 pt-2">
                    <Label className="text-xs">Deposit Paid ($)</Label>
                    <Input
                      type="number" min="0" step="0.01"
                      value={form.depositPaid}
                      onChange={e => handleChange("depositPaid", e.target.value)}
                      placeholder="0.00"
                      className="h-8 text-sm"
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Select a listing to see pricing.</p>
              )}
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Booking Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={form.status} onValueChange={v => handleChange("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="active">Active (Picked Up)</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-3">
            {error && <p className="text-sm text-destructive font-medium">{error}</p>}
            <Button className="w-full" onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving…" : (isEditing ? "Save Changes" : "Create Booking")}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => window.history.back()}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
