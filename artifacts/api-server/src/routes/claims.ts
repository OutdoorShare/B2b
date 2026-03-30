import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { claimsTable, bookingsTable, listingsTable } from "@workspace/db/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";

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

// GET all claims (with optional filters)
router.get("/claims", async (req, res) => {
  try {
    const { status, type, customerEmail, startDate, endDate } = req.query;
    const conditions = [];
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

// GET single claim
router.get("/claims/:id", async (req, res) => {
  try {
    const [claim] = await db
      .select()
      .from(claimsTable)
      .where(eq(claimsTable.id, Number(req.params.id)));
    if (!claim) return res.status(404).json({ error: "Not found" });

    // Attach booking + listing info if available
    let bookingInfo = null;
    let listingInfo = null;
    if (claim.bookingId) {
      const [b] = await db
        .select({ id: bookingsTable.id, startDate: bookingsTable.startDate, endDate: bookingsTable.endDate, totalPrice: bookingsTable.totalPrice })
        .from(bookingsTable).where(eq(bookingsTable.id, claim.bookingId));
      bookingInfo = b ?? null;
    }
    if (claim.listingId) {
      const [l] = await db
        .select({ id: listingsTable.id, title: listingsTable.title, imageUrls: listingsTable.imageUrls })
        .from(listingsTable).where(eq(listingsTable.id, claim.listingId));
      listingInfo = l ?? null;
    }

    res.json({ ...formatClaim(claim), booking: bookingInfo, listing: listingInfo });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch claim" });
  }
});

// POST create a claim
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
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create claim" });
  }
});

// PUT update a claim (status, notes, settled amount)
router.put("/claims/:id", async (req, res) => {
  try {
    const { status, adminNotes, settledAmount, claimedAmount, description, type, evidenceUrls } = req.body;

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
      .where(eq(claimsTable.id, Number(req.params.id)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(formatClaim(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update claim" });
  }
});

// DELETE a claim
router.delete("/claims/:id", async (req, res) => {
  try {
    await db.delete(claimsTable).where(eq(claimsTable.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete claim" });
  }
});

export default router;
