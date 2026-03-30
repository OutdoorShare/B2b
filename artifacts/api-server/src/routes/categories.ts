import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { categoriesTable, listingsTable } from "@workspace/db/schema";
import { eq, count } from "drizzle-orm";

const router: IRouter = Router();

router.get("/categories", async (req, res) => {
  try {
    const cats = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
    
    const withCounts = await Promise.all(cats.map(async (cat) => {
      const [result] = await db
        .select({ count: count() })
        .from(listingsTable)
        .where(eq(listingsTable.categoryId, cat.id));
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
    const [created] = await db.insert(categoriesTable).values(req.body).returning();
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
