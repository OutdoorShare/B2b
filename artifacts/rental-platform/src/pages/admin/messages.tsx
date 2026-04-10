import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { CustomerContactPopover } from "@/components/admin/customer-contact-popover";
import { getAdminSession, getAdminSlug } from "@/lib/admin-nav";
import {
  MessageCircle,
  Send,
  X,
  Check,
  CheckCheck,
  RefreshCw,
  ChevronLeft,
  Archive,
  RotateCcw,
  Search,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Thread {
  id: number;
  tenantId: number;
  customerEmail: string;
  customerName: string;
  subject: string | null;
  status: "open" | "closed";
  unreadByAdmin: number;
  unreadByRenter: number;
  lastMessageAt: string;
  createdAt: string;
}

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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function initials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function AdminMessages() {
  const slug = getAdminSlug();
  const session = getAdminSession();
  const adminToken = session?.token ?? "";

  const [, setLocation] = useLocation();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [search, setSearch] = useState("");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const headers = { "x-admin-token": adminToken, "Content-Type": "application/json" };

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/chat/threads`, { headers });
      if (res.ok) setThreads(await res.json());
    } catch {}
    setLoading(false);
  }, [adminToken]);

  const fetchMessages = useCallback(async (threadId: number) => {
    try {
      const res = await fetch(`${BASE_URL}/api/chat/threads/${threadId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
        setActiveThread(data.thread);
        // Mark as read
        fetch(`${BASE_URL}/api/chat/threads/${threadId}/read`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ readerType: "admin" }),
        }).catch(() => {});
        // Update local thread unread
        setThreads(prev => prev.map(t => t.id === threadId ? { ...t, unreadByAdmin: 0 } : t));
      }
    } catch {}
  }, [adminToken]);

  useEffect(() => {
    fetchThreads();
    const interval = setInterval(fetchThreads, 5000);
    return () => clearInterval(interval);
  }, [fetchThreads]);

  // Poll active thread for new messages
  useEffect(() => {
    if (!activeThread) return;
    const interval = setInterval(() => fetchMessages(activeThread.id), 5000);
    return () => clearInterval(interval);
  }, [activeThread?.id, fetchMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelectThread = (thread: Thread) => {
    setActiveThread(thread);
    fetchMessages(thread.id);
  };

  const handleSend = async () => {
    if (!replyText.trim() || !activeThread || sending) return;
    setSending(true);
    const body = replyText.trim();
    setReplyText("");

    try {
      const res = await fetch(`${BASE_URL}/api/chat/threads/${activeThread.id}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          senderType: "admin",
          senderName: session?.tenantName ?? "Support Team",
          body,
        }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => [...prev, msg]);
        setThreads(prev => prev.map(t =>
          t.id === activeThread.id ? { ...t, lastMessageAt: new Date().toISOString() } : t,
        ));
      }
    } catch {}
    setSending(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleToggleStatus = async () => {
    if (!activeThread) return;
    const newStatus = activeThread.status === "open" ? "closed" : "open";
    await fetch(`${BASE_URL}/api/chat/threads/${activeThread.id}/status`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: newStatus }),
    });
    setActiveThread(prev => prev ? { ...prev, status: newStatus } : prev);
    setThreads(prev => prev.map(t => t.id === activeThread.id ? { ...t, status: newStatus } : t));
  };

  const filteredThreads = threads.filter(t =>
    !search ||
    t.customerName.toLowerCase().includes(search.toLowerCase()) ||
    t.customerEmail.toLowerCase().includes(search.toLowerCase()) ||
    (t.subject ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  // Group messages by date
  const groupedMessages: { date: string; msgs: ChatMessage[] }[] = [];
  let lastDate = "";
  for (const msg of messages) {
    const d = new Date(msg.createdAt).toDateString();
    if (d !== lastDate) {
      groupedMessages.push({ date: d, msgs: [] });
      lastDate = d;
    }
    groupedMessages[groupedMessages.length - 1].msgs.push(msg);
  }

  return (
    <div className="flex h-[calc(100vh-128px)] border border-border rounded-xl overflow-hidden bg-card">
      {/* ── Thread list ─────────────────────────────────────── */}
      <div className="w-80 shrink-0 border-r border-border flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-foreground text-sm mb-2">Customer Messages</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading…
            </div>
          )}
          {!loading && filteredThreads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <MessageCircle className="w-8 h-8 opacity-30" />
              <p className="text-sm">No conversations yet</p>
            </div>
          )}
          {filteredThreads.map(thread => {
            const isActive = activeThread?.id === thread.id;
            const hasUnread = thread.unreadByAdmin > 0;
            return (
              <button
                key={thread.id}
                onClick={() => handleSelectThread(thread)}
                className={cn(
                  "w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex gap-3",
                  isActive && "bg-primary/5 border-l-2 border-primary",
                )}
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
                  {initials(thread.customerName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-1">
                    <CustomerContactPopover
                      customerName={thread.customerName}
                      customerEmail={thread.customerEmail}
                      className={cn("text-sm", hasUnread ? "font-semibold text-foreground" : "text-foreground/80")}
                    />
                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(thread.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-xs text-muted-foreground truncate flex-1">{thread.subject ?? "Chat"}</p>
                    {hasUnread && (
                      <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                        {thread.unreadByAdmin}
                      </span>
                    )}
                    {thread.status === "closed" && (
                      <span className="shrink-0 text-[9px] text-muted-foreground border border-border rounded px-1">closed</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Conversation ──────────────────────────────────────── */}
      {activeThread ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3 bg-card">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {initials(activeThread.customerName)}
              </div>
              <div className="min-w-0">
                <CustomerContactPopover
                  customerName={activeThread.customerName}
                  customerEmail={activeThread.customerEmail}
                  className="text-sm font-semibold text-foreground"
                />
                <p className="text-xs text-muted-foreground truncate">{activeThread.customerEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full border",
                activeThread.status === "open"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-gray-100 text-gray-500 border-gray-200",
              )}>
                {activeThread.status === "open" ? "● Open" : "Closed"}
              </span>
              <button
                onClick={handleToggleStatus}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2.5 py-1 transition-colors"
              >
                {activeThread.status === "open"
                  ? <><Archive className="w-3.5 h-3.5" /> Close</>
                  : <><RotateCcw className="w-3.5 h-3.5" /> Reopen</>
                }
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1 bg-muted/10">
            {groupedMessages.map(group => (
              <div key={group.date}>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {formatDateGroup(group.msgs[0].createdAt)}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                {group.msgs.map((msg, i) => {
                  const isAdmin = msg.senderType === "admin";
                  const prevMsg = group.msgs[i - 1];
                  const isSameGroup = prevMsg && prevMsg.senderType === msg.senderType &&
                    (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 5 * 60 * 1000;

                  return (
                    <div
                      key={msg.id}
                      className={cn("flex", isAdmin ? "justify-end" : "justify-start", isSameGroup ? "mt-0.5" : "mt-3")}
                    >
                      {!isAdmin && !isSameGroup && (
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mr-2 mt-1">
                          {initials(msg.senderName)}
                        </div>
                      )}
                      {!isAdmin && isSameGroup && <div className="w-9" />}
                      <div className={cn("max-w-[72%]", isAdmin && "items-end flex flex-col")}>
                        {!isSameGroup && (
                          <p className={cn("text-[10px] text-muted-foreground mb-1 px-1", isAdmin ? "text-right" : "text-left")}>
                            {isAdmin ? "You" : msg.senderName} · {formatTime(msg.createdAt)}
                          </p>
                        )}
                        <div className={cn(
                          "px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
                          isAdmin
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-white border border-border text-foreground rounded-tl-sm shadow-sm",
                        )}>
                          {msg.body}
                        </div>
                        {isAdmin && i === group.msgs.length - 1 && (
                          <div className={cn("flex items-center gap-0.5 mt-0.5 px-1", "justify-end")}>
                            {msg.isReadByRenter
                              ? <CheckCheck className="w-3 h-3 text-primary/60" />
                              : <Check className="w-3 h-3 text-muted-foreground/60" />
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

          {/* Reply box */}
          {activeThread.status === "open" ? (
            <div className="px-4 py-3 border-t border-border bg-card">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={textareaRef}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a reply… (Enter to send, Shift+Enter for new line)"
                  rows={2}
                  className="flex-1 resize-none rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                />
                <button
                  onClick={handleSend}
                  disabled={!replyText.trim() || sending}
                  className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-colors shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 px-1">
                The renter will receive an email notification with your reply.
              </p>
            </div>
          ) : (
            <div className="px-4 py-3 border-t border-border bg-muted/20 text-center text-sm text-muted-foreground">
              This conversation is closed.{" "}
              <button onClick={handleToggleStatus} className="text-primary underline">
                Reopen
              </button>{" "}
              to reply.
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground bg-muted/5">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <MessageCircle className="w-8 h-8 text-primary/60" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">Select a conversation</p>
            <p className="text-sm mt-1">Choose a thread from the left to start chatting</p>
          </div>
        </div>
      )}
    </div>
  );
}
