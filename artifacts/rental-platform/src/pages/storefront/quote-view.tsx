import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Loader2, FileText, Mail, Phone, Calendar, CheckCircle2, XCircle, Package, CreditCard, ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const BRAND_GREEN = "#3ab549";

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft:    { label: "Draft",    cls: "bg-gray-100 text-gray-600 border border-gray-200" },
    sent:     { label: "Open",     cls: "bg-blue-50 text-blue-700 border border-blue-200" },
    accepted: { label: "Accepted", cls: "bg-green-50 text-green-700 border border-green-200" },
    declined: { label: "Declined", cls: "bg-red-50 text-red-700 border border-red-200" },
    expired:  { label: "Expired",  cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  };
  const cfg = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600 border border-gray-200" };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${cfg.cls}`}>{cfg.label}</span>
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
  const [logoError, setLogoError] = useState(false);

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f0f4f0" }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND_GREEN }} />
          <p className="text-sm text-gray-500">Loading your quote…</p>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#f0f4f0" }}>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-sm w-full text-center">
          <FileText className="w-14 h-14 text-gray-200 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Quote Not Found</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            This quote link may have expired or is no longer valid. Contact the business for a new quote.
          </p>
        </div>
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
  const listingAvailable: boolean = quote.listingAvailable ?? false;

  const logoUrl = !logoError && quote.companyLogoUrl ? quote.companyLogoUrl : null;

  function handleBookNow() {
    if (!firstListingId || !slug) return;
    const sfBase = `/${slug}`;
    const bookParams = new URLSearchParams({
      listingId: String(firstListingId),
      quoteId: String(quote.id),
      quoteTotal: String(totalPrice),
      ...(quote.startDate ? { startDate: quote.startDate } : {}),
      ...(quote.endDate   ? { endDate:   quote.endDate }   : {}),
      ...(quote.customerName  ? { quoteName:  quote.customerName }  : {}),
      ...(quote.customerEmail ? { quoteEmail: quote.customerEmail } : {}),
      ...(quote.customerPhone ? { quotePhone: quote.customerPhone } : {}),
    });
    setLocation(`${sfBase}/book?${bookParams.toString()}`);
  }

  return (
    <div className="min-h-screen" style={{ background: "#f0f4f0" }}>
      {/* ── Hero header ── */}
      <div style={{ background: `linear-gradient(135deg, #1a2332 0%, #243246 100%)` }} className="px-4 pt-10 pb-16">
        <div className="max-w-2xl mx-auto text-center">
          {/* Logo or company name */}
          <div className="mb-5 flex justify-center">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={quote.companyName ?? "Company"}
                className="h-14 max-w-[200px] object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: BRAND_GREEN }}
                >
                  <FileText className="w-5 h-5 text-white" />
                </div>
                {quote.companyName && (
                  <span className="text-white font-bold text-lg">{quote.companyName}</span>
                )}
              </div>
            )}
          </div>

          <p className="text-xs font-bold tracking-[0.2em] uppercase mb-2" style={{ color: BRAND_GREEN }}>
            Rental Quote
          </p>
          <h1 className="text-3xl font-black text-white tracking-tight mb-3">{quoteRef}</h1>
          <div className="flex justify-center">
            <StatusChip status={quote.status} />
          </div>

          {quote.validUntil && (
            <p className="mt-4 text-xs font-medium" style={{ color: "#fbbf24" }}>
              ⚠ Expires {quote.validUntil}
            </p>
          )}
        </div>
      </div>

      {/* ── Card content lifted over hero ── */}
      <div className="max-w-2xl mx-auto px-4 -mt-8 pb-12 space-y-4">

        {/* ── From / To ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {quote.companyName && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">From</p>
              <p className="font-bold text-gray-900 text-base">{quote.companyName}</p>
              {quote.companyEmail && (
                <a
                  href={`mailto:${quote.companyEmail}`}
                  className="text-sm mt-1 flex items-center gap-1.5 hover:underline"
                  style={{ color: BRAND_GREEN }}
                >
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  {quote.companyEmail}
                </a>
              )}
            </div>
          )}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Prepared for</p>
            <p className="font-bold text-gray-900 text-base">{quote.customerName}</p>
            {quote.customerEmail && (
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 flex-shrink-0" />{quote.customerEmail}
              </p>
            )}
            {quote.customerPhone && (
              <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 flex-shrink-0" />{quote.customerPhone}
              </p>
            )}
          </div>
        </div>

        {/* ── Dates ── */}
        {(quote.startDate || quote.endDate) && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />Rental Period
            </p>
            <div className="flex items-center gap-4">
              <div className="flex-1 text-center bg-gray-50 rounded-xl py-3 px-2">
                <p className="text-xs text-gray-400 mb-1">Pickup</p>
                <p className="font-bold text-gray-900 text-sm">{quote.startDate ?? "—"}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              <div className="flex-1 text-center bg-gray-50 rounded-xl py-3 px-2">
                <p className="text-xs text-gray-400 mb-1">Return</p>
                <p className="font-bold text-gray-900 text-sm">{quote.endDate ?? "—"}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Line Items ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Rental Items</p>
          </div>
          {items.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">No items on this quote</p>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Description</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Qty</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Days</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item: any, i: number) => {
                    if (item.type === "bundle") {
                      return (
                        <>
                          <tr key={`b-${i}`} style={{ background: "#f0fdf4" }}>
                            <td colSpan={3} className="px-5 py-3 text-sm font-bold" style={{ color: "#166534" }}>
                              <span className="flex items-center gap-2">
                                <Package className="w-3.5 h-3.5 inline-block flex-shrink-0" />
                                {item.name ?? "Bundle"}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right font-bold text-sm" style={{ color: "#166534" }}>${Number(item.subtotal).toFixed(2)}</td>
                          </tr>
                          {(item.bundleItems ?? []).map((si: any, si_i: number) => (
                            <tr key={`b-${i}-${si_i}`} style={{ background: "#f7fef7" }}>
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
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-gray-900 text-sm">
                            {item.listingTitle && item.listingTitle !== "Unknown" ? item.listingTitle : "Rental Item"}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5 sm:hidden">
                            {item.quantity}× · {item.days} day{item.days !== 1 ? "s" : ""} · ${Number(item.pricePerDay).toFixed(2)}/day
                          </p>
                        </td>
                        <td className="px-3 py-4 text-center text-sm text-gray-500 hidden sm:table-cell">{item.quantity}</td>
                        <td className="px-3 py-4 text-center text-sm text-gray-500 hidden sm:table-cell">{item.days}</td>
                        <td className="px-5 py-4 text-right font-bold text-gray-900 text-sm">${Number(item.subtotal).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Totals */}
              <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/80 space-y-2">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm font-semibold" style={{ color: BRAND_GREEN }}>
                    <span>Discount applied</span>
                    <span>−${discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black text-gray-900 pt-2 border-t border-gray-200">
                  <span>Rental Total</span>
                  <span>${totalPrice.toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-400 pt-1">Security deposit, fees &amp; protection plan added at checkout.</p>
              </div>
            </>
          )}
        </div>

        {/* ── Notes ── */}
        {quote.notes && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Notes from {quote.companyName ?? "the team"}</p>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}

        {/* ── Book CTA ── */}
        {canBook && firstListingId && (
          listingAvailable ? (
            <div
              className="rounded-2xl shadow-sm overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${BRAND_GREEN} 0%, #2d9e3a 100%)` }}
            >
              <div className="px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-white">
                  <p className="font-black text-lg leading-tight">Ready to lock it in?</p>
                  <p className="text-sm mt-1 text-white/80">
                    Rental total: <span className="font-bold text-white">${totalPrice.toFixed(2)}</span>
                    <span className="opacity-70 ml-1">+ deposit &amp; fees at checkout</span>
                  </p>
                </div>
                <Button
                  size="lg"
                  className="bg-white hover:bg-gray-50 font-black px-7 rounded-xl shrink-0 shadow-sm"
                  style={{ color: BRAND_GREEN }}
                  onClick={handleBookNow}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Book &amp; Pay Now
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-800 text-sm">Item no longer available</p>
                <p className="text-xs text-amber-700 mt-1">This item may have been updated or removed. Contact {quote.companyName ?? "the business"} to arrange your booking.</p>
                {quote.companyEmail && (
                  <a href={`mailto:${quote.companyEmail}`} className="text-xs font-semibold mt-2 inline-block hover:underline" style={{ color: "#b45309" }}>
                    Email us →
                  </a>
                )}
              </div>
            </div>
          )
        )}

        {/* ── Status callouts ── */}
        {quote.status === "accepted" && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-green-800 text-sm">Quote Accepted</p>
              <p className="text-green-700 text-xs mt-0.5">Thank you! Your booking is being processed.</p>
            </div>
          </div>
        )}
        {quote.status === "declined" && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-3">
            <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <div>
              <p className="font-bold text-red-800 text-sm">Quote Declined</p>
              <p className="text-red-700 text-xs mt-0.5">This quote has been declined. Please contact the business for assistance.</p>
            </div>
          </div>
        )}
        {quote.status === "expired" && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-3">
            <XCircle className="w-6 h-6 text-amber-500 flex-shrink-0" />
            <div>
              <p className="font-bold text-amber-800 text-sm">Quote Expired</p>
              <p className="text-amber-700 text-xs mt-0.5">This quote is no longer valid. Contact the business to request a new quote.</p>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">
          Questions? Contact <strong>{quote.companyName ?? "the business"}</strong> directly.
        </p>
      </div>
    </div>
  );
}
