import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, MapPin, Clock, Users, ChevronLeft, ChevronRight,
  CheckCircle2, Package, Star, Building2, ExternalLink,
  MessageCircle, X, Send, Loader2, Lock, AlertCircle,
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

function fmtDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const CATEGORY_LABELS: Record<string, string> = {
  adventure: "Adventure", "water-sport": "Water Sport",
  "guided-tour": "Guided Tour", lesson: "Lesson",
  "wildlife-tour": "Wildlife Tour", "off-road": "Off-Road",
  camping: "Camping", climbing: "Climbing",
  "snow-sport": "Snow Sport", fishing: "Fishing", other: "Other",
};

const CATEGORY_ICONS: Record<string, string> = {
  adventure: "🏔️", "water-sport": "🌊", "guided-tour": "🧭",
  lesson: "📚", "wildlife-tour": "🦁", "off-road": "🚙",
  camping: "⛺", climbing: "🧗", "snow-sport": "🎿",
  fishing: "🎣", other: "🌿",
};

interface ChatMessage {
  id: number;
  senderType: "admin" | "renter";
  senderName: string;
  body: string;
  createdAt: string;
}

interface GuestInfo { name: string; email: string; }

function guestKey(slug: string) { return `os_chat_guest_${slug}`; }
function loadGuest(slug: string): GuestInfo | null {
  try { const r = localStorage.getItem(guestKey(slug)); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
function saveGuest(slug: string, info: GuestInfo) {
  try { localStorage.setItem(guestKey(slug), JSON.stringify(info)); } catch {}
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}
function formatDay(d: string) {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ChatPanel({
  tenantSlug, contactName, logoUrl, onClose,
}: { tenantSlug: string; contactName: string; logoUrl?: string | null; onClose: () => void }) {
  const { customer } = useAuth();
  type Phase = "guest_form" | "loading" | "chatting";
  const [phase, setPhase] = useState<Phase>("loading");
  const [gName, setGName] = useState("");
  const [gEmail, setGEmail] = useState("");
  const [gErr, setGErr] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const threadIdRef = { current: null as number | null };
  const identityRef = { current: null as GuestInfo | null };
  const tenantHeaders = { "x-tenant-slug": tenantSlug };

  const loadMessages = async (tid: number) => {
    try {
      const data = await fetch(`${API_BASE}/chat/threads/${tid}`, { headers: tenantHeaders }).then(r => r.json());
      if (Array.isArray(data.messages)) setMessages(data.messages);
    } catch {}
  };

  const initChat = async (email: string, name: string) => {
    setPhase("loading");
    identityRef.current = { email, name };
    try {
      const threads: { id: number }[] = await fetch(
        `${API_BASE}/chat/threads?email=${encodeURIComponent(email)}`,
        { headers: tenantHeaders },
      ).then(r => r.ok ? r.json() : []);
      if (Array.isArray(threads) && threads.length > 0) {
        threadIdRef.current = threads[0].id;
        await loadMessages(threads[0].id);
      }
    } catch {}
    setPhase("chatting");
  };

  useState(() => {
    if (customer) {
      initChat(customer.email, customer.name ?? customer.email);
    } else {
      const saved = loadGuest(tenantSlug);
      if (saved) { setGName(saved.name); setGEmail(saved.email); initChat(saved.email, saved.name); }
      else setPhase("guest_form");
    }
  });

  const handleGuestStart = () => {
    if (!gName.trim() || !gEmail.trim()) { setGErr("Please enter your name and email."); return; }
    setGErr("");
    saveGuest(tenantSlug, { name: gName.trim(), email: gEmail.trim() });
    initChat(gEmail.trim(), gName.trim());
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const identity = identityRef.current ?? (customer ? { email: customer.email, name: customer.name ?? customer.email } : null);
    if (!identity) return;
    setSending(true);
    setInput("");
    try {
      if (!threadIdRef.current) {
        const res = await fetch(`${API_BASE}/chat/threads`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...tenantHeaders },
          body: JSON.stringify({ customerEmail: identity.email, customerName: identity.name, body: text }),
        });
        if (!res.ok) throw new Error("Failed");
        const data: { threadId: number } = await res.json();
        threadIdRef.current = data.threadId;
        await loadMessages(data.threadId);
      } else {
        const res = await fetch(`${API_BASE}/chat/threads/${threadIdRef.current}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...tenantHeaders },
          body: JSON.stringify({ body: text, senderType: "renter", senderName: identity.name }),
        });
        if (!res.ok) throw new Error("Failed");
        await loadMessages(threadIdRef.current);
      }
    } catch { setInput(text); }
    finally { setSending(false); }
  };

  const grouped: { label: string; msgs: ChatMessage[] }[] = [];
  for (const m of messages) {
    const label = formatDay(m.createdAt);
    if (!grouped.length || grouped[grouped.length - 1].label !== label) grouped.push({ label, msgs: [m] });
    else grouped[grouped.length - 1].msgs.push(m);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col animate-in slide-in-from-bottom-4 duration-200"
        style={{ height: "min(560px, 90dvh)" }}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt={contactName} className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="h-4 w-4 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm leading-none truncate">{contactName}</p>
            <p className="text-xs text-gray-400 mt-0.5">Usually responds within a few hours</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors ml-2 flex-shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {phase === "guest_form" && (
            <div className="flex flex-col gap-4 pt-2">
              <p className="text-sm text-gray-600 text-center">Enter your info to inquire with <span className="font-medium">{contactName}</span>.</p>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Your name</label>
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  value={gName} onChange={e => setGName(e.target.value)} placeholder="Jane Smith" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Your email</label>
                <input type="email" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  value={gEmail} onChange={e => setGEmail(e.target.value)} placeholder="jane@email.com" />
              </div>
              {gErr && <p className="text-xs text-red-500 -mt-1">{gErr}</p>}
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground w-full" onClick={handleGuestStart}>Start Chat</Button>
              <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                <Lock className="h-3 w-3" /> Sent securely through OutdoorShare
              </p>
            </div>
          )}
          {phase === "loading" && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Loading…</p>
            </div>
          )}
          {phase === "chatting" && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400 py-8">
              <MessageCircle className="h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">No messages yet</p>
              <p className="text-xs text-center text-gray-400">Send a message to start the conversation.</p>
            </div>
          )}
          {phase === "chatting" && grouped.map(group => (
            <div key={group.label}>
              <div className="flex items-center gap-2 my-2">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400 font-medium px-1">{group.label}</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              {group.msgs.map(msg => {
                const isRenter = msg.senderType === "renter";
                return (
                  <div key={msg.id} className={`flex ${isRenter ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${isRenter ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-gray-100 text-gray-900 rounded-bl-sm"}`}>
                      {msg.body}
                      <div className={`text-[10px] mt-1 ${isRenter ? "text-primary-foreground/70 text-right" : "text-gray-400"}`}>
                        {formatTime(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {phase === "chatting" && (
          <div className="flex-shrink-0 border-t border-gray-100 px-3 py-2 flex items-end gap-2">
            <textarea
              className="flex-1 resize-none text-sm border-0 outline-none focus:ring-0 py-2 px-1 placeholder-gray-400 max-h-24"
              rows={1} placeholder={`Message ${contactName}…`}
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <button onClick={handleSend} disabled={!input.trim() || sending}
              className="flex-shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-40 transition-opacity mb-1">
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ExperienceDetailPage() {
  const [, params] = useRoute("/experiences/:id");
  const [, setLocation] = useLocation();
  const [imgIndex, setImgIndex] = useState(0);
  const [contactOpen, setContactOpen] = useState(false);
  const id = parseInt(params?.id ?? "0");

  const { data: activity, isLoading, isError } = useQuery({
    queryKey: ["marketplace-activity", id],
    queryFn: () => api.marketplace.activity(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading experience…</p>
        </div>
      </div>
    );
  }

  if (isError || !activity) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">😕</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Experience not found</h2>
          <Button variant="outline" onClick={() => setLocation("/experiences")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Experiences
          </Button>
        </div>
      </div>
    );
  }

  const images = (activity.imageUrls ?? []).filter(Boolean);
  const highlights = Array.isArray(activity.highlights) ? activity.highlights.filter(Boolean) : [];
  const categoryEmoji = CATEGORY_ICONS[activity.category] ?? "🌿";
  const categoryLabel = CATEGORY_LABELS[activity.category] ?? activity.category;

  const handleBook = () => {
    window.location.href = `/${activity.tenantSlug}`;
  };

  return (
    <>
      {contactOpen && (
        <ChatPanel
          tenantSlug={activity.tenantSlug}
          contactName={activity.tenantName}
          logoUrl={activity.businessLogoUrl}
          onClose={() => setContactOpen(false)}
        />
      )}

      <div className="min-h-screen bg-gray-50">
        {/* Back nav */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
            <button
              onClick={() => setLocation("/experiences")}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Experiences
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

            {/* ── Left column ── */}
            <div className="lg:col-span-3 space-y-6">

              {/* Photo gallery */}
              <div className="relative bg-gray-100 rounded-2xl overflow-hidden" style={{ aspectRatio: "16/10" }}>
                {images.length > 0 ? (
                  <>
                    <img
                      src={resolveImage(images[imgIndex])}
                      alt={activity.title}
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
                            <button key={i} onClick={() => setImgIndex(i)}
                              className={`h-1.5 rounded-full transition-all ${i === imgIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-8xl"
                    style={{ background: "linear-gradient(135deg, hsl(127,55%,92%) 0%, hsl(197,78%,92%) 100%)" }}>
                    {categoryEmoji}
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary" />
              </div>

              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <button key={i} onClick={() => setImgIndex(i)}
                      className={`flex-shrink-0 h-16 w-20 rounded-lg overflow-hidden border-2 transition-all ${
                        i === imgIndex ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
                      }`}>
                      <img src={resolveImage(img)} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Category badge */}
              <div>
                <Badge variant="secondary" className="gap-1 text-sm">
                  <span>{categoryEmoji}</span>
                  {categoryLabel}
                </Badge>
              </div>

              {/* Title */}
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">{activity.title}</h1>
                {activity.location && (
                  <p className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                    <MapPin className="h-4 w-4 shrink-0" /> {activity.location}
                  </p>
                )}
              </div>

              {/* Description */}
              {activity.description && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-2">About this experience</h3>
                  <p className="text-gray-600 leading-relaxed whitespace-pre-line">{activity.description}</p>
                </div>
              )}

              {/* Highlights / What's included */}
              {highlights.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" /> What's Included
                  </h3>
                  <ul className="space-y-2">
                    {highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* What to bring */}
              {activity.whatToBring && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" /> What to Bring
                  </h3>
                  <p className="text-gray-600 leading-relaxed whitespace-pre-line text-sm">{activity.whatToBring}</p>
                </div>
              )}

              {/* Min age notice */}
              {activity.minAge && activity.minAge > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  Minimum age requirement: <strong>{activity.minAge}+ years old</strong>
                </div>
              )}

              {/* Linked rental */}
              {activity.linkedListing && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Star className="h-4 w-4 text-primary" /> Recommended Rental Equipment
                  </h3>
                  <a
                    href={`/marketplace/listings/${activity.linkedListing.id}`}
                    className="group flex gap-4 bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-md hover:border-primary/30 transition-all"
                  >
                    {activity.linkedListing.imageUrls?.[0] ? (
                      <div className="h-20 w-24 rounded-xl overflow-hidden flex-shrink-0">
                        <img
                          src={resolveImage(activity.linkedListing.imageUrls[0])}
                          alt={activity.linkedListing.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className="h-20 w-24 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-3xl">🏕️</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-primary mb-0.5">Rental Equipment</p>
                      <p className="font-semibold text-gray-900 leading-tight group-hover:text-primary transition-colors">
                        {activity.linkedListing.title}
                      </p>
                      <p className="text-sm font-bold text-gray-700 mt-1">
                        ${activity.linkedListing.pricePerDay.toFixed(0)}<span className="font-normal text-gray-400">/day</span>
                      </p>
                      {activity.linkedListing.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{activity.linkedListing.description}</p>
                      )}
                    </div>
                  </a>
                </div>
              )}

              {/* Hosted by */}
              <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-200 p-4">
                {activity.businessLogoUrl ? (
                  <img src={resolveImage(activity.businessLogoUrl)} alt={activity.tenantName}
                    className="h-14 w-14 rounded-full object-cover border border-gray-100 flex-shrink-0" />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">Hosted by</p>
                  <p className="font-semibold text-gray-900">{activity.tenantName}</p>
                  {activity.businessTagline && (
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{activity.businessTagline}</p>
                  )}
                </div>
                <a href={`/${activity.tenantSlug}`} target="_blank" rel="noopener noreferrer"
                  className="flex-shrink-0 text-primary hover:text-primary/80 transition-colors">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>

            </div>

            {/* ── Right column — sticky booking card ── */}
            <div className="lg:col-span-2">
              <div className="sticky top-6 bg-white rounded-2xl border border-gray-200 shadow-lg p-6 space-y-5">

                {/* Price */}
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-gray-900">${activity.pricePerPerson.toFixed(0)}</span>
                  <span className="text-gray-500 mb-0.5">/ person</span>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-gray-400 mb-0.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="text-xs">Duration</span>
                    </div>
                    <p className="font-semibold text-gray-800 text-sm">{fmtDuration(activity.durationMinutes)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-gray-400 mb-0.5">
                      <Users className="h-3.5 w-3.5" />
                      <span className="text-xs">Group size</span>
                    </div>
                    <p className="font-semibold text-gray-800 text-sm">Up to {activity.maxCapacity}</p>
                  </div>
                  {activity.location && (
                    <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                      <div className="flex items-center gap-1.5 text-gray-400 mb-0.5">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="text-xs">Location</span>
                      </div>
                      <p className="font-semibold text-gray-800 text-sm">{activity.location}</p>
                    </div>
                  )}
                  {activity.minAge && activity.minAge > 0 && (
                    <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                      <div className="flex items-center gap-1.5 text-gray-400 mb-0.5">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span className="text-xs">Min. age</span>
                      </div>
                      <p className="font-semibold text-gray-800 text-sm">{activity.minAge}+ years old</p>
                    </div>
                  )}
                </div>

                {/* CTA buttons */}
                <div className="space-y-3 pt-1">
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base font-semibold"
                    onClick={handleBook}
                  >
                    Book Now
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-11 gap-2"
                    onClick={() => setContactOpen(true)}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Ask a Question
                  </Button>
                </div>

                <p className="text-xs text-gray-400 text-center">
                  Booking is handled directly with {activity.tenantName}
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
