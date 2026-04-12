import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Loader2, FileText, Mail, Phone, Calendar, CheckCircle2, XCircle, Package, CreditCard, ArrowRight, AlertTriangle, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const BRAND_GREEN = "#3ab549";
const BRAND_DARK  = "#1a2332";

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; dot: string; cls: string }> = {
    draft:    { label: "Draft",    dot: "bg-gray-400",   cls: "bg-gray-100 text-gray-600 border border-gray-200" },
    sent:     { label: "Open",     dot: "bg-blue-500",   cls: "bg-blue-50 text-blue-700 border border-blue-200" },
    accepted: { label: "Accepted", dot: "bg-green-500",  cls: "bg-green-50 text-green-700 border border-green-200" },
    declined: { label: "Declined", dot: "bg-red-400",    cls: "bg-red-50 text-red-700 border border-red-200" },
    expired:  { label: "Expired",  dot: "bg-amber-400",  cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  };
  const cfg = map[status] ?? { label: status, dot: "bg-gray-400", cls: "bg-gray-100 text-gray-600 border border-gray-200" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
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

function initials(name?: string) {
  if (!name) return "Q";
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#eef2ee" }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND_GREEN }} />
          <p className="text-sm text-gray-500 font-medium">Loading your quote…</p>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#eef2ee" }}>
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-gray-300" />
          </div>
          <h1 className="text-xl font-black text-gray-800 mb-2">Quote Not Found</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            This quote link may have expired or is no longer valid. Contact the business for a new quote.
          </p>
        </div>
      </div>
    );
  }

  const items: any[] = Array.isArray(quote.items) ? quote.items : [];
  const subtotal   = Number(quote.subtotal   ?? 0);
  const discount   = Number(quote.discount   ?? 0);
  const totalPrice = Number(quote.totalPrice ?? 0);
  const quoteRef   = `QT-${String(quote.id).padStart(4, "0")}`;
  const canBook    = quote.status === "sent" || quote.status === "draft";
  const firstListingId   = getFirstListingId(items);
  const listingAvailable = quote.listingAvailable ?? false;
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
    <div className="min-h-screen" style={{ background: "#eef2ee" }}>

      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(140deg, ${BRAND_DARK} 0%, #243650 60%, #1e3a2e 100%)` }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-[0.06]" style={{ background: BRAND_GREEN }} />
        <div className="absolute -bottom-12 -left-16 w-64 h-64 rounded-full opacity-[0.05]" style={{ background: BRAND_GREEN }} />
        <div className="absolute top-1/2 right-1/4 w-4 h-4 rounded-full opacity-20" style={{ background: BRAND_GREEN }} />
        <div className="absolute top-1/3 left-1/3 w-2 h-2 rounded-full opacity-15" style={{ background: "#fbbf24" }} />

        <div className="relative max-w-2xl mx-auto px-4 pt-12 pb-20 text-center">

          {/* Logo or initials avatar */}
          <div className="mb-6 flex justify-center">
            {logoUrl ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/20">
                <img
                  src={logoUrl}
                  alt={quote.companyName ?? "Company"}
                  className="h-12 max-w-[180px] object-contain"
                  onError={() => setLogoError(true)}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg border border-white/20"
                  style={{ background: `linear-gradient(135deg, ${BRAND_GREEN}, #2d9e3a)` }}
                >
                  {initials(quote.companyName)}
                </div>
                {quote.companyName && (
                  <span className="text-white/80 font-semibold text-sm tracking-wide">{quote.companyName}</span>
                )}
              </div>
            )}
          </div>

          {/* Quote label */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="h-px w-8 opacity-30" style={{ background: BRAND_GREEN }} />
            <p className="text-xs font-black tracking-[0.25em] uppercase" style={{ color: BRAND_GREEN }}>
              Rental Quote
            </p>
            <div className="h-px w-8 opacity-30" style={{ background: BRAND_GREEN }} />
          </div>

          <h1 className="text-4xl font-black text-white tracking-tight mb-4 drop-shadow-sm">{quoteRef}</h1>

          <div className="flex justify-center mb-4">
            <StatusChip status={quote.status} />
          </div>

          {quote.validUntil && (
            <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>
              <Clock className="w-3 h-3" />
              Expires {quote.validUntil}
            </div>
          )}
        </div>

        {/* Wave bottom */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden leading-none">
          <svg viewBox="0 0 1440 48" preserveAspectRatio="none" className="w-full block" style={{ height: 48 }}>
            <path d="M0,32 C360,0 1080,64 1440,24 L1440,48 L0,48 Z" fill="#eef2ee" />
          </svg>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-2xl mx-auto px-4 -mt-2 pb-12 space-y-4">

        {/* ── From / To ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quote.companyName && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full" style={{ background: BRAND_GREEN }} />
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">From</p>
              </div>
              <p className="font-black text-gray-900 text-base mb-1">{quote.companyName}</p>
              {quote.companyEmail && (
                <a
                  href={`mailto:${quote.companyEmail}`}
                  className="text-sm mt-1 flex items-center gap-1.5 font-medium hover:underline"
                  style={{ color: BRAND_GREEN }}
                >
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  {quote.companyEmail}
                </a>
              )}
            </div>
          )}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 rounded-full bg-blue-400 rounded-full" />
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Prepared for</p>
            </div>
            <p className="font-black text-gray-900 text-base mb-1">{quote.customerName}</p>
            {quote.customerEmail && (
              <p className="text-sm text-gray-500 flex items-center gap-1.5">
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#f0fdf4" }}>
                <Calendar className="w-3.5 h-3.5" style={{ color: BRAND_GREEN }} />
              </div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Rental Period</p>
            </div>
            <div className="flex items-stretch gap-3">
              <div className="flex-1 rounded-xl p-3 text-center border-2" style={{ borderColor: "#e8f5ea", background: "#f7fdf8" }}>
                <p className="text-xs font-bold mb-1" style={{ color: BRAND_GREEN }}>Pickup</p>
                <p className="font-black text-gray-900 text-sm">{quote.startDate ?? "—"}</p>
              </div>
              <div className="flex items-center">
                <ArrowRight className="w-4 h-4 text-gray-300" />
              </div>
              <div className="flex-1 rounded-xl p-3 text-center border-2" style={{ borderColor: "#e8f5ea", background: "#f7fdf8" }}>
                <p className="text-xs font-bold mb-1" style={{ color: BRAND_GREEN }}>Return</p>
                <p className="font-black text-gray-900 text-sm">{quote.endDate ?? "—"}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Line Items ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-2 border-b border-gray-100">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#f0fdf4" }}>
              <Package className="w-3.5 h-3.5" style={{ color: BRAND_GREEN }} />
            </div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Rental Items</p>
          </div>

          {items.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">No items on this quote</p>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th className="text-left px-5 py-3 text-xs font-black text-gray-400 uppercase tracking-wide">Description</th>
                    <th className="text-center px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wide hidden sm:table-cell">Qty</th>
                    <th className="text-center px-3 py-3 text-xs font-black text-gray-400 uppercase tracking-wide hidden sm:table-cell">Days</th>
                    <th className="text-right px-5 py-3 text-xs font-black text-gray-400 uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item: any, i: number) => {
                    if (item.type === "bundle") {
                      return (
                        <>
                          <tr key={`b-${i}`} style={{ background: "#f0fdf4" }}>
                            <td colSpan={3} className="px-5 py-3 text-sm font-black" style={{ color: "#166534" }}>
                              <span className="flex items-center gap-2">
                                <Package className="w-3.5 h-3.5 flex-shrink-0" />
                                {item.name ?? "Bundle"}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right font-black text-sm" style={{ color: "#166534" }}>${Number(item.subtotal).toFixed(2)}</td>
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
                      <tr key={i} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-bold text-gray-900 text-sm">
                            {item.listingTitle && item.listingTitle !== "Unknown" ? item.listingTitle : "Rental Item"}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5 sm:hidden">
                            {item.quantity}× · {item.days} day{item.days !== 1 ? "s" : ""} · ${Number(item.pricePerDay).toFixed(2)}/day
                          </p>
                        </td>
                        <td className="px-3 py-4 text-center text-sm text-gray-500 hidden sm:table-cell">{item.quantity}</td>
                        <td className="px-3 py-4 text-center text-sm text-gray-500 hidden sm:table-cell">{item.days}</td>
                        <td className="px-5 py-4 text-right font-black text-gray-900 text-sm">${Number(item.subtotal).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Totals */}
              <div className="border-t border-gray-100 px-5 py-4 space-y-2" style={{ background: "#f9fafb" }}>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm font-bold items-center gap-2">
                    <span className="flex items-center gap-1.5" style={{ color: BRAND_GREEN }}>
                      <span className="text-xs px-2 py-0.5 rounded-full font-black" style={{ background: "#dcfce7", color: "#166534" }}>DISCOUNT</span>
                      applied
                    </span>
                    <span style={{ color: BRAND_GREEN }}>−${discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="font-black text-gray-900">Rental Total</span>
                  <span
                    className="text-2xl font-black"
                    style={{ color: BRAND_DARK }}
                  >
                    ${totalPrice.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-gray-400 pt-0.5">Security deposit, fees &amp; protection plan added at checkout.</p>
              </div>
            </>
          )}
        </div>

        {/* ── Notes ── */}
        {quote.notes && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#fffbeb" }}>
                <FileText className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Notes from {quote.companyName ?? "the team"}</p>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}

        {/* ── Book CTA ── */}
        {canBook && firstListingId && (
          listingAvailable ? (
            <div
              className="rounded-2xl overflow-hidden shadow-md relative"
              style={{ background: `linear-gradient(135deg, ${BRAND_GREEN} 0%, #2d9e3a 50%, #1e7a2a 100%)` }}
            >
              {/* Decorative */}
              <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full opacity-10 bg-white" />
              <div className="absolute bottom-0 left-8 w-16 h-16 rounded-full opacity-10 bg-white" />

              <div className="relative px-6 py-7">
                <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Your quote is ready</p>
                <p className="font-black text-white text-2xl leading-tight mb-1">Ready to lock it in?</p>
                <p className="text-white/75 text-sm mb-5">
                  Rental total: <span className="text-white font-black text-base">${totalPrice.toFixed(2)}</span>
                  <span className="opacity-70 ml-1.5 text-xs">+ deposit &amp; fees at checkout</span>
                </p>
                <Button
                  size="lg"
                  className="bg-white hover:bg-gray-50 font-black px-7 rounded-xl shadow-sm w-full sm:w-auto text-base"
                  style={{ color: BRAND_GREEN }}
                  onClick={handleBookNow}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Book &amp; Pay Now
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="font-black text-amber-800 text-sm">Item no longer available</p>
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">This item may have been updated or removed. Contact {quote.companyName ?? "the business"} to arrange your booking.</p>
                {quote.companyEmail && (
                  <a href={`mailto:${quote.companyEmail}`} className="text-xs font-bold mt-2 inline-flex items-center gap-1 hover:underline" style={{ color: "#b45309" }}>
                    <Mail className="w-3 h-3" /> Email us →
                  </a>
                )}
              </div>
            </div>
          )
        )}

        {/* ── Status callouts ── */}
        {quote.status === "accepted" && (
          <div className="rounded-2xl p-5 flex items-center gap-3 border-2 border-green-200" style={{ background: "#f0fdf4" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#dcfce7" }}>
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-black text-green-800 text-sm">Quote Accepted</p>
              <p className="text-green-700 text-xs mt-0.5">Thank you! Your booking is being processed.</p>
            </div>
          </div>
        )}
        {quote.status === "declined" && (
          <div className="rounded-2xl p-5 flex items-center gap-3 border-2 border-red-200 bg-red-50">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="font-black text-red-800 text-sm">Quote Declined</p>
              <p className="text-red-700 text-xs mt-0.5">Please contact the business for assistance.</p>
            </div>
          </div>
        )}
        {quote.status === "expired" && (
          <div className="rounded-2xl p-5 flex items-center gap-3 border-2 border-amber-200 bg-amber-50">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <XCircle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="font-black text-amber-800 text-sm">Quote Expired</p>
              <p className="text-amber-700 text-xs mt-0.5">Contact the business to request a new quote.</p>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">
          Questions? Contact <strong className="text-gray-500">{quote.companyName ?? "the business"}</strong> directly.
        </p>
      </div>
    </div>
  );
}
