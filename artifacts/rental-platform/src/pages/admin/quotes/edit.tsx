import { adminPath, getAdminSession } from "@/lib/admin-nav";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useGetListings, getGetListingsQueryKey, getGetQuotesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomerAutocomplete } from "@/components/customer-autocomplete";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Trash2, Plus, Send, FileText, Loader2 } from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function AdminQuoteEdit() {
  const params = useParams<{ slug: string; id: string }>();
  const id = params?.id ? parseInt(params.id) : 0;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const sendIntentRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const { data: listings } = useGetListings(
    { status: "active" },
    { query: { queryKey: getGetListingsQueryKey({ status: "active" }) } }
  );

  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 3), 'yyyy-MM-dd'),
    notes: '',
    discount: 0,
    validUntil: '',
  });
  const [items, setItems] = useState<Array<{ listingId: number; quantity: number; pricePerDay: number }>>([]);
  const [selectedListingId, setSelectedListingId] = useState("");

  const adminHeaders = useCallback((): Record<string, string> => {
    const session = getAdminSession();
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.token) h["x-admin-token"] = session.token;
    return h;
  }, []);

  // Load existing quote
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`${BASE}/api/quotes/${id}`, { headers: adminHeaders() });
        if (!res.ok) return;
        const q = await res.json();
        setFormData({
          customerName: q.customerName ?? '',
          customerEmail: q.customerEmail ?? '',
          customerPhone: q.customerPhone ?? '',
          startDate: q.startDate ?? format(new Date(), 'yyyy-MM-dd'),
          endDate: q.endDate ?? format(addDays(new Date(), 3), 'yyyy-MM-dd'),
          notes: q.notes ?? '',
          discount: q.discount ?? 0,
          validUntil: q.validUntil ?? '',
        });
        const rawItems: any[] = Array.isArray(q.items) ? q.items : [];
        setItems(rawItems.map((i: any) => ({
          listingId: i.listingId,
          quantity: i.quantity ?? 1,
          pricePerDay: i.pricePerDay ?? 0,
        })));
      } catch { /* ignore */ }
      finally { setInitialLoading(false); }
    })();
  }, [id, adminHeaders]);

  const days = useMemo(() => {
    try {
      const diff = differenceInDays(new Date(formData.endDate), new Date(formData.startDate));
      return diff > 0 ? diff : 1;
    } catch { return 1; }
  }, [formData.startDate, formData.endDate]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.pricePerDay * item.quantity * days, 0),
    [items, days]
  );
  const total = useMemo(() => Math.max(0, subtotal - formData.discount), [subtotal, formData.discount]);

  const addItem = () => {
    if (!selectedListingId) return;
    const listingId = parseInt(selectedListingId);
    const listing = listings?.find(l => l.id === listingId);
    if (listing && !items.find(i => i.listingId === listingId)) {
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

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast({ title: "Please add at least one item", variant: "destructive" });
      return;
    }
    const shouldSend = sendIntentRef.current;
    setIsSaving(true);
    try {
      const body = {
        ...formData,
        items: items.map(i => ({ ...i, days })),
      };
      const res = await fetch(`${BASE}/api/quotes/${id}`, {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("save failed");
      queryClient.invalidateQueries({ queryKey: getGetQuotesQueryKey() });

      if (shouldSend) {
        setIsSending(true);
        try {
          const sendRes = await fetch(`${BASE}/api/quotes/${id}/send`, {
            method: "POST",
            headers: adminHeaders(),
          });
          if (!sendRes.ok) throw new Error("send failed");
          toast({ title: "Quote saved & sent!", description: `Emailed to ${formData.customerEmail}` });
        } catch {
          toast({ title: "Quote saved but email failed", variant: "destructive" });
        } finally { setIsSending(false); }
      } else {
        toast({ title: "Quote updated" });
      }
      setLocation(adminPath(`/quotes/${id}`));
    } catch {
      toast({ title: "Failed to update quote", variant: "destructive" });
    } finally {
      setIsSaving(false);
      sendIntentRef.current = false;
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation(adminPath(`/quotes/${id}`))}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Edit Quote</h2>
          <p className="text-muted-foreground mt-1">Update QT-{String(id).padStart(4, "0")}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Customer */}
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
              <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
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
                    <Plus className="w-4 h-4 mr-2" />Add
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
                        const listing = listings?.find(l => l.id === item.listingId);
                        const itemSubtotal = item.pricePerDay * item.quantity * days;
                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{listing?.title ?? `Listing #${item.listingId}`}</TableCell>
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
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                                type="button" onClick={() => removeItem(index)}>
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
                    No items added yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={formData.notes}
                  onChange={e => setFormData(d => ({ ...d, notes: e.target.value }))}
                  placeholder="Additional terms, instructions, or internal notes..."
                  rows={4}
                />
                <div className="space-y-2">
                  <Label htmlFor="validUntil">Quote Valid Until (optional)</Label>
                  <Input id="validUntil" type="date" value={formData.validUntil}
                    onChange={e => setFormData(d => ({ ...d, validUntil: e.target.value }))} />
                </div>
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
                    <Button
                      type="submit"
                      size="lg"
                      disabled={isSaving || isSending || items.length === 0 || !formData.customerEmail.trim()}
                      onClick={() => { sendIntentRef.current = true; }}
                      className="w-full font-bold gap-2"
                    >
                      {(isSaving || isSending) && sendIntentRef.current
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</>
                        : <><Send className="w-4 h-4" />Save & Send Quote</>}
                    </Button>
                    <Button
                      type="submit"
                      variant="outline"
                      size="lg"
                      disabled={isSaving || isSending || items.length === 0}
                      onClick={() => { sendIntentRef.current = false; }}
                      className="w-full gap-2"
                    >
                      {isSaving && !sendIntentRef.current
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                        : <><FileText className="w-4 h-4" />Save Changes</>}
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
    </div>
  );
}
