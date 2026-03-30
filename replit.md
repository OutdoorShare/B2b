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
- `/admin/listings/:id/edit` — Edit listing form
- `/admin/bookings` — All bookings with status filters; confirm/cancel/complete actions
- `/admin/bookings/:id` — Booking detail with customer info and admin notes
- `/admin/quotes` — Custom quote builder and list
- `/admin/quotes/new` — Build multi-item quotes with discounts
- `/admin/analytics` — Revenue charts (recharts), booking status breakdown, top listings
- `/admin/categories` — Manage gear categories
- `/admin/settings` — Business profile, branding (colors, logo, cover), kiosk mode, policies, embed code
- `/admin/kiosk` — Full-screen kiosk mode for in-store tablet use

### Tools Available in Admin
- **Kiosk Mode** — Full-screen self-service booking for in-store iPad use
- **Custom Quotes** — Build and send custom multi-item quotes with discounts
- **Analytics** — Revenue over time, booking status breakdown, top performers, utilization
- **Embed Code** — HTML snippet to embed booking page on external website
- **Business Profile Editor** — Full white-label control: name, tagline, colors, logo, policies

## Database Schema

Tables:
- `business_profile` — Single-row business settings and branding
- `categories` — Equipment categories
- `listings` — Gear inventory with pricing, photos, specs
- `bookings` — Customer reservations with status tracking
- `quotes` — Custom quotes with line items and discounts

## API Routes

All routes prefixed with `/api`:
- `GET/PUT /business` — Business profile
- `GET/POST /categories` — Categories
- `GET/POST /listings`, `GET/PUT/DELETE /listings/:id` — Listings CRUD
- `GET/POST /bookings`, `GET/PUT /bookings/:id` — Bookings
- `GET/POST /quotes`, `PUT /quotes/:id` — Quotes
- `GET /analytics/summary` — Dashboard stats
- `GET /analytics/revenue` — Revenue over time (7d/30d/90d/12m)
- `GET /analytics/top-listings` — Top revenue listings
- `GET /analytics/booking-status` — Status breakdown

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
