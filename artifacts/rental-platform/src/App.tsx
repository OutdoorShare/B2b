import { Switch, Route, Router as WouterRouter, useParams } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { setExtraHeadersGetter } from "@workspace/api-client-react";

import { AdminLayout } from "@/components/layout/admin-layout";
import { StorefrontLayout } from "@/components/layout/storefront-layout";
import { ThemeProvider } from "@/components/theme-provider";

// Pages
import StorefrontHome from "@/pages/storefront/home";
import StorefrontGearDetail from "@/pages/storefront/gear-detail";
import StorefrontBook from "@/pages/storefront/book";
import StorefrontLogin from "@/pages/storefront/login";
import StorefrontMyBookings from "@/pages/storefront/my-bookings";
import StorefrontMyBookingDetail from "@/pages/storefront/my-booking-detail";

import GetStartedPage from "@/pages/public/get-started";
import SignupPage from "@/pages/public/signup";
import DemoPage from "@/pages/demo";
import AdminOnboarding from "@/pages/admin/onboarding";
import AdminLoginPage from "@/pages/admin/admin-login";
import SuperAdminLogin from "@/pages/superadmin/login";
import SuperAdminDashboard from "@/pages/superadmin/dashboard";
import { SuperAdminLayout } from "@/components/layout/superadmin-layout";

import AdminDashboard from "@/pages/admin/dashboard";
import AdminListings from "@/pages/admin/listings/index";
import AdminListingsForm from "@/pages/admin/listings/form";
import AdminListingDetail from "@/pages/admin/listings/detail";
import AdminBookings from "@/pages/admin/bookings/index";
import AdminBookingDetail from "@/pages/admin/bookings/detail";
import AdminBookingForm from "@/pages/admin/bookings/form";
import AdminQuotes from "@/pages/admin/quotes/index";
import AdminQuotesNew from "@/pages/admin/quotes/new";
import AdminAnalytics from "@/pages/admin/analytics";
import AdminSettings from "@/pages/admin/settings";
import AdminKiosk from "@/pages/admin/kiosk";
import AdminClaims from "@/pages/admin/claims/index";
import AdminClaimDetail from "@/pages/admin/claims/detail";
import AdminClaimsNew from "@/pages/admin/claims/new";
import AdminTeam from "@/pages/admin/team";
import AdminCommunications from "@/pages/admin/communications";
import AdminWaivers from "@/pages/admin/waivers";
import AdminWallet from "@/pages/admin/wallet";
import SuperAdminTeam from "@/pages/superadmin/team";
import SuperAdminListings from "@/pages/superadmin/listings";
import CompanyDetailPage from "@/pages/superadmin/company-detail";
import SuperAdminAgreement from "@/pages/superadmin/agreement";

const queryClient = new QueryClient();

// Inject tenant context headers on every generated API call.
setExtraHeadersGetter(() => {
  try {
    const raw = localStorage.getItem("admin_session");
    if (raw) {
      const session = JSON.parse(raw);
      if (session?.token) {
        return { "x-admin-token": session.token };
      }
    }
  } catch { /* ignore */ }

  // Extract slug from pathname
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const path = window.location.pathname.replace(base, "") || "/";
  const reserved = new Set(["superadmin", "get-started", "signup", "demo"]);
  const segments = path.split("/").filter(Boolean);
  const firstSegment = segments[0];
  if (firstSegment && !reserved.has(firstSegment)) {
    return { "x-tenant-slug": firstSegment };
  }
  return {};
});

// Auth guard: checks session matches the slug in the URL
function AdminGuard({ children }: { children: React.ReactNode }) {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";

  const session = (() => {
    try {
      const raw = localStorage.getItem("admin_session");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  const isAuthenticated = session?.token && session?.tenantSlug === slug;

  if (!isAuthenticated) {
    return <AdminLoginPage slug={slug} />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      {/* Public SaaS Routes */}
      <Route path="/get-started">
        <GetStartedPage />
      </Route>
      <Route path="/signup">
        <SignupPage />
      </Route>

      {/* Admin Onboarding — reached after signup; session already set */}
      <Route path="/:slug/admin/onboarding">
        <AdminOnboarding />
      </Route>

      {/* Super Admin Routes */}
      <Route path="/superadmin">
        <SuperAdminLogin />
      </Route>
      <Route path="/superadmin/dashboard">
        <SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout>
      </Route>
      <Route path="/superadmin/tenants">
        <SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout>
      </Route>
      <Route path="/superadmin/team">
        <SuperAdminLayout><SuperAdminTeam /></SuperAdminLayout>
      </Route>
      <Route path="/superadmin/listings">
        <SuperAdminLayout><SuperAdminListings /></SuperAdminLayout>
      </Route>
      <Route path="/superadmin/companies/:id">
        <SuperAdminLayout><CompanyDetailPage /></SuperAdminLayout>
      </Route>
      <Route path="/superadmin/agreement">
        <SuperAdminLayout><SuperAdminAgreement /></SuperAdminLayout>
      </Route>

      {/* Tenant Admin Routes — scoped to /:slug/admin/* */}
      <Route path="/:slug/admin">
        <AdminGuard><AdminLayout><AdminDashboard /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/listings/new">
        <AdminGuard><AdminLayout><AdminListingsForm /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/listings/:id/edit">
        <AdminGuard><AdminLayout><AdminListingsForm /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/listings/:id">
        <AdminGuard><AdminLayout><AdminListingDetail /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/listings">
        <AdminGuard><AdminLayout><AdminListings /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/bookings/new">
        <AdminGuard><AdminLayout><AdminBookingForm /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/bookings/:id/edit">
        <AdminGuard><AdminLayout><AdminBookingForm /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/bookings/:id">
        <AdminGuard><AdminLayout><AdminBookingDetail /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/bookings">
        <AdminGuard><AdminLayout><AdminBookings /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/quotes/new">
        <AdminGuard><AdminLayout><AdminQuotesNew /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/quotes">
        <AdminGuard><AdminLayout><AdminQuotes /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/analytics">
        <AdminGuard><AdminLayout><AdminAnalytics /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/settings">
        <AdminGuard><AdminLayout><AdminSettings /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/kiosk">
        <AdminGuard><AdminKiosk /></AdminGuard>
      </Route>
      <Route path="/:slug/admin/claims/new">
        <AdminGuard><AdminLayout><AdminClaimsNew /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/claims/:id">
        <AdminGuard><AdminLayout><AdminClaimDetail /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/claims">
        <AdminGuard><AdminLayout><AdminClaims /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/team">
        <AdminGuard><AdminLayout><AdminTeam /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/waivers">
        <AdminGuard><AdminLayout><AdminWaivers /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/wallet">
        <AdminGuard><AdminLayout><AdminWallet /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/communications">
        <AdminGuard><AdminCommunications /></AdminGuard>
      </Route>

      {/* Demo / Test page */}
      <Route path="/demo">
        <DemoPage />
      </Route>

      {/* Storefront Routes — tenant-specific via slug prefix */}
      <Route path="/:slug">
        <StorefrontLayout><StorefrontHome /></StorefrontLayout>
      </Route>
      <Route path="/:slug/listings/:id">
        <StorefrontLayout><StorefrontGearDetail /></StorefrontLayout>
      </Route>
      <Route path="/:slug/book">
        <StorefrontLayout><StorefrontBook /></StorefrontLayout>
      </Route>
      <Route path="/:slug/login">
        <StorefrontLayout><StorefrontLogin /></StorefrontLayout>
      </Route>
      <Route path="/:slug/my-bookings/:id">
        <StorefrontLayout><StorefrontMyBookingDetail /></StorefrontLayout>
      </Route>
      <Route path="/:slug/my-bookings">
        <StorefrontLayout><StorefrontMyBookings /></StorefrontLayout>
      </Route>

      {/* Root → SaaS marketing landing */}
      <Route path="/">
        <GetStartedPage />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
