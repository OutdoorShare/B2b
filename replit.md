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