import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Users, Trophy, Phone, Mail, CalendarDays,
  ChevronRight, X, ExternalLink, Star, TrendingUp,
  ShieldCheck, Clock, Package, CreditCard, Hash,
  ArrowUpDown, SortAsc, Copy, Check,
} from "lucide-react";
import { getAdminSession, adminPath } from "@/lib/admin-nav";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function adminHeaders(): HeadersInit {
  const s = getAdminSession();
  return s?.token ? { "x-admin-token": s.token } : {};
}

interface Renter {
  name: string;
  email: string;
  phone: string | null;
  bookingCount: number;
  lifetimeValue: number;
  firstBooking: string;
  lastBooking: string;
}

interface RenterBooking {
  id: number;
  listingId: number;
  listingTitle: string;
  startDate: string;
  endDate: string;
  totalPrice: string;
  status: string;
  createdAt: string;
  source: string;
}

function initials(name: string) {
  return name
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function avatarColor(email: string) {
  const colors = [
    "bg-violet-100 text-violet-700",
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-cyan-100 text-cyan-700",
    "bg-orange-100 text-orange-700",
    "bg-indigo-100 text-indigo-700",
  ];
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending:   { label: "Pending",   className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  confirmed: { label: "Confirmed", className: "bg-blue-50 text-blue-700 border-blue-200" },
  active:    { label: "Active",    className: "bg-green-50 text-green-700 border-green-200" },
  completed: { label: "Completed", className: "bg-gray-50 text-gray-600 border-gray-200" },
  cancelled: { label: "Cancelled", className: "bg-red-50 text-red-600 border-red-200" },
};

function RenterPanel({
  renter,
  onClose,
}: {
  renter: Renter;
  onClose: () => void;
}) {
  const [bookings, setBookings] = useState<RenterBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<"email" | "phone" | null>(null);

  function copyToClipboard(text: string, type: "email" | "phone") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/api/admin/renters/${encodeURIComponent(renter.email)}/bookings`, {
      headers: adminHeaders(),
    })
      .then(r => r.json())
      .then(data => { setBookings(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [renter.email]);

  const totalSpent = bookings
    .filter(b => b.status !== "cancelled")
    .reduce((s, b) => s + parseFloat(b.totalPrice || "0"), 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between p-6 border-b bg-muted/30">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 ${avatarColor(renter.email)}`}>
            {initials(renter.name)}
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight leading-none">{renter.name}</h2>
            <button
              onClick={() => copyToClipboard(renter.email, "email")}
              className="flex items-center gap-1.5 mt-1 group"
              title="Copy email"
            >
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{renter.email}</span>
              {copied === "email"
                ? <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                : <Copy className="w-3.5 h-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
              }
            </button>
            {renter.phone && (
              <button
                onClick={() => copyToClipboard(renter.phone!, "phone")}
                className="flex items-center gap-1.5 mt-0.5 group"
                title="Copy phone"
              >
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{renter.phone}</span>
                {copied === "phone"
                  ? <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  : <Copy className="w-3.5 h-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                }
              </button>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 divide-x border-b bg-background">
        <div className="px-4 py-3 text-center">
          <p className="text-2xl font-black text-primary">${totalSpent.toFixed(0)}</p>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">Lifetime Value</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-2xl font-black">{renter.bookingCount}</p>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">Total Bookings</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-2xl font-black">
            {renter.bookingCount > 0 ? `$${(totalSpent / renter.bookingCount).toFixed(0)}` : "—"}
          </p>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">Avg. Booking</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 p-4 border-b">
        <a
          href={`mailto:${renter.email}`}
          className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg border bg-background hover:bg-muted transition-colors text-sm font-medium"
        >
          <Mail className="w-4 h-4" /> Email
        </a>
        {renter.phone && (
          <a
            href={`tel:${renter.phone}`}
            className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg border bg-background hover:bg-muted transition-colors text-sm font-medium"
          >
            <Phone className="w-4 h-4" /> Call
          </a>
        )}
        <Link
          href={adminPath(`/bookings/new?email=${encodeURIComponent(renter.email)}&name=${encodeURIComponent(renter.name)}${renter.phone ? `&phone=${encodeURIComponent(renter.phone)}` : ""}`)}
          className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg border bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <CalendarDays className="w-4 h-4" /> New Booking
        </Link>
      </div>

      {/* Info rows */}
      <div className="px-4 py-3 border-b space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4 shrink-0" />
          <span>Customer since <strong className="text-foreground">{fmt(renter.firstBooking)}</strong></span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="w-4 h-4 shrink-0" />
          <span>Last booking <strong className="text-foreground">{fmt(renter.lastBooking)}</strong></span>
        </div>
      </div>

      {/* Booking history */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Booking History</h3>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <Package className="w-8 h-8 text-muted" />
            <p className="text-sm font-medium">No bookings found</p>
          </div>
        ) : (
          <ul className="divide-y">
            {bookings.map(b => {
              const cfg = STATUS_CONFIG[b.status] ?? { label: b.status, className: "bg-gray-50 text-gray-600 border-gray-200" };
              return (
                <li key={b.id}>
                  <Link href={adminPath(`/bookings/${b.id}`)}>
                    <div className="px-4 py-3.5 hover:bg-muted/40 transition-colors cursor-pointer group">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{b.listingTitle}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {fmt(b.startDate)} → {fmt(b.endDate)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-black text-sm">${parseFloat(b.totalPrice).toFixed(0)}</p>
                          <span className={`inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.className}`}>
                            {cfg.label}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[11px] text-muted-foreground capitalize flex items-center gap-1">
                          <Hash className="w-3 h-3" /> #{b.id}
                        </span>
                        <span className="text-[11px] text-muted-foreground capitalize">{b.source}</span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

type SortMode = "alpha" | "leaderboard";

export default function AdminContacts() {
  const [renters, setRenters] = useState<Renter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("alpha");
  const [selected, setSelected] = useState<Renter | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/api/admin/renters`, { headers: adminHeaders() })
      .then(r => r.json())
      .then(data => {
        setRenters(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        toast({ title: "Failed to load contacts", variant: "destructive" });
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    let list = [...renters];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.phone ?? "").includes(q)
      );
    }
    if (sortMode === "alpha") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list.sort((a, b) => b.lifetimeValue - a.lifetimeValue);
    }
    return list;
  }, [renters, search, sortMode]);

  // Group alphabetically only in alpha mode
  const grouped = useMemo(() => {
    if (sortMode !== "alpha") return null;
    const groups: Record<string, Renter[]> = {};
    for (const r of filtered) {
      const letter = r.name[0]?.toUpperCase() ?? "#";
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(r);
    }
    return groups;
  }, [filtered, sortMode]);

  const totalLTV = renters.reduce((s, r) => s + r.lifetimeValue, 0);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Main panel */}
      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ${selected ? "hidden lg:flex" : "flex"}`}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b bg-background">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight">Contacts</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {loading ? "Loading…" : `${renters.length} renter${renters.length !== 1 ? "s" : ""} · $${totalLTV.toLocaleString("en-US", { maximumFractionDigits: 0 })} total LTV`}
              </p>
            </div>
          </div>

          {/* Search + sort toggle */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex rounded-lg border bg-muted/30 overflow-hidden">
              <button
                onClick={() => setSortMode("alpha")}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${sortMode === "alpha" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <SortAsc className="w-4 h-4" /> A–Z
              </button>
              <button
                onClick={() => setSortMode("leaderboard")}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${sortMode === "leaderboard" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Trophy className="w-4 h-4" /> Leaderboard
              </button>
            </div>
          </div>
        </div>

        {/* Leaderboard podium — only shown in leaderboard mode */}
        {sortMode === "leaderboard" && !loading && filtered.length > 0 && (
          <div className="px-6 py-4 border-b bg-gradient-to-b from-amber-50/60 to-background">
            <div className="flex items-end justify-center gap-3 mb-1">
              {/* 2nd */}
              {filtered[1] && (
                <div className="flex flex-col items-center gap-1 w-24 text-center">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${avatarColor(filtered[1].email)}`}>
                    {initials(filtered[1].name)}
                  </div>
                  <div className="w-full bg-gradient-to-t from-gray-200 to-gray-100 rounded-t-lg h-12 flex items-center justify-center">
                    <span className="text-2xl font-black text-gray-500">2</span>
                  </div>
                  <p className="text-xs font-semibold truncate w-full">{filtered[1].name.split(" ")[0]}</p>
                  <p className="text-xs text-muted-foreground font-medium">${filtered[1].lifetimeValue.toFixed(0)}</p>
                </div>
              )}
              {/* 1st */}
              {filtered[0] && (
                <div className="flex flex-col items-center gap-1 w-28 text-center -mt-4">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-black text-xl ${avatarColor(filtered[0].email)} ring-2 ring-amber-400`}>
                    {initials(filtered[0].name)}
                  </div>
                  <div className="w-full bg-gradient-to-t from-amber-300 to-amber-200 rounded-t-lg h-16 flex items-center justify-center">
                    <span className="text-3xl font-black text-amber-700">1</span>
                  </div>
                  <p className="text-sm font-bold truncate w-full">{filtered[0].name.split(" ")[0]}</p>
                  <p className="text-xs text-amber-700 font-bold">${filtered[0].lifetimeValue.toFixed(0)}</p>
                </div>
              )}
              {/* 3rd */}
              {filtered[2] && (
                <div className="flex flex-col items-center gap-1 w-24 text-center">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${avatarColor(filtered[2].email)}`}>
                    {initials(filtered[2].name)}
                  </div>
                  <div className="w-full bg-gradient-to-t from-orange-200 to-orange-100 rounded-t-lg h-9 flex items-center justify-center">
                    <span className="text-xl font-black text-orange-500">3</span>
                  </div>
                  <p className="text-xs font-semibold truncate w-full">{filtered[2].name.split(" ")[0]}</p>
                  <p className="text-xs text-muted-foreground font-medium">${filtered[2].lifetimeValue.toFixed(0)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="flex items-center gap-4 px-4 py-3.5 animate-pulse">
                  <div className="w-11 h-11 rounded-xl bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                  <div className="h-4 bg-muted rounded w-16" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Users className="w-12 h-12 text-muted" />
              <p className="font-semibold text-lg">
                {search ? "No renters match your search" : "No renters yet"}
              </p>
              {search && (
                <Button variant="outline" size="sm" onClick={() => setSearch("")}>Clear search</Button>
              )}
            </div>
          ) : sortMode === "alpha" && grouped ? (
            // Alphabetical grouped view
            Object.keys(grouped).sort().map(letter => (
              <div key={letter}>
                <div className="px-6 py-1.5 bg-muted/40 border-y">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{letter}</span>
                </div>
                <ul className="divide-y">
                  {grouped[letter].map(r => (
                    <RenterRow
                      key={r.email}
                      renter={r}
                      isSelected={selected?.email === r.email}
                      rank={null}
                      onSelect={() => setSelected(r.email === selected?.email ? null : r)}
                    />
                  ))}
                </ul>
              </div>
            ))
          ) : (
            // Leaderboard flat list
            <ul className="divide-y">
              {filtered.map((r, i) => (
                <RenterRow
                  key={r.email}
                  renter={r}
                  isSelected={selected?.email === r.email}
                  rank={i + 1}
                  onSelect={() => setSelected(r.email === selected?.email ? null : r)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Side panel */}
      {selected && (
        <div className={`border-l bg-background flex flex-col overflow-hidden transition-all duration-300 ${selected ? "w-full lg:w-[420px] flex" : "w-0 hidden"}`}>
          <RenterPanel renter={selected} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}

function RenterRow({
  renter,
  isSelected,
  rank,
  onSelect,
}: {
  renter: Renter;
  isSelected: boolean;
  rank: number | null;
  onSelect: () => void;
}) {
  const rankEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

  return (
    <li>
      <button
        onClick={onSelect}
        className={`w-full flex items-center gap-4 px-4 md:px-6 py-3.5 text-left transition-colors hover:bg-muted/40 ${isSelected ? "bg-primary/5 border-l-2 border-primary" : ""}`}
      >
        {/* Rank badge in leaderboard mode */}
        {rank !== null && (
          <div className="w-7 shrink-0 text-center">
            {rankEmoji ? (
              <span className="text-lg">{rankEmoji}</span>
            ) : (
              <span className="text-xs font-bold text-muted-foreground">#{rank}</span>
            )}
          </div>
        )}

        {/* Avatar */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${avatarColor(renter.email)}`}>
          {initials(renter.name)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{renter.name}</p>
          <p className="text-xs text-muted-foreground truncate">{renter.email}</p>
          {renter.phone && (
            <p className="text-xs text-muted-foreground">{renter.phone}</p>
          )}
        </div>

        {/* Stats */}
        <div className="shrink-0 text-right">
          <p className="font-black text-sm text-primary">${renter.lifetimeValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-muted-foreground">{renter.bookingCount} booking{renter.bookingCount !== 1 ? "s" : ""}</p>
        </div>

        <ChevronRight className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${isSelected ? "rotate-90 text-primary" : ""}`} />
      </button>
    </li>
  );
}
