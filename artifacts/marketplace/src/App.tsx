import { useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
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

function AppContent() {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <>
      <Navbar onAuthOpen={() => setAuthOpen(true)} />
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
