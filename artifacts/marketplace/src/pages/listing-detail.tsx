import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, MapPin, Building2, ExternalLink, ChevronLeft, ChevronRight,
  Calendar, Shield, Package, CheckCircle2, MessageCircle, Plus, Lock, X,
} from "lucide-react";
import { useAuth } from "@/context/auth";

const API_BASE = "/api";
const API_UPLOAD_BASE = "/api/uploads/";

function resolveImage(url: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const filename = url.split("/").pop() ?? "";
  return `${API_UPLOAD_BASE}${filename}`;
}

interface Addon {
  id: number;
  name: string;
  description: string | null;
  price: number;
  priceType: string;
  isRequired: boolean;
  isActive: boolean;
}

interface ProtectionPlan {
  enabled: boolean;
  feeAmount: string;
  categoryName?: string;
  categorySlug?: string;
}

async function fetchAddons(listingId: number): Promise<Addon[]> {
  const res = await fetch(`${API_BASE}/listings/${listingId}/addons`);
  if (!res.ok) return [];
  return res.json();
}

async function fetchProtection(categorySlug: string): Promise<ProtectionPlan> {
  const res = await fetch(`${API_BASE}/protection-plan/${encodeURIComponent(categorySlug)}`);
  if (!res.ok) return { enabled: false, feeAmount: "0" };
  return res.json();
}

async function sendMessage(body: {
  tenantSlug: string; tenantName: string; name: string; email: string; message: string;
}) {
  const res = await fetch(`${API_BASE}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      submitterType: "renter",
      submitterName: body.name,
      submitterEmail: body.email,
      subject: `Message from marketplace renter — ${body.tenantName}`,
      message: body.message,
      tenantSlug: body.tenantSlug,
      tenantName: body.tenantName,
    }),
  });
  if (!res.ok) throw new Error("Failed to send message");
}

function ContactModal({
  tenantSlug, tenantName, onClose,
}: { tenantSlug: string; tenantName: string; onClose: () => void }) {
  const { customer } = useAuth();
  const [name, setName] = useState(customer?.name ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  const handleSend = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      setErr("Please fill in all fields.");
      return;
    }
    setSending(true);
    setErr("");
    try {
      await sendMessage({ tenantSlug, tenantName, name, email, message });
      setSent(true);
    } catch {
      setErr("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative animate-in slide-in-from-bottom-4 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {sent ? (
          <div className="text-center py-6">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Message sent!</h3>
            <p className="text-sm text-gray-500 mb-5">
              Your message has been forwarded to <span className="font-medium">{tenantName}</span>.
              They'll reach out to you shortly.
            </p>
            <Button onClick={onClose} className="bg-primary hover:bg-primary/90 text-primary-foreground">Done</Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Message the Host</h3>
                <p className="text-xs text-gray-500">{tenantName}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Your name</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Your email</label>
                <input
                  type="email"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jane@email.com"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Message</label>
                <textarea
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                  rows={4}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Hi! I have a question about this listing…"
                />
              </div>
              {err && <p className="text-xs text-red-500">{err}</p>}
            </div>

            <Button
              className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? "Sending…" : "Send Message"}
            </Button>

            <p className="text-xs text-gray-400 text-center mt-3 flex items-center justify-center gap-1">
              <Lock className="h-3 w-3" /> Sent securely through OutdoorShare
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export function ListingDetailPage() {
  const [, params] = useRoute("/listings/:id");
  const [, setLocation] = useLocation();
  const [imgIndex, setImgIndex] = useState(0);
  const [contactOpen, setContactOpen] = useState(false);
  const id = parseInt(params?.id ?? "0");

  const { data: listing, isLoading, isError } = useQuery({
    queryKey: ["marketplace-listing", id],
    queryFn: () => api.marketplace.listing(id),
    enabled: !!id,
  });

  const categorySlug = listing?.category?.slug ?? "";

  const { data: addons = [] } = useQuery({
    queryKey: ["listing-addons", id],
    queryFn: () => fetchAddons(id),
    enabled: !!id && !!listing,
  });

  const { data: protection } = useQuery({
    queryKey: ["protection-plan", categorySlug],
    queryFn: () => fetchProtection(categorySlug),
    enabled: !!categorySlug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading listing…</p>
        </div>
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">😕</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Listing not found</h2>
          <Button variant="outline" onClick={() => setLocation("/")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Browse
          </Button>
        </div>
      </div>
    );
  }

  const images = (listing.imageUrls ?? []).filter(Boolean);
  const activeAddons = addons.filter(a => a.isActive);
  const requiredAddons = activeAddons.filter(a => a.isRequired);
  const optionalAddons = activeAddons.filter(a => !a.isRequired);
  const protectionEnabled = protection?.enabled && parseFloat(protection.feeAmount ?? "0") > 0;
  const protectionFee = protectionEnabled ? parseFloat(protection!.feeAmount) : 0;

  const handleBook = () => {
    const bookUrl = `/${listing.tenantSlug}/book?listingId=${listing.id}`;
    window.location.href = bookUrl;
  };

  const formatAddonPrice = (addon: Addon) => {
    if (addon.priceType === "per_day") return `$${addon.price.toFixed(0)}/day`;
    if (addon.priceType === "percent") return `${addon.price}%`;
    return `$${addon.price.toFixed(0)}`;
  };

  return (
    <>
      {contactOpen && listing && (
        <ContactModal
          tenantSlug={listing.tenantSlug}
          tenantName={listing.business.name}
          onClose={() => setContactOpen(false)}
        />
      )}

      <div className="min-h-screen bg-gray-50">
        {/* Back nav */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Browse
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* ── Left column ── */}
            <div className="lg:col-span-3 space-y-6">
              {/* Image gallery */}
              <div className="relative bg-gray-100 rounded-2xl overflow-hidden" style={{ aspectRatio: "16/10" }}>
                {images.length > 0 ? (
                  <>
                    <img
                      src={resolveImage(images[imgIndex])}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                    />
                    {images.length > 1 && (
                      <>
                        <button
                          onClick={() => setImgIndex(i => (i - 1 + images.length) % images.length)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur rounded-full p-2 shadow hover:bg-white transition"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => setImgIndex(i => (i + 1) % images.length)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur rounded-full p-2 shadow hover:bg-white transition"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                          {images.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setImgIndex(i)}
                              className={`h-1.5 rounded-full transition-all ${i === imgIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl">
                    {listing.categoryIcon || "🏕️"}
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary" />
              </div>

              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setImgIndex(i)}
                      className={`flex-shrink-0 h-16 w-20 rounded-lg overflow-hidden border-2 transition-all ${
                        i === imgIndex ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
                      }`}
                    >
                      <img src={resolveImage(img)} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Category */}
              {listing.category && (
                <div>
                  <Badge variant="secondary" className="gap-1">
                    {listing.category.icon && <span>{listing.category.icon}</span>}
                    {listing.category.name}
                  </Badge>
                </div>
              )}

              {/* Title + description */}
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-3">{listing.title}</h1>
                <p className="text-gray-600 leading-relaxed whitespace-pre-line">{listing.description}</p>
              </div>

              {/* Specs */}
              {(listing.brand || listing.model || listing.condition || listing.dimensions || listing.weight) && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" /> Details
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {listing.brand && <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-400">Brand</p><p className="font-medium text-gray-800">{listing.brand}</p></div>}
                    {listing.model && <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-400">Model</p><p className="font-medium text-gray-800">{listing.model}</p></div>}
                    {listing.condition && <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-400">Condition</p><p className="font-medium text-gray-800 capitalize">{listing.condition}</p></div>}
                    {listing.quantity > 1 && <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-400">Available</p><p className="font-medium text-gray-800">{listing.quantity} units</p></div>}
                  </div>
                </div>
              )}

              {/* Included items */}
              {listing.includedItems && listing.includedItems.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" /> What's Included
                  </h3>
                  <ul className="space-y-1.5">
                    {listing.includedItems.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Requirements */}
              {listing.requirements && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <Shield className="h-4 w-4" /> Requirements
                  </h3>
                  <p className="text-sm text-gray-600">{listing.requirements}</p>
                </div>
              )}

              {/* ── Protection Plan ── */}
              {protectionEnabled && (
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Shield className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-gray-900 text-sm">OutdoorShare Protection Plan</h3>
                        <span className="text-sm font-semibold text-primary">
                          ${protectionFee.toFixed(0)}/day
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Every booking through OutdoorShare includes our platform protection plan,
                        automatically applied at checkout. Coverage is applied per rental day.
                      </p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        <span className="text-xs text-gray-600">Automatically added at booking</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Add-ons ── */}
              {activeAddons.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Add-ons Available
                  </h3>
                  <div className="space-y-2">
                    {requiredAddons.map(addon => (
                      <div
                        key={addon.id}
                        className="flex items-start justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">{addon.name}</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800 border-0">
                              Required
                            </Badge>
                          </div>
                          {addon.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{addon.description}</p>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
                          {formatAddonPrice(addon)}
                        </span>
                      </div>
                    ))}
                    {optionalAddons.map(addon => (
                      <div
                        key={addon.id}
                        className="flex items-start justify-between gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-800">{addon.name}</span>
                          {addon.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{addon.description}</p>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-gray-700 flex-shrink-0">
                          +{formatAddonPrice(addon)}
                        </span>
                      </div>
                    ))}
                    <p className="text-xs text-gray-400 pl-1 pt-1">
                      Add-ons can be selected at checkout
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Right sidebar ── */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-6 sticky top-20 shadow-sm">
                {/* Price */}
                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-900">${parseFloat(listing.pricePerDay).toFixed(0)}</span>
                  <span className="text-gray-400 ml-1">/ day</span>
                  {listing.halfDayEnabled && listing.halfDayRate && (
                    <p className="text-sm text-gray-500 mt-1">Half day: ${parseFloat(listing.halfDayRate).toFixed(0)}</p>
                  )}
                  {listing.pricePerWeek && (
                    <p className="text-sm text-gray-500">Weekly: ${parseFloat(listing.pricePerWeek).toFixed(0)}</p>
                  )}
                </div>

                <Button
                  onClick={handleBook}
                  size="lg"
                  className="w-full font-semibold h-12 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Book Now
                </Button>

                {listing.depositAmount && parseFloat(listing.depositAmount) > 0 && (
                  <p className="text-xs text-gray-400 text-center mt-2">
                    ${parseFloat(listing.depositAmount).toFixed(0)} deposit required
                  </p>
                )}

                {/* Quick add-on summary */}
                {activeAddons.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {requiredAddons.slice(0, 2).map(a => (
                      <div key={a.id} className="flex items-center justify-between text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Plus className="h-3 w-3 text-amber-500" />{a.name} <span className="text-amber-600">(req.)</span></span>
                        <span>{formatAddonPrice(a)}</span>
                      </div>
                    ))}
                    {optionalAddons.length > 0 && (
                      <p className="text-xs text-gray-400">+ {optionalAddons.length} optional add-on{optionalAddons.length > 1 ? "s" : ""} available</p>
                    )}
                  </div>
                )}

                {/* Protection plan summary */}
                {protectionEnabled && (
                  <div className="flex items-center gap-1.5 mt-2 bg-primary/5 rounded-lg px-2.5 py-1.5">
                    <Shield className="h-3 w-3 text-primary flex-shrink-0" />
                    <span className="text-xs text-primary font-medium">Protection plan included — ${protectionFee.toFixed(0)}/day</span>
                  </div>
                )}

                <Separator className="my-5" />

                {/* Company info */}
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Listed by</p>
                  <div className="flex items-center gap-3 mb-3">
                    {listing.business.logoUrl ? (
                      <img
                        src={resolveImage(listing.business.logoUrl)}
                        alt={listing.business.name}
                        className="h-10 w-10 rounded-full object-cover border border-gray-100"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm bg-primary">
                        {listing.business.name[0]}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{listing.business.name}</p>
                      {listing.business.tagline && (
                        <p className="text-xs text-gray-500">{listing.business.tagline}</p>
                      )}
                    </div>
                  </div>

                  {(listing.business.city || listing.business.state) && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-2">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{[listing.business.city, listing.business.state].filter(Boolean).join(", ")}</span>
                    </div>
                  )}

                  {/* Message Host */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 mt-2 border-primary/30 text-primary hover:bg-primary/5"
                    onClick={() => setContactOpen(true)}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Message Host
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 mt-2"
                    onClick={() => window.open(`/${listing.tenantSlug}`, "_blank")}
                  >
                    <Building2 className="h-4 w-4" />
                    View Company
                    <ExternalLink className="h-3 w-3 ml-auto text-gray-400" />
                  </Button>
                </div>

                <Separator className="my-4" />
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  <span>Secure booking through OutdoorShare</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
