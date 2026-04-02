import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Phone, MapPin, Shield, CheckCircle2, Clock, AlertCircle, Save, ArrowLeft, Lock } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = import.meta.env.VITE_API_URL ?? "";

interface CustomerSession {
  id: number;
  email: string;
  name: string;
  phone?: string;
}

interface CustomerProfile {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  billingAddress: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingZip: string | null;
  cardLastFour: string | null;
  cardBrand: string | null;
  identityVerificationStatus: string | null;
  createdAt: string;
}

function loadSession(): CustomerSession | null {
  try {
    const raw = localStorage.getItem("rental_customer");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(c: CustomerSession) {
  localStorage.setItem("rental_customer", JSON.stringify(c));
}

function VerificationBadge({ status }: { status: string | null }) {
  if (!status || status === "unverified") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
        <AlertCircle className="w-3.5 h-3.5" /> Not verified
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
        <Clock className="w-3.5 h-3.5" /> Verification pending
      </span>
    );
  }
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
        <CheckCircle2 className="w-3.5 h-3.5" /> Identity verified
      </span>
    );
  }
  return null;
}

export default function StorefrontProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();

  const [session, setSession] = useState<CustomerSession | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    billingAddress: "",
    billingCity: "",
    billingState: "",
    billingZip: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      navigate(`${BASE}/${slug}/login`);
      return;
    }
    setSession(s);
    fetch(`${API}/api/customers/${s.id}`)
      .then(r => r.json())
      .then((data: CustomerProfile) => {
        setProfile(data);
        setForm({
          name: data.name ?? "",
          phone: data.phone ?? "",
          billingAddress: data.billingAddress ?? "",
          billingCity: data.billingCity ?? "",
          billingState: data.billingState ?? "",
          billingZip: data.billingZip ?? "",
        });
      })
      .catch(() => setError("Failed to load profile"))
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !profile) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${API}/api/customers/${session.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          billingAddress: form.billingAddress.trim() || null,
          billingCity: form.billingCity.trim() || null,
          billingState: form.billingState.trim() || null,
          billingZip: form.billingZip.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const updated: CustomerProfile = await res.json();
      setProfile(updated);
      const newSession = { ...session, name: updated.name, phone: updated.phone ?? undefined };
      saveSession(newSession);
      setSession(newSession);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setPasswordError(null);
    setPasswordSuccess(false);
    if (passwordForm.newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords don't match.");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch(`${API}/api/customers/${session.id}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to change password");
      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setPasswordError(err.message ?? "Failed to change password.");
    } finally {
      setSavingPassword(false);
    }
  }

  const initials = session?.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "";

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center text-gray-400">
        Loading profile…
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <button
        onClick={() => navigate(`${BASE}/${slug}/my-bookings`)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to My Bookings
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-white text-xl font-bold shrink-0">
          {initials || <User className="w-7 h-7" />}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{profile?.name ?? session?.name}</h1>
          <p className="text-sm text-gray-500">{profile?.email}</p>
          {profile && <div className="mt-1.5"><VerificationBadge status={profile.identityVerificationStatus} /></div>}
        </div>
      </div>

      {/* Personal Details */}
      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-gray-400" /> Personal Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="email" className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 block">
                Email address
              </Label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-gray-50 text-gray-500 text-sm">
                <Mail className="w-4 h-4 shrink-0" />
                <span>{profile?.email}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="name" className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 block">
                Full name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Your full name"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="phone" className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 block">
                Phone number
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="(555) 000-0000"
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Billing Address */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-gray-400" /> Billing Address
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="billingAddress" className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 block">
                Street address
              </Label>
              <Input
                id="billingAddress"
                value={form.billingAddress}
                onChange={e => setForm(f => ({ ...f, billingAddress: e.target.value }))}
                placeholder="123 Main St"
              />
            </div>
            <div>
              <Label htmlFor="billingCity" className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 block">
                City
              </Label>
              <Input
                id="billingCity"
                value={form.billingCity}
                onChange={e => setForm(f => ({ ...f, billingCity: e.target.value }))}
                placeholder="City"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="billingState" className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 block">
                  State
                </Label>
                <Input
                  id="billingState"
                  value={form.billingState}
                  onChange={e => setForm(f => ({ ...f, billingState: e.target.value }))}
                  placeholder="CA"
                  maxLength={2}
                />
              </div>
              <div>
                <Label htmlFor="billingZip" className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 block">
                  ZIP
                </Label>
                <Input
                  id="billingZip"
                  value={form.billingZip}
                  onChange={e => setForm(f => ({ ...f, billingZip: e.target.value }))}
                  placeholder="90210"
                  maxLength={10}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Saved card info */}
        {(profile?.cardLastFour || profile?.cardBrand) && (
          <>
            <Separator />
            <div>
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-gray-400" /> Payment Method on File
              </h2>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-gray-50 text-sm text-gray-600 w-fit">
                <span className="font-medium capitalize">{profile.cardBrand}</span>
                <span>ending in <strong>{profile.cardLastFour}</strong></span>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Card details are managed securely by Stripe and cannot be edited here.</p>
            </div>
          </>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-2.5 rounded-lg">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 px-4 py-2.5 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Profile updated successfully.
          </p>
        )}

        <Button type="submit" disabled={saving} className="w-full sm:w-auto">
          {saving ? (
            <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</span>
          ) : (
            <span className="flex items-center gap-2"><Save className="w-4 h-4" /> Save Changes</span>
          )}
        </Button>
      </form>

      <Separator className="my-8" />

      {/* Change Password */}
      <form onSubmit={handlePasswordChange} className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Lock className="w-4 h-4 text-gray-400" /> Change Password
        </h2>
        <div className="space-y-3">
          <div>
            <Label htmlFor="currentPassword" className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 block">
              Current password
            </Label>
            <Input
              id="currentPassword"
              type="password"
              value={passwordForm.currentPassword}
              onChange={e => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))}
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <Label htmlFor="newPassword" className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 block">
              New password
            </Label>
            <Input
              id="newPassword"
              type="password"
              value={passwordForm.newPassword}
              onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword" className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 block">
              Confirm new password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
              placeholder="••••••••"
              required
            />
          </div>
        </div>
        {passwordError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-2.5 rounded-lg">{passwordError}</p>
        )}
        {passwordSuccess && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 px-4 py-2.5 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Password changed successfully.
          </p>
        )}
        <Button type="submit" variant="outline" disabled={savingPassword} className="w-full sm:w-auto">
          {savingPassword ? (
            <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" /> Updating…</span>
          ) : (
            "Update Password"
          )}
        </Button>
      </form>
    </div>
  );
}
