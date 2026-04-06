import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/auth";
import { Navbar } from "@/components/navbar";
import { AuthModal } from "@/components/auth-modal";
import { HomePage } from "@/pages/home";
import { ListingDetailPage } from "@/pages/listing-detail";
import { ProfilePage } from "@/pages/profile";
import { CompaniesPage } from "@/pages/companies";
import NotFound from "@/pages/not-found";
import { initPreviewMode } from "@/lib/preview";
import { Eye } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err: any) => {
        if (err?.status >= 400 && err?.status < 500) return false;
        return count < 2;
      },
    },
  },
});

function PreviewBanner() {
  return (
    <div className="sticky top-[72px] z-30 bg-amber-500 text-white text-xs font-medium px-4 py-2 flex items-center justify-center gap-2 shadow-sm">
      <Eye className="h-3.5 w-3.5 flex-shrink-0" />
      <span>
        <strong>Demo Preview Mode</strong> — You are viewing all tenants including demo accounts. This view is only accessible from the Super Admin.
      </span>
    </div>
  );
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);
  return null;
}

function AppContent() {
  const [authOpen, setAuthOpen] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    const active = initPreviewMode();
    if (active) {
      setPreview(true);
      queryClient.invalidateQueries();
    }
  }, []);

  return (
    <>
      <ScrollToTop />
      <Navbar onAuthOpen={() => setAuthOpen(true)} />
      {preview && <PreviewBanner />}
      <Switch>
        <Route path="/" component={() => <HomePage onAuthOpen={() => setAuthOpen(true)} />} />
        <Route path="/listings/:id" component={ListingDetailPage} />
        <Route path="/profile" component={() => <ProfilePage onAuthOpen={() => setAuthOpen(true)} />} />
        <Route path="/companies" component={CompaniesPage} />
        <Route component={NotFound} />
      </Switch>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppContent />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
