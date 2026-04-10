import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, MapPin, Phone, Mail, FileText, Pencil, Trash2, IdCard, Info, Lightbulb,
  Link2, QrCode, Copy, Check, X, ExternalLink
} from "lucide-react";
import { getAdminSession } from "@/lib/admin-nav";
import { ContactCardDialog } from "@/components/contact-card-dialog";
import type { ContactCard } from "@/components/contact-card-dialog";
import QRCode from "react-qr-code";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function handleUnauthorized() {
  fetch(`${BASE}/api/admin/auth/logout`, { method: "POST" }).catch(() => {});
  localStorage.removeItem("admin_session");
  window.location.reload();
}

function authHeaders() {
  const s = getAdminSession();
  return s?.token ? { "x-admin-token": s.token, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

function hasPrepGuide(card: ContactCard) {
  return !!(card.prepWhatToWear || card.prepWhatToBring || card.prepVehicleTowRating || card.prepAdditionalTips);
}

function getCardUrl(slug: string, cardId: number): string {
  return `${window.location.origin}${BASE}/${slug}/contact-card/${cardId}`;
}

function QrPanel({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const svgRef = useRef<HTMLDivElement>(null);

  const copyLink = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadQr = () => {
    const svg = svgRef.current?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "contact-card-qr.svg";
    a.click();
  };

  return (
    <div className="absolute inset-0 z-10 bg-white rounded-xl flex flex-col p-4 shadow-lg border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          <QrCode className="w-4 h-4 text-primary" /> Share Contact Card
        </span>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-muted-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* QR code */}
      <div ref={svgRef} className="flex justify-center mb-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
        <QRCode value={url} size={140} bgColor="#f9fafb" fgColor="#1a2332" />
      </div>

      {/* Link */}
      <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 mb-3">
        <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-[11px] text-gray-600 truncate flex-1">{url}</span>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={copyLink}
          className="flex flex-col items-center gap-1 p-2 rounded-xl bg-gray-50 hover:bg-green-50 hover:border-green-200 border border-gray-100 transition-all text-xs font-semibold text-gray-600 hover:text-green-700"
        >
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy"}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 p-2 rounded-xl bg-gray-50 hover:bg-blue-50 hover:border-blue-200 border border-gray-100 transition-all text-xs font-semibold text-gray-600 hover:text-blue-700"
        >
          <ExternalLink className="w-4 h-4" />
          Open
        </a>
        <button
          onClick={downloadQr}
          className="flex flex-col items-center gap-1 p-2 rounded-xl bg-gray-50 hover:bg-purple-50 hover:border-purple-200 border border-gray-100 transition-all text-xs font-semibold text-gray-600 hover:text-purple-700"
        >
          <QrCode className="w-4 h-4" />
          Save QR
        </button>
      </div>
    </div>
  );
}

export default function ContactCards() {
  const { toast } = useToast();
  const [cards, setCards] = useState<ContactCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<ContactCard | null>(null);
  const [businessAddress, setBusinessAddress] = useState<string | null>(null);
  const [businessPhone, setBusinessPhone] = useState<string | null>(null);
  const [businessEmail, setBusinessEmail] = useState<string | null>(null);
  const [qrOpenId, setQrOpenId] = useState<number | null>(null);

  const tenantSlug = getAdminSession()?.tenantSlug ?? "";

  useEffect(() => {
    const s = getAdminSession();
    const headers: Record<string, string> = {};
    if (s?.token) headers["x-admin-token"] = s.token;
    fetch(`${BASE}/api/business`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.address) setBusinessAddress(data.address);
        if (data?.phone)   setBusinessPhone(data.phone);
        if (data?.email)   setBusinessEmail(data.email);
      })
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
    setDialogOpen(true);
  };

  const openEdit = (card: ContactCard) => {
    setEditingCard(card);
    setDialogOpen(true);
  };

  const handleSaved = (saved: ContactCard) => {
    setCards(prev => {
      const idx = prev.findIndex(c => c.id === saved.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${BASE}/api/contact-cards/${id}`, { method: "DELETE", headers: authHeaders() });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) throw new Error();
      toast({ title: "Contact card deleted" });
      setCards(prev => prev.filter(c => c.id !== id));
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
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Each card has a shareable link and QR code you can print or text to renters. Assign a card to a listing by editing the listing and selecting a contact card at the bottom of the form.
          </p>
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
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      title="Share / QR Code"
                      onClick={() => setQrOpenId(qrOpenId === card.id ? null : card.id)}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </Button>
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
              <CardContent className="pt-4 space-y-2.5 text-sm relative">
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

                {/* QR / Share overlay */}
                {qrOpenId === card.id && tenantSlug && (
                  <QrPanel
                    url={getCardUrl(tenantSlug, card.id)}
                    onClose={() => setQrOpenId(null)}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ContactCardDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingCard={editingCard}
        onSaved={handleSaved}
        businessAddress={businessAddress}
        businessPhone={businessPhone}
        businessEmail={businessEmail}
      />
    </div>
  );
}
