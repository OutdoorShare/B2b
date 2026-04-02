import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Phone, Mail, FileText, Pencil, Trash2, IdCard, Info } from "lucide-react";
import { getAdminSession } from "@/lib/admin-nav";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ContactCard {
  id: number;
  tenantId: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  specialInstructions: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CardFormData {
  name: string;
  address: string;
  phone: string;
  email: string;
  specialInstructions: string;
}

const emptyForm: CardFormData = { name: "", address: "", phone: "", email: "", specialInstructions: "" };

function authHeaders() {
  const s = getAdminSession();
  return s?.token ? { "x-admin-token": s.token, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

export default function ContactCards() {
  const { toast } = useToast();
  const [cards, setCards] = useState<ContactCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<ContactCard | null>(null);
  const [form, setForm] = useState<CardFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchCards = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/contact-cards`, { headers: authHeaders() });
      if (!res.ok) throw new Error();
      setCards(await res.json());
    } catch {
      toast({ title: "Failed to load contact cards", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCards(); }, []);

  const openCreate = () => { setEditingCard(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (card: ContactCard) => {
    setEditingCard(card);
    setForm({
      name: card.name,
      address: card.address ?? "",
      phone: card.phone ?? "",
      email: card.email ?? "",
      specialInstructions: card.specialInstructions ?? "",
    });
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
      if (!res.ok) throw new Error();
      toast({ title: "Contact card deleted" });
      fetchCards();
    } catch {
      toast({ title: "Failed to delete contact card", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Contact Cards</h2>
          <p className="text-muted-foreground mt-1">
            Create reusable contact cards with pickup location, phone, email, and special instructions. Assign them to listings — when a booking is approved, the renter automatically receives the card by email.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          New Card
        </Button>
      </div>

      {/* How it works banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <p className="font-semibold">How contact cards work</p>
          <p>
            When a booking is confirmed, the renter automatically receives an email containing the contact card assigned to that listing — including the pickup address, your phone number, email, and any special instructions.
            You'll also receive a notification with the renter's contact details so you can coordinate pickup.
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
                    <span className="line-clamp-3 text-xs leading-relaxed">{card.specialInstructions}</span>
                  </div>
                )}
                {!card.address && !card.phone && !card.email && !card.specialInstructions && (
                  <p className="text-xs text-muted-foreground italic">No details added yet</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCard ? "Edit Contact Card" : "New Contact Card"}</DialogTitle>
            <DialogDescription>
              This information is sent to renters when their booking is confirmed. The address is included for renters; your internal notification omits it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cc-name">Card name <span className="text-destructive">*</span></Label>
              <Input
                id="cc-name"
                placeholder="e.g., Main Location, Trailhead Parking Lot"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">A label to identify this card (not shown to renters)</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cc-address" className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                Pickup Address
              </Label>
              <Textarea
                id="cc-address"
                placeholder="123 Main St, Anytown, CA 90210"
                rows={2}
                value={form.address}
                onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cc-phone" className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-primary" />
                  Phone
                </Label>
                <Input
                  id="cc-phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc-email" className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-primary" />
                  Email
                </Label>
                <Input
                  id="cc-email"
                  type="email"
                  placeholder="info@yourcompany.com"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cc-instructions" className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                Special Instructions
              </Label>
              <Textarea
                id="cc-instructions"
                placeholder="e.g., Call 30 minutes before arrival. Park in the gravel lot on the left. Check in at the red barn."
                rows={4}
                value={form.specialInstructions}
                onChange={e => setForm(p => ({ ...p, specialInstructions: e.target.value }))}
              />
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
