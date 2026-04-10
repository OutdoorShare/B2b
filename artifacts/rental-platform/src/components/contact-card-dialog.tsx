import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Phone, Mail, FileText, Lightbulb, Shirt, ShoppingBag, Truck, ChevronDown, ChevronUp } from "lucide-react";
import { getAdminSession } from "@/lib/admin-nav";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface ContactCard {
  id: number;
  tenantId: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  specialInstructions: string | null;
  prepWhatToWear: string | null;
  prepWhatToBring: string | null;
  prepVehicleTowRating: string | null;
  prepAdditionalTips: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CardFormData {
  name: string;
  address: string;
  phone: string;
  email: string;
  specialInstructions: string;
  prepWhatToWear: string;
  prepWhatToBring: string;
  prepVehicleTowRating: string;
  prepAdditionalTips: string;
}

const emptyForm: CardFormData = {
  name: "", address: "", phone: "", email: "", specialInstructions: "",
  prepWhatToWear: "", prepWhatToBring: "", prepVehicleTowRating: "", prepAdditionalTips: "",
};

function authHeaders() {
  const s = getAdminSession();
  return s?.token
    ? { "x-admin-token": s.token, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

interface ContactCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCard?: ContactCard | null;
  onSaved: (card: ContactCard) => void;
  businessAddress?: string | null;
  businessPhone?: string | null;
  businessEmail?: string | null;
}

export function ContactCardDialog({ open, onOpenChange, editingCard, onSaved, businessAddress, businessPhone, businessEmail }: ContactCardDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<CardFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [prepExpanded, setPrepExpanded] = useState(false);
  const [useBusinessAddr, setUseBusinessAddr] = useState(false);
  const [useBusinessContact, setUseBusinessContact] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingCard) {
      const addr = editingCard.address ?? "";
      const cardPhone = editingCard.phone ?? "";
      const cardEmail = editingCard.email ?? "";
      setForm({
        name: editingCard.name,
        address: addr,
        phone: cardPhone,
        email: cardEmail,
        specialInstructions: editingCard.specialInstructions ?? "",
        prepWhatToWear: editingCard.prepWhatToWear ?? "",
        prepWhatToBring: editingCard.prepWhatToBring ?? "",
        prepVehicleTowRating: editingCard.prepVehicleTowRating ?? "",
        prepAdditionalTips: editingCard.prepAdditionalTips ?? "",
      });
      setPrepExpanded(!!(editingCard.prepWhatToWear || editingCard.prepWhatToBring || editingCard.prepVehicleTowRating || editingCard.prepAdditionalTips));
      setUseBusinessAddr(!!(businessAddress && addr.trim() === businessAddress.trim()));
      const contactMatches = !!(
        (businessPhone && cardPhone.trim() === businessPhone.trim()) ||
        (businessEmail && cardEmail.trim() === businessEmail.trim())
      );
      setUseBusinessContact(contactMatches);
    } else {
      setForm(emptyForm);
      setPrepExpanded(false);
      setUseBusinessAddr(false);
      setUseBusinessContact(false);
    }
  }, [open, editingCard, businessAddress, businessPhone, businessEmail]);

  const f = (key: keyof CardFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Card name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const url = editingCard
        ? `${BASE}/api/contact-cards/${editingCard.id}`
        : `${BASE}/api/contact-cards`;
      const method = editingCard ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(form) });
      if (!res.ok) throw new Error();
      const saved: ContactCard = await res.json();
      toast({ title: editingCard ? "Contact card updated" : "Contact card created" });
      onSaved(saved);
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to save contact card", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingCard ? "Edit Contact Card" : "New Contact Card"}</DialogTitle>
          <DialogDescription>
            This information is displayed to renters on their booking confirmation screen and sent by email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cc-name">Card name <span className="text-destructive">*</span></Label>
            <Input
              id="cc-name"
              placeholder="e.g., Main Location, Trailhead Parking Lot"
              value={form.name}
              onChange={f("name")}
            />
            <p className="text-xs text-muted-foreground">A label to identify this card internally (not shown to renters)</p>
          </div>

          <div className="space-y-4 rounded-xl border p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact Information</p>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                Pickup Address
              </Label>
              {businessAddress && (
                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-primary cursor-pointer"
                    checked={useBusinessAddr}
                    onChange={e => {
                      const checked = e.target.checked;
                      setUseBusinessAddr(checked);
                      setForm(p => ({ ...p, address: checked ? businessAddress : "" }));
                    }}
                  />
                  <span className="text-sm leading-snug group-hover:text-foreground transition-colors">
                    Use business address
                    <span className="block text-xs text-muted-foreground mt-0.5">{businessAddress}</span>
                  </span>
                </label>
              )}
              <div className={useBusinessAddr ? "opacity-50 pointer-events-none" : ""}>
                <Textarea
                  placeholder="123 Main St, Anytown, CA 90210"
                  rows={2}
                  value={form.address}
                  onChange={f("address")}
                  readOnly={useBusinessAddr}
                />
              </div>
            </div>

            {(businessPhone || businessEmail) && (
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary cursor-pointer"
                  checked={useBusinessContact}
                  onChange={e => {
                    const checked = e.target.checked;
                    setUseBusinessContact(checked);
                    setForm(p => ({
                      ...p,
                      phone: checked ? (businessPhone ?? p.phone) : "",
                      email: checked ? (businessEmail ?? p.email) : "",
                    }));
                  }}
                />
                <span className="text-sm leading-snug group-hover:text-foreground transition-colors">
                  Use business contact info
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {[businessPhone, businessEmail].filter(Boolean).join("  ·  ")}
                  </span>
                </span>
              </label>
            )}
            <div className={`grid grid-cols-2 gap-3${useBusinessContact ? " opacity-50 pointer-events-none" : ""}`}>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-primary" /> Phone
                </Label>
                <Input type="tel" placeholder="(555) 123-4567" value={form.phone} onChange={f("phone")} readOnly={useBusinessContact} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-primary" /> Email
                </Label>
                <Input type="email" placeholder="info@yourcompany.com" value={form.email} onChange={f("email")} readOnly={useBusinessContact} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" /> Special Instructions
              </Label>
              <Textarea
                placeholder="e.g., Call 30 minutes before arrival. Park in the gravel lot on the left."
                rows={3}
                value={form.specialInstructions}
                onChange={f("specialInstructions")}
              />
            </div>
          </div>

          <div className="rounded-xl border overflow-hidden">
            <button
              type="button"
              onClick={() => setPrepExpanded(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Rental Preparation Guide</span>
                <span className="text-xs text-muted-foreground ml-1">(optional)</span>
              </div>
              {prepExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {prepExpanded && (
              <div className="p-4 space-y-4">
                <p className="text-xs text-muted-foreground">
                  Shown to renters on their confirmation screen to help them prepare for pickup. Leave any field blank to hide it.
                </p>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Shirt className="w-3.5 h-3.5 text-primary" /> What to Wear</Label>
                  <Textarea placeholder="e.g., Wear closed-toe shoes and weather-appropriate layers." rows={2} value={form.prepWhatToWear} onChange={f("prepWhatToWear")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><ShoppingBag className="w-3.5 h-3.5 text-primary" /> What to Bring</Label>
                  <Textarea placeholder="e.g., Valid driver's license, water, snacks, sunscreen." rows={2} value={form.prepWhatToBring} onChange={f("prepWhatToBring")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-primary" /> Vehicle / Tow Rating Requirements</Label>
                  <Input placeholder="e.g., Minimum 3,500 lb tow rating. Class III hitch required." value={form.prepVehicleTowRating} onChange={f("prepVehicleTowRating")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5 text-primary" /> Additional Tips</Label>
                  <Textarea placeholder="e.g., Arrive 15 minutes early for a walkthrough. Download offline maps." rows={2} value={form.prepAdditionalTips} onChange={f("prepAdditionalTips")} />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : editingCard ? "Save Changes" : "Create Card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
