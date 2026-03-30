import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { AdminLayout } from "@/components/layout/admin-layout";
import { StorefrontLayout } from "@/components/layout/storefront-layout";
import { ThemeProvider } from "@/components/theme-provider";

// Pages
import StorefrontHome from "@/pages/storefront/home";
import StorefrontGearDetail from "@/pages/storefront/gear-detail";
import StorefrontBook from "@/pages/storefront/book";
import StorefrontLogin from "@/pages/storefront/login";

import GetStartedPage from "@/pages/public/get-started";
import SignupPage from "@/pages/public/signup";
import DemoPage from "@/pages/demo";
import AdminOnboarding from "@/pages/admin/onboarding";
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
import AdminCategories from "@/pages/admin/categories";
import AdminSettings from "@/pages/admin/settings";
import AdminKiosk from "@/pages/admin/kiosk";
import AdminClaims from "@/pages/admin/claims/index";
import AdminClaimDetail from "@/pages/admin/claims/detail";
import AdminClaimsNew from "@/pages/admin/claims/new";
import AdminTeam from "@/pages/admin/team";
import SuperAdminTeam from "@/pages/superadmin/team";
import CompanyDetailPage from "@/pages/superadmin/company-detail";

const queryClient = new QueryClient();

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

      {/* Admin Onboarding */}
      <Route path="/admin/onboarding">
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
      <Route path="/superadmin/companies/:id">
        <SuperAdminLayout><CompanyDetailPage /></SuperAdminLayout>
      </Route>

      {/* Admin Routes */}
      <Route path="/admin">
        <AdminLayout><AdminDashboard /></AdminLayout>
      </Route>
      <Route path="/admin/listings">
        <AdminLayout><AdminListings /></AdminLayout>
      </Route>
      <Route path="/admin/listings/new">
        <AdminLayout><AdminListingsForm /></AdminLayout>
      </Route>
      <Route path="/admin/listings/:id/edit">
        <AdminLayout><AdminListingsForm /></AdminLayout>
      </Route>
      <Route path="/admin/listings/:id">
        <AdminLayout><AdminListingDetail /></AdminLayout>
      </Route>
      <Route path="/admin/bookings/new">
        <AdminLayout><AdminBookingForm /></AdminLayout>
      </Route>
      <Route path="/admin/bookings/:id/edit">
        <AdminLayout><AdminBookingForm /></AdminLayout>
      </Route>
      <Route path="/admin/bookings">
        <AdminLayout><AdminBookings /></AdminLayout>
      </Route>
      <Route path="/admin/bookings/:id">
        <AdminLayout><AdminBookingDetail /></AdminLayout>
      </Route>
      <Route path="/admin/quotes">
        <AdminLayout><AdminQuotes /></AdminLayout>
      </Route>
      <Route path="/admin/quotes/new">
        <AdminLayout><AdminQuotesNew /></AdminLayout>
      </Route>
      <Route path="/admin/analytics">
        <AdminLayout><AdminAnalytics /></AdminLayout>
      </Route>
      <Route path="/admin/categories">
        <AdminLayout><AdminCategories /></AdminLayout>
      </Route>
      <Route path="/admin/settings">
        <AdminLayout><AdminSettings /></AdminLayout>
      </Route>
      <Route path="/admin/kiosk">
        <AdminKiosk /> {/* Kiosk is full screen */}
      </Route>
      <Route path="/admin/claims">
        <AdminLayout><AdminClaims /></AdminLayout>
      </Route>
      <Route path="/admin/claims/new">
        <AdminLayout><AdminClaimsNew /></AdminLayout>
      </Route>
      <Route path="/admin/claims/:id">
        <AdminLayout><AdminClaimDetail /></AdminLayout>
      </Route>
      <Route path="/admin/team">
        <AdminLayout><AdminTeam /></AdminLayout>
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
