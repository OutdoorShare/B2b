import { useState, useEffect } from "react";
import { MessageSquarePlus, Star, Search, RefreshCcw, Building2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function getToken() { return localStorage.getItem("superadmin_token") ?? ""; }
async function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-superadmin-token": getToken(), ...opts?.headers },
  });
}

type FeedbackItem = {
  id: number;
  tenantId: number | null;
  tenantSlug: string | null;
  tenantName: string | null;
  submitterType: "renter" | "admin";
  submitterName: string;
  submitterEmail: string;
  subject: string | null;
  message: string;
  rating: number | null;
  createdAt: string;
};

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-slate-500 text-xs">No rating</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= rating ? "fill-yellow-400 text-yellow-400" : "text-slate-600"}`} />
      ))}
    </div>
  );
}

export default function SuperAdminFeedback() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "renter" | "admin">("all");

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/superadmin/feedback");
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter(item => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      item.submitterName.toLowerCase().includes(q) ||
      item.submitterEmail.toLowerCase().includes(q) ||
      item.message.toLowerCase().includes(q) ||
      (item.subject ?? "").toLowerCase().includes(q) ||
      (item.tenantName ?? "").toLowerCase().includes(q);
    const matchesType = filterType === "all" || item.submitterType === filterType;
    return matchesSearch && matchesType;
  });

  const avgRating = (() => {
    const rated = items.filter(i => i.rating);
    if (!rated.length) return null;
    return (rated.reduce((s, i) => s + (i.rating ?? 0), 0) / rated.length).toFixed(1);
  })();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <MessageSquarePlus className="w-6 h-6" style={{ color: "#3ab549" }} />
            Feedback
          </h1>
          <p className="text-slate-400 text-sm mt-1">All feedback submitted by renters and admin users</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
          className="border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          <RefreshCcw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total Submissions</p>
          <p className="text-2xl font-bold text-white">{items.length}</p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Avg Rating</p>
          <p className="text-2xl font-bold text-white">{avgRating ?? "—"}</p>
          {avgRating && <p className="text-xs text-slate-500">out of 5</p>}
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">From Admins</p>
          <p className="text-2xl font-bold text-white">{items.filter(i => i.submitterType === "admin").length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <Input
            placeholder="Search feedback…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "renter", "admin"] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterType === t
                  ? "bg-[#3ab549]/20 text-[#3ab549] border border-[#3ab549]/30"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              {t === "all" ? "All" : t === "renter" ? "Renters" : "Admins"}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-12 text-center">
          <MessageSquarePlus className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No feedback yet</p>
          <p className="text-slate-500 text-sm mt-1">Feedback from renters and admins will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <div key={item.id} className="bg-slate-900 rounded-xl border border-slate-800 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    item.submitterType === "admin"
                      ? "bg-blue-500/20"
                      : "bg-[#3ab549]/20"
                  }`}>
                    {item.submitterType === "admin"
                      ? <Building2 className="w-4 h-4 text-blue-400" />
                      : <User className="w-4 h-4" style={{ color: "#3ab549" }} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm">{item.submitterName}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0 ${
                          item.submitterType === "admin"
                            ? "border-blue-500/30 text-blue-400 bg-blue-500/10"
                            : "border-[#3ab549]/30 bg-[#3ab549]/10"
                        }`}
                        style={item.submitterType === "renter" ? { color: "#3ab549" } : {}}
                      >
                        {item.submitterType === "admin" ? "Admin" : "Renter"}
                      </Badge>
                      {item.tenantName && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {item.tenantName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{item.submitterEmail}</p>
                    {item.subject && (
                      <p className="text-sm font-medium text-slate-300 mt-2">{item.subject}</p>
                    )}
                    <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">{item.message}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <StarRating rating={item.rating} />
                  <p className="text-xs text-slate-500 mt-1.5">{format(new Date(item.createdAt), "MMM d, yyyy")}</p>
                  <p className="text-xs text-slate-600">#{item.id}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
