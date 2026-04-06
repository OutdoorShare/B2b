import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { memoriesTable, customersTable, tenantsTable } from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

const router = Router();

async function getCustomerId(req: Request): Promise<number | null> {
  const raw = req.headers["x-customer-id"];
  if (!raw) return null;
  const id = parseInt(String(raw), 10);
  return isNaN(id) ? null : id;
}

// GET /api/memories — public social wall
router.get("/memories", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "24"), 10), 50);
    const offset = parseInt(String(req.query.offset ?? "0"), 10);
    const tenantFilter = req.query.tenantId ? parseInt(String(req.query.tenantId), 10) : null;

    const conditions = [eq(memoriesTable.isPublic, true)];
    if (tenantFilter) {
      conditions.push(eq(memoriesTable.taggedTenantId, tenantFilter));
    }

    const rows = await db
      .select()
      .from(memoriesTable)
      .where(and(...conditions))
      .orderBy(desc(memoriesTable.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(memoriesTable)
      .where(and(...conditions));

    res.json({ memories: rows, total: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/memories/my — current customer's memories
router.get("/memories/my", async (req: Request, res: Response) => {
  const customerId = await getCustomerId(req);
  if (!customerId) return void res.status(401).json({ error: "Not authenticated" });

  try {
    const rows = await db
      .select()
      .from(memoriesTable)
      .where(eq(memoriesTable.customerId, customerId))
      .orderBy(desc(memoriesTable.createdAt));

    res.json({ memories: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/memories — create a memory
router.post("/memories", async (req: Request, res: Response) => {
  const customerId = await getCustomerId(req);
  if (!customerId) return void res.status(401).json({ error: "Not authenticated" });

  try {
    const customer = await db.query.customersTable.findFirst({
      where: eq(customersTable.id, customerId),
    });
    if (!customer) return void res.status(404).json({ error: "Customer not found" });

    const { photoUrls, caption, taggedTenantId, isPublic } = req.body;

    if (!Array.isArray(photoUrls) || photoUrls.length === 0) {
      return void res.status(400).json({ error: "At least one photo is required" });
    }

    let taggedTenantName: string | null = null;
    let taggedTenantSlug: string | null = null;

    if (taggedTenantId) {
      const tenant = await db.query.tenantsTable.findFirst({
        where: eq(tenantsTable.id, parseInt(String(taggedTenantId), 10)),
      });
      if (tenant) {
        taggedTenantName = tenant.name ?? tenant.slug ?? null;
        taggedTenantSlug = tenant.slug ?? null;
      }
    }

    const [memory] = await db
      .insert(memoriesTable)
      .values({
        customerId,
        customerName: customer.name ?? "Adventurer",
        photoUrls,
        caption: caption ?? null,
        taggedTenantId: taggedTenantId ? parseInt(String(taggedTenantId), 10) : null,
        taggedTenantName,
        taggedTenantSlug,
        isPublic: isPublic !== false,
      })
      .returning();

    res.status(201).json(memory);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/memories/:id
router.delete("/memories/:id", async (req: Request, res: Response) => {
  const customerId = await getCustomerId(req);
  if (!customerId) return void res.status(401).json({ error: "Not authenticated" });

  try {
    const id = parseInt(req.params.id, 10);
    const existing = await db.query.memoriesTable.findFirst({
      where: eq(memoriesTable.id, id),
    });
    if (!existing) return void res.status(404).json({ error: "Not found" });
    if (existing.customerId !== customerId) return void res.status(403).json({ error: "Forbidden" });

    await db.delete(memoriesTable).where(eq(memoriesTable.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/memories/tenants — list companies/hosts that can be tagged
router.get("/memories/tenants", async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q ?? "").toLowerCase();
    const rows = await db
      .select({
        id: tenantsTable.id,
        name: tenantsTable.name,
        slug: tenantsTable.slug,
        isHost: tenantsTable.isHost,
      })
      .from(tenantsTable)
      .where(eq(tenantsTable.status, "active"))
      .orderBy(tenantsTable.name)
      .limit(30);

    const filtered = q
      ? rows.filter((r) => (r.name ?? r.slug ?? "").toLowerCase().includes(q))
      : rows;

    res.json({ tenants: filtered });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
