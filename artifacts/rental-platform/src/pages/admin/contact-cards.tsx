import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, MapPin, Phone, Mail, FileText, Pencil, Trash2, IdCard, Info,
  Shirt, ShoppingBag, Truck, Lightbulb, ChevronDown, ChevronUp
} from "lucide-react";
import { getAdminSession } from "@/lib/admin-nav";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function handleUnauthorized() {
  localStorage.removeItem("admin_session");
  window.location.reload();
}

interface ContactCard {
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
  return s?.token ? { "x-admin-token": s.token, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

function hasPrepGuide(card: ContactCard) {
  return !!(card.prepWhatToWear || card.prepWhatToBring || card.prepVehicleTowRating || card.prepAdditionalTips);
}

export default function ContactCards() {
  const { toast } = useToast();
  const [cards, setCards] = useState<ContactCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<ContactCard | null>(null);
  const [form, setForm] = useState<CardFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [prepExpanded, setPrepExpanded] = useState(false);
  const [businessAddress, setBusinessAddress] = useState<string | null>(null);
  const [useBusinessAddr, setUseBusinessAddr] = useState(false);

  useEffect(() => {
    const s = getAdminSession();
    const headers: Record<string, string> = {};
    if (s?.token) headers["x-admin-token"] = s.token;
    fetch(`${BASE}/api/business`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.address) setBusinessAddress(data.address); })
      .catch(() => {});
  }, []);

  const fetchCards = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/contact-cards`, { headers: authHeaders() });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) throw new Error();
      setCards(await res.json());
    } catch {
      toast({ title: "Failed to load contact cards", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCards(); }, []);

  const openCreate = () => {
    setEditingCard(null);
    setForm(emptyForm);
    setPrepExpanded(false);
    setUseBusinessAddr(false);
    setDialogOpen(true);
  };

  const openEdit = (card: ContactCard) => {
    setEditingCard(card);
    const addr = card.address ?? "";
    setForm({
      name: card.name,
      address: addr,
      phone: card.phone ?? "",
      email: card.email ?? "",
      specialInstructions: card.specialInstructions ?? "",
      prepWhatToWear: card.prepWhatToWear ?? "",
      prepWhatToBring: card.prepWhatToBring ?? "",
      prepVehicleTowRating: card.prepVehicleTowRating ?? "",
      prepAdditionalTips: card.prepAdditionalTips ?? "",
    });
    setPrepExpanded(hasPrepGuide(card));
    // Auto-check if address matches business address
    setUseBusinessAddr(!!(businessAddress && addr.trim() === businessAddress.trim()));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Card name is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const url = editingCard
        ? `${BASE}/api/contact-cards/${editingCard.id}`
        : `${BASE}/api/contact-cards`;
      const method = editingCard ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(form) });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) throw new Error();
      toast({ title: editingCard ? "Contact card updated" : "Contact card created" });
      setDialogOpen(false);
      fetchCards();
    } catch {
      toast({ title: "Failed to save contact card", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${BASE}/api/contact-cards/${id}`, { method: "DELETE", headers: authHeaders() });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) throw new Error();
      toast({ title: "Contact card deleted" });
      fetchCards();
    } catch {
      toast({ title: "Failed to delete contact card", variant: "destructive" });
    }
  };

  const f = (key: keyof CardFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Contact Cards</h2>
          <p className="text-muted-foreground mt-1">
            Create reusable contact cards with pickup info and a rental preparation guide. Assign them to listings — renters see the card automatically at booking confirmation.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          New Card
        </Button>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <p className="font-semibold">How contact cards work</p>
          <p>
            When a booking is confirmed online, the renter sees the contact card on the confirmation screen — including your pickup address, phone, email, special instructions, and a rental preparation guide (what to wear, what to bring, tow requirements, and more).
            You'll also receive a notification with the renter's contact details for coordination.
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400">Assign a card to a listing by editing the listing and selecting a contact card at the bottom of the form.</p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading contact cards…</div>
      ) : cards.length === 0 ? (
        <div className="py-16 text-center space-y-4 rounded-2xl border border-dashed">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <IdCard className="w-7 h-7 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-lg">No contact cards yet</p>
            <p className="text-muted-foreground text-sm mt-1">Create your first contact card to share pickup info with renters automatically.</p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Contact Card
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(card => (
            <Card key={card.id} className="relative group hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{card.name}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">Contact Card #{card.id}</CardDescription>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(card)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete contact card?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the card from any listings it's assigned to. Existing confirmed bookings won't be affected.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(card.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4 space-y-2.5 text-sm">
                {card.address && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                    <span className="line-clamp-2">{card.address}</span>
                  </div>
                )}
                {card.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-3.5 h-3.5 shrink-0 text-primary" />
                    <a href={`tel:${card.phone}`} className="hover:text-foreground transition-colors">{card.phone}</a>
                  </div>
                )}
                {card.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 shrink-0 text-primary" />
                    <a href={`mailto:${card.email}`} className="hover:text-foreground transition-colors truncate">{card.email}</a>
                  </div>
                )}
                {card.specialInstructions && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                    <span className="line-clamp-2 text-xs leading-relaxed">{card.specialInstructions}</span>
                  </div>
                )}
                {hasPrepGuide(card) && (
                  <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-md px-2.5 py-1.5 mt-1">
                    <Lightbulb className="w-3 h-3 shrink-0" />
                    Preparation guide included
                  </div>
                )}
                {!card.address && !card.phone && !card.email && !card.specialInstructions && !hasPrepGuide(card) && (
                  <p className="text-xs text-muted-foreground italic">No details added yet</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCard ? "Edit Contact Card" : "New Contact Card"}</DialogTitle>
            <DialogDescription>
              This information is displayed to renters on their booking confirmation screen and sent by email.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Card name */}
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

            {/* Contact Info */}
            <div className="space-y-4 rounded-xl border p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact Information</p>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  Pickup Address
                </Label>

                {/* Business address shortcut */}
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
                    id="cc-address"
                    placeholder="123 Main St, Anytown, CA 90210"
                    rows={2}
                    value={form.address}
                    onChange={f("address")}
                    readOnly={useBusinessAddr}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cc-phone" className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-primary" />
                    Phone
                  </Label>
                  <Input id="cc-phone" type="tel" placeholder="(555) 123-4567" value={form.phone} onChange={f("phone")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cc-email" className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-primary" />
                    Email
                  </Label>
                  <Input id="cc-email" type="email" placeholder="info@yourcompany.com" value={form.email} onChange={f("email")} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cc-instructions" className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  Special Instructions
                </Label>
                <Textarea
                  id="cc-instructions"
                  placeholder="e.g., Call 30 minutes before arrival. Park in the gravel lot on the left."
                  rows={3}
                  value={form.specialInstructions}
                  onChange={f("specialInstructions")}
                />
              </div>
            </div>

            {/* Preparation Guide — collapsible */}
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
                    <Label htmlFor="cc-wear" className="flex items-center gap-1.5">
                      <Shirt className="w-3.5 h-3.5 text-primary" />
                      What to Wear
                    </Label>
                    <Textarea
                      id="cc-wear"
                      placeholder="e.g., Wear closed-toe shoes and weather-appropriate layers. Sun protection recommended."
                      rows={2}
                      value={form.prepWhatToWear}
                      onChange={f("prepWhatToWear")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cc-bring" className="flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                      What to Bring
                    </Label>
                    <Textarea
                      id="cc-bring"
                      placeholder="e.g., Valid driver's license, water, snacks, sunscreen, a fully charged phone."
                      rows={2}
                      value={form.prepWhatToBring}
                      onChange={f("prepWhatToBring")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cc-tow" className="flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-primary" />
                      Vehicle / Tow Rating Requirements
                    </Label>
                    <Input
                      id="cc-tow"
                      placeholder="e.g., Minimum 3,500 lb tow rating. Class III hitch required. 4WD recommended."
                      value={form.prepVehicleTowRating}
                      onChange={f("prepVehicleTowRating")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cc-tips" className="flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-primary" />
                      Additional Tips
                    </Label>
                    <Textarea
                      id="cc-tips"
                      placeholder="e.g., Arrive 15 minutes early for a walkthrough. Download offline maps. Check weather before departure."
                      rows={2}
                      value={form.prepAdditionalTips}
                      onChange={f("prepAdditionalTips")}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editingCard ? "Save Changes" : "Create Card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
