import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { businessProfileTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/business", async (req, res) => {
  try {
    const profiles = await db.select().from(businessProfileTable).limit(1);
    if (profiles.length === 0) {
      const [created] = await db.insert(businessProfileTable).values({}).returning();
      const p = created;
      res.json({
        ...p,
        depositPercent: parseFloat(p.depositPercent ?? "25"),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      });
      return;
    }
    const p = profiles[0];
    res.json({
      ...p,
      depositPercent: parseFloat(p.depositPercent ?? "25"),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch business profile" });
  }
});

router.put("/business", async (req, res) => {
  try {
    const profiles = await db.select().from(businessProfileTable).limit(1);
    const body = req.body;
    
    if (profiles.length === 0) {
      const [created] = await db.insert(businessProfileTable).values({
        ...body,
        depositPercent: String(body.depositPercent ?? "25"),
        updatedAt: new Date(),
      }).returning();
      const p = created;
      res.json({
        ...p,
        depositPercent: parseFloat(p.depositPercent ?? "25"),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      });
      return;
    }

    const [updated] = await db
      .update(businessProfileTable)
      .set({
        ...body,
        depositPercent: body.depositPercent !== undefined ? String(body.depositPercent) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(businessProfileTable.id, profiles[0].id))
      .returning();

    const p = updated;
    res.json({
      ...p,
      depositPercent: parseFloat(p.depositPercent ?? "25"),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update business profile" });
  }
});

export default router;
