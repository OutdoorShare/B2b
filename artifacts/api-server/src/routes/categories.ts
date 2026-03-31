import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { categoriesTable, listingsTable } from "@workspace/db/schema";
import { eq, count, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/categories", async (req, res) => {
  try {
    if (!req.tenantId) { res.json([]); return; }
    const cats = await db.select().from(categoriesTable)
      .where(eq(categoriesTable.tenantId, req.tenantId))
      .orderBy(categoriesTable.name);
    
    const withCounts = await Promise.all(cats.map(async (cat) => {
      // Only count *active* listings so that the storefront filter bar
      // only surfaces categories that actually have bookable items.
      const listingConditions = [
        eq(listingsTable.categoryId, cat.id),
        eq(listingsTable.status, "active"),
      ];
      if (req.tenantId) listingConditions.push(eq(listingsTable.tenantId, req.tenantId));
      const [result] = await db
        .select({ count: count() })
        .from(listingsTable)
        .where(and(...listingConditions));
      return {
        ...cat,
        listingCount: Number(result?.count ?? 0),
        createdAt: cat.createdAt.toISOString(),
      };
    }));

    res.json(withCounts);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.post("/categories", async (req, res) => {
  try {
    const [created] = await db.insert(categoriesTable).values({
      ...req.body,
      tenantId: req.tenantId ?? null,
    }).returning();
    res.status(201).json({
      ...created,
      listingCount: 0,
      createdAt: created.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create category" });
  }
});

export default router;
