import { adminPath } from "@/lib/admin-nav";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ShieldAlert, AlertTriangle } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ClaimType = "damage" | "theft" | "overage" | "dispute" | "other";

type ListingRule = {
  id: number;
  title: string;
  description: string | null;
  fee: number;
};

export default function AdminClaimsNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const [customerName, setCustomerName] = useState(params.get("customerName") ?? "");
  const [customerEmail, setCustomerEmail] = useState(params.get("customerEmail") ?? "");
  const [bookingId, setBookingId] = useState(params.get("bookingId") ?? "");
  const [listingId, setListingId] = useState(params.get("listingId") ?? "");
  const [type, setType] = useState<ClaimType>("damage");
  const [description, setDescription] = useState("");
  const [claimedAmount, setClaimedAmount] = useState("");
  const [listingRules, setListingRules] = useState<ListingRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string>("");

  // Fetch listing rules when listing ID is known
  useEffect(() => {
    const lid = parseInt(listingId);
    if (!lid) { setListingRules([]); setSelectedRuleId(""); return; }
    fetch(`${BASE}/api/listings/${lid}/rules`)
      .then(r => r.json())
      .then((data: ListingRule[]) => { if (Array.isArray(data)) setListingRules(data.filter(r => r.fee > 0)); })
      .catch(() => {});
  }, [listingId]);

  // Auto-fill claimed amount when a rule is selected
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
      const res = await fetch(`${BASE}/api/claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const isFromBooking = !!params.get("bookingId");

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

      {isFromBooking && (
        <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
          <span>Pre-filled from <strong>Booking #{params.get("bookingId")}</strong>. Review details below and add any missing info.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rental Reference</CardTitle>
            <CardDescription>Optional — link this claim to a booking or listing.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Booking ID</Label>
              <Input type="number" value={bookingId} onChange={e => setBookingId(e.target.value)} placeholder="e.g. 42" />
            </div>
            <div className="space-y-1.5">
              <Label>Listing ID</Label>
              <Input type="number" value={listingId} onChange={e => setListingId(e.target.value)} placeholder="e.g. 3" />
            </div>
          </CardContent>
        </Card>

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
