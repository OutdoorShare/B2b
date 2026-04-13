# Workspace

## Overview

This project is a white-label B2B SaaS rental management platform enabling companies to rent out items like outdoor gear. It offers a fully customizable and branded experience, featuring an admin dashboard for business management and a customer-facing storefront for bookings. The platform supports multi-tenancy, allowing independent rental businesses to manage their operations, and provides a consumer-facing marketplace. Key capabilities include comprehensive gear and activity listings, a multi-step booking process with add-ons and agreements, advanced analytics, custom quotes, staff management, and an AI Assistant (OutdoorBot) for support. The platform also includes social sharing features, a persistent chat system, split payment options, embeddable listing cards, and a robust documentation portal.

## User Preferences

I prefer iterative development with clear communication on significant changes. I like to see detailed explanations for complex implementations. Please ensure all code is well-documented and follows best practices. When making changes, prioritize solutions that maintain the multi-tenancy architecture and ensure data isolation.

## System Architecture

The platform is a monorepo utilizing `pnpm workspaces`, Node.js 24, and TypeScript 5.9.

**Core Technologies:**
- **Backend:** Express 5 API, PostgreSQL with Drizzle ORM, Zod for validation, Orval for API codegen.
- **Frontend:** React with Vite, TailwindCSS, shadcn/ui, and wouter for routing.

**Monorepo Structure:**
- `artifacts/`: Contains deployable applications (`api-server`, `rental-platform`, `docs-portal`).
- `lib/`: Houses shared libraries (`api-spec`, `api-client-react`, `api-zod`, `db`).

**UI/UX Decisions:**
- **Marketplace Brand Colors:** Primary green `hsl(127,55%,38%)`, accent blue `hsl(197,78%,58%)`.
- **Customer Storefront:** Branded homepage, detailed gear pages with carousels, and a multi-step booking checkout.
- **Admin Dashboard:** Comprehensive dashboard with live analytics, CRUD for listings, bookings, quotes, and settings. Includes a real-time notification bell and Kiosk Mode.
- **White-label Theming:** CSS variable-based theming with 8 presets and a live color picker.
- **Centralized Head Branding:** `applyPlatformBrand` and `applyStorefrontBrand` manage document `<head>` elements (title, favicon, OG, Twitter meta). Storefront branding is tenant-specific, while admin branding defaults to the platform.
- **AI Assistant Widget:** A floating chat widget (`AIChatWidget`) with a fixed green button, opening a 360x520px chat panel with a dark navy header, rendering markdown.

**Feature Specifications & System Design Choices:**
- **Multi-Tenancy:** Data isolation is enforced via a `resolveTenant` middleware, scoping all operations by `tenantId`.
- **Authentication:** Separate login flows for tenant owners, staff, and customers, with customer logins tenant-scoped.
- **Booking Storefront:** Features customer accounts, a multi-step booking (Dates + Add-ons → Payment → Agreement → Confirmation), live pricing, and booking history.
- **Per-Listing Embed Codes:** Provides iframe-friendly embed URLs for external website integration.
- **Split Payment Plans:** Allows tenants to offer deposit-based payment schedules.
- **Rental Agreement System:** Uses `{{token}}` syntax for templates and typed "Contract Fields" for dynamic input.
- **AI Assistant (OutdoorBot):** Backend uses `gpt-5-mini` with function-calling; frontend offers a dynamic chat interface.
- **Documentation Portal:** A separate application for knowledge base management.
- **Chat System:** Renter-to-admin messaging with dedicated DB tables, API, admin interface, and email notifications.
- **Email Verification:** Token-based verification for new company sign-ups.
- **URL Routing:** Handles marketing pages, self-registration, super admin functions, and tenant-specific storefronts (`/:slug`).
- **Social Sharing Meta Tags:** Vite plugin serves minimal HTML with `og:*` and `twitter:*` tags for social media.
- **Activities / Experiences System:** Supports creation of guided experiences with flexible availability scheduling (open, recurring, specific modes).
- **Experience Booking Flow:** Marketplace experience detail pages include a booking sidebar and a full checkout/confirmation flow.
- **Activity Bookings — Admin Management:** Admin interfaces for listing, filtering, and managing activity bookings, including status lifecycle and notes.
- **Super Admin Team Invite Flow:** Streamlined invitation process where new team members receive an email with a secure token to set their password.

## External Dependencies

- **PostgreSQL:** Primary database.
- **Drizzle ORM:** Object-relational mapper.
- **OpenAPI:** API specification standard.
- **Orval:** API client code generation tool.
- **OpenAI:** Provides the `gpt-5-mini` model for the AI Assistant.
- **Stripe:** Payment processing for bookings and refunds.
- **Vite:** Frontend build tool.
- **TailwindCSS:** Utility-first CSS framework.
- **shadcn/ui:** UI component library.
- **wouter:** Client-side routing library for React.