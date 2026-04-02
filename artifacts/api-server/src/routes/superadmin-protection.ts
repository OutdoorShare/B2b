import { Router } from "express";
import { db } from "@workspace/db";
import { platformProtectionPlansTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const KNOWN_CATEGORIES = [
  { slug: "atv", name: "ATV" },
  { slug: "boat", name: "Boat" },
  { slug: "camper", name: "Camper" },
  { slug: "dirt-bike", name: "Dirt Bike" },
  { slug: "ebike", name: "Ebike" },
  { slug: "jet-ski", name: "Jet Ski" },
  { slug: "rv", name: "RV" },
  { slug: "snowmobile", name: "Snowmobile" },
  { slug: "towing-vehicle", name: "Towing Vehicle" },
  { slug: "utv", name: "UTV" },
  { slug: "utility-trailer", name: "Utility Trailer" },
];

// Seed known categories on first call
async function seedIfNeeded() {
  const existing = await db.select().from(platformProtectionPlansTable);
  const existingSlugs = new Set(existing.map(r => r.categorySlug));
  for (const cat of KNOWN_CATEGORIES) {
    if (!existingSlugs.has(cat.slug)) {
      await db.insert(platformProtectionPlansTable).values({
        categorySlug: cat.slug,
        categoryName: cat.name,
        enabled: false,
        feeAmount: "0",
      });
    }
  }
}

// GET /superadmin/protection-plans
router.get("/superadmin/protection-plans", async (req, res) => {
  try {
    await seedIfNeeded();
    const rows = await db.select().from(platformProtectionPlansTable)
      .orderBy(platformProtectionPlansTable.categoryName);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /superadmin/protection-plans/:slug
router.put("/superadmin/protection-plans/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const { enabled, feeAmount } = req.body;

    const existing = await db.select().from(platformProtectionPlansTable)
      .where(eq(platformProtectionPlansTable.categorySlug, slug));

    if (existing.length === 0) {
      const cat = KNOWN_CATEGORIES.find(c => c.slug === slug);
      await db.insert(platformProtectionPlansTable).values({
        categorySlug: slug,
        categoryName: cat?.name ?? slug,
        enabled: !!enabled,
        feeAmount: String(feeAmount ?? "0"),
        updatedAt: new Date(),
      });
    } else {
      await db.update(platformProtectionPlansTable)
        .set({
          enabled: !!enabled,
          feeAmount: String(feeAmount ?? "0"),
          updatedAt: new Date(),
        })
        .where(eq(platformProtectionPlansTable.categorySlug, slug));
    }

    const [updated] = await db.select().from(platformProtectionPlansTable)
      .where(eq(platformProtectionPlansTable.categorySlug, slug));
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUBLIC: GET /protection-plan/:categorySlug ─────────────────────────────────
// Used by the renter booking flow to look up the platform fee for a category.
router.get("/protection-plan/:categorySlug", async (req, res) => {
  try {
    await seedIfNeeded();
    const [plan] = await db
      .select()
      .from(platformProtectionPlansTable)
      .where(eq(platformProtectionPlansTable.categorySlug, req.params.categorySlug));
    if (!plan || !plan.enabled || parseFloat(plan.feeAmount) <= 0) {
      res.json({ enabled: false, feeAmount: "0", categorySlug: req.params.categorySlug });
      return;
    }
    res.json({ enabled: true, feeAmount: plan.feeAmount, categoryName: plan.categoryName, categorySlug: plan.categorySlug });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
