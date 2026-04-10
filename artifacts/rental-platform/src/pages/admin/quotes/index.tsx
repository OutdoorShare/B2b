import { adminPath, getAdminSession } from "@/lib/admin-nav";
import { useState } from "react";
import { Link } from "wouter";
import { 
  useGetQuotes, 
  getGetQuotesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Send, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function AdminQuotes() {
  const { data: quotes, isLoading } = useGetQuotes({
    query: { queryKey: getGetQuotesQueryKey() }
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [sendingId, setSendingId] = useState<number | null>(null);

  const sendQuote = async (id: number, email: string) => {
    setSendingId(id);
    try {
      const session = getAdminSession();
      const resp = await fetch(`${BASE}/api/quotes/${id}/send`, {
        method: "POST",
        headers: { "x-admin-token": session?.token ?? "" },
      });
      if (!resp.ok) throw new Error("send failed");
      await queryClient.invalidateQueries({ queryKey: getGetQuotesQueryKey() });
      toast({ title: "Quote sent!", description: `Emailed to ${email}` });
    } catch {
      toast({ title: "Failed to send quote", description: "Please try again.", variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'draft': return <Badge variant="secondary">Draft</Badge>;
      case 'sent': return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Sent</Badge>;
      case 'accepted': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Accepted</Badge>;
      case 'declined': return <Badge variant="destructive">Declined</Badge>;
      case 'expired': return <Badge variant="outline" className="text-muted-foreground">Expired</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Quotes</h2>
          <p className="text-muted-foreground mt-1">Manage custom quotes and proposals for customers</p>
        </div>
        <Link href={adminPath("/quotes/new")}>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Quote
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading quotes...</div>
          ) : quotes && quotes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Event Dates</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      QT-{quote.id.toString().padStart(4, '0')}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{quote.customerName}</div>
                      <div className="text-xs text-muted-foreground">{quote.customerEmail}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(quote.startDate), 'MMM d')} - {format(new Date(quote.endDate), 'MMM d, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {quote.items.length} item(s)
                    </TableCell>
                    <TableCell className="font-medium">${quote.totalPrice.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(quote.status)}</TableCell>
                    <TableCell>
                      {(quote.status === "draft" || quote.status === "sent") && (
                        <Button
                          size="sm"
                          variant={quote.status === "draft" ? "default" : "outline"}
                          disabled={sendingId === quote.id}
                          onClick={() => sendQuote(quote.id, quote.customerEmail)}
                          className="gap-1.5 text-xs h-8"
                        >
                          {sendingId === quote.id
                            ? <><Loader2 className="w-3 h-3 animate-spin" />Sending…</>
                            : <><Send className="w-3 h-3" />{quote.status === "sent" ? "Resend" : "Send"}</>
                          }
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-24 text-center flex flex-col items-center">
              <FileText className="w-12 h-12 text-muted mb-4" />
              <h3 className="text-lg font-medium mb-1">No quotes found</h3>
              <p className="text-muted-foreground mb-4">Create custom quotes for complex bookings or events.</p>
              <Link href={adminPath("/quotes/new")}>
                <Button variant="outline">Create your first quote</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
