# Workspace

## Overview

White-label rental management platform — a B2B SaaS product for branded rental companies (outdoor gear, etc.). Styled like OutdoorShare.app but fully white-labeled. Has two sides: an admin management dashboard and a customer-facing booking storefront.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui + wouter

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (port 8080)
│   ├── rental-platform/    # React/Vite frontend (customer + admin)
│   └── docs-portal/        # Documentation Portal at /docs/
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Rental Platform Features

### Customer-Facing Storefront (/)
- `/` — Branded homepage with hero, category filters, gear grid, search
- `/gear/:id` — Gear detail page with photo carousel, specs, booking form
- `/book` — Booking checkout with customer info form and price breakdown

### Admin Dashboard (/admin)
- `/admin` — Dashboard with live analytics: revenue, bookings, top gear, pending actions
- `/admin/listings` — Manage all gear listings: create, edit, delete, photos, pricing, category
- `/admin/listings/new` — New listing form
- `/admin/listings/:id/edit` — Edit listing form + Add-ons manager
- `/admin/bookings` — All bookings; list and calendar (month view, color-coded pills, status legend)
- `/admin/bookings/:id` — Booking detail with customer info and admin notes
- `/admin/quotes` — Custom quote builder and list
- `/admin/quotes/new` — Build multi-item quotes with discounts
- `/admin/analytics` — Revenue, booking volume (bar chart), renter locations, status breakdown, top listings
- `/admin/categories` — Manage gear categories
- `/admin/settings` — Business profile, branding (colors, logo, cover, preset themes), kiosk mode, policies, embed code
- `/admin/kiosk` — Full-screen kiosk mode with QR code overlay and idle auto-close

### Tools Available in Admin
- **Notification Bell** — Real-time bell icon in admin header and storefront nav; polls every 30s; badge count for unread; action-required items highlighted amber with dot; dropdown panel with mark-read, mark-all-read; click navigates to related page
- **Kiosk Mode** — Full-screen self-service booking for in-store iPad use; QR code for mobile completion
- **Custom Quotes** — Build and send custom multi-item quotes with discounts
- **Analytics** — Revenue over time, booking volume, renter locations (state/city), status breakdown, top performers
- **Embed Code** — HTML snippet to embed booking page on external website
- **Business Profile Editor** — Full white-label control: name, tagline, colors, logo, policies
- **White-label Theming** — CSS variable-based theming; 8 preset themes; live color picker preview

## URL Routing Structure

- `/` — SaaS marketing landing page (pricing plans, features, sign-up CTA)
- `/get-started` — Same as root (alias)
- `/signup` — 3-step SaaS self-registration wizard
- `/demo` — Side-by-side test environment: Customer View (listings + storefront links) + Admin View (live booking feed, auto-refreshes every 5s)
- `/admin/*` — Tenant admin dashboard
- `/superadmin` — Super admin login
- `/superadmin/dashboard` — Super admin company management
- `/superadmin/companies/:id` — Full company management (Account / Storefront / Listings / Bookings tabs)
- `/:slug` — Customer-facing storefront for the company with that URL slug
- `/:slug/listings/:id` — Individual listing detail + Book button
- `/:slug/book` — Multi-step booking form (requires `?listingId=` query param)
- `/:slug/login` — Customer login/register

### Booking Storefront Features
- Customer accounts with saved billing/card info (`rental_customer` in localStorage)
- Multi-step booking: Dates + Add-ons → Payment → Agreement → Confirmation
- Add-ons selection in Step 1 with live price update in sidebar
- Required add-ons auto-selected and locked
- Customer booking history on confirmation page
- Slug-aware navigation: all storefront links stay within the `/:slug/` path prefix

### Rental Agreement + Contract Fields System
- Agreement templates use `{{token}}` syntax; auto-fill tokens (green) populate from booking data; renter-fill tokens appear as inputs
- **Contract Fields** (Super Admin): Define typed fields (text/date/number/textarea/checkbox) with Required/Optional toggle, placeholder, and help text. Stored in `platform_settings` key `rental_agreement_fields`
- Super Admin agreement page has a **Contract Fields Manager** above the editor: add/edit/delete fields, each with a token key (`{{field_key}}`), type, required toggle
- Fields appear as purple chips in the token picker panel; "Insert ↗" button inserts the token into the active editor at cursor
- Renter signing flow fetches field definitions from `GET /api/platform/agreement/fields` (public)
- Agreement step shows a dedicated **"Complete Required Information"** card above the agreement text with proper input types, Required/Optional badges, and green completion indicators
- Agreement text shows filled values as highlighted spans (not inline inputs)
- Validation lists missing required fields by label name in the error toast

## Multi-Tenancy Architecture

Every rental company is a **tenant**. Each tenant has: id, name, slug, email, adminPasswordHash, adminToken.

### Tenant Resolution Middleware (`resolveTenant`)
Runs on all `/api` routes. Resolves `req.tenantId` from:
1. `x-admin-token` header → looks up staff token in `admin_users` OR owner token in `tenants` table
2. `x-tenant-slug` header → looks up tenant by slug

### Frontend (`App.tsx` — `setExtraHeadersGetter`)
- If `localStorage.admin_session` has a token → injects `x-admin-token` on all API calls
- Otherwise → injects `x-tenant-slug` from the first URL path segment (storefront slug)

### Auth Flows
- **Owner login**: `POST /api/admin/auth/owner-login` — email+password against `tenantsTable`; stores/returns `adminToken`
- **Staff login**: `POST /api/admin/auth/login` — email+password against `adminUsersTable`; stores/returns `token`
- **Customer login**: `POST /api/customers/login` — scoped per tenant by slug

### Demo Tenant
- slug: `my-rental-company`, id: 4
- Owner email: `admin@myrentalcompany.com` / password: `admin123`
- Super admin: `owner@platform.com` / `superadmin123`

## Database Schema

Tables:
- `tenants` — Rental companies (slug, email, adminPasswordHash, adminToken, plan, status)
- `business_profile` — Per-tenant branding & settings (tenantId)
- `categories` — Equipment categories (tenantId)
- `listings` — Gear inventory (tenantId, pricing, photos, specs)
- `bookings` — Customer reservations (tenantId, status tracking, addonsData JSON)
- `quotes` — Custom quotes (tenantId, line items, discounts)
- `claims` — Damage/lost claims (tenantId)
- `customers` — Customer accounts (tenantId, scoped per company)
- `admin_users` — Staff accounts (tenantId)
- `listing_addons` — Optional/required add-ons per listing
- `listing_units` — Individual unit tracking per listing (serial numbers, etc.)
- `message_logs` — Per-tenant outbound communication history (tenantId)
- `automation_settings` — Per-tenant email/SMS automation templates (tenantId, seeded on first access)

## Multi-Tenant Isolation Rules

Every data-writing endpoint stamps `tenantId` from `req.tenantId`. Every data-reading endpoint filters by `req.tenantId`. Single-record lookups (GET/PUT/DELETE `/:id`) include tenant check in WHERE clause so one tenant cannot read/modify another's records. A new tenant starts with a completely empty database view.

- **business_profile**: scoped by `tenant_id` column; auto-created on first GET
- **categories**: scoped by `tenant_id`; slug uniqueness is per-tenant (no global unique constraint)
- **listings, bookings, quotes, claims**: scoped by `tenant_id` on all CRUD + list operations
- **analytics**: all summary, revenue, top-listings, booking-volume, booking-status, renter-locations queries scoped by `tenant_id`
- **communications/renters**: scoped to tenant bookings; message_logs scoped by `tenant_id`
- **automation_settings**: per-tenant, seeded on first GET `/communications/automations`

## AI Assistant (OutdoorBot)

A floating chat widget powered by OpenAI appears on both the storefront and admin dashboard.

### Backend: `POST /api/ai/chat`
- Accepts `{ messages, role, tenantSlug, companyName }` body + auth headers
- Returns SSE stream (text/event-stream) with `{ content }`, `{ tool }`, `{ done }` events
- **Admin role**: Uses function-calling tools (get/update listings, bookings, business settings). Requires `x-admin-token` or `x-superadmin-token` header.
- **Renter role**: Read-only assistant explaining policies, protection plan, booking process. No auth required.
- Model: `gpt-5-mini`; up to 5 tool-call loops per request; max 1024 tokens per response

### Frontend: `AIChatWidget` (`src/components/ai-assistant.tsx`)
- Floating green Bot button (52px circle, `#3ab549`) fixed bottom-right
- Opens a 360×520px chat panel with header in dark navy (`#1a2332`)
- Shows starter prompts before first user message (role-specific)
- Tool activity indicator shown while admin tools are running ("Looking up your listings…")
- Markdown-like rendering: `**bold**`, `# headers`, `## headers`, `- bullet lists`, `` `code` ``
- Conversation state is in-memory only (no DB persistence)
- Wired into `AdminLayout` (with admin token) and `StorefrontLayout` (renter mode)

## API Routes

All routes prefixed with `/api`. All data routes are tenant-scoped via the middleware.
- `GET/PUT /business` — Business profile
- `GET/POST /categories` — Categories (tenant-scoped)
- `GET/POST /listings`, `GET/PUT/DELETE /listings/:id` — Listings CRUD (tenant-scoped)
- `GET/POST /bookings`, `GET/PUT /bookings/:id` — Bookings (tenant-scoped; POST accepts `addons` array)
- `GET/POST /quotes`, `PUT /quotes/:id` — Quotes (tenant-scoped)
- `GET/POST/PUT/DELETE /claims`, `GET/PUT /claims/:id` — Claims (tenant-scoped)
- `GET/POST /listings/:id/addons`, `PUT/DELETE /listings/:id/addons/:addonId` — Listing add-ons CRUD
- `GET /analytics/summary` — Dashboard stats
- `GET /analytics/revenue` — Revenue over time (7d/30d/90d/12m)
- `GET /analytics/top-listings`, `/booking-status`, `/booking-volume`, `/renter-locations` — Analytics
- `POST /customers/register`, `POST /customers/login`, `GET/PUT /customers/:id` — Customer auth + profile
- `POST /admin/auth/owner-login` — Tenant owner login (returns adminToken)
- `POST /admin/auth/login` — Staff login (returns token)
- `POST /admin/auth/logout` — Clears token
- `GET/POST/PUT/DELETE /admin/team` — Team management (tenant-scoped)
- `GET /admin/superadmin/*` — Super admin routes (x-superadmin-token required)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`.

- **Always typecheck from the root** — run `pnpm run typecheck`
- Root `tsconfig.json` lists lib packages as project references
- After OpenAPI spec changes: run `pnpm --filter @workspace/api-spec run codegen`
- DB schema changes: run `pnpm --filter @workspace/db run push`

## Documentation Portal (/docs/)

A separate product artifact at `/docs/` — a knowledge base for OutdoorShare admins and renters.

### DB Tables
- `doc_categories` — 8 categories (Getting Started, Rental Management, Payments & Billing, Admin Dashboard, Renter Experience, Troubleshooting, FAQs, Release Notes)
- `doc_projects` — 5 projects (Rental Platform, Admin Dashboard, OutdoorBot AI, Stripe Integration, Super Admin)
- `doc_features` — 15 features (Stripe Connect, Stripe Identity, Protection Plans, Renter Profiles, Contact Cards, etc.)
- `doc_articles` — 16 articles (guides, FAQs, troubleshooting, release notes)
- `doc_article_relations` — many-to-many related articles

### API Routes (`/api/docs/*`)
- `GET /api/docs/stats` — article/category/project/feature counts
- `GET /api/docs/trending` — top 8 articles by view count
- `GET /api/docs/search?q=` — full-text search across title/excerpt/content
- Full CRUD for categories, articles, projects, features

### Frontend Pages (artifacts/docs-portal/src/pages/)
- `/docs/` — Home with search hero, stats, trending articles
- `/docs/search` — Search with URL param support (`?q=query`)
- `/docs/categories` — All categories with article counts
- `/docs/categories/:slug` — Category detail with articles
- `/docs/articles/:slug` — Article page with markdown rendering + view tracking
- `/docs/projects` — All projects
- `/docs/projects/:slug` — Project detail
- `/docs/features` — Features directory with filter
- `/docs/features/:slug` — Feature detail
- `/docs/admin/*` — Admin CRUD for all content types

## Key Commands

- `pnpm --filter @workspace/api-server run dev` — Start API server
- `pnpm --filter @workspace/rental-platform run dev` — Start frontend
- `pnpm --filter @workspace/docs-portal run dev` — Start docs portal
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate client hooks
- `pnpm --filter @workspace/db run push` — Push DB schema changes
