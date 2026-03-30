import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ShieldAlert } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ClaimType = "damage" | "theft" | "overage" | "dispute" | "other";

export default function AdminClaimsNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [listingId, setListingId] = useState("");
  const [type, setType] = useState<ClaimType>("damage");
  const [description, setDescription] = useState("");
  const [claimedAmount, setClaimedAmount] = useState("");

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
      setLocation(`/admin/claims/${data.id}`);
    } catch (err: any) {
      toast({ title: err?.message || "Failed to create claim", variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/claims")} className="-ml-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" /> New Claim
          </h1>
          <p className="text-sm text-muted-foreground">File a new damage, theft, or dispute claim.</p>
        </div>
      </div>

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
          <Button type="button" variant="outline" onClick={() => setLocation("/admin/claims")}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "File Claim"}
          </Button>
        </div>
      </form>
    </div>
  );
}
