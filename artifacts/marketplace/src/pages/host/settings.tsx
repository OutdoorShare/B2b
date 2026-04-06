import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/context/auth";
import { HostLayout } from "./layout";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function HostSettingsPage() {
  const { customer } = useAuth();
  const { toast } = useToast();

  const { data: me } = useQuery({
    queryKey: ["host-me", customer?.id],
    queryFn: () => api.host.me(customer!.id),
    enabled: !!customer,
  });

  const [form, setForm] = useState({
    displayName: "",
    description: "",
    city: "",
    state: "",
    phone: "",
    website: "",
  });

  useEffect(() => {
    if (me?.business) {
      setForm({
        displayName: me.business.name ?? me.name ?? "",
        description: me.business.description ?? "",
        city: me.business.city ?? "",
        state: me.business.state ?? "",
        phone: me.business.phone ?? "",
        website: me.business.website ?? "",
      });
    } else if (me) {
      setForm(f => ({ ...f, displayName: me.name }));
    }
  }, [me]);

  const save = useMutation({
    mutationFn: () => api.host.updateSettings(customer!.id, form),
    onSuccess: () => {
      toast({ title: "Settings saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <HostLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Host Settings</h1>
          <p className="text-gray-500 text-sm mt-0.5">Update your host profile visible to renters on OutdoorShare.</p>
        </div>

        <form
          onSubmit={e => { e.preventDefault(); save.mutate(); }}
          className="space-y-6"
        >
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                <Input
                  value={form.displayName}
                  onChange={e => set("displayName", e.target.value)}
                  placeholder="e.g. Jake's Outdoor Adventures"
                />
                <p className="text-xs text-gray-400 mt-1">This name appears on your listings on OutdoorShare.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">About</label>
                <textarea
                  value={form.description}
                  onChange={e => set("description", e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Tell renters a bit about yourself and your adventure..."
                />
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Location & Contact</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Denver" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <Input value={form.state} onChange={e => set("state", e.target.value)} placeholder="CO" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="(555) 555-5555" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <Input value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://example.com" />
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-2">Account Info</h2>
            <div className="text-sm text-gray-500 space-y-1">
              <p><span className="font-medium text-gray-700">Email:</span> {customer?.email}</p>
              <p><span className="font-medium text-gray-700">Name:</span> {customer?.name}</p>
              <p className="text-xs mt-2 text-gray-400">
                To change your account email or password, contact OutdoorShare support.
              </p>
            </div>
          </section>

          <div className="flex justify-end pb-8">
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-white"
              disabled={save.isPending}
            >
              {save.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
              ) : "Save Settings"}
            </Button>
          </div>
        </form>
      </div>
    </HostLayout>
  );
}
