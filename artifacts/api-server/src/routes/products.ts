import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { productsTable, maintenanceLogsTable, listingsTable, categoriesTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireTenant } from "../middleware/admin-auth";

const OUT_OF_SERVICE_STATUSES = ["maintenance", "damaged", "out_of_service"];

const router: IRouter = Router();

// ── List all products for the tenant ────────────────────────────────────────
router.get("/products", async (req, res) => {
  try {
    if (!req.tenantId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const products = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.tenantId, req.tenantId))
      .orderBy(desc(productsTable.createdAt));
    res.json(products);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// ── Get single product ───────────────────────────────────────────────────────
router.get("/products/:id", async (req, res) => {
  try {
    if (!req.tenantId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, Number(req.params.id)), eq(productsTable.tenantId, req.tenantId)))
      .limit(1);
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    // Include linked listings count
    const linkedListings = await db
      .select({ id: listingsTable.id, title: listingsTable.title, status: listingsTable.status })
      .from(listingsTable)
      .where(and(eq(listingsTable.productId, product.id), eq(listingsTable.tenantId, req.tenantId)));
    res.json({ ...product, linkedListings });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// ── Create product ───────────────────────────────────────────────────────────
router.post("/products", requireTenant as any, async (req, res) => {
  try {
    const {
      name, sku, categoryId, description, status, quantity,
      imageUrls, brand, model, specs, notes, nextMaintenanceDate,
    } = req.body;
    const [product] = await db
      .insert(productsTable)
      .values({
        tenantId: req.tenantId!,
        name,
        sku: sku || null,
        categoryId: categoryId || null,
        description: description || null,
        status: status || "available",
        quantity: quantity ?? 1,
        imageUrls: imageUrls ?? [],
        brand: brand || null,
        model: model || null,
        specs: specs || null,
        notes: notes || null,
        nextMaintenanceDate: nextMaintenanceDate || null,
        updatedAt: new Date(),
      })
      .returning();
    res.status(201).json(product);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

// ── Update product ───────────────────────────────────────────────────────────
router.put("/products/:id", requireTenant as any, async (req, res) => {
  try {
    const [existing] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, Number(req.params.id)), eq(productsTable.tenantId, req.tenantId!)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const {
      name, sku, categoryId, description, status, quantity,
      imageUrls, brand, model, specs, notes, nextMaintenanceDate,
      serviceUntil, deactivateListings,
    } = req.body;

    // Determine serviceUntil: clear it if going back to available
    const resolvedServiceUntil = status === "available"
      ? null
      : (serviceUntil !== undefined ? (serviceUntil || null) : undefined);

    const [updated] = await db
      .update(productsTable)
      .set({
        ...(name !== undefined && { name }),
        ...(sku !== undefined && { sku }),
        ...(categoryId !== undefined && { categoryId }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(quantity !== undefined && { quantity }),
        ...(imageUrls !== undefined && { imageUrls }),
        ...(brand !== undefined && { brand }),
        ...(model !== undefined && { model }),
        ...(specs !== undefined && { specs }),
        ...(notes !== undefined && { notes }),
        ...(nextMaintenanceDate !== undefined && { nextMaintenanceDate }),
        ...(resolvedServiceUntil !== undefined && { serviceUntil: resolvedServiceUntil }),
        updatedAt: new Date(),
      })
      .where(eq(productsTable.id, existing.id))
      .returning();

    // Deactivate or reactivate linked listings based on the toggle
    if (deactivateListings === true && status && OUT_OF_SERVICE_STATUSES.includes(status)) {
      await db
        .update(listingsTable)
        .set({ status: "draft", updatedAt: new Date() })
        .where(and(eq(listingsTable.productId, existing.id), eq(listingsTable.tenantId, req.tenantId!)));
    } else if (status === "available" && deactivateListings === false) {
      await db
        .update(listingsTable)
        .set({ status: "active", updatedAt: new Date() })
        .where(and(eq(listingsTable.productId, existing.id), eq(listingsTable.tenantId, req.tenantId!)));
    }

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// ── Delete product (also unlinks associated listings) ───────────────────────
router.delete("/products/:id", requireTenant as any, async (req, res) => {
  try {
    const [existing] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, Number(req.params.id)), eq(productsTable.tenantId, req.tenantId!)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    // Unlink (not delete) associated listings
    await db
      .update(listingsTable)
      .set({ productId: null })
      .where(and(eq(listingsTable.productId, existing.id), eq(listingsTable.tenantId, req.tenantId!)));
    // Delete maintenance logs
    await db.delete(maintenanceLogsTable).where(eq(maintenanceLogsTable.productId, existing.id));
    // Delete product
    await db.delete(productsTable).where(eq(productsTable.id, existing.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// ── List maintenance logs ────────────────────────────────────────────────────
router.get("/products/:id/maintenance", async (req, res) => {
  try {
    if (!req.tenantId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const logs = await db
      .select()
      .from(maintenanceLogsTable)
      .where(and(eq(maintenanceLogsTable.productId, Number(req.params.id)), eq(maintenanceLogsTable.tenantId, req.tenantId)))
      .orderBy(desc(maintenanceLogsTable.createdAt));
    res.json(logs);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch maintenance logs" });
  }
});

// ── Add maintenance log ──────────────────────────────────────────────────────
router.post("/products/:id/maintenance", requireTenant as any, async (req, res) => {
  try {
    const { type, performedBy, cost, description, dateCompleted, nextDue } = req.body;
    if (!description) {
      res.status(400).json({ error: "Description is required" });
      return;
    }
    const [log] = await db
      .insert(maintenanceLogsTable)
      .values({
        productId: Number(req.params.id),
        tenantId: req.tenantId!,
        type: type || "other",
        performedBy: performedBy || null,
        cost: (cost !== null && cost !== undefined && cost !== "") ? String(cost) : null,
        description,
        dateCompleted: dateCompleted || null,
        nextDue: nextDue || null,
      })
      .returning();
    // If nextDue provided, update product's nextMaintenanceDate
    if (nextDue) {
      await db
        .update(productsTable)
        .set({ nextMaintenanceDate: nextDue, updatedAt: new Date() })
        .where(eq(productsTable.id, Number(req.params.id)));
    }
    res.status(201).json(log);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to add maintenance log" });
  }
});

// ── Bulk import: POST /api/products/bulk ────────────────────────────────────
router.post("/products/bulk", requireTenant as any, async (req, res) => {
  try {
    const rows: any[] = Array.isArray(req.body) ? req.body : [];
    if (rows.length === 0) {
      res.status(400).json({ error: "No rows provided" });
      return;
    }
    if (rows.length > 500) {
      res.status(400).json({ error: "Maximum 500 rows per import" });
      return;
    }

    // Build category name → id map for this tenant
    const cats = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.tenantId, req.tenantId!));
    const catByName: Record<string, number> = {};
    for (const c of cats) {
      catByName[c.name.toLowerCase()] = c.id;
      catByName[c.slug.toLowerCase()] = c.id;
    }

    const created: any[] = [];
    const errors: { row: number; error: string }[] = [];

    const validStatus = ["available", "maintenance", "damaged", "reserved", "out_of_service"];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      if (!row.name?.trim()) {
        errors.push({ row: rowNum, error: "Name is required" });
        continue;
      }

      let categoryId: number | null = null;
      if (row.category) {
        categoryId = catByName[String(row.category).toLowerCase().trim()] ?? null;
      }

      const status = validStatus.includes(row.status) ? row.status : "available";
      const quantity = row.quantity != null ? parseInt(row.quantity) || 1 : 1;
      const nextMaintenanceDate = row.nextMaintenanceDate?.trim() || null;

      try {
        const [newProduct] = await db
          .insert(productsTable)
          .values({
            tenantId: req.tenantId!,
            name: row.name.trim(),
            sku: row.sku?.trim() || null,
            categoryId,
            description: row.description?.trim() || null,
            status,
            quantity,
            imageUrls: [],
            brand: row.brand?.trim() || null,
            model: row.model?.trim() || null,
            specs: row.specs?.trim() || null,
            notes: row.notes?.trim() || null,
            nextMaintenanceDate,
            updatedAt: new Date(),
          })
          .returning();
        created.push(newProduct);
      } catch (rowErr: any) {
        errors.push({ row: rowNum, error: rowErr?.message ?? "Insert failed" });
      }
    }

    res.status(207).json({ created: created.length, errors, total: rows.length });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Bulk import failed" });
  }
});

// ── Delete maintenance log ───────────────────────────────────────────────────
router.delete("/products/:productId/maintenance/:logId", requireTenant as any, async (req, res) => {
  try {
    await db
      .delete(maintenanceLogsTable)
      .where(and(
        eq(maintenanceLogsTable.id, Number(req.params.logId)),
        eq(maintenanceLogsTable.tenantId, req.tenantId!),
      ));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete maintenance log" });
  }
});

export default router;
