import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Building2, LogOut, ChevronRight,
  Menu, X, Users, Package, FileText, ShieldAlert, Monitor
} from "lucide-react";
import { cn } from "@/lib/utils";

const OS_GREEN = "#3ab549";

const navigation = [
  { name: "Overview", href: "/superadmin/dashboard", icon: LayoutDashboard },
  { name: "Companies", href: "/superadmin/tenants", icon: Building2 },
  { name: "All Products", href: "/superadmin/listings", icon: Package },
  { name: "Claims", href: "/superadmin/claims", icon: ShieldAlert },
  { name: "Team", href: "/superadmin/team", icon: Users },
  { name: "Agreement", href: "/superadmin/agreement", icon: FileText },
  { name: "Demo Site", href: "/superadmin/demo", icon: Monitor },
];

function logout(setLocation: (to: string) => void) {
  localStorage.removeItem("superadmin_key");
  localStorage.removeItem("superadmin_token");
  localStorage.removeItem("superadmin_user");
  setLocation("/superadmin");
}

export function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-slate-950 text-slate-100">
      {/* Mobile header */}
      <div className="md:hidden flex items-center justify-between h-14 px-4 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2.5 text-white font-bold">
          <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="w-7 h-7 object-contain" />
          <span className="font-black tracking-wide">OutdoorShare</span>
        </div>
        <button onClick={() => setMobileOpen(v => !v)} className="text-slate-400 hover:text-white">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "w-64 bg-slate-900 border-r border-slate-800 flex-shrink-0 flex flex-col",
        "md:flex",
        mobileOpen ? "flex" : "hidden"
      )}>
        {/* Logo */}
        <div className="h-16 hidden md:flex items-center px-5 border-b border-slate-800 gap-3">
          <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="w-9 h-9 object-contain" />
          <div>
            <p className="text-sm font-black text-white leading-none tracking-wide">OutdoorShare</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Super Admin Console</p>
          </div>
        </div>

        {/* Green accent line under logo */}
        <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${OS_GREEN}aa, #29b4d4aa)` }} />

        <nav className="p-3 flex-1 space-y-0.5">
          {navigation.map(item => {
            const isActive = location === item.href || location.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "border"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                )}
                style={isActive ? {
                  backgroundColor: `${OS_GREEN}18`,
                  color: OS_GREEN,
                  borderColor: `${OS_GREEN}30`,
                } : {}}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.name}
                {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <button
            onClick={() => logout(setLocation)}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
