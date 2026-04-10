import { adminPath, getAdminSession } from "@/lib/admin-nav";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ShieldAlert, AlertTriangle, Search, X, CalendarDays, User, Zap, BookOpen, DollarSign, Shield, CreditCard, Clock, Image as ImageIcon, Link, Plus, Trash2 } from "lucide-react";
import { format, parseISO, addHours } from "date-fns";
import { ImageUploadCrop } from "@/components/image-upload-crop";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ClaimType = "damage" | "theft" | "overage" | "dispute" | "policy_violation" | "other";

type ListingRule = {
  id: number;
  title: string;
  description: string | null;
  fee: number;
};

type Booking = {
  id: number;
  customerName: string;
  customerEmail: string;
  listingTitle?: string;
  listingId?: number;
  startDate: string;
  endDate: string;
  status: string;
};

type DepositInfo = {
  depositHoldStatus: string | null;
  depositHoldIntentId: string | null;
  depositAmount: number | null;
  stripePaymentIntentId: string | null;
};

export default function AdminClaimsNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const params = new URLSearchParams(window.location.search);

  // Core claim fields
  const [customerName, setCustomerName] = useState(params.get("customerName") ?? "");
  const [customerEmail, setCustomerEmail] = useState(params.get("customerEmail") ?? "");
  const [bookingId, setBookingId] = useState(params.get("bookingId") ?? "");
  const [listingId, setListingId] = useState(params.get("listingId") ?? "");
  const [type, setType] = useState<ClaimType>("damage");
  const [description, setDescription] = useState("");
  const [claimedAmount, setClaimedAmount] = useState("");
  const [listingRules, setListingRules] = useState<ListingRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string>("");
  const [activeShortcut, setActiveShortcut] = useState<"rule" | "cancellation" | null>(null);

  // Deposit info for linked booking
  const [depositInfo, setDepositInfo] = useState<DepositInfo | null>(null);

  // Business profile for cancellation policy
  const [cancellationPolicy, setCancellationPolicy] = useState<string | null>(null);

  // Evidence photos
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [newEvidenceUrl, setNewEvidenceUrl] = useState("");

  // Whether to charge card on file (policy violations only, within 48h window)
  const [chargeCard, setChargeCard] = useState(false);

  // Confirmation dialog
  const [showConfirm, setShowConfirm] = useState(false);

  // Booking search
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [bookingSearch, setBookingSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const isFromBooking = !!params.get("bookingId");

  // Load all bookings once for search
  useEffect(() => {
    const s = getAdminSession();
    const headers: Record<string, string> = {};
    if (s?.token) headers["x-admin-token"] = s.token;
    fetch(`${BASE}/api/bookings`, { headers })
      .then(r => r.json())
      .then((data: Booking[]) => {
        if (Array.isArray(data)) setAllBookings(data);
      })
      .catch(() => {});
  }, []);

  // Fetch business profile for cancellation policy
  useEffect(() => {
    const s = getAdminSession();
    const headers: Record<string, string> = {};
    if (s?.token) headers["x-admin-token"] = s.token;
    fetch(`${BASE}/api/business`, { headers })
      .then(r => r.json())
      .then((d: any) => {
        if (d?.cancellationPolicy) setCancellationPolicy(d.cancellationPolicy);
      })
      .catch(() => {});
  }, []);

  // If coming from a booking URL param, auto-select it once bookings load
  useEffect(() => {
    const preId = params.get("bookingId");
    if (!preId || allBookings.length === 0 || selectedBooking) return;
    const found = allBookings.find(b => String(b.id) === preId);
    if (found) selectBooking(found);
  }, [allBookings]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset chargeCard when type changes away from policy_violation
  useEffect(() => {
    if (type !== "policy_violation") setChargeCard(false);
  }, [type]);

  const filteredBookings = (() => {
    const q = bookingSearch.trim().toLowerCase();
    if (!q) return allBookings.slice(0, 10);
    return allBookings.filter(b =>
      String(b.id).includes(q) ||
      (b.customerName ?? "").toLowerCase().includes(q) ||
      (b.customerEmail ?? "").toLowerCase().includes(q) ||
      (b.listingTitle ?? "").toLowerCase().includes(q)
    ).slice(0, 10);
  })();

  async function fetchDepositInfo(bid: number) {
    try {
      const s = getAdminSession();
      const headers: Record<string, string> = {};
      if (s?.token) headers["x-admin-token"] = s.token;
      const r = await fetch(`${BASE}/api/bookings/${bid}`, { headers });
      if (!r.ok) return;
      const d = await r.json();
      setDepositInfo({
        depositHoldStatus: d.depositHoldStatus ?? null,
        depositHoldIntentId: d.depositHoldIntentId ?? null,
        depositAmount: d.depositAmount ?? null,
        stripePaymentIntentId: d.stripePaymentIntentId ?? null,
      });
    } catch { /* non-fatal */ }
  }

  function selectBooking(b: Booking) {
    setSelectedBooking(b);
    setBookingId(String(b.id));
    setListingId(String(b.listingId ?? ""));
    setCustomerName(b.customerName ?? "");
    setCustomerEmail(b.customerEmail ?? "");
    setBookingSearch("");
    setShowDropdown(false);
    setActiveShortcut(null);
    setSelectedRuleId("");
    setDepositInfo(null);
    setChargeCard(false);
    fetchDepositInfo(b.id);
  }

  function clearBooking() {
    setSelectedBooking(null);
    setBookingId("");
    setListingId("");
    setActiveShortcut(null);
    setSelectedRuleId("");
    setDepositInfo(null);
    setChargeCard(false);
  }

  // Fetch listing rules when listing ID is known
  useEffect(() => {
    const lid = parseInt(listingId);
    if (!lid) { setListingRules([]); setSelectedRuleId(""); return; }
    fetch(`${BASE}/api/listings/${lid}/rules`)
      .then(r => r.json())
      .then((data: ListingRule[]) => { if (Array.isArray(data)) setListingRules(data.filter(r => r.fee > 0)); })
      .catch(() => {});
  }, [listingId]);

  // Quick-file: listing rule violation
  function quickFileRule(rule: ListingRule) {
    setActiveShortcut("rule");
    setSelectedRuleId(String(rule.id));
    setType("policy_violation");
    setClaimedAmount(rule.fee.toFixed(2));
    setDescription(`Policy violation: "${rule.title}"${rule.description ? `\n\n${rule.description}` : ""}`);
  }

  // Quick-file: cancellation policy breach
  function quickFileCancellation() {
    setActiveShortcut("cancellation");
    setSelectedRuleId("");
    setType("policy_violation");
    if (!claimedAmount) setClaimedAmount("");
    setDescription(`Cancellation policy violation.\n\nPolicy: ${cancellationPolicy}`);
  }

  const showShortcuts = selectedBooking && (listingRules.length > 0 || cancellationPolicy);
  const hasAuthorizedHold = depositInfo?.depositHoldStatus === "authorized" && !!depositInfo.depositHoldIntentId;
  const depositDisplay = depositInfo?.depositAmount != null ? `$${depositInfo.depositAmount.toFixed(2)}` : "security deposit";

  // 48-hour charge window: can charge card up to 48 hours after rental end date
  const chargeWindowDeadline = selectedBooking
    ? addHours(new Date(selectedBooking.endDate + "T23:59:59"), 48)
    : null;
  const withinChargeWindow = chargeWindowDeadline ? chargeWindowDeadline > new Date() : false;
  const hasCardOnFile = !!depositInfo?.stripePaymentIntentId;

  // Show card-charge toggle when: policy violation, no deposit hold, card on file
  const showCardChargeOption = type === "policy_violation" && !hasAuthorizedHold && hasCardOnFile;
  // Show expired warning when: policy violation, no deposit hold, card existed but window closed
  const showWindowExpiredNotice = type === "policy_violation" && !hasAuthorizedHold && selectedBooking && !withinChargeWindow;

  // Show confirmation dialog on submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerEmail || !description) {
      toast({ title: "Customer name, email, and description are required", variant: "destructive" }); return;
    }
    setShowConfirm(true);
  };

  const confirmAndFile = async () => {
    setShowConfirm(false);
    setSaving(true);
    try {
      const s = getAdminSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (s?.token) headers["x-admin-token"] = s.token;
      const res = await fetch(`${BASE}/api/claims`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          customerName,
          customerEmail,
          bookingId: bookingId ? parseInt(bookingId) : null,
          listingId: listingId ? parseInt(listingId) : null,
          type,
          description,
          claimedAmount: claimedAmount ? parseFloat(claimedAmount) : null,
          chargeCardOnFile: chargeCard && type === "policy_violation" && withinChargeWindow,
          evidenceUrls: evidenceUrls.length > 0 ? evidenceUrls : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.depositCaptured) {
        toast({
          title: "Claim filed & deposit charged",
          description: `The security deposit of $${data.depositCapturedAmount?.toFixed(2)} has been captured.`,
        });
      } else if (data.cardCharged) {
        toast({
          title: "Claim filed & card charged",
          description: `$${data.cardChargedAmount?.toFixed(2)} has been charged to the renter's card on file.`,
        });
      } else if (data.cardChargeBlocked) {
        toast({
          title: "Claim filed — charge window expired",
          description: "The 48-hour window to charge the card on file has passed. Claim was still filed.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Claim created" });
      }

      setLocation(adminPath(`/claims/${data.id}`));
    } catch (err: any) {
      toast({ title: err?.message || "Failed to create claim", variant: "destructive" });
    } finally { setSaving(false); }
  };

  function statusColor(status: string) {
    switch (status) {
      case "confirmed": case "active": return "bg-green-100 text-green-800";
      case "completed": return "bg-blue-100 text-blue-800";
      case "cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-700";
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              File this claim?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You're about to file a <strong className="capitalize">{type.replace("_", " ")}</strong> claim
                  {selectedBooking ? ` against Booking #${selectedBooking.id} (${selectedBooking.customerName})` : ""}.
                  {claimedAmount ? ` Claimed amount: $${parseFloat(claimedAmount).toFixed(2)}.` : ""}
                </p>
                {hasAuthorizedHold ? (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 space-y-1">
                    <p className="font-semibold text-amber-900 text-sm flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-amber-600" />
                      Security deposit will be charged
                    </p>
                    <p className="text-sm text-amber-800">
                      The renter's {depositDisplay} security deposit hold will be immediately converted to a charge and transferred to your account.
                    </p>
                  </div>
                ) : chargeCard && type === "policy_violation" && withinChargeWindow && claimedAmount ? (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 space-y-1">
                    <p className="font-semibold text-blue-900 text-sm flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      Card on file will be charged
                    </p>
                    <p className="text-sm text-blue-800">
                      The renter's card on file will be immediately charged <strong>${parseFloat(claimedAmount).toFixed(2)}</strong> for this policy violation.
                    </p>
                  </div>
                ) : selectedBooking && depositInfo && !hasAuthorizedHold ? (
                  <div className="rounded-lg bg-muted px-4 py-3">
                    <p className="text-sm text-muted-foreground">
                      {depositInfo.depositHoldStatus === "captured"
                        ? "The security deposit for this booking was already captured."
                        : depositInfo.depositHoldStatus === "released"
                          ? "The security deposit for this booking was released."
                          : "No security deposit hold found for this booking. The claim will be opened for manual review."}
                    </p>
                  </div>
                ) : null}
                <p className="text-sm text-muted-foreground">This action cannot be undone. The claim will be opened immediately.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAndFile}
              className={
                hasAuthorizedHold
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : chargeCard && type === "policy_violation" && withinChargeWindow && claimedAmount
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : ""
              }
            >
              {hasAuthorizedHold
                ? `Yes, File & Charge ${depositDisplay}`
                : chargeCard && type === "policy_violation" && withinChargeWindow && claimedAmount
                  ? `Yes, File & Charge $${parseFloat(claimedAmount).toFixed(2)}`
                  : "Yes, File Claim"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost" size="icon"
          onClick={() => isFromBooking ? setLocation(adminPath(`/bookings/${params.get("bookingId")}`)) : setLocation(adminPath("/claims"))}
          className="-ml-2"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" /> New Claim
          </h1>
          <p className="text-sm text-muted-foreground">File a damage, theft, dispute, or policy violation claim.</p>
        </div>
      </div>

      {isFromBooking && !selectedBooking && (
        <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
          <span>Pre-filled from <strong>Booking #{params.get("bookingId")}</strong>. Review details below and add any missing info.</span>
        </div>
      )}

      {/* Deposit hold notice */}
      {hasAuthorizedHold && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-sm text-amber-900">
          <DollarSign className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-semibold">Security deposit on hold</p>
            <p className="text-amber-700 mt-0.5">
              This booking has an authorized security deposit hold of <strong>{depositDisplay}</strong>.
              Filing this claim will immediately convert it to a charge.
            </p>
          </div>
        </div>
      )}

      {/* No deposit — card available notice */}
      {showCardChargeOption && withinChargeWindow && (
        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-900">
          <CreditCard className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
          <div>
            <p className="font-semibold">No deposit hold — card on file available</p>
            <p className="text-blue-700 mt-0.5">
              No security deposit was collected on this booking. For policy violations you may charge the renter's card on file directly.
              This option expires <strong>{chargeWindowDeadline ? format(chargeWindowDeadline, "MMM d 'at' h:mm a") : ""}</strong>.
            </p>
          </div>
        </div>
      )}

      {/* 48-hour window expired notice */}
      {showWindowExpiredNotice && !withinChargeWindow && (
        <div className="flex items-start gap-2.5 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-900">
          <Clock className="w-4 h-4 shrink-0 text-orange-600 mt-0.5" />
          <div>
            <p className="font-semibold">Charge window expired</p>
            <p className="text-orange-700 mt-0.5">
              The 48-hour window to charge the renter's card on file has passed (deadline was {chargeWindowDeadline ? format(chargeWindowDeadline, "MMM d 'at' h:mm a") : "unknown"}).
              You can still file this claim for your records, but no automatic charge will be applied.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Rental Reference — booking search */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rental Reference</CardTitle>
            <CardDescription>Search for a booking to link this claim — fills in renter info automatically.</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedBooking ? (
              <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">Booking #{selectedBooking.id}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${statusColor(selectedBooking.status)}`}>
                      {selectedBooking.status}
                    </span>
                    {hasAuthorizedHold && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 flex items-center gap-0.5">
                        <DollarSign className="w-2.5 h-2.5" /> Deposit hold: {depositDisplay}
                      </span>
                    )}
                    {!hasAuthorizedHold && hasCardOnFile && withinChargeWindow && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800 flex items-center gap-0.5">
                        <CreditCard className="w-2.5 h-2.5" /> Card on file
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium truncate">{selectedBooking.listingTitle ?? "—"}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {selectedBooking.customerName}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {format(parseISO(selectedBooking.startDate), "MMM d")} – {format(parseISO(selectedBooking.endDate), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={clearBooking}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div ref={searchRef} className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search by renter name, listing, or booking #…"
                    value={bookingSearch}
                    onChange={e => { setBookingSearch(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                  />
                </div>
                {showDropdown && (
                  <div className="absolute z-50 w-full mt-1 rounded-lg border bg-popover shadow-md overflow-hidden">
                    {filteredBookings.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-muted-foreground">No bookings found.</p>
                    ) : (
                      <ul>
                        {filteredBookings.map(b => (
                          <li key={b.id}>
                            <button
                              type="button"
                              className="w-full text-left px-4 py-2.5 hover:bg-accent transition-colors"
                              onMouseDown={() => selectBooking(b)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium">#{b.id} · {b.customerName}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize shrink-0 ${statusColor(b.status)}`}>
                                  {b.status}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {b.listingTitle ?? "—"} · {format(parseISO(b.startDate), "MMM d")}–{format(parseISO(b.endDate), "MMM d, yyyy")}
                              </p>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">Leave blank to file a claim without linking a specific booking.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ⚡ Policy Violation Shortcuts — shown when booking linked and policies/rules exist */}
        {showShortcuts && (
          <Card className="border-amber-300 bg-amber-50/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-amber-900">
                <Zap className="w-4 h-4 text-amber-600" />
                Policy Violation — Quick File
              </CardTitle>
              <CardDescription className="text-amber-700">
                Select the policy that was broken to instantly configure this claim with the correct fee.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Listing rule cards */}
              {listingRules.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Rental Rules</p>
                  <div className="grid gap-2">
                    {listingRules.map(rule => (
                      <button
                        key={rule.id}
                        type="button"
                        onClick={() => quickFileRule(rule)}
                        className={`w-full text-left rounded-lg border-2 px-4 py-3 transition-all ${
                          activeShortcut === "rule" && selectedRuleId === String(rule.id)
                            ? "border-amber-500 bg-amber-100 ring-1 ring-amber-400"
                            : "border-amber-200 bg-white hover:border-amber-400 hover:bg-amber-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span className="font-semibold text-sm text-amber-900 truncate">{rule.title}</span>
                          </div>
                          <span className="flex items-center gap-1 text-sm font-bold text-amber-800 shrink-0 bg-amber-100 border border-amber-300 rounded-full px-2.5 py-0.5">
                            <DollarSign className="w-3 h-3" />{rule.fee.toFixed(2)} fee
                          </span>
                        </div>
                        {rule.description && (
                          <p className="text-xs text-amber-700 mt-1 ml-6 line-clamp-2">{rule.description}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cancellation policy */}
              {cancellationPolicy && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Cancellation Policy</p>
                  <button
                    type="button"
                    onClick={quickFileCancellation}
                    className={`w-full text-left rounded-lg border-2 px-4 py-3 transition-all ${
                      activeShortcut === "cancellation"
                        ? "border-amber-500 bg-amber-100 ring-1 ring-amber-400"
                        : "border-amber-200 bg-white hover:border-amber-400 hover:bg-amber-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <BookOpen className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="font-semibold text-sm text-amber-900">Cancellation Policy Breach</span>
                    </div>
                    <p className="text-xs text-amber-700 ml-6 line-clamp-3">{cancellationPolicy}</p>
                    <p className="text-xs text-amber-500 ml-6 mt-1.5 italic">Claimed amount set manually below</p>
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Customer info — auto-filled when a booking is selected */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Full Name <span className="text-destructive">*</span></Label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Jane Smith" required />
              </div>
              <div className="space-y-1.5">
                <Label>Email <span className="text-destructive">*</span></Label>
                <Input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="jane@example.com" required />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Claim details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Claim Details</CardTitle>
            {type === "policy_violation" && (
              <CardDescription className="flex items-center gap-1.5 text-amber-700 font-medium">
                <Zap className="w-3.5 h-3.5" /> Policy violation selected — review the pre-filled amount and description below.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Claim Type</Label>
                <Select value={type} onValueChange={(v: any) => { setType(v); if (v !== "policy_violation") { setActiveShortcut(null); setSelectedRuleId(""); } }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="damage">Damage</SelectItem>
                    <SelectItem value="theft">Theft</SelectItem>
                    <SelectItem value="overage">Overage</SelectItem>
                    <SelectItem value="dispute">Dispute</SelectItem>
                    <SelectItem value="policy_violation">
                      <span className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-600" /> Policy Violation
                      </span>
                    </SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Claimed Amount ($)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number" min="0" step="0.01"
                    value={claimedAmount}
                    onChange={e => setClaimedAmount(e.target.value)}
                    className="pl-7"
                    placeholder="0.00"
                  />
                </div>
                {type === "policy_violation" && activeShortcut === "rule" && selectedRuleId && (
                  <p className="text-xs text-amber-600">Auto-filled from rule fee</p>
                )}
                {type === "policy_violation" && activeShortcut === "cancellation" && (
                  <p className="text-xs text-amber-600">Enter the cancellation fee manually</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-destructive">*</span></Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={5}
                placeholder={type === "policy_violation" ? "Describe the policy violation in detail…" : "Describe the incident, damage, or dispute in detail…"}
              />
            </div>

            {/* ── Charge card on file toggle (policy violations only, within 48h window) ── */}
            {showCardChargeOption && (
              <div className={`rounded-lg border-2 px-4 py-4 transition-colors ${chargeCard ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50"}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CreditCard className={`w-4 h-4 ${chargeCard ? "text-blue-600" : "text-muted-foreground"}`} />
                      <span className="font-semibold text-sm">Charge card on file</span>
                      {withinChargeWindow && chargeWindowDeadline && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 font-medium flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          Available until {format(chargeWindowDeadline, "MMM d, h:mm a")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {withinChargeWindow
                        ? `Immediately charge the renter's card on file${claimedAmount ? ` $${parseFloat(claimedAmount || "0").toFixed(2)}` : " the claimed amount"} for this policy breach. Requires a claimed amount.`
                        : "The 48-hour window has closed — you cannot charge the card for this booking."}
                    </p>
                  </div>
                  <Switch
                    checked={chargeCard}
                    onCheckedChange={setChargeCard}
                    disabled={!withinChargeWindow || !claimedAmount}
                  />
                </div>
                {chargeCard && !claimedAmount && (
                  <p className="text-xs text-destructive mt-2">Enter a claimed amount above to enable card charging.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evidence Photos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" /> Evidence Photos
            </CardTitle>
            <CardDescription>Upload photos showing damage, theft, or policy violations. You can also paste image URLs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {evidenceUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {evidenceUrls.map((url, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={url.startsWith("/api/") ? `${BASE}${url}` : url}
                      alt={`Evidence ${i + 1}`}
                      className="w-full h-24 object-cover rounded-lg border"
                      onError={e => (e.currentTarget.style.display = "none")}
                    />
                    <button
                      type="button"
                      onClick={() => setEvidenceUrls(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {evidenceUrls.length === 0 && (
              <p className="text-sm text-muted-foreground">No photos attached yet.</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <ImageUploadCrop
                token={getAdminSession()?.token ?? ""}
                onUploaded={url => setEvidenceUrls(prev => [...prev, url])}
              />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex gap-2 flex-1 min-w-[200px]">
                <div className="relative flex-1">
                  <Link className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={newEvidenceUrl}
                    onChange={e => setNewEvidenceUrl(e.target.value)}
                    placeholder="Paste image URL…"
                    className="pl-8 h-8 text-sm"
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const url = newEvidenceUrl.trim();
                        if (url) { setEvidenceUrls(prev => [...prev, url]); setNewEvidenceUrl(""); }
                      }
                    }}
                  />
                </div>
                <Button
                  type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0"
                  onClick={() => { const url = newEvidenceUrl.trim(); if (url) { setEvidenceUrls(prev => [...prev, url]); setNewEvidenceUrl(""); } }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => setLocation(adminPath("/claims"))}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Filing…" : "Review & File Claim"}
          </Button>
        </div>
      </form>
    </div>
  );
}
