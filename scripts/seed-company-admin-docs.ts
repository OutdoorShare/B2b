/**
 * Seed script: Company-Admin Docs
 * Clears all existing doc content and rebuilds it around the admin sidebar.
 * Run: pnpm --filter @workspace/db exec tsx ../../scripts/seed-company-admin-docs.ts
 */
import { db } from "../lib/db/src/index";
import {
  docArticleRelationsTable,
  docArticlesTable,
  docFeaturesTable,
  docProjectsTable,
  docCategoriesTable,
} from "../lib/db/src/schema/index";
import { sql } from "drizzle-orm";

// ─── Clear existing content ───────────────────────────────────────────────────
async function clear() {
  await db.delete(docArticleRelationsTable);
  await db.delete(docArticlesTable);
  await db.delete(docFeaturesTable);
  await db.delete(docProjectsTable);
  await db.delete(docCategoriesTable);
  console.log("✓ Cleared all existing docs content");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
type Status = "stable" | "beta" | "experimental" | "deprecated";

interface CategoryDef {
  name: string; slug: string; description: string; icon: string; color: string; sortOrder: number;
}
interface FeatureDef {
  name: string; slug: string; description: string; status: Status;
}
interface ArticleDef {
  title: string; slug: string; excerpt: string; content: string; type: string; tags: string[];
}

// ─── Content definitions ───────────────────────────────────────────────────────

const CATEGORIES: CategoryDef[] = [
  { name: "Getting Started",  slug: "getting-started", description: "Set up your account and learn the basics.", icon: "🚀", color: "#3ab549", sortOrder: 1 },
  { name: "Operations",       slug: "operations",      description: "Manage your listings, inventory, bookings, quotes, and claims.", icon: "⚙️", color: "#29b4d4", sortOrder: 2 },
  { name: "Customers",        slug: "customers",       description: "Communicate with renters and collect signed waivers.", icon: "👥", color: "#8b5cf6", sortOrder: 3 },
  { name: "Tools",            slug: "tools",           description: "Analytics, promo codes, and in-person kiosk tools.", icon: "🛠️", color: "#f59e0b", sortOrder: 4 },
  { name: "Account",          slug: "account",         description: "Team, billing, wallet, settings, and feedback.", icon: "👤", color: "#ef4444", sortOrder: 5 },
];

// categorySlug → features
const FEATURES: Record<string, FeatureDef[]> = {
  "getting-started": [
    { name: "Dashboard",  slug: "dashboard",  description: "Your command centre — live stats, upcoming bookings, and recent activity.", status: "stable" },
    { name: "Launchpad",  slug: "launchpad",  description: "Guided onboarding checklist that gets your storefront live step-by-step.", status: "stable" },
  ],
  "operations": [
    { name: "Listings",   slug: "listings",   description: "Create and manage every item you rent out.", status: "stable" },
    { name: "Inventory",  slug: "inventory",  description: "Track individual units and real-time stock availability.", status: "stable" },
    { name: "Bookings",   slug: "bookings",   description: "View, confirm, and manage every reservation end-to-end.", status: "stable" },
    { name: "Quotes",     slug: "quotes",     description: "Generate custom pricing quotes that convert into bookings.", status: "stable" },
    { name: "Claims",     slug: "claims",     description: "Handle damage reports, upload evidence, and resolve disputes.", status: "stable" },
  ],
  "customers": [
    { name: "Communications", slug: "communications", description: "Automated email notifications for every booking lifecycle event.", status: "stable" },
    { name: "Contact Cards",  slug: "contact-cards",  description: "Digital contact cards delivered to renters at every touchpoint.", status: "stable" },
    { name: "Waivers",        slug: "waivers",        description: "Collect legally-binding digital signatures before pickup.", status: "stable" },
  ],
  "tools": [
    { name: "Analytics",   slug: "analytics",    description: "Revenue charts, booking trends, and occupancy reporting.", status: "stable" },
    { name: "Promo Codes", slug: "promo-codes",  description: "Create percentage or fixed discount codes with usage limits.", status: "stable" },
    { name: "Kiosk Mode",  slug: "kiosk-mode",   description: "Self-service booking terminal for walk-in customers.", status: "stable" },
  ],
  "account": [
    { name: "Team",     slug: "team",     description: "Invite staff, assign roles, and manage access.", status: "stable" },
    { name: "Wallet",   slug: "wallet",   description: "View your payout balance and Stripe Connect status.", status: "stable" },
    { name: "Billing",  slug: "billing",  description: "Manage your OutdoorShare subscription and invoices.", status: "stable" },
    { name: "Settings", slug: "settings", description: "Customize your storefront branding, contact info, and policies.", status: "stable" },
    { name: "Feedback", slug: "feedback", description: "Send feature requests and bug reports directly to the OutdoorShare team.", status: "stable" },
  ],
};

// featureSlug → article
const ARTICLES: Record<string, ArticleDef> = {
  // ── Getting Started ──────────────────────────────────────────────────────────
  "dashboard": {
    title: "Dashboard Overview",
    slug: "dashboard-overview",
    excerpt: "Understand every metric, widget, and shortcut on your admin dashboard.",
    type: "guide",
    tags: ["dashboard", "getting-started"],
    content: `## What is the Dashboard?

The Dashboard is the first page you see when you log into your admin account. It gives you a live snapshot of your business so you can stay on top of activity without digging through individual pages.

## Key widgets

### Active Bookings
Shows every booking that is currently in progress (items are out on rent). Click any row to open the booking detail page.

### Upcoming Bookings
Bookings that are confirmed and starting within the next 7 days. Use this to plan pickups and prepare inventory.

### Recent Activity
A chronological feed of the most recent actions — new bookings, cancellations, new quotes, claims opened.

### Revenue Summary
Your gross rental revenue for the current month and a comparison to the previous month. All figures pull from confirmed and completed bookings only.

### Quick Actions
- **New Booking** — jump directly to the booking creation form.
- **View Storefront** — open your public storefront in a new tab to see what renters see.

## Tips
- Bookmark your dashboard URL (e.g. \`yoursite.com/yourbrand/admin\`) for fast access.
- The dashboard auto-refreshes every 60 seconds — no need to manually reload.
- If a widget shows "—" it means there is no data yet for that period; add your first listing to get started.`,
  },

  "launchpad": {
    title: "Getting Set Up with Launchpad",
    slug: "getting-set-up-launchpad",
    excerpt: "Walk through the Launchpad checklist to get your rental storefront live in minutes.",
    type: "guide",
    tags: ["launchpad", "setup", "onboarding"],
    content: `## What is Launchpad?

Launchpad is a guided checklist inside your admin dashboard that walks you through every step needed to go live. It tracks your progress automatically as you complete each step.

## Checklist items

### 1. Add your business details
Go to **Settings → General** and fill in your company name, contact email, phone number, and business address. This information appears on booking confirmations and customer receipts.

### 2. Upload your logo
In **Settings → Branding**, upload a PNG or JPEG logo (recommended 400 × 400 px). Your logo appears in the storefront header, emails, and contact cards.

### 3. Add your first listing
Go to **Listings → New Listing** and create at least one rental item with a title, description, pricing, and photos. Without a listing, renters cannot place bookings.

### 4. Connect Stripe
In **Settings → Payments**, click "Connect with Stripe" to link your Stripe account. This is required to accept online payments. OutdoorShare uses Stripe Connect so funds go directly to your bank account.

### 5. Set your booking policy
In **Settings → Policies**, define your cancellation window and any deposit requirements. Renters see this before confirming.

### 6. Preview your storefront
Click **View Storefront** in the header to open your public page and confirm everything looks correct before sharing the link.

## What happens when I finish?
Once all checklist items are marked complete, Launchpad collapses and your admin home switches to the full Dashboard view. You can return to Launchpad any time from the sidebar to review completed steps.`,
  },

  // ── Operations ───────────────────────────────────────────────────────────────
  "listings": {
    title: "Managing Listings",
    slug: "managing-listings",
    excerpt: "Create, edit, and organize every item you rent out.",
    type: "guide",
    tags: ["listings", "operations", "rental-items"],
    content: `## What is a Listing?

A listing is a rentable item — a jet ski, an ATV, a camper, a utility trailer. Each listing has its own public page on your storefront, its own pricing, and its own inventory pool.

## Creating a listing

1. Go to **Listings** in the sidebar.
2. Click **New Listing** in the top-right corner.
3. Fill in the required fields:
   - **Title** — the name shown to renters (e.g. "2026 SeaDoo Jet Ski").
   - **Category** — group similar items together (e.g. "Watercraft", "Camping").
   - **Daily Rate** — the base price per day.
   - **Description** — markdown-supported text that appears on the listing page.
   - **Photos** — upload at least one photo. The first image becomes the thumbnail.
4. Click **Save Listing**.

## Pricing options

| Option | Description |
|--------|-------------|
| Daily rate | Charged per calendar day |
| Hourly rate | Optional; overrides daily rate for short rentals |
| Multi-day discount | Percentage off for rentals longer than N days |
| Security deposit | Held at booking; released on return |

## Editing a listing
Click any listing row to open its detail page, then click **Edit** in the top-right. Changes take effect immediately on the storefront.

## Deactivating vs. deleting
- **Deactivate** hides the listing from the storefront but keeps all historical booking data.
- **Delete** is permanent and cannot be undone. Only delete listings that have never had a booking.

## Listing rules
Each listing can have custom availability rules. See the [Inventory](/articles/inventory-management) guide to learn how units and stock tie in.`,
  },

  "inventory": {
    title: "Inventory Management",
    slug: "inventory-management",
    excerpt: "Track individual units and stock so you never double-book.",
    type: "guide",
    tags: ["inventory", "operations", "stock"],
    content: `## What is Inventory?

Inventory tracks the physical quantity of each listing. When a booking is confirmed, the system deducts one unit from available stock. When the rental is returned, the unit is released back.

## Viewing your inventory
Go to **Inventory** in the sidebar. You will see every listing with:
- **Total units** — how many you own.
- **Available** — how many can be booked right now.
- **On rent** — currently checked out.
- **Under maintenance** — flagged as unavailable.

## Adding units to a listing
1. Open the listing from **Listings**.
2. Scroll to the **Inventory** section.
3. Click **Add Unit** and give it a serial number or label (optional).

## Maintenance flags
Mark a unit as "Under Maintenance" to remove it from bookings without deleting it. This is useful after a damage claim while a repair is in progress.

## Blocking dates
You can block specific date ranges for individual units (e.g. reserved for a private event). Go to the listing, open the unit, and click **Block Dates**.

## Stock alerts
The dashboard will surface a warning if any listing's available stock drops to zero. Always keep your unit counts accurate to avoid double-booking.`,
  },

  "bookings": {
    title: "Managing Bookings",
    slug: "managing-bookings",
    excerpt: "View, confirm, update, and complete every rental reservation.",
    type: "guide",
    tags: ["bookings", "operations", "reservations"],
    content: `## Booking lifecycle

Every booking moves through these statuses:

\`\`\`
Pending → Confirmed → Active → Completed
                   ↘ Cancelled
\`\`\`

| Status | Meaning |
|--------|---------|
| **Pending** | Booking submitted; payment authorized but not captured. |
| **Confirmed** | You have approved the booking; payment captured. |
| **Active** | Items have been picked up; rental is in progress. |
| **Completed** | Items returned and rental closed out. |
| **Cancelled** | Booking was cancelled (by you or the renter). |

## Viewing all bookings
Go to **Bookings** in the sidebar. Use the filter bar to view by status, date range, or listing.

## Confirming a booking
When a new booking comes in with status **Pending**:
1. Open the booking.
2. Review the details (dates, items, renter info).
3. Click **Confirm Booking** to capture payment and notify the renter.

## Marking as Active (pickup)
When the renter arrives to pick up:
1. Open the booking.
2. Click **Mark as Active**.
3. Optionally send the **Pickup Photo Link** to document the item's condition.

## Completing a booking (return)
When items are returned:
1. Open the booking.
2. Click **Mark as Completed**.
3. If there is damage, open a claim before completing. See the [Claims](/articles/handling-claims) guide.

## Cancelling a booking
1. Open the booking.
2. Click **Cancel**.
3. Choose whether to issue a full or partial refund. Stripe processes the refund automatically.

## Creating a booking manually
Click **New Booking** in the header (or from the Dashboard). Manual bookings are useful for walk-ins or phone reservations. You can choose to skip online payment collection for manual bookings.`,
  },

  "quotes": {
    title: "Creating and Sending Quotes",
    slug: "creating-quotes",
    excerpt: "Generate custom pricing quotes for renters and convert them into confirmed bookings.",
    type: "guide",
    tags: ["quotes", "operations", "pricing"],
    content: `## What is a Quote?

A quote is a custom price offer you send to a prospective renter before they book. The renter receives an email with a link to accept the quote, which converts it into a confirmed booking.

Quotes are ideal for:
- Corporate or group rentals where pricing needs negotiation.
- Custom packages that combine multiple listings.
- Renters who contacted you directly (email, phone, Instagram) rather than booking online.

## Creating a quote
1. Go to **Quotes → New Quote**.
2. Select the **renter** (or create a new one).
3. Add one or more **listings** and specify quantities.
4. Set the **rental period** (start and end dates).
5. Adjust pricing if needed — you can override the default rate for this quote only.
6. Add any **notes** for the renter (visible on the quote document).
7. Click **Send Quote**.

The renter receives an email with a branded quote document and an **Accept Quote** button.

## Quote statuses

| Status | Meaning |
|--------|---------|
| Draft | Not yet sent to the renter. |
| Sent | Email delivered; awaiting renter response. |
| Accepted | Renter accepted; booking created automatically. |
| Declined | Renter declined; no booking created. |
| Expired | Quote validity period passed without a response. |

## Setting quote expiry
By default, quotes expire after 48 hours. You can change this per-quote when creating it (e.g. set it to 7 days for a large corporate inquiry).

## Converting a quote manually
If a renter says they accept verbally, you can convert the quote yourself: open the quote and click **Convert to Booking**.`,
  },

  "claims": {
    title: "Handling Damage Claims",
    slug: "handling-claims",
    excerpt: "Open, document, and resolve damage claims after a rental.",
    type: "guide",
    tags: ["claims", "operations", "damage"],
    content: `## What is a Claim?

A claim is a formal record of damage or loss reported after a rental. Opening a claim lets you document the issue, upload evidence, and — if applicable — charge the renter for the cost of repair or replacement.

## Opening a claim
1. Open the relevant booking.
2. Scroll to the **Claims** section and click **Open Claim**.
3. Select the claim type:
   - **Damage** — physical damage to the rented item.
   - **Loss** — item was not returned.
   - **Cleaning** — excessive cleaning required.
   - **Other** — any other chargeable event.
4. Describe the issue in the notes field.
5. Upload photos as evidence.
6. Set the **claimed amount** (the cost you are seeking).
7. Click **Submit Claim**.

## Evidence and photos
Always upload before-and-after photos where possible. The pickup photo link (sent when the booking goes Active) creates a timestamped record of the item's condition at pickup — this is your strongest evidence.

## Charging the renter
Once the claim is reviewed by the OutdoorShare team:
1. The team will approve or deny the charge.
2. If approved, Stripe charges the renter's card on file.
3. The renter receives an automated email explaining the charge.

## Claim statuses

| Status | Meaning |
|--------|---------|
| Open | Claim submitted; under review. |
| Pending Charge | Approved; charge being processed. |
| Resolved | Charge collected or claim closed. |
| Denied | Claim was reviewed and not approved. |

## Tips
- File claims within 48 hours of the return to maintain a clear evidence chain.
- Use the Protection Plan feature to reduce disputes — renters who purchased a plan have pre-agreed to certain coverage terms.`,
  },

  // ── Customers ────────────────────────────────────────────────────────────────
  "communications": {
    title: "Email Communications",
    slug: "email-communications",
    excerpt: "Understand the automated emails sent to renters at every stage of their booking.",
    type: "guide",
    tags: ["communications", "email", "notifications"],
    content: `## Overview

OutdoorShare sends automated emails to renters at every key moment in the booking lifecycle. These emails are sent from your company's name so they feel personal and on-brand.

## Email triggers

| Trigger | Recipient | Content |
|---------|-----------|---------|
| Booking confirmed | Renter | Booking summary, dates, pickup instructions |
| Booking cancelled | Renter | Cancellation notice, refund status |
| Quote sent | Renter | Quote document with Accept button |
| Pickup photo link | Renter | Link to photograph the item at pickup |
| Return reminder | Renter | Reminder 24 hours before the return date |
| Damage charge | Renter | Charge notice with description and amount |
| Review request | Renter | Post-rental feedback request |

## Customizing your sender name
Go to **Settings → Communications** to update:
- **From name** — defaults to your company name (e.g. "Blue River Rentals").
- **Reply-to email** — where renter replies are forwarded.

## Viewing sent emails
Go to **Communications** in the sidebar to see a log of every email sent for each booking, including the delivery status.

## Manual messages
You can send a custom email to a renter directly from the booking page. Click **Send Message** and type your message. This goes via the same branded email pipeline.

## Troubleshooting delivery
If a renter says they did not receive an email:
1. Check the Communications log to confirm it was sent.
2. Ask the renter to check their spam/junk folder.
3. Verify the email address on the booking is correct.`,
  },

  "contact-cards": {
    title: "Contact Cards",
    slug: "contact-cards",
    excerpt: "Digital contact cards that put your business info in every renter's hands.",
    type: "guide",
    tags: ["contact-cards", "customers", "branding"],
    content: `## What are Contact Cards?

Contact Cards are digital business-card-style pages that contain your company's contact information — phone, email, website, and social links. They are automatically shared with renters in booking confirmation emails.

When a renter taps the link, they can:
- Save your contact information to their phone.
- Call or email you directly with one tap.
- Visit your website or social media profiles.

## Setting up your Contact Card
1. Go to **Contact Cards** in the sidebar.
2. Click **Edit** on your default card.
3. Fill in:
   - Company name and tagline.
   - Phone number (tap-to-call).
   - Email address (tap-to-email).
   - Website URL.
   - Social links (Instagram, Facebook, etc.).
4. Upload a photo or logo for the card header.
5. Click **Save**.

## Previewing your card
Click **Preview** to see exactly what renters will see when they open the link.

## Multiple cards
You can create multiple cards for different staff members or different rental categories. Assign a specific card to a listing in the listing's settings.

## Why this matters
A contact card dramatically increases the chance that renters save your details and return for another booking. It is one of the highest-leverage branding touches available to you.`,
  },

  "waivers": {
    title: "Digital Waivers",
    slug: "digital-waivers",
    excerpt: "Collect legally-binding digital signatures before every rental pickup.",
    type: "guide",
    tags: ["waivers", "customers", "legal"],
    content: `## What are Waivers?

A waiver is a digital document that renters must read and sign before picking up their rental. Waivers protect your business by confirming the renter acknowledges your rental terms, damage liability, and safety guidelines.

## Setting up your waiver
1. Go to **Waivers** in the sidebar.
2. Click **New Waiver**.
3. Paste or type your waiver text in the editor (markdown is supported).
4. Give the waiver a name (e.g. "Standard Rental Agreement").
5. Click **Save**.

## Assigning a waiver to listings
In each listing's settings, select which waiver template applies. All bookings for that listing will require the renter to sign before pickup.

## How renters sign
After their booking is confirmed, renters receive a link to sign the waiver electronically. Their name, signature, and timestamp are recorded and stored against the booking.

## Viewing signed waivers
Open any completed booking and scroll to the **Waiver** section. Click **Download** to save a signed PDF copy for your records.

## What counts as a valid signature?
OutdoorShare captures:
- The renter's typed name.
- A drawn or typed signature.
- The date and time of signing.
- The renter's IP address.

This creates a legally-valid audit trail in most jurisdictions. Consult your local legal advisor to confirm requirements for your area.

## Tips
- Keep waivers concise — long documents have lower completion rates.
- Always include your damage liability clause and your cancellation policy.
- Update your waiver whenever your policies change; old signed copies are stored with the booking they were signed for.`,
  },

  // ── Tools ────────────────────────────────────────────────────────────────────
  "analytics": {
    title: "Analytics & Reporting",
    slug: "analytics-reporting",
    excerpt: "Use revenue charts, booking trends, and occupancy data to grow your rental business.",
    type: "guide",
    tags: ["analytics", "tools", "reporting"],
    content: `## What is in Analytics?

The Analytics page gives you a visual breakdown of your rental business performance. Charts update in real time as bookings come in.

## Available reports

### Revenue
- Monthly gross revenue trend (bar chart).
- Revenue by listing — which items earn the most.
- Average booking value over time.

### Bookings
- Total bookings per month.
- Booking source breakdown (online storefront, manual, quote conversion).
- Lead time — how far in advance renters book.

### Occupancy
- Occupancy rate per listing — the percentage of available days that were booked.
- Utilization by unit — identifies underutilized equipment.

### Customers
- New vs. returning renters.
- Top renters by spend.

## Filtering data
Use the date range picker at the top of the page to filter all charts to a specific period. You can view daily, weekly, monthly, or yearly aggregates.

## Exporting data
Click **Export CSV** to download the raw data for any chart. This is useful for importing into your own spreadsheet or accounting software.

## Tips for using analytics
- Check occupancy regularly — a consistently low-occupancy listing may need better photos or a price adjustment.
- Compare month-over-month revenue to spot seasonal trends and plan your inventory accordingly.
- High lead times suggest corporate or group customers who plan ahead — consider offering a quote workflow for them.`,
  },

  "promo-codes": {
    title: "Promo Codes",
    slug: "promo-codes",
    excerpt: "Create discount codes to run promotions and reward repeat customers.",
    type: "guide",
    tags: ["promo-codes", "tools", "discounts"],
    content: `## What are Promo Codes?

Promo codes allow renters to apply a discount at checkout. You control the discount amount, the expiry date, and how many times a code can be used.

## Creating a promo code
1. Go to **Promo Codes** in the sidebar.
2. Click **New Promo Code**.
3. Fill in:
   - **Code** — the string renters type at checkout (e.g. SUMMER20). Use uppercase with no spaces.
   - **Discount type** — percentage (e.g. 20% off) or fixed amount (e.g. \$10 off).
   - **Discount value** — the percentage or dollar amount.
   - **Usage limit** — the maximum number of times the code can be used. Leave blank for unlimited.
   - **Expiry date** — the date after which the code no longer works. Leave blank for no expiry.
4. Click **Save**.

## Restricting codes to specific listings
Toggle **Listing restriction** when creating the code and select which listings it applies to. Renters can only use the code when booking one of those listings.

## Viewing usage
Each code shows a **Uses** count. Click the count to see which bookings used the code.

## Deactivating a code
Toggle the code to **Inactive** to stop it from working without deleting the usage history.

## Best practices
- Run short-duration codes for seasonal promotions (e.g. valid for one week only).
- Use a unique code per influencer or partner so you can track which channel drove bookings.
- Do not create too many codes at once — renters who know you have codes may wait for one before booking.`,
  },

  "kiosk-mode": {
    title: "Kiosk Mode",
    slug: "kiosk-mode",
    excerpt: "Let walk-in customers book rentals themselves on a tablet at your location.",
    type: "guide",
    tags: ["kiosk-mode", "tools", "in-person"],
    content: `## What is Kiosk Mode?

Kiosk Mode turns any tablet or browser into a self-service rental terminal. Customers can browse your available listings, select dates and quantities, and complete a booking — all without staff assistance.

This is ideal for:
- Busy check-in counters where staff are occupied.
- Unstaffed rental hubs or drop boxes.
- Events where you want a quick walk-up booking station.

## Enabling Kiosk Mode
1. Go to **Kiosk** in the sidebar.
2. Click **Enable Kiosk Mode**.
3. Copy the generated **Kiosk URL** or click **Open Kiosk**.

Open the Kiosk URL on your tablet browser and set it to full-screen mode (on iPad: tap the share icon → "Add to Home Screen").

## What renters see in Kiosk Mode
- A simplified storefront showing only available listings.
- A date picker and quantity selector.
- A checkout flow where they enter their name, email, and payment details.
- A booking confirmation screen with a QR code they can screenshot.

## Locking the device
After opening the Kiosk URL, use your device's Guided Access (iOS) or App Pinning (Android) feature to prevent customers from leaving the kiosk app.

## Kiosk-only listings
If you want only certain items to appear in the kiosk (e.g. not your premium, staff-handled equipment), go to each listing's settings and toggle **Show in Kiosk**.

## Ending a kiosk session
Close the browser tab or navigate away from the Kiosk URL. Kiosk Mode does not remain active — it is simply a special view of your storefront.`,
  },

  // ── Account ──────────────────────────────────────────────────────────────────
  "team": {
    title: "Team Management",
    slug: "team-management",
    excerpt: "Invite staff members and control what each person can access.",
    type: "guide",
    tags: ["team", "account", "staff", "roles"],
    content: `## Overview

The Team page lets you invite additional users to your admin dashboard. Each team member has a role that determines what they can see and do.

## Roles

| Role | Permissions |
|------|-------------|
| **Owner** | Full access — billing, settings, team management, all data. |
| **Manager** | All operational features except billing and team management. |
| **Staff** | View and manage bookings and customers only. Cannot edit listings or access financial data. |

## Inviting a team member
1. Go to **Team** in the sidebar.
2. Click **Invite Member**.
3. Enter their email address and select their role.
4. Click **Send Invite**.

They will receive an email with a link to set their password and join your account.

## Changing a role
Click the **···** menu next to any team member and select **Change Role**. The change takes effect immediately.

## Removing a team member
Click the **···** menu and select **Remove**. Their access is revoked immediately. Any bookings or records they created are preserved.

## Pending invites
If an invitee has not yet accepted their invite, their status shows as **Pending**. You can resend or cancel the invite from the same menu.

## Security tips
- Only grant the minimum role required for each person's responsibilities.
- Remove staff promptly when they leave your organization.
- The Owner role should only be held by the business owner.`,
  },

  "wallet": {
    title: "My Wallet",
    slug: "my-wallet",
    excerpt: "View your payout balance and manage your Stripe Connect account.",
    type: "guide",
    tags: ["wallet", "account", "payouts", "stripe"],
    content: `## What is My Wallet?

My Wallet shows your current payout balance — money from completed bookings that is ready to be transferred to your bank account. All payments are processed through Stripe Connect, which means funds go directly to your Stripe account and then to your bank.

## Connecting Stripe
If you have not yet connected Stripe, My Wallet will prompt you to do so. Click **Connect with Stripe** and follow the Stripe onboarding flow. You will need:
- A valid business or personal bank account.
- Your business details (name, address, tax ID if applicable).
- A valid phone number for identity verification.

This is a one-time setup. Once connected, all future booking payments are automatically routed to your Stripe account.

## Your balance
| Column | Meaning |
|--------|---------|
| **Available** | Ready to pay out to your bank now. |
| **Pending** | Funds from recent bookings still in the holding period (typically 2–7 days). |
| **On the way** | A payout that Stripe has initiated; will arrive in your bank within 1–3 business days. |

## Requesting a payout
If you have automatic payouts enabled in Stripe, funds transfer on a regular schedule (daily, weekly, or monthly — set inside your Stripe dashboard). You can also trigger a manual payout from within Stripe.

## Transaction history
The wallet page shows a log of every payment received, including the booking reference, amount, and the OutdoorShare platform fee deducted.

## Platform fee
OutdoorShare deducts a platform fee from each booking. The exact fee is shown in your subscription agreement. Your wallet balance reflects the amount after this deduction.`,
  },

  "billing": {
    title: "Billing & Subscription",
    slug: "billing-subscription",
    excerpt: "Manage your OutdoorShare subscription, view invoices, and update your payment method.",
    type: "guide",
    tags: ["billing", "account", "subscription"],
    content: `## Your subscription plan

OutdoorShare charges a monthly platform fee based on your selected plan. You can view your current plan on the **Billing** page.

## Adding a payment method
1. Go to **Billing** in the sidebar.
2. Click **Add Payment Method**.
3. Enter your credit or debit card details in the Stripe-hosted form.
4. Click **Save**.

Your card is stored securely by Stripe — OutdoorShare never stores card numbers directly.

## Viewing invoices
All past invoices are listed on the Billing page. Click any invoice to download a PDF copy for your records.

## Free trial
New accounts start on a 14-day free trial. You can access all features during the trial. When the trial ends:
- If you have added a payment method, your subscription starts automatically.
- If you have not, your storefront is paused until you subscribe.

A banner in your admin dashboard shows how many trial days remain.

## Cancelling your subscription
Contact OutdoorShare support to cancel. Your data is retained for 90 days after cancellation in case you want to reactivate.

## Updating your billing email
Go to **Settings → Account** and update the billing email address. Invoices are sent to this address.`,
  },

  "settings": {
    title: "Settings",
    slug: "settings",
    excerpt: "Customize your storefront branding, contact information, policies, and more.",
    type: "guide",
    tags: ["settings", "account", "branding", "customization"],
    content: `## Settings overview

The Settings page is divided into sections. Work through each one during setup, then return any time you need to make changes.

## General
- **Company name** — shown in the storefront header, emails, and contact cards.
- **Contact email** — the reply-to address on all automated emails.
- **Phone number** — shown on your storefront and contact cards.
- **Business address** — used on invoices and booking confirmations.
- **Time zone** — ensures dates and times display correctly for your location.

## Branding
- **Logo** — upload a PNG or JPEG (recommended 400 × 400 px square).
- **Brand color** — a hex color code used as the primary button and accent color on your storefront.
- **Hero image** — the large banner image on your storefront homepage (recommended 1600 × 600 px).
- **Custom domain** — contact support to connect your own domain (e.g. rentals.yourcompany.com).

## Payments
- **Stripe Connect** — link or re-link your Stripe account.
- **Security deposit** — set a default deposit amount applied to all bookings.
- **Currency** — set the currency shown on your storefront.

## Policies
- **Cancellation policy** — define your refund rules (full refund, no refund, or partial based on lead time).
- **Minimum rental duration** — the minimum number of hours or days a booking must last.

## Booking
- **Instant booking** — if enabled, bookings are auto-confirmed without your manual approval.
- **Booking buffer** — the minimum gap required between consecutive bookings of the same listing (useful for cleaning time).

## Communications
- **From name** — the sender name on automated emails (defaults to your company name).
- **Reply-to email** — where renter replies are forwarded.`,
  },

  "feedback": {
    title: "Sending Feedback",
    slug: "sending-feedback",
    excerpt: "Share feature requests, report bugs, or ask questions directly with the OutdoorShare team.",
    type: "guide",
    tags: ["feedback", "account", "support"],
    content: `## How to send feedback

1. Go to **Feedback** in the sidebar.
2. Select a feedback type:
   - **Feature Request** — you want a new capability added to the platform.
   - **Bug Report** — something is not working correctly.
   - **General Feedback** — anything else, including praise or suggestions.
3. Write your message in the text area. Be as specific as possible — screenshots, steps to reproduce, and expected vs. actual behaviour help a lot.
4. Click **Send Feedback**.

You will receive a confirmation email. The OutdoorShare team reviews all submissions and prioritizes based on frequency and impact.

## What to include in a bug report
- What you were trying to do.
- What happened instead.
- The page or feature where it occurred.
- Your browser and device (e.g. Chrome on MacBook, Safari on iPhone).

## Feature requests
Good feature requests explain the **problem** you are trying to solve, not just the solution. For example: "I need to offer half-day pricing" is more useful than "Add a 4-hour booking option."

## Response times
OutdoorShare reviews feedback continuously. High-priority bugs are typically acknowledged within one business day. Feature requests are collected, and popular ones are included in upcoming releases.

## Alternative: contact support
For urgent issues, email **support@myoutdoorshare.com** directly. Include your company name and a description of the problem.`,
  },
};

// ─── Main seed function ────────────────────────────────────────────────────────
async function seed() {
  await clear();

  for (const catDef of CATEGORIES) {
    // Insert category
    const [cat] = await db.insert(docCategoriesTable).values({
      name: catDef.name,
      slug: catDef.slug,
      description: catDef.description,
      icon: catDef.icon,
      color: catDef.color,
      sortOrder: catDef.sortOrder,
    }).returning();
    console.log(`\n📂 ${cat.name}`);

    const featDefs = FEATURES[catDef.slug] ?? [];
    for (const featDef of featDefs) {
      // Insert feature
      const [feat] = await db.insert(docFeaturesTable).values({
        name: featDef.name,
        slug: featDef.slug,
        description: featDef.description,
        status: featDef.status,
        categoryId: cat.id,
        projectId: null,
      }).returning();

      // Insert article
      const artDef = ARTICLES[featDef.slug];
      if (artDef) {
        await db.insert(docArticlesTable).values({
          title: artDef.title,
          slug: artDef.slug,
          excerpt: artDef.excerpt,
          content: artDef.content,
          type: artDef.type,
          categoryId: cat.id,
          featureId: feat.id,
          projectId: null,
          author: "OutdoorShare",
          tags: artDef.tags,
          published: true,
        });
        console.log(`  ✓ ${feat.name} → "${artDef.title}"`);
      }
    }
  }

  console.log("\n✅ Seed complete!");
}

seed().catch(console.error).finally(() => process.exit(0));
