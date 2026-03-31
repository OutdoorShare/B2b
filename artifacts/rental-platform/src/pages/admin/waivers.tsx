import { adminPath } from "@/lib/admin-nav";
import { useState } from "react";
import { useGetBookings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { FileSignature, Search, ChevronDown, ChevronUp, ExternalLink, Download } from "lucide-react";
import { format } from "date-fns";

export default function AdminWaivers() {
  const { data: bookings = [], isLoading } = useGetBookings({
    query: { queryKey: ["bookings-waivers"] }
  });

  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const signed = (bookings as any[]).filter((b: any) => !!b.agreementSignerName);

  const filtered = signed.filter((b: any) => {
    const q = search.toLowerCase();
    return (
      !q ||
      b.customerName?.toLowerCase().includes(q) ||
      b.customerEmail?.toLowerCase().includes(q) ||
      b.listingTitle?.toLowerCase().includes(q) ||
      String(b.id).includes(q)
    );
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading waivers…</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Signed Waivers & Agreements</h2>
        <p className="text-muted-foreground mt-1">
          All rental agreements signed by customers during the booking process.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer, listing, booking #…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1">
          {filtered.length} signed {filtered.length === 1 ? "agreement" : "agreements"}
        </Badge>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <FileSignature className="w-10 h-10 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">
              {signed.length === 0
                ? "No signed agreements yet. Agreements are captured when customers complete the booking flow."
                : "No agreements match your search."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered
            .sort((a: any, b: any) => new Date(b.agreementSignedAt ?? b.createdAt).getTime() - new Date(a.agreementSignedAt ?? a.createdAt).getTime())
            .map((booking: any) => (
              <Card key={booking.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-base">{booking.customerName}</span>
                        <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50 text-xs">
                          <FileSignature className="w-3 h-3 mr-1" />
                          Signed
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {booking.customerEmail}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {booking.agreementPdfPath && (
                        <a
                          href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/bookings/${booking.id}/agreement-pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={`rental-agreement-${booking.id}.pdf`}
                        >
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </Button>
                        </a>
                      )}
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Booking</div>
                        <Link href={adminPath(`/bookings/${booking.id}`)}>
                          <span className="text-sm font-medium text-primary hover:underline flex items-center gap-1 justify-end">
                            #{booking.id} <ExternalLink className="w-3 h-3" />
                          </span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground mb-0.5">Listing</div>
                      <div className="font-medium truncate">{booking.listingTitle}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-0.5">Rental Dates</div>
                      <div className="font-medium">
                        {format(new Date(booking.startDate), "MMM d")} – {format(new Date(booking.endDate), "MMM d, yyyy")}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-0.5">Signed By</div>
                      <div className="font-medium">{booking.agreementSignerName}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-0.5">Signed On</div>
                      <div className="font-medium">
                        {booking.agreementSignedAt
                          ? format(new Date(booking.agreementSignedAt), "MMM d, yyyy h:mm a")
                          : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Signature preview */}
                  {booking.agreementSignature && (
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Signature</div>
                        <div className="border rounded-lg bg-white p-2 inline-block">
                          <img
                            src={booking.agreementSignature}
                            alt="Customer signature"
                            className="max-h-10 w-auto max-w-[180px]"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {booking.agreementText && (
                    <>
                      <Separator />
                      <button
                        onClick={() => setExpandedId(expandedId === booking.id ? null : booking.id)}
                        className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        {expandedId === booking.id
                          ? <><ChevronUp className="w-4 h-4" /> Hide agreement text</>
                          : <><ChevronDown className="w-4 h-4" /> View full agreement text</>}
                      </button>
                      {expandedId === booking.id && (
                        <div className="text-xs text-muted-foreground leading-relaxed space-y-2 border rounded-lg p-4 bg-muted/40 max-h-72 overflow-y-auto">
                          {booking.agreementText.split("\n\n").filter(Boolean).map((p: string, i: number) => (
                            <p key={i}>{p}</p>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
