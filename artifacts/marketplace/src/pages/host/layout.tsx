import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/auth";
import {
  LayoutDashboard,
  Package,
  CalendarDays,
  Settings,
  ArrowLeft,
  Menu,
  Package2,
  Building2,
} from "lucide-react";
import { useState } from "react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/host" },
  { label: "My Listings", icon: Package, path: "/host/listings" },
  { label: "Bundles", icon: Package2, path: "/host/bundles" },
  { label: "Bookings", icon: CalendarDays, path: "/host/bookings" },
  { label: "Settings", icon: Settings, path: "/host/settings" },
];

export function HostLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { customer, hostInfo, isHost, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!customer) {
      setLocation("/");
      return;
    }
    if (customer && !isHost) {
      setLocation("/become-host");
    }
  }, [customer, isHost, loading, setLocation]);

  if (loading || !customer || !isHost) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-gray-100">
        <button
          onClick={() => { setLocation("/"); setSidebarOpen(false); }}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity mb-4"
        >
          <img
            src={`${BASE_URL}/outdoorshare-logo-transparent.png`}
            alt="OutdoorShare"
            className="h-9 w-9 object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          <div className="flex flex-col leading-none">
            <span className="font-bold text-sm text-primary">OutdoorShare</span>
            <span className="text-[10px] text-gray-400">Host Dashboard</span>
          </div>
        </button>
        <div className="bg-primary/5 rounded-lg p-3">
          <p className="text-xs text-gray-500 font-medium">Listing as</p>
          <p className="text-sm font-semibold text-gray-900 truncate">{hostInfo?.name ?? customer.name}</p>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = location === item.path || (item.path !== "/host" && location.startsWith(item.path));
          return (
            <button
              key={item.path}
              onClick={() => { setLocation(item.path); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Upgrade to Business CTA */}
      <div className="px-3 pb-2">
        <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-xs font-semibold text-primary">Grow your business</span>
          </div>
          <p className="text-[11px] text-gray-500 mb-2.5 leading-snug">
            Get your own storefront, custom branding, and full rental management.
          </p>
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); window.open("/", "_blank"); setSidebarOpen(false); }}
            className="block w-full text-center bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold py-1.5 px-2 rounded-lg transition-colors"
          >
            Register as a Business →
          </a>
        </div>
      </div>

      <div className="p-3 border-t border-gray-100">
        <button
          onClick={() => { setLocation("/"); setSidebarOpen(false); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Marketplace
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-col bg-white border-r border-gray-200 fixed top-0 left-0 h-full z-30">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-56 bg-white h-full shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 md:ml-56">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-200 px-4 h-14 flex items-center gap-3 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="p-1 text-gray-500">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold text-sm text-primary">Host Dashboard</span>
        </div>

        <main className="p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
