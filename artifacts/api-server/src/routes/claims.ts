import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { claimsTable, bookingsTable, listingsTable, tenantsTable } from "@workspace/db/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { sendClaimAlertEmail } from "../services/gmail";

const router: IRouter = Router();

function formatClaim(c: typeof claimsTable.$inferSelect) {
  return {
    ...c,
    claimedAmount: c.claimedAmount ? parseFloat(c.claimedAmount) : null,
    settledAmount: c.settledAmount ? parseFloat(c.settledAmount) : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

router.get("/claims", async (req, res) => {
  try {
    const { status, type, customerEmail, startDate, endDate } = req.query;
    const conditions = [];
    if (req.tenantId) conditions.push(eq(claimsTable.tenantId, req.tenantId));
    if (status) conditions.push(eq(claimsTable.status, status as any));
    if (type) conditions.push(eq(claimsTable.type, type as any));
    if (customerEmail) conditions.push(eq(claimsTable.customerEmail, String(customerEmail)));
    if (startDate) conditions.push(gte(claimsTable.createdAt, new Date(String(startDate))));
    if (endDate) conditions.push(lte(claimsTable.createdAt, new Date(String(endDate))));

    const claims = await db
      .select()
      .from(claimsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(claimsTable.createdAt));

    res.json(claims.map(formatClaim));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch claims" });
  }
});

router.get("/claims/:id", async (req, res) => {
  try {
    const conditions = [eq(claimsTable.id, Number(req.params.id))];
    if (req.tenantId) conditions.push(eq(claimsTable.tenantId, req.tenantId));
    const [claim] = await db.select().from(claimsTable).where(and(...conditions));
    if (!claim) return res.status(404).json({ error: "Not found" });

    let bookingInfo = null;
    let listingInfo = null;
    if (claim.bookingId) {
      const bookingConditions = [eq(bookingsTable.id, claim.bookingId)];
      if (req.tenantId) bookingConditions.push(eq(bookingsTable.tenantId, req.tenantId));
      const [b] = await db
        .select({ id: bookingsTable.id, startDate: bookingsTable.startDate, endDate: bookingsTable.endDate, totalPrice: bookingsTable.totalPrice })
        .from(bookingsTable).where(and(...bookingConditions));
      bookingInfo = b ?? null;
    }
    if (claim.listingId) {
      const listingConditions = [eq(listingsTable.id, claim.listingId)];
      if (req.tenantId) listingConditions.push(eq(listingsTable.tenantId, req.tenantId));
      const [l] = await db
        .select({ id: listingsTable.id, title: listingsTable.title, imageUrls: listingsTable.imageUrls })
        .from(listingsTable).where(and(...listingConditions));
      listingInfo = l ?? null;
    }

    res.json({ ...formatClaim(claim), booking: bookingInfo, listing: listingInfo });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch claim" });
  }
});

router.post("/claims", async (req, res) => {
  try {
    const { bookingId, listingId, customerName, customerEmail, type, description, claimedAmount, evidenceUrls } = req.body;
    if (!customerName || !customerEmail || !description) {
      return res.status(400).json({ error: "customerName, customerEmail, and description are required" });
    }

    const now = new Date();
    const [created] = await db
      .insert(claimsTable)
      .values({
        tenantId: req.tenantId ?? null,
        bookingId: bookingId ?? null,
        listingId: listingId ?? null,
        customerName,
        customerEmail,
        type: type || "damage",
        description,
        claimedAmount: claimedAmount != null ? String(claimedAmount) : null,
        evidenceUrls: evidenceUrls ? JSON.stringify(evidenceUrls) : null,
        status: "open",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    res.status(201).json(formatClaim(created));

    // Fire-and-forget email alert to superadmin
    (async () => {
      try {
        let companyName = "Unknown Company";
        let slug = "unknown";
        if (created.tenantId) {
          const [tenant] = await db
            .select({ name: tenantsTable.name, slug: tenantsTable.slug })
            .from(tenantsTable)
            .where(eq(tenantsTable.id, created.tenantId))
            .limit(1);
          if (tenant) { companyName = tenant.name; slug = tenant.slug; }
        }
        await sendClaimAlertEmail({
          claimId: created.id,
          customerName: created.customerName,
          customerEmail: created.customerEmail,
          type: created.type,
          description: created.description,
          claimedAmount: created.claimedAmount ? parseFloat(created.claimedAmount) : null,
          companyName,
          slug,
          bookingId: created.bookingId ?? null,
        });
      } catch (e) {
        req.log.warn({ err: e }, "Failed to send claim alert email (non-fatal)");
      }
    })();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create claim" });
  }
});

router.put("/claims/:id", async (req, res) => {
  try {
    const { status, adminNotes, settledAmount, claimedAmount, description, type, evidenceUrls } = req.body;

    const whereConditions = [eq(claimsTable.id, Number(req.params.id))];
    if (req.tenantId) whereConditions.push(eq(claimsTable.tenantId, req.tenantId));
    const [updated] = await db
      .update(claimsTable)
      .set({
        ...(status !== undefined && { status }),
        ...(adminNotes !== undefined && { adminNotes }),
        ...(settledAmount !== undefined && { settledAmount: settledAmount != null ? String(settledAmount) : null }),
        ...(claimedAmount !== undefined && { claimedAmount: claimedAmount != null ? String(claimedAmount) : null }),
        ...(description !== undefined && { description }),
        ...(type !== undefined && { type }),
        ...(evidenceUrls !== undefined && { evidenceUrls: evidenceUrls ? JSON.stringify(evidenceUrls) : null }),
        updatedAt: new Date(),
      })
      .where(and(...whereConditions))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(formatClaim(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update claim" });
  }
});

router.delete("/claims/:id", async (req, res) => {
  try {
    const whereConditions = [eq(claimsTable.id, Number(req.params.id))];
    if (req.tenantId) whereConditions.push(eq(claimsTable.tenantId, req.tenantId));
    await db.delete(claimsTable).where(and(...whereConditions));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete claim" });
  }
});

export default router;
