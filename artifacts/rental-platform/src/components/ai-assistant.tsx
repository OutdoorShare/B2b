import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, X, Send, Loader2, ChevronDown, Sparkles, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Role = "admin" | "renter";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolUsed?: string;
  isStreaming?: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  get_listings: "Looking up your listings…",
  update_listing: "Updating listing…",
  get_bookings: "Fetching bookings…",
  update_booking: "Updating booking…",
  get_business_settings: "Reading business settings…",
  update_business_settings: "Updating business settings…",
};

const STARTERS: Record<Role, string[]> = {
  admin: [
    "Show me my active listings",
    "What bookings are pending?",
    "How do I enable instant booking?",
    "How does the protection plan work?",
    "Turn on instant booking for me",
  ],
  renter: [
    "What does the protection plan cover?",
    "How do I pick up my rental?",
    "Can I cancel my booking?",
    "What happens if a product is damaged?",
    "How does the booking process work?",
  ],
};

function renderContent(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    // Bold **text**
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      // Inline code `code`
      return part.split(/(`[^`]+`)/g).map((p, k) => {
        if (p.startsWith("`") && p.endsWith("`")) {
          return <code key={k} className="bg-muted/60 dark:bg-slate-700/60 px-1 rounded text-xs font-mono">{p.slice(1, -1)}</code>;
        }
        return <span key={k}>{p}</span>;
      });
    });

    // Bullet points
    if (line.startsWith("- ") || line.startsWith("• ")) {
      return (
        <div key={i} className="flex gap-2 mt-0.5">
          <span className="text-muted-foreground shrink-0">•</span>
          <span>{parts}</span>
        </div>
      );
    }
    // Headers ## text
    if (line.startsWith("## ")) {
      return <div key={i} className="font-semibold mt-2 mb-0.5 text-sm">{line.slice(3)}</div>;
    }
    if (line.startsWith("# ")) {
      return <div key={i} className="font-bold mt-2 mb-1 text-base">{line.slice(2)}</div>;
    }
    if (line === "") return <div key={i} className="h-1" />;
    return <div key={i}>{parts}</div>;
  });
}

interface AIAssistantProps {
  role: Role;
  tenantSlug: string;
  companyName?: string;
  adminToken?: string;
  saToken?: string;
}

export function AIAssistant({ role, tenantSlug, companyName, adminToken, saToken }: AIAssistantProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [toolActivity, setToolActivity] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open && messages.length === 0) {
      const greeting = role === "admin"
        ? `Hi! I'm Roamio AI — I can help you manage ${companyName ?? "your rentals"}, answer questions about the platform, and make changes on your behalf. What can I help with?`
        : `Hi there! I'm the renter assistant for ${companyName ?? "this store"}. I can help with your booking, pickup and return, the protection plan, and general rental questions. For anything account or business related, please contact the company directly.`;
      setMessages([{ id: "0", role: "assistant", content: greeting }]);
    }
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: trimmed };
    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", isStreaming: true };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);
    setToolActivity(null);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-tenant-slug": tenantSlug,
    };
    if (adminToken) headers["x-admin-token"] = adminToken;
    if (saToken) headers["x-superadmin-token"] = saToken;

    abortRef.current = new AbortController();

    try {
      const allMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(`${BASE}/api/ai/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({ messages: allMessages, role, tenantSlug, companyName }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(part.slice(6));
            if (data.content) {
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: m.content + data.content }
                  : m
              ));
            }
            if (data.tool) {
              setToolActivity(TOOL_LABELS[data.tool] ?? `Using ${data.tool}…`);
            }
            if (data.done) {
              setToolActivity(null);
            }
            if (data.error) {
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: "Sorry, something went wrong. Please try again.", isStreaming: false }
                  : m
              ));
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: "Connection failed. Please try again.", isStreaming: false }
            : m
        ));
      }
    } finally {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, isStreaming: false } : m
      ));
      setStreaming(false);
      setToolActivity(null);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [messages, streaming, role, tenantSlug, companyName, adminToken, saToken]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const OS_GREEN = "#3ab549";

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "fixed bottom-5 right-5 z-50 w-13 h-13 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95",
          open && "rotate-0"
        )}
        style={{ background: OS_GREEN, width: 52, height: 52 }}
        aria-label="Open AI Assistant"
      >
        {open
          ? <X className="w-5 h-5 text-white" />
          : <Bot className="w-5.5 h-5.5 text-white" style={{ width: 22, height: 22 }} />
        }
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed bottom-20 right-5 z-50 w-[360px] max-w-[calc(100vw-2.5rem)] rounded-2xl shadow-2xl border bg-background flex flex-col",
            "animate-in slide-in-from-bottom-2 duration-200"
          )}
          style={{ height: 520, maxHeight: "calc(100dvh - 100px)" }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b rounded-t-2xl" style={{ background: "#1a2332" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: OS_GREEN }}>
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-none">Roamio AI</p>
              <p className="text-[10px] mt-0.5" style={{ color: OS_GREEN }}>
                {role === "admin" ? "Admin Assistant • Can make changes" : "Rental Assistant"}
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white transition-colors p-1 rounded">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
            {messages.map(msg => (
              <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 mr-2" style={{ background: "#1a2332" }}>
                    <Sparkles className="w-3 h-3" style={{ color: OS_GREEN }} />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "text-white rounded-br-sm"
                      : "bg-muted/60 dark:bg-slate-800/80 text-foreground rounded-bl-sm"
                  )}
                  style={msg.role === "user" ? { background: "#1a2332" } : {}}
                >
                  {msg.role === "assistant"
                    ? <div className="space-y-0.5">{renderContent(msg.content)}</div>
                    : msg.content
                  }
                  {msg.isStreaming && msg.content === "" && (
                    <div className="flex gap-1 py-1">
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: OS_GREEN, animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: OS_GREEN, animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: OS_GREEN, animationDelay: "300ms" }} />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Tool activity indicator */}
            {toolActivity && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pl-8">
                <Wrench className="w-3 h-3 animate-pulse shrink-0" style={{ color: OS_GREEN }} />
                <span>{toolActivity}</span>
              </div>
            )}
          </div>

          {/* Starter prompts — show only before first user message */}
          {messages.filter(m => m.role === "user").length === 0 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {STARTERS[role].slice(0, 3).map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-xs px-2.5 py-1 rounded-full border hover:border-primary hover:text-primary transition-colors text-muted-foreground bg-background"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Roamio AI…"
              rows={1}
              disabled={streaming}
              className="resize-none min-h-[38px] max-h-[100px] text-sm py-2 rounded-xl"
              style={{ height: "auto" }}
            />
            <Button
              size="icon"
              disabled={!input.trim() || streaming}
              onClick={() => sendMessage(input)}
              className="shrink-0 rounded-xl h-[38px] w-[38px]"
              style={{ background: OS_GREEN }}
            >
              {streaming
                ? <Loader2 className="w-4 h-4 animate-spin text-white" />
                : <Send className="w-4 h-4 text-white" />
              }
            </Button>
          </div>

          {/* Powered-by footer */}
          <div className="px-4 pb-2.5 text-center">
            <p className="text-[10px] text-muted-foreground/60">
              Powered by OutdoorShare AI • May make mistakes
            </p>
          </div>
        </div>
      )}
    </>
  );
}
