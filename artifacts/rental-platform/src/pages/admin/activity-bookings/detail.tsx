import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { adminPath, getAdminSession } from "@/lib/admin-nav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Calendar, Clock, Users, Mail, Phone, MessageSquare,
  CheckCircle2, PlayCircle, XCircle, Flag, Loader2, Edit3, Save, X,
} from "lucide-react";
import { format, parseISO } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

type ActivityBooking = {
  id: number;
  activityId: number;
  activityTitle: string;
  activityPricePerPerson: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  selectedDate: string | null;
  selectedTime: string | null;
  guestCount: number;
  totalAmount: number;
  status: "pending" | "confirmed" | "active" | "completed" | "cancelled";
  notes: string | null;
  adminNotes: string | null;
  seenByAdmin: boolean;
  createdAt: string;
  updatedAt: string;
};

function adminFetch(path: string, opts?: RequestInit) {
  const session = getAdminSession();
  const slug = session?.tenantSlug ?? "";
  const authHeaders: Record<string, string> = {};
  if (session?.token) authHeaders["x-admin-token"] = session.token;
  if (slug) authHeaders["x-tenant-slug"] = slug;
  return fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(opts?.headers ?? {}),
    },
  });
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: "Pending", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  confirmed: { label: "Confirmed", color: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
  active: { label: "In Progress", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  completed: { label: "Completed", color: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200" },
  cancelled: { label: "Cancelled", color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
};

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export default function AdminActivityBookingDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editingNotes, setEditingNotes] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");

  const { data: booking, isLoading } = useQuery({
    queryKey: ["admin-activity-booking", id],
    queryFn: async () => {
      const res = await adminFetch(`/activities/bookings/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json() as Promise<ActivityBooking>;
    },
    onSuccess: (d) => { if (!editingNotes) setAdminNotes(d.adminNotes ?? ""); },
  } as any);

  const updateMutation = useMutation({
    mutationFn: async (updates: { status?: string; adminNotes?: string }) => {
      const res = await adminFetch(`/activities/bookings/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Update failed"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-activity-booking", id] });
      qc.invalidateQueries({ queryKey: ["admin-activity-bookings"] });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  async function changeStatus(status: string) {
    await updateMutation.mutateAsync({ status });
    toast({ title: `Booking marked as ${STATUS_CONFIG[status]?.label ?? status}` });
  }

  async function saveNotes() {
    await updateMutation.mutateAsync({ adminNotes });
    setEditingNotes(false);
    toast({ title: "Notes saved" });
  }

  if (isLoading) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;
  if (!booking) return <div className="py-12 text-center text-muted-foreground">Booking not found.</div>;

  const sc = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;

  const actions: { label: string; icon: React.ElementType; newStatus: string; style: string; show: boolean }[] = [
    {
      label: "Confirm Booking",
      icon: CheckCircle2,
      newStatus: "confirmed",
      style: "bg-green-600 hover:bg-green-700 text-white",
      show: booking.status === "pending",
    },
    {
      label: "Check In (Start Experience)",
      icon: PlayCircle,
      newStatus: "active",
      style: "bg-blue-600 hover:bg-blue-700 text-white",
      show: booking.status === "confirmed",
    },
    {
      label: "Mark as Completed",
      icon: Flag,
      newStatus: "completed",
      style: "bg-gray-700 hover:bg-gray-800 text-white",
      show: booking.status === "active",
    },
    {
      label: "Cancel Booking",
      icon: XCircle,
      newStatus: "cancelled",
      style: "border-red-300 text-red-700 hover:bg-red-50",
      show: ["pending", "confirmed"].includes(booking.status),
    },
  ].filter(a => a.show);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={adminPath("/activity-bookings")}>
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold truncate">Booking #{booking.id}</h2>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${sc.bg} ${sc.color} ${sc.border}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                booking.status === "pending" ? "bg-amber-500" :
                booking.status === "confirmed" ? "bg-green-500" :
                booking.status === "active" ? "bg-blue-500" :
                booking.status === "completed" ? "bg-gray-400" : "bg-red-500"
              }`} />
              {sc.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground truncate">{booking.activityTitle}</p>
        </div>
      </div>

      {/* Action buttons */}
      {actions.length > 0 && !["completed", "cancelled"].includes(booking.status) && (
        <div className="flex flex-wrap gap-2">
          {actions.map(action => (
            <Button
              key={action.newStatus}
              onClick={() => changeStatus(action.newStatus)}
              disabled={updateMutation.isPending}
              variant={action.newStatus === "cancelled" ? "outline" : "default"}
              className={`gap-2 ${action.style}`}
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <action.icon className="w-4 h-4" />}
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* Progress tracker */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Booking Progress</h3>
        <div className="flex items-center gap-0">
          {(["pending", "confirmed", "active", "completed"] as const).map((s, i, arr) => {
            const statuses = ["pending", "confirmed", "active", "completed", "cancelled"];
            const currentIdx = statuses.indexOf(booking.status);
            const stepIdx = statuses.indexOf(s);
            const done = booking.status === "cancelled" ? false : currentIdx >= stepIdx;
            const current = booking.status === s;
            const labels = ["Requested", "Confirmed", "In Progress", "Completed"];
            return (
              <div key={s} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    done
                      ? "bg-green-600 border-green-600 text-white"
                      : current
                      ? "bg-primary border-primary text-white"
                      : "bg-gray-100 border-gray-200 text-gray-400"
                  }`}>
                    {i + 1}
                  </div>
                  <p className={`text-xs mt-1.5 font-medium whitespace-nowrap ${done ? "text-green-700" : "text-gray-400"}`}>
                    {labels[i]}
                  </p>
                </div>
                {i < arr.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 -mt-5 ${done && currentIdx > stepIdx ? "bg-green-500" : "bg-gray-200"}`} />
                )}
              </div>
            );
          })}
        </div>
        {booking.status === "cancelled" && (
          <div className="mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
            <XCircle className="w-4 h-4 shrink-0" />
            This booking has been cancelled.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Guest info */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <h3 className="font-semibold text-gray-900">Guest Information</h3>
          <div className="space-y-2.5 text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="font-semibold text-primary text-xs">{booking.customerName[0]?.toUpperCase()}</span>
              </div>
              <span className="font-medium">{booking.customerName}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Mail className="h-4 w-4 text-gray-400 shrink-0" />
              <a href={`mailto:${booking.customerEmail}`} className="hover:text-primary transition-colors">
                {booking.customerEmail}
              </a>
            </div>
            {booking.customerPhone && (
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                <a href={`tel:${booking.customerPhone}`} className="hover:text-primary transition-colors">
                  {booking.customerPhone}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Booking details */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <h3 className="font-semibold text-gray-900">Booking Details</h3>
          <div className="space-y-2.5 text-sm">
            {booking.selectedDate ? (
              <div className="flex items-center gap-2 text-gray-700">
                <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                <span>{format(parseISO(booking.selectedDate), "EEEE, MMMM d, yyyy")}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>Open date request — coordinate with guest</span>
              </div>
            )}
            {booking.selectedTime && (
              <div className="flex items-center gap-2 text-gray-700">
                <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                <span>{fmtTime(booking.selectedTime)}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-gray-700">
              <Users className="h-4 w-4 text-gray-400 shrink-0" />
              <span>{booking.guestCount} guest{booking.guestCount !== 1 ? "s" : ""}</span>
            </div>
            <div className="border-t border-gray-100 pt-2.5">
              <div className="flex justify-between text-gray-500">
                <span>${booking.activityPricePerPerson.toFixed(0)} × {booking.guestCount}</span>
                <span>${booking.totalAmount.toFixed(0)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 mt-1">
                <span>Total</span>
                <span>${booking.totalAmount.toFixed(0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Guest notes */}
      {booking.notes && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-gray-400" />
            Guest Notes
          </h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{booking.notes}</p>
        </div>
      )}

      {/* Admin notes */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Admin Notes</h3>
          {!editingNotes ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => { setAdminNotes(booking.adminNotes ?? ""); setEditingNotes(true); }}
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => setEditingNotes(false)}>
                <X className="w-3 h-3" /> Cancel
              </Button>
              <Button size="sm" className="gap-1 text-xs bg-primary text-white" onClick={saveNotes} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save
              </Button>
            </div>
          )}
        </div>
        {editingNotes ? (
          <Textarea
            value={adminNotes}
            onChange={e => setAdminNotes(e.target.value)}
            placeholder="Internal notes about this booking…"
            rows={3}
            className="resize-none text-sm"
            autoFocus
          />
        ) : (
          <p className={`text-sm ${booking.adminNotes ? "text-gray-700 whitespace-pre-wrap" : "text-gray-400 italic"}`}>
            {booking.adminNotes || "No notes yet"}
          </p>
        )}
      </div>

      {/* Meta */}
      <p className="text-xs text-gray-400">
        Created {format(parseISO(booking.createdAt), "MMM d, yyyy 'at' h:mm a")} ·
        Last updated {format(parseISO(booking.updatedAt), "MMM d, yyyy 'at' h:mm a")}
      </p>
    </div>
  );
}
