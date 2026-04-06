import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Trash2, Bot, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = "";

interface Message {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

interface Conversation {
  id: number;
  title: string;
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("**") && line.endsWith("**")) {
          return <p key={i} className="font-semibold">{line.slice(2, -2)}</p>;
        }
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <div key={i} className="flex gap-1">
              <span className="text-green-500 shrink-0">•</span>
              <span>{line.slice(2)}</span>
            </div>
          );
        }
        if (line === "") return <div key={i} className="h-1" />;
        const bold = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        return (
          <p key={i} dangerouslySetInnerHTML={{ __html: bold }} />
        );
      })}
    </div>
  );
}

export function OutdoorBot() {
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [msgs, streamingContent, scrollToBottom]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  async function startConversation(): Promise<Conversation | null> {
    try {
      const res = await fetch(`${API_BASE}/api/openai/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "OutdoorBot chat" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const conv = (await res.json()) as Conversation;
      setConversation(conv);

      // Add welcome message (ephemeral, not from DB)
      setMsgs([{
        id: "welcome",
        role: "assistant",
        content: "Hey adventurer! 🏕️ I'm OutdoorBot, your guide to the OutdoorShare marketplace. Ask me anything — gear recommendations, trip planning, booking help, and more!",
      }]);
      return conv;
    } catch (e: any) {
      setError("Couldn't start a conversation. Please try again.");
      return null;
    }
  }

  async function handleOpen() {
    setOpen(true);
    if (!conversation) {
      await startConversation();
    }
  }

  async function sendMessage() {
    if (!input.trim() || streaming) return;

    let conv = conversation;
    if (!conv) {
      conv = await startConversation();
      if (!conv) return;
    }

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
    };
    setMsgs((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);
    setStreamingContent("");
    setError(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`${API_BASE}/api/openai/conversations/${conv.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMsg.content }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(errBody.error ?? "Request failed");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data) continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.done) break;
            if (parsed.delta) {
              accumulated += parsed.delta;
              setStreamingContent(accumulated);
            }
          } catch (parseErr: any) {
            if (parseErr.message && !parseErr.message.includes("JSON")) {
              throw parseErr;
            }
          }
        }
      }

      setMsgs((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: "assistant", content: accumulated },
      ]);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message ?? "Something went wrong. Please try again.");
        setMsgs((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: "Sorry, I ran into an issue. Please try again!",
          },
        ]);
      }
    } finally {
      setStreaming(false);
      setStreamingContent("");
      abortRef.current = null;
    }
  }

  async function handleClear() {
    if (conversation) {
      try {
        await fetch(`${API_BASE}/api/openai/conversations/${conversation.id}`, {
          method: "DELETE",
        });
      } catch {}
    }
    setConversation(null);
    setMsgs([]);
    setInput("");
    setError(null);
    setStreaming(false);
    setStreamingContent("");
    await startConversation();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={open ? () => setOpen(false) : handleOpen}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-4 py-3 shadow-lg",
          "bg-[hsl(127,55%,38%)] hover:bg-[hsl(127,55%,33%)] text-white transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-[hsl(127,55%,38%)] focus:ring-offset-2",
          open && "opacity-0 pointer-events-none"
        )}
        aria-label="Open OutdoorBot"
      >
        <Bot className="size-5" />
        <span className="text-sm font-semibold">OutdoorBot</span>
      </button>

      {/* Chat panel */}
      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)]",
          "bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700",
          "flex flex-col overflow-hidden transition-all duration-300 origin-bottom-right",
          open
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        )}
        style={{ height: "520px" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-[hsl(127,55%,38%)] text-white shrink-0">
          <div className="flex items-center justify-center size-8 rounded-full bg-white/20">
            <Bot className="size-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold leading-tight">OutdoorBot</p>
            <p className="text-xs text-white/70 leading-tight">Your adventure guide</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleClear}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
              title="New conversation"
              disabled={streaming}
            >
              <Trash2 className="size-3.5" />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
              title="Close"
            >
              <ChevronDown className="size-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {msgs.length === 0 && !streaming && (
            <div className="flex flex-col items-center justify-center h-full text-center text-neutral-400 gap-3 py-8">
              <Bot className="size-10 text-[hsl(127,55%,38%)] opacity-40" />
              <p className="text-sm">Ask me anything about outdoor gear and adventures!</p>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {["Find camping gear", "Best kayak rentals?", "Plan a weekend trip"].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    className="text-xs px-3 py-1.5 rounded-full border border-[hsl(127,55%,38%)] text-[hsl(127,55%,38%)] hover:bg-[hsl(127,55%,38%)] hover:text-white transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex gap-2",
                m.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {m.role === "assistant" && (
                <div className="shrink-0 size-6 rounded-full bg-[hsl(127,55%,38%)] flex items-center justify-center mt-0.5">
                  <Bot className="size-3.5 text-white" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-[hsl(127,55%,38%)] text-white rounded-br-sm"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-bl-sm"
                )}
              >
                {m.role === "assistant" ? (
                  <MarkdownText text={m.content} />
                ) : (
                  <p>{m.content}</p>
                )}
              </div>
            </div>
          ))}

          {/* Streaming bubble */}
          {streaming && (
            <div className="flex gap-2 justify-start">
              <div className="shrink-0 size-6 rounded-full bg-[hsl(127,55%,38%)] flex items-center justify-center mt-0.5">
                <Bot className="size-3.5 text-white" />
              </div>
              <div className="max-w-[82%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 leading-relaxed">
                {streamingContent ? (
                  <MarkdownText text={streamingContent} />
                ) : (
                  <div className="flex gap-1 items-center h-4">
                    <span className="size-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="size-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="size-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="text-center text-xs text-red-500 mt-1">{error}</p>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-3 py-3 border-t border-neutral-200 dark:border-neutral-700 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about gear, trips, or rentals..."
              rows={1}
              disabled={streaming}
              className={cn(
                "flex-1 resize-none rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800",
                "px-3 py-2 text-sm outline-none focus:border-[hsl(127,55%,38%)] transition-colors",
                "min-h-[38px] max-h-[80px] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400",
                "disabled:opacity-50"
              )}
              style={{ fieldSizing: "content" } as any}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
              className={cn(
                "shrink-0 size-9 rounded-xl flex items-center justify-center transition-colors",
                input.trim() && !streaming
                  ? "bg-[hsl(127,55%,38%)] hover:bg-[hsl(127,55%,33%)] text-white"
                  : "bg-neutral-200 dark:bg-neutral-700 text-neutral-400 cursor-not-allowed"
              )}
            >
              <Send className="size-4" />
            </button>
          </div>
          <p className="text-center text-xs text-neutral-400 mt-2">Enter to send · Shift+Enter for newline</p>
        </div>
      </div>
    </>
  );
}
