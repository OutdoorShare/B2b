/**
 * Seed comprehensive OutdoorShare documentation.
 * Run: node scripts/seed-docs.mjs
 * Wipes existing docs then re-inserts all categories + articles.
 */

const BASE = "http://localhost:8080/api";

async function api(method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`${method} ${path} → ${r.status}: ${t}`);
  }
  if (r.status === 204) return null;
  return r.json();
}

// ─── Content ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { name: "Getting Started",        slug: "getting-started",      description: "Set up your OutdoorShare rental platform from scratch — step-by-step.",           icon: "rocket",       color: "#22c55e", sortOrder: 1 },
  { name: "Listings & Inventory",   slug: "listings-inventory",   description: "Create, manage, and optimise your rental equipment listings and stock levels.",    icon: "package",      color: "#3b82f6", sortOrder: 2 },
  { name: "Bookings & Rentals",     slug: "bookings-rentals",     description: "Understand the full booking lifecycle — from request to pickup to return.",        icon: "calendar",     color: "#8b5cf6", sortOrder: 3 },
  { name: "Payments & Billing",     slug: "payments-billing",     description: "Configure Stripe Connect, fees, protection plans, deposits, and payouts.",         icon: "credit-card",  color: "#f59e0b", sortOrder: 4 },
  { name: "Operations",             slug: "operations",           description: "Quotes, damage claims, communications, waivers, and kiosk workflows.",             icon: "settings",     color: "#06b6d4", sortOrder: 5 },
  { name: "Customer Management",    slug: "customer-management",  description: "Manage renters, contact cards, messaging, and identity verification.",             icon: "users",        color: "#ec4899", sortOrder: 6 },
  { name: "AI & Tools",             slug: "ai-tools",             description: "OutdoorBot AI assistant, analytics dashboards, and the kiosk self-service mode.",  icon: "brain",        color: "#14b8a6", sortOrder: 7 },
  { name: "Account & Team",         slug: "account-team",         description: "Branding settings, team roles, subscription billing, and marketplace presence.",   icon: "shield",       color: "#64748b", sortOrder: 8 },
  { name: "FAQ",                    slug: "faq",                  description: "Answers to the most common questions from rental operators and customers.",         icon: "help-circle",  color: "#f97316", sortOrder: 9 },
];

const ARTICLES = {
  "getting-started": [
    {
      title: "Platform Overview",
      slug: "platform-overview",
      excerpt: "A high-level tour of every feature available in OutdoorShare.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["overview", "intro"],
      content: `## What is OutdoorShare?

OutdoorShare is a **white-label rental management SaaS** that lets you run a fully-branded outdoor equipment rental business. Whether you rent kayaks, bikes, camping gear, or power tools, OutdoorShare handles the entire lifecycle — online bookings, payments, customer verification, pickup coordination, and damage claims — under your own brand.

## Core modules

| Module | What it does |
|--------|-------------|
| **Storefront** | Branded public-facing website where customers browse listings and book online |
| **Admin Dashboard** | Central hub to manage bookings, listings, customers, and settings |
| **Booking Engine** | End-to-end rental workflow with payment collection and status tracking |
| **Payments** | Stripe Connect integration for secure payments and direct payouts |
| **Operations** | Quotes, claims, communications, and documentation |
| **AI Assistant** | OutdoorBot answers customer questions and helps admins inside the dashboard |
| **Analytics** | Revenue, booking volume, and occupancy reports |
| **Marketplace** | Cross-tenant discovery for renters searching for equipment |

## Who is it for?

- Outdoor rental shops (kayaks, bikes, skis, camping gear)
- Marine equipment rentals (boats, jet skis, paddleboards)
- ATV and power-sports rental companies
- Photography and production equipment rental houses
- Any business renting physical equipment by the day or hour

## How tenants and the platform relate

OutdoorShare runs on a **multi-tenant** model. Each rental company (tenant) gets their own admin dashboard, storefront URL, and Stripe account — while sharing the same infrastructure. The platform owner (you) can configure fees, review all tenants, and manage platform-wide settings from the superadmin panel.

## FAQ

**Q: Do I need technical knowledge to set up OutdoorShare?**

A: No. The Launchpad wizard walks you through every required setup step — no code required.

**Q: Can I use my own domain?**

A: Yes. Custom domains can be configured in your tenant settings so your storefront appears at your own URL.

**Q: Is there a transaction fee?**

A: OutdoorShare charges a configurable platform processing fee per booking. See the *Platform Fees* article for details.`,
    },
    {
      title: "Launchpad: Quick Setup Guide",
      slug: "launchpad-quick-setup",
      excerpt: "Follow the Launchpad checklist to go from zero to live in minutes.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["setup", "launchpad", "onboarding"],
      content: `## What is Launchpad?

**Launchpad** is the guided setup wizard inside your admin dashboard. It presents a checklist of critical setup tasks and shows you exactly how to complete each one.

## Accessing Launchpad

1. Sign in to your admin dashboard.
2. In the left sidebar, click **Launchpad**.
3. You'll see a checklist of setup steps grouped by priority.

## Checklist steps

### 1. Business Profile
Fill in your company name, logo, support email, and branding colours. These appear on every customer-facing page and email.

### 2. Connect Stripe
Link a Stripe account so you can accept payments. OutdoorShare uses Stripe Connect — each tenant's money goes directly to their own Stripe account; the platform fee is deducted automatically.

### 3. Create your first listing
Add at least one piece of rental equipment — give it a title, photos, price, and availability window.

### 4. Set up inventory (optional)
If you track individual units (e.g. numbered paddleboards), create inventory records and link them to the listing.

### 5. Invite team members (optional)
Add staff and assign roles (Admin or Staff).

### 6. Configure communications
Review the automated email templates that fire at each booking stage — customise them to match your brand voice.

### 7. Go live
Toggle your storefront to **Active** and share your storefront URL with customers.

## Tips

- You can revisit Launchpad at any time — completed steps are checked off but can be re-opened.
- Skipping a step doesn't prevent you from going live; some steps (like Stripe Connect) only matter when a customer tries to pay.

## FAQ

**Q: Do I have to complete every step before accepting bookings?**

A: No. You can accept bookings without Stripe connected if you're handling payments offline. For online payments, Stripe Connect is required.

**Q: Where do I find my storefront URL?**

A: Go to **Settings → Storefront** to see and copy your public URL.`,
    },
    {
      title: "Creating Your First Listing",
      slug: "creating-your-first-listing",
      excerpt: "Add your first piece of rental equipment — title, photos, pricing, and availability.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["listing", "setup", "getting-started"],
      content: `## Overview

A **listing** is a rentable item visible on your storefront. Each listing has a title, description, photos, pricing, availability settings, and optional add-ons.

## Steps

### 1. Open the Listings section
In your admin dashboard, click **Listings** in the left nav, then click **+ New Listing**.

### 2. Fill in the basics
| Field | Description |
|-------|-------------|
| **Title** | Clear name for the item (e.g. "2-Person Kayak — Red") |
| **Category** | Groups items on your storefront (create categories under Settings) |
| **Description** | Sell the item — describe features, included accessories, and any conditions |
| **Condition** | Excellent / Good Used / Fair — shown as a badge to customers |

### 3. Set pricing
Choose a pricing model:
- **Per day** — the most common option for multi-day rentals
- **Per hour** — for short-duration rentals
- **Flat fee** — fixed price regardless of duration

Enter the base rate and an optional security deposit amount.

### 4. Upload photos
Upload at least 3 high-quality photos. The first photo becomes the hero image on the storefront card.

### 5. Set availability
- **Minimum rental days** — e.g. 2 days minimum
- **Advance booking notice** — e.g. require 24 hours' notice
- **Blocked dates** — pre-block dates when the item is unavailable (maintenance, personal use, etc.)

### 6. Add-ons (optional)
Add optional or required extras (e.g. helmets, life jackets, delivery) with their own pricing.

### 7. Publish
Toggle the listing status to **Active** and it will appear on your storefront immediately.

## FAQ

**Q: How many listings can I have?**

A: Unlimited on all plans.

**Q: Can I duplicate a listing?**

A: Not directly yet — you can create a new listing and copy the details manually.

**Q: What image formats are supported?**

A: JPEG, PNG, WebP. Maximum 10 MB per image.`,
    },
    {
      title: "Connecting Stripe Payments",
      slug: "connecting-stripe-payments",
      excerpt: "Link your Stripe account to start accepting customer payments online.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["stripe", "payments", "setup"],
      content: `## Why Stripe Connect?

OutdoorShare uses **Stripe Connect** so that each rental company collects payments directly into their own Stripe account. The platform fee is split automatically — no manual transfers needed.

## Steps

1. From your admin dashboard, go to **Settings → Payments** or click the **Connect Stripe** task in Launchpad.
2. Click **Connect with Stripe**.
3. You'll be redirected to Stripe's OAuth flow. Sign in to your existing Stripe account, or create a new one.
4. Authorise the connection and you'll be redirected back to your dashboard.
5. The Payments tab will now show your Stripe account status as **Connected**.

## What happens after connecting?

- Customers who book through your storefront can pay by credit/debit card at checkout.
- Funds are deposited to your Stripe account minus the OutdoorShare platform fee and Stripe's own processing fee.
- You can view payouts and balances in **Wallet** inside your dashboard.

## Test mode vs Live mode

Your dashboard starts in **Test Mode**. In test mode:
- Bookings use Stripe test card numbers (e.g. 4242 4242 4242 4242)
- No real money changes hands
- Use test mode to verify your entire booking flow before going live

To switch to live mode, toggle **Test Mode Off** in Settings and make sure your Stripe account is fully verified.

## FAQ

**Q: Do I need a Stripe account already?**

A: You can create one during the Connect flow — Stripe's onboarding is built into the process.

**Q: What currencies are supported?**

A: Any currency Stripe supports. Set your default currency in Settings.

**Q: What is the platform fee?**

A: The platform fee is configurable by the OutdoorShare superadmin. By default it is a small percentage of each booking total and is shown to the customer as a separate line item at checkout.`,
    },
    {
      title: "Inviting Team Members",
      slug: "inviting-team-members",
      excerpt: "Add staff and assign roles so your whole team can manage bookings.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["team", "staff", "roles"],
      content: `## Overview

You can invite as many staff members as you need. Team members get their own login and can access the admin dashboard based on their assigned role.

## Roles

| Role | Permissions |
|------|-------------|
| **Owner / Admin** | Full access — settings, billing, team management, all features |
| **Staff** | Can manage bookings and listings; cannot change billing or team |

## Inviting a member

1. Go to **Team** in the sidebar.
2. Click **Invite Member**.
3. Enter their email address and select a role.
4. Click **Send Invite**.

The invitee receives an email with a secure sign-in link. They click it and set their password on first login.

## Managing existing members

- Click any member row to edit their role.
- Use the trash icon to remove a member and revoke their access immediately.

## FAQ

**Q: Can a staff member access billing or Stripe settings?**

A: No. Only Admin/Owner roles can access Settings, Billing, and Team Management.

**Q: Is there a limit to the number of team members?**

A: No limit.

**Q: What happens if I remove a member?**

A: Their access is immediately revoked. Bookings and actions they created are retained.`,
    },
  ],

  "listings-inventory": [
    {
      title: "Managing Listings",
      slug: "managing-listings",
      excerpt: "Edit, duplicate, deactivate, and organise your rental equipment listings.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["listings", "management"],
      content: `## The Listings list view

Go to **Listings** in the sidebar to see all your equipment. Each row shows:
- Thumbnail, title, and category
- Pricing
- Status badge (Active / Draft / Inactive)
- Total booking count

Click any listing to open the detail view.

## Listing statuses

| Status | Visible on storefront? |
|--------|----------------------|
| **Active** | Yes |
| **Draft** | No |
| **Inactive** | No |

## Editing a listing

From the listing detail page, click **Edit Listing** to open the edit form. All fields are editable — changes save immediately.

## Blocking dates

From the listing detail page, scroll to **Availability**. Select a date range on the calendar and optionally add a reason (e.g. "Annual maintenance"), then click **Block These Dates**. Blocked dates appear red on the customer-facing booking calendar and cannot be booked.

To remove a block, click the X next to any blocked period.

## Listing rules

Click the **Rules** tab on a listing to set:
- Minimum rental days
- Maximum rental days
- Advance booking notice (hours)
- Same-day return allowed?
- Seasonal restrictions

## Embed codes

Each listing has a **Widget Embed Code** (found under the listing's Embed tab). Paste this \`<script>\` snippet into any external website to show a live booking widget for that specific listing.

## FAQ

**Q: Why isn't my listing showing on the storefront?**

A: Check that the listing status is **Active** and your storefront is also set to Active in Settings.

**Q: Can I reorder how listings appear?**

A: Listings are shown newest first by default. Category filtering helps customers find items.`,
    },
    {
      title: "Inventory & Unit Tracking",
      slug: "inventory-unit-tracking",
      excerpt: "Track individual units of equipment — serial numbers, barcodes, and stock availability.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["inventory", "units", "stock"],
      content: `## What is inventory?

**Inventory** lets you track individual physical units of equipment under a listing. For example, if you have 6 identical red kayaks, you'd create 6 inventory records under the Kayak listing — each with a unique ID or serial number.

## Why use inventory?

- Prevents double-booking the same physical unit
- Helps staff know exactly which unit to hand to a customer
- Enables barcode/QR scanning for quick check-in/out
- Provides per-unit maintenance tracking

## Adding inventory items

1. Open a listing and click the **Inventory** tab.
2. Click **Add Unit**.
3. Fill in: Unit ID / Serial Number, Barcode (optional), Colour, Notes.
4. Set status: **Available**, **In Repair**, or **Retired**.
5. Save.

## Bulk import

Click **Import Units** to upload a CSV file with columns: \`unit_id\`, \`serial_number\`, \`barcode\`, \`color\`, \`notes\`.

## Unit statuses

| Status | Bookable? |
|--------|----------|
| Available | Yes |
| In Repair | No |
| Retired | No |

## FAQ

**Q: Do I have to use inventory?**

A: No. Inventory is optional. If you don't create units, OutdoorShare tracks availability at the listing level (by booking count vs. quantity).

**Q: Can I assign a specific unit to a booking?**

A: Yes — in the booking detail view, you can select which unit is assigned for pickup.`,
    },
    {
      title: "Pricing Models & Add-ons",
      slug: "pricing-models-addons",
      excerpt: "Configure per-day, per-hour, and flat-fee pricing plus optional and required add-ons.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["pricing", "add-ons", "fees"],
      content: `## Pricing types

Each listing uses one of three pricing models:

| Model | When to use |
|-------|-------------|
| **Per day** | Multi-day equipment rental (most common) |
| **Per hour** | Short-duration rentals (e.g. 2-hour kayak paddle) |
| **Flat fee** | Fixed price regardless of duration (e.g. a delivery charge) |

Set the pricing type and base rate when creating or editing a listing.

## Security deposit

An optional security deposit is pre-authorised on the customer's card at booking. The hold is released automatically when the booking is marked as Returned with no damage claim.

## Custom fees

Beyond the listing price, you can add **custom fees** that are charged to every booking:
- Cleaning fee (flat)
- Fuel surcharge (flat)
- Insurance (per day)

Custom fees are created in **Settings → Custom Fees** and apply platform-wide. If the total custom fee exceeds $100 on a single booking, OutdoorShare adds a small 3% processing fee.

## Add-ons

**Add-ons** are per-listing extras the customer can select at checkout:
- Optional extras (e.g. paddle, helmet, life jacket)
- Required extras (automatically added — e.g. mandatory safety kit)

Create add-ons from the **Add-ons** tab on any listing. Set a name, price, and whether it's per-day or a flat fee.

## FAQ

**Q: Can I charge different prices for weekends?**

A: Not yet — all days use the same daily rate. Weekend pricing is on the roadmap.

**Q: Are add-on prices included in the platform fee calculation?**

A: Yes — the platform fee is calculated on the full booking total including add-ons.`,
    },
    {
      title: "Listing Embed Widget",
      slug: "listing-embed-widget",
      excerpt: "Embed a live booking widget for any listing on any external website.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["embed", "widget", "integration"],
      content: `## Overview

Every listing has a shareable **embed widget** — a small iframe snippet you can paste into any website (Squarespace, WordPress, Wix, a plain HTML page) to show a live booking card for that specific item.

## Getting the embed code

1. Open a listing in your admin dashboard.
2. Click the **Embed** tab.
3. Copy the \`<script>\` / \`<iframe>\` snippet shown.
4. Paste it into your external website's HTML.

## What the widget shows

The embed widget displays a side-by-side card with:
- Item photo (left)
- Title, price, location, condition, and description (right)
- **Book Now** button that opens the full booking flow in a new tab
- **View full details** link to the listing page on your storefront

The widget is fully responsive and uses your brand's primary colour for the button.

## Customising the widget size

The embed code creates an \`<iframe>\` with a default size. You can override the \`width\` and \`height\` attributes in the HTML snippet to fit your page layout. The widget adapts to any container width above 300 px.

## FAQ

**Q: Does the widget work on any website platform?**

A: Yes — it's a standard \`<iframe>\` and works on any website that allows embedding external HTML.

**Q: Will the widget stay up to date?**

A: Yes — the widget fetches live data from your OutdoorShare account. Price and availability changes are reflected immediately.

**Q: Does the widget handle the full payment?**

A: No — clicking Book Now opens the full booking flow on your OutdoorShare storefront in a new tab. The payment is completed there.`,
    },
  ],

  "bookings-rentals": [
    {
      title: "Booking Lifecycle Overview",
      slug: "booking-lifecycle-overview",
      excerpt: "Understand every status phase a booking passes through — from request to return.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["bookings", "lifecycle", "status"],
      content: `## Booking phases

Every booking in OutdoorShare passes through a defined sequence of phases:

| Phase | Status | Description |
|-------|--------|-------------|
| **1 — Booking** | \`pending\` → \`confirmed\` | Customer selects dates and pays. Admin confirms. |
| **2 — Pre-pickup** | \`confirmed\` | Automated reminders sent. Rental agreement signing, identity verification. |
| **3 — Pickup** | \`confirmed\` | Admin marks equipment picked up; pickup photos documented. |
| **4 — Active Rental** | \`active\` | Equipment in the renter's possession. |
| **5 — Pre-return** | \`active\` | Automated return reminder sent 24 hours before end date. |
| **6 — Return** | \`active\` → \`completed\` | Return photos documented; admin marks returned. Deposit released. |

## The admin task checklist

On every confirmed/active booking detail page you'll see a **Task Checklist** — a live list of actions to complete before and after the rental:

- **Rental Agreement** — send a digital agreement for the renter to sign
- **Identity Verification** — send a Stripe Identity link for government ID verification
- **Pickup Photos** — send a link for the renter to upload photos of the equipment before pickup
- **Return Photos** — send a link for return condition documentation

The checklist shows only tasks relevant to the current booking phase.

## Status transitions

| From | Action | To |
|------|--------|----|
| Pending | Admin confirms | Confirmed |
| Confirmed | Admin marks picked up | Active |
| Active | Admin marks returned | Completed |
| Any | Admin cancels | Cancelled |

## FAQ

**Q: Can a customer cancel their booking?**

A: Yes — from their booking detail page on the storefront, if the rental has not yet started.

**Q: What happens to the deposit when a booking is completed?**

A: The security deposit hold is released automatically when the booking is marked Returned (unless a damage claim is filed).

**Q: Can I reopen a completed booking?**

A: Not directly. Contact support if you need to make corrections to a completed booking.`,
    },
    {
      title: "Creating a Booking Manually",
      slug: "creating-booking-manually",
      excerpt: "Create a booking directly in the admin without going through the storefront.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["bookings", "manual", "admin"],
      content: `## When to use manual bookings

- A customer calls or walks in and you want to register the booking immediately
- You want to block dates for a private reservation
- You're migrating existing bookings from another system

## Steps

1. Go to **Bookings** in the sidebar.
2. Click **+ New Booking**.
3. Select the listing and (optionally) the specific unit.
4. Enter the customer's email address. If they don't have an account yet, one is created automatically.
5. Set the rental start and end dates.
6. Choose whether to charge a deposit.
7. Add any custom notes.
8. Click **Create Booking**.

The booking is created in **Confirmed** status. The customer receives a confirmation email.

## Payment for manual bookings

Manual bookings can be:
- **Paid online** — the customer receives a payment link by email
- **Marked as paid offline** — if you collected cash or processed payment externally

## FAQ

**Q: Can I create a booking for a date that's already blocked?**

A: Admin-created bookings can override blocked dates. A warning is shown if dates conflict with an existing booking.

**Q: Will the customer receive an email when I create a manual booking?**

A: Yes — a confirmation email is sent to the customer's email address automatically.`,
    },
    {
      title: "Split Payment Plans",
      slug: "split-payment-plans",
      excerpt: "Let customers spread their rental cost across two or more installments.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["payments", "split", "installments"],
      content: `## Overview

**Split Payment Plans** let customers divide their total booking cost into multiple payments — for example, 50% now and 50% 14 days before pickup.

## Enabling split payments

Split payments are configured per listing. To enable:
1. Open a listing and click **Edit Listing**.
2. Scroll to **Payment Options**.
3. Toggle **Allow Split Payments** on.
4. Set the split schedule (e.g. 50% at booking, 50% 14 days before start date).
5. Save.

## How it works for customers

At checkout, customers who qualify for split payment see a **"Split Payment"** option. Choosing it:
1. Charges the first installment immediately.
2. Schedules the second installment charge automatically on the configured future date.
3. Both charges appear as line items in the booking payment summary.

If the second charge fails (e.g. card expired), the customer receives an email prompting them to update their payment method, and the admin receives an alert.

## FAQ

**Q: Can I offer a different split (e.g. 30/70)?**

A: The split percentage is configurable per listing. Any percentage is supported.

**Q: What if the customer cancels after the first payment?**

A: Refund policies are determined by your standard refund process. The second installment is not charged if the booking is cancelled before its scheduled date.

**Q: Is the deposit included in the split?**

A: No — the security deposit is a separate hold on the card and is not split.`,
    },
    {
      title: "Rental Agreements",
      slug: "rental-agreements",
      excerpt: "Send digital rental agreements for renters to sign before pickup.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["agreements", "waivers", "legal"],
      content: `## Overview

Before every rental, OutdoorShare can send the renter a digital **Rental Agreement** to sign. The signed agreement is stored and attached to the booking record.

## Setting up your agreement

1. Go to **Settings → Waivers / Agreement**.
2. Paste or type your rental terms and conditions.
3. Save. The agreement is immediately available for all new bookings.

## Sending the agreement

From a confirmed booking's Task Checklist:
1. Click **Send Agreement** next to the Rental Agreement step.
2. The renter receives an email with a secure link to review and sign.
3. Once signed, the step shows a green checkmark and the signed timestamp.

You can also copy the agreement link to share manually via text or messaging apps.

## What renters see

Renters click the link, read the agreement text, type their name as a digital signature, and submit. They receive a confirmation email with a copy of the signed agreement.

## FAQ

**Q: Is a digital signature legally binding?**

A: In most jurisdictions, yes — provided you have evidence of agreement and an identifiable signature. OutdoorShare records the timestamp and renter email. Consult your legal advisor for jurisdiction-specific advice.

**Q: Can I use a different agreement for different listings?**

A: Currently, one agreement applies to all listings. Per-listing agreements are on the roadmap.`,
    },
    {
      title: "Pickup & Return Photo Documentation",
      slug: "pickup-return-photos",
      excerpt: "Document equipment condition at pickup and return to protect against disputes.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["photos", "documentation", "evidence"],
      content: `## Why document condition?

Photo documentation at **pickup** and **return** creates a timestamped visual record of the equipment's condition. If damage is reported after a rental, these photos are the key evidence for resolving disputes fairly.

## Sending a photo upload link

From the booking's Task Checklist:

**Pickup photos:**
1. Find the **Pickup Photos** step.
2. Click **Email Link** to send the renter a link, or **Copy Link** to share manually.
3. The renter opens the link, takes/uploads photos, and submits.
4. Photos appear in the booking detail immediately.

**Return photos:**
- Available once the booking is in **Active** status.
- Same process — send or copy the return photo link when the renter brings equipment back.

## Viewing submitted photos

Photos appear in a grid on the booking detail page once submitted. Click any photo to open it full-size. Photos are stored permanently and linked to the booking record.

## AI Inspection

If both pickup and return photos have been submitted, click **Run AI Inspection** to have OutdoorBot automatically compare the photos and flag potential damage. The AI report is saved to the booking.

## FAQ

**Q: What if the renter doesn't submit photos?**

A: You can proceed without them. However, without documentation you lose the ability to prove pre-rental condition.

**Q: Can the admin upload photos on behalf of the renter?**

A: Not through the renter photo link. Admins can note condition in the booking notes field.

**Q: Are photos backed up?**

A: Yes — all photos are stored in object storage with redundancy.`,
    },
    {
      title: "Identity Verification",
      slug: "identity-verification",
      excerpt: "Verify renter identities with government-issued ID via Stripe Identity.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["identity", "verification", "stripe", "KYC"],
      content: `## Overview

**Identity Verification** uses **Stripe Identity** to confirm a renter's government-issued ID before they pick up equipment. This reduces fraud and gives you legal recourse in case of damage or theft.

## Sending a verification request

From the booking's Task Checklist:
1. Click **Send Identity Link** next to the Identity Verified step.
2. The renter receives an email with a link to Stripe's identity verification flow.
3. They upload a photo of their government ID (passport, driver's licence) and a selfie.
4. Stripe returns a pass/fail result in seconds.
5. The booking checklist updates to show the verification status.

## Verification statuses

| Status | Meaning |
|--------|---------|
| Not sent | Request hasn't been sent yet |
| Pending | Renter has started but not completed |
| Verified | ID confirmed ✓ |
| Failed | Could not verify — follow up manually |

## FAQ

**Q: Is identity verification mandatory?**

A: It's optional per booking. You decide when to require it — for example, on high-value equipment rentals.

**Q: Does Stripe store the ID photos?**

A: Stripe handles all ID data under their Privacy Policy and PCI compliance. OutdoorShare only receives the verification result (pass/fail), not the ID images.

**Q: What if verification fails?**

A: You can still proceed manually — contact the renter to verify in person before handing over equipment.`,
    },
  ],

  "payments-billing": [
    {
      title: "Platform Fees Explained",
      slug: "platform-fees-explained",
      excerpt: "How OutdoorShare platform fees work, who pays them, and how they're configured.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["fees", "platform", "pricing"],
      content: `## What is the platform fee?

The **platform fee** is a percentage of each booking total that OutdoorShare charges for providing the rental management infrastructure. It covers hosting, payments processing coordination, customer support tooling, and platform development.

## Who pays the fee?

The platform fee can be configured in two ways:

| Mode | Who pays |
|------|----------|
| **Absorbed by business** | The rental company pays the fee from their revenue |
| **Passed to customer** | The fee is shown as a separate line item to the customer at checkout |

By default, the fee is passed to the customer (similar to a "service fee" on other booking platforms). You can change this in **Settings → Payments → Platform Fee**.

## Fee calculation

The fee is calculated as a percentage of the **base rental amount** (excluding taxes). Custom fees above $100 have an additional 3% processing fee applied.

## FAQ

**Q: Can I see the fee breakdown on each booking?**

A: Yes — the booking detail page shows a full payment breakdown including the platform fee amount.

**Q: Can I change the fee percentage?**

A: The platform fee percentage is set by the OutdoorShare superadmin. Contact support to discuss your fee tier.

**Q: Is the deposit included in the fee calculation?**

A: No — security deposits are excluded from the platform fee.`,
    },
    {
      title: "Protection Plans",
      slug: "protection-plans",
      excerpt: "Offer optional damage protection tiers to customers at checkout.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["protection", "damage", "insurance"],
      content: `## What is a protection plan?

A **Protection Plan** is an optional add-on at checkout that covers the renter against liability for accidental damage to the equipment. Different tiers offer different levels of coverage.

## Configuring protection plans

1. Go to **Settings → Protection Plans**.
2. Enable the protection plan feature.
3. Add one or more tiers:
   - **Name** (e.g. Basic Protection, Full Coverage)
   - **Price** (flat or per-day)
   - **Coverage description** — what's included/excluded
4. Choose whether the plan is **optional** (customer can decline) or **mandatory**.

## How it works at checkout

If protection plans are configured:
- Customers see the available tiers on the booking summary page.
- If the plan is optional, they can check **"I decline protection"** to opt out (shown with a warning about accepting full liability).
- The selected plan's cost is added as a line item to the booking total.

## Handling claims

If a renter with a protection plan reports damage:
1. Go to **Claims** and file a new claim on the booking.
2. Upload photos and describe the damage.
3. If the plan covers the damage, the renter's liability is limited per the plan terms.
4. If no plan was purchased, the renter is liable for the full repair/replacement cost.

## FAQ

**Q: Is protection plan revenue included in my Stripe payout?**

A: Yes — protection plan fees are collected with the booking payment and paid out to you via Stripe.

**Q: Can I make protection mandatory for all bookings?**

A: Yes — toggle "Make protection plan mandatory" in Settings.`,
    },
    {
      title: "Promo Codes",
      slug: "promo-codes",
      excerpt: "Create discount codes to incentivise bookings — percentage or fixed amount.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["promo", "discount", "codes"],
      content: `## Overview

**Promo codes** let customers apply a discount at checkout. You control the discount type, amount, usage limit, and expiry date.

## Creating a promo code

1. Go to **Promo Codes** in the sidebar.
2. Click **+ New Code**.
3. Fill in:
   - **Code** — the string customers type (e.g. SUMMER20)
   - **Discount type** — Percentage (%) or Fixed amount ($)
   - **Discount value** — e.g. 20 for 20% off, or 15 for $15 off
   - **Minimum booking value** — optional; code only valid if booking exceeds this amount
   - **Usage limit** — optional; total number of times this code can be used
   - **Expiry date** — optional; code stops working after this date
4. Click **Create Code**.

## Applying at checkout

Customers enter the promo code in the **Promo Code** field on the booking summary page. The discount is applied immediately and shown in the price breakdown.

## Tracking usage

The Promo Codes list shows the current usage count next to each code. Click a code to see which bookings it was applied to.

## FAQ

**Q: Can a customer use more than one code per booking?**

A: No — only one promo code can be applied per booking.

**Q: Does the promo code discount apply before or after the platform fee?**

A: The discount is applied to the base rental amount first, then the platform fee is calculated on the discounted total.

**Q: Can I disable a code without deleting it?**

A: Yes — toggle the code's Active status off.`,
    },
    {
      title: "Deposits & Security Holds",
      slug: "deposits-security-holds",
      excerpt: "Configure and manage security deposit pre-authorisations on customer cards.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["deposit", "hold", "security"],
      content: `## How deposits work

A **security deposit** is a card pre-authorisation (hold) placed at booking time. The funds are reserved on the customer's card but not actually charged — unless a damage claim is filed.

The hold is automatically released when:
- The booking is marked **Returned** with no active damage claim
- A configured number of days after the return date passes

## Setting a deposit

1. Open a listing and click **Edit Listing**.
2. Set the **Security Deposit** amount.
3. Save.

All future bookings for this listing will require the deposit at checkout.

## Deposit statuses

| Status | Meaning |
|--------|---------|
| **Held** | Pre-auth active on card |
| **Released** | Hold removed, no charge |
| **Charged** | Deposit converted to actual charge (after a claim) |
| **Failed** | Pre-auth could not be placed |

## Manual release

If you need to release a deposit before the automatic release:
1. Open the booking detail page.
2. Scroll to the **Deposit** section.
3. Click **Release Deposit**.

## FAQ

**Q: How long does a card hold last?**

A: Stripe holds authorisations for up to 7 days. For longer rentals, OutdoorShare automatically re-authorises the hold if needed.

**Q: What if the deposit hold fails?**

A: The admin receives an alert and the booking is flagged. You can retry the hold or proceed at your own risk.`,
    },
    {
      title: "Payouts & Wallet",
      slug: "payouts-wallet",
      excerpt: "View your payout balance and understand how Stripe Connect payouts work.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["payouts", "wallet", "stripe"],
      content: `## Overview

Your **Wallet** shows the running balance of earnings from completed bookings, minus platform fees and Stripe processing fees.

## Accessing Wallet

Go to **Wallet** in the sidebar. You'll see:
- **Available balance** — funds ready to be paid out to your bank
- **Pending balance** — funds being processed (usually 1–2 business days)
- **Recent transactions** — a list of booking payments, refunds, and fee deductions

## How payouts work

Stripe Connect automatically pays out your available balance to the bank account linked to your Stripe account on a rolling schedule:
- **Daily payouts** — most accounts once verified
- **Manual payouts** — you can trigger a manual payout from your Stripe dashboard

The platform fee is deducted before you receive the funds — you never need to make a separate payment to OutdoorShare.

## FAQ

**Q: How long do payouts take?**

A: Typically 1–2 business days after a payment is completed, depending on your bank.

**Q: Where do I set my bank account for payouts?**

A: In your Stripe account dashboard (not OutdoorShare). Go to Stripe → Settings → Bank accounts.

**Q: Is there a minimum payout amount?**

A: Stripe's minimum automatic payout threshold is $1 USD (or equivalent).`,
    },
  ],

  "operations": [
    {
      title: "Quotes & Estimates",
      slug: "quotes-estimates",
      excerpt: "Create and send professional rental quotes that customers can accept and convert to bookings.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["quotes", "estimates", "sales"],
      content: `## What is a quote?

A **quote** is a formal price proposal you send to a prospective renter. When the customer accepts the quote, it converts automatically into a confirmed booking.

## Creating a quote

1. Go to **Quotes** in the sidebar.
2. Click **+ New Quote**.
3. Fill in:
   - Customer email
   - Listing and dates
   - Optional discounts or custom pricing notes
4. Click **Send Quote**.

The customer receives a professional email with the quote details and an **Accept Quote** button.

## Quote statuses

| Status | Meaning |
|--------|---------|
| Draft | Not yet sent |
| Sent | Emailed to customer, awaiting response |
| Accepted | Customer accepted → booking created |
| Declined | Customer declined |
| Expired | Passed the expiry date without response |

## Quote expiry

Set an expiry date on each quote. If the customer doesn't accept by that date, the quote expires automatically and the dates are freed up.

## FAQ

**Q: Can I edit a quote after sending it?**

A: You can create a new revised quote. Editing a sent quote is not supported to preserve an audit trail.

**Q: Is the quote price binding?**

A: The accepted quote price is honoured when the booking is created.`,
    },
    {
      title: "Damage Claims",
      slug: "damage-claims",
      excerpt: "File and manage damage claims after a rental — upload evidence and charge the renter.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["claims", "damage", "dispute"],
      content: `## When to file a claim

File a damage claim when equipment is returned with damage beyond normal wear and tear, or if equipment goes missing.

## Filing a claim

1. Go to **Claims** in the sidebar, or open the booking detail page and click **File Claim**.
2. Select the booking.
3. Describe the damage — type, severity, estimated repair/replacement cost.
4. Upload supporting photos (return photos from the booking are automatically attached).
5. Set the claim amount.
6. Click **Submit Claim**.

## Claim statuses

| Status | Description |
|--------|-------------|
| Open | Just filed, under review |
| Evidence Requested | Awaiting more info from renter |
| Approved | Claim accepted; charge pending |
| Charged | Renter's card charged for the claim amount |
| Disputed | Renter is contesting the claim |
| Resolved | Fully closed |

## Charging the renter

When a claim is approved, click **Charge Renter** to convert the security deposit hold into an actual charge (if the deposit covers the amount), or initiate a separate charge.

## FAQ

**Q: What if the deposit doesn't cover the full damage cost?**

A: You can charge an additional amount beyond the deposit. The renter's card must be on file.

**Q: How long after a rental can I file a claim?**

A: We recommend filing within 48 hours of return while photos and evidence are fresh. There's no hard deadline in the system.

**Q: Can a renter dispute a claim?**

A: Yes — renters can contest claims through the platform. Both sets of photos are available for comparison.`,
    },
    {
      title: "Communications & Email Templates",
      slug: "communications-email-templates",
      excerpt: "Review and customise the automated email notifications sent at every booking event.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["emails", "communications", "notifications"],
      content: `## Automated emails

OutdoorShare sends automated emails to renters at every stage of the booking lifecycle:

| Event | Email sent |
|-------|-----------|
| Booking confirmed | Confirmation + booking summary |
| 12 hrs before pickup | Pickup reminder with pickup instructions |
| Pickup completed | Receipt + agreement link |
| 24 hrs before return | Return reminder |
| Return completed | Return confirmation + deposit release info |
| Claim filed | Notification to renter |

## Viewing templates

Go to **Communications** in the sidebar to see all email templates. Click any template to preview the full email.

## Gmail integration

OutdoorShare uses your connected Gmail account to send emails. This means emails arrive in the renter's inbox from your actual business email address — not a no-reply address.

To connect Gmail:
1. Go to **Settings → Communications**.
2. Click **Connect Gmail**.
3. Authorise OutdoorShare to send emails on your behalf.

## Manual messages

From any booking detail page, click **Send Message** to compose a custom email to the renter. The message is sent from your connected Gmail and logged in the booking timeline.

## FAQ

**Q: Can I customise the email content?**

A: Basic customisation (business name, logo, colour) is applied from your Settings. Full template editing is available in the Communications section.

**Q: What email address do emails come from?**

A: Emails come from your connected Gmail address, so renters see your business email in the From field.`,
    },
    {
      title: "Kiosk Mode",
      slug: "kiosk-mode",
      excerpt: "Set up a self-service booking kiosk for walk-in customers at your location.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["kiosk", "walk-in", "self-service"],
      content: `## What is Kiosk Mode?

**Kiosk Mode** turns any tablet or touchscreen into a self-service booking station. Walk-in customers can browse your listings, pick dates, and complete checkout without needing staff assistance.

## Setting up Kiosk Mode

1. Go to **Kiosk** in the sidebar.
2. Select which listings to show in the kiosk.
3. Click **Launch Kiosk** to open the full-screen kiosk interface.
4. Lock your tablet to this URL using your device's Guided Access / Kiosk mode feature.

## Kiosk flow for customers

1. Customer browses listings on the screen.
2. Selects an item, picks dates, and taps **Book Now**.
3. Enters email and payment details.
4. Receives a confirmation email immediately.

## Staff monitoring

Kiosk bookings appear in the admin **Bookings** list in real time, just like online bookings.

## FAQ

**Q: Does Kiosk Mode need a separate subscription?**

A: No — it's included on all plans.

**Q: Can customers use cash via the kiosk?**

A: Not directly. Kiosk Mode processes card payments through Stripe. For cash, create a manual booking in the admin.

**Q: What device should I use?**

A: Any iPad, Android tablet, or touchscreen monitor with a modern browser. A 10-inch or larger screen is recommended.`,
    },
    {
      title: "Waivers",
      slug: "waivers",
      excerpt: "Collect digital waiver signatures from renters before equipment pickup.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["waivers", "legal", "signature"],
      content: `## Overview

**Waivers** are digital documents the renter must sign before using your equipment. They can cover liability releases, safety acknowledgements, or terms of use.

## Creating a waiver

1. Go to **Waivers** in the sidebar.
2. Click **+ New Waiver**.
3. Enter a title and paste your waiver text.
4. Toggle **Active** to make it visible to renters.

## Sending a waiver

Waivers can be sent manually from a booking's detail page, or configured to send automatically when a booking is confirmed.

The renter receives an email with a link to review and sign the waiver electronically.

## Waiver records

Once signed, the waiver record is saved to the booking and is accessible from the booking detail page under the **Documents** section.

## FAQ

**Q: Are electronic waivers legally enforceable?**

A: In most jurisdictions, yes — provided the text is clear and the signer is identifiable. Consult your legal advisor.

**Q: Can I have multiple waivers?**

A: Yes — you can create multiple waivers for different equipment types or activities and assign them to specific listings.`,
    },
  ],

  "customer-management": [
    {
      title: "Managing Renters",
      slug: "managing-renters",
      excerpt: "View your customer database, booking history, and renter details.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["customers", "renters", "database"],
      content: `## Renter list

Go to **Contacts** in the sidebar to see all customers who have made a booking or inquiry. Each row shows:
- Name and email
- Total bookings
- Total spend
- Last booking date

## Renter profile

Click any renter to see their full profile:
- Contact information
- All their bookings (with status)
- Identity verification status
- Notes

## Adding a note

Open a renter's profile and type in the **Notes** field. Notes are only visible to admins.

## Filtering and searching

Use the search bar at the top of the Contacts list to find a customer by name or email. Filter by booking status to see, e.g., all renters with active rentals.

## FAQ

**Q: Can I export the renter list?**

A: CSV export is on the roadmap. For now, use the booking analytics export.

**Q: Are customer accounts shared across tenants?**

A: No — each tenant's customer list is private and isolated.`,
    },
    {
      title: "Contact Cards",
      slug: "contact-cards",
      excerpt: "Create digital contact cards that appear on booking confirmations and renter emails.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["contact", "cards", "branding"],
      content: `## What are Contact Cards?

**Contact Cards** are digital business cards displayed to renters on their booking confirmation pages and in emails. They include your staff contact information so renters know exactly who to reach out to.

## Creating a contact card

1. Go to **Contact Cards** in the sidebar.
2. Click **+ New Card**.
3. Fill in: Name, Role/Title, Phone, Email, Photo (optional).
4. Click **Save**.

## Where they appear

Contact cards are shown:
- On the customer's booking detail page
- In booking confirmation emails
- On the storefront "Contact Us" section

## Multiple contacts

Create as many cards as you need (e.g. one per staff member, or one per location). All active cards are shown to renters.

## FAQ

**Q: Can I have different cards for different listings or locations?**

A: Not yet — all active contact cards are shown to all renters. Per-listing contact cards are on the roadmap.`,
    },
    {
      title: "Messaging Renters",
      slug: "messaging-renters",
      excerpt: "Send and receive messages with renters directly from the admin dashboard.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["messages", "communication", "chat"],
      content: `## Overview

The **Messages** module lets you have direct conversations with renters. Messages are sent from your connected Gmail address and responses appear in the dashboard inbox.

## Sending a message

**From the booking detail:**
1. Open any booking.
2. Click **Send Message**.
3. Type your message and click **Send**.

**From the Messages inbox:**
1. Go to **Messages** in the sidebar.
2. Click **Compose**.
3. Search for a customer by name or email, write your message, and send.

## Inbox

The Messages inbox shows all your conversations sorted by most recent. Unread message count appears as a badge on the sidebar icon.

## FAQ

**Q: Can renters initiate a message to me?**

A: Yes — from their booking detail page, renters have a **Message Host** button.

**Q: Are messages kept with the booking record?**

A: Yes — all messages related to a booking are visible in the booking's timeline.`,
    },
  ],

  "ai-tools": [
    {
      title: "OutdoorBot AI",
      slug: "outdoorbot-ai",
      excerpt: "Your AI assistant for answering customer questions and helping with admin tasks.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["AI", "chatbot", "OutdoorBot"],
      content: `## What is OutdoorBot?

**OutdoorBot** is the AI assistant built into OutdoorShare. It has two modes:

| Mode | Who uses it | What it does |
|------|-------------|-------------|
| **Storefront Chat** | Customers on your public storefront | Answers questions about your listings, availability, pricing, and rental policies |
| **Admin Chat** | You and your staff in the dashboard | Helps with booking lookups, drafts customer messages, answers platform questions |

## Storefront chat widget

The OutdoorBot chat widget appears in the bottom corner of your storefront. Customers can:
- Ask about specific listings
- Check availability
- Get answers to FAQ
- Be guided through the booking process

The bot is pre-trained on your listing data and business profile.

## Admin AI assistant

In the admin dashboard, click the **OutdoorBot** icon in the sidebar or bottom bar. You can ask questions like:
- "What bookings are due for pickup today?"
- "Draft an email to a renter about a delay"
- "What's my revenue this month?"

## Customising bot responses

You can add custom FAQs and instructions in **Settings → AI Assistant**. These are injected into the bot's context for storefront conversations.

## FAQ

**Q: Does OutdoorBot replace my customer support?**

A: It handles common questions automatically but escalates to you for complex issues. You're always in control.

**Q: Is OutdoorBot available 24/7?**

A: Yes — the storefront chat widget is always live regardless of your business hours.

**Q: What AI model powers OutdoorBot?**

A: OutdoorBot is powered by a combination of large language models. Specific model details are subject to change as we improve the system.`,
    },
    {
      title: "Analytics & Reporting",
      slug: "analytics-reporting",
      excerpt: "Revenue dashboards, booking volumes, and occupancy reports to inform your business decisions.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["analytics", "reports", "revenue"],
      content: `## Overview

The **Analytics** module gives you a real-time view of your rental business performance.

## Key metrics

| Metric | Description |
|--------|-------------|
| **Gross Revenue** | Total booking payments collected in the period |
| **Net Revenue** | Revenue minus platform fees and refunds |
| **Booking Count** | Total bookings in the period |
| **Occupancy Rate** | % of available days that were booked |
| **Average Booking Value** | Gross revenue ÷ booking count |
| **Top Listings** | Your highest-earning items |

## Date ranges

Use the date range picker to view stats for:
- Last 7 days
- Last 30 days
- Last 12 months
- Custom range

## Booking trends chart

The main chart shows booking counts and revenue by day/week/month on an overlaid bar and line chart.

## Top renters

See your highest-value customers by total spend in the selected period.

## FAQ

**Q: Is analytics data real-time?**

A: Yes — the dashboard refreshes with current data each time you load it.

**Q: Can I export the data?**

A: CSV export is on the roadmap.

**Q: Does the platform fee appear in my revenue figures?**

A: Net revenue shows revenue after the platform fee is deducted.`,
    },
  ],

  "account-team": [
    {
      title: "Business Profile & Branding",
      slug: "business-profile-branding",
      excerpt: "Set up your company name, logo, colours, and storefront appearance.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["branding", "settings", "profile"],
      content: `## Overview

Your **Business Profile** controls how your brand appears to renters across the storefront, emails, and the embed widget.

## What you can configure

| Setting | Description |
|---------|-------------|
| **Business name** | Appears in the header and all emails |
| **Logo** | Uploaded image used in the storefront header, emails, and embed widget |
| **Primary colour** | Used for buttons, badges, and interactive elements |
| **Support email** | Where renters can reply to notifications |
| **Phone number** | Shown on contact cards and storefront |
| **Address** | Shown on storefront About section |
| **About / Description** | Short blurb about your company |
| **Social links** | Instagram, Facebook, etc. links in the storefront footer |

## Updating settings

Go to **Settings** → **Business Profile** and edit any field. Changes are applied immediately — no restart needed.

## Storefront URL

Your public storefront is at: \`https://[platform-domain]/[your-slug]\`

You can share this URL directly with customers or set it as a custom domain.

## FAQ

**Q: Can I change my storefront slug?**

A: Yes — update the Business Slug field in Settings. Note that this changes your storefront URL, so update any links you've shared.

**Q: What image formats are accepted for the logo?**

A: PNG or SVG for best results. JPEG also works. Maximum 2 MB.`,
    },
    {
      title: "Team Roles & Permissions",
      slug: "team-roles-permissions",
      excerpt: "Understand the difference between Owner and Staff roles and what each can access.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["team", "roles", "permissions"],
      content: `## Available roles

OutdoorShare has two admin roles:

### Owner / Admin
Full access to all features:
- All booking management actions
- Listing creation and editing
- Settings, billing, and Stripe configuration
- Team management (invite/remove members)
- Promo codes, claims, analytics

### Staff
Operational access:
- View and manage bookings
- View listings
- Send messages and documentation links
- View analytics

Staff **cannot** access:
- Settings
- Billing and Stripe
- Team management
- Business profile changes

## Changing a member's role

1. Go to **Team** in the sidebar.
2. Click the member you want to edit.
3. Change their role from the dropdown.
4. Save.

## FAQ

**Q: Can a staff member see other staff members' accounts?**

A: Staff can see the team list but cannot manage it.

**Q: Can I create custom roles?**

A: Not yet — custom RBAC (role-based access control) is on the roadmap.`,
    },
    {
      title: "Subscription & Billing",
      slug: "subscription-billing",
      excerpt: "Manage your OutdoorShare platform subscription and view your billing history.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["billing", "subscription", "plan"],
      content: `## Overview

Your OutdoorShare subscription is managed through the **Billing** section of the admin dashboard.

## What's on the billing page

- **Current plan** — your subscription tier
- **Billing cycle** — monthly or annual
- **Next invoice date** — when you'll next be charged
- **Payment method** — the card on file for subscription charges
- **Invoice history** — downloadable past invoices

## Changing your plan

Click **Upgrade Plan** or **Change Plan** on the Billing page to see available tiers and their features. Changes take effect immediately and are prorated.

## FAQ

**Q: Is there a free trial?**

A: Yes — new accounts start with a trial period. No credit card required until trial ends.

**Q: What happens if my subscription lapses?**

A: Your storefront goes offline (customers can't book), but your data is preserved. Reactivate at any time.

**Q: Who do I contact for billing issues?**

A: Email support@myoutdoorshare.com or use the Help chat in your dashboard.`,
    },
    {
      title: "Marketplace Listing",
      slug: "marketplace-listing",
      excerpt: "Get your listings discovered on the OutdoorShare cross-tenant marketplace.",
      type: "guide",
      author: "OutdoorShare Team",
      tags: ["marketplace", "discovery", "SEO"],
      content: `## What is the Marketplace?

The **OutdoorShare Marketplace** is a cross-tenant discovery platform where renters can search for outdoor equipment across all OutdoorShare businesses in one place.

## Opting in

By default, your listings are private to your storefront. To appear on the marketplace:
1. Go to **Settings → Marketplace**.
2. Toggle **List on Marketplace** to On.
3. Select which listings to show (or include all).

## Marketplace listing content

The marketplace pulls listing data (photos, title, price, location, category) from your admin listings automatically. Keep listings up to date for best results.

## FAQ

**Q: Is there an extra fee to list on the marketplace?**

A: No — marketplace visibility is included on all plans.

**Q: Can I control which listings appear?**

A: Yes — you can opt individual listings in or out via the listing's Settings tab.

**Q: How do renters book from the marketplace?**

A: Renters click through from the marketplace to your storefront to complete the booking. You receive all customer data and payment directly.`,
    },
  ],

  "faq": [
    {
      title: "Booking FAQs",
      slug: "booking-faqs",
      excerpt: "Answers to the most common questions about managing bookings on OutdoorShare.",
      type: "faq",
      author: "OutdoorShare Team",
      tags: ["FAQ", "bookings"],
      content: `## General Booking Questions

**Q: Can I accept bookings without connecting Stripe?**

A: Yes — you can create bookings manually in the admin and mark them as paid offline. For online card payments, Stripe Connect is required.

---

**Q: How do I cancel a booking?**

A: Open the booking detail page, scroll to the bottom, and click **Cancel Booking**. A cancellation email is sent to the renter automatically. You must manually process any refund through Stripe.

---

**Q: Can customers modify their booking dates?**

A: Not self-service yet. Contact the admin to change dates. The admin can edit booking dates from the booking detail page.

---

**Q: What happens if two customers try to book the same item at the same time?**

A: OutdoorShare checks availability at payment time. The first successful payment wins; the second customer sees an "unavailable" message.

---

**Q: How do I handle a no-show?**

A: Mark the booking as Cancelled and apply any applicable cancellation fee. If you have a deposit, you can retain it per your cancellation policy.

---

**Q: Can I offer a refund on a completed booking?**

A: Refunds are processed through your Stripe dashboard. OutdoorShare doesn't initiate refunds automatically — you control the refund policy.

---

**Q: Why does the booking status still show "Pending"?**

A: Pending means the customer has requested but payment hasn't been confirmed, or you haven't confirmed it yet. Go to the booking detail and click **Confirm Booking**.`,
    },
    {
      title: "Payment & Refund FAQs",
      slug: "payment-refund-faqs",
      excerpt: "Common questions about payments, fees, deposits, and refunds.",
      type: "faq",
      author: "OutdoorShare Team",
      tags: ["FAQ", "payments", "refunds"],
      content: `## Payment Questions

**Q: Which payment methods can customers use?**

A: Any credit or debit card supported by Stripe (Visa, Mastercard, Amex, Discover). Apple Pay and Google Pay are also supported where available.

---

**Q: When do I receive my payout?**

A: Stripe pays out to your linked bank account typically 1–2 business days after a payment is made, depending on your account's payout schedule.

---

**Q: Why was a payment declined?**

A: Common reasons: insufficient funds, card expired, bank blocking the transaction, or AVS mismatch. The customer should contact their bank or try a different card.

---

**Q: Can I charge a customer in a different currency?**

A: Your storefront uses the currency configured in your Settings. Multi-currency checkout is handled by Stripe.

---

**Q: How are platform fees deducted?**

A: Platform fees are deducted automatically before your payout — you never need to send a separate payment.

---

## Refund Questions

**Q: How do I issue a full refund?**

A: In your Stripe Dashboard, go to the payment and click Refund. OutdoorShare will reflect the booking status change once Stripe processes it.

---

**Q: How long does a refund take?**

A: 5–10 business days to appear on the customer's statement, depending on their bank.

---

**Q: Can I issue a partial refund?**

A: Yes — in Stripe, enter the partial refund amount manually.

---

**Q: What happens to the platform fee if I refund?**

A: OutdoorShare refunds its portion of the platform fee proportionally on full refunds. For partial refunds, contact support.`,
    },
    {
      title: "Technical & Account FAQs",
      slug: "technical-account-faqs",
      excerpt: "Technical questions about setup, integrations, access, and account management.",
      type: "faq",
      author: "OutdoorShare Team",
      tags: ["FAQ", "technical", "account"],
      content: `## Technical Questions

**Q: What browsers are supported?**

A: OutdoorShare works on all modern browsers — Chrome, Firefox, Safari, Edge (latest versions). Internet Explorer is not supported.

---

**Q: Is OutdoorShare mobile-friendly?**

A: Yes — both the storefront and admin dashboard are fully responsive and work on phones and tablets.

---

**Q: Can I use OutdoorShare on multiple devices at the same time?**

A: Yes — there's no device limit. Multiple staff members can be logged in simultaneously.

---

**Q: How do I reset my password?**

A: On the admin login page, click **Forgot Password** and enter your email. You'll receive a reset link within a few minutes.

---

**Q: Can I export my data?**

A: Data export features are on the roadmap. Contact support if you urgently need a data export.

---

**Q: Is my data backed up?**

A: Yes — all data is backed up daily. We maintain 30 days of rolling backups.

---

## Account Questions

**Q: Can I have multiple storefronts under one account?**

A: The current architecture supports one storefront per account (tenant). Multiple storefronts require separate accounts.

---

**Q: How do I close my account?**

A: Email support@myoutdoorshare.com with your account details. We'll archive your data per our data retention policy.

---

**Q: What is the uptime SLA?**

A: OutdoorShare targets 99.9% uptime. Check status.myoutdoorshare.com for live status information.`,
    },
    {
      title: "Storefront & Customer FAQs",
      slug: "storefront-customer-faqs",
      excerpt: "FAQs about the customer-facing storefront experience.",
      type: "faq",
      author: "OutdoorShare Team",
      tags: ["FAQ", "storefront", "customers"],
      content: `## Storefront Questions

**Q: How do customers find my storefront?**

A: Share your storefront URL directly, list on the OutdoorShare Marketplace, or embed listing widgets on your existing website.

---

**Q: Can customers create accounts on my storefront?**

A: Yes — customers sign up with an email and password. Their account stores their booking history, payment methods, and profile.

---

**Q: What does the customer see after booking?**

A: They receive a confirmation email and can view their booking status and documents on the My Bookings page of your storefront.

---

**Q: Can customers leave reviews?**

A: Customer feedback can be collected through the Feedback module. Public reviews on the storefront are on the roadmap.

---

**Q: Is the storefront accessible (ADA/WCAG)?**

A: We follow best-effort WCAG 2.1 AA guidelines. Full accessibility audits are in progress.

---

**Q: Can I add custom pages to my storefront?**

A: Not yet — custom static pages (About, Contact, FAQ) are on the roadmap.

---

**Q: How does the storefront handle time zones?**

A: Booking dates are stored in UTC. The storefront displays times in the browser's local time zone.`,
    },
  ],
};

// ─── Seed ────────────────────────────────────────────────────────────────────

async function wipe() {
  console.log("Wiping existing docs...");
  const articles = await api("GET", "/docs/articles?limit=200");
  for (const a of articles) {
    await api("DELETE", `/docs/articles/${a.id}`);
  }
  const cats = await api("GET", "/docs/categories");
  for (const c of cats) {
    await api("DELETE", `/docs/categories/${c.id}`);
  }
  console.log(`  Deleted ${articles.length} articles, ${cats.length} categories.`);
}

async function seed() {
  await wipe();

  const catMap = {};

  for (const cat of CATEGORIES) {
    console.log(`Creating category: ${cat.name}`);
    const created = await api("POST", "/docs/categories", cat);
    catMap[cat.slug] = created.id;
  }

  let total = 0;
  for (const [catSlug, articles] of Object.entries(ARTICLES)) {
    const catId = catMap[catSlug];
    if (!catId) { console.warn(`No category found for slug: ${catSlug}`); continue; }
    for (const art of articles) {
      console.log(`  Article: ${art.title}`);
      await api("POST", "/docs/articles", {
        ...art,
        categoryId: catId,
        published: true,
      });
      total++;
    }
  }

  console.log(`\nDone! Created ${CATEGORIES.length} categories and ${total} articles.`);
}

seed().catch(err => { console.error(err); process.exit(1); });
