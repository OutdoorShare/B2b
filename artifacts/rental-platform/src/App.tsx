import { Switch, Route, Router as WouterRouter, useParams, useLocation } from "wouter";
import { useEffect } from "react";
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
import StorefrontSetPassword from "@/pages/storefront/set-password";
import StorefrontMyBookings from "@/pages/storefront/my-bookings";
import StorefrontMyBookingDetail from "@/pages/storefront/my-booking-detail";
import StorefrontProfile from "@/pages/storefront/profile";
import PickupPage from "@/pages/storefront/pickup";
import ReturnPage from "@/pages/storefront/return";

import GetStartedPage from "@/pages/public/get-started";
import SignupPage from "@/pages/public/signup";
import VerifyEmailPage from "@/pages/public/verify-email";
import AuditPage from "@/pages/public/audit";
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
import AdminListingsImport from "@/pages/admin/listings/import";
import AdminBookings from "@/pages/admin/bookings/index";
import AdminBookingDetail from "@/pages/admin/bookings/detail";
import AdminBookingForm from "@/pages/admin/bookings/form";
import AdminQuotes from "@/pages/admin/quotes/index";
import AdminQuotesNew from "@/pages/admin/quotes/new";
import AdminAnalytics from "@/pages/admin/analytics";
import AdminLaunchpad from "@/pages/admin/launchpad";
import AdminSettings from "@/pages/admin/settings";
import AdminKiosk from "@/pages/admin/kiosk";
import AdminClaims from "@/pages/admin/claims/index";
import AdminClaimDetail from "@/pages/admin/claims/detail";
import AdminClaimsNew from "@/pages/admin/claims/new";
import AdminTeam from "@/pages/admin/team";
import AdminCommunications from "@/pages/admin/communications";
import AdminWaivers from "@/pages/admin/waivers";
import AdminWallet from "@/pages/admin/wallet";
import AdminBilling from "@/pages/admin/billing";
import AdminPromoCodes from "@/pages/admin/promo-codes";
import SuperAdminTeam from "@/pages/superadmin/team";
import SuperAdminListings from "@/pages/superadmin/listings";
import CompanyDetailPage from "@/pages/superadmin/company-detail";
import SuperAdminTenants from "@/pages/superadmin/tenants";
import SuperAdminAgreement from "@/pages/superadmin/agreement";
import SuperAdminClaims from "@/pages/superadmin/claims";
import DemoSitePage from "@/pages/superadmin/demo-site";
import ProtectionPlansPage from "@/pages/superadmin/protection-plans";
import SuperAdminAnalytics from "@/pages/superadmin/analytics";
import SuperAdminFeedback from "@/pages/superadmin/feedback";
import SuperAdminDeveloper from "@/pages/superadmin/developer";
import DocsAdminPage from "@/pages/superadmin/docs-admin";
import AdminFeedback from "@/pages/admin/feedback";
import AdminMessages from "@/pages/admin/messages";
import AdminContactCards from "@/pages/admin/contact-cards";
import AdminContacts from "@/pages/admin/contacts";
import AdminInventory from "@/pages/admin/inventory/index";
import AdminInventoryForm from "@/pages/admin/inventory/form";
import AdminInventoryDetail from "@/pages/admin/inventory/detail";
import AdminInventoryImport from "@/pages/admin/inventory/import";

const queryClient = new QueryClient();

// Inject tenant context headers on every generated API call.
//
// IMPORTANT: Admin token must ONLY be sent on admin routes.
// If we sent it on storefront routes, any logged-in admin viewing
// a different company's storefront would receive THEIR company's
// logo/colors instead of the storefront's — causing cross-tenant
// data contamination.
setExtraHeadersGetter(() => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const path = window.location.pathname.replace(base, "") || "/";

  // Only inject the admin token when the URL is actually an admin route
  // (contains /admin/ or ends with /admin).
  const isAdminRoute = /\/admin(\/|$)/.test(path);

  if (isAdminRoute) {
    try {
      const raw = localStorage.getItem("admin_session");
      if (raw) {
        const session = JSON.parse(raw);
        if (session?.token) {
          return { "x-admin-token": session.token };
        }
      }
    } catch { /* ignore */ }
  }

  // For storefront routes (and any non-admin route that has a slug),
  // always use the tenant slug so the correct company data is fetched,
  // regardless of whether an admin session exists in localStorage.
  const reserved = new Set([
    "admin", "api", "superadmin", "platform", "docs", "public", "signup",
    "get-started", "demo", "audit", "health", "static", "assets", "uploads",
    "login", "logout", "register", "account", "dashboard", "settings", "billing",
    "support", "help", "about", "contact", "privacy", "terms", "pricing",
    "www", "mail", "email", "ftp", "cdn", "media", "images",
  ]);
  const segments = path.split("/").filter(Boolean);
  const firstSegment = segments[0];
  if (firstSegment && !reserved.has(firstSegment)) {
    return { "x-tenant-slug": firstSegment };
  }
  return {};
});

// First-visit redirect: sends new admins to the launchpad instead of the dashboard.
// Once they visit the launchpad, a per-slug flag is set and they go straight to the
// dashboard on subsequent logins.
function AdminDashboardOrLaunchpad() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const [, setLocation] = useLocation();
  const key = `admin_launchpad_seen_${slug}`;
  const hasSeenLaunchpad = !!localStorage.getItem(key);

  useEffect(() => {
    if (!hasSeenLaunchpad) {
      setLocation(`/${slug}/admin/launchpad`);
    }
  }, []);

  if (!hasSeenLaunchpad) return null;
  return <AdminDashboard />;
}

// Guards the /demo route — only accessible when a superadmin session is active
function SuperAdminDemoGuard() {
  const [, navigate] = useLocation();
  const isSuperAdmin = (() => {
    try {
      const raw = localStorage.getItem("superadmin_session");
      return raw ? JSON.parse(raw)?.token : null;
    } catch { return null; }
  })();

  useEffect(() => {
    if (!isSuperAdmin) navigate("/superadmin");
  }, [isSuperAdmin]);

  if (!isSuperAdmin) return null;
  return <DemoPage />;
}

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
      <Route path="/verify-email">
        <VerifyEmailPage />
      </Route>
      <Route path="/audit">
        <AuditPage />
      </Route>

      {/* Admin Onboarding — guarded so only the authenticated owner can access it */}
      <Route path="/:slug/admin/onboarding">
        <AdminGuard><AdminOnboarding /></AdminGuard>
      </Route>

      {/* Super Admin Routes */}
      <Route path="/superadmin">
        <SuperAdminLogin />
      </Route>
      <Route path="/superadmin/dashboard">
        <SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout>
      </Route>
      <Route path="/superadmin/tenants">
        <SuperAdminLayout><SuperAdminTenants /></SuperAdminLayout>
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
      <Route path="/superadmin/claims">
        <SuperAdminLayout><SuperAdminClaims /></SuperAdminLayout>
      </Route>
      <Route path="/superadmin/demo">
        <SuperAdminLayout><DemoSitePage /></SuperAdminLayout>
      </Route>
      <Route path="/superadmin/protection">
        <SuperAdminLayout><ProtectionPlansPage /></SuperAdminLayout>
      </Route>
      <Route path="/superadmin/analytics">
        <SuperAdminLayout><SuperAdminAnalytics /></SuperAdminLayout>
      </Route>
      <Route path="/superadmin/feedback">
        <SuperAdminLayout><SuperAdminFeedback /></SuperAdminLayout>
      </Route>
      <Route path="/superadmin/docs">
        <DocsAdminPage />
      </Route>
      <Route path="/superadmin/developer">
        <SuperAdminLayout><SuperAdminDeveloper /></SuperAdminLayout>
      </Route>

      {/* Tenant Admin Routes — scoped to /:slug/admin/* */}
      <Route path="/:slug/admin">
        <AdminGuard><AdminLayout><AdminDashboardOrLaunchpad /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/listings/import">
        <AdminGuard><AdminLayout><AdminListingsImport /></AdminLayout></AdminGuard>
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
      <Route path="/:slug/admin/launchpad">
        <AdminGuard><AdminLayout><AdminLaunchpad /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/feedback">
        <AdminGuard><AdminLayout><AdminFeedback /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/contacts">
        <AdminGuard><AdminLayout><AdminContacts /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/contact-cards">
        <AdminGuard><AdminLayout><AdminContactCards /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/inventory/import">
        <AdminGuard><AdminLayout><AdminInventoryImport /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/inventory/new">
        <AdminGuard><AdminLayout><AdminInventoryForm /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/inventory/:id/edit">
        <AdminGuard><AdminLayout><AdminInventoryForm /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/inventory/:id">
        <AdminGuard><AdminLayout><AdminInventoryDetail /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/inventory">
        <AdminGuard><AdminLayout><AdminInventory /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/settings">
        <AdminGuard><AdminLayout><AdminSettings /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/billing">
        <AdminGuard><AdminBilling /></AdminGuard>
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
      <Route path="/:slug/admin/promo-codes">
        <AdminGuard><AdminLayout><AdminPromoCodes /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/messages">
        <AdminGuard><AdminLayout><AdminMessages /></AdminLayout></AdminGuard>
      </Route>
      <Route path="/:slug/admin/communications">
        <AdminGuard><AdminCommunications /></AdminGuard>
      </Route>

      {/* Demo — superadmin only, not publicly accessible */}
      <Route path="/demo">
        <SuperAdminDemoGuard />
      </Route>

      {/* Pickup Photo Route — public, no layout wrapper */}
      <Route path="/:slug/pickup/:token">
        <PickupPage />
      </Route>

      {/* Return Photo Route — public, no layout wrapper */}
      <Route path="/:slug/return/:token">
        <ReturnPage />
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
      <Route path="/:slug/set-password">
        <StorefrontLayout><StorefrontSetPassword /></StorefrontLayout>
      </Route>
      <Route path="/:slug/my-bookings/:id">
        <StorefrontLayout><StorefrontMyBookingDetail /></StorefrontLayout>
      </Route>
      <Route path="/:slug/my-bookings">
        <StorefrontLayout><StorefrontMyBookings /></StorefrontLayout>
      </Route>
      <Route path="/:slug/profile">
        <StorefrontLayout><StorefrontProfile /></StorefrontLayout>
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
