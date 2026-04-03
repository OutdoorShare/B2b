import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { customersTable, bookingsTable, tenantsTable, businessProfileTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { sendCredentialsEmail } from "../services/gmail";

const scryptAsync = promisify(scrypt);
const router: IRouter = Router();

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  const hashBuffer = Buffer.from(hash, "hex");
  const supplied = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(hashBuffer, supplied);
}

function safeCustomer(c: typeof customersTable.$inferSelect) {
  const { passwordHash: _, ...safe } = c;
  return {
    ...safe,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

router.post("/customers/register", async (req, res) => {
  try {
    const { email, password, name, phone, slug } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: "email, password and name are required" });
      return;
    }

    const tenantSlug = (slug ?? "").trim().toLowerCase();
    const normalEmail = email.toLowerCase().trim();

    // Check uniqueness across all tenants (accounts work cross-tenant)
    const [existing] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.email, normalEmail));

    if (existing) {
      res.status(409).json({ error: "An account with this email already exists. Please sign in instead." });
      return;
    }

    const passwordHash = await hashPassword(password);
    const [customer] = await db
      .insert(customersTable)
      .values({ email: normalEmail, passwordHash, name, phone, tenantSlug })
      .returning();

    res.status(201).json(safeCustomer(customer));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to register" });
  }
});

// ── Set password for an existing (passwordless) customer or create from booking ─
router.post("/customers/set-password", async (req, res) => {
  try {
    const { email, password, tenantSlug: rawSlug } = req.body;
    if (!email || !password || !rawSlug) {
      res.status(400).json({ error: "email, password and tenantSlug are required" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const tenantSlug = rawSlug.trim().toLowerCase();
    const normalEmail = email.toLowerCase().trim();

    // Check for existing customer record
    const [existing] = await db
      .select()
      .from(customersTable)
      .where(and(eq(customersTable.email, normalEmail), eq(customersTable.tenantSlug, tenantSlug)));

    if (existing) {
      res.status(409).json({ error: "An account already exists for this email. Please sign in." });
      return;
    }

    // Resolve tenant so we can scope the booking lookup
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    // Look up name/phone from the most recent booking for this customer
    const [booking] = await db
      .select({ customerName: bookingsTable.customerName, customerPhone: bookingsTable.customerPhone })
      .from(bookingsTable)
      .where(and(eq(bookingsTable.customerEmail, normalEmail), eq(bookingsTable.tenantId, tenant.id)))
      .orderBy(desc(bookingsTable.id))
      .limit(1);

    const name = booking?.customerName ?? normalEmail.split("@")[0];
    const phone = booking?.customerPhone ?? null;

    const passwordHash = await hashPassword(password);
    const [customer] = await db
      .insert(customersTable)
      .values({ email: normalEmail, passwordHash, name, phone: phone ?? undefined, tenantSlug })
      .returning();

    // Send credentials email in background (fetch company name for branded From)
    (async () => {
      try {
        const [biz] = await db
          .select({ businessName: businessProfileTable.businessName })
          .from(businessProfileTable)
          .where(eq(businessProfileTable.tenantId, tenant.id));
        await sendCredentialsEmail({
          customerName: name,
          customerEmail: normalEmail,
          tenantSlug,
          password,
          companyName: biz?.businessName ?? undefined,
          adminEmail: tenant.email,
        });
      } catch (emailErr) {
        console.warn("Failed to send credentials email", emailErr);
      }
    })();

    res.status(201).json(safeCustomer(customer));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to set password" });
  }
});

router.post("/customers/login", async (req, res) => {
  try {
    const { email, password, slug } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const tenantSlug = (slug ?? "").trim().toLowerCase();
    const normalEmail = email.toLowerCase().trim();

    // Try exact slug match first, then fall back to empty-slug (legacy accounts)
    let customer = (await db
      .select()
      .from(customersTable)
      .where(and(
        eq(customersTable.email, normalEmail),
        eq(customersTable.tenantSlug, tenantSlug),
      )))[0];

    if (!customer) {
      // Legacy accounts created before tenant_slug tracking
      customer = (await db
        .select()
        .from(customersTable)
        .where(and(
          eq(customersTable.email, normalEmail),
          eq(customersTable.tenantSlug, ""),
        )))[0];
    }

    if (!customer) {
      // Cross-tenant: renter accounts work across all companies
      customer = (await db
        .select()
        .from(customersTable)
        .where(eq(customersTable.email, normalEmail))
        .limit(1))[0];
    }

    if (!customer) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await verifyPassword(password, customer.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Backfill tenant_slug if it was empty
    if (!customer.tenantSlug && tenantSlug) {
      await db.update(customersTable)
        .set({ tenantSlug, updatedAt: new Date() })
        .where(eq(customersTable.id, customer.id));
      customer = { ...customer, tenantSlug };
    }

    res.json(safeCustomer(customer));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to login" });
  }
});

router.get("/customers/:id", async (req, res) => {
  try {
    const [customer] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, Number(req.params.id)));

    if (!customer) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json(safeCustomer(customer));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch customer" });
  }
});

// ── Admin: lookup customer identity verification by email ──────────────────────
router.get("/customers/lookup-by-email", async (req, res) => {
  try {
    const email = (req.query.email as string ?? "").toLowerCase().trim();
    if (!email) { res.status(400).json({ error: "email required" }); return; }

    const conditions = [eq(customersTable.email, email)];
    if (req.tenantId) conditions.push(eq(customersTable.tenantId, req.tenantId));

    const [customer] = await db
      .select({
        id: customersTable.id,
        name: customersTable.name,
        email: customersTable.email,
        identityVerificationStatus: customersTable.identityVerificationStatus,
        identityVerificationSessionId: customersTable.identityVerificationSessionId,
        identityVerifiedAt: customersTable.identityVerifiedAt,
      })
      .from(customersTable)
      .where(and(...conditions))
      .limit(1);

    if (!customer) { res.json({ found: false }); return; }
    res.json({
      found: true,
      ...customer,
      identityVerifiedAt: customer.identityVerifiedAt?.toISOString() ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to lookup customer" });
  }
});

router.post("/customers/:id/change-password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "currentPassword and newPassword are required" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters" });
      return;
    }
    const [customer] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, Number(req.params.id)));
    if (!customer) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const valid = await verifyPassword(currentPassword, customer.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
    const newHash = await hashPassword(newPassword);
    await db
      .update(customersTable)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(customersTable.id, customer.id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

router.put("/customers/:id", async (req, res) => {
  try {
    const { name, phone, billingAddress, billingCity, billingState, billingZip, cardLastFour, cardBrand } = req.body;
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (name) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (billingAddress !== undefined) updateData.billingAddress = billingAddress;
    if (billingCity !== undefined) updateData.billingCity = billingCity;
    if (billingState !== undefined) updateData.billingState = billingState;
    if (billingZip !== undefined) updateData.billingZip = billingZip;
    if (cardLastFour !== undefined) updateData.cardLastFour = cardLastFour;
    if (cardBrand !== undefined) updateData.cardBrand = cardBrand;

    const [updated] = await db
      .update(customersTable)
      .set(updateData)
      .where(eq(customersTable.id, Number(req.params.id)))
      .returning();

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }

    res.json(safeCustomer(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update customer" });
  }
});

export default router;
