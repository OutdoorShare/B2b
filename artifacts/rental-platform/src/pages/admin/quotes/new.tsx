import { adminPath, getAdminSession } from "@/lib/admin-nav";
import { useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import {
  useGetListings,
  useCreateQuote,
  getGetListingsQueryKey,
  getGetQuotesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomerAutocomplete } from "@/components/customer-autocomplete";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Trash2, Plus, Send, FileText, Loader2, Package, X } from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type LineItem = { type?: "item"; listingId: number; quantity: number; pricePerDay: number };
type BundleSubItem = { listingId: number; quantity: number; pricePerDay: number };
type BundleItem = { type: "bundle"; name: string; bundleItems: BundleSubItem[]; bundlePrice?: number | null };
type AnyItem = LineItem | BundleItem;

export default function AdminQuotesNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const sendIntentRef = useRef(false);
  const [isSending, setIsSending] = useState(false);

  const { data: listings } = useGetListings(
    { status: "active" },
    { query: { queryKey: getGetListingsQueryKey({ status: "active" }) } }
  );

  const createQuote = useCreateQuote();

  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 3), 'yyyy-MM-dd'),
    notes: '',
    discount: 0
  });

  const [items, setItems] = useState<AnyItem[]>([]);
  const [selectedListingId, setSelectedListingId] = useState("");

  // Bundle dialog state
  const [bundleOpen, setBundleOpen] = useState(false);
  const [bundleName, setBundleName] = useState("");
  const [bundlePrice, setBundlePrice] = useState<string>("");
  const [bundleSubItems, setBundleSubItems] = useState<Array<{ listingId: string; quantity: number; pricePerDay: number }>>([
    { listingId: "", quantity: 1, pricePerDay: 0 }
  ]);

  const days = useMemo(() => {
    try {
      const diff = differenceInDays(new Date(formData.endDate), new Date(formData.startDate));
      return diff > 0 ? diff : 1;
    } catch { return 1; }
  }, [formData.startDate, formData.endDate]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      if (item.type === "bundle") {
        if (item.bundlePrice != null && item.bundlePrice > 0) return sum + item.bundlePrice;
        return sum + item.bundleItems.reduce((s, si) => s + si.pricePerDay * si.quantity * days, 0);
      }
      return sum + item.pricePerDay * item.quantity * days;
    }, 0);
  }, [items, days]);

  const total = useMemo(() => Math.max(0, subtotal - formData.discount), [subtotal, formData.discount]);

  // ─── Regular item ─────────────────────────────────────────────
  const addItem = () => {
    if (!selectedListingId) return;
    const listingId = parseInt(selectedListingId);
    const listing = listings?.find(l => l.id === listingId);
    if (listing && !items.some(i => i.type !== "bundle" && (i as LineItem).listingId === listingId)) {
      setItems(prev => [...prev, { listingId, quantity: 1, pricePerDay: listing.pricePerDay }]);
      setSelectedListingId("");
    }
  };

  const updateItem = (index: number, field: string, value: number) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeItem = (index: number) => setItems(prev => prev.filter((_, i) => i !== index));

  // ─── Bundle dialog ────────────────────────────────────────────
  const openBundleDialog = () => {
    setBundleName("");
    setBundlePrice("");
    setBundleSubItems([{ listingId: "", quantity: 1, pricePerDay: 0 }]);
    setBundleOpen(true);
  };

  const addBundleSubItem = () => setBundleSubItems(prev => [...prev, { listingId: "", quantity: 1, pricePerDay: 0 }]);
  const removeBundleSubItem = (i: number) => setBundleSubItems(prev => prev.filter((_, idx) => idx !== i));
  const updateBundleSubItem = (i: number, field: string, value: any) => {
    setBundleSubItems(prev => {
      const next = [...prev];
      if (field === "listingId") {
        const listing = listings?.find(l => l.id === parseInt(value));
        next[i] = { ...next[i], listingId: value, pricePerDay: listing?.pricePerDay ?? next[i].pricePerDay };
      } else {
        next[i] = { ...next[i], [field]: value };
      }
      return next;
    });
  };

  const bundleSubtotalPreview = useMemo(() => {
    return bundleSubItems.reduce((sum, si) => {
      if (!si.listingId) return sum;
      return sum + si.pricePerDay * si.quantity * days;
    }, 0);
  }, [bundleSubItems, days]);

  const confirmBundle = () => {
    if (!bundleName.trim()) { toast({ title: "Please enter a bundle name", variant: "destructive" }); return; }
    const valid = bundleSubItems.filter(si => si.listingId);
    if (valid.length === 0) { toast({ title: "Please add at least one listing to the bundle", variant: "destructive" }); return; }
    const bp = bundlePrice !== "" ? parseFloat(bundlePrice) : null;
    const bundle: BundleItem = {
      type: "bundle",
      name: bundleName.trim(),
      bundleItems: valid.map(si => ({
        listingId: parseInt(si.listingId),
        quantity: si.quantity,
        pricePerDay: si.pricePerDay,
      })),
      bundlePrice: bp != null && bp > 0 ? bp : null,
    };
    setItems(prev => [...prev, bundle]);
    setBundleOpen(false);
  };

  // ─── Submit ───────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { toast({ title: "Please add at least one item", variant: "destructive" }); return; }
    const shouldSend = sendIntentRef.current;
    createQuote.mutate(
      {
        data: {
          ...formData,
          items: items.map(item => {
            if (item.type === "bundle") {
              return { ...item, bundleItems: item.bundleItems.map(si => ({ ...si, days })) };
            }
            return { ...item, days };
          })
        }
      },
      {
        onSuccess: async (created) => {
          queryClient.invalidateQueries({ queryKey: getGetQuotesQueryKey() });
          if (shouldSend) {
            setIsSending(true);
            try {
              const session = getAdminSession();
              const resp = await fetch(`${BASE}/api/quotes/${created.id}/send`, {
                method: "POST",
                headers: { "x-admin-token": session?.token ?? "" },
              });
              if (!resp.ok) throw new Error("send failed");
              toast({ title: "Quote sent!", description: `Emailed to ${formData.customerEmail}` });
            } catch {
              toast({ title: "Quote saved but email failed to send", variant: "destructive" });
            } finally {
              setIsSending(false);
              sendIntentRef.current = false;
            }
          } else {
            toast({ title: "Quote saved as draft" });
          }
          setLocation(adminPath("/quotes"));
        },
        onError: () => {
          sendIntentRef.current = false;
          toast({ title: "Failed to create quote", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Create Quote</h2>
          <p className="text-muted-foreground mt-1">Build a custom proposal for a customer</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Customer Details */}
            <Card>
              <CardHeader><CardTitle>Customer Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <CustomerAutocomplete
                  name={formData.customerName}
                  email={formData.customerEmail}
                  phone={formData.customerPhone}
                  onChangeName={v => setFormData(d => ({ ...d, customerName: v }))}
                  onChangeEmail={v => setFormData(d => ({ ...d, customerEmail: v }))}
                  onChangePhone={v => setFormData(d => ({ ...d, customerPhone: v }))}
                  onSelectRenter={r => setFormData(d => ({ ...d, customerName: r.name, customerEmail: r.email, customerPhone: r.phone }))}
                />
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input id="startDate" type="date" value={formData.startDate}
                      onChange={e => setFormData(d => ({ ...d, startDate: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input id="endDate" type="date" value={formData.endDate}
                      onChange={e => setFormData(d => ({ ...d, endDate: e.target.value }))} required />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">Duration: {days} day(s)</div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Line Items</CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={openBundleDialog} className="gap-1.5">
                    <Package className="w-4 h-4" />Add Bundle
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-2">
                  <Select value={selectedListingId} onValueChange={setSelectedListingId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a listing to add..." />
                    </SelectTrigger>
                    <SelectContent>
                      {listings?.map(l => (
                        <SelectItem key={l.id} value={l.id.toString()}>{l.title} (${l.pricePerDay}/day)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" onClick={addItem} disabled={!selectedListingId}>
                    <Plus className="w-4 h-4 mr-2" />Add Item
                  </Button>
                </div>

                {items.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="w-24">Qty</TableHead>
                        <TableHead className="w-32">Rate/Day</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, index) => {
                        if (item.type === "bundle") {
                          const bItems = item.bundleItems;
                          const calcTotal = bItems.reduce((s, si) => s + si.pricePerDay * si.quantity * days, 0);
                          const displayTotal = (item.bundlePrice != null && item.bundlePrice > 0) ? item.bundlePrice : calcTotal;
                          return (
                            <>
                              <TableRow key={`bundle-${index}`} className="bg-green-50/60 dark:bg-green-950/20">
                                <TableCell colSpan={3} className="font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
                                  <Package className="w-3.5 h-3.5 flex-shrink-0" />
                                  {item.name}
                                  {item.bundlePrice != null && item.bundlePrice > 0 && (
                                    <span className="text-xs font-normal text-muted-foreground ml-2">(flat bundle price)</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-bold">${displayTotal.toFixed(2)}</TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" type="button"
                                    onClick={() => removeItem(index)}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                              {bItems.map((si, si_idx) => {
                                const listing = listings?.find(l => l.id === si.listingId);
                                return (
                                  <TableRow key={`bundle-${index}-item-${si_idx}`} className="bg-green-50/20 dark:bg-green-950/10">
                                    <TableCell className="pl-8 text-sm text-muted-foreground">↳ {listing?.title ?? `Listing #${si.listingId}`}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground text-center">{si.quantity}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">${si.pricePerDay}/day</TableCell>
                                    <TableCell className="text-right text-sm text-muted-foreground">
                                      ${(si.pricePerDay * si.quantity * days).toFixed(2)}
                                    </TableCell>
                                    <TableCell></TableCell>
                                  </TableRow>
                                );
                              })}
                            </>
                          );
                        }

                        const listing = listings?.find(l => l.id === item.listingId);
                        const itemSubtotal = item.pricePerDay * item.quantity * days;
                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{listing?.title || 'Unknown'}</TableCell>
                            <TableCell>
                              <Input type="number" min="1" value={item.quantity}
                                onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                                className="h-8 p-1" />
                            </TableCell>
                            <TableCell>
                              <Input type="number" min="0" step="0.01" value={item.pricePerDay}
                                onChange={e => updateItem(index, 'pricePerDay', parseFloat(e.target.value) || 0)}
                                className="h-8 p-1" />
                            </TableCell>
                            <TableCell className="text-right">${itemSubtotal.toFixed(2)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" type="button"
                                onClick={() => removeItem(index)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                    Add individual items or a bundle package to this quote.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent>
                <Textarea value={formData.notes}
                  onChange={e => setFormData(d => ({ ...d, notes: e.target.value }))}
                  placeholder="Additional terms, instructions, or internal notes..."
                  rows={4} />
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <Card>
                <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Items Subtotal ({days} days)</span>
                    <span className="font-medium">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discount" className="text-muted-foreground">Custom Discount ($)</Label>
                    <Input id="discount" type="number" min="0" step="0.01"
                      value={formData.discount || ''}
                      onChange={e => setFormData(d => ({ ...d, discount: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div className="pt-4 border-t flex justify-between items-center text-lg font-bold">
                    <span>Total Quote</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col gap-2 mt-4">
                    <Button type="submit" size="lg"
                      disabled={createQuote.isPending || isSending || items.length === 0 || !formData.customerEmail.trim()}
                      onClick={() => { sendIntentRef.current = true; }}
                      className="w-full font-bold gap-2">
                      {(createQuote.isPending || isSending) && sendIntentRef.current
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</>
                        : <><Send className="w-4 h-4" />Save & Send Quote</>}
                    </Button>
                    <Button type="submit" variant="outline" size="lg"
                      disabled={createQuote.isPending || isSending || items.length === 0}
                      onClick={() => { sendIntentRef.current = false; }}
                      className="w-full gap-2">
                      {createQuote.isPending && !sendIntentRef.current
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                        : <><FileText className="w-4 h-4" />Save as Draft</>}
                    </Button>
                    {!formData.customerEmail.trim() && (
                      <p className="text-xs text-muted-foreground text-center">Add a customer email to send</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </form>

      {/* Bundle Dialog */}
      <Dialog open={bundleOpen} onOpenChange={setBundleOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />Create Bundle Package
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="bundleName">Bundle Name</Label>
              <Input id="bundleName" value={bundleName} onChange={e => setBundleName(e.target.value)}
                placeholder="e.g. Weekend Adventure Package" />
            </div>

            <div className="space-y-3">
              <Label>Items in this bundle</Label>
              {bundleSubItems.map((si, i) => (
                <div key={i} className="flex items-end gap-2 p-3 rounded-lg bg-muted/40 border border-border">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">Listing</Label>
                    <Select value={si.listingId} onValueChange={v => updateBundleSubItem(i, "listingId", v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select listing…" />
                      </SelectTrigger>
                      <SelectContent>
                        {listings?.map(l => (
                          <SelectItem key={l.id} value={l.id.toString()}>{l.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-16 space-y-1">
                    <Label className="text-xs text-muted-foreground">Qty</Label>
                    <Input type="number" min="1" value={si.quantity} className="h-9 p-2"
                      onChange={e => updateBundleSubItem(i, "quantity", parseInt(e.target.value) || 1)} />
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs text-muted-foreground">$/day</Label>
                    <Input type="number" min="0" step="0.01" value={si.pricePerDay} className="h-9 p-2"
                      onChange={e => updateBundleSubItem(i, "pricePerDay", parseFloat(e.target.value) || 0)} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive flex-shrink-0"
                    onClick={() => removeBundleSubItem(i)} disabled={bundleSubItems.length === 1}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addBundleSubItem} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />Add Another Item
              </Button>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Calculated total ({days} day{days !== 1 ? "s" : ""})</span>
                <span className="font-semibold">${bundleSubtotalPreview.toFixed(2)}</span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bundlePrice" className="text-sm font-medium">
                  Bundle Price Override <span className="text-muted-foreground font-normal">(optional — replaces calculated total)</span>
                </Label>
                <Input id="bundlePrice" type="number" min="0" step="0.01" value={bundlePrice}
                  onChange={e => setBundlePrice(e.target.value)}
                  placeholder={`e.g. ${(bundleSubtotalPreview * 0.9).toFixed(2)} (10% off)`} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setBundleOpen(false)}>Cancel</Button>
            <Button type="button" onClick={confirmBundle} className="gap-2">
              <Package className="w-4 h-4" />Add Bundle to Quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
