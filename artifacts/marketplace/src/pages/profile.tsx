import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  User, LogOut, Calendar, ExternalLink, ArrowLeft,
  Settings, CreditCard, Lock, MapPin, Trash2, CheckCircle2,
  Phone, Mail, Loader2, AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

const API_UPLOAD_BASE = "/api/uploads/";
function resolveImage(url: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_UPLOAD_BASE}${url.split("/").pop()}`;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  active: "bg-primary/10 text-primary",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
};

type Tab = "bookings" | "settings";

export function ProfilePage({ onAuthOpen }: { onAuthOpen: () => void }) {
  const { customer, updateCustomer, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") === "settings" ? "settings" : "bookings";
  });

  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["renter-bookings", customer?.id],
    queryFn: () => api.marketplace.renterBookings(customer!.id),
    enabled: !!customer,
  });

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <User className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Sign in to view your account</h2>
          <p className="text-gray-500 mb-6">Track bookings and manage your info across all OutdoorShare companies</p>
          <Button onClick={onAuthOpen} className="bg-brand-blue hover:bg-brand-blue/90 text-white">Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Browse
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
              {customer.name[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{customer.name}</h1>
              <p className="text-sm text-gray-500">{customer.email}</p>
              {customer.phone && <p className="text-xs text-gray-400 mt-0.5">{customer.phone}</p>}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={logout} className="gap-2 text-red-600 hover:text-red-700 hover:border-red-300 flex-shrink-0">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => setTab("bookings")}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-lg transition-all ${
              tab === "bookings" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Calendar className="h-4 w-4" />
            My Bookings {bookings && <span className="text-xs text-gray-400">({bookings.length})</span>}
          </button>
          <button
            onClick={() => setTab("settings")}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-lg transition-all ${
              tab === "settings" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>

        {tab === "bookings" && (
          <BookingsTab bookings={bookings} isLoading={bookingsLoading} onBrowse={() => setLocation("/")} />
        )}

        {tab === "settings" && (
          <SettingsTab customer={customer} updateCustomer={updateCustomer} toast={toast} />
        )}
      </div>
    </div>
  );
}

function BookingsTab({
  bookings,
  isLoading,
  onBrowse,
}: {
  bookings: ReturnType<typeof api.marketplace.renterBookings> extends Promise<infer T> ? T | undefined : never;
  isLoading: boolean;
  onBrowse: () => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
            <div className="flex gap-4">
              <div className="h-20 w-24 bg-gray-200 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-3 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-200 rounded w-1/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!bookings || bookings.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
        <div className="text-4xl mb-3">📋</div>
        <h3 className="font-semibold text-gray-700 mb-1">No bookings yet</h3>
        <p className="text-sm text-gray-400 mb-5">When you book a rental, it'll appear here</p>
        <Button onClick={onBrowse} className="bg-primary hover:bg-primary/90 text-white">Browse Listings</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {bookings.map(booking => (
        <div key={booking.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
          <div className="flex gap-4 items-start">
            <div className="h-20 w-24 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100">
              {booking.listingImage ? (
                <img src={resolveImage(booking.listingImage)} alt={booking.listingTitle} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">🏕️</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-800 text-sm line-clamp-1">{booking.listingTitle}</h3>
                <Badge className={`text-xs ${statusColors[booking.status] || "bg-gray-100 text-gray-700"}`}>
                  {booking.status}
                </Badge>
              </div>
              {booking.businessName && (
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                  {booking.businessLogoUrl && (
                    <img src={resolveImage(booking.businessLogoUrl)} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
                  )}
                  <span>{booking.businessName}</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                <Calendar className="h-3 w-3" />
                <span>{format(new Date(booking.startDate), "MMM d")} – {format(new Date(booking.endDate), "MMM d, yyyy")}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-semibold text-gray-800">${parseFloat(booking.totalPrice).toFixed(2)}</span>
                {booking.tenantSlug && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-primary hover:text-primary gap-1 pr-0"
                    onClick={() => window.open(`/${booking.tenantSlug}`, "_blank")}
                  >
                    View company <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SettingsTab({
  customer,
  updateCustomer,
  toast,
}: {
  customer: NonNullable<ReturnType<typeof useAuth>["customer"]>;
  updateCustomer: (c: NonNullable<ReturnType<typeof useAuth>["customer"]>) => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  return (
    <div className="space-y-5">
      <PersonalInfoSection customer={customer} updateCustomer={updateCustomer} toast={toast} />
      <BillingAddressSection customer={customer} updateCustomer={updateCustomer} toast={toast} />
      <PaymentMethodSection customer={customer} updateCustomer={updateCustomer} toast={toast} />
      <PasswordSection customer={customer} toast={toast} />
    </div>
  );
}

function PersonalInfoSection({ customer, updateCustomer, toast }: {
  customer: NonNullable<ReturnType<typeof useAuth>["customer"]>;
  updateCustomer: (c: any) => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [saving, setSaving] = useState(false);

  const isDirty = name !== customer.name || phone !== (customer.phone ?? "");

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const updated = await api.customers.updateProfile(customer.id, {
        name: name.trim(),
        phone: phone.trim() || undefined,
      });
      updateCustomer(updated);
      toast({ title: "Personal info saved", description: "Your name and phone have been updated." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-1">
        <User className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-gray-900">Personal Information</h2>
      </div>
      <p className="text-xs text-gray-400 mb-5">Your name and contact details visible to rental companies.</p>

      <div className="space-y-4">
        {/* Email — read only */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Email address
          </label>
          <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-500 cursor-default">
            {customer.email}
            <span className="ml-auto text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Read-only</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Email is your login and cannot be changed.</p>
        </div>

        {/* Full name */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> Full name
          </label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your full name"
            className="h-10"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" /> Phone number
          </label>
          <Input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="(555) 000-0000"
            className="h-10"
          />
        </div>
      </div>

      {isDirty && (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-white gap-2"
            size="sm"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Save Changes
          </Button>
        </div>
      )}
    </section>
  );
}

function BillingAddressSection({ customer, updateCustomer, toast }: {
  customer: NonNullable<ReturnType<typeof useAuth>["customer"]>;
  updateCustomer: (c: any) => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [address, setAddress] = useState(customer.billingAddress ?? "");
  const [city, setCity] = useState(customer.billingCity ?? "");
  const [state, setState] = useState(customer.billingState ?? "");
  const [zip, setZip] = useState(customer.billingZip ?? "");
  const [saving, setSaving] = useState(false);

  const isDirty =
    address !== (customer.billingAddress ?? "") ||
    city !== (customer.billingCity ?? "") ||
    state !== (customer.billingState ?? "") ||
    zip !== (customer.billingZip ?? "");

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.customers.updateProfile(customer.id, {
        billingAddress: address.trim() || undefined,
        billingCity: city.trim() || undefined,
        billingState: state.trim() || undefined,
        billingZip: zip.trim() || undefined,
      });
      updateCustomer(updated);
      toast({ title: "Billing address saved" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-1">
        <MapPin className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-gray-900">Billing Address</h2>
      </div>
      <p className="text-xs text-gray-400 mb-5">Used for receipts and any mailed documents.</p>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Street address</label>
          <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main Street" className="h-10" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">City</label>
            <Input value={city} onChange={e => setCity(e.target.value)} placeholder="City" className="h-10" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">State</label>
            <Input value={state} onChange={e => setState(e.target.value)} placeholder="TX" maxLength={2} className="h-10 uppercase" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">ZIP code</label>
            <Input value={zip} onChange={e => setZip(e.target.value)} placeholder="78701" className="h-10" />
          </div>
        </div>
      </div>

      {isDirty && (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-white gap-2"
            size="sm"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Save Address
          </Button>
        </div>
      )}
    </section>
  );
}

function PaymentMethodSection({ customer, updateCustomer, toast }: {
  customer: NonNullable<ReturnType<typeof useAuth>["customer"]>;
  updateCustomer: (c: any) => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [removing, setRemoving] = useState(false);

  const hasCard = !!(customer.cardLastFour && customer.cardBrand);
  const brandLabel = customer.cardBrand
    ? customer.cardBrand.charAt(0).toUpperCase() + customer.cardBrand.slice(1)
    : "Card";

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const updated = await api.customers.removeCard(customer.id);
      updateCustomer(updated);
      toast({ title: "Card removed", description: "Your saved card has been removed." });
    } catch (err: any) {
      toast({ title: "Failed to remove card", description: err.message, variant: "destructive" });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-1">
        <CreditCard className="h-4 w-4 text-brand-blue" />
        <h2 className="font-semibold text-gray-900">Payment Method</h2>
      </div>
      <p className="text-xs text-gray-400 mb-5">
        Your card is saved automatically after your first booking and used for faster checkout on future rentals.
      </p>

      {hasCard ? (
        <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-14 rounded-lg bg-gradient-to-br from-brand-blue to-blue-700 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{brandLabel} •••• {customer.cardLastFour}</p>
              <p className="text-xs text-gray-400">Saved payment method</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={removing}
            className="text-red-500 hover:text-red-600 hover:bg-red-50 gap-1.5"
          >
            {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Remove
          </Button>
        </div>
      ) : (
        <div className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-4">
          <AlertCircle className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-600">No saved payment method</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Your card will be saved securely when you complete your next booking, enabling faster checkout in the future.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function PasswordSection({
  customer,
  toast,
}: {
  customer: NonNullable<ReturnType<typeof useAuth>["customer"]>;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = current.length > 0 && next.length >= 6 && next === confirm;

  const handleSave = async () => {
    if (next !== confirm) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    if (next.length < 6) { toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await api.customers.changePassword(customer.id, current, next);
      toast({ title: "Password changed", description: "You'll use your new password on next sign-in." });
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err: any) {
      toast({ title: "Password change failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-1">
        <Lock className="h-4 w-4 text-gray-500" />
        <h2 className="font-semibold text-gray-900">Change Password</h2>
      </div>
      <p className="text-xs text-gray-400 mb-5">Use a strong password of at least 6 characters.</p>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Current password</label>
          <Input type="password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="••••••••" className="h-10" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">New password</label>
          <Input type="password" value={next} onChange={e => setNext(e.target.value)} placeholder="••••••••" className="h-10" />
          {next.length > 0 && next.length < 6 && (
            <p className="text-[11px] text-red-500 mt-1">At least 6 characters required</p>
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Confirm new password</label>
          <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" className="h-10" />
          {confirm.length > 0 && next !== confirm && (
            <p className="text-[11px] text-red-500 mt-1">Passwords don't match</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="bg-gray-800 hover:bg-gray-900 text-white gap-2"
          size="sm"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
          Update Password
        </Button>
      </div>
    </section>
  );
}
