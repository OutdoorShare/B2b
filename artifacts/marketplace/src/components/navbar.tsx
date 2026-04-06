import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, ChevronDown, LogOut, BookOpen, Menu, X } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Navbar({ onAuthOpen }: { onAuthOpen: () => void }) {
  const { customer, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 font-bold text-xl text-green-800 hover:text-green-700 transition-colors"
          >
            <span className="text-2xl">🌲</span>
            <span>OutdoorShare</span>
            <span className="text-xs font-normal text-gray-400 ml-1 hidden sm:block">Marketplace</span>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => setLocation("/")} className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Browse</button>
            <button onClick={() => setLocation("/companies")} className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Companies</button>
          </nav>

          {/* Auth */}
          <div className="flex items-center gap-3">
            {customer ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:block max-w-[120px] truncate">{customer.name}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setLocation("/profile")}>
                    <BookOpen className="h-4 w-4 mr-2" />
                    My Bookings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button size="sm" onClick={onAuthOpen} className="bg-green-700 hover:bg-green-800 text-white">
                Sign In
              </Button>
            )}
            <button
              className="md:hidden p-1 text-gray-500 hover:text-gray-900"
              onClick={() => setMobileOpen(v => !v)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 py-3 space-y-1">
            <button onClick={() => { setLocation("/"); setMobileOpen(false); }} className="block w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md">Browse</button>
            <button onClick={() => { setLocation("/companies"); setMobileOpen(false); }} className="block w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md">Companies</button>
            {customer && (
              <button onClick={() => { setLocation("/profile"); setMobileOpen(false); }} className="block w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md">My Bookings</button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
