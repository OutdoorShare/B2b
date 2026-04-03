import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, ChevronDown, Loader2, Check, CheckCheck, User, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ChatMessage {
  id: number;
  threadId: number;
  senderType: "admin" | "renter";
  senderName: string;
  body: string;
  isReadByAdmin: boolean;
  isReadByRenter: boolean;
  createdAt: string;
}

interface Thread {
  id: number;
  customerEmail: string;
  customerName: string;
  subject: string | null;
  status: "open" | "closed";
  unreadByRenter: number;
  lastMessageAt: string;
}

interface GuestInfo { name: string; email: string; }

interface StorefrontChatProps {
  slug: string;
  companyName: string;
  customerEmail?: string;
  customerName?: string;
  primaryColor?: string;
  accentColor?: string;
}

const GUEST_KEY = (slug: string) => `chat_guest_${slug}`;

function loadGuest(slug: string): GuestInfo | null {
  try { const r = localStorage.getItem(GUEST_KEY(slug)); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
function saveGuest(slug: string, info: GuestInfo) {
  try { localStorage.setItem(GUEST_KEY(slug), JSON.stringify(info)); } catch {}
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function StorefrontChat({
  slug,
  companyName,
  customerEmail: propEmail = "",
  customerName: propName = "",
  primaryColor = "#3ab549",
}: StorefrontChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Guest identity — prefer logged-in account, fall back to saved guest info
  const [guestInfo, setGuestInfo] = useState<GuestInfo | null>(null);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestError, setGuestError] = useState("");
  const [pendingMsg, setPendingMsg] = useState("");

  const customerEmail = propEmail || guestInfo?.email || "";
  const customerName  = propName  || guestInfo?.name  || "";

  // Load saved guest identity on mount
  useEffect(() => {
    if (!propEmail) {
      const saved = loadGuest(slug);
      if (saved) setGuestInfo(saved);
    }
  }, [slug, propEmail]);

  const headers = { "x-tenant-slug": slug, "Content-Type": "application/json" };

  const fetchThread = useCallback(async () => {
    if (!customerEmail) return;
    try {
      const res = await fetch(
        `${BASE_URL}/api/chat/threads?email=${encodeURIComponent(customerEmail)}`,
        { headers },
      );
      if (!res.ok) return;
      const threads: Thread[] = await res.json();
      const openThread = threads.find(t => t.status === "open") ?? threads[0];
      if (!openThread) { setTotalUnread(0); return; }

      const unread = threads.reduce((sum, t) => sum + (t.unreadByRenter ?? 0), 0);
      setTotalUnread(unread);

      if (openThread.id !== activeThread?.id) setActiveThread(openThread);

      const msgRes = await fetch(`${BASE_URL}/api/chat/threads/${openThread.id}`, { headers });
      if (msgRes.ok) {
        const data = await msgRes.json();
        setMessages(data.messages ?? []);
        setActiveThread(data.thread);
      }
    } catch {}
  }, [customerEmail, slug, activeThread?.id]);

  useEffect(() => {
    if (!customerEmail) return;
    fetchThread();
    const interval = setInterval(fetchThread, 5000);
    return () => clearInterval(interval);
  }, [fetchThread]);

  // Mark as read when panel opens
  useEffect(() => {
    if (!open || !activeThread) return;
    setTotalUnread(0);
    fetch(`${BASE_URL}/api/chat/threads/${activeThread.id}/read`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ readerType: "renter" }),
    }).catch(() => {});
  }, [open, activeThread?.id]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (open) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [messages, open]);

  const doSend = async (email: string, name: string, body: string) => {
    setSending(true);
    try {
      if (!activeThread) {
        const res = await fetch(`${BASE_URL}/api/chat/threads`, {
          method: "POST",
          headers,
          body: JSON.stringify({ customerEmail: email, customerName: name, subject: "Chat", body }),
        });
        if (res.ok) await fetchThread();
      } else {
        const res = await fetch(`${BASE_URL}/api/chat/threads/${activeThread.id}/messages`, {
          method: "POST",
          headers,
          body: JSON.stringify({ senderType: "renter", senderName: name, body }),
        });
        if (res.ok) {
          const msg = await res.json();
          setMessages(prev => [...prev, msg]);
        }
      }
    } catch {}
    setSending(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    const body = text.trim();

    // If we don't know who they are, collect name + email first
    if (!customerEmail) {
      setPendingMsg(body);
      setGuestName("");
      setGuestEmail("");
      setGuestError("");
      setShowGuestForm(true);
      return;
    }

    setText("");
    await doSend(customerEmail, customerName, body);
  };

  const handleGuestSubmit = async () => {
    const name  = guestName.trim();
    const email = guestEmail.trim().toLowerCase();
    if (!name)  { setGuestError("Please enter your name."); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setGuestError("Please enter a valid email address.");
      return;
    }
    const info: GuestInfo = { name, email };
    saveGuest(slug, info);
    setGuestInfo(info);
    setShowGuestForm(false);
    const body = pendingMsg;
    setPendingMsg("");
    setText("");
    await doSend(email, name, body);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };
  const handleGuestKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleGuestSubmit();
  };

  // Group messages by date
  const groupedMessages: { date: string; msgs: ChatMessage[] }[] = [];
  let lastDate = "";
  for (const msg of messages) {
    const d = new Date(msg.createdAt).toDateString();
    if (d !== lastDate) { groupedMessages.push({ date: d, msgs: [] }); lastDate = d; }
    groupedMessages[groupedMessages.length - 1].msgs.push(msg);
  }

  const isClosed = activeThread?.status === "closed";

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-5 right-20 z-40 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{ width: 52, height: 52, backgroundColor: primaryColor }}
        aria-label={`Chat with ${companyName}`}
        title={`Chat with ${companyName}`}
      >
        {open
          ? <ChevronDown className="w-5 h-5 text-white" />
          : <MessageCircle className="w-5 h-5 text-white" />
        }
        {!open && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-0.5">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-20 right-20 z-40 w-[340px] max-w-[calc(100vw-2.5rem)] rounded-2xl shadow-2xl border border-border bg-white flex flex-col animate-in slide-in-from-bottom-2 duration-200"
          style={{ height: 480 }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 rounded-t-2xl shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">Chat with {companyName}</p>
                <p className="text-[10px] text-white/70">
                  {activeThread?.status === "open"
                    ? "● Typically replies quickly"
                    : activeThread?.status === "closed"
                    ? "Conversation closed"
                    : "Questions? We're here to help"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors shrink-0"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Guest identity form — shown inline when we need name/email */}
          {showGuestForm ? (
            <div className="flex-1 flex flex-col justify-center px-5 py-6 gap-4">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <p className="text-sm font-semibold text-gray-800">Before we continue</p>
                <p className="text-xs text-gray-500 mt-1">So {companyName} knows who they're talking to</p>
              </div>
              <div className="space-y-3">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Your name"
                    value={guestName}
                    onChange={e => setGuestName(e.target.value)}
                    onKeyDown={handleGuestKeyDown}
                    autoFocus
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-gray-300 bg-gray-50"
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="email"
                    placeholder="Your email"
                    value={guestEmail}
                    onChange={e => setGuestEmail(e.target.value)}
                    onKeyDown={handleGuestKeyDown}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-gray-300 bg-gray-50"
                  />
                </div>
                {guestError && (
                  <p className="text-xs text-red-500 text-center">{guestError}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowGuestForm(false); setPendingMsg(""); }}
                  className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGuestSubmit}
                  disabled={sending}
                  className="flex-1 py-2 text-sm text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Send Message"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 bg-gray-50/50">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                    <MessageCircle className="w-10 h-10 opacity-25" />
                    <p className="text-sm text-center">
                      Have a question? Send a message and {companyName} will get back to you.
                    </p>
                    {!customerEmail && (
                      <p className="text-xs text-center text-gray-400 bg-gray-100 rounded-lg px-3 py-2">
                        No account needed — just type your message below
                      </p>
                    )}
                  </div>
                )}
                {groupedMessages.map(group => (
                  <div key={group.date}>
                    <div className="flex items-center gap-2 my-3">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-[10px] text-gray-400 font-medium">
                        {formatDateGroup(group.msgs[0].createdAt)}
                      </span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    {group.msgs.map((msg, i) => {
                      const isRenter = msg.senderType === "renter";
                      const prevMsg = group.msgs[i - 1];
                      const isSameGroup = prevMsg &&
                        prevMsg.senderType === msg.senderType &&
                        (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 5 * 60 * 1000;

                      return (
                        <div
                          key={msg.id}
                          className={cn("flex", isRenter ? "justify-end" : "justify-start", isSameGroup ? "mt-0.5" : "mt-3")}
                        >
                          <div className={cn("max-w-[80%]", isRenter && "items-end flex flex-col")}>
                            {!isSameGroup && (
                              <p className={cn("text-[10px] text-gray-400 mb-1 px-1", isRenter ? "text-right" : "text-left")}>
                                {isRenter ? "You" : companyName} · {formatTime(msg.createdAt)}
                              </p>
                            )}
                            <div
                              className={cn(
                                "px-3.5 py-2 rounded-2xl text-sm leading-relaxed",
                                isRenter
                                  ? "text-white rounded-tr-sm"
                                  : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm",
                              )}
                              style={isRenter ? { backgroundColor: primaryColor } : {}}
                            >
                              {msg.body}
                            </div>
                            {isRenter && i === group.msgs.length - 1 && (
                              <div className="flex items-center gap-0.5 mt-0.5 px-1 justify-end">
                                {msg.isReadByAdmin
                                  ? <CheckCheck className="w-3 h-3 text-gray-400" />
                                  : <Check className="w-3 h-3 text-gray-300" />
                                }
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              {isClosed ? (
                <div className="px-4 py-3 border-t border-gray-100 text-center text-xs text-gray-500 bg-gray-50 rounded-b-2xl">
                  This conversation was closed by the team.
                </div>
              ) : (
                <div className="px-3 py-2.5 border-t border-gray-100 rounded-b-2xl bg-white shrink-0">
                  <div className="flex gap-2 items-end">
                    <textarea
                      ref={textareaRef}
                      value={text}
                      onChange={e => setText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={customerEmail ? "Type a message…" : "Type a message to get started…"}
                      rows={1}
                      className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder:text-gray-400 max-h-20"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!text.trim() || sending}
                      className="w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-40 transition-colors shrink-0 text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
