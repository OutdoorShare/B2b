# Workspace

## Overview

This project is a white-label rental management platform, designed as a B2B SaaS product for companies renting out items like outdoor gear. It aims to provide a fully customizable and branded experience, similar in functionality to OutdoorShare.app. The platform consists of two main components: an admin dashboard for business management and a customer-facing storefront for booking and rentals.

**Business Vision & Market Potential:** The platform targets a growing market of rental businesses seeking digital transformation. By offering a white-label solution, it empowers businesses to maintain their brand identity while leveraging robust rental management features.

**Key Capabilities:**
- Comprehensive gear listing and management.
- Multi-step customer booking process with add-ons and agreements.
- Admin dashboard for live analytics, booking management, custom quotes, and staff management.
- Multi-tenancy architecture to support multiple independent rental businesses.
- **Host role:** Marketplace renters can become Hosts — creating a micro-tenant (`is_host=true`) linked to their customer account. Hosts get a simplified dashboard (Listings, Bundles, Bookings, Settings) with no branding/white-label access. Their listings appear on the OutdoorShare marketplace. Dashboard at `/marketplace/host`.
  - **Host profile photos**: Settings page (`/marketplace/host/settings`) has a Photos section with circular avatar upload and a cover photo strip upload. Photos are stored in `businessProfileTable.logoUrl` and `coverImageUrl`. Upload via `POST /api/upload/image`.
  - **Host Stripe Connect payouts**: Settings page has a "Payouts" section (below Location & Contact). Hosts connect a Stripe Express account via `POST /api/host/stripe/connect` (returns Stripe onboarding URL). Status at `GET /api/host/stripe/status` (returns connected state, balance). Stripe dashboard link at `GET /api/host/stripe/dashboard`. Fee model: OutdoorShare keeps 20% of rental subtotal + 100% of protection plan fee; host receives 80% of rental subtotal. Host tenants created with `platformFeePercent=20`. Protection fee passed as `protectionFeeCents` in payment-intent request from rental platform checkout to isolate it from the rental subtotal in fee calculations.
  - **Host bookings page**: Full-featured `/marketplace/host/bookings` with list/calendar view toggle, status tabs (Recent/Upcoming/Cancelled/All) with live counts, live search, inline Confirm button for pending bookings, click-to-expand booking detail card/modal with status-update actions, time-progress indicators, and a calendar view with spanning booking bars by status. API: `GET /api/host/bookings` (fixed to use inline `customerName`/`customerEmail`/`customerPhone` fields, no broken join), `PATCH /api/host/bookings/:id/status`.
  - **Host bundles**: Bundles page (`/marketplace/host/bundles`) lets hosts create curated gear packages. Bundle schema in `hostBundlesTable` (lib/db/src/schema/bundles.ts): name, description, coverImageUrl, pricePerDay, listingIds (json array), discountPercent, isActive. CRUD via `GET/POST/PUT/DELETE /api/host/bundles`.
- AI Assistant (OutdoorBot) for both admin and customer support.
- Fully customizable branding and theming options.
- Integrated documentation portal.
- Consumer-facing marketplace (`/marketplace/`) with map view, category filters, and company browsing.
- **Adventure Wall / Memories** (`/marketplace/memories`): Social photo wall where renters post adventure photos, write captions, tag companies or hosts, toggle public/private visibility, and share on social media. Schema: `memoriesTable` in `lib/db/src/schema/memories.ts`. API: `GET/POST /api/memories`, `GET /api/memories/my`, `DELETE /api/memories/:id`, `GET /api/memories/tenants`.
- **Persistent chat**: Listing detail page has a real chat panel (replacing the one-shot email modal). Guest users enter name/email once (persisted in localStorage per tenant slug), then get a full conversation thread with message history, date groupings, and 5-second polling. API: `POST /api/chat/threads` (returns `{ threadId, message }`), `GET /api/chat/threads/:id` (returns `{ thread, messages }`), `POST /api/chat/threads/:id/messages`. For host listings, button shows host's first name ("Chat with Jake"); for company listings shows business name ("Chat with Wilder rentals").

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
- **Marketplace Brand Colors:** Primary green `hsl(127,55%,38%)` (vivid logo green), accent blue `hsl(197,78%,58%)` (wave sky blue). Logo: `artifacts/marketplace/public/outdoorshare-logo-transparent.png`. Colors set in `index.css` CSS variables and hardcoded in `map-view.tsx` (OS_GREEN/OS_BLUE constants) and `home.tsx` hero gradient.
- **Customer Storefront:** Branded homepage, gear detail pages with photo carousels, and a multi-step booking checkout flow.
- **Admin Dashboard:** Comprehensive dashboard with live analytics (revenue, bookings, top gear), CRUD interfaces for listings, bookings, quotes, categories, and business settings. Includes tools like a real-time notification bell, Kiosk Mode for in-store bookings, custom quote builder, and analytics dashboards.
- **White-label Theming:** CSS variable-based theming with 8 preset themes and a live color picker for extensive branding customization (logo, colors, policies).
- **AI Assistant Widget:** A floating chat widget (`AIChatWidget`) with a fixed green circular button, opening a 360x520px chat panel with a dark navy header. It renders markdown for conversation.

**Feature Specifications & System Design Choices:**

- **Multi-Tenancy:** Each rental company is a tenant, identified by `tenantId`. A `resolveTenant` middleware on all `/api` routes resolves `req.tenantId` from `x-admin-token` or `x-tenant-slug` headers. All data operations (read/write) are tenant-scoped, ensuring strict data isolation.
- **Authentication:** Separate login flows for tenant owners, staff, and customers. Customer logins are tenant-scoped.
- **Booking Storefront:** Features customer accounts, a multi-step booking process (Dates + Add-ons → Payment → Agreement → Confirmation), live price updates, required add-ons, and customer booking history. All navigation is slug-aware.
- **Rental Agreement System:** Utilizes `{{token}}` syntax for agreement templates. Super Admin can define typed "Contract Fields" (text, date, number, textarea, checkbox) with required/optional toggles, which are then used to generate input forms for renters.
- **AI Assistant (OutdoorBot):**
    - **Backend (`/api/ai/chat`):** Accepts messages, role, tenant details, and streams responses. Uses `gpt-5-mini` model with function-calling capabilities. Admin role has tools for managing listings, bookings, and business settings; Renter role provides read-only information.
    - **Frontend:** Provides a dynamic chat interface with role-specific starter prompts and activity indicators for tool usage. Conversation state is in-memory.
- **Documentation Portal:** A separate application providing a knowledge base with articles categorized by topic, project, and feature. Includes search, trending articles, and an admin interface for content management.
- **Chat System:** A renter-to-admin messaging system. DB tables: `support_threads` (one per renter+tenant conversation) and `support_messages`. API routes at `/api/chat/*` (x-tenant-slug or x-admin-token auth). Admin Messages page at `/:slug/admin/messages` — two-panel layout with thread list and live conversation. Storefront chat widget (`StorefrontChat`) is a fixed floating button at `bottom-5 right-20` (to the left of the AI assistant at `right-5`), only visible when customer is logged in. Admin sidebar "Messages" nav item shows live unread count badge (polls every 15s). Notifications and Gmail emails fire on every new message.
- **Email Verification:** When a new company signs up via `POST /api/public/signup`, a 24-hour verification token is generated, stored on the tenant row (`email_verification_token`, `email_verification_expires_at`, `email_verified`), and a branded verification email is sent via Gmail. `GET /api/public/verify-email?token=...` validates the token and marks `email_verified=true`. `POST /api/public/resend-verification` re-sends the link for a given email (privacy-preserving response). The signup page shows a "check your inbox" notice in the final step. The admin layout shows an amber banner with a "Resend" button for unverified owner accounts, and the `/verify-email` page handles success, expiry, invalid, and already-verified states.
- **URL Routing:** A comprehensive routing strategy handles SaaS marketing pages, self-registration, a demo environment, super admin functions, and tenant-specific customer storefronts (`/:slug`).
- **Social Sharing Meta Tags (Server-Side Bot Detection):** `artifacts/rental-platform/meta-bot-plugin.ts` is a Vite dev-server plugin (`tenantMetaBotPlugin`) that intercepts requests from social-media bots (Facebook, Twitter/X, WhatsApp, Slack, iMessage, etc.) before they hit the static `index.html`. It queries the DB via raw `pg` SQL to look up the tenant's business profile and, for listing detail URLs (`/:slug/listings/:id`), the specific listing. Bots receive a minimal HTML page pre-populated with correct `og:*` and `twitter:*` meta tags (title, description, image, site name, theme-color). Real browsers are redirected instantly via a `<script>` block back to the SPA URL. Uses `pg` directly to avoid ESM directory-import issues with the workspace DB package inside Vite's config context.

## External Dependencies

- **PostgreSQL:** Primary database for all platform data.
- **Drizzle ORM:** Used for database interactions with PostgreSQL.
- **OpenAPI:** Specification for API definitions, used with Orval for client code generation.
- **Orval:** API codegen tool used to generate React Query hooks and Zod schemas from OpenAPI specifications.
- **OpenAI:** Powers the AI Assistant (OutdoorBot) for chat functionalities, specifically using the `gpt-5-mini` model.
- **Stripe:** Implied for payment processing (mentioned in `doc_features` within the Documentation Portal, suggesting integration for Stripe Connect and Stripe Identity).
- **Vite:** Frontend build tool.
- **TailwindCSS:** Utility-first CSS framework for styling.
- **shadcn/ui:** UI component library.
- **wouter:** A tiny routing library for React.