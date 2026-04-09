import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, Calendar, Clock, Users, Mail, ArrowRight, Home,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import confetti from "canvas-confetti";

const API_BASE = "/api";
const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Awaiting Confirmation", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  confirmed: { label: "Confirmed", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  active: { label: "Experience Active", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  completed: { label: "Completed", color: "text-gray-700", bg: "bg-gray-50 border-gray-200" },
  cancelled: { label: "Cancelled", color: "text-red-700", bg: "bg-red-50 border-red-200" },
};

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function fireConfetti() {
  const count = 180;
  const duration = 1800;
  const start = Date.now();
  const defaults = { startVelocity: 30, spread: 360, ticks: 80, zIndex: 9999 };

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  const interval = setInterval(() => {
    const elapsed = Date.now() - start;
    if (elapsed >= duration) {
      clearInterval(interval);
      return;
    }
    const particleCount = Math.floor(count * (1 - elapsed / duration));
    confetti({ ...defaults, particleCount, colors: ["#3ab549", "#22c55e", "#86efac", "#ffffff", "#60a5fa"], origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
    confetti({ ...defaults, particleCount, colors: ["#3ab549", "#22c55e", "#86efac", "#ffffff", "#60a5fa"], origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
  }, 220);
}

export function ExperienceBookingConfirmPage() {
  const [, params] = useRoute("/experiences/booking/:id");
  const [, navigate] = useLocation();
  const bookingId = parseInt(params?.id ?? "0");

  const { data: booking, isLoading } = useQuery({
    queryKey: ["activity-booking-public", bookingId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/activity-bookings/${bookingId}/public`);
      if (!res.ok) throw new Error("Not found");
      return res.json() as Promise<{
        id: number;
        activityTitle: string;
        selectedDate: string | null;
        selectedTime: string | null;
        guestCount: number;
        totalAmount: number;
        status: string;
        customerName: string;
        customerEmail: string;
        createdAt: string;
      }>;
    },
    enabled: !!bookingId,
  });

  useEffect(() => {
    if (booking) {
      const timer = setTimeout(fireConfetti, 300);
      return () => clearTimeout(timer);
    }
  }, [!!booking]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-4xl">😕</div>
          <h2 className="text-xl font-semibold">Booking not found</h2>
          <Button variant="outline" onClick={() => navigate(`${BASE_URL}/experiences`)}>
            Browse Experiences
          </Button>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        {/* Success header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Booking Request Sent!</h1>
          <p className="text-gray-500 mt-2">You'll receive a confirmation email once {booking.activityTitle.split(" ").slice(0, 3).join(" ")} reviews your request.</p>
        </div>

        {/* Booking card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-primary/5 border-b border-primary/10 px-6 py-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Booking #{booking.id}</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusInfo.bg} ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            <h2 className="font-bold text-gray-900 text-xl mt-1">{booking.activityTitle}</h2>
          </div>

          <div className="px-6 py-5 space-y-3">
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <Mail className="h-4 w-4 text-gray-400 shrink-0" />
              <span>{booking.customerName} · {booking.customerEmail}</span>
            </div>
            {booking.selectedDate && (
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                <span>{format(parseISO(booking.selectedDate), "EEEE, MMMM d, yyyy")}</span>
              </div>
            )}
            {booking.selectedTime && (
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                <span>{fmtTime(booking.selectedTime)}</span>
              </div>
            )}
            {!booking.selectedDate && (
              <div className="flex items-center gap-3 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>Date to be confirmed with the host</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <Users className="h-4 w-4 text-gray-400 shrink-0" />
              <span>{booking.guestCount} guest{booking.guestCount !== 1 ? "s" : ""}</span>
            </div>
          </div>

          <div className="border-t border-gray-100 px-6 py-4 bg-gray-50">
            <div className="flex justify-between font-bold text-gray-900">
              <span>Total</span>
              <span>${booking.totalAmount.toFixed(0)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Payment will be arranged with the host</p>
          </div>
        </div>

        {/* Next steps */}
        <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm">What happens next?</h3>
          <div className="space-y-2.5">
            {[
              "Your request has been sent to the host for review.",
              "You'll receive an email when your booking is confirmed.",
              booking.selectedDate
                ? "Show up at the confirmed time and enjoy your experience!"
                : "The host will reach out to schedule your preferred date.",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                <div className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </div>
                {step}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => navigate(`/experiences`)}
          >
            <Home className="h-4 w-4" /> Browse More
          </Button>
          <Button
            className="flex-1 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => navigate(`/experiences`)}
          >
            Explore Experiences <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
