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
import { ArrowLeft, CalendarDays, User, DollarSign, Package, Info, Hash, ShieldCheck, ShoppingBag, Tag, Plus, X, CreditCard, Send, Link as LinkIcon, CheckCircle, Ticket, Loader2 } from "lucide-react";
import BundlePickerModal, { type BundleItem } from "@/components/bundle-picker-modal";
import { CustomerAutocomplete } from "@/components/customer-autocomplete";
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

  // Pre-fill customer details from query params (e.g. coming from Contacts page)
  const initialForm = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return {
      ...defaultForm,
      customerName: qs.get("name") ?? defaultForm.customerName,
      customerEmail: qs.get("email") ?? defaultForm.customerEmail,
      customerPhone: qs.get("phone") ?? defaultForm.customerPhone,
    };
  }, []);

  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [listingDetails, setListingDetails] = useState<any | null>(null);

  // Platform-level protection plan (auto-applied when active for listing's category)
  const [platformProtectionPlan, setPlatformProtectionPlan] = useState<{ enabled: boolean; feeAmount: string } | null>(null);

  // Listing-level protection plan addons (suppressed when platform plan is active)
  const [protectionAddons, setProtectionAddons] = useState<Array<{ id: number; name: string; price: string; pricingType: string; priceType?: string }>>([]);
  const [selectedProtectionId, setSelectedProtectionId] = useState<number | null>(null);

  // Bundle items
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([]);
  const [bundlePickerOpen, setBundlePickerOpen] = useState(false);
  const [allListings, setAllListings] = useState<any[]>([]);
  const [bundleDiscountPercent, setBundleDiscountPercent] = useState(0);

  // Per-unit assignment (VIN / HIN / serial)
  const [availableUnits, setAvailableUnits] = useState<{ id: number; unitIdentifier: string; identifierType: string; label: string | null; status: string }[]>([]);
  // assignedSlots[i] = unitId string (from dropdown) or free-text identifier
  const [assignedSlots, setAssignedSlots] = useState<string[]>([""]);

  // Payment options (new bookings only)
  type PaymentMode = "none" | "send_link" | "charge_saved";
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("none");
  const [savedCard, setSavedCard] = useState<{ brand: string; last4: string } | null>(null);
  const [savedCardLoading, setSavedCardLoading] = useState(false);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
  const [paymentLinkCopied, setPaymentLinkCopied] = useState(false);

  // Promo code
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discountAmount: number; message: string } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

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

  // Fetch platform protection plan when listing's category changes
  useEffect(() => {
    const catSlug = listingDetails?.categorySlug;
    if (!catSlug) { setPlatformProtectionPlan(null); return; }
    fetch(`${BASE}/api/protection-plan/${encodeURIComponent(catSlug)}`)
      .then(r => r.json())
      .then(d => setPlatformProtectionPlan(d))
      .catch(() => setPlatformProtectionPlan(null));
  }, [listingDetails?.categorySlug]);

  // Fetch listing-level protection addons when listing changes
  // (suppressed in UI when a platform plan is active)
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

  // Look up saved card when customer email changes (new bookings only)
  useEffect(() => {
    if (isEditing) return;
    const email = form.customerEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) { setSavedCard(null); return; }
    const tid = setTimeout(() => {
      setSavedCardLoading(true);
      const slug = params.slug ?? "";
      fetch(`${BASE}/api/admin/customer-saved-card?email=${encodeURIComponent(email)}`, {
        headers: slug ? { "x-tenant-slug": slug } : {},
      })
        .then(r => r.json())
        .then(d => { setSavedCard(d.hasCard ? { brand: d.brand, last4: d.last4 } : null); })
        .catch(() => setSavedCard(null))
        .finally(() => setSavedCardLoading(false));
    }, 500);
    return () => clearTimeout(tid);
  }, [form.customerEmail, isEditing, params.slug]);

  // Fetch all listings + bundle discount from business profile
  useEffect(() => {
    const slug = params.slug ?? "";
    const headers: Record<string, string> = slug ? { "x-tenant-slug": slug } : {};
    Promise.all([
      fetch(`${BASE}/api/listings?status=active`, { headers }).then(r => r.json()).catch(() => []),
      fetch(`${BASE}/api/business`, { headers }).then(r => r.json()).catch(() => ({})),
    ]).then(([ls, biz]) => {
      if (Array.isArray(ls)) setAllListings(ls);
      if (typeof biz?.bundleDiscountPercent === "number") setBundleDiscountPercent(biz.bundleDiscountPercent);
    });
  }, [params.slug]);

  // Keep assignedSlots array length in sync with quantity
  useEffect(() => {
    const qty = Math.max(1, Number(form.quantity) || 1);
    setAssignedSlots(prev => {
      if (prev.length === qty) return prev;
      if (prev.length < qty) return [...prev, ...Array(qty - prev.length).fill("")];
      return prev.slice(0, qty);
    });
  }, [form.quantity]);

  // days must be declared before any useEffect that lists it as a dependency
  const days = useMemo(() => {
    try {
      return Math.max(1, differenceInDays(new Date(form.endDate), new Date(form.startDate)));
    } catch { return 1; }
  }, [form.startDate, form.endDate]);

  // Recalculate bundle item subtotals when days change
  useEffect(() => {
    if (bundleItems.length === 0) return;
    setBundleItems(items => items.map(i => ({ ...i, days, subtotal: i.pricePerDay * i.qty * days })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const basePrice = useMemo(() => {
    if (!listingDetails) return 0;
    return parseFloat(String(listingDetails.pricePerDay)) * days * Number(form.quantity || 1);
  }, [listingDetails, days, form.quantity]);

  const deposit = useMemo(() => {
    if (!listingDetails?.depositAmount) return 0;
    return parseFloat(String(listingDetails.depositAmount));
  }, [listingDetails]);

  // Platform protection plan fee (auto-applied, per day × quantity)
  const platformProtectionRate = platformProtectionPlan?.enabled ? parseFloat(platformProtectionPlan.feeAmount || "0") : 0;
  const platformProtectionFee = platformProtectionRate * days * Number(form.quantity || 1);

  // Listing-level protection addon — only shown/used when no platform plan is active
  const showListingProtection = platformProtectionFee === 0;
  const selectedProtection = useMemo(() => {
    if (!showListingProtection) return null;
    return protectionAddons.find(a => a.id === selectedProtectionId) ?? null;
  }, [protectionAddons, selectedProtectionId, showListingProtection]);
  const protectionPrice = useMemo(() => {
    if (!selectedProtection) return 0;
    const ppu = parseFloat(selectedProtection.price);
    if (selectedProtection.priceType === "per_day") return ppu * days * Number(form.quantity || 1);
    return ppu * Number(form.quantity || 1);
  }, [selectedProtection, days, form.quantity]);

  const bundleItemsTotal = useMemo(() => bundleItems.reduce((s, i) => s + i.subtotal, 0), [bundleItems]);
  const bundleDiscountAmount = useMemo(() => {
    if (bundleItems.length === 0 || bundleDiscountPercent === 0) return 0;
    const allBefore = basePrice + bundleItemsTotal + platformProtectionFee + protectionPrice;
    return allBefore * (bundleDiscountPercent / 100);
  }, [bundleItems, bundleDiscountPercent, basePrice, bundleItemsTotal, platformProtectionFee, protectionPrice]);

  const promoDiscount = appliedPromo ? Math.min(appliedPromo.discountAmount, basePrice + bundleItemsTotal + deposit + platformProtectionFee + protectionPrice - bundleDiscountAmount) : 0;
  const estimatedTotal = Math.max(0.50, basePrice + bundleItemsTotal + deposit + platformProtectionFee + protectionPrice - bundleDiscountAmount - promoDiscount);

  const handleChange = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setError("");
  };

  const handleApplyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoLoading(true);
    setPromoError(null);
    setAppliedPromo(null);
    try {
      const subtotalBeforePromo = basePrice + bundleItemsTotal + deposit + platformProtectionFee + protectionPrice - bundleDiscountAmount;
      const res = await fetch(`${BASE}/api/promo-codes/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, tenantSlug: params.slug, bookingAmountCents: subtotalBeforePromo }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setPromoError(data.error || "Invalid or expired promo code");
      } else {
        setAppliedPromo({ code, discountAmount: data.discountAmount, message: data.message });
        setPromoInput("");
      }
    } catch {
      setPromoError("Failed to validate promo code");
    } finally {
      setPromoLoading(false);
    }
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

      // Force pending status when payment will be collected via link or card
      const effectiveStatus = !isEditing && paymentMode !== "none" ? "pending" : form.status;

      const payload: any = {
        protectionPlanFee: platformProtectionFee > 0 ? String(platformProtectionFee) : (protectionPrice > 0 ? String(protectionPrice) : undefined),
        listingId: Number(form.listingId),
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim().toLowerCase(),
        customerPhone: form.customerPhone || null,
        startDate: form.startDate,
        endDate: form.endDate,
        quantity: Number(form.quantity),
        status: effectiveStatus,
        source: form.source,
        notes: form.notes || null,
        adminNotes: form.adminNotes || null,
        depositPaid: form.depositPaid ? Number(form.depositPaid) : null,
        assignedUnitIds: filledSlots.length > 0 ? filledSlots : [],
        addonsData: JSON.stringify(addonsPayload),
        bundleItems: bundleItems.length > 0 ? bundleItems : undefined,
        bundleDiscountPct: bundleItems.length > 0 ? bundleDiscountPercent : undefined,
        totalPrice: estimatedTotal,
        appliedPromoCode: appliedPromo?.code || undefined,
        discountAmount: promoDiscount > 0 ? promoDiscount : undefined,
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

      const newBookingId = data.id;
      queryClient.invalidateQueries({ queryKey: getGetBookingsQueryKey() });
      if (isEditing) queryClient.setQueryData(getGetBookingQueryKey(editId), data);

      // Mark promo code as used
      if (!isEditing && appliedPromo) {
        fetch(`${BASE}/api/promo-codes/use`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: appliedPromo.code, tenantSlug: params.slug, bookingId: newBookingId }),
        }).catch(() => {});
      }

      // Post-create payment action
      if (!isEditing && paymentMode === "send_link") {
        const plRes = await fetch(`${BASE}/api/stripe/admin-payment-link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: newBookingId }),
        });
        const plData = await plRes.json();
        if (!plRes.ok) {
          setError(plData.error || "Booking created but payment link failed. You can retry from the booking page.");
        } else {
          setPaymentLinkUrl(plData.url);
          toast({
            title: "Payment link sent!",
            description: `Email sent to ${form.customerEmail}. Booking #${newBookingId} is pending payment.`,
          });
          queryClient.invalidateQueries({ queryKey: getGetBookingsQueryKey() });
          setLocation(adminPath(`/bookings/${newBookingId}`));
          return;
        }
      } else if (!isEditing && paymentMode === "charge_saved") {
        const csRes = await fetch(`${BASE}/api/stripe/admin-charge-saved`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: newBookingId }),
        });
        const csData = await csRes.json();
        if (!csRes.ok) {
          setError(csData.error || "Booking created but card charge failed.");
        } else {
          toast({
            title: "Card charged!",
            description: `${csData.brand ?? savedCard?.brand ?? "Card"} ••••${csData.last4 ?? savedCard?.last4} successfully charged $${estimatedTotal.toFixed(2)}. Booking confirmed.`,
          });
          queryClient.invalidateQueries({ queryKey: getGetBookingsQueryKey() });
          setLocation(adminPath(`/bookings/${newBookingId}`));
          return;
        }
      } else {
        toast({
          title: isEditing ? "Booking updated" : "Booking created",
          description: isEditing ? `Booking #${editId} has been updated.` : `Booking #${newBookingId} created for ${data.customerName}.`,
        });
      }

      setLocation(isEditing ? adminPath(`/bookings/${editId}`) : adminPath(`/bookings/${newBookingId}`));
    } catch {
      setError("Connection error. Please try again.");
    } finally { setSaving(false); }
  };

  if (isEditing && !existingBooking) {
    return <div className="p-8 text-muted-foreground">Loading booking…</div>;
  }

  return (
    <>
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
              <CustomerAutocomplete
                name={form.customerName}
                email={form.customerEmail}
                phone={form.customerPhone}
                onChangeName={v => handleChange("customerName", v)}
                onChangeEmail={v => handleChange("customerEmail", v)}
                onChangePhone={v => handleChange("customerPhone", v)}
                autoFocusEmail={!isEditing}
                emailHint="Used for booking confirmation, pickup & return photo links, and all automated notifications."
              />
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
                  {/* Platform-level protection plan — auto-applied, always in total */}
                  {platformProtectionFee > 0 && (
                    <div className="flex justify-between text-sm items-center">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Protection Plan
                        <span className="text-xs opacity-70">(${platformProtectionRate.toFixed(0)}/day × {days}d × {form.quantity || 1})</span>
                      </span>
                      <span className="text-emerald-700 font-medium">+${platformProtectionFee.toFixed(2)}</span>
                    </div>
                  )}
                  {/* Listing-level protection addons — only when no platform plan active */}
                  {showListingProtection && protectionAddons.length > 0 && (
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
                  {/* Bundle items */}
                  {bundleItems.map(item => (
                    <div key={item.listingId} className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3" />
                        {item.title}{item.qty > 1 ? ` ×${item.qty}` : ""}
                      </span>
                      <span>+${item.subtotal.toFixed(2)}</span>
                    </div>
                  ))}
                  {bundleDiscountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600 font-medium">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        Bundle {bundleDiscountPercent}% off
                      </span>
                      <span>-${bundleDiscountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5 text-xs h-8"
                      onClick={() => setBundlePickerOpen(true)}
                      disabled={!form.listingId}
                    >
                      <Plus className="w-3 h-3" />
                      {bundleItems.length > 0 ? `Edit bundle (${bundleItems.length} item${bundleItems.length > 1 ? "s" : ""})` : "Add bundle items"}
                    </Button>
                  </div>

                  {/* Promo Code */}
                  <div className="pt-1 space-y-2">
                    {appliedPromo ? (
                      <div className="flex items-center justify-between rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Ticket className="w-3.5 h-3.5 text-green-600" />
                          <div>
                            <p className="text-xs font-semibold text-green-800 dark:text-green-300">{appliedPromo.code}</p>
                            <p className="text-[10px] text-green-600 dark:text-green-400">{appliedPromo.message}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setAppliedPromo(null); setPromoInput(""); }}
                          className="text-green-600 hover:text-green-800 dark:text-green-400 p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Ticket className="w-3 h-3" /> Promo code
                        </p>
                        <div className="flex gap-1.5">
                          <Input
                            value={promoInput}
                            onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null); }}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleApplyPromo(); } }}
                            placeholder="ENTER CODE"
                            className="h-8 text-xs font-mono uppercase"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs shrink-0"
                            onClick={handleApplyPromo}
                            disabled={!promoInput.trim() || promoLoading}
                          >
                            {promoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
                          </Button>
                        </div>
                        {promoError && <p className="text-xs text-destructive">{promoError}</p>}
                      </div>
                    )}
                    {promoDiscount > 0 && (
                      <div className="flex justify-between text-sm text-green-600 font-medium">
                        <span className="flex items-center gap-1">
                          <Ticket className="w-3 h-3" />
                          Promo: {appliedPromo?.code}
                        </span>
                        <span>-${promoDiscount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

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
              <Select
                value={!isEditing && paymentMode !== "none" ? "pending" : form.status}
                onValueChange={v => handleChange("status", v)}
                disabled={!isEditing && paymentMode !== "none"}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="active">Active (Picked Up)</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              {!isEditing && paymentMode !== "none" && (
                <p className="text-xs text-muted-foreground mt-2">Stays pending until payment is received.</p>
              )}
            </CardContent>
          </Card>

          {/* Payment Options — new bookings only */}
          {!isEditing && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="w-4 h-4 text-primary" /> Payment Collection
                </CardTitle>
                <CardDescription className="text-xs">How will the renter pay for this booking?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Option: No payment / manual */}
                <button
                  type="button"
                  onClick={() => setPaymentMode("none")}
                  className={`w-full text-left rounded-lg border px-3.5 py-3 transition-colors ${paymentMode === "none" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${paymentMode === "none" ? "border-primary" : "border-muted-foreground/40"}`}>
                      {paymentMode === "none" && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">Record only</p>
                      <p className="text-xs text-muted-foreground">Cash, check, or already collected</p>
                    </div>
                  </div>
                </button>

                {/* Option: Send payment link */}
                <button
                  type="button"
                  onClick={() => setPaymentMode("send_link")}
                  className={`w-full text-left rounded-lg border px-3.5 py-3 transition-colors ${paymentMode === "send_link" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${paymentMode === "send_link" ? "border-primary" : "border-muted-foreground/40"}`}>
                      {paymentMode === "send_link" && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium">Send payment link</p>
                        <Send className="w-3 h-3 text-primary" />
                      </div>
                      <p className="text-xs text-muted-foreground">Email a secure Stripe checkout link to the renter</p>
                    </div>
                  </div>
                </button>

                {/* Option: Charge saved card */}
                <button
                  type="button"
                  onClick={() => { if (savedCard) setPaymentMode("charge_saved"); }}
                  disabled={!savedCard && !savedCardLoading}
                  className={`w-full text-left rounded-lg border px-3.5 py-3 transition-colors ${!savedCard && !savedCardLoading ? "opacity-40 cursor-not-allowed" : ""} ${paymentMode === "charge_saved" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${paymentMode === "charge_saved" ? "border-primary" : "border-muted-foreground/40"}`}>
                      {paymentMode === "charge_saved" && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium">Charge saved card</p>
                        <CreditCard className="w-3 h-3 text-primary" />
                      </div>
                      {savedCardLoading ? (
                        <p className="text-xs text-muted-foreground">Checking for saved card…</p>
                      ) : savedCard ? (
                        <p className="text-xs text-emerald-600 font-medium capitalize">{savedCard.brand} ••••{savedCard.last4} on file — charge ${estimatedTotal.toFixed(2)} now</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">No saved card — enter email above to check</p>
                      )}
                    </div>
                  </div>
                </button>

                {/* Payment link display after creation */}
                {paymentLinkUrl && (
                  <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 space-y-2">
                    <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" /> Payment link created
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={paymentLinkUrl}
                        className="text-xs flex-1 bg-white border border-emerald-200 rounded px-2 py-1 text-emerald-700 truncate"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(paymentLinkUrl);
                          setPaymentLinkCopied(true);
                          setTimeout(() => setPaymentLinkCopied(false), 2000);
                        }}
                        className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1 shrink-0"
                      >
                        {paymentLinkCopied ? <CheckCircle className="w-3 h-3" /> : <LinkIcon className="w-3 h-3" />}
                        {paymentLinkCopied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {error && <p className="text-sm text-destructive font-medium">{error}</p>}
            <Button className="w-full" onClick={handleSubmit} disabled={saving}>
              {saving ? (
                paymentMode === "send_link" ? "Sending payment link…" :
                paymentMode === "charge_saved" ? "Charging card…" : "Saving…"
              ) : isEditing ? "Save Changes" : (
                paymentMode === "send_link" ? "Create & Send Payment Link" :
                paymentMode === "charge_saved" ? `Create & Charge ${savedCard ? `${savedCard.brand} ••••${savedCard.last4}` : "Card"}` :
                "Create Booking"
              )}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => window.history.back()}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>

    <BundlePickerModal
      isOpen={bundlePickerOpen}
      onClose={() => setBundlePickerOpen(false)}
      listings={allListings}
      excludeListingId={Number(form.listingId)}
      days={days}
      bundleItems={bundleItems}
      onChange={setBundleItems}
      bundleDiscountPercent={bundleDiscountPercent}
    />
    </>
  );
}
