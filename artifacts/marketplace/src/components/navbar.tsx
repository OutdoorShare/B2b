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
import { User, ChevronDown, LogOut, BookOpen, Menu, X, LayoutDashboard, Home } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Navbar({ onAuthOpen }: { onAuthOpen: () => void }) {
  const { customer, isHost, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[72px]">
          {/* Logo */}
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <img
              src={`${BASE_URL}/outdoorshare-logo-transparent.png`}
              alt="OutdoorShare"
              className="h-14 w-14 object-contain flex-shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="flex flex-col items-start leading-none">
              <span className="font-bold text-lg text-primary tracking-tight">OutdoorShare</span>
              <span className="text-[11px] font-normal text-gray-400 tracking-wide">Marketplace</span>
            </div>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <button
              onClick={() => setLocation("/")}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Browse
            </button>
            <button
              onClick={() => setLocation("/companies")}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Companies
            </button>
          </nav>

          {/* Auth */}
          <div className="flex items-center gap-3">
            {customer ? (
              <>
                {/* Host CTA / Host Dashboard button */}
                {isHost ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation("/host")}
                    className="hidden sm:flex items-center gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    Host Dashboard
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation("/become-host")}
                    className="hidden sm:flex items-center gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                  >
                    List your gear
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <User className="h-4 w-4" />
                      <span className="hidden sm:block max-w-[120px] truncate">{customer.name}</span>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={() => setLocation("/profile")}>
                      <BookOpen className="h-4 w-4 mr-2" />
                      My Bookings
                    </DropdownMenuItem>
                    {isHost ? (
                      <DropdownMenuItem onClick={() => setLocation("/host")}>
                        <LayoutDashboard className="h-4 w-4 mr-2" />
                        Host Dashboard
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => setLocation("/become-host")}>
                        <Home className="h-4 w-4 mr-2" />
                        Become a Host
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-red-600">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation("/become-host")}
                  className="hidden sm:flex border-primary/30 text-primary hover:bg-primary/5"
                >
                  List your gear
                </Button>
                <Button
                  size="sm"
                  onClick={onAuthOpen}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Sign In
                </Button>
              </div>
            )}
            <button
              className="md:hidden p-1 text-gray-500 hover:text-gray-900"
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 py-3 space-y-1">
            <button
              onClick={() => { setLocation("/"); setMobileOpen(false); }}
              className="block w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
            >
              Browse
            </button>
            <button
              onClick={() => { setLocation("/companies"); setMobileOpen(false); }}
              className="block w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
            >
              Companies
            </button>
            {customer ? (
              <>
                <button
                  onClick={() => { setLocation("/profile"); setMobileOpen(false); }}
                  className="block w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
                >
                  My Bookings
                </button>
                {isHost ? (
                  <button
                    onClick={() => { setLocation("/host"); setMobileOpen(false); }}
                    className="block w-full text-left px-2 py-2 text-sm text-primary font-medium hover:bg-primary/5 rounded-md"
                  >
                    Host Dashboard
                  </button>
                ) : (
                  <button
                    onClick={() => { setLocation("/become-host"); setMobileOpen(false); }}
                    className="block w-full text-left px-2 py-2 text-sm text-primary font-medium hover:bg-primary/5 rounded-md"
                  >
                    List your gear
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={() => { setLocation("/become-host"); setMobileOpen(false); }}
                className="block w-full text-left px-2 py-2 text-sm text-primary font-medium hover:bg-primary/5 rounded-md"
              >
                List your gear
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
