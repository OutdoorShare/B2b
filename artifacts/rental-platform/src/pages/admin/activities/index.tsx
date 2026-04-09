import { useState, useEffect } from "react";
import { Link } from "wouter";
import { adminPath, getAdminSession } from "@/lib/admin-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mountain, Plus, Clock, Users, DollarSign, Pencil, Trash2, ToggleLeft, ToggleRight, Package } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

function adminFetch(path: string, opts?: RequestInit) {
  const session = getAdminSession();
  return fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
}

const CATEGORY_LABELS: Record<string, string> = {
  adventure: "Adventure",
  "water-sport": "Water Sport",
  "guided-tour": "Guided Tour",
  lesson: "Lesson",
  "wildlife-tour": "Wildlife Tour",
  "off-road": "Off-Road",
  camping: "Camping",
  climbing: "Climbing",
  "snow-sport": "Snow Sport",
  fishing: "Fishing",
  other: "Other",
};

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

type Activity = {
  id: number;
  title: string;
  description: string;
  category: string;
  pricePerPerson: number;
  durationMinutes: number;
  maxCapacity: number;
  location: string;
  imageUrls: string[];
  isActive: boolean;
  listingId: number | null;
  requiresRental: boolean;
  linkedListing: { id: number; title: string; pricePerDay: number; imageUrls: string[] } | null;
};

export default function AdminActivities() {
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await adminFetch("/activities");
      if (res.ok) setActivities(await res.json());
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(act: Activity) {
    const res = await adminFetch(`/activities/${act.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...act, isActive: !act.isActive }),
    });
    if (res.ok) {
      setActivities(prev => prev.map(a => a.id === act.id ? { ...a, isActive: !act.isActive } : a));
    }
  }

  async function deleteActivity(id: number) {
    if (!confirm("Delete this activity? This cannot be undone.")) return;
    const res = await adminFetch(`/activities/${id}`, { method: "DELETE" });
    if (res.ok) {
      setActivities(prev => prev.filter(a => a.id !== id));
      toast({ title: "Activity deleted" });
    } else {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Activities</h2>
          <p className="text-muted-foreground mt-1">
            Offer guided experiences, tours, and lessons — shown on the OutdoorShare marketplace as "Experiences"
          </p>
        </div>
        <Link href={adminPath("/activities/new")}>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Activity
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">Loading activities…</div>
      ) : activities.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Mountain className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">No activities yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Add guided tours, lessons, and experiences that customers can book through the marketplace.
            </p>
            <Link href={adminPath("/activities/new")}>
              <Button className="mt-2">
                <Plus className="w-4 h-4 mr-2" /> Add Your First Activity
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activities.map(act => (
            <Card key={act.id} className={`overflow-hidden transition-opacity ${act.isActive ? "" : "opacity-60"}`}>
              {act.imageUrls?.[0] ? (
                <div className="h-40 overflow-hidden">
                  <img src={act.imageUrls[0]} alt={act.title} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="h-40 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                  <Mountain className="w-10 h-10 text-primary/40" />
                </div>
              )}
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold leading-tight">{act.title}</h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {CATEGORY_LABELS[act.category] ?? act.category}
                      </Badge>
                      {act.linkedListing && (
                        <Badge variant="outline" className="text-xs border-blue-200 text-blue-700 bg-blue-50 flex items-center gap-1">
                          <Package className="w-2.5 h-2.5" />
                          {act.requiresRental ? "Rental required" : "Rental included"}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Badge variant={act.isActive ? "default" : "secondary"} className={act.isActive ? "bg-green-600 hover:bg-green-700 shrink-0" : "shrink-0"}>
                    {act.isActive ? "Active" : "Hidden"}
                  </Badge>
                </div>

                {act.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{act.description}</p>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    ${act.pricePerPerson}/person
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(act.durationMinutes)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Up to {act.maxCapacity}
                  </span>
                </div>

                {act.location && (
                  <p className="text-xs text-muted-foreground truncate">{act.location}</p>
                )}

                {act.linkedListing && (
                  <div className="flex items-center gap-2.5 p-2.5 rounded-md border border-blue-100 bg-blue-50/60">
                    {act.linkedListing.imageUrls?.[0] ? (
                      <img src={act.linkedListing.imageUrls[0]} alt={act.linkedListing.title} className="w-9 h-9 rounded object-cover shrink-0 border border-blue-100" />
                    ) : (
                      <div className="w-9 h-9 rounded bg-blue-100 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-blue-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-blue-900 truncate">{act.linkedListing.title}</p>
                      <p className="text-[10px] text-blue-600">${act.linkedListing.pricePerDay}/day · {act.requiresRental ? "Required" : "Optional"}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => toggleActive(act)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title={act.isActive ? "Hide from marketplace" : "Show on marketplace"}
                  >
                    {act.isActive ? <ToggleRight className="w-5 h-5 text-green-600" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <Link href={adminPath(`/activities/${act.id}/edit`)}>
                    <button className="text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </Link>
                  <button
                    onClick={() => deleteActivity(act.id)}
                    className="text-muted-foreground hover:text-red-500 transition-colors ml-auto"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
