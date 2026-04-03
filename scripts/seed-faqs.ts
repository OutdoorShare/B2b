/**
 * FAQ Seed — adds a "FAQs & Troubleshooting" category with comprehensive
 * articles drawn from:
 *   - myoutdoorshare.com/protection-plan
 *   - outdoorshare.pro
 *   - Technical questions company admins commonly ask
 * Run: /home/runner/workspace/node_modules/.pnpm/node_modules/.bin/tsx scripts/seed-faqs.ts
 */
import { db } from "../lib/db/src/index";
import {
  docArticlesTable,
  docFeaturesTable,
  docCategoriesTable,
} from "../lib/db/src/schema/index";
import { eq } from "drizzle-orm";

// ── Helpers ────────────────────────────────────────────────────────────────────
async function upsertCategory(data: {
  name: string; slug: string; description: string; icon: string; color: string; sortOrder: number;
}) {
  const existing = await db.select().from(docCategoriesTable).where(eq(docCategoriesTable.slug, data.slug));
  if (existing.length > 0) return existing[0];
  const [row] = await db.insert(docCategoriesTable).values(data).returning();
  return row;
}

async function upsertFeature(data: {
  name: string; slug: string; description: string; status: string; categoryId: number;
}) {
  const existing = await db.select().from(docFeaturesTable).where(eq(docFeaturesTable.slug, data.slug));
  if (existing.length > 0) return existing[0];
  const [row] = await db.insert(docFeaturesTable).values({ ...data, projectId: null }).returning();
  return row;
}

async function upsertArticle(data: {
  title: string; slug: string; excerpt: string; content: string; type: string;
  tags: string[]; categoryId: number; featureId: number;
}) {
  const existing = await db.select().from(docArticlesTable).where(eq(docArticlesTable.slug, data.slug));
  if (existing.length > 0) {
    const [row] = await db.update(docArticlesTable).set({ ...data, projectId: null, author: "OutdoorShare", published: true }).where(eq(docArticlesTable.slug, data.slug)).returning();
    return row;
  }
  const [row] = await db.insert(docArticlesTable).values({ ...data, projectId: null, author: "OutdoorShare", published: true }).returning();
  return row;
}

// ── FAQ Articles ───────────────────────────────────────────────────────────────

const FAQ_ARTICLES = [

  // ── Protection Plan ──────────────────────────────────────────────────────────
  {
    featureSlug: "protection-plan-faq",
    featureName: "Protection Plan",
    featureDesc: "How OutdoorShare's contractual protection offering works for your renters and your business.",
    title: "Protection Plan — Frequently Asked Questions",
    slug: "protection-plan-faq",
    excerpt: "Everything company admins and renters need to know about the OutdoorShare Protection Plan.",
    type: "faq",
    tags: ["protection-plan", "insurance", "claims", "faq"],
    content: `## About the Protection Plan

### What is the OutdoorShare Protection Plan?
The OutdoorShare Protection Plan is a third-party–backed contractual protection program that helps manage risk during rentals. It provides liability and damage coverage during the rental period, making rentals safer and more predictable for both your business and your renters.

It is offered as an optional add-on at checkout and is priced per booking based on the rental value and duration.

### Is this insurance?
No. OutdoorShare is not an insurance provider and does not sell insurance. The Protection Plan is a **contractual protection offering** — not an insurance policy. It does not replace your business's commercial liability insurance, and renters remain financially responsible for deductibles and any excluded situations.

### Is this personal insurance for the renter?
No. It is not personal insurance and does not extend to the renter's personal injury, health, or property beyond the rented equipment. Renters should maintain their own personal insurance where relevant.

### Does this replace commercial rental insurance for my business?
No. The Protection Plan is designed to complement — not replace — your existing commercial rental or liability insurance. Consult your insurance provider about appropriate coverage for your operation.

### Is coverage available outside the U.S.?
Currently, the OutdoorShare Protection Plan applies to rentals that originate and take place within the United States only.

---

## What's Covered

### What does the Protection Plan cover?
When a renter purchases the Protection Plan, coverage generally includes:
- **Accidental damage** to the rented equipment during the rental period.
- **Liability protection** for certain incidents that occur while using the equipment.
- **Partial loss** resulting from accidents (subject to deductible).

Full coverage terms are presented to the renter at checkout and must be accepted before purchase.

### What is NOT covered?
The Protection Plan does not cover:
- Intentional damage or gross negligence.
- Theft (unless forcible entry can be documented).
- Damage caused by operating equipment outside its intended use (e.g. off-road use for a street vehicle).
- Normal wear and tear.
- Damage to third-party property beyond the rented item.
- Incidents outside the U.S.
- Any damage not reported within the required timeframe.

### Does the Protection Plan cover everything?
No. The plan is designed to cover the most common accidental damage scenarios, but deductibles apply and certain exclusions exist (see above). Renters remain responsible for their deductible and anything excluded from coverage.

---

## Renter Responsibility

### What is the renter financially responsible for?
Even with the Protection Plan, renters are responsible for:
- Their **deductible** — a fixed amount agreed to at plan purchase.
- Any **excluded damage** (intentional, negligence, unapproved use).
- Damage that was **not reported** within the required window.

### Does this mean renters are fully protected?
No. The plan reduces financial exposure significantly but does not eliminate it. The renter acknowledges this when they accept the plan terms at checkout.

### What's the best way for renters to avoid issues?
- Use equipment only for its intended purpose.
- Take photos at pickup and return.
- Report any incident immediately — do not wait until return.
- Read and understand the rental terms and Protection Plan exclusions before booking.

---

## Severe Damage & Charges

### What happens in the case of severe damage?
If severe damage occurs during a rental, a claim is opened. The OutdoorShare team reviews the evidence (photos, incident report, rental record) and determines the charge. The renter is notified and their card on file is charged for any amount owed above the plan's coverage — including their deductible or any excluded portion.

### How is severe damage determined?
Severe damage is assessed based on:
- Repair cost relative to the item's value.
- Whether the damage was foreseeable or preventable.
- The renter's account history and the circumstances reported.

The OutdoorShare claims team makes the final determination after reviewing all submitted evidence.

---

## Claims & Reporting

### How soon does a damage incident need to be reported?
Report any damage or incident **within 24 hours** of the return. Late reports significantly weaken coverage eligibility. As a company admin, open the claim from the booking page as soon as the issue is discovered.

### How do I (as a company admin) file a claim?
1. Open the relevant booking in your admin dashboard.
2. Scroll to the **Claims** section and click **Open Claim**.
3. Select the damage type, describe what happened, and upload photos.
4. Submit. The OutdoorShare team takes it from there.

You do not need to contact the renter directly about payment — OutdoorShare manages the charge process.

### Who makes the final decision on a claim?
OutdoorShare's claims team makes all final decisions. Neither the company admin nor the renter can unilaterally determine the outcome. This protects both parties.

### How long does it take to resolve a claim?
Most claims are reviewed within **2–5 business days**. Complex cases (severe damage, disputes) may take longer. You will be notified by email when the claim status changes.

---

## Documentation

### Are photos required to file a claim?
Photos are strongly recommended and significantly improve the outcome of a claim. Claims submitted without photographic evidence are harder to approve.

### Should I take my own photos at pickup and return?
Yes — always. As a company admin, you should photograph the equipment **before** the renter takes possession and **again** when it is returned. Use the **Pickup Photo Link** feature in the booking to create a timestamped, documented record.

### Can the equipment's pre-existing condition affect coverage?
Yes. If the claimed damage was already present before the rental and was not documented, it may not be covered. This is why before-and-after photos are essential.

---

## For Company Admins

### How does the Protection Plan benefit my business?
- **Reduces disputes**: Renters who purchase the plan have pre-agreed to coverage terms, making charge conversations easier.
- **Protects revenue**: Damage costs are partially or fully covered rather than coming out of your pocket.
- **Builds trust**: Renters feel more confident booking when they know protection is available.
- **OutdoorShare manages the claims**: You open the claim; the team handles resolution, evidence review, and charging the renter.

### Can I require renters to purchase the Protection Plan?
You can indicate that the Protection Plan is **strongly recommended** in your listing description and booking terms. However, it cannot be forced — renters choose whether to add it at checkout.

### What if a renter declines the Protection Plan and damage occurs?
You can still open a claim. If the renter did not purchase the plan, they are fully responsible for the damage cost. OutdoorShare will still assist with the claims process, but the renter has no coverage buffer — the full repair cost falls to them (up to the value of the item).

### Why does OutdoorShare offer this?
Outdoor equipment rentals carry real risk. The Protection Plan exists to make rentals commercially viable for businesses and accessible for renters — balancing accountability with reasonable risk management. It lets you run your rental operation with confidence.`,
  },

  // ── Getting Started FAQs ─────────────────────────────────────────────────────
  {
    featureSlug: "getting-started-faq",
    featureName: "Getting Started FAQs",
    featureDesc: "Common questions from new company admins setting up their OutdoorShare account.",
    title: "Getting Started — Frequently Asked Questions",
    slug: "getting-started-faq",
    excerpt: "Answers to the most common questions from new company admins.",
    type: "faq",
    tags: ["getting-started", "setup", "faq", "onboarding"],
    content: `## Account & Setup

### How do I get started with OutdoorShare?
After your account is created, log in at your storefront URL (e.g. \`myoutdoorshare.com/yourbrand/admin\`). The **Launchpad** will walk you through every setup step in order: business details, logo, first listing, Stripe connection, and booking policy. Complete each step and your storefront goes live.

### Do I need to connect Stripe to take bookings?
Yes. Stripe Connect is required to process online payments. Until Stripe is connected, your storefront is in preview mode — you can see how it looks but renters cannot complete bookings. Setup takes about 5 minutes inside the Stripe onboarding flow.

### Can I take bookings before Stripe is set up?
You can create **manual bookings** from within the admin without Stripe connected, but you will need to collect payment yourself (cash, Venmo, etc.) for those. Online bookings require Stripe.

### What is the "Powered by OutdoorShare" badge?
A small badge at the bottom of your storefront that attributes the platform. It links to myoutdoorshare.com. This is included on all plans and cannot be removed.

### Is there a demo I can look at?
Yes. A demo storefront is available at \`myoutdoorshare.com/demo-outdoorshare\`. You can browse it as a renter would to see the booking experience.

### What's the difference between outdoorshare.pro and myoutdoorshare.com?
- **outdoorshare.pro** — the marketing and sales site for business owners considering joining OutdoorShare as a company admin.
- **myoutdoorshare.com** — the public marketplace where renters browse and book adventures from all OutdoorShare partner companies.
- Your storefront lives at \`myoutdoorshare.com/yourbrandname\`.

### Can I use my own domain?
Custom domain setup (e.g. \`rentals.yourcompany.com\`) is available. Contact OutdoorShare support to configure it — it requires a DNS change on your end.

---

## Storefront & Listings

### How many listings can I create?
There is no hard limit on the number of listings. Create as many as your plan supports. Check your subscription details for any plan-specific limits.

### Can I list equipment by the hour?
Yes. Each listing supports daily and/or hourly pricing. You can set a minimum rental duration as well (e.g. minimum 2 hours).

### Can I offer multi-day discounts?
Yes. In each listing's pricing settings, you can set a percentage discount for rentals longer than a specified number of days (e.g. 10% off for 3+ days).

### How do renters find my storefront?
Renters can access your storefront via:
1. Your direct storefront URL (\`myoutdoorshare.com/yourbrand\`).
2. The OutdoorShare marketplace (\`myoutdoorshare.com\`) — if you have opted into marketplace listing.
3. Any link or QR code you share yourself (social media, flyers, email).

### Can renters book without creating an account?
Renters must verify their identity to complete a booking. OutdoorShare uses Stripe Identity to confirm their name, date of birth, and a government ID document. This is required for protection plan eligibility and fraud prevention.

---

## Technical

### What browsers are supported?
OutdoorShare works in all modern browsers: Chrome, Firefox, Safari, and Edge. Internet Explorer is not supported. The admin dashboard and storefront are both mobile-responsive.

### Is there a mobile app for company admins?
The admin dashboard is a mobile-responsive web app accessible from any smartphone browser. A dedicated native admin app is on the product roadmap.

### Is there a mobile app for renters?
Yes. The OutdoorShare app is available on both **iOS** (App Store) and **Android** (Google Play). Renters can browse, book, and manage their rentals from the app.

### Can I export my booking and revenue data?
Yes. Go to **Analytics** and click **Export CSV** to download raw booking and revenue data for any date range. This is useful for tax filing or importing into accounting software.`,
  },

  // ── Bookings & Operations FAQs ───────────────────────────────────────────────
  {
    featureSlug: "bookings-faq",
    featureName: "Bookings & Operations FAQs",
    featureDesc: "Common operational questions about bookings, payments, and running your rental business.",
    title: "Bookings & Operations — Frequently Asked Questions",
    slug: "bookings-operations-faq",
    excerpt: "Answers to common questions about managing bookings, payments, and daily operations.",
    type: "faq",
    tags: ["bookings", "operations", "payments", "faq"],
    content: `## Bookings

### What happens when a renter submits a booking?
The booking is created with **Pending** status. Stripe authorizes (but does not capture) the payment. You receive a notification and can review the booking before confirming. Once you click **Confirm**, Stripe captures the payment.

### Can bookings be auto-confirmed without my approval?
Yes. In **Settings → Booking**, enable **Instant Booking**. New bookings will be confirmed automatically without requiring your manual approval. This is recommended if your availability is accurately managed and you want to reduce response time.

### What if I want to decline a booking?
From the booking detail page, click **Cancel** before confirming. This releases the Stripe authorization and the renter is not charged. They receive an automated cancellation email.

### How do I handle a walk-in customer?
Click **New Booking** from the dashboard or bookings list. Fill in the customer details, select the listing and dates, and choose whether to collect payment online (send a payment link to their email) or mark it as paid manually (for cash/in-person transactions).

### Can a renter modify their booking?
Renters cannot modify a confirmed booking directly. You can cancel the original booking and create a new one, or adjust the dates manually from the booking detail page (admin only).

### What happens if a listing runs out of stock for the requested dates?
The listing will show as unavailable on those dates and renters cannot book it. You can manually adjust inventory or mark individual units as unavailable. If you want to allow waitlist inquiries, direct renters to contact you by email.

---

## Payments & Refunds

### When do I receive my money?
Stripe processes payments on your standard payout schedule (daily, weekly, or monthly — set inside your Stripe dashboard). Funds typically reach your bank account within 1–3 business days of a payout being initiated.

### What fees does OutdoorShare deduct?
OutdoorShare deducts a platform fee from each booking. The exact fee percentage is defined in your subscription agreement. Your wallet shows the net amount after the platform fee. Stripe's standard processing fee also applies.

### How do refunds work?
When you cancel a confirmed booking, you choose the refund amount (full, partial, or none, subject to your cancellation policy). OutdoorShare initiates the Stripe refund, which typically appears on the renter's card within 5–10 business days.

### Can I issue a partial refund?
Yes. From the booking detail, click **Cancel** and specify the refund amount. You can refund any amount from zero up to the full booking value.

### What if a payment fails?
If a renter's payment fails during booking, they are prompted to retry with a different card before the booking is confirmed. Failed payments do not create a booking record. If a confirmed booking's card later has a chargeback, OutdoorShare will assist with the Stripe dispute process.

### Can I accept cash payments?
Yes — via manual bookings. Create the booking in the admin and mark it as "paid manually." No Stripe payment is collected. You are responsible for collecting cash yourself.

---

## Cancellations & No-Shows

### What is my cancellation policy?
You set your own cancellation policy in **Settings → Policies**. Options include:
- **Full refund** if cancelled more than N days before the start.
- **Partial refund** (e.g. 50%) for late cancellations.
- **No refund** for cancellations within N hours of the start.

### What if a renter doesn't show up?
A no-show is treated as a completed booking by default (the equipment was reserved and unavailable). You can choose to issue a partial or no refund per your cancellation policy. Mark the booking as **Completed** in the admin.

### Can I cancel a booking on a renter's behalf?
Yes. Open the booking and click **Cancel**. You choose the refund amount. The renter receives an automated email notification.

---

## Notifications & Communications

### Does the renter get notified automatically?
Yes. OutdoorShare sends automated emails at every key booking moment: confirmation, cancellation, pickup reminder, return reminder, and damage charges. You do not need to send these manually.

### Can I send a custom message to a renter?
Yes. From any booking, click **Send Message** to send a custom branded email to the renter. This goes through the same email pipeline as automated notifications.

### What email address do my notifications come from?
Emails are sent from your company name (e.g. "Blue River Rentals via OutdoorShare"). The reply-to address is set in **Settings → Communications**. If no reply-to is set, replies go to your account email.`,
  },

  // ── Stripe & Payments Technical FAQs ────────────────────────────────────────
  {
    featureSlug: "stripe-faq",
    featureName: "Stripe & Payments FAQs",
    featureDesc: "Technical questions about Stripe Connect, payouts, and payment processing.",
    title: "Stripe Connect & Payments — Frequently Asked Questions",
    slug: "stripe-payments-faq",
    excerpt: "Technical answers about Stripe Connect, payout schedules, fees, and payment processing.",
    type: "faq",
    tags: ["stripe", "payments", "faq", "billing"],
    content: `## Stripe Connect Setup

### Why does OutdoorShare use Stripe Connect?
Stripe Connect allows payments from renters to go **directly to your Stripe account** — OutdoorShare never holds your money. This means faster access to funds, full transparency on transactions, and the security of Stripe's payment infrastructure.

### What information does Stripe need to onboard me?
Stripe's Know Your Business (KYB) process typically requires:
- Your legal business name, address, and phone number.
- A valid government-issued ID for the account owner.
- Your bank account details (routing and account number) for payouts.
- Your tax ID (EIN for businesses, SSN for sole proprietors).
- A business website or description of your rental activity.

### Can I use a personal Stripe account?
Yes, you can connect a personal Stripe account if you operate as a sole proprietor. However, a business Stripe account is recommended for tax reporting clarity and higher payout limits.

### I completed the Stripe setup but my storefront says "Stripe not connected" — what do I do?
Go to **Settings → Payments** and click **Reconnect Stripe**. If that doesn't resolve it, log into your Stripe dashboard and check that your account is fully verified (no pending requirements under "Complete your profile"). Contact OutdoorShare support if the issue persists.

### Can I connect Stripe later after setting up everything else?
Yes. You can complete all other setup steps and publish your storefront with Stripe pending. However, renters will not be able to complete online payments until Stripe is fully connected.

---

## Payouts

### When are funds available after a booking?
Stripe typically holds funds for a short period (1–7 days) after a payment. Once available, they are included in your next payout according to your payout schedule (daily, weekly, or monthly).

### How do I change my payout schedule?
Log into your Stripe dashboard (\`dashboard.stripe.com\`) and navigate to **Payouts → Payout schedule**. You can choose daily, weekly, or monthly payouts.

### Can I request an instant payout?
Stripe offers Instant Payouts (for a small fee) if your bank supports it. This is managed entirely within your Stripe dashboard — OutdoorShare does not control payout timing.

### What currency are payouts in?
Payouts are made in USD. If your bank account is in another currency, your bank will handle the conversion.

---

## Fees

### How is the platform fee calculated?
OutdoorShare deducts its platform fee from the booking total before the remainder is sent to your Stripe account. The fee percentage is defined in your subscription agreement.

Example: If a booking is $200 and the platform fee is 5%, your net payout is $190 minus Stripe's processing fee (~2.9% + $0.30).

### Does Stripe charge a processing fee?
Yes. Stripe charges approximately 2.9% + $0.30 per successful online transaction. This is separate from the OutdoorShare platform fee and is deducted automatically by Stripe.

### Are there fees for refunds?
OutdoorShare does not charge an additional fee for refunds. Stripe's processing fee on the original transaction is not returned (this is Stripe's standard policy).

---

## Payment Issues

### What do I do if a renter's payment is declined?
Declined payments happen before a booking is confirmed, so no booking is created. The renter is prompted to use a different card. You do not need to take any action.

### What if a renter files a chargeback?
If a renter disputes a charge with their bank (a "chargeback"), Stripe will notify you via email and request evidence. Log into your Stripe dashboard to respond with:
- The signed waiver or rental agreement.
- The booking confirmation details.
- Photos of the equipment at pickup and return.
- Any communications with the renter.

Respond promptly — Stripe sets strict deadlines (usually 7–10 days) for chargeback responses. OutdoorShare can provide booking records to support your case.

### Can I set a security deposit?
Yes. In **Settings → Payments**, set a default security deposit amount. The deposit is authorized on the renter's card at booking and released after a successful, damage-free return. If a claim is filed, the deposit can be captured rather than released.`,
  },

  // ── Identity, Waivers & Legal FAQs ──────────────────────────────────────────
  {
    featureSlug: "identity-legal-faq",
    featureName: "Identity & Legal FAQs",
    featureDesc: "Questions about renter identity verification, waivers, and legal compliance.",
    title: "Identity Verification & Legal — Frequently Asked Questions",
    slug: "identity-legal-faq",
    excerpt: "How renter identity verification works, what waivers cover, and your legal responsibilities.",
    type: "faq",
    tags: ["identity", "waivers", "legal", "faq", "stripe-identity"],
    content: `## Identity Verification

### How are renters verified?
OutdoorShare uses **Stripe Identity** to verify renters. At checkout, renters are asked to:
1. Upload a photo of a valid government-issued ID (driver's license or passport).
2. Take a live selfie for biometric matching.

Stripe's automated system compares the selfie to the ID document and confirms the renter's identity. This process takes about 60 seconds.

### Is identity verification required for every booking?
Renters are verified once when they create their account. Subsequent bookings with the same verified account do not require re-verification unless their verification expires or a flag is raised.

### What happens if a renter fails verification?
If Stripe Identity cannot verify the renter, the booking is blocked. The renter is prompted to try again with a clearer ID photo or a different document. Renters who repeatedly fail verification are flagged for manual review.

### Can I waive the verification requirement for a known customer?
No — identity verification is a platform-level requirement applied to all renters equally. It cannot be bypassed by company admins, as it is required for Protection Plan eligibility and fraud prevention.

### What data is collected during verification?
Stripe processes the ID and selfie data. OutdoorShare stores only the verification **status** (verified/unverified) and the renter's name as it appears on their ID. Full ID document images are stored by Stripe per their privacy policy, not by OutdoorShare.

### Is verification compliant with privacy laws?
Stripe Identity is GDPR and CCPA compliant. Renters can request deletion of their identity data from Stripe directly. OutdoorShare does not store or have access to the raw ID documents.

---

## Digital Waivers

### Are digital waivers legally binding?
In most U.S. jurisdictions, yes — a digital signature is legally equivalent to a handwritten signature under the ESIGN Act and UETA. OutdoorShare captures the renter's name, signature, timestamp, and IP address, creating an auditable record.

Consult a local attorney to confirm enforceability in your specific state and for your specific rental type, especially for high-risk equipment (ATVs, watercraft, etc.).

### Do I need my own attorney to draft my waiver?
OutdoorShare provides a starter waiver template, but it is strongly recommended that you have a local attorney review and customize it for your specific business. Generic waivers may not be enforceable for specialized equipment or in all states.

### Where are signed waivers stored?
Signed waivers are stored against each booking. To download a signed PDF, open the booking and click **Download Waiver** in the Waiver section.

### Can I update my waiver template after renters have already signed?
Yes. Updating your waiver template applies to **future bookings only**. All previously signed waivers are preserved as they were when signed — the version the renter agreed to is what's recorded.

### What if a renter refuses to sign the waiver?
If a renter refuses to sign, do not release the equipment. A waiver is a condition of the rental. You can cancel the booking and issue a full refund. Document the refusal in the booking notes.

---

## Legal & Compliance

### Am I responsible for maintaining my own business insurance?
Yes. OutdoorShare's Protection Plan is not a substitute for commercial rental insurance. You should maintain appropriate commercial general liability and property insurance for your rental fleet. Consult your insurance broker for advice specific to outdoor equipment rentals.

### Does OutdoorShare report income on my behalf?
No. OutdoorShare does not file tax returns or issue 1099 forms on your behalf. Stripe may issue a 1099-K if your account meets IRS reporting thresholds. Consult a tax professional about reporting your rental income.

### Can I operate as a sole proprietor or do I need a business entity?
You can join OutdoorShare as a sole proprietor or as a registered business (LLC, corporation, etc.). The choice has tax and liability implications unrelated to OutdoorShare — consult a lawyer or accountant to determine the right structure for your operation.`,
  },

  // ── Account & Technical FAQs ─────────────────────────────────────────────────
  {
    featureSlug: "account-technical-faq",
    featureName: "Account & Technical FAQs",
    featureDesc: "Questions about login, team access, settings, and technical troubleshooting.",
    title: "Account & Technical — Frequently Asked Questions",
    slug: "account-technical-faq",
    excerpt: "Answers to common technical questions about your account, login, team access, and settings.",
    type: "faq",
    tags: ["account", "technical", "team", "faq", "troubleshooting"],
    content: `## Login & Access

### How do I log into my admin dashboard?
Go to \`myoutdoorshare.com/yourbrandname/admin\` and sign in with your email and password. Replace "yourbrandname" with your company's storefront slug (e.g. "blueriverrentals").

### I forgot my password — what do I do?
On the login page, click **Forgot password?** and enter your email address. You will receive a reset link within a few minutes. Check your spam folder if it doesn't arrive.

### Can I change my admin email address?
Go to **Settings → Account** and update your email address. You will need to verify the new address via a confirmation link before the change takes effect.

### My account is locked — what happened?
Accounts are temporarily locked after multiple failed login attempts as a security measure. Wait 15 minutes and try again. If the issue persists, contact OutdoorShare support.

### Can I have multiple admin accounts?
Yes. Use **Team → Invite Member** to add additional admins. Assign them the appropriate role (Owner, Manager, or Staff).

---

## Team & Roles

### What can a Staff member see and do?
Staff members can view and manage bookings and view the customer list. They cannot edit listings, view financial data (wallet/billing), or access team settings.

### What can a Manager do vs. an Owner?
Managers have access to all operational features (listings, inventory, bookings, quotes, claims, customers, analytics) but cannot access billing, change subscription plans, or manage team membership. Owners have full access to everything.

### Can I limit a team member to specific listings?
Not currently — role access is platform-wide. Listing-level permissions are on the product roadmap.

### How do I remove a team member immediately?
Go to **Team**, click the **···** menu next to the team member, and select **Remove**. Their access is revoked immediately. Their records (bookings they created, notes they left) are preserved.

---

## Settings & Customization

### Can I change my storefront URL slug?
Contact OutdoorShare support to change your slug (e.g. from "blueriver" to "blueriverrentals"). This will break any existing links shared with customers, so plan the change carefully.

### Can I have multiple storefronts under one account?
Each OutdoorShare account manages one storefront. If you need multiple storefronts (e.g. for different locations or brands), contact support to discuss a multi-location setup.

### How do I change the currency on my storefront?
Go to **Settings → Payments** and update the currency. Note: Stripe processes payments in the currency shown on your storefront, so only change this if your Stripe account supports the new currency.

### Can I embed my storefront in my own website?
Yes. You can link to your OutdoorShare storefront from your website, or use your storefront URL directly. Embedding the storefront in an iframe is not officially supported and may cause display issues.

---

## Troubleshooting

### My listings aren't showing on the storefront — why?
Check that each listing is:
1. **Active** (not deactivated).
2. Has at least one **unit** in inventory.
3. Has at least one **photo** uploaded.
4. Has a **price** set.

All four must be true for a listing to appear to renters.

### Renters say they can't complete a booking — what should I check?
1. Confirm Stripe is connected and fully verified (**Settings → Payments**).
2. Confirm the listing has available inventory for the requested dates.
3. Check that the renter has completed identity verification.
4. Ask the renter to try a different browser or device.

### Emails aren't being received by renters — what do I do?
1. Go to **Communications** and confirm the email was sent (status: Delivered).
2. Ask the renter to check their spam/junk folder.
3. Verify the email address on the booking is correct.
4. If all looks correct but delivery fails, contact OutdoorShare support.

### My analytics data looks wrong — why?
Analytics only reflect **confirmed and completed** bookings. Pending or cancelled bookings are not included. Data updates in real time but may lag by a few minutes during high-traffic periods.

### How do I contact OutdoorShare support?
- **Email**: contact.us@myoutdoorshare.com
- **Phone**: 801-653-0765
- **In-app**: Go to **Feedback** in the sidebar to submit a bug report or support request.

Response times: urgent issues within 1 business day, general questions within 2–3 business days.`,
  },
];

// ── Run ────────────────────────────────────────────────────────────────────────
async function seed() {
  const cat = await upsertCategory({
    name: "FAQs",
    slug: "faqs",
    description: "Answers to common questions about the platform, protection plan, payments, and more.",
    icon: "❓",
    color: "#8b5cf6",
    sortOrder: 6,
  });
  console.log(`\n📂 ${cat.name} (id: ${cat.id})`);

  for (const artDef of FAQ_ARTICLES) {
    const feat = await upsertFeature({
      name: artDef.featureName,
      slug: artDef.featureSlug,
      description: artDef.featureDesc,
      status: "stable",
      categoryId: cat.id,
    });

    await upsertArticle({
      title: artDef.title,
      slug: artDef.slug,
      excerpt: artDef.excerpt,
      content: artDef.content,
      type: artDef.type,
      tags: artDef.tags,
      categoryId: cat.id,
      featureId: feat.id,
    });

    console.log(`  ✓ ${artDef.title}`);
  }

  console.log("\n✅ FAQ seed complete!");
}

seed().catch(console.error).finally(() => process.exit(0));
