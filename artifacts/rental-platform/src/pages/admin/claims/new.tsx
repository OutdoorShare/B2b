import { adminPath, getAdminSession } from "@/lib/admin-nav";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ShieldAlert, AlertTriangle, Search, X, CalendarDays, User } from "lucide-react";
import { format, parseISO } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ClaimType = "damage" | "theft" | "overage" | "dispute" | "other";

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

  function selectBooking(b: Booking) {
    setSelectedBooking(b);
    setBookingId(String(b.id));
    setListingId(String(b.listingId ?? ""));
    setCustomerName(b.customerName ?? "");
    setCustomerEmail(b.customerEmail ?? "");
    setBookingSearch("");
    setShowDropdown(false);
  }

  function clearBooking() {
    setSelectedBooking(null);
    setBookingId("");
    setListingId("");
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

  const handleRuleSelect = (ruleId: string) => {
    setSelectedRuleId(ruleId);
    const rule = listingRules.find(r => r.id === parseInt(ruleId));
    if (rule) {
      setClaimedAmount(rule.fee.toFixed(2));
      if (!description) setDescription(`Violation of rule: "${rule.title}"`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerEmail || !description) {
      toast({ title: "Customer name, email, and description are required", variant: "destructive" }); return;
    }
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Claim created" });
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
          <p className="text-sm text-muted-foreground">File a new damage, theft, or dispute claim.</p>
        </div>
      </div>

      {isFromBooking && !selectedBooking && (
        <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
          <span>Pre-filled from <strong>Booking #{params.get("bookingId")}</strong>. Review details below and add any missing info.</span>
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

        {/* Violated rule (shown when a booking with listing rules is linked) */}
        {listingRules.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Violated Rule (optional)
              </CardTitle>
              <CardDescription>Select a rule to auto-fill the claimed amount.</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedRuleId} onValueChange={handleRuleSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a violated rule…" />
                </SelectTrigger>
                <SelectContent>
                  {listingRules.map(rule => (
                    <SelectItem key={rule.id} value={String(rule.id)}>
                      {rule.title} — ${rule.fee.toFixed(2)} fee
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Jane Doe" />
              </div>
              <div className="space-y-1.5">
                <Label>Email <span className="text-destructive">*</span></Label>
                <Input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="jane@example.com" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Claim details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Claim Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Claim Type</Label>
                <Select value={type} onValueChange={(v: any) => setType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="damage">Damage</SelectItem>
                    <SelectItem value="theft">Theft</SelectItem>
                    <SelectItem value="overage">Overage</SelectItem>
                    <SelectItem value="dispute">Dispute</SelectItem>
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
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-destructive">*</span></Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={5}
                placeholder="Describe the incident, damage, or dispute in detail…"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => setLocation(adminPath("/claims"))}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "File Claim"}
          </Button>
        </div>
      </form>
    </div>
  );
}
