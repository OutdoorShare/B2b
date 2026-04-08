import { useState, useEffect } from "react";
import { differenceInSeconds, parseISO } from "date-fns";
import { Calendar, Zap, Clock, CheckCircle2, Hourglass } from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────────

function secondsToParts(secs: number) {
  const abs  = Math.max(0, secs);
  const d    = Math.floor(abs / 86400);
  const h    = Math.floor((abs % 86400) / 3600);
  const m    = Math.floor((abs % 3600)  / 60);
  const s    = Math.floor(abs % 60);
  return { d, h, m, s };
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// ── Flip‑style digit tile ──────────────────────────────────────────────────────

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div
          className="w-12 h-14 rounded-xl flex items-center justify-center font-black text-2xl tabular-nums shadow-inner"
          style={{ background: "rgba(255,255,255,0.18)", color: "#fff", letterSpacing: "-0.02em" }}
        >
          {String(value).padStart(2, "0")}
        </div>
      </div>
      <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-white/60">{label}</span>
    </div>
  );
}

// ── Progress arc ───────────────────────────────────────────────────────────────

function ProgressRing({ pct, size = 64, stroke = 6 }: { pct: number; size?: number; stroke?: number }) {
  const r   = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(1, Math.max(0, pct));
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={circ - dash}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  );
}

// ─── Upcoming countdown card ───────────────────────────────────────────────────

interface UpcomingProps {
  startDate: string;
  endDate: string;
  title: string;
  image?: string | null;
  businessName?: string | null;
  compact?: boolean;
}

export function UpcomingCountdown({ startDate, endDate, title, image, businessName, compact }: UpcomingProps) {
  const now     = useNow(30_000);
  const start   = parseISO(startDate);
  const secsLeft = differenceInSeconds(start, now);
  const { d, h, m } = secondsToParts(secsLeft);
  const nights = Math.round(differenceInSeconds(parseISO(endDate), start) / 86400);

  const isToday    = d === 0 && h < 12;
  const isTomorrow = d === 1;

  const tag =
    secsLeft <= 0
      ? "Starting now!"
      : isToday
      ? "Today!"
      : isTomorrow
      ? "Tomorrow!"
      : `In ${d} day${d !== 1 ? "s" : ""}`;

  const gradient = isToday
    ? "linear-gradient(135deg, #f97316 0%, #dc2626 100%)"
    : isTomorrow
    ? "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)"
    : "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)";

  if (compact) {
    return (
      <div
        className="rounded-2xl overflow-hidden flex items-center gap-3 p-3 text-white relative"
        style={{ background: gradient }}
      >
        {image && (
          <img src={image} alt={title} className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-md" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{title}</p>
          {businessName && <p className="text-white/70 text-[10px] truncate">{businessName}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-black text-sm">{tag}</p>
          {secsLeft > 0 && d === 0 && (
            <p className="text-white/80 text-[11px]">{h}h {m}m</p>
          )}
          {secsLeft > 0 && d > 0 && (
            <p className="text-white/80 text-[11px]">{nights}‑night rental</p>
          )}
        </div>
        <Calendar className="absolute top-2 right-2 w-3 h-3 text-white/30" />
      </div>
    );
  }

  return (
    <div
      className="rounded-3xl overflow-hidden p-5 text-white shadow-xl relative"
      style={{ background: gradient }}
    >
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-8 translate-x-8" />
      <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/5 translate-y-8 -translate-x-8" />

      <div className="relative z-10">
        <div className="flex items-start gap-3 mb-4">
          {image && (
            <img src={image} alt={title} className="w-16 h-16 rounded-2xl object-cover shadow-lg shrink-0" />
          )}
          <div className="min-w-0">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-1"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              <Calendar className="w-2.5 h-2.5" /> Upcoming
            </span>
            <p className="font-black text-lg leading-tight truncate">{title}</p>
            {businessName && <p className="text-white/70 text-xs mt-0.5">{businessName}</p>}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {secsLeft > 0 ? (
              <>
                <Tile value={d} label="Days" />
                <span className="text-white/60 font-black text-xl mb-3">:</span>
                <Tile value={h} label="Hrs" />
                <span className="text-white/60 font-black text-xl mb-3">:</span>
                <Tile value={m} label="Min" />
              </>
            ) : (
              <p className="font-black text-2xl flex items-center gap-2">
                <Zap className="w-6 h-6" /> Starting now!
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="font-black text-2xl">{tag}</p>
            <p className="text-white/70 text-xs">{nights}-night rental</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Active rental progress card ──────────────────────────────────────────────

interface ActiveProps {
  startDate: string;
  endDate: string;
  title: string;
  image?: string | null;
  businessName?: string | null;
  compact?: boolean;
}

export function ActiveRentalProgress({ startDate, endDate, title, image, businessName, compact }: ActiveProps) {
  const now    = useNow(30_000);
  const start  = parseISO(startDate);
  const end    = parseISO(endDate);
  const total  = differenceInSeconds(end, start);
  const elapsed = differenceInSeconds(now, start);
  const remaining = differenceInSeconds(end, now);
  const pct    = Math.min(1, Math.max(0, elapsed / total));
  const { d, h, m } = secondsToParts(remaining);

  const urgency =
    remaining <= 0
      ? "overdue"
      : pct >= 0.85
      ? "critical"
      : pct >= 0.6
      ? "warning"
      : "normal";

  const palette = {
    normal:   { from: "#10b981", to: "#059669", bar: "from-emerald-400 to-teal-400", tag: "#10b981" },
    warning:  { from: "#f59e0b", to: "#d97706", bar: "from-amber-400 to-orange-400", tag: "#f59e0b" },
    critical: { from: "#ef4444", to: "#dc2626", bar: "from-red-400 to-rose-500",     tag: "#ef4444" },
    overdue:  { from: "#7c3aed", to: "#6d28d9", bar: "from-violet-400 to-purple-500", tag: "#7c3aed" },
  }[urgency];

  const gradient = `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)`;

  if (compact) {
    return (
      <div
        className="rounded-2xl overflow-hidden p-3 text-white"
        style={{ background: gradient }}
      >
        <div className="flex items-center gap-3 mb-2">
          {image && <img src={image} alt={title} className="w-10 h-10 rounded-xl object-cover shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{title}</p>
            {businessName && <p className="text-white/70 text-[10px] truncate">{businessName}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-black text-xs">
              {urgency === "overdue" ? "Overdue!" : `${d}d ${h}h left`}
            </p>
            <p className="text-white/70 text-[10px]">{Math.round(pct * 100)}% complete</p>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${palette.bar} rounded-full transition-all duration-700`}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-3xl overflow-hidden p-5 text-white shadow-xl relative"
      style={{ background: gradient }}
    >
      <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/5 -translate-y-16 translate-x-16" />
      <div className="absolute bottom-0 left-0 w-28 h-28 rounded-full bg-white/5 translate-y-12 -translate-x-12" />

      <div className="relative z-10">
        <div className="flex items-start gap-3 mb-4">
          {image && (
            <img src={image} alt={title} className="w-16 h-16 rounded-2xl object-cover shadow-lg shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-1"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              <Zap className="w-2.5 h-2.5" /> Active Rental
            </span>
            <p className="font-black text-lg leading-tight truncate">{title}</p>
            {businessName && <p className="text-white/70 text-xs mt-0.5">{businessName}</p>}
          </div>
          <ProgressRing pct={pct} />
        </div>

        {/* ── Progress bar ── */}
        <div className="mb-3">
          <div className="flex justify-between text-[11px] text-white/70 mb-1.5">
            <span>Pickup</span>
            <span className="font-semibold text-white">{Math.round(pct * 100)}% complete</span>
            <span>Return</span>
          </div>
          <div className="h-3 rounded-full bg-white/20 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${palette.bar} rounded-full transition-all duration-700 relative overflow-hidden`}
              style={{ width: `${pct * 100}%` }}
            >
              <div className="absolute inset-0 bg-white/25 animate-[shimmer_2s_linear_infinite]" style={{ backgroundImage: "linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.4) 50%,transparent 100%)", backgroundSize: "200% 100%" }} />
            </div>
          </div>
        </div>

        {/* ── Time remaining countdown ── */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            {remaining > 0 ? (
              <>
                <Tile value={d} label="Days" />
                <span className="text-white/50 font-black text-lg mb-3">:</span>
                <Tile value={h} label="Hrs" />
                <span className="text-white/50 font-black text-lg mb-3">:</span>
                <Tile value={m} label="Min" />
              </>
            ) : (
              <p className="font-black text-xl flex items-center gap-2">
                <Clock className="w-5 h-5" /> Time's up!
              </p>
            )}
          </div>
          <div className="text-right">
            <p
              className="font-black text-sm px-3 py-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              {remaining > 0 ? "Until return" : "Overdue"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Compact "completed" card ──────────────────────────────────────────────────

export function CompletedCard({ title, endDate, businessName, image, compact }: {
  title: string; endDate: string; businessName?: string | null;
  image?: string | null; compact?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl overflow-hidden flex items-center gap-3 text-white ${compact ? "p-3" : "p-4"}`}
      style={{ background: "linear-gradient(135deg, #64748b 0%, #475569 100%)" }}
    >
      {image && <img src={image} alt={title} className="w-12 h-12 rounded-xl object-cover shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">{title}</p>
        {businessName && <p className="text-white/60 text-[10px]">{businessName}</p>}
      </div>
      <CheckCircle2 className="w-5 h-5 text-white/60 shrink-0" />
    </div>
  );
}

// ─── Admin booking timeline ────────────────────────────────────────────────────

interface AdminTimelineProps {
  status: string;
  startDate: string;
  endDate: string;
  listingTitle: string;
  listingImage?: string | null;
}

export function AdminBookingTimeline({ status, startDate, endDate, listingTitle, listingImage }: AdminTimelineProps) {
  if (status === "pending") {
    const now = new Date();
    const start = parseISO(startDate);
    const daysAway = Math.ceil(differenceInSeconds(start, now) / 86400);
    return (
      <div className="rounded-2xl overflow-hidden p-4 text-white relative"
        style={{ background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Hourglass className="w-5 h-5" />
          </div>
          <div>
            <p className="font-black text-sm">Awaiting your approval</p>
            <p className="text-white/75 text-xs">
              Scheduled to start in {daysAway > 0 ? `${daysAway} day${daysAway !== 1 ? "s" : ""}` : "less than a day"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "confirmed") {
    return (
      <UpcomingCountdown
        startDate={startDate}
        endDate={endDate}
        title={listingTitle}
        image={listingImage}
        compact
      />
    );
  }

  if (status === "active") {
    return (
      <ActiveRentalProgress
        startDate={startDate}
        endDate={endDate}
        title={listingTitle}
        image={listingImage}
        compact
      />
    );
  }

  if (status === "completed") {
    return (
      <div className="rounded-2xl overflow-hidden p-4 text-white flex items-center gap-3"
        style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
      >
        <CheckCircle2 className="w-9 h-9 shrink-0 opacity-80" />
        <div>
          <p className="font-black text-sm">Rental completed</p>
          <p className="text-white/75 text-xs">Returned on {new Date(endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
        </div>
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className="rounded-2xl overflow-hidden p-4 text-white flex items-center gap-3"
        style={{ background: "linear-gradient(135deg, #64748b 0%, #475569 100%)" }}
      >
        <Clock className="w-9 h-9 shrink-0 opacity-60" />
        <div>
          <p className="font-black text-sm">Booking cancelled</p>
          <p className="text-white/75 text-xs">{listingTitle}</p>
        </div>
      </div>
    );
  }

  return null;
}
