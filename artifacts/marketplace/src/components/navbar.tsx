import { useState, useEffect } from "react";
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
import { User, ChevronDown, LogOut, BookOpen, Menu, X, LayoutDashboard, Home, Mountain, Settings } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Navbar({
  onAuthOpen,
  heroMode = false,
}: {
  onAuthOpen: () => void;
  heroMode?: boolean;
}) {
  const { customer, isHost, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (!heroMode) return;
    const onScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [heroMode]);

  // Reset scroll state when leaving hero mode
  useEffect(() => {
    if (!heroMode) setIsScrolled(false);
  }, [heroMode]);

  const transparent = heroMode && !isScrolled;

  const containerClass = heroMode
    ? `fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white border-b border-gray-200 shadow-sm"
          : "bg-transparent border-transparent"
      }`
    : "sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm";

  const linkClass = transparent
    ? "text-sm font-medium text-white/85 hover:text-white transition-colors"
    : "text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors";

  const logoNameClass = transparent ? "text-white" : "text-primary";
  const logoSubClass = transparent ? "text-white/70" : "text-brand-blue";

  return (
    <header className={containerClass}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[80px]">
          {/* Logo */}
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            <img
              src={`${BASE_URL}/outdoorshare-icon.png`}
              alt="OutdoorShare"
              className="h-[46px] w-auto object-contain flex-shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="flex flex-col items-start leading-none gap-0.5">
              <span className={`font-bold text-xl tracking-tight transition-colors duration-300 ${logoNameClass}`}>
                OutdoorShare
              </span>
              <span className={`text-[11px] font-semibold tracking-widest uppercase transition-colors duration-300 ${logoSubClass}`}>
                Marketplace
              </span>
            </div>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => setLocation("/")} className={linkClass}>
              Browse
            </button>
            <button
              onClick={() => setLocation("/memories")}
              className={`${linkClass} flex items-center gap-1`}
            >
              <Mountain className={`h-3.5 w-3.5 ${transparent ? "text-white/70" : "text-brand-blue"}`} />
              Memories
            </button>
          </nav>

          {/* Auth */}
          <div className="flex items-center gap-3">
            {customer ? (
              <>
                {isHost ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation("/host")}
                    className={`hidden sm:flex items-center gap-1.5 transition-colors duration-300 ${
                      transparent
                        ? "border-white/40 text-white bg-white/10 hover:bg-white/20 hover:border-white/60"
                        : "border-primary/30 text-primary hover:bg-primary/5"
                    }`}
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    Host Dashboard
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation("/become-host")}
                    className={`hidden sm:flex items-center gap-1.5 transition-colors duration-300 ${
                      transparent
                        ? "border-white/40 text-white bg-white/10 hover:bg-white/20 hover:border-white/60"
                        : "border-primary/30 text-primary hover:bg-primary/5"
                    }`}
                  >
                    List your gear
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`gap-2 transition-colors duration-300 ${
                        transparent
                          ? "border-white/40 text-white bg-white/10 hover:bg-white/20"
                          : ""
                      }`}
                    >
                      <User className="h-4 w-4" />
                      <span className="hidden sm:block max-w-[120px] truncate">{customer.name}</span>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={() => setLocation("/profile?tab=profile")}>
                      <User className="h-4 w-4 mr-2" />
                      My Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation("/profile")}>
                      <BookOpen className="h-4 w-4 mr-2" />
                      Booked Adventures
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation("/profile?tab=settings")}>
                      <Settings className="h-4 w-4 mr-2" />
                      Account Settings
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
                <button
                  onClick={() => setLocation("/become-host")}
                  className={`hidden sm:block text-sm font-medium transition-colors duration-300 ${
                    transparent ? "text-white/85 hover:text-white" : "text-primary hover:text-primary/80"
                  }`}
                >
                  List your gear
                </button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAuthOpen}
                  className={`transition-colors duration-300 ${
                    transparent
                      ? "border-white/50 text-white bg-white/10 hover:bg-white/20 hover:border-white/70"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Sign up
                </Button>
                <Button
                  size="sm"
                  onClick={onAuthOpen}
                  className={`transition-colors duration-300 ${
                    transparent
                      ? "bg-white text-gray-900 hover:bg-white/90"
                      : "bg-brand-blue hover:bg-brand-blue/90 text-brand-blue-foreground"
                  }`}
                >
                  Log in
                </Button>
              </div>
            )}
            <button
              className={`md:hidden p-1 transition-colors duration-300 ${
                transparent ? "text-white/85 hover:text-white" : "text-gray-500 hover:text-gray-900"
              }`}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className={`md:hidden border-t py-3 space-y-1 ${
            transparent ? "border-white/20 bg-black/60 backdrop-blur-md rounded-b-xl" : "border-gray-100"
          }`}>
            <button
              onClick={() => { setLocation("/"); setMobileOpen(false); }}
              className={`block w-full text-left px-2 py-2 text-sm rounded-md ${
                transparent ? "text-white/90 hover:bg-white/10" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              Browse
            </button>
            <button
              onClick={() => { setLocation("/memories"); setMobileOpen(false); }}
              className={`block w-full text-left px-2 py-2 text-sm rounded-md ${
                transparent ? "text-white/90 hover:bg-white/10" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              Memories
            </button>
            {customer ? (
              <>
                <button
                  onClick={() => { setLocation("/profile?tab=profile"); setMobileOpen(false); }}
                  className={`block w-full text-left px-2 py-2 text-sm rounded-md ${
                    transparent ? "text-white/90 hover:bg-white/10" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  My Profile
                </button>
                <button
                  onClick={() => { setLocation("/profile"); setMobileOpen(false); }}
                  className={`block w-full text-left px-2 py-2 text-sm rounded-md ${
                    transparent ? "text-white/90 hover:bg-white/10" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Booked Adventures
                </button>
                {isHost ? (
                  <button
                    onClick={() => { setLocation("/host"); setMobileOpen(false); }}
                    className={`block w-full text-left px-2 py-2 text-sm font-medium rounded-md ${
                      transparent ? "text-white hover:bg-white/10" : "text-primary hover:bg-primary/5"
                    }`}
                  >
                    Host Dashboard
                  </button>
                ) : (
                  <button
                    onClick={() => { setLocation("/become-host"); setMobileOpen(false); }}
                    className={`block w-full text-left px-2 py-2 text-sm font-medium rounded-md ${
                      transparent ? "text-white hover:bg-white/10" : "text-primary hover:bg-primary/5"
                    }`}
                  >
                    List your gear
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={() => { setLocation("/become-host"); setMobileOpen(false); }}
                className={`block w-full text-left px-2 py-2 text-sm font-medium rounded-md ${
                  transparent ? "text-white hover:bg-white/10" : "text-primary hover:bg-primary/5"
                }`}
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
