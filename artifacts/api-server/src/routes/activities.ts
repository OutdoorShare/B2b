import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { activitiesTable, tenantsTable, businessProfileTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";

const router: IRouter = Router();

// ── Public: list all active activities across all tenants ─────────────────────
router.get("/public/activities", async (req, res) => {
  try {
    const rows = await db
      .select({
        activity: activitiesTable,
        tenantName: tenantsTable.name,
        tenantSlug: tenantsTable.slug,
        bizName: businessProfileTable.name,
        bizCity: businessProfileTable.city,
        bizState: businessProfileTable.state,
      })
      .from(activitiesTable)
      .innerJoin(tenantsTable, eq(activitiesTable.tenantId, tenantsTable.id))
      .leftJoin(businessProfileTable, eq(businessProfileTable.tenantId, tenantsTable.id))
      .where(and(eq(activitiesTable.isActive, true), eq(tenantsTable.status, "active")))
      .orderBy(desc(activitiesTable.createdAt));

    res.json(rows.map(r => ({
      ...r.activity,
      pricePerPerson: r.activity.pricePerPerson ? parseFloat(r.activity.pricePerPerson) : 0,
      tenantName: r.bizName || r.tenantName,
      tenantSlug: r.tenantSlug,
      location: r.activity.location || `${r.bizCity || ""}${r.bizCity && r.bizState ? ", " : ""}${r.bizState || ""}` || r.tenantName,
    })));
  } catch (e: any) {
    console.error("[activities] public list error:", e.message);
    res.status(500).json({ error: "Failed to load activities" });
  }
});

// ── Admin: list tenant activities ─────────────────────────────────────────────
router.get("/activities", async (req, res) => {
  if (!req.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const rows = await db
      .select()
      .from(activitiesTable)
      .where(eq(activitiesTable.tenantId, req.tenantId))
      .orderBy(desc(activitiesTable.createdAt));
    res.json(rows.map(fmt));
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load activities" });
  }
});

// ── Admin: get single activity ────────────────────────────────────────────────
router.get("/activities/:id", async (req, res) => {
  if (!req.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const id = parseInt(req.params.id);
    const [row] = await db
      .select()
      .from(activitiesTable)
      .where(and(eq(activitiesTable.id, id), eq(activitiesTable.tenantId, req.tenantId)));
    if (!row) { res.status(404).json({ error: "Activity not found" }); return; }
    res.json(fmt(row));
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load activity" });
  }
});

// ── Admin: create activity ────────────────────────────────────────────────────
router.post("/activities", async (req, res) => {
  if (!req.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const { title, description, category, pricePerPerson, durationMinutes, maxCapacity, location, imageUrls, highlights, whatToBring, minAge, isActive } = req.body;
    if (!title) { res.status(400).json({ error: "Title is required" }); return; }
    const [row] = await db.insert(activitiesTable).values({
      tenantId: req.tenantId,
      title,
      description: description ?? "",
      category: category ?? "adventure",
      pricePerPerson: pricePerPerson?.toString() ?? "0",
      durationMinutes: durationMinutes ?? 60,
      maxCapacity: maxCapacity ?? 10,
      location: location ?? "",
      imageUrls: imageUrls ?? [],
      highlights: highlights ?? [],
      whatToBring: whatToBring ?? "",
      minAge: minAge ?? null,
      isActive: isActive ?? true,
    }).returning();
    res.status(201).json(fmt(row));
  } catch (e: any) {
    res.status(500).json({ error: "Failed to create activity" });
  }
});

// ── Admin: update activity ────────────────────────────────────────────────────
router.put("/activities/:id", async (req, res) => {
  if (!req.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const id = parseInt(req.params.id);
    const { title, description, category, pricePerPerson, durationMinutes, maxCapacity, location, imageUrls, highlights, whatToBring, minAge, isActive } = req.body;
    const [row] = await db
      .update(activitiesTable)
      .set({
        title, description, category,
        pricePerPerson: pricePerPerson?.toString(),
        durationMinutes, maxCapacity, location,
        imageUrls, highlights, whatToBring, minAge,
        isActive,
        updatedAt: new Date(),
      })
      .where(and(eq(activitiesTable.id, id), eq(activitiesTable.tenantId, req.tenantId)))
      .returning();
    if (!row) { res.status(404).json({ error: "Activity not found" }); return; }
    res.json(fmt(row));
  } catch (e: any) {
    res.status(500).json({ error: "Failed to update activity" });
  }
});

// ── Admin: delete activity ────────────────────────────────────────────────────
router.delete("/activities/:id", async (req, res) => {
  if (!req.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db
      .delete(activitiesTable)
      .where(and(eq(activitiesTable.id, id), eq(activitiesTable.tenantId, req.tenantId)))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Activity not found" }); return; }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to delete activity" });
  }
});

function fmt(a: typeof activitiesTable.$inferSelect) {
  return {
    ...a,
    pricePerPerson: a.pricePerPerson ? parseFloat(a.pricePerPerson) : 0,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export default router;
