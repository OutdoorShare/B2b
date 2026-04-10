import { adminPath, getAdminSession, getAdminSlug } from "@/lib/admin-nav";
import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, Pencil, Copy, ExternalLink, Loader2, User, Mail, Phone, Calendar, FileText, Check } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { getGetQuotesQueryKey } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getStatusBadge(status: string) {
  switch (status) {
    case "draft":    return <Badge variant="secondary">Draft</Badge>;
    case "sent":     return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Sent</Badge>;
    case "accepted": return <Badge className="bg-green-600 hover:bg-green-700">Accepted</Badge>;
    case "declined": return <Badge variant="destructive">Declined</Badge>;
    case "expired":  return <Badge variant="outline" className="text-muted-foreground">Expired</Badge>;
    default:         return <Badge variant="outline">{status}</Badge>;
  }
}

export default function AdminQuoteDetail() {
  const params = useParams<{ slug: string; id: string }>();
  const id = params?.id ? parseInt(params.id) : 0;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [quote, setQuote] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const adminHeaders = useCallback(() => {
    const session = getAdminSession();
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.token) h["x-admin-token"] = session.token;
    return h;
  }, []);

  const fetchQuote = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${BASE}/api/quotes/${id}`, { headers: adminHeaders() });
      if (res.ok) setQuote(await res.json());
      else setQuote(null);
    } catch { setQuote(null); }
    finally { setIsLoading(false); }
  }, [id, adminHeaders]);

  useEffect(() => { fetchQuote(); }, [fetchQuote]);

  const sendQuote = async () => {
    if (!quote) return;
    setIsSending(true);
    try {
      const res = await fetch(`${BASE}/api/quotes/${id}/send`, {
        method: "POST",
        headers: adminHeaders(),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setQuote(updated);
      queryClient.invalidateQueries({ queryKey: getGetQuotesQueryKey() });
      toast({ title: "Quote sent!", description: `Emailed to ${quote.customerEmail}` });
    } catch {
      toast({ title: "Failed to send quote", variant: "destructive" });
    } finally { setIsSending(false); }
  };

  const copyLink = () => {
    const slug = getAdminSlug();
    const url = `${window.location.origin}/${slug}/quotes/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied!", description: url });
    });
  };

  const quoteRef = id ? `QT-${String(id).padStart(4, "0")}` : "";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium">Quote not found</p>
        <Button variant="ghost" className="mt-4" onClick={() => setLocation(adminPath("/quotes"))}>
          Back to Quotes
        </Button>
      </div>
    );
  }

  const items: any[] = Array.isArray(quote.items) ? quote.items : [];
  const subtotal = Number(quote.subtotal ?? 0);
  const discount = Number(quote.discount ?? 0);
  const totalPrice = Number(quote.totalPrice ?? 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation(adminPath("/quotes"))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight">{quoteRef}</h2>
              {getStatusBadge(quote.status)}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Created {format(new Date(quote.createdAt), "MMM d, yyyy")}
              {quote.updatedAt !== quote.createdAt && ` · Updated ${format(new Date(quote.updatedAt), "MMM d, yyyy")}`}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5">
            {copied ? <><Check className="w-3.5 h-3.5 text-green-600" />Copied!</> : <><Copy className="w-3.5 h-3.5" />Copy Link</>}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`${window.location.origin}/${getAdminSlug()}/quotes/${id}`, "_blank")}
            className="gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation(adminPath(`/quotes/${id}/edit`))}
            className="gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" />Edit
          </Button>
          <Button
            size="sm"
            disabled={isSending}
            onClick={sendQuote}
            className="gap-1.5"
          >
            {isSending
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Sending…</>
              : <><Send className="w-3.5 h-3.5" />{quote.status === "sent" ? "Resend" : "Send Quote"}</>
            }
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-semibold text-sm">{quote.customerName}</p>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="w-3.5 h-3.5" />{quote.customerEmail}
              </div>
              {quote.customerPhone && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Phone className="w-3.5 h-3.5" />{quote.customerPhone}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />Rental Dates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Start</p>
                  <p className="font-medium">{quote.startDate}</p>
                </div>
                <div className="text-muted-foreground">→</div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">End</p>
                  <p className="font-medium">{quote.endDate}</p>
                </div>
              </div>
              {quote.validUntil && (
                <p className="text-xs text-muted-foreground mt-3">
                  Valid until <strong>{quote.validUntil}</strong>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Line items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />Line Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground px-6 py-4">No items</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-6 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qty</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Days</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rate</th>
                      <th className="text-right px-6 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((item: any, i: number) => (
                      <tr key={i}>
                        <td className="px-6 py-3 font-medium">{item.listingTitle ?? "Item"}</td>
                        <td className="px-3 py-3 text-center text-muted-foreground">{item.quantity}</td>
                        <td className="px-3 py-3 text-center text-muted-foreground">{item.days}</td>
                        <td className="px-3 py-3 text-right text-muted-foreground">${Number(item.pricePerDay).toFixed(2)}/day</td>
                        <td className="px-6 py-3 text-right font-semibold">${Number(item.subtotal).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {quote.notes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{quote.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Summary */}
        <div>
          <Card className="sticky top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-green-600 font-medium">−${discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
                <span>Total</span>
                <span className="text-primary">${totalPrice.toFixed(2)}</span>
              </div>

              <div className="pt-4 space-y-2">
                <Button className="w-full gap-2" disabled={isSending} onClick={sendQuote}>
                  {isSending
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</>
                    : <><Send className="w-4 h-4" />{quote.status === "sent" ? "Resend Quote" : "Send Quote"}</>
                  }
                </Button>
                <Button variant="outline" className="w-full gap-2" onClick={() => setLocation(adminPath(`/quotes/${id}/edit`))}>
                  <Pencil className="w-4 h-4" />Edit Quote
                </Button>
                <Button variant="ghost" className="w-full gap-2" onClick={copyLink}>
                  {copied ? <><Check className="w-4 h-4 text-green-600" />Copied!</> : <><Copy className="w-4 h-4" />Copy Customer Link</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
