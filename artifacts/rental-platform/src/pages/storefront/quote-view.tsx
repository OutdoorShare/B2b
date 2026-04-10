import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Loader2, FileText, Building2, Mail, Phone, Calendar, CheckCircle2, XCircle, Package, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft:    { label: "Draft",    cls: "bg-gray-100 text-gray-600" },
    sent:     { label: "Sent",     cls: "bg-blue-50 text-blue-700" },
    accepted: { label: "Accepted", cls: "bg-green-50 text-green-700" },
    declined: { label: "Declined", cls: "bg-red-50 text-red-700" },
    expired:  { label: "Expired",  cls: "bg-amber-50 text-amber-700" },
  };
  const cfg = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${cfg.cls}`}>{cfg.label}</span>
  );
}

function getFirstListingId(items: any[]): number | null {
  for (const item of items) {
    if (item.type === "bundle") {
      const sub = item.bundleItems ?? [];
      if (sub.length > 0 && sub[0].listingId) return Number(sub[0].listingId);
    } else if (item.listingId) {
      return Number(item.listingId);
    }
  }
  return null;
}

export default function StorefrontQuoteView() {
  const params = useParams<{ slug: string; id: string }>();
  const id = params?.id;
  const slug = params?.slug;
  const [, setLocation] = useLocation();

  const [quote, setQuote] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`${BASE}/api/public/quotes/${id}`);
        if (res.ok) setQuote(await res.json());
        else setQuote(null);
      } catch { setQuote(null); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <FileText className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-700 mb-2">Quote Not Found</h1>
        <p className="text-gray-500 text-sm text-center max-w-sm">
          This quote link may have expired or the reference is no longer valid. Contact the business for assistance.
        </p>
      </div>
    );
  }

  const items: any[] = Array.isArray(quote.items) ? quote.items : [];
  const subtotal = Number(quote.subtotal ?? 0);
  const discount = Number(quote.discount ?? 0);
  const totalPrice = Number(quote.totalPrice ?? 0);
  const quoteRef = `QT-${String(quote.id).padStart(4, "0")}`;

  const canBook = quote.status === "sent" || quote.status === "draft";
  const firstListingId = getFirstListingId(items);

  function handleBookNow() {
    if (!firstListingId || !slug) return;
    const sfBase = `/${slug}`;
    const params = new URLSearchParams({
      listingId: String(firstListingId),
      quoteId: String(quote.id),
      quoteTotal: String(totalPrice),
      ...(quote.startDate ? { startDate: quote.startDate } : {}),
      ...(quote.endDate   ? { endDate:   quote.endDate }   : {}),
      ...(quote.customerName  ? { quoteName:  quote.customerName }  : {}),
      ...(quote.customerEmail ? { quoteEmail: quote.customerEmail } : {}),
      ...(quote.customerPhone ? { quotePhone: quote.customerPhone } : {}),
    });
    setLocation(`${sfBase}/book?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header bar */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Rental Quote</p>
              <p className="font-bold text-gray-900 leading-tight">{quoteRef}</p>
            </div>
          </div>
          <StatusChip status={quote.status} />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Company + Customer cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {quote.companyName && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">From</span>
              </div>
              <p className="font-semibold text-gray-900">{quote.companyName}</p>
              {quote.companyEmail && (
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />{quote.companyEmail}
                </p>
              )}
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Prepared for</span>
            </div>
            <p className="font-semibold text-gray-900">{quote.customerName}</p>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />{quote.customerEmail}
            </p>
            {quote.customerPhone && (
              <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />{quote.customerPhone}
              </p>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rental Period</span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Start</p>
              <p className="font-semibold text-gray-900">{quote.startDate}</p>
            </div>
            <div className="text-gray-300 text-lg">→</div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">End</p>
              <p className="font-semibold text-gray-900">{quote.endDate}</p>
            </div>
          </div>
          {quote.validUntil && (
            <p className="text-xs text-amber-600 mt-3 font-medium">
              ⚠ This quote expires on {quote.validUntil}
            </p>
          )}
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rental Items</span>
          </div>
          {items.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">No items</p>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Qty</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Days</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item: any, i: number) => {
                    if (item.type === "bundle") {
                      return (
                        <>
                          <tr key={`b-${i}`} className="bg-green-50">
                            <td colSpan={3} className="px-5 py-3 font-semibold text-green-800 text-sm">
                              <span className="flex items-center gap-2">
                                <Package className="w-3.5 h-3.5 inline-block" />{item.name ?? "Bundle"}
                                {item.bundlePrice != null && item.bundlePrice > 0 && (
                                  <span className="text-xs font-normal text-gray-500">(bundle price)</span>
                                )}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right font-bold text-green-800 text-sm">${Number(item.subtotal).toFixed(2)}</td>
                          </tr>
                          {(item.bundleItems ?? []).map((si: any, si_i: number) => (
                            <tr key={`b-${i}-${si_i}`} className="bg-green-50/40">
                              <td className="px-5 py-2.5 pl-10 text-xs text-gray-500">↳ {si.listingTitle ?? "Item"}</td>
                              <td className="px-3 py-2.5 text-center text-xs text-gray-400 hidden sm:table-cell">{si.quantity}</td>
                              <td className="px-3 py-2.5 text-center text-xs text-gray-400 hidden sm:table-cell">{si.days}</td>
                              <td className="px-5 py-2.5 text-right text-xs text-gray-400">${Number(si.subtotal).toFixed(2)}</td>
                            </tr>
                          ))}
                        </>
                      );
                    }
                    return (
                      <tr key={i}>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-gray-900 text-sm">{item.listingTitle ?? "Item"}</p>
                          <p className="text-xs text-gray-400 mt-0.5 sm:hidden">
                            {item.quantity}× · {item.days} day{item.days !== 1 ? "s" : ""} · ${Number(item.pricePerDay).toFixed(2)}/day
                          </p>
                        </td>
                        <td className="px-3 py-3.5 text-center text-sm text-gray-500 hidden sm:table-cell">{item.quantity}</td>
                        <td className="px-3 py-3.5 text-center text-sm text-gray-500 hidden sm:table-cell">{item.days}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-gray-900 text-sm">${Number(item.subtotal).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Totals */}
              <div className="border-t border-gray-100 px-5 py-4 space-y-2 bg-gray-50">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600 font-medium">
                    <span>Discount</span>
                    <span>−${discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
                  <span>Rental Total</span>
                  <span>${totalPrice.toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-400 pt-1">Security deposit, applicable fees, and protection plan are added at checkout.</p>
              </div>
            </>
          )}
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Notes</p>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}

        {/* Pay Now CTA */}
        {canBook && firstListingId && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-900 text-base">Ready to book?</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Rental total: <span className="font-bold text-gray-800">${totalPrice.toFixed(2)}</span>
                  <span className="text-gray-400 ml-1">+ deposit, fees &amp; protection at checkout</span>
                </p>
              </div>
              <Button
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 rounded-xl shrink-0"
                onClick={handleBookNow}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Book &amp; Pay Now
              </Button>
            </div>
          </div>
        )}

        {/* Status callout */}
        {quote.status === "accepted" && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-800 text-sm">Quote Accepted</p>
              <p className="text-green-700 text-xs mt-0.5">Thank you! Your booking is being processed.</p>
            </div>
          </div>
        )}
        {quote.status === "declined" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center gap-3">
            <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-800 text-sm">Quote Declined</p>
              <p className="text-red-700 text-xs mt-0.5">This quote has been declined. Please contact the business for assistance.</p>
            </div>
          </div>
        )}
        {quote.status === "expired" && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-center gap-3">
            <XCircle className="w-6 h-6 text-amber-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">Quote Expired</p>
              <p className="text-amber-700 text-xs mt-0.5">This quote is no longer valid. Contact the business to request a new quote.</p>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">
          Questions? Reply to the quote email or contact the business directly.
        </p>
      </div>
    </div>
  );
}
