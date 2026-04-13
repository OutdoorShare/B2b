# Workspace

## Overview

This project is a white-label rental management platform, designed as a B2B SaaS product for companies renting out items like outdoor gear. It aims to provide a fully customizable and branded experience. The platform consists of two main components: an admin dashboard for business management and a customer-facing storefront for booking and rentals.

**Business Vision & Market Potential:** The platform targets a growing market of rental businesses seeking digital transformation by offering a white-label solution that leverages robust rental management features while maintaining brand identity.

**Key Capabilities:**
- Comprehensive gear listing and management.
- Multi-step customer booking process with add-ons and agreements.
- Admin dashboard for analytics, booking management, custom quotes, and staff management.
- Multi-tenancy architecture supporting independent rental businesses.
- Host role for marketplace renters to create micro-tenants with simplified dashboards.
- AI Assistant (OutdoorBot) for both admin and customer support.
- Fully customizable branding and theming options.
- Integrated documentation portal.
- Consumer-facing marketplace with map view, category filters, and company browsing.
- Social photo wall ("Adventure Wall / Memories") for renters to share experiences.
- Persistent chat system for direct communication between renters and businesses/hosts.
- Support for split payment plans for rentals.
- Embeddable listing cards for external website integration.
- Server-side rendering for social media meta tags to improve shareability.

## User Preferences

I prefer iterative development with clear communication on significant changes. I like to see detailed explanations for complex implementations. Please ensure all code is well-documented and follows best practices. When making changes, prioritize solutions that maintain the multi-tenancy architecture and ensure data isolation.

## System Architecture

The platform is built as a monorepo using `pnpm workspaces`, Node.js 24, and TypeScript 5.9.

**Core Technologies:**
- **Backend:** Express 5 API, PostgreSQL database with Drizzle ORM, Zod for validation, Orval for API codegen.
- **Frontend:** React with Vite, TailwindCSS, shadcn/ui, and wouter for routing.

**Monorepo Structure:**
- `artifacts/`: Contains deployable applications: `api-server`, `rental-platform` (customer and admin UI), and `docs-portal`.
- `lib/`: Houses shared libraries like `api-spec` (OpenAPI), `api-client-react` (generated React Query hooks), `api-zod` (generated Zod schemas), and `db` (Drizzle ORM schema).

**UI/UX Decisions:**
- **Marketplace Brand Colors:** Primary green `hsl(127,55%,38%)`, accent blue `hsl(197,78%,58%)`.
- **Customer Storefront:** Branded homepage, gear detail pages with photo carousels, and a multi-step booking checkout flow.
- **Admin Dashboard:** Comprehensive dashboard with live analytics, CRUD interfaces for listings, bookings, quotes, categories, and business settings. Includes tools like a real-time notification bell, Kiosk Mode, custom quote builder.
- **White-label Theming:** CSS variable-based theming with 8 preset themes and a live color picker for extensive branding customization.
- **AI Assistant Widget:** A floating chat widget (`AIChatWidget`) with a fixed green circular button, opening a 360x520px chat panel with a dark navy header, rendering markdown for conversation.

**Feature Specifications & System Design Choices:**

- **Multi-Tenancy:** Each rental company is a tenant, identified by `tenantId`. A `resolveTenant` middleware ensures all data operations are tenant-scoped for strict data isolation.
- **Authentication:** Separate login flows for tenant owners, staff, and customers, with customer logins being tenant-scoped.
- **Booking Storefront:** Features customer accounts, a multi-step booking process (Dates + Add-ons → Payment → Agreement → Confirmation), live price updates, required add-ons, and customer booking history. All navigation is slug-aware.
- **Per-Listing Embed Codes:** Each listing has an iframe-friendly embed URL (`/:slug/embed/listing/:id`) providing a minimal view for external websites with a "Book Now" CTA.
- **Split Payment Plans:** Allows tenants to offer customers the option to pay a deposit upfront and the remaining balance later, with automated charging.
- **Rental Agreement System:** Utilizes `{{token}}` syntax for agreement templates and allows Super Admin to define typed "Contract Fields" for dynamic input forms.
- **AI Assistant (OutdoorBot):** Backend (`/api/ai/chat`) uses `gpt-5-mini` with function-calling. Frontend provides a dynamic chat interface with role-specific starter prompts.
- **Documentation Portal:** A separate application providing a knowledge base with articles, search, trending articles, and an admin interface.
- **Chat System:** A renter-to-admin messaging system with dedicated DB tables, API routes, a two-panel admin messages page, and a storefront chat widget. Includes unread count badges and email notifications.
- **Email Verification:** Implements a token-based email verification flow for new company sign-ups, including resend functionality and status banners.
- **URL Routing:** Comprehensive routing handles marketing pages, self-registration, demo environment, super admin functions, and tenant-specific customer storefronts (`/:slug`).
- **Social Sharing Meta Tags:** A Vite dev-server plugin intercepts social media bot requests to serve minimal HTML pages pre-populated with `og:*` and `twitter:*` meta tags for improved sharing.
- **Activities / Experiences System:** Tenants create guided experiences and tours (admin: "Activities"; marketplace: "Experiences"). Each activity has category, pricing, capacity, location, highlights, images, optional linked rental listing, and an Airbnb-style **Availability Schedule**. Schedule modes: `open` (date-request flow), `recurring` (weekly day+time slots that repeat), `specific` (exact date+time slots from a calendar picker). Schema fields: `scheduleMode`, `recurringSlots` (JSON), `specificSlots` (JSON) in `activitiesTable`.
- **Experience Detail Booking Sidebar:** The marketplace experience detail page (`/marketplace/experiences/:id`) has a two-card sidebar: (1) quick stats (duration, group size, location, min age), (2) booking widget. For `open` mode: guest stepper + "Request to Book". For `recurring`/`specific` modes: mini month calendar with available dates highlighted → time slot pills → guest count stepper → live price total → "Request to Book". Clicking "Request to Book" navigates to the checkout page.
- **Experience Booking Flow (Marketplace):** Full checkout + confirmation flow at `/marketplace/experiences/:id/book` (contact form + summary card) and `/marketplace/experiences/booking/:id` (confirmation page). `POST /api/activity-bookings` creates a booking (public, no auth required); `GET /api/activity-bookings/:id/public` serves the confirmation page. Booking status: `pending` → `confirmed` → `active` → `completed` | `cancelled`.
- **Activity Bookings — Admin Management:** Admin pages at `/:slug/admin/activity-bookings` (list with status filter tabs + search) and `/:slug/admin/activity-bookings/:id` (detail with status lifecycle buttons: Confirm → Check In → Mark Completed, plus admin notes editor and visual progress tracker). API routes: `GET /api/activities/bookings`, `GET /api/activities/bookings/:id`, `PATCH /api/activities/bookings/:id`. **Critical:** booking routes registered BEFORE `/activities/:id` to avoid Express route order conflict. DB table: `activityBookingsTable` in `lib/db/src/schema/activities.ts`.
- **Super Admin Team Invite Flow:** Creating a team member (`POST /api/superadmin/team`) no longer requires a password. Instead, it generates a secure 48-hour invite token, stores it in `superadminUsersTable.inviteToken`/`inviteExpiresAt`, and sends an email via Gmail with a link to `/superadmin/accept-invite?token=...`. The accept-invite page (`artifacts/rental-platform/src/pages/superadmin/accept-invite.tsx`) verifies the token via `GET /api/superadmin/team/accept-invite?token=...` and sets the password via `POST /api/superadmin/team/accept-invite`. The token is cleared from DB after acceptance. Admins can resend invites via `POST /api/superadmin/team/:id/resend-invite`. Users with no `passwordHash` (pending invite) cannot log in — the login route guards against null password hash. The team list shows invite status badges (Invite Pending / Invite Expired / Active) and a resend icon for pending/expired invites.

## Stripe Checkout Flow Hardening

- **`toStripeAmount(dollars)` helper** (`services/stripe.ts`): Converts dollars → integer cents with range validation. Throws if NaN, negative, or Infinity. Use for all Stripe `amount` fields.
- **`validateStripeCents(cents)` helper** (`services/stripe.ts`): Validates a cents value received from the client is a non-negative integer. Used at payment-intent creation to reject malformed inputs before touching Stripe.
- **`validateStripeEnv()` startup check** (`services/stripe.ts` + `index.ts`): Runs at server startup. Throws if `STRIPE_SECRET_KEY` is missing; logs warnings for `STRIPE_TEST_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_TEST_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET`.
- **Enhanced Payment Intent metadata** (`routes/stripe.ts`): PI metadata now includes `fee_mode`, `rental_base_cents`, `protection_fee_cents`, `passthrough_fee_cents`, `custom_fees_cents`, `renter_id`, and `listing_id` — all computed server-side. Useful for auditing in Stripe Dashboard.
- **`fee_mode` fetched server-side**: Payment-intent endpoint queries `businessProfileTable.feeMode` and embeds it in PI metadata, so it's always the authoritative server value.
- **`payment_intent.succeeded` webhook** now also sets `status: "confirmed"` (previously only set `stripePaymentStatus: "paid"`). Also extracts and saves `stripeChargeId` from `latest_charge`.
- **`payment_intent.payment_failed` webhook** now also sets `status: "payment_failed"` and logs the Stripe error reason.
- **New `charge.refunded` webhook handler**: Sets `stripePaymentStatus: "refunded"` or `"partially_refunded"`, saves `stripeRefundId`, `stripeRefundedAt`, `stripeRefundAmount`.
- **New booking statuses** (`lib/db/src/schema/bookings.ts`): `pending_payment` (PI created, awaiting payment confirmation) and `payment_failed` (Stripe webhook reported failure) added to the status enum.
- **New booking columns**: `stripeChargeId` (charge ID from succeeded webhook), `stripeRefundId`, `stripeRefundedAt`, `stripeRefundAmount` for refund tracking.
- **Booking status lifecycle**: `pending` (no PI / admin-created) → `pending_payment` (PI attached at booking creation) → `confirmed` (payment_intent.succeeded webhook) / `payment_failed` (payment_intent.payment_failed webhook). Kiosk and instant-booking remain `confirmed` from creation.
- **Stale pending_payment cleanup** (`services/scheduler.ts`): `cancelStalePaymentPendingBookings()` runs every 15 min and cancels `pending_payment` bookings older than 24 hours (abandoned checkouts).
- **22 unit tests** (`lib/pricing.test.ts`): 9 new tests for `toStripeAmount()` and `validateStripeCents()`; all 22 pass (13 pre-existing + 9 new).

## Known Bugs Fixed

- **Stripe `or` missing import** (`stripe.ts`): `or` from drizzle-orm was not imported, causing `[stripe/wallet] or is not defined` on every API server start. Fixed by adding `or` to the drizzle-orm import in `routes/stripe.ts`.
- **`/customers/lookup-by-email` 500 error**: Route was registered AFTER `/customers/:id` wildcard, so Express matched the literal string "lookup-by-email" as an `:id` parameter. `Number("lookup-by-email")` = NaN → database error. Fixed by reordering routes so `lookup-by-email` is registered first.
- **Wrong tenantId vs tenantSlug column**: The `lookup-by-email` handler used `eq(customersTable.tenantId, req.tenantId)` but `customersTable` uses `tenantSlug` (text), not `tenantId` (integer). This produced invalid SQL: `and  = $2`. Fixed to use `eq(customersTable.tenantSlug, tenantSlugHeader)`.
- **NaN guards in customer routes**: Added `Number.isFinite()` validation to all `/:id` pattern handlers in `routes/customers.ts` to prevent NaN from reaching the database.
- **Stripe "(unknown runtime error)"**: `elements.submit()` was being called BEFORE `stripe.confirmPayment()` in the standard Stripe Elements flow (where `clientSecret` is already set on `<Elements>`). Stripe.js calls `elements.submit()` internally inside `confirmPayment`, so calling it twice caused the "double-submission" error. Fixed by removing the separate `elements.submit()` call. Also added global `window.addEventListener('error', ...)` to suppress Stripe's internal errors from the Vite development overlay.

## Admin Credentials

- **Demo tenant** (`demo-outdoorshare`, tenant id=8): `demo@myoutdoorshare.com` / `demo123` (owner login via `POST /api/admin/auth/owner-login`)
- **Superadmin**: `owner@platform.com` / `superadmin123` (via `POST /api/superadmin/auth/login`)
- Admin login page is at `/:slug/admin` — shows tabs for Owner and Staff login

## External Dependencies

- **PostgreSQL:** Primary database.
- **Drizzle ORM:** For database interactions.
- **OpenAPI:** Specification for API definitions.
- **Orval:** API codegen tool for generating React Query hooks and Zod schemas.
- **OpenAI:** Powers the AI Assistant (OutdoorBot) using `gpt-5-mini`.
- **Stripe:** Integrated for payment processing, including Stripe Connect and Stripe Identity (implied).
- **Vite:** Frontend build tool.
- **TailwindCSS:** Utility-first CSS framework.
- **shadcn/ui:** UI component library.
- **wouter:** Routing library for React.