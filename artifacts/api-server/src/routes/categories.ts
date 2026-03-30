import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { categoriesTable, listingsTable } from "@workspace/db/schema";
import { eq, count, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/categories", async (req, res) => {
  try {
    const catWhere = req.tenantId ? eq(categoriesTable.tenantId, req.tenantId) : undefined;
    const cats = await db.select().from(categoriesTable).where(catWhere).orderBy(categoriesTable.name);
    
    const withCounts = await Promise.all(cats.map(async (cat) => {
      const listingWhere = req.tenantId
        ? and(eq(listingsTable.categoryId, cat.id), eq(listingsTable.tenantId, req.tenantId!))
        : eq(listingsTable.categoryId, cat.id);
      const [result] = await db
        .select({ count: count() })
        .from(listingsTable)
        .where(listingWhere);
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
