import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Mail, MessageSquare, Users, Send, Clock, CheckCircle2,
  Zap, ChevronDown, ChevronUp, History, Settings2, Filter,
  MailOpen, Phone, ToggleLeft, ToggleRight, Edit2, Check, X,
  ExternalLink, Search, User,
} from "lucide-react";
import { adminPath, getAdminSession } from "@/lib/admin-nav";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function adminHeaders(): HeadersInit {
  const s = getAdminSession();
  return s?.token ? { "x-admin-token": s.token } : {};
}
const OS_GREEN = "#3ab549";

type Filter = "all" | "future" | "active" | "past";
type Channel = "email" | "sms" | "both";

interface Renter {
  bookingId: number;
  name: string;
  email: string;
  phone?: string;
  status: string;
  startDate: string;
  endDate: string;
}

interface MessageLog {
  id: number;
  customerName: string;
  customerEmail: string;
  channel: string;
  subject?: string;
  body: string;
  trigger: string;
  status: string;
  sentAt: string;
}

interface Automation {
  id: number;
  trigger: string;
  name: string;
  description?: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  subject: string;
  bodyTemplate: string;
}

const FILTER_OPTIONS: { key: Filter; label: string; desc: string; color: string }[] = [
  { key: "all", label: "All Renters", desc: "Everyone who has booked", color: "#6b7280" },
  { key: "future", label: "Upcoming", desc: "Confirmed, hasn't started", color: "#3b82f6" },
  { key: "active", label: "Active Now", desc: "Currently renting", color: OS_GREEN },
  { key: "past", label: "Past", desc: "Completed rentals", color: "#8b5cf6" },
];

export default function CommunicationsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"compose" | "automations" | "history">("compose");

  // Compose state
  const [filter, setFilter] = useState<Filter>("all");
  const [renters, setRenters] = useState<Renter[]>([]);
  const [loadingRenters, setLoadingRenters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [recipientSearch, setRecipientSearch] = useState("");
  const [channel, setChannel] = useState<Channel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  // Automations state
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loadingAutomations, setLoadingAutomations] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Automation>>({});
  const [savingAuto, setSavingAuto] = useState(false);

  // History state
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    fetchRenters();
  }, [filter]);

  useEffect(() => {
    if (tab === "automations") fetchAutomations();
    if (tab === "history") fetchLogs();
  }, [tab]);

  async function fetchRenters() {
    setLoadingRenters(true);
    try {
      const res = await fetch(`${BASE}/api/communications/renters?filter=${filter}`, { headers: adminHeaders() });
      const data = await res.json();
      setRenters(Array.isArray(data) ? data : []);
      setSelectedIds(new Set((Array.isArray(data) ? data : []).map((r: Renter) => r.bookingId)));
    } catch { toast({ title: "Error", description: "Failed to load renters", variant: "destructive" }); }
    finally { setLoadingRenters(false); }
  }

  async function fetchAutomations() {
    setLoadingAutomations(true);
    try {
      const res = await fetch(`${BASE}/api/communications/automations`, { headers: adminHeaders() });
      const data = await res.json();
      setAutomations(Array.isArray(data) ? data : []);
    } catch { toast({ title: "Error", description: "Failed to load automations", variant: "destructive" }); }
    finally { setLoadingAutomations(false); }
  }

  async function fetchLogs() {
    setLoadingLogs(true);
    try {
      const res = await fetch(`${BASE}/api/communications/logs`, { headers: adminHeaders() });
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch { toast({ title: "Error", description: "Failed to load history", variant: "destructive" }); }
    finally { setLoadingLogs(false); }
  }

  async function handleSend() {
    if (selectedIds.size === 0) { toast({ title: "No recipients", description: "Select at least one renter.", variant: "destructive" }); return; }
    if (!body.trim()) { toast({ title: "Empty message", description: "Please write a message.", variant: "destructive" }); return; }
    if ((channel === "email" || channel === "both") && !subject.trim()) { toast({ title: "Missing subject", description: "Email messages need a subject line.", variant: "destructive" }); return; }

    setSending(true);
    try {
      const recipients = renters.filter(r => selectedIds.has(r.bookingId));
      const res = await fetch(`${BASE}/api/communications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ recipients, channel, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const sentMsg = data.sent > 0 ? `${data.sent} delivered` : "";
      const failMsg = data.failed > 0 ? `${data.failed} failed` : "";
      const summary = [sentMsg, failMsg].filter(Boolean).join(", ");
      toast({
        title: data.sent > 0 ? `Emails sent!` : "Delivery issue",
        description: summary || `${data.total} message${data.total !== 1 ? "s" : ""} processed.`,
        variant: data.sent === 0 && data.failed > 0 ? "destructive" : "default",
      });
      setBody("");
      setSubject("");
    } catch (e: any) {
      toast({ title: "Send failed", description: e.message, variant: "destructive" });
    } finally { setSending(false); }
  }

  async function toggleAutomationChannel(auto: Automation, field: "emailEnabled" | "smsEnabled") {
    const updated = { [field]: !auto[field] };
    try {
      const res = await fetch(`${BASE}/api/communications/automations/${auto.trigger}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      setAutomations(prev => prev.map(a => a.trigger === auto.trigger ? { ...a, ...data } : a));
    } catch { toast({ title: "Error", description: "Failed to update automation", variant: "destructive" }); }
  }

  async function saveAutomationEdit() {
    if (!editingTrigger) return;
    setSavingAuto(true);
    try {
      const res = await fetch(`${BASE}/api/communications/automations/${editingTrigger}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify(editDraft),
      });
      const data = await res.json();
      setAutomations(prev => prev.map(a => a.trigger === editingTrigger ? { ...a, ...data } : a));
      setEditingTrigger(null);
      toast({ title: "Template saved!" });
    } catch { toast({ title: "Error", description: "Failed to save template", variant: "destructive" }); }
    finally { setSavingAuto(false); }
  }

  const statusColor: Record<string, string> = {
    confirmed: "#3b82f6",
    active: OS_GREEN,
    completed: "#8b5cf6",
    pending: "#f59e0b",
    cancelled: "#ef4444",
  };

  const triggerLabel: Record<string, string> = {
    manual: "Manual",
    booking_confirmed: "Confirmed",
    booking_reminder: "Reminder",
    booking_activated: "Activated",
    booking_completed: "Completed",
    booking_cancelled: "Cancelled",
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black text-gray-900">Communications</h1>
          <p className="text-sm text-muted-foreground mt-1">Send messages to renters and manage automated notifications</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {([
            { key: "compose", label: "Compose & Send", icon: Send },
            { key: "automations", label: "Automations", icon: Zap },
            { key: "history", label: "History", icon: History },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.key ? "bg-white shadow text-gray-900" : "text-muted-foreground hover:text-gray-700"}`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── COMPOSE & SEND ── */}
        {tab === "compose" && (
          <div className="grid md:grid-cols-5 gap-6">
            {/* Left — Recipients */}
            <div className="md:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-sm text-gray-700 flex items-center gap-2">
                    <Filter className="w-4 h-4" /> Recipients
                  </h2>
                  <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
                </div>

                {/* Filter pills */}
                <div className="grid grid-cols-2 gap-2">
                  {FILTER_OPTIONS.map(f => (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      className={`text-left p-2.5 rounded-xl border-2 transition-all ${filter === f.key ? "border-current bg-opacity-5" : "border-gray-100 hover:border-gray-200"}`}
                      style={filter === f.key ? { borderColor: f.color, color: f.color, backgroundColor: `${f.color}10` } : {}}
                    >
                      <div className="text-xs font-bold">{f.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{f.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={recipientSearch}
                    onChange={e => setRecipientSearch(e.target.value)}
                    placeholder="Search by name or email…"
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all"
                  />
                  {recipientSearch && (
                    <button
                      onClick={() => setRecipientSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Renter list */}
                {(() => {
                  const q = recipientSearch.trim().toLowerCase();
                  const visible = q
                    ? renters.filter(r =>
                        r.name.toLowerCase().includes(q) ||
                        r.email.toLowerCase().includes(q)
                      )
                    : renters;
                  return (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {loadingRenters ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Loading renters…</p>
                      ) : visible.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          {recipientSearch ? "No renters match your search" : "No renters found"}
                        </p>
                      ) : (
                        <>
                          {!recipientSearch && (
                            <button
                              onClick={() => {
                                if (selectedIds.size === renters.length) setSelectedIds(new Set());
                                else setSelectedIds(new Set(renters.map(r => r.bookingId)));
                              }}
                              className="text-xs font-semibold w-full text-left px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                              style={{ color: OS_GREEN }}
                            >
                              {selectedIds.size === renters.length ? "Deselect all" : "Select all"}
                            </button>
                          )}
                          {visible.map(r => {
                            const checked = selectedIds.has(r.bookingId);
                            const isOnlyOne = selectedIds.size === 1 && checked;
                            return (
                              <div
                                key={r.bookingId}
                                className={`relative group rounded-xl border transition-all ${checked ? "border-green-200 bg-green-50" : "border-gray-100 hover:border-gray-200"}`}
                              >
                                {/* Main click = toggle */}
                                <button
                                  onClick={() => {
                                    const next = new Set(selectedIds);
                                    if (next.has(r.bookingId)) next.delete(r.bookingId);
                                    else next.add(r.bookingId);
                                    setSelectedIds(next);
                                  }}
                                  className="w-full text-left p-2.5 pr-9"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? "border-green-500 bg-green-500" : "border-gray-300"}`}>
                                      {checked && <Check className="w-2.5 h-2.5 text-white" />}
                                    </div>
                                    <span className="text-xs font-semibold text-gray-800 truncate">{r.name}</span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0 ml-auto" style={{ backgroundColor: statusColor[r.status] || "#6b7280" }}>
                                      {r.status}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground truncate mt-0.5 pl-6">{r.email}</div>
                                </button>
                                {/* "Only this person" button — visible on hover */}
                                {!isOnlyOne && (
                                  <button
                                    title="Send to only this person"
                                    onClick={() => setSelectedIds(new Set([r.bookingId]))}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-gray-200 hover:border-green-400 hover:text-green-600 text-muted-foreground shadow-sm"
                                  >
                                    <User className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Right — Compose */}
            <div className="md:col-span-3 space-y-4">
              <div className="bg-white rounded-2xl border p-5 space-y-4">
                <h2 className="font-bold text-sm text-gray-700 flex items-center gap-2">
                  <Mail className="w-4 h-4" /> Message
                </h2>

                {/* Channel toggle */}
                <div className="flex gap-2">
                  {(["email", "sms", "both"] as Channel[]).map(c => (
                    <button
                      key={c}
                      onClick={() => setChannel(c)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${channel === c ? "text-white border-current" : "border-gray-200 text-muted-foreground hover:border-gray-300"}`}
                      style={channel === c ? { backgroundColor: OS_GREEN, borderColor: OS_GREEN } : {}}
                    >
                      {c === "email" && <Mail className="w-3.5 h-3.5" />}
                      {c === "sms" && <MessageSquare className="w-3.5 h-3.5" />}
                      {c === "both" && <Send className="w-3.5 h-3.5" />}
                      {c === "email" ? "Email" : c === "sms" ? "SMS" : "Both"}
                    </button>
                  ))}
                </div>

                {(channel === "email" || channel === "both") && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Subject line</label>
                    <Input
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      placeholder="e.g. Your booking reminder"
                      className="h-9 text-sm"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Message body</label>
                  <Textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Write your message here… You can use plain text or simple formatting."
                    rows={8}
                    className="text-sm resize-none"
                  />
                  <p className="text-[11px] text-muted-foreground">{body.length} characters</p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-muted-foreground">
                    Sending to <strong>{selectedIds.size}</strong> recipient{selectedIds.size !== 1 ? "s" : ""}
                  </p>
                  <Button
                    onClick={handleSend}
                    disabled={sending || selectedIds.size === 0 || !body.trim()}
                    className="gap-2 text-white font-bold hover:opacity-90"
                    style={{ backgroundColor: OS_GREEN }}
                  >
                    <Send className="w-4 h-4" />
                    {sending ? "Sending…" : `Send Message`}
                  </Button>
                </div>

                <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    Emails are delivered via the OutdoorShare platform on your behalf.
                  </div>
                  <p className="leading-relaxed">
                    Replies go to your <strong>Public Email</strong> set in Settings.{" "}
                    <Link href={adminPath("/settings")} className="underline underline-offset-2 font-semibold hover:text-blue-600 inline-flex items-center gap-0.5">
                      Update your email in Settings <ExternalLink className="w-3 h-3" />
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── AUTOMATIONS ── */}
        {tab === "automations" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Automatically send messages when a booking changes phase. Edit templates with placeholders like <code className="bg-gray-100 px-1 rounded text-xs">{"{{customerName}}"}</code>, <code className="bg-gray-100 px-1 rounded text-xs">{"{{startDate}}"}</code>, <code className="bg-gray-100 px-1 rounded text-xs">{"{{endDate}}"}</code>, <code className="bg-gray-100 px-1 rounded text-xs">{"{{totalPrice}}"}</code>.</p>

            {loadingAutomations ? (
              <div className="py-8 text-center space-y-2">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="h-16 bg-muted/50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : automations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No automation templates found.</p>
            ) : (
              automations.map(auto => {
                const isEditing = editingTrigger === auto.trigger;
                return (
                  <div key={auto.trigger} className="bg-white rounded-2xl border overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <Zap className="w-4 h-4 shrink-0" style={{ color: OS_GREEN }} />
                            <span className="font-bold text-gray-900">{auto.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground ml-7">{auto.description}</p>
                        </div>

                        {/* Channel toggles */}
                        <div className="flex items-center gap-3 shrink-0">
                          <button
                            onClick={() => toggleAutomationChannel(auto, "emailEnabled")}
                            className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
                            style={{ color: auto.emailEnabled ? OS_GREEN : "#9ca3af" }}
                          >
                            <Mail className="w-3.5 h-3.5" />
                            Email
                            {auto.emailEnabled
                              ? <ToggleRight className="w-4 h-4" style={{ color: OS_GREEN }} />
                              : <ToggleLeft className="w-4 h-4 text-gray-300" />}
                          </button>
                          <button
                            onClick={() => toggleAutomationChannel(auto, "smsEnabled")}
                            className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
                            style={{ color: auto.smsEnabled ? OS_GREEN : "#9ca3af" }}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            SMS
                            {auto.smsEnabled
                              ? <ToggleRight className="w-4 h-4" style={{ color: OS_GREEN }} />
                              : <ToggleLeft className="w-4 h-4 text-gray-300" />}
                          </button>
                          <button
                            onClick={() => {
                              if (isEditing) { setEditingTrigger(null); }
                              else { setEditingTrigger(auto.trigger); setEditDraft({ subject: auto.subject, bodyTemplate: auto.bodyTemplate }); }
                            }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-muted-foreground hover:text-gray-700"
                          >
                            {isEditing ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Preview / Edit template */}
                      {isEditing ? (
                        <div className="mt-4 ml-7 space-y-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-600">Email subject</label>
                            <Input
                              value={editDraft.subject || ""}
                              onChange={e => setEditDraft(d => ({ ...d, subject: e.target.value }))}
                              className="h-9 text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-600">Message template</label>
                            <Textarea
                              value={editDraft.bodyTemplate || ""}
                              onChange={e => setEditDraft(d => ({ ...d, bodyTemplate: e.target.value }))}
                              rows={8}
                              className="text-sm resize-none font-mono text-xs"
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => setEditingTrigger(null)}>Cancel</Button>
                            <Button
                              size="sm"
                              onClick={saveAutomationEdit}
                              disabled={savingAuto}
                              className="gap-1.5 text-white font-bold hover:opacity-90"
                              style={{ backgroundColor: OS_GREEN }}
                            >
                              <Check className="w-3.5 h-3.5" />
                              {savingAuto ? "Saving…" : "Save Template"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 ml-7 bg-gray-50 rounded-xl px-4 py-3">
                          <p className="text-xs font-semibold text-gray-500 mb-1">Subject: {auto.subject}</p>
                          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed line-clamp-3">{auto.bodyTemplate}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab === "history" && (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h2 className="font-bold text-sm text-gray-700 flex items-center gap-2">
                <History className="w-4 h-4" /> Message History
              </h2>
              <span className="text-xs text-muted-foreground">{logs.length} messages</span>
            </div>
            {loadingLogs ? (
              <p className="text-sm text-muted-foreground text-center py-10">Loading history…</p>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No messages sent yet</p>
            ) : (
              <div className="divide-y">
                {logs.map(log => (
                  <div key={log.id} className="px-5 py-3.5 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${OS_GREEN}15` }}>
                      {log.channel === "sms" ? <MessageSquare className="w-4 h-4" style={{ color: OS_GREEN }} /> : <Mail className="w-4 h-4" style={{ color: OS_GREEN }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-gray-900">{log.customerName}</span>
                        <span className="text-xs text-muted-foreground">{log.customerEmail}</span>
                        <Badge className="text-[10px] px-1.5 py-0 h-4 ml-auto" variant="outline">
                          {triggerLabel[log.trigger] || log.trigger}
                        </Badge>
                      </div>
                      {log.subject && <p className="text-xs font-medium text-gray-700">{log.subject}</p>}
                      <p className="text-xs text-muted-foreground truncate">{log.body.substring(0, 100)}…</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-muted-foreground">{new Date(log.sentAt).toLocaleString()}</p>
                      <span className={`text-[10px] font-bold ${log.status === "sent" ? "text-green-600" : log.status === "failed" ? "text-red-500" : "text-amber-500"}`}>
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
