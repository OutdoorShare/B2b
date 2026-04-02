import { Router, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import {
  listingsTable, bookingsTable, businessProfileTable, tenantsTable,
  superadminUsersTable, adminUsersTable
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

// ── Auth helpers ───────────────────────────────────────────────────────────────

async function resolveTenantId(slug: string): Promise<number | null> {
  const [t] = await db.select({ id: tenantsTable.id })
    .from(tenantsTable).where(eq(tenantsTable.slug, slug)).limit(1);
  return t?.id ?? null;
}

async function requireAdminOrSuperAdmin(req: Request): Promise<{ tenantId: number | null; isSuperAdmin: boolean } | null> {
  const adminToken = req.headers["x-admin-token"] as string | undefined;
  const saToken = req.headers["x-superadmin-token"] as string | undefined;

  if (saToken) {
    const [u] = await db.select().from(superadminUsersTable).where(eq(superadminUsersTable.token, saToken)).limit(1);
    if (u?.status === "active") return { tenantId: null, isSuperAdmin: true };
  }
  if (adminToken) {
    // Check team members first (adminUsersTable)
    const [teamUser] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.token, adminToken)).limit(1);
    if (teamUser?.status === "active") return { tenantId: teamUser.tenantId, isSuperAdmin: false };

    // Also check company owners — their token is stored in tenantsTable.adminToken
    const [tenant] = await db.select({ id: tenantsTable.id, status: tenantsTable.status })
      .from(tenantsTable).where(eq(tenantsTable.adminToken, adminToken)).limit(1);
    if (tenant?.status === "active") return { tenantId: tenant.id, isSuperAdmin: false };
  }
  return null;
}

// ── Tool implementations ───────────────────────────────────────────────────────

async function getListings(tenantId: number) {
  const rows = await db.select({
    id: listingsTable.id, title: listingsTable.title,
    status: listingsTable.status, pricePerDay: listingsTable.pricePerDay,
    description: listingsTable.description,
  }).from(listingsTable).where(eq(listingsTable.tenantId, tenantId))
    .orderBy(desc(listingsTable.createdAt)).limit(50);
  return rows;
}

async function getBookings(tenantId: number, status?: string) {
  const conds = [eq(bookingsTable.tenantId, tenantId)];
  if (status && status !== "all") conds.push(eq(bookingsTable.status, status as any));
  const rows = await db.select({
    id: bookingsTable.id, customerName: bookingsTable.customerName,
    customerEmail: bookingsTable.customerEmail, status: bookingsTable.status,
    startDate: bookingsTable.startDate, endDate: bookingsTable.endDate,
    totalPrice: bookingsTable.totalPrice, listingTitle: bookingsTable.listingTitle,
    createdAt: bookingsTable.createdAt,
  }).from(bookingsTable).where(and(...conds)).orderBy(desc(bookingsTable.createdAt)).limit(30);
  return rows;
}

async function getBusinessSettings(tenantId: number) {
  const [row] = await db.select().from(businessProfileTable)
    .where(eq(businessProfileTable.tenantId, tenantId)).limit(1);
  return row;
}

async function updateListing(tenantId: number, listingId: number, changes: Record<string, unknown>) {
  const allowed = ["title", "description", "pricePerDay", "status", "categoryId"] as const;
  const safe: Record<string, unknown> = {};
  for (const k of allowed) if (k in changes) safe[k] = changes[k];
  if (!Object.keys(safe).length) return { error: "No valid fields to update" };
  await db.update(listingsTable).set(safe as any)
    .where(and(eq(listingsTable.id, listingId), eq(listingsTable.tenantId, tenantId)));
  return { success: true, updated: safe };
}

async function updateBooking(tenantId: number, bookingId: number, changes: Record<string, unknown>) {
  const allowed = ["status", "adminNotes", "notes"] as const;
  const safe: Record<string, unknown> = {};
  for (const k of allowed) if (k in changes) safe[k] = changes[k];
  if (!Object.keys(safe).length) return { error: "No valid fields to update" };
  await db.update(bookingsTable).set(safe as any)
    .where(and(eq(bookingsTable.id, bookingId), eq(bookingsTable.tenantId, tenantId)));
  return { success: true, updated: safe };
}

async function updateBusinessSettings(tenantId: number, changes: Record<string, unknown>) {
  const allowed = ["name", "instantBooking", "depositRequired", "depositPercent", "cancellationPolicy", "rentalTerms", "phone", "email"] as const;
  const safe: Record<string, unknown> = {};
  for (const k of allowed) if (k in changes) safe[k] = changes[k];
  if (!Object.keys(safe).length) return { error: "No valid fields to update" };
  await db.update(businessProfileTable).set(safe as any)
    .where(eq(businessProfileTable.tenantId, tenantId));
  return { success: true, updated: safe };
}

// ── Tool definitions ───────────────────────────────────────────────────────────

const adminTools: any[] = [
  {
    type: "function",
    function: {
      name: "get_listings",
      description: "Get all gear/product listings for this rental company. Returns title, status, price per day.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "update_listing",
      description: "Update a listing's title, description, price per day, or status (active/inactive/draft).",
      parameters: {
        type: "object",
        required: ["listing_id"],
        properties: {
          listing_id: { type: "number", description: "The numeric ID of the listing to update" },
          title: { type: "string" },
          description: { type: "string" },
          price_per_day: { type: "number", description: "Price in dollars per day" },
          status: { type: "string", enum: ["active", "inactive", "draft"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_bookings",
      description: "Get bookings for this rental company. Can filter by status.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["all", "pending", "confirmed", "active", "completed", "cancelled"], description: "Filter by booking status" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_booking",
      description: "Update a booking's status or notes.",
      parameters: {
        type: "object",
        required: ["booking_id"],
        properties: {
          booking_id: { type: "number", description: "The numeric ID of the booking" },
          status: { type: "string", enum: ["pending", "confirmed", "active", "completed", "cancelled", "no_show"] },
          notes: { type: "string", description: "Admin notes for the booking" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_business_settings",
      description: "Get the current business profile / settings (name, policies, deposit settings, instant booking, etc.)",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "update_business_settings",
      description: "Update business settings like name, instant booking toggle, deposit requirements, cancellation policy, or rental terms.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Company/storefront name" },
          instant_booking: { type: "boolean", description: "Whether bookings are auto-confirmed without manual approval" },
          deposit_required: { type: "boolean", description: "Whether a security deposit is required" },
          deposit_percent: { type: "number", description: "Security deposit percentage of total" },
          cancellation_policy: { type: "string", description: "Cancellation policy text" },
          rental_terms: { type: "string", description: "Rental terms and conditions text" },
          phone: { type: "string" },
          email: { type: "string" },
        },
      },
    },
  },
];

// ── Tool runner ────────────────────────────────────────────────────────────────

async function runTool(name: string, args: Record<string, unknown>, tenantId: number): Promise<string> {
  try {
    switch (name) {
      case "get_listings":
        return JSON.stringify(await getListings(tenantId));
      case "update_listing": {
        const id = Number(args.listing_id);
        const changes: Record<string, unknown> = {};
        if (args.title) changes.title = args.title;
        if (args.description) changes.description = args.description;
        if (args.price_per_day) changes.pricePerDay = String(args.price_per_day);
        if (args.status) changes.status = args.status;
        return JSON.stringify(await updateListing(tenantId, id, changes));
      }
      case "get_bookings":
        return JSON.stringify(await getBookings(tenantId, String(args.status ?? "all")));
      case "update_booking": {
        const id = Number(args.booking_id);
        const changes: Record<string, unknown> = {};
        if (args.status) changes.status = args.status;
        if (args.notes) changes.adminNotes = args.notes;
        return JSON.stringify(await updateBooking(tenantId, id, changes));
      }
      case "get_business_settings":
        return JSON.stringify(await getBusinessSettings(tenantId));
      case "update_business_settings": {
        const changes: Record<string, unknown> = {};
        if (args.name !== undefined) changes.name = args.name;
        if (args.instant_booking !== undefined) changes.instantBooking = args.instant_booking;
        if (args.deposit_required !== undefined) changes.depositRequired = args.deposit_required;
        if (args.deposit_percent !== undefined) changes.depositPercent = String(args.deposit_percent);
        if (args.cancellation_policy) changes.cancellationPolicy = args.cancellation_policy;
        if (args.rental_terms) changes.rentalTerms = args.rental_terms;
        if (args.phone) changes.phone = args.phone;
        if (args.email) changes.email = args.email;
        return JSON.stringify(await updateBusinessSettings(tenantId, changes));
      }
      default:
        return JSON.stringify({ error: "Unknown tool" });
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message ?? "Tool execution failed" });
  }
}

// ── Admin system prompt ────────────────────────────────────────────────────────

function buildAdminSystemPrompt(companyName: string, slug: string): string {
  return `You are OutdoorBot, an AI assistant embedded in the OutdoorShare rental management platform for ${companyName}.

You help the admin team operate their outdoor gear rental business more efficiently. You are knowledgeable, concise, and action-oriented.

## What you can do
- **View and manage listings**: See gear inventory, update titles, descriptions, pricing, and activation status
- **View and manage bookings**: See all reservations, update booking status, add admin notes
- **View and update business settings**: Company name, instant booking toggle, deposit settings, policies
- **Answer platform questions**: Explain how features work, best practices, troubleshooting

## Insurance / Protection Plan
All rentals on OutdoorShare include the Damage Protection Plan. It covers:
- Accident & collision damage
- Weather & water damage (rain, flooding, etc.)
- Mechanical breakdown
- Disaster & fire coverage
The protection plan fee is set per-listing as an add-on. It is required on all rentals and cannot be waived by renters.

## How the platform works
- **Listings**: Products/gear that renters can browse and book. Each listing has a title, description, photos, daily rate, categories, and optional add-ons.
- **Bookings**: Created when a renter completes checkout. Goes through states: pending → confirmed → active → completed.
- **Instant Booking**: When enabled, bookings auto-confirm. When disabled, admin must manually confirm each booking.
- **Kiosk Mode**: Allows walk-in customers to book at a physical location without creating an account.
- **Promo Codes**: Discount codes admins can create for marketing campaigns.
- **Security Deposit**: Optional hold on the renter's card, released at return.
- **Claims**: Used to document damage or disputes after a rental.

## Important rules
- When you're about to make a change, briefly say what you're going to do before doing it
- After making a change, confirm what was done
- Be concise. Skip unnecessary pleasantries.
- The tenant slug is "${slug}". Today's date is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;
}

// ── Renter system prompt ───────────────────────────────────────────────────────

function buildRenterSystemPrompt(companyName: string): string {
  return `You are an OutdoorShare assistant for ${companyName}, a gear rental service.

You help renters understand how to use the platform, what they're covered for, and how their bookings work. Be friendly and clear.

## How bookings work
1. Browse available gear on the storefront
2. Select dates and any add-ons (like extra gear or protection upgrades)
3. Enter your info and complete payment
4. You'll receive a confirmation email with pickup details
5. On pickup day, you'll complete a digital inspection and sign the rental agreement
6. At return, photos are taken to document the gear's condition

## Protection Plan (Insurance)
Every rental automatically includes the Damage Protection Plan. It covers:
- **Accident & collision damage** — if you drop or crash the gear
- **Weather & water damage** — rain, flooding, accidental submersion
- **Mechanical breakdown** — gear that stops working through normal use
- **Disaster & fire coverage** — extreme weather events and fire damage

The protection plan does NOT cover: theft (unless locked), intentional damage, or use outside of agreed rental terms.

## Pickup & return
- Bring a valid ID to pickup
- You'll do a digital photo inspection on pickup — note any pre-existing damage
- Return on or before the return date. Contact the company if you need an extension.
- Late returns may incur additional daily charges

## Common questions
- **Can I cancel?** Check the company's cancellation policy in your booking confirmation
- **What if gear is damaged?** Contact the company immediately. The protection plan will be reviewed.
- **How do I see my bookings?** Log in and go to "My Bookings" from the navigation
- **I lost my booking link** — Log in to your account to view all your bookings

Company: ${companyName}
Today: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;
}

// ── POST /api/ai/chat ─────────────────────────────────────────────────────────

router.post("/ai/chat", async (req: Request, res: Response) => {
  const { messages, role, tenantSlug, companyName } = req.body as {
    messages: Array<{ role: string; content: string }>;
    role: "admin" | "renter";
    tenantSlug: string;
    companyName?: string;
  };

  if (!messages?.length || !role || !tenantSlug) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  let tenantId: number | null = null;
  let isAdmin = false;

  if (role === "admin") {
    const auth = await requireAdminOrSuperAdmin(req);
    if (!auth) return res.status(401).json({ error: "Unauthorized" });
    tenantId = auth.tenantId ?? (await resolveTenantId(tenantSlug));
    isAdmin = true;
  } else {
    tenantId = await resolveTenantId(tenantSlug);
  }

  if (!tenantId) return res.status(404).json({ error: "Tenant not found" });

  const name = companyName ?? tenantSlug;
  const systemPrompt = isAdmin
    ? buildAdminSystemPrompt(name, tenantSlug)
    : buildRenterSystemPrompt(name);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const chatMessages: any[] = [
    { role: "system", content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];

  try {
    let loopCount = 0;
    while (loopCount++ < 5) {
      const stream = await openai.chat.completions.create({
        model: "gpt-5-mini",
        max_completion_tokens: 1024,
        messages: chatMessages,
        tools: isAdmin ? adminTools : undefined,
        tool_choice: isAdmin ? "auto" : undefined,
        stream: true,
      });

      let fullContent = "";
      let toolCalls: Record<string, { name: string; args: string }> = {};
      let hasToolCalls = false;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          fullContent += delta.content;
          res.write(`data: ${JSON.stringify({ content: delta.content })}\n\n`);
        }

        if (delta?.tool_calls) {
          hasToolCalls = true;
          for (const tc of delta.tool_calls) {
            const idx = String(tc.index ?? 0);
            if (!toolCalls[idx]) toolCalls[idx] = { name: "", args: "" };
            if (tc.function?.name) toolCalls[idx].name += tc.function.name;
            if (tc.function?.arguments) toolCalls[idx].args += tc.function.arguments;
          }
        }
      }

      if (!hasToolCalls) {
        // Done — no more tool calls
        break;
      }

      // Execute each tool call
      const toolResults: any[] = [];
      chatMessages.push({ role: "assistant", content: fullContent || null, tool_calls: Object.entries(toolCalls).map(([idx, tc]) => ({
        id: `call_${idx}`,
        type: "function",
        function: { name: tc.name, arguments: tc.args },
      })) });

      for (const [idx, tc] of Object.entries(toolCalls)) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.args); } catch {}

        // Notify client of the tool call (for UX feedback)
        res.write(`data: ${JSON.stringify({ tool: tc.name })}\n\n`);

        const result = await runTool(tc.name, args, tenantId!);
        chatMessages.push({ role: "tool", tool_call_id: `call_${idx}`, content: result });
        toolResults.push(result);
      }
      // Continue loop to get the follow-up response
    }
  } catch (err: any) {
    console.error("[ai/chat] Error:", err);
    res.write(`data: ${JSON.stringify({ error: err.message ?? "AI error" })}\n\n`);
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
