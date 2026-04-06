import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Package, CalendarDays, DollarSign, ChevronRight } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

export function BecomeHostPage({ onAuthOpen }: { onAuthOpen: () => void }) {
  const { customer, setHostInfo } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState(customer ? `${customer.name}'s Rentals` : "");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const becomeMutation = useMutation({
    mutationFn: () =>
      api.host.become(customer!.id, { displayName, city, state }),
    onSuccess: (data) => {
      setHostInfo(data);
      toast({ title: "Host account created! Welcome to OutdoorShare Hosting." });
      setLocation("/host");
    },
    onError: (err: Error) => {
      if (err.message.includes("already exists")) {
        setLocation("/host");
        return;
      }
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) {
      onAuthOpen();
      return;
    }
    becomeMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-3">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img
              src={`${BASE_URL}/outdoorshare-logo-transparent.png`}
              alt="OutdoorShare"
              className="h-10 w-10 object-contain"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            <span className="font-bold text-primary">OutdoorShare</span>
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Left: info */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              List your outdoor gear,<br />
              <span className="text-primary">earn on your terms.</span>
            </h1>
            <p className="text-gray-500 mb-8">
              Become a Host on OutdoorShare and connect your gear with adventurers nearby. 
              Manage everything from your personal host dashboard — completely free to get started.
            </p>

            <div className="space-y-4">
              <Feature
                icon={Package}
                title="List in minutes"
                description="Create your first listing with photos, pricing, and availability in just a few steps."
              />
              <Feature
                icon={CalendarDays}
                title="Manage bookings easily"
                description="Your personal dashboard shows all incoming bookings and renter details."
              />
              <Feature
                icon={DollarSign}
                title="Earn from what you own"
                description="Set your own rates and get paid for gear that would otherwise sit in the garage."
              />
            </div>
          </div>

          {/* Right: form */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            {!customer ? (
              <div className="text-center">
                <div className="bg-primary/10 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-4">
                  <Package className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in to continue</h2>
                <p className="text-gray-500 text-sm mb-6">
                  Create a free marketplace account or sign in to become a Host.
                </p>
                <Button
                  onClick={onAuthOpen}
                  className="w-full bg-primary hover:bg-primary/90 text-white"
                >
                  Sign In / Register
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-6">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="text-sm font-medium text-gray-700">Signed in as {customer.email}</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Set up your host profile</h2>
                <p className="text-gray-500 text-sm mb-6">This is how you'll appear to renters on OutdoorShare.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Host Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      placeholder="e.g. Jake's Outdoor Gear"
                      required
                    />
                    <p className="text-xs text-gray-400 mt-1">This appears on your listings on OutdoorShare.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Denver" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                      <Input value={state} onChange={e => setState(e.target.value)} placeholder="CO" />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-white mt-2"
                    disabled={becomeMutation.isPending}
                  >
                    {becomeMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating host account...</>
                    ) : (
                      <>Create Host Account <ChevronRight className="h-4 w-4 ml-1" /></>
                    )}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, title, description }: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="bg-primary/10 rounded-lg p-2.5 flex-shrink-0 h-10 w-10 flex items-center justify-center">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="font-semibold text-gray-900 text-sm">{title}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </div>
  );
}
