import { useState, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Phone, Mail, Copy, Check, ExternalLink, BookOpen, DollarSign } from "lucide-react";
import { getAdminSession, adminPath } from "@/lib/admin-nav";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function adminHeaders(): HeadersInit {
  const s = getAdminSession();
  return s?.token ? { "x-admin-token": s.token } : {};
}

interface RenterInfo {
  name: string;
  email: string;
  phone: string | null;
  bookingCount: number;
  lifetimeValue: number;
  lastBooking: string;
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

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface CustomerContactPopoverProps {
  customerName: string;
  customerEmail: string;
  className?: string;
}

export function CustomerContactPopover({ customerName, customerEmail, className }: CustomerContactPopoverProps) {
  const [open, setOpen] = useState(false);
  const [renter, setRenter] = useState<RenterInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<"email" | "phone" | null>(null);

  const fetchRenter = useCallback(async () => {
    if (renter || loading) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${BASE}/api/admin/renters?email=${encodeURIComponent(customerEmail)}`,
        { headers: adminHeaders() }
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setRenter(data[0]);
      } else {
        setRenter({
          name: customerName,
          email: customerEmail,
          phone: null,
          bookingCount: 0,
          lifetimeValue: 0,
          lastBooking: new Date().toISOString(),
        });
      }
    } catch {
      setRenter({
        name: customerName,
        email: customerEmail,
        phone: null,
        bookingCount: 0,
        lifetimeValue: 0,
        lastBooking: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }, [customerEmail, customerName, renter, loading]);

  function copy(text: string, type: "email" | "phone") {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(type);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <Popover open={open} onOpenChange={v => { setOpen(v); if (v) fetchRenter(); }}>
      <PopoverTrigger asChild>
        <button
          className={`text-left hover:text-primary hover:underline underline-offset-2 transition-colors font-medium focus:outline-none ${className ?? ""}`}
          onClick={e => e.stopPropagation()}
        >
          {customerName}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0 shadow-lg"
        side="bottom"
        align="start"
        onClick={e => e.stopPropagation()}
      >
        {loading || !renter ? (
          <div className="py-6 flex items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(renter.email)}`}>
                {initials(renter.name)}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-tight truncate">{renter.name}</p>
                <p className="text-xs text-muted-foreground truncate">{renter.email}</p>
              </div>
            </div>

            {/* Contact info */}
            <div className="px-4 py-3 space-y-2 border-b">
              <button
                onClick={() => copy(renter.email, "email")}
                className="flex items-center gap-2.5 w-full group text-left"
              >
                <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground truncate flex-1">{renter.email}</span>
                {copied === "email"
                  ? <Check className="w-3 h-3 text-green-500 shrink-0" />
                  : <Copy className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
                }
              </button>
              {renter.phone ? (
                <button
                  onClick={() => copy(renter.phone!, "phone")}
                  className="flex items-center gap-2.5 w-full group text-left"
                >
                  <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <a
                    href={`tel:${renter.phone}`}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate flex-1"
                    onClick={e => e.stopPropagation()}
                  >
                    {renter.phone}
                  </a>
                  {copied === "phone"
                    ? <Check className="w-3 h-3 text-green-500 shrink-0" />
                    : <Copy className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
                  }
                </button>
              ) : (
                <div className="flex items-center gap-2.5">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                  <span className="text-xs text-muted-foreground/40">No phone on file</span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-px bg-border px-0">
              <div className="bg-background px-4 py-2.5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <BookOpen className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Bookings</span>
                </div>
                <p className="text-sm font-bold">{renter.bookingCount}</p>
              </div>
              <div className="bg-background px-4 py-2.5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <DollarSign className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Lifetime</span>
                </div>
                <p className="text-sm font-bold">${renter.lifetimeValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                Last rental {fmt(renter.lastBooking)}
              </span>
              <Link
                href={adminPath("/contacts")}
                onClick={e => e.stopPropagation()}
              >
                <span className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                  Full contact <ExternalLink className="w-3 h-3" />
                </span>
              </Link>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
