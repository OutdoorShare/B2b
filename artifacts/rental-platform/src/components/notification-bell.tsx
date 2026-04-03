import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, X, CheckCheck, AlertTriangle, CalendarPlus, CheckCircle, Tent, Truck, RotateCcw, FileWarning, BanIcon } from "lucide-react";
import { useLocation } from "wouter";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  isRead: boolean;
  isActionRequired: boolean;
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

const TYPE_ICON: Record<string, React.ElementType> = {
  new_booking: CalendarPlus,
  booking_confirmed: CheckCircle,
  booking_cancelled: BanIcon,
  booking_active: Tent,
  claim_submitted: FileWarning,
  pickup_due_soon: Truck,
  return_due_soon: RotateCcw,
};

const TYPE_COLOR: Record<string, string> = {
  new_booking: "#f59e0b",
  booking_confirmed: "#10b981",
  booking_cancelled: "#ef4444",
  booking_active: "#3b82f6",
  claim_submitted: "#ef4444",
  pickup_due_soon: "#3b82f6",
  return_due_soon: "#6366f1",
};

interface NotificationBellProps {
  mode: "admin" | "renter";
  slug: string;
  adminToken?: string;
  customerEmail?: string;
  navBase: string;
  iconColor?: string;
}

export function NotificationBell({
  mode,
  slug,
  adminToken,
  customerEmail,
  navBase,
  iconColor,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  const buildHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (mode === "admin" && adminToken) h["x-admin-token"] = adminToken;
    else h["x-tenant-slug"] = slug;
    return h;
  }, [mode, adminToken, slug]);

  const fetchItems = useCallback(async () => {
    try {
      const url =
        mode === "admin"
          ? `${BASE_URL}/api/notifications`
          : `${BASE_URL}/api/notifications/renter?email=${encodeURIComponent(customerEmail ?? "")}`;
      const res = await fetch(url, { headers: buildHeaders() });
      if (res.ok) setItems(await res.json());
    } catch {}
  }, [mode, customerEmail, buildHeaders]);

  useEffect(() => {
    if (mode === "renter" && !customerEmail) return;
    fetchItems();
    const interval = setInterval(fetchItems, 30_000);
    return () => clearInterval(interval);
  }, [fetchItems, mode, customerEmail]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markRead = async (id: number) => {
    setItems(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)));
    await fetch(`${BASE_URL}/api/notifications/${id}/read`, {
      method: "PATCH",
      headers: buildHeaders(),
    });
  };

  const markAllRead = async () => {
    setItems(prev => prev.map(n => ({ ...n, isRead: true })));
    await fetch(`${BASE_URL}/api/notifications/read-all`, {
      method: "PATCH",
      headers: buildHeaders(),
      body: JSON.stringify({ targetType: mode, email: customerEmail }),
    });
  };

  const handleNotifClick = (n: NotificationItem) => {
    markRead(n.id);
    if (n.actionUrl) {
      setLocation(`${navBase}${n.actionUrl}`);
    }
    setOpen(false);
  };

  const unreadCount = items.filter(n => !n.isRead).length;
  const actionItems = items.filter(n => n.isActionRequired && !n.isRead);
  const sortedItems = [
    ...items.filter(n => n.isActionRequired && !n.isRead),
    ...items.filter(n => !n.isActionRequired || n.isRead),
  ];

  if (mode === "renter" && !customerEmail) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center w-9 h-9 rounded-full transition-colors hover:bg-black/10 focus:outline-none"
        aria-label="Notifications"
      >
        <Bell
          className="w-5 h-5"
          style={{ color: iconColor ?? "currentColor" }}
        />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-0.5 leading-none shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] max-w-[calc(100vw-24px)] bg-white rounded-xl shadow-2xl border border-gray-100 z-[200] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-900">Notifications</span>
              {actionItems.length > 0 && (
                <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {actionItems.length} need{actionItems.length === 1 ? "s" : ""} action
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[420px] divide-y divide-gray-50">
            {sortedItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
                <Bell className="w-8 h-8 opacity-30" />
                <p className="text-sm">All caught up!</p>
              </div>
            )}
            {sortedItems.map(n => {
              const Icon = TYPE_ICON[n.type] ?? Bell;
              const iconClr = TYPE_COLOR[n.type] ?? "#6b7280";
              const isUnread = !n.isRead;
              const isAction = n.isActionRequired && isUnread;

              return (
                <button
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={[
                    "w-full text-left flex items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50",
                    isUnread ? "bg-blue-50/40" : "bg-white",
                  ].join(" ")}
                  style={isAction ? { borderLeft: "3px solid #f59e0b" } : { borderLeft: "3px solid transparent" }}
                >
                  <div
                    className="mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${iconClr}18` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: iconClr }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${isUnread ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                        {n.title}
                        {isAction && (
                          <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-400 align-middle" />
                        )}
                      </p>
                      <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug line-clamp-2">{n.body}</p>
                    {n.actionUrl && (
                      <p className="text-xs text-blue-500 font-medium mt-1">View →</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
