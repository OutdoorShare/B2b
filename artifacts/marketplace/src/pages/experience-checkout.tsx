import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Loader2, Users, Calendar, Clock, CheckCircle2, AlertCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";

const API_BASE = "/api";
const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

function resolveImage(url: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `/api/uploads/${url.split("/").pop()}`;
}

function useQueryParams() {
  const search = typeof window !== "undefined" ? window.location.search : "";
  return new URLSearchParams(search);
}

export function ExperienceCheckoutPage() {
  const [, params] = useRoute("/experiences/:id/book");
  const [, navigate] = useLocation();
  const activityId = parseInt(params?.id ?? "0");
  const qp = useQueryParams();

  const selectedDate = qp.get("date") ?? "";
  const selectedTime = qp.get("time") ?? "";
  const guestCount = parseInt(qp.get("guests") ?? "1") || 1;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { data: activity, isLoading } = useQuery({
    queryKey: ["marketplace-activity", activityId],
    queryFn: () => api.marketplace.activity(activityId),
    enabled: !!activityId,
  });

  const pricePerPerson = activity?.pricePerPerson ?? 0;
  const total = pricePerPerson * guestCount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!email.trim() || !email.includes("@")) { setError("Please enter a valid email address."); return; }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/activity-bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId,
          customerName: name.trim(),
          customerEmail: email.trim(),
          customerPhone: phone.trim() || undefined,
          selectedDate: selectedDate || undefined,
          selectedTime: selectedTime || undefined,
          guestCount,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Something went wrong. Please try again.");
        return;
      }
      const { id } = await res.json();
      navigate(`/experiences/booking/${id}`);
    } catch {
      setError("Could not submit your booking. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">😕</div>
          <h2 className="text-xl font-semibold mb-4">Experience not found</h2>
          <Button variant="outline" onClick={() => navigate(`/experiences`)}>
            Browse Experiences
          </Button>
        </div>
      </div>
    );
  }

  const coverImage = activity.imageUrls?.[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
          <button
            onClick={() => navigate(`/experiences/${activityId}`)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Experience
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Complete your booking request</h1>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* ── Contact form ── */}
          <div className="lg:col-span-3">
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
              <h2 className="font-semibold text-gray-900 text-lg">Your contact info</h2>

              <div className="space-y-1.5">
                <Label htmlFor="name">Full name <span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Jane Smith"
                  autoComplete="name"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email address <span className="text-red-500">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jane@email.com"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone number <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  autoComplete="tel"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">Special requests or questions <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any accessibility needs, dietary restrictions, or questions for the guide…"
                  rows={3}
                  className="resize-none"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…</>
                ) : (
                  "Request to Book"
                )}
              </Button>

              <p className="text-xs text-center text-gray-400">
                No payment required now. {activity.tenantName} will review your request and confirm availability.
              </p>
            </form>
          </div>

          {/* ── Summary card ── */}
          <div className="lg:col-span-2">
            <div className="sticky top-6 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {coverImage && (
                <img
                  src={resolveImage(coverImage)}
                  alt={activity.title}
                  className="w-full h-36 object-cover"
                />
              )}
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{activity.tenantName}</p>
                  <h3 className="font-bold text-gray-900 text-lg leading-snug mt-0.5">{activity.title}</h3>
                </div>

                <div className="space-y-2.5 text-sm">
                  {selectedDate && (
                    <div className="flex items-center gap-2.5 text-gray-700">
                      <Calendar className="h-4 w-4 text-primary shrink-0" />
                      <span>{format(parseISO(selectedDate), "EEEE, MMMM d, yyyy")}</span>
                    </div>
                  )}
                  {selectedTime && (
                    <div className="flex items-center gap-2.5 text-gray-700">
                      <Clock className="h-4 w-4 text-primary shrink-0" />
                      <span>{(() => {
                        const [h, m] = selectedTime.split(":").map(Number);
                        return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
                      })()}</span>
                    </div>
                  )}
                  {!selectedDate && (
                    <div className="flex items-center gap-2.5 text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                      <Calendar className="h-4 w-4 shrink-0" />
                      <span className="text-xs">You'll coordinate a date with {activity.tenantName} after booking.</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 text-gray-700">
                    <Users className="h-4 w-4 text-primary shrink-0" />
                    <span>{guestCount} guest{guestCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3 space-y-1.5">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>${pricePerPerson.toFixed(0)} × {guestCount} guest{guestCount !== 1 ? "s" : ""}</span>
                    <span>${total.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-100 pt-1.5">
                    <span>Total</span>
                    <span>${total.toFixed(0)}</span>
                  </div>
                </div>

                <div className="rounded-xl bg-green-50 border border-green-100 p-3 text-xs text-green-800 space-y-1">
                  <p className="font-semibold">What happens next?</p>
                  <p>Your request is sent to {activity.tenantName}. They'll review it and confirm your booking — typically within 24 hours.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
