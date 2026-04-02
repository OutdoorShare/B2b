import { useState, useEffect } from "react";
import { MessageSquarePlus, Star, CheckCircle2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAdminSlug } from "@/lib/admin-nav";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getAdminInfo() {
  try {
    const raw = localStorage.getItem("admin_session");
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export default function AdminFeedback() {
  const slug = getAdminSlug();
  const adminInfo = getAdminInfo();

  // Derive submitter identity from session — no input fields needed
  const submitterEmail: string = adminInfo?.email ?? "";
  const submitterName: string =
    adminInfo?.name ||
    (adminInfo?.tenantName ? `${adminInfo.tenantName} (Owner)` : submitterEmail);
  const submitterRole: string =
    adminInfo?.type === "owner" ? "Company Owner" :
    adminInfo?.role ? (adminInfo.role.charAt(0).toUpperCase() + adminInfo.role.slice(1)) :
    "Team Member";

  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!message.trim()) { setError("Please enter your feedback message."); return; }

    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": slug ?? "" },
        body: JSON.stringify({
          submitterType: "admin",
          submitterName,
          submitterEmail,
          subject: subject.trim() || undefined,
          message: message.trim(),
          rating: rating ?? undefined,
          tenantSlug: slug,
          tenantName: adminInfo?.tenantName || undefined,
          tenantId: adminInfo?.tenantId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to submit feedback."); return; }
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold">Thank you!</h2>
        <p className="text-muted-foreground text-sm">Your feedback has been sent to the OutdoorShare team. We appreciate you taking the time to share your thoughts.</p>
        <Button variant="outline" onClick={() => { setSubmitted(false); setMessage(""); setSubject(""); setRating(null); }}>
          Send more feedback
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2.5">
          <MessageSquarePlus className="w-6 h-6 text-primary" />
          Send Feedback
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Share your thoughts, suggestions, or issues with the OutdoorShare team.
        </p>
      </div>

      <div className="bg-background rounded-2xl border shadow-sm p-6 space-y-5">
        {/* Identity chip — no input required */}
        <div className="flex items-center gap-2.5 rounded-xl bg-muted/60 border px-3 py-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{submitterName}</p>
            <p className="text-xs text-muted-foreground truncate">{submitterEmail} · {submitterRole}</p>
          </div>
        </div>

        {/* Rating */}
        <div className="space-y-2">
          <Label>Overall Rating <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(i => (
              <button
                key={i}
                type="button"
                onClick={() => setRating(i === rating ? null : i)}
                onMouseEnter={() => setHoverRating(i)}
                onMouseLeave={() => setHoverRating(null)}
                className="p-0.5 transition-transform hover:scale-110"
              >
                <Star className={`w-7 h-7 transition-colors ${
                  i <= (hoverRating ?? rating ?? 0)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground/30"
                }`} />
              </button>
            ))}
            {rating && (
              <span className="text-sm text-muted-foreground ml-2">{rating} / 5</span>
            )}
          </div>
        </div>

        {/* Subject */}
        <div className="space-y-1.5">
          <Label htmlFor="fb-subject">Subject <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            id="fb-subject"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="e.g. Feature request, Bug report…"
          />
        </div>

        {/* Message */}
        <div className="space-y-1.5">
          <Label htmlFor="fb-message">Message</Label>
          <Textarea
            id="fb-message"
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Tell us what's working well, what could be better, or anything else on your mind…"
            rows={5}
          />
        </div>

        {error && (
          <p className="text-destructive text-sm">{error}</p>
        )}

        <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Sending…" : "Send Feedback"}
        </Button>
      </div>
    </div>
  );
}
