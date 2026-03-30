import { useState, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Trash2, Plus } from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";

export default function AdminQuotesNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const [items, setItems] = useState<Array<{listingId: number, quantity: number, pricePerDay: number}>>([]);
  const [selectedListingId, setSelectedListingId] = useState<string>("");

  const days = useMemo(() => {
    try {
      const diff = differenceInDays(new Date(formData.endDate), new Date(formData.startDate));
      return diff > 0 ? diff : 1;
    } catch {
      return 1;
    }
  }, [formData.startDate, formData.endDate]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.pricePerDay * item.quantity * days), 0);
  }, [items, days]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - formData.discount);
  }, [subtotal, formData.discount]);

  const addItem = () => {
    if (!selectedListingId) return;
    const listingId = parseInt(selectedListingId);
    const listing = listings?.find(l => l.id === listingId);
    
    if (listing && !items.find(i => i.listingId === listingId)) {
      setItems([...items, {
        listingId,
        quantity: 1,
        pricePerDay: listing.pricePerDay
      }]);
      setSelectedListingId("");
    }
  };

  const updateItem = (index: number, field: string, value: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (items.length === 0) {
      toast({ title: "Please add at least one item", variant: "destructive" });
      return;
    }

    createQuote.mutate(
      { 
        data: {
          ...formData,
          items: items.map(item => ({
            ...item,
            days
          }))
        } 
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetQuotesQueryKey() });
          toast({ title: "Quote created successfully" });
          setLocation("/admin/quotes");
        },
        onError: () => {
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
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Full Name</Label>
                  <Input 
                    id="customerName" 
                    value={formData.customerName} 
                    onChange={e => setFormData({...formData, customerName: e.target.value})} 
                    required 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customerEmail">Email</Label>
                    <Input 
                      id="customerEmail" 
                      type="email"
                      value={formData.customerEmail} 
                      onChange={e => setFormData({...formData, customerEmail: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customerPhone">Phone</Label>
                    <Input 
                      id="customerPhone" 
                      value={formData.customerPhone} 
                      onChange={e => setFormData({...formData, customerPhone: e.target.value})} 
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input 
                      id="startDate" 
                      type="date"
                      value={formData.startDate} 
                      onChange={e => setFormData({...formData, startDate: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input 
                      id="endDate" 
                      type="date"
                      value={formData.endDate} 
                      onChange={e => setFormData({...formData, endDate: e.target.value})} 
                      required 
                    />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">Duration: {days} day(s)</div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader>
                <CardTitle>Line Items</CardTitle>
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
                    <Plus className="w-4 h-4 mr-2" /> Add
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
                            <TableCell className="font-medium">{listing?.title || 'Unknown'}</TableCell>
                            <TableCell>
                              <Input 
                                type="number" 
                                min="1" 
                                value={item.quantity} 
                                onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                                className="h-8 p-1"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                type="number" 
                                min="0" 
                                step="0.01"
                                value={item.pricePerDay} 
                                onChange={e => updateItem(index, 'pricePerDay', parseFloat(e.target.value) || 0)}
                                className="h-8 p-1"
                              />
                            </TableCell>
                            <TableCell className="text-right">${itemSubtotal.toFixed(2)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(index)}>
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
                    No items added to quote yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea 
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})} 
                  placeholder="Additional terms, instructions, or internal notes..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Items Subtotal ({days} days)</span>
                    <span className="font-medium">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discount" className="text-muted-foreground">Custom Discount ($)</Label>
                    <Input 
                      id="discount"
                      type="number" 
                      min="0" 
                      step="0.01"
                      value={formData.discount || ''} 
                      onChange={e => setFormData({...formData, discount: parseFloat(e.target.value) || 0})} 
                    />
                  </div>
                  
                  <div className="pt-4 border-t flex justify-between items-center text-lg font-bold">
                    <span>Total Quote</span>
                    <span>${total.toFixed(2)}</span>
                  </div>

                  <Button type="submit" className="w-full mt-4" size="lg" disabled={createQuote.isPending || items.length === 0}>
                    {createQuote.isPending ? 'Saving...' : 'Save Draft Quote'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
