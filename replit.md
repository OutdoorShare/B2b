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
│   ├── api-server/         # Express API server
│   └── rental-platform/    # React/Vite frontend (customer + admin)
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

## Key Commands

- `pnpm --filter @workspace/api-server run dev` — Start API server
- `pnpm --filter @workspace/rental-platform run dev` — Start frontend
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate client hooks
- `pnpm --filter @workspace/db run push` — Push DB schema changes
